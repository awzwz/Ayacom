"use client";

import { useEffect, useRef, useState } from "react";
import type { FleetVehicle, Task, RouteResponse } from "@/lib/types";
import type { SimVehiclePosition, TaskStatus } from "@/hooks/useSimulation";

interface Props {
  vehicles: FleetVehicle[];
  tasks: Task[];
  route?: RouteResponse | null;
  highlightVehicleId?: number | null;
  onVehicleClick?: (v: FleetVehicle) => void;
  onTaskClick?: (t: Task) => void;
  /** When `stamp` changes, map animates to the point (e.g. global search). */
  flyTo?: { lat: number; lon: number; zoom?: number; stamp: number } | null;
  // Simulation props
  simVehiclePositions?: Record<number, SimVehiclePosition>;
  simTaskStatuses?: Record<string, TaskStatus>;
  simRoutes?: [number, number][][];
}

// Leaflet must be imported client-side only
export default function MapView({
  vehicles,
  tasks,
  route,
  highlightVehicleId,
  onVehicleClick,
  onTaskClick,
  flyTo,
  simVehiclePositions,
  simTaskStatuses,
  simRoutes,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const vehicleLayerRef = useRef<any>(null);
  const taskLayerRef = useRef<any>(null);
  const routeLayerRef = useRef<any>(null);
  const simRouteLayerRef = useRef<any>(null);
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
    simRouteLayerRef.current = L.layerGroup().addTo(map); // below vehicles
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

  // Draw simulation routes (all at once, behind vehicles)
  useEffect(() => {
    if (!L || !simRouteLayerRef.current) return;
    simRouteLayerRef.current.clearLayers();
    if (!simRoutes || simRoutes.length === 0) return;

    simRoutes.forEach((coords) => {
      const latlngs = coords.map(([lon, lat]) => [lat, lon] as [number, number]);
      L.polyline(latlngs, { color: "#d4a017", weight: 2, opacity: 0.35, dashArray: "6 5" })
        .addTo(simRouteLayerRef.current);
    });
  }, [L, simRoutes]);

  // Draw vehicles
  useEffect(() => {
    if (!L || !vehicleLayerRef.current || vehicles.length === 0) return;
    vehicleLayerRef.current.clearLayers();

    vehicles.forEach((v) => {
      // In simulation mode, use sim positions; otherwise use static positions
      const simPos = simVehiclePositions?.[v.wialon_id];
      const lat = simPos?.lat ?? v.start_lat;
      const lon = simPos?.lon ?? v.start_lon;
      if (!lat || !lon) return;

      const isHighlighted = highlightVehicleId === v.wialon_id;

      let color: string;
      if (simPos) {
        // Sim mode: color by vehicle activity status
        color = simPos.status === "traveling" ? "#d4a017"
              : simPos.status === "working"   ? "#f85149"
              : "#3fb950";
      } else {
        color = isHighlighted ? "#d4a017" : v.free_at_minutes === 0 ? "#3fb950" : "#f85149";
      }

      const icon = L.divIcon({
        className: "",
        html: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40" style="filter:drop-shadow(0 2px 4px rgba(0,0,0,0.35))">
          <path d="M16 1 C8.27 1 2 7.27 2 15 C2 25.25 16 39 16 39 C16 39 30 25.25 30 15 C30 7.27 23.73 1 16 1Z" fill="${color}"/>
          <circle cx="16" cy="15" r="10" fill="white" opacity="0.95"/>
          <rect x="9" y="8" width="14" height="14" rx="2.5" fill="${color}"/>
          <rect x="13" y="8.8" width="6" height="1.2" rx="0.6" fill="white" opacity="0.7"/>
          <rect x="11" y="10.5" width="10" height="6.5" rx="1" fill="white" opacity="0.9"/>
          <rect x="7.2" y="10.5" width="1.8" height="3" rx="0.5" fill="${color}"/>
          <rect x="23" y="10.5" width="1.8" height="3" rx="0.5" fill="${color}"/>
          <circle cx="12" cy="20.5" r="1.8" fill="${color}"/>
          <circle cx="12" cy="20.5" r="0.9" fill="white" opacity="0.85"/>
          <circle cx="20" cy="20.5" r="1.8" fill="${color}"/>
          <circle cx="20" cy="20.5" r="0.9" fill="white" opacity="0.85"/>
        </svg>`,
        iconSize: [32, 40],
        iconAnchor: [16, 40],
      });

      const marker = L.marker([lat, lon], { icon });

      if (onVehicleClick) {
        marker.on("click", () => onVehicleClick(v));
      }

      vehicleLayerRef.current.addLayer(marker);
    });
  }, [L, vehicles, highlightVehicleId, simVehiclePositions, onVehicleClick]);

  // Draw tasks
  useEffect(() => {
    if (!L || !taskLayerRef.current) return;
    taskLayerRef.current.clearLayers();

    tasks.forEach((t) => {
      if (!t.dest_lat || !t.dest_lon) return;
      const priorityColor = t.priority === "high" ? "#d4a017" : t.priority === "medium" ? "#1f6feb" : "#8b949e";

      // In simulation mode, dim completed tasks and highlight active ones
      const simStatus = simTaskStatuses?.[t.task_id];
      const opacity = simStatus === "completed" ? 0.25 : 1;
      const glowColor = simStatus === "active" ? "#3fb950" : priorityColor;
      const size = simStatus === "active" ? 13 : 10;

      const icon = L.divIcon({
        className: "",
        html: `
          <div style="
            width:${size}px;height:${size}px;
            background:${priorityColor};
            border:2px solid rgba(255,255,255,0.4);
            border-radius:2px;
            transform:rotate(45deg);
            box-shadow:0 0 ${simStatus === "active" ? "10" : "6"}px ${glowColor}88;
            opacity:${opacity};
          "></div>
        `,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });

      const taskMarker = L.marker([t.dest_lat, t.dest_lon], { icon });
      if (onTaskClick) {
        taskMarker.on("click", () => onTaskClick(t));
      }
      taskMarker.addTo(taskLayerRef.current);
    });
  }, [L, tasks, simTaskStatuses]);

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

  useEffect(() => {
    if (!mapRef.current || !flyTo) return;
    mapRef.current.setView([flyTo.lat, flyTo.lon], flyTo.zoom ?? 15, { animate: true });
  }, [flyTo?.stamp, flyTo?.lat, flyTo?.lon, flyTo?.zoom]);

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
            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="14" viewBox="0 0 32 40" style={{ flexShrink: 0 }}>
              <path d="M16 1 C8.27 1 2 7.27 2 15 C2 25.25 16 39 16 39 C16 39 30 25.25 30 15 C30 7.27 23.73 1 16 1Z" fill={color}/>
            </svg>
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
