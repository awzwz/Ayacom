"use client";

import { useEffect, useRef, useState } from "react";
import type { FleetVehicle, Task, RouteResponse } from "@/lib/types";

interface Props {
  vehicles: FleetVehicle[];
  tasks: Task[];
  route?: RouteResponse | null;
  highlightVehicleId?: number | null;
  onVehicleClick?: (v: FleetVehicle) => void;
  onTaskClick?: (t: Task) => void;
}

// Leaflet must be imported client-side only
export default function MapView({ vehicles, tasks, route, highlightVehicleId, onVehicleClick, onTaskClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const vehicleLayerRef = useRef<any>(null);
  const taskLayerRef = useRef<any>(null);
  const routeLayerRef = useRef<any>(null);
  const fittedRef = useRef(false);
  const [L, setL] = useState<any>(null);
  const [mapReady, setMapReady] = useState(false);

  // Load Leaflet dynamically
  useEffect(() => {
    import("leaflet").then((leaflet) => {
      // Fix default marker icon
      delete (leaflet.Icon.Default.prototype as any)._getIconUrl;
      leaflet.Icon.Default.mergeOptions({
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });
      setL(leaflet);
    });
    // Leaflet CSS
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }
  }, []);

  // Init map
  useEffect(() => {
    if (!L || !containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [47.25, 55.98],
      zoom: 5,
      zoomControl: false,
      attributionControl: false,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
    }).addTo(map);

    L.control.attribution({ prefix: false }).addTo(map);

    mapRef.current = map;
    vehicleLayerRef.current = L.layerGroup().addTo(map);
    taskLayerRef.current = L.layerGroup().addTo(map);
    routeLayerRef.current = L.layerGroup().addTo(map);
    setMapReady(true);

    return () => {
      map.remove();
      mapRef.current = null;
      setMapReady(false);
      fittedRef.current = false;
    };
  }, [L]);

  // Auto-fit once: when map is ready AND vehicles are loaded
  useEffect(() => {
    if (!mapReady || !mapRef.current || fittedRef.current || vehicles.length === 0) return;
    // Bbox from actual API data: lat 46.23–48.35, lon 55.17–56.40
    mapRef.current.fitBounds([[46.23, 55.17], [48.35, 56.40]], { padding: [40, 40] });
    fittedRef.current = true;
  }, [mapReady, vehicles.length]);

  // Draw vehicles
  useEffect(() => {
    if (!L || !vehicleLayerRef.current || vehicles.length === 0) return;
    vehicleLayerRef.current.clearLayers();

    vehicles.forEach((v) => {
      if (!v.start_lat || !v.start_lon) return;
      const isHighlighted = highlightVehicleId === v.wialon_id;
      const isFree = v.free_at_minutes === 0;

      const color = isHighlighted ? "#d4a017" : isFree ? "#3fb950" : "#f85149";
      const size = isHighlighted ? 14 : 10;

      const icon = L.divIcon({
        className: "",
        html: `
          <div style="position:relative;width:${size + 8}px;height:${size + 8}px;">
            ${isHighlighted || isFree ? `
              <div class="pulse-ring" style="
                position:absolute;top:0;left:0;
                width:${size + 8}px;height:${size + 8}px;
                border-radius:50%;
                background:${color};
                opacity:0.3;
              "></div>
            ` : ""}
            <div style="
              position:absolute;
              top:4px;left:4px;
              width:${size}px;height:${size}px;
              border-radius:50%;
              background:${color};
              border:2px solid ${isHighlighted ? "#fff" : "rgba(255,255,255,0.3)"};
              box-shadow:0 0 8px ${color}66;
            "></div>
          </div>
        `,
        iconSize: [size + 8, size + 8],
        iconAnchor: [(size + 8) / 2, (size + 8) / 2],
      });

      const shortName = v.name.length > 24 ? v.name.slice(0, 24) + "…" : v.name;

      const marker = L.marker([v.start_lat, v.start_lon], { icon });

      if (onVehicleClick) {
        marker.on("click", () => onVehicleClick(v));
      }

      vehicleLayerRef.current.addLayer(marker);
    });
  }, [L, vehicles, highlightVehicleId, onVehicleClick, onTaskClick]);

  // Draw tasks
  useEffect(() => {
    if (!L || !taskLayerRef.current) return;
    taskLayerRef.current.clearLayers();

    tasks.forEach((t) => {
      if (!t.dest_lat || !t.dest_lon) return;
      const priorityColor = t.priority === "high" ? "#d4a017" : t.priority === "medium" ? "#1f6feb" : "#8b949e";

      const icon = L.divIcon({
        className: "",
        html: `
          <div style="
            width:10px;height:10px;
            background:${priorityColor};
            border:2px solid rgba(255,255,255,0.4);
            border-radius:2px;
            transform:rotate(45deg);
            box-shadow:0 0 6px ${priorityColor}88;
          "></div>
        `,
        iconSize: [10, 10],
        iconAnchor: [5, 5],
      });

      const taskMarker = L.marker([t.dest_lat, t.dest_lon], { icon });
      if (onTaskClick) {
        taskMarker.on("click", () => onTaskClick(t));
      }
      taskMarker.addTo(taskLayerRef.current);
    });
  }, [L, tasks]);

  // Draw route
  useEffect(() => {
    if (!L || !routeLayerRef.current) return;
    routeLayerRef.current.clearLayers();

    if (!route || !route.coords || route.coords.length === 0) return;

    const latlngs = route.coords.map(([lon, lat]) => [lat, lon] as [number, number]);

    // Glow layer
    L.polyline(latlngs, {
      color: "#d4a017",
      weight: 12,
      opacity: 0.15,
    }).addTo(routeLayerRef.current);

    // Solid background
    L.polyline(latlngs, {
      color: "#0d1117",
      weight: 6,
      opacity: 0.6,
    }).addTo(routeLayerRef.current);

    // Main dashed line
    L.polyline(latlngs, {
      color: "#d4a017",
      weight: 4,
      opacity: 1,
      dashArray: "10 7",
    }).addTo(routeLayerRef.current);

    // Start marker
    const startIcon = L.divIcon({
      className: "",
      html: `<div style="width:14px;height:14px;border-radius:50%;background:#3fb950;border:3px solid #fff;box-shadow:0 0 8px #3fb95088;"></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    });
    const endIcon = L.divIcon({
      className: "",
      html: `<div style="width:14px;height:14px;border-radius:50%;background:#d4a017;border:3px solid #fff;box-shadow:0 0 8px #d4a01788;"></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    });
    L.marker(latlngs[0], { icon: startIcon }).addTo(routeLayerRef.current);
    L.marker(latlngs[latlngs.length - 1], { icon: endIcon }).addTo(routeLayerRef.current);

    if (mapRef.current) {
      mapRef.current.fitBounds(latlngs, { padding: [40, 40] });
    }
  }, [L, route]);

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <div
        ref={containerRef}
        style={{ width: "100%", height: "100%", background: "#0d1117" }}
      />

      {/* Legend */}
      <div
        style={{
          position: "absolute",
          bottom: 16,
          right: 16,
          background: "rgba(13,17,23,0.88)",
          border: "1px solid #21262d",
          borderRadius: 12,
          padding: "10px 14px",
          backdropFilter: "blur(8px)",
          zIndex: 1000,
          minWidth: 160,
        }}
      >
        <div style={{ fontSize: 10, fontWeight: 700, color: "#484f58", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>
          Легенда
        </div>
        {/* Vehicles */}
        <div style={{ fontSize: 11, color: "#8b949e", marginBottom: 4, fontWeight: 600 }}>Техника</div>
        {[
          { color: "#3fb950", label: "Свободна" },
          { color: "#f85149", label: "Занята" },
          { color: "#d4a017", label: "Выбрана / маршрут" },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: color, border: "2px solid rgba(255,255,255,0.3)", flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: "#8b949e" }}>{label}</span>
          </div>
        ))}
        {/* Tasks */}
        <div style={{ fontSize: 11, color: "#8b949e", marginBottom: 4, fontWeight: 600, marginTop: 6 }}>Заявки</div>
        {[
          { color: "#d4a017", label: "Высокий приоритет" },
          { color: "#1f6feb", label: "Средний приоритет" },
          { color: "#8b949e", label: "Низкий приоритет" },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
            <div style={{
              width: 9, height: 9,
              background: color,
              border: "1.5px solid rgba(255,255,255,0.3)",
              borderRadius: 2,
              transform: "rotate(45deg)",
              flexShrink: 0,
            }} />
            <span style={{ fontSize: 11, color: "#8b949e" }}>{label}</span>
          </div>
        ))}
        {/* Route */}
        <div style={{ fontSize: 11, color: "#8b949e", marginBottom: 4, fontWeight: 600, marginTop: 6 }}>Маршрут</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 24, height: 3, borderTop: "3px dashed #d4a017", flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: "#8b949e" }}>По графу дорог</span>
        </div>
      </div>
    </div>
  );
}
