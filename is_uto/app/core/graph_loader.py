"""
Module 7.1 — Road graph loading and spatial indexing.

Loads road_nodes and road_edges from DB into an in-memory NetworkX DiGraph.
Builds a KDTree spatial index for fast snap_to_node(lon, lat) -> node_id lookups.

Note on coordinate systems:
  road_nodes.lon: ~55–57, road_nodes.lat: ~46–48  (obfuscated, metrically consistent)
  wells use the same coordinate space.
  Wialon snapshots use a different coordinate space (pos_x ~59–60) — vehicles are
  assigned to road nodes via deterministic hash instead of spatial lookup.
"""

import logging
from typing import Optional

import networkx as nx
import numpy as np
from scipy.spatial import KDTree

from app.data.db import DBConn

logger = logging.getLogger(__name__)

# Module-level singletons
_graph: Optional[nx.DiGraph] = None
_kdtree: Optional[KDTree] = None
_node_ids: Optional[list] = None   # index → node_id
_node_index: Optional[dict] = None  # node_id → index in _node_ids


def load_graph() -> nx.DiGraph:
    """Load road graph from DB and build spatial index. Called once at startup."""
    global _graph, _kdtree, _node_ids, _node_index

    logger.info("Loading road graph from database...")

    with DBConn() as conn:
        cur = conn.cursor()

        cur.execute('SELECT node_id, lon, lat FROM "references".road_nodes ORDER BY node_id')
        nodes = cur.fetchall()

        cur.execute('SELECT source, target, weight FROM "references".road_edges')
        edges = cur.fetchall()

    G = nx.DiGraph()

    coords = []
    node_ids = []
    node_index = {}

    for idx, (node_id, lon, lat) in enumerate(nodes):
        G.add_node(node_id, lon=float(lon), lat=float(lat))
        coords.append([float(lon), float(lat)])
        node_ids.append(node_id)
        node_index[node_id] = idx

    for source, target, weight in edges:
        G.add_edge(source, target, weight=float(weight))

    _graph = G
    _node_ids = node_ids
    _node_index = node_index
    _kdtree = KDTree(np.array(coords))

    logger.info(
        "Graph loaded: %d nodes, %d edges",
        G.number_of_nodes(),
        G.number_of_edges(),
    )
    return G


def get_graph() -> nx.DiGraph:
    if _graph is None:
        raise RuntimeError("Graph not loaded. Call load_graph() first.")
    return _graph


def snap_to_node(lon: float, lat: float) -> int:
    """Find nearest road node to given coordinates."""
    if _kdtree is None:
        raise RuntimeError("Graph not loaded. Call load_graph() first.")
    _, idx = _kdtree.query([lon, lat])
    return _node_ids[idx]


def node_coords(node_id: int) -> tuple:
    """Return (lon, lat) for a given node_id."""
    G = get_graph()
    n = G.nodes[node_id]
    return n["lon"], n["lat"]


def all_node_ids() -> list[int]:
    return list(_node_ids) if _node_ids else []


def get_node_index() -> dict:
    return _node_index or {}
