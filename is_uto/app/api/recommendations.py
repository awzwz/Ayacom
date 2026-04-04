"""
POST /api/recommendations
Returns top-3 vehicle candidates for a given task.
"""

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.core.graph_loader import snap_to_node
from app.core.llm_reason import generate_reason
from app.core.optimizer import recommend_single
from app.data.loaders import load_wells

router = APIRouter()

# Wells cache (populated at startup via main.py lifespan)
_wells: dict = {}


def set_wells(wells: dict):
    global _wells
    _wells = wells


class RecommendRequest(BaseModel):
    task_id: str
    priority: str = "medium"                  # low / medium / high
    destination_uwi: str
    planned_start: str                        # ISO datetime string
    duration_hours: float = 4.0
    shift: str = "day"                        # day / night
    task_type: str = ""                       # work type code


class UnitResult(BaseModel):
    wialon_id: int
    name: str
    registration: str
    eta_minutes: float
    distance_km: float
    score: float
    reason: str
    is_free: bool
    compatible: bool


class RecommendResponse(BaseModel):
    task_id: str
    destination_uwi: str
    dest_node: int
    units: list[UnitResult]


@router.post("/recommendations", response_model=RecommendResponse)
def recommendations(req: RecommendRequest):
    # Resolve UWI → coordinates → road graph node
    well = _wells.get(req.destination_uwi)
    if well is None:
        raise HTTPException(
            status_code=404,
            detail=f"Well '{req.destination_uwi}' not found or has no coordinates",
        )

    dest_node = snap_to_node(well["lon"], well["lat"])

    try:
        planned_start = datetime.fromisoformat(req.planned_start)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid planned_start datetime format")

    candidates = recommend_single(
        task_id=req.task_id,
        priority=req.priority,
        destination_uwi=req.destination_uwi,
        planned_start=planned_start,
        duration_hours=req.duration_hours,
        shift=req.shift,
        task_type=req.task_type,
        dest_node=dest_node,
        top_n=3,
    )

    units = []
    for c in candidates:
        reason = generate_reason(
            vehicle_name=c["name"],
            distance_km=c["distance_km"],
            eta_minutes=c["eta_minutes"],
            is_free=c["is_free"],
            priority=req.priority,
            score=c["score"],
            compatible=c["compatible"],
        )
        units.append(
            UnitResult(
                wialon_id=c["wialon_id"],
                name=c["name"],
                registration=c["registration"],
                eta_minutes=c["eta_minutes"],
                distance_km=c["distance_km"],
                score=c["score"],
                reason=reason,
                is_free=c["is_free"],
                compatible=c["compatible"],
            )
        )

    return RecommendResponse(
        task_id=req.task_id,
        destination_uwi=req.destination_uwi,
        dest_node=dest_node,
        units=units,
    )
