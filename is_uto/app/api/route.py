"""
POST /api/route
Returns the shortest route between a vehicle position and a well.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from app.core.graph_loader import snap_to_node
from app.core.shortest_path import get_shortest_path
from app.core.fleet_state import get_vehicle

router = APIRouter()

_wells: dict = {}


def set_wells(wells: dict):
    global _wells
    _wells = wells


class FromLocation(BaseModel):
    wialon_id: Optional[int] = None
    lon: Optional[float] = None
    lat: Optional[float] = None


class ToLocation(BaseModel):
    uwi: Optional[str] = None
    lon: Optional[float] = None
    lat: Optional[float] = None


class RouteRequest(BaseModel):
    # "from" is a reserved word in Python, so we use from_location
    from_location: FromLocation
    to_location: ToLocation

    class Config:
        # Allow "from" key in JSON by aliasing
        populate_by_name = True


class RouteResponse(BaseModel):
    distance_km: float
    time_minutes: float
    nodes: list
    coords: list
    from_node: int
    to_node: int


@router.post("/route", response_model=RouteResponse)
def route(req: RouteRequest):
    # Resolve start (from)
    f = req.from_location
    if f.wialon_id is not None:
        vehicle = get_vehicle(f.wialon_id)
        if vehicle is None:
            raise HTTPException(404, f"Vehicle {f.wialon_id} not found in fleet")
        from_node = vehicle.start_node
    elif f.lon is not None and f.lat is not None:
        from_node = snap_to_node(f.lon, f.lat)
    else:
        raise HTTPException(422, "from_location must provide wialon_id or lon+lat")

    # Resolve destination (to)
    t = req.to_location
    if t.uwi is not None:
        well = _wells.get(t.uwi)
        if well is None:
            raise HTTPException(404, f"Well '{t.uwi}' not found or has no coordinates")
        to_node = snap_to_node(well["lon"], well["lat"])
    elif t.lon is not None and t.lat is not None:
        to_node = snap_to_node(t.lon, t.lat)
    else:
        raise HTTPException(422, "to_location must provide uwi or lon+lat")

    try:
        result = get_shortest_path(from_node, to_node)
    except ValueError as e:
        raise HTTPException(404, str(e))

    return RouteResponse(
        distance_km=round(result["distance_m"] / 1000, 3),
        time_minutes=result["time_minutes"],
        nodes=result["nodes"],
        coords=result["coords"],
        from_node=from_node,
        to_node=to_node,
    )
