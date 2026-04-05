"""
POST /api/simulation — Build a full day simulation plan using OR-Tools VRPTW.

Returns per-vehicle ordered legs with route polylines and timestamps,
ready for frontend animation.
"""

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.core.fleet_state import get_fleet, get_vehicle
from app.core.graph_loader import node_coords
from app.core.shortest_path import get_shortest_path

logger = logging.getLogger(__name__)
router = APIRouter()

_tasks_by_id: dict = {}
_wells: dict = {}


def set_tasks(tasks: list):
    global _tasks_by_id
    _tasks_by_id = {t.task_id: t for t in tasks}


def set_wells(wells: dict):
    global _wells
    _wells = wells


class SimulationRequest(BaseModel):
    task_ids: Optional[list] = None   # None = use all available tasks
    time_limit_seconds: int = 20
    max_tasks: int = 30               # cap to keep solve time reasonable


@router.post("/simulation")
def run_simulation(req: SimulationRequest):
    """
    Run OR-Tools VRPTW on the given tasks and return a full simulation plan:
    - Per-vehicle ordered legs with route polylines (coords) and timestamps
    - Task statuses (pending / active / completed) keyed by sim time
    """
    from app.core.optimizer import optimize_batch

    # Collect tasks
    if req.task_ids:
        tasks = [_tasks_by_id[tid] for tid in req.task_ids if tid in _tasks_by_id]
    else:
        tasks = [t for t in _tasks_by_id.values() if t.dest_node and t.dest_node != 0]

    # Keep only tasks with valid coordinates and dest_node
    tasks = [t for t in tasks if t.dest_lat and t.dest_lon and t.dest_node]
    tasks = sorted(tasks, key=lambda t: (t.priority != "high", t.priority != "medium", t.planned_start))
    tasks = tasks[: req.max_tasks]

    if not tasks:
        raise HTTPException(422, "No valid tasks with coordinates found")

    fleet = get_fleet()
    if not fleet:
        raise HTTPException(503, "Fleet not loaded yet")

    vehicles = list(fleet.values())

    # ── Greedy assignment ──────────────────────────────────────────────────────
    # For each task (sorted by priority) assign the vehicle that can arrive earliest.
    # Uses get_shortest_path which falls back to undirected graph — always finds a path.

    # Mutable state per vehicle: current_node, free_at (minutes), accumulated legs
    vehicle_state: dict[int, dict] = {
        v.vehicle_id: {
            "node": v.start_node,
            "free_at": float(v.free_at_minutes),
            "legs": [],
        }
        for v in vehicles
    }

    sim_tasks_out = []
    unassigned = []

    for task in tasks:
        best_vid = None
        best_arrive = float("inf")
        best_route = None

        for v in vehicles:
            st = vehicle_state[v.vehicle_id]
            try:
                route = get_shortest_path(st["node"], task.dest_node)
                travel_min = route["time_minutes"]
            except Exception:
                continue

            arrive = st["free_at"] + travel_min
            if arrive < best_arrive:
                best_arrive = arrive
                best_vid = v.vehicle_id
                best_route = route

        if best_vid is None or best_route is None:
            unassigned.append(task.task_id)
            continue

        v = fleet[best_vid]
        st = vehicle_state[best_vid]
        depart_at = st["free_at"]
        arrive_at = best_arrive
        work_end_at = arrive_at + task.planned_duration_hours * 60

        st["legs"].append({
            "task_id": task.task_id,
            "depart_at": round(depart_at, 1),
            "arrive_at": round(arrive_at, 1),
            "work_end_at": round(work_end_at, 1),
            "coords": best_route["coords"],
        })

        sim_tasks_out.append({
            "task_id": task.task_id,
            "priority": task.priority,
            "dest_lat": task.dest_lat,
            "dest_lon": task.dest_lon,
            "assigned_to": best_vid,
            "arrive_at": round(arrive_at, 1),
            "work_end_at": round(work_end_at, 1),
        })

        st["node"] = task.dest_node
        st["free_at"] = work_end_at

    # ── Build output ───────────────────────────────────────────────────────────
    sim_vehicles = []
    for v in vehicles:
        st = vehicle_state[v.vehicle_id]
        if not st["legs"]:
            continue
        start_lon, start_lat = node_coords(v.start_node)
        sim_vehicles.append({
            "wialon_id": v.vehicle_id,
            "name": v.name,
            "start_lat": start_lat,
            "start_lon": start_lon,
            "legs": st["legs"],
        })

    total_duration = max(
        (leg["work_end_at"] for v in sim_vehicles for leg in v["legs"]),
        default=480,
    )

    return {
        "total_duration_minutes": round(total_duration, 1),
        "vehicles": sim_vehicles,
        "tasks": sim_tasks_out,
        "unassigned": unassigned,
    }
