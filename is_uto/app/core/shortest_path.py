"""
Module 7.2 — Shortest path service and cost matrix builder.

Uses Dijkstra on the directed road graph. Falls back to undirected
graph when no directed path exists (directed graph has no reverse edges).
"""

import logging
from functools import lru_cache
from typing import Optional

import networkx as nx

from app.config import AVG_SPEED_MS
from app.core.graph_loader import get_graph, node_coords

logger = logging.getLogger(__name__)

# Cached undirected version (built lazily once)
_undirected: Optional[nx.Graph] = None


def _get_undirected() -> nx.Graph:
    global _undirected
    if _undirected is None:
        _undirected = get_graph().to_undirected()
    return _undirected


def get_shortest_path(
    start_node: int,
    end_node: int,
    avg_speed_ms: float = AVG_SPEED_MS,
) -> dict:
    """
    Compute shortest path between two road graph nodes.

    Returns:
        {
          "distance_m": float,
          "time_minutes": float,
          "nodes": list[int],
          "coords": list[[lon, lat]]
        }
    Raises ValueError if no path found even in undirected graph.
    """
    if start_node == end_node:
        lon, lat = node_coords(start_node)
        return {
            "distance_m": 0.0,
            "time_minutes": 0.0,
            "nodes": [start_node],
            "coords": [[lon, lat]],
        }

    G = get_graph()

    # Try directed first
    try:
        path = nx.dijkstra_path(G, start_node, end_node, weight="weight")
        dist = nx.dijkstra_path_length(G, start_node, end_node, weight="weight")
    except nx.NetworkXNoPath:
        # Fallback to undirected
        try:
            UG = _get_undirected()
            path = nx.dijkstra_path(UG, start_node, end_node, weight="weight")
            dist = nx.dijkstra_path_length(UG, start_node, end_node, weight="weight")
        except nx.NetworkXNoPath:
            raise ValueError(
                f"No path between nodes {start_node} and {end_node}"
            )
    except nx.NodeNotFound as e:
        raise ValueError(f"Node not found in graph: {e}")

    coords = [list(node_coords(n)) for n in path]
    time_minutes = (dist / avg_speed_ms) / 60.0

    return {
        "distance_m": dist,
        "time_minutes": round(time_minutes, 2),
        "nodes": path,
        "coords": coords,
    }


def build_cost_matrix(
    source_nodes: list,
    target_nodes: list,
    avg_speed_ms: float = AVG_SPEED_MS,
) -> dict:
    """
    Build distance + time matrix for all (source, target) pairs.

    Uses single-source Dijkstra for efficiency — one pass per source covers
    all targets.

    Returns:
        {(src, tgt): {"distance_m": float, "time_minutes": float}}
    """
    G = get_graph()
    UG = _get_undirected()

    all_targets = set(target_nodes)
    matrix: dict[tuple[int, int], dict] = {}

    for src in source_nodes:
        # Directed lengths from src
        try:
            lengths_dir = dict(
                nx.single_source_dijkstra_path_length(G, src, weight="weight")
            )
        except Exception:
            lengths_dir = {}

        # Undirected fallback lengths
        try:
            lengths_undir = dict(
                nx.single_source_dijkstra_path_length(UG, src, weight="weight")
            )
        except Exception:
            lengths_undir = {}

        for tgt in all_targets:
            if tgt in lengths_dir:
                dist = lengths_dir[tgt]
            elif tgt in lengths_undir:
                dist = lengths_undir[tgt]
            else:
                dist = float("inf")

            time_m = (dist / avg_speed_ms) / 60.0 if dist != float("inf") else float("inf")
            matrix[(src, tgt)] = {"distance_m": dist, "time_minutes": round(time_m, 2)}

    return matrix


def distance_m(src: int, tgt: int, matrix: dict) -> float:
    """Helper to get distance from matrix, returns inf if missing."""
    entry = matrix.get((src, tgt))
    return entry["distance_m"] if entry else float("inf")


def time_minutes(src: int, tgt: int, matrix: dict) -> float:
    """Helper to get travel time from matrix, returns inf if missing."""
    entry = matrix.get((src, tgt))
    return entry["time_minutes"] if entry else float("inf")
