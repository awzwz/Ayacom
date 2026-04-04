"""
IS УТО — Intelligent Vehicle Routing System
FastAPI application entry point.

Startup sequence:
  1. Load road graph (nodes + edges) from DB → NetworkX DiGraph + KDTree
  2. Build fleet state from Wialon snapshots
  3. Load tasks from CSV → snap destinations to graph nodes
  4. Load wells reference data

Endpoints:
  POST /api/recommendations  — top-3 vehicle candidates for a task
  POST /api/route            — shortest path between two points
  POST /api/multitask        — Clarke-Wright multi-stop grouping
  POST /api/batch            — OR-Tools VRPTW batch assignment
  GET  /api/map/route        — interactive Folium map for a route
  GET  /api/map/fleet        — fleet + tasks overview map
  GET  /api/tasks            — list loaded tasks
  GET  /api/fleet            — list fleet vehicles
  GET  /health               — health check
"""

import asyncio
import logging
import os
import time
from concurrent.futures import ThreadPoolExecutor

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, Response
from pydantic import BaseModel

from app.core.graph_loader import load_graph, node_coords
from app.core.fleet_state import build_fleet_state, get_fleet
from app.data.loaders import load_tasks, load_wells
from app.core.graph_loader import snap_to_node
from app.core.shortest_path import get_shortest_path

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="IS УТО — Vehicle Routing API",
    description="Intelligent routing system for special vehicles on oil fields",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=False,
    max_age=86400,
)


@app.options("/{full_path:path}")
async def preflight_handler(full_path: str, request: Request):
    return Response(
        status_code=200,
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Max-Age": "86400",
            "Content-Length": "0",
        },
    )


# ─── Startup ─────────────────────────────────────────────────────────────────

def _load_all_data():
    """Heavy synchronous data loading — runs in a thread pool."""
    logger.info("=== IS УТО data loading started ===")
    t0 = time.time()

    from app.api import recommendations as rec_api
    from app.api import route as route_api
    from app.api import multitask as mt_api

    load_graph()
    logger.info("Graph loaded in %.2fs", time.time() - t0)

    wells = load_wells()
    rec_api.set_wells(wells)
    route_api.set_wells(wells)
    mt_api.set_wells(wells)
    app.state.wells = wells

    fleet = build_fleet_state()
    app.state.fleet = fleet

    try:
        tasks = load_tasks()
        for t in tasks:
            well = wells.get(t.destination_uwi)
            if well:
                t.dest_node = snap_to_node(well["lon"], well["lat"])
                t.dest_lon = well["lon"]
                t.dest_lat = well["lat"]
        mt_api.set_tasks(tasks)
        app.state.tasks = tasks
        logger.info("Loaded %d tasks", len(tasks))
    except FileNotFoundError:
        logger.warning("tasks.csv not found")
        app.state.tasks = []

    app.state.ready = True
    logger.info("=== IS УТО ready in %.2fs ===", time.time() - t0)


@app.on_event("startup")
async def startup():
    # Initialize empty state so /health responds immediately
    app.state.fleet = {}
    app.state.tasks = []
    app.state.wells = {}
    app.state.ready = False
    # Load data in background thread — does not block uvicorn startup
    loop = asyncio.get_event_loop()
    executor = ThreadPoolExecutor(max_workers=1)
    loop.run_in_executor(executor, _load_all_data)


# ─── Routers ─────────────────────────────────────────────────────────────────

from app.api.recommendations import router as rec_router
from app.api.route import router as route_router
from app.api.multitask import router as mt_router

app.include_router(rec_router, prefix="/api", tags=["Recommendations"])
app.include_router(route_router, prefix="/api", tags=["Route"])
app.include_router(mt_router, prefix="/api", tags=["Multi-task"])


# ─── Utility endpoints ────────────────────────────────────────────────────────

class AssignRequest(BaseModel):
    wialon_id: int
    task_id: str
    duration_hours: float = 4.0


@app.post("/api/assign", tags=["Data"])
def assign_vehicle(req: AssignRequest):
    from app.core.fleet_state import update_vehicle_free_at, get_fleet
    fleet = get_fleet()
    vehicle = fleet.get(req.wialon_id)
    if not vehicle:
        raise HTTPException(status_code=404, detail=f"Vehicle {req.wialon_id} not found")
    new_free_at = vehicle.free_at_minutes + req.duration_hours * 60
    update_vehicle_free_at(req.wialon_id, new_free_at, vehicle.start_node)
    logger.info("Assigned vehicle %d to task %s, free_at=%.0f min", req.wialon_id, req.task_id, new_free_at)
    return {"status": "ok", "wialon_id": req.wialon_id, "task_id": req.task_id, "free_at_minutes": new_free_at}


@app.get("/health", tags=["System"])
def health():
    fleet = getattr(app.state, "fleet", {})
    tasks = getattr(app.state, "tasks", [])
    ready = getattr(app.state, "ready", False)
    return {
        "status": "ok" if ready else "loading",
        "vehicles": len(fleet),
        "tasks": len(tasks),
        "wells": len(getattr(app.state, "wells", {})),
    }


@app.get("/api/tasks", tags=["Data"])
def list_tasks(
    priority: str = Query(None, description="Filter by priority: low/medium/high"),
    limit: int = Query(20, ge=1, le=200),
):
    tasks = getattr(app.state, "tasks", [])
    if priority:
        tasks = [t for t in tasks if t.priority == priority]
    result = []
    for t in tasks[:limit]:
        result.append({
            "task_id": t.task_id,
            "priority": t.priority,
            "planned_start": t.planned_start.isoformat(),
            "planned_duration_hours": t.planned_duration_hours,
            "destination_uwi": t.destination_uwi,
            "task_type": t.task_type,
            "shift": t.shift,
            "dest_node": t.dest_node,
            "dest_lon": t.dest_lon,
            "dest_lat": t.dest_lat,
        })
    return {"count": len(result), "tasks": result}


@app.get("/api/fleet", tags=["Data"])
def list_fleet(limit: int = Query(20, ge=1, le=200)):
    fleet = getattr(app.state, "fleet", {})
    result = []
    for v in list(fleet.values())[:limit]:
        lon, lat = node_coords(v.start_node)
        result.append({
            "wialon_id": v.vehicle_id,
            "name": v.name,
            "registration": v.registration,
            "start_node": v.start_node,
            "start_lon": lon,
            "start_lat": lat,
            "free_at_minutes": v.free_at_minutes,
            "avg_speed_kmh": round(v.avg_speed_ms * 3.6, 1),
            "skills_count": len(v.skills),
            "vehicle_type_code": v.vehicle_type_code,
        })
    return {"count": len(result), "vehicles": result}


# ─── Map endpoints ────────────────────────────────────────────────────────────

@app.get("/api/map/route", response_class=HTMLResponse, tags=["Visualization"])
def map_route(
    from_node: int = Query(..., description="Start road node id"),
    to_node: int = Query(..., description="End road node id"),
):
    """Return interactive Folium map for a route between two road nodes."""
    from app.visualization.map_viz import render_route_map

    try:
        result = get_shortest_path(from_node, to_node)
    except ValueError as e:
        raise HTTPException(404, str(e))

    from_coord = list(node_coords(from_node))
    to_coord = list(node_coords(to_node))

    html = render_route_map(
        route_coords=result["coords"],
        vehicle_coord=from_coord,
        dest_coord=to_coord,
        vehicle_name=f"Узел {from_node}",
        dest_name=f"Узел {to_node}",
        title=f"Маршрут {from_node}→{to_node} ({result['distance_m']/1000:.1f} км)",
    )
    return HTMLResponse(content=html)


@app.get("/api/map/fleet", response_class=HTMLResponse, tags=["Visualization"])
def map_fleet():
    """Return Folium map with all vehicles and task destinations."""
    from app.visualization.map_viz import render_fleet_map

    fleet = list(getattr(app.state, "fleet", {}).values())
    tasks = getattr(app.state, "tasks", [])

    html = render_fleet_map(
        vehicles=fleet,
        tasks=tasks,
        graph_node_coords_fn=node_coords,
    )
    return HTMLResponse(content=html)
