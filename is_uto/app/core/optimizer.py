"""
Module 7.4 — Optimization core.

Three modes:
  A. recommend_single  — greedy scoring for one task, returns ranked top-N candidates
  B. optimize_batch    — OR-Tools VRPTW for a set of tasks + vehicles
  C. evaluate_grouping — Clarke-Wright savings for multi-stop grouping
"""

import logging
import math
from dataclasses import dataclass
from datetime import datetime
from typing import Optional

from app.config import PRIORITY_DEADLINE_HOURS, SHIFT_RULES, AVG_SPEED_MS, PLANNING_HORIZON_START_MIN
from app.core.fleet_state import VehicleState, get_fleet
from app.core.scorer import score_candidates
from app.core.shortest_path import build_cost_matrix, distance_m, time_minutes

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _task_tw_start(planned_start: datetime, shift: str) -> float:
    """
    Convert task planned_start + shift to minutes OFFSET from PLANNING_HORIZON_START.
    tw_start = 0 means 'beginning of planning day shift'.
    """
    rules = SHIFT_RULES.get(shift, SHIFT_RULES["day"])
    ts = planned_start.replace(hour=rules["start"], minute=0, second=0, microsecond=0)
    # Minutes offset from planning horizon start
    return ts.timestamp() / 60.0 - PLANNING_HORIZON_START_MIN


def _task_tw_end(tw_start: float, shift: str) -> float:
    rules = SHIFT_RULES.get(shift, SHIFT_RULES["day"])
    duration_h = rules["end"] - rules["start"]
    return tw_start + duration_h * 60.0


# ─────────────────────────────────────────────────────────────────────────────
# Mode A: Single task recommendation (greedy + scoring)
# ─────────────────────────────────────────────────────────────────────────────

def recommend_single(
    task_id: str,
    priority: str,
    destination_uwi: str,
    planned_start: datetime,
    duration_hours: float,
    shift: str,
    task_type: str,
    dest_node: int,
    top_n: int = 3,
) -> list:
    """
    Return top_n vehicle candidates ranked by score for a given task.

    Returns:
        list of dicts with keys:
          wialon_id, name, registration, distance_km, eta_minutes, score,
          is_free, wait_minutes, start_node, dest_node
    """
    fleet = get_fleet()
    vehicles = list(fleet.values())

    tw_start = _task_tw_start(planned_start, shift)

    # Build cost matrix: all vehicles → dest_node
    source_nodes = [v.start_node for v in vehicles]
    matrix = build_cost_matrix(source_nodes, [dest_node])

    # Filter by skill compatibility (soft: include all but mark incompatible)
    candidates = []
    for v in vehicles:
        dist = distance_m(v.start_node, dest_node, matrix)
        travel_t = time_minutes(v.start_node, dest_node, matrix)
        if dist == float("inf"):
            continue
        compatible = task_type in v.skills if v.skills else True
        candidates.append({
            "vehicle": v,
            "distance_m": dist,
            "travel_time_min": travel_t,
            "compatible": compatible,
        })

    scored = score_candidates(candidates, tw_start, priority)

    results = []
    for c in scored[:top_n]:
        v = c["vehicle"]
        results.append({
            "wialon_id": v.vehicle_id,
            "name": v.name,
            "registration": v.registration,
            "distance_km": round(c["distance_m"] / 1000, 2),
            "eta_minutes": c["eta_minutes"],
            "score": c["score"],
            "is_free": c["is_free"],
            "compatible": c["compatible"],
            "wait_minutes": c["wait_minutes"],
            "start_node": v.start_node,
            "dest_node": dest_node,
        })
    return results


# ─────────────────────────────────────────────────────────────────────────────
# Mode C: Multi-stop grouping (Clarke-Wright savings)
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class GroupingResult:
    groups: list            # list of list[task_id]
    strategy_summary: str   # "separate" | "mixed" | "single_unit"
    total_distance_km: float
    total_time_minutes: float
    baseline_distance_km: float
    baseline_time_minutes: float
    savings_percent: float
    reason: str


def evaluate_grouping(
    tasks: list,            # list of TaskRecord (with dest_node populated)
    max_total_time_minutes: float = 480.0,
    max_detour_ratio: float = 1.3,
) -> GroupingResult:
    """
    Clarke-Wright savings algorithm for multi-stop grouping.

    Uses a virtual depot = centroid of all task dest_nodes (for savings calc).
    Baseline: each task served separately → total direct distance.
    Optimised: merge task pairs where savings > 0 and constraints satisfied.
    """
    if not tasks:
        return GroupingResult([], "separate", 0, 0, 0, 0, 0.0, "No tasks provided")

    task_nodes = [t.dest_node for t in tasks]
    task_ids = [t.task_id for t in tasks]
    n = len(tasks)

    if n == 1:
        # Baseline: need distance for single task — set to 0 (no travel between tasks)
        return GroupingResult(
            groups=[[task_ids[0]]],
            strategy_summary="single_unit",
            total_distance_km=0.0,
            total_time_minutes=tasks[0].planned_duration_hours * 60,
            baseline_distance_km=0.0,
            baseline_time_minutes=tasks[0].planned_duration_hours * 60,
            savings_percent=0.0,
            reason="Только одна заявка — одиночный выезд.",
        )

    # Build pairwise cost matrix between all task nodes
    all_nodes = list(set(task_nodes))
    matrix = build_cost_matrix(all_nodes, all_nodes)

    # Baseline: sum of distances between consecutive tasks if served separately
    # (use simple direct distances between all pairs for savings estimation)
    def dist(a: int, b: int) -> float:
        return distance_m(a, b, matrix)

    def travel_t(a: int, b: int) -> float:
        d = dist(a, b)
        return (d / AVG_SPEED_MS) / 60.0 if d != float("inf") else float("inf")

    # Savings: s(i,j) = dist(depot→i) + dist(depot→j) - dist(i→j)
    # Use a virtual depot = first task node as reference point
    depot = task_nodes[0]

    savings = []
    for i in range(n):
        for j in range(i + 1, n):
            ni = task_nodes[i]
            nj = task_nodes[j]
            s = dist(depot, ni) + dist(depot, nj) - dist(ni, nj)
            if s > 0:
                savings.append((s, i, j))
    savings.sort(reverse=True)

    # Greedy merge with constraints
    # Each route is a list of task indices
    routes = [[i] for i in range(n)]
    route_of = list(range(n))  # task i belongs to route route_of[i]

    def route_total_dist(route: list) -> float:
        if len(route) == 1:
            return 0.0
        total = 0.0
        for k in range(len(route) - 1):
            d = dist(task_nodes[route[k]], task_nodes[route[k + 1]])
            if d == float("inf"):
                return float("inf")
            total += d
        return total

    def route_service_time(route: list) -> float:
        return sum(tasks[i].planned_duration_hours * 60 for i in route)

    for s_val, i, j in savings:
        ri = route_of[i]
        rj = route_of[j]
        if ri == rj:
            continue  # already in same route

        merged = routes[ri] + routes[rj]

        # Check max_total_time constraint
        d_merged = route_total_dist(merged)
        travel_merged = (d_merged / AVG_SPEED_MS) / 60.0 if d_merged != float("inf") else float("inf")
        svc_merged = route_service_time(merged)
        total_time = travel_merged + svc_merged
        if total_time > max_total_time_minutes:
            continue

        # Check max_detour_ratio: merged route vs sum of individual best routes
        d_i = route_total_dist(routes[ri])
        d_j = route_total_dist(routes[rj])
        baseline_individual = d_i + d_j
        if baseline_individual > 0 and d_merged / baseline_individual > max_detour_ratio:
            continue
        if d_merged == float("inf"):
            continue

        # Merge routes
        routes[ri] = merged
        routes[rj] = []
        for idx in routes[ri]:
            route_of[idx] = ri

    # Collect non-empty routes
    final_routes = [r for r in routes if r]

    # Build result
    groups = [[task_ids[i] for i in route] for route in final_routes]

    # Compute total optimised distance
    opt_dist_m = sum(route_total_dist(r) for r in final_routes)
    opt_time_m = sum(
        (route_total_dist(r) / AVG_SPEED_MS) / 60.0 + route_service_time(r)
        for r in final_routes
    )

    # Baseline: each task separately (no inter-task travel)
    base_dist_m = 0.0  # no inter-task dist when each task alone
    base_time_m = sum(t.planned_duration_hours * 60 for t in tasks)

    # For a better baseline: travel from depot to each task separately
    for t in tasks:
        d = dist(depot, t.dest_node)
        base_dist_m += d if d != float("inf") else 0.0
        base_time_m += (d / AVG_SPEED_MS / 60.0) if d != float("inf") else 0.0

    # Optimised total also includes travel from depot to first task of each route
    opt_dist_m_total = opt_dist_m
    opt_time_m_total = 0.0
    for r in final_routes:
        d_depot_first = dist(depot, task_nodes[r[0]])
        d_route = route_total_dist(r)
        total_d = (d_depot_first if d_depot_first != float("inf") else 0) + \
                  (d_route if d_route != float("inf") else 0)
        opt_dist_m_total += d_depot_first if d_depot_first != float("inf") else 0
        opt_time_m_total += (total_d / AVG_SPEED_MS) / 60.0 + route_service_time(r)

    savings_pct = 0.0
    if base_dist_m > 0:
        savings_pct = max(0.0, (base_dist_m - opt_dist_m_total) / base_dist_m * 100)

    # Strategy summary
    if len(final_routes) == 1:
        strategy = "single_unit"
    elif savings_pct < 1.0:
        strategy = "separate"
    else:
        strategy = "mixed"

    # Build human reason
    reason_parts = []
    for idx, r in enumerate(final_routes):
        if len(r) > 1:
            ids_str = ", ".join(task_ids[i] for i in r)
            d_r = route_total_dist(r) / 1000
            reason_parts.append(
                f"Заявки {ids_str} объединены в маршрут ({d_r:.1f} км между точками)"
            )
        else:
            reason_parts.append(f"Заявка {task_ids[r[0]]} выполняется отдельно")

    reason = "; ".join(reason_parts) + f". Экономия: {savings_pct:.1f}%."

    return GroupingResult(
        groups=groups,
        strategy_summary=strategy,
        total_distance_km=round(opt_dist_m_total / 1000, 2),
        total_time_minutes=round(opt_time_m_total, 1),
        baseline_distance_km=round(base_dist_m / 1000, 2),
        baseline_time_minutes=round(base_time_m, 1),
        savings_percent=round(savings_pct, 1),
        reason=reason,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Mode B: OR-Tools VRPTW batch optimization
# ─────────────────────────────────────────────────────────────────────────────

def optimize_batch(
    tasks: list,           # list of TaskRecord with dest_node populated
    time_limit_seconds: int = 30,
) -> dict:
    """
    Solve Multi-Depot VRPTW using OR-Tools for a batch of tasks.

    Returns:
        {
          "assignments": [{"task_id": ..., "vehicle_id": ..., "route_nodes": [...],
                           "distance_km": ..., "eta_minutes": ..., "score": ...}],
          "total_distance_km": float,
          "unassigned_tasks": [task_id, ...]
        }
    """
    try:
        from ortools.constraint_solver import routing_enums_pb2, pywrapcp
    except ImportError:
        logger.error("OR-Tools not installed")
        return {"assignments": [], "total_distance_km": 0, "unassigned_tasks": [t.task_id for t in tasks]}

    fleet = get_fleet()
    vehicles = list(fleet.values())

    if not tasks or not vehicles:
        return {"assignments": [], "total_distance_km": 0, "unassigned_tasks": []}

    # Index scheme:
    #   0 .. num_vehicles-1          → vehicle start nodes (virtual depot per vehicle)
    #   num_vehicles .. num_vehicles+num_tasks-1  → task destination nodes
    #   last node (num_vehicles+num_tasks)  → dummy end depot (open-end trick)

    num_vehicles = len(vehicles)
    num_tasks = len(tasks)
    dummy_end = num_vehicles + num_tasks

    # Map from location index to road graph node
    location_to_node = []
    for v in vehicles:
        location_to_node.append(v.start_node)
    for t in tasks:
        location_to_node.append(t.dest_node)
    location_to_node.append(vehicles[0].start_node)  # dummy end

    all_unique_nodes = list(set(location_to_node))
    node_matrix = build_cost_matrix(all_unique_nodes, all_unique_nodes)

    def loc_dist(i: int, j: int) -> int:
        """Distance in integer metres between location indices i and j."""
        ni = location_to_node[i]
        nj = location_to_node[j]
        d = distance_m(ni, nj, node_matrix)
        return int(d) if d != float("inf") else 10_000_000

    def loc_time(i: int, j: int) -> int:
        """Travel time in integer minutes between location indices i and j."""
        ni = location_to_node[i]
        nj = location_to_node[j]
        d = distance_m(ni, nj, node_matrix)
        if d == float("inf"):
            return 100_000
        return int((d / AVG_SPEED_MS) / 60.0)

    # Build time windows (minutes from fixed epoch baseline)
    EPOCH_MIN = min(
        _task_tw_start(t.planned_start, t.shift) for t in tasks
    )

    def tw(t) -> tuple:
        s = _task_tw_start(t.planned_start, t.shift) - EPOCH_MIN
        e = _task_tw_end(s + EPOCH_MIN, t.shift) - EPOCH_MIN
        return (int(max(0, s)), int(e))

    # Service times (minutes)
    service_times = [int(t.planned_duration_hours * 60) for t in tasks]

    # OR-Tools setup
    starts = list(range(num_vehicles))
    ends = [dummy_end] * num_vehicles

    manager = pywrapcp.RoutingIndexManager(
        dummy_end + 1,  # total locations
        num_vehicles,
        starts,
        ends,
    )
    routing = pywrapcp.RoutingModel(manager)

    # Distance callback
    def distance_callback(from_idx, to_idx):
        return loc_dist(manager.IndexToNode(from_idx), manager.IndexToNode(to_idx))

    dist_cb_idx = routing.RegisterTransitCallback(distance_callback)
    routing.SetArcCostEvaluatorOfAllVehicles(dist_cb_idx)

    # Time dimension callback
    def time_callback(from_idx, to_idx):
        fi = manager.IndexToNode(from_idx)
        ti = manager.IndexToNode(to_idx)
        travel = loc_time(fi, ti)
        # Add service time at departure node (for task nodes)
        task_start = num_vehicles
        svc = service_times[fi - task_start] if task_start <= fi < task_start + num_tasks else 0
        return travel + svc

    time_cb_idx = routing.RegisterTransitCallback(time_callback)
    routing.AddDimension(
        time_cb_idx,
        slack_max=480,
        capacity=960,
        fix_start_cumul_to_zero=True,
        name="Time",
    )
    time_dim = routing.GetDimensionOrDie("Time")

    # Set time windows for task nodes
    for task_idx, t in enumerate(tasks):
        node_idx = num_vehicles + task_idx
        idx = manager.NodeToIndex(node_idx)
        tw_s, tw_e = tw(t)
        time_dim.CumulVar(idx).SetRange(tw_s, tw_e)
        # Penalty for missing time window (priority-based)
        penalty_map = {"high": 100_000, "medium": 50_000, "low": 10_000}
        penalty = penalty_map.get(t.priority, 50_000)
        routing.AddDisjunction([idx], penalty)

    # Vehicle availability: set start cumul based on free_at
    for v_idx, v in enumerate(vehicles):
        start_idx = routing.Start(v_idx)
        free_at_from_epoch = max(0, int(v.free_at_minutes))
        time_dim.CumulVar(start_idx).SetRange(free_at_from_epoch, 10_000)

    # Solver parameters
    search_params = pywrapcp.DefaultRoutingSearchParameters()
    search_params.first_solution_strategy = (
        routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    )
    search_params.local_search_metaheuristic = (
        routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    )
    search_params.time_limit.seconds = time_limit_seconds

    solution = routing.SolveWithParameters(search_params)

    if not solution:
        logger.warning("OR-Tools: no solution found")
        return {
            "assignments": [],
            "total_distance_km": 0,
            "unassigned_tasks": [t.task_id for t in tasks],
        }

    # Extract solution
    assignments = []
    total_dist = 0
    assigned_task_idxs = set()

    for v_idx, v in enumerate(vehicles):
        idx = routing.Start(v_idx)
        route_tasks = []
        route_dist = 0

        while not routing.IsEnd(idx):
            node = manager.IndexToNode(idx)
            task_start = num_vehicles
            if task_start <= node < task_start + num_tasks:
                t_idx = node - task_start
                route_tasks.append(t_idx)
                assigned_task_idxs.add(t_idx)
            next_idx = solution.Value(routing.NextVar(idx))
            route_dist += loc_dist(manager.IndexToNode(idx), manager.IndexToNode(next_idx))
            idx = next_idx

        if route_tasks:
            total_dist += route_dist
            for t_idx in route_tasks:
                t = tasks[t_idx]
                d_km = loc_dist(v_idx, num_vehicles + t_idx) / 1000
                assignments.append({
                    "task_id": t.task_id,
                    "vehicle_id": v.vehicle_id,
                    "vehicle_name": v.name,
                    "distance_km": round(d_km, 2),
                    "eta_minutes": loc_time(v_idx, num_vehicles + t_idx),
                    "priority": t.priority,
                })

    unassigned = [tasks[i].task_id for i in range(num_tasks) if i not in assigned_task_idxs]

    return {
        "assignments": assignments,
        "total_distance_km": round(total_dist / 1000, 2),
        "unassigned_tasks": unassigned,
    }
