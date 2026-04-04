"""
POST /api/multitask   — multi-stop grouping via Clarke-Wright savings
POST /api/batch       — OR-Tools VRPTW batch assignment
"""

import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.core.graph_loader import snap_to_node
from app.core.optimizer import evaluate_grouping, optimize_batch
from app.data.loaders import load_tasks, TaskRecord

logger = logging.getLogger(__name__)
router = APIRouter()

_wells: dict = {}
_tasks_by_id: dict = {}   # task_id -> TaskRecord


def set_wells(wells: dict):
    global _wells
    _wells = wells


def set_tasks(tasks: list):
    global _tasks_by_id
    _tasks_by_id = {t.task_id: t for t in tasks}
    # Snap destinations to graph nodes
    for t in tasks:
        well = _wells.get(t.destination_uwi)
        if well:
            t.dest_node = snap_to_node(well["lon"], well["lat"])
            t.dest_lon = well["lon"]
            t.dest_lat = well["lat"]


# ─── Multitask grouping ───────────────────────────────────────────────────────

class MultitaskConstraints(BaseModel):
    max_total_time_minutes: float = 480.0
    max_detour_ratio: float = 1.3


class MultitaskRequest(BaseModel):
    task_ids: list
    constraints: MultitaskConstraints = MultitaskConstraints()


class MultitaskResponse(BaseModel):
    groups: list
    strategy_summary: str
    total_distance_km: float
    total_time_minutes: float
    baseline_distance_km: float
    baseline_time_minutes: float
    savings_percent: float
    reason: str


@router.post("/multitask", response_model=MultitaskResponse)
def multitask(req: MultitaskRequest):
    if not req.task_ids:
        raise HTTPException(422, "task_ids cannot be empty")

    tasks = []
    missing = []
    for tid in req.task_ids:
        t = _tasks_by_id.get(tid)
        if t is None:
            missing.append(tid)
        elif t.dest_node == 0:
            missing.append(f"{tid} (no well coordinates)")
        else:
            tasks.append(t)

    if missing:
        raise HTTPException(404, f"Tasks not found or missing well coords: {missing}")

    result = evaluate_grouping(
        tasks=tasks,
        max_total_time_minutes=req.constraints.max_total_time_minutes,
        max_detour_ratio=req.constraints.max_detour_ratio,
    )

    return MultitaskResponse(
        groups=result.groups,
        strategy_summary=result.strategy_summary,
        total_distance_km=result.total_distance_km,
        total_time_minutes=result.total_time_minutes,
        baseline_distance_km=result.baseline_distance_km,
        baseline_time_minutes=result.baseline_time_minutes,
        savings_percent=result.savings_percent,
        reason=result.reason,
    )


# ─── Batch OR-Tools assignment ────────────────────────────────────────────────

class BatchRequest(BaseModel):
    task_ids: list
    time_limit_seconds: int = 30


@router.post("/batch")
def batch(req: BatchRequest):
    if not req.task_ids:
        raise HTTPException(422, "task_ids cannot be empty")

    tasks = []
    for tid in req.task_ids:
        t = _tasks_by_id.get(tid)
        if t and t.dest_node != 0:
            tasks.append(t)

    if not tasks:
        raise HTTPException(404, "No valid tasks found")

    result = optimize_batch(tasks, time_limit_seconds=req.time_limit_seconds)
    return result
