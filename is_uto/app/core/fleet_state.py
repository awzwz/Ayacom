"""
Module 7.3 — Fleet state management.

Builds VehicleState objects from Wialon snapshots.

Coordinate mismatch note:
  Wialon pos_x/pos_y use a different anonymised coordinate space than the road graph:
    Wialon:     pos_x 59.15–60.43 (lon), pos_y 49.50–51.35 (lat)
    Road graph: lon   55.00–57.00,        lat   46.17–48.35

  Fix: linear normalisation maps Wialon space → road graph space, preserving
  the relative spatial relationships between vehicles. Then snap_to_node() finds
  the nearest road node for each vehicle.

avg_speed is estimated from displacement between snapshot_1 and snapshot_3:
  speed = haversine_like_distance(pos1, pos3) / |t3 - t1|   [m/s]
  If a vehicle didn't move (or timestamps equal), fallback to AVG_SPEED_MS.
"""

import logging
import math
import random
from dataclasses import dataclass, field
from typing import Optional

from app.config import AVG_SPEED_MS, PLANNING_HORIZON_START_MIN
from app.core.graph_loader import all_node_ids, snap_to_node
from app.data.loaders import SnapshotVehicle, load_wialon_snapshots, load_compatibility

# Wialon coordinate space (measured from snapshot data)
_WIA_LON_MIN, _WIA_LON_MAX = 59.1482, 60.4336
_WIA_LAT_MIN, _WIA_LAT_MAX = 49.5035, 51.3465

# Road graph coordinate space
_GRAPH_LON_MIN, _GRAPH_LON_MAX = 55.0003, 56.9997
_GRAPH_LAT_MIN, _GRAPH_LAT_MAX = 46.1731, 48.3540


def _wialon_to_graph(pos_x: float, pos_y: float) -> tuple:
    """
    Linearly normalise Wialon coordinates into the road graph coordinate space.
    Preserves relative spatial positions between vehicles.
    """
    lon = _GRAPH_LON_MIN + (pos_x - _WIA_LON_MIN) / (_WIA_LON_MAX - _WIA_LON_MIN) \
          * (_GRAPH_LON_MAX - _GRAPH_LON_MIN)
    lat = _GRAPH_LAT_MIN + (pos_y - _WIA_LAT_MIN) / (_WIA_LAT_MAX - _WIA_LAT_MIN) \
          * (_GRAPH_LAT_MAX - _GRAPH_LAT_MIN)
    return lon, lat

logger = logging.getLogger(__name__)

# Module-level fleet state (populated at startup)
_fleet: dict = {}           # wialon_id -> VehicleState
_compatibility: dict = {}   # vehicle_type_code -> [work_type_codes]


@dataclass
class VehicleState:
    vehicle_id: int
    name: str
    registration: str
    start_node: int            # road graph node id (current position)
    free_at_minutes: float     # minutes from planning horizon start when free
    avg_speed_ms: float        # m/s
    skills: list               # list of compatible task_type codes
    vehicle_type_code: str     # e.g. '000000023'


def _wialon_displacement_m(v1: SnapshotVehicle, v3: SnapshotVehicle) -> float:
    """
    Approximate displacement in metres between two wialon positions.
    Uses a flat-earth approximation (fine for small distances).
    """
    dx = (v3.pos_x - v1.pos_x) * 111320 * math.cos(math.radians(v1.pos_y))
    dy = (v3.pos_y - v1.pos_y) * 111320
    return math.sqrt(dx * dx + dy * dy)


def _assign_node(wialon_id: int, node_ids: list) -> int:
    """
    Deterministically assign a road graph node to a vehicle.
    Uses hash so the same vehicle always gets the same starting node.
    """
    rng = random.Random(wialon_id)
    return rng.choice(node_ids)


def build_fleet_state(
    compatibility_path: Optional[str] = None,
    planning_horizon_start: Optional[float] = None,
) -> dict:
    """
    Build and cache the fleet state dict.

    Args:
        compatibility_path: path to compatibility.json (uses default if None)
        planning_horizon_start: unix timestamp for t=0 of planning horizon.
                                Defaults to the max pos_t across all snapshots.

    Returns:
        {wialon_id: VehicleState}
    """
    global _fleet, _compatibility

    snap1, snap2, snap3 = load_wialon_snapshots()

    # Load compatibility
    from app.config import COMPATIBILITY_JSON
    path = compatibility_path or COMPATIBILITY_JSON
    _compatibility = load_compatibility(path)

    # All vehicle type codes (keys of compat dict)
    compat_keys = list(_compatibility.keys())

    # Determine planning horizon start (latest known pos_t)
    all_pos_t = [v.pos_t for v in snap3.values() if v.pos_t > 0]
    if planning_horizon_start is None:
        horizon_start = max(all_pos_t) if all_pos_t else 0
    else:
        horizon_start = planning_horizon_start

    node_ids = all_node_ids()
    if not node_ids:
        raise RuntimeError("Graph nodes not loaded. Call load_graph() first.")

    fleet = {}

    # Use snapshot_3 as the latest; fall back to snapshot_1 if missing
    all_ids = set(snap1.keys()) | set(snap3.keys())

    for wid in all_ids:
        v3 = snap3.get(wid) or snap1.get(wid)
        v1 = snap1.get(wid) or v3

        if v3 is None:
            continue

        # avg_speed estimation from snapshot displacement
        dt = abs(v3.pos_t - v1.pos_t) if v1 else 0
        if dt > 60:  # at least 1 minute apart
            disp = _wialon_displacement_m(v1, v3)
            speed = disp / dt  # m/s
            # Only use computed speed if vehicle actually moved (>200m displacement)
            # and speed is in a reasonable range for a vehicle (5–30 m/s = 18–108 km/h)
            if disp > 200 and 5.0 <= speed <= 30.0:
                avg_speed = speed
            else:
                avg_speed = AVG_SPEED_MS
        else:
            avg_speed = AVG_SPEED_MS

        # Map Wialon coordinates to road graph space, then snap to nearest node
        if v3.pos_x > 0 and v3.pos_y > 0:
            graph_lon, graph_lat = _wialon_to_graph(v3.pos_x, v3.pos_y)
            start_node = snap_to_node(graph_lon, graph_lat)
        else:
            start_node = _assign_node(wid, node_ids)  # fallback for missing coords

        # Assign vehicle type and skills deterministically
        rng = random.Random(wid + 1)
        vtype_code = rng.choice(compat_keys)
        skills = _compatibility.get(vtype_code, [])

        # free_at: minutes from PLANNING_HORIZON_START when vehicle becomes free.
        # Since snapshot pos_t are from an old anonymised system, we treat all
        # vehicles as available at t=0 (start of planning horizon).
        free_at = 0.0

        fleet[wid] = VehicleState(
            vehicle_id=wid,
            name=v3.name,
            registration=v3.registration,
            start_node=start_node,
            free_at_minutes=free_at,
            avg_speed_ms=avg_speed,
            skills=skills,
            vehicle_type_code=vtype_code,
        )

    _fleet = fleet
    logger.info("Built fleet state: %d vehicles", len(fleet))
    return fleet


def get_fleet() -> dict:
    """Return the cached fleet state. Raises if not initialised."""
    if not _fleet:
        raise RuntimeError("Fleet not initialised. Call build_fleet_state() first.")
    return _fleet


def get_vehicle(wialon_id: int) -> Optional[VehicleState]:
    return _fleet.get(wialon_id)


def update_vehicle_free_at(wialon_id: int, free_at_minutes: float, new_node: int):
    """Update vehicle availability after a task assignment."""
    v = _fleet.get(wialon_id)
    if v:
        v.free_at_minutes = free_at_minutes
        v.start_node = new_node
