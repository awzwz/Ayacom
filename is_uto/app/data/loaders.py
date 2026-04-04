"""
Data loaders: reads tasks CSV, compatibility JSON, wells coords, and wialon snapshots.
"""

import csv
import json
import logging
import os
from dataclasses import dataclass, field
from datetime import datetime

from app.config import TASKS_CSV, COMPATIBILITY_JSON
from app.data.db import DBConn

logger = logging.getLogger(__name__)


@dataclass
class TaskRecord:
    task_id: str
    priority: str             # low / medium / high
    planned_start: datetime
    planned_duration_hours: float
    destination_uwi: str
    task_type: str
    shift: str                # day / night
    start_day: str
    # Filled after snap_to_node:
    dest_node: int = 0
    dest_lon: float = 0.0
    dest_lat: float = 0.0


def load_tasks(path: str = TASKS_CSV) -> list[TaskRecord]:
    """Load tasks from CSV file."""
    tasks = []
    with open(path, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            tasks.append(
                TaskRecord(
                    task_id=row["task_id"],
                    priority=row["priority"],
                    planned_start=datetime.fromisoformat(row["planned_start"]),
                    planned_duration_hours=float(row["planned_duration_hours"]),
                    destination_uwi=row["destination_uwi"],
                    task_type=row["task_type"],
                    shift=row["shift"],
                    start_day=row["start_day"],
                )
            )
    logger.info("Loaded %d tasks from %s", len(tasks), path)
    return tasks


def load_compatibility(path: str = COMPATIBILITY_JSON) -> dict[str, list[str]]:
    """Load vehicle_type_code → [work_type_codes] mapping."""
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def load_wells() -> dict[str, dict]:
    """
    Load wells with non-null coordinates from DB.
    Returns: {uwi: {"lon": float, "lat": float, "name": str}}
    """
    with DBConn() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT uwi, longitude, latitude, well_name
            FROM "references".wells
            WHERE latitude IS NOT NULL AND longitude IS NOT NULL
            """
        )
        wells = {}
        for uwi, lon, lat, name in cur.fetchall():
            wells[uwi] = {
                "lon": float(lon),
                "lat": float(lat),
                "name": name or uwi,
            }
    logger.info("Loaded %d wells with coordinates", len(wells))
    return wells


@dataclass
class SnapshotVehicle:
    wialon_id: int
    name: str
    registration: str
    pos_x: float   # longitude in wialon space (doesn't match road graph)
    pos_y: float   # latitude in wialon space
    pos_t: int     # unix timestamp


def load_wialon_snapshots() -> tuple[
    dict[int, SnapshotVehicle],  # snap1
    dict[int, SnapshotVehicle],  # snap2
    dict[int, SnapshotVehicle],  # snap3 (latest)
]:
    """Load all three wialon snapshots keyed by wialon_id."""
    with DBConn() as conn:
        cur = conn.cursor()
        snaps = []
        for table in (
            '"references".wialon_units_snapshot_1',
            '"references".wialon_units_snapshot_2',
            '"references".wialon_units_snapshot_3',
        ):
            cur.execute(
                f"SELECT wialon_id, nm, registration_plate, pos_x, pos_y, pos_t FROM {table}"
            )
            snap = {}
            for wid, nm, reg, px, py, pt in cur.fetchall():
                snap[wid] = SnapshotVehicle(
                    wialon_id=wid,
                    name=nm or str(wid),
                    registration=reg or "",
                    pos_x=float(px) if px else 0.0,
                    pos_y=float(py) if py else 0.0,
                    pos_t=int(pt) if pt else 0,
                )
            snaps.append(snap)
            logger.info("Loaded %d vehicles from %s", len(snap), table)
    return snaps[0], snaps[1], snaps[2]
