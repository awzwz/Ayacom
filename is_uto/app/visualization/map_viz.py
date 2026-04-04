"""
Folium-based route visualization.
Returns HTML string suitable for embedding or serving directly.
"""

from typing import Optional


def render_route_map(
    route_coords: list,           # [[lon, lat], ...]
    vehicle_coord: Optional[list] = None,   # [lon, lat]
    dest_coord: Optional[list] = None,      # [lon, lat]
    vehicle_name: str = "Машина",
    dest_name: str = "Скважина",
    waypoints: Optional[list] = None,       # [[lon, lat, label], ...] for multi-stop
    title: str = "Маршрут",
) -> str:
    """
    Render an interactive Folium map with the route.

    Returns HTML string.
    """
    try:
        import folium
    except ImportError:
        return "<p>Folium not installed. Run: pip install folium</p>"

    if not route_coords:
        return "<p>No route coordinates provided.</p>"

    # Center map on route midpoint
    mid = len(route_coords) // 2
    center = [route_coords[mid][1], route_coords[mid][0]]  # folium uses [lat, lon]

    m = folium.Map(location=center, zoom_start=13, tiles="OpenStreetMap")

    # Route polyline (coords are [lon, lat], folium needs [lat, lon])
    folium_coords = [[c[1], c[0]] for c in route_coords]
    folium.PolyLine(
        folium_coords,
        color="#1565C0",
        weight=4,
        opacity=0.8,
        tooltip=title,
    ).add_to(m)

    # Vehicle marker (start)
    if vehicle_coord:
        folium.Marker(
            location=[vehicle_coord[1], vehicle_coord[0]],
            popup=folium.Popup(vehicle_name, max_width=200),
            tooltip=vehicle_name,
            icon=folium.Icon(color="blue", icon="truck", prefix="fa"),
        ).add_to(m)

    # Destination marker
    if dest_coord:
        folium.Marker(
            location=[dest_coord[1], dest_coord[0]],
            popup=folium.Popup(dest_name, max_width=200),
            tooltip=dest_name,
            icon=folium.Icon(color="red", icon="flag", prefix="fa"),
        ).add_to(m)

    # Waypoints (for multi-stop routes)
    if waypoints:
        for i, wp in enumerate(waypoints):
            folium.Marker(
                location=[wp[1], wp[0]],
                popup=folium.Popup(wp[2] if len(wp) > 2 else f"Точка {i+1}", max_width=200),
                tooltip=f"Остановка {i+1}",
                icon=folium.Icon(color="orange", icon=str(i + 1), prefix="fa"),
            ).add_to(m)

    # Fit bounds to route
    if folium_coords:
        m.fit_bounds(folium_coords)

    return m._repr_html_()


def render_fleet_map(
    vehicles: list,   # list of VehicleState
    tasks: list,      # list of TaskRecord
    graph_node_coords_fn,  # callable: node_id -> (lon, lat)
) -> str:
    """
    Render a map showing all vehicle positions and task destinations.
    """
    try:
        import folium
    except ImportError:
        return "<p>Folium not installed.</p>"

    # Find center
    all_lats = []
    all_lons = []
    for v in vehicles[:20]:  # sample for center
        lon, lat = graph_node_coords_fn(v.start_node)
        all_lats.append(lat)
        all_lons.append(lon)

    center_lat = sum(all_lats) / len(all_lats) if all_lats else 46.5
    center_lon = sum(all_lons) / len(all_lons) if all_lons else 56.0

    m = folium.Map(location=[center_lat, center_lon], zoom_start=10)

    # Vehicle markers
    for v in vehicles:
        lon, lat = graph_node_coords_fn(v.start_node)
        folium.CircleMarker(
            location=[lat, lon],
            radius=6,
            color="blue",
            fill=True,
            fill_color="blue",
            popup=folium.Popup(f"{v.name}<br>{v.registration}", max_width=200),
            tooltip=v.name,
        ).add_to(m)

    # Task destination markers
    for t in tasks:
        if t.dest_lon and t.dest_lat:
            folium.CircleMarker(
                location=[t.dest_lat, t.dest_lon],
                radius=5,
                color="red",
                fill=True,
                fill_color="red",
                popup=folium.Popup(f"{t.task_id}<br>{t.priority}<br>{t.destination_uwi}", max_width=200),
                tooltip=f"{t.task_id} [{t.priority}]",
            ).add_to(m)

    return m._repr_html_()
