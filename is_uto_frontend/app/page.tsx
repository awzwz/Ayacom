"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { Bell, Search, HelpCircle, Layers, Crosshair, Plus, Minus } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import RecommendPanel from "@/components/RecommendPanel";
import GroupingPanel from "@/components/GroupingPanel";
import FleetPanel from "@/components/FleetPanel";
import DetailDrawer from "@/components/DetailDrawer";
import { api } from "@/lib/api";
import type { FleetVehicle, Task, RouteResponse, VehicleUnit } from "@/lib/types";

const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });

const TABS = ["Рекомендации", "Группировка", "Парк техники"] as const;
type Tab = (typeof TABS)[number];

export default function HomePage() {
  const [tab, setTab] = useState<Tab>("Рекомендации");
  const [vehicles, setVehicles] = useState<FleetVehicle[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [route, setRoute] = useState<RouteResponse | null>(null);
  const [highlightId, setHighlightId] = useState<number | null>(null);
  const [selectedFleetId, setSelectedFleetId] = useState<number | null>(null);
  const [drawerVehicle, setDrawerVehicle] = useState<FleetVehicle | null>(null);
  const [drawerTask, setDrawerTask] = useState<Task | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    api.fleet(200).then((r) => setVehicles(r.vehicles)).catch(() => {});
    api.tasks(undefined, 100).then((r) => setTasks(r.tasks)).catch(() => {});
  }, []);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const handleRoute = useCallback((r: RouteResponse, vehicleId: number) => {
    setRoute(r);
    setHighlightId(vehicleId);
    showToast(`Маршрут: ${r.distance_km.toFixed(1)} км · ${r.time_minutes.toFixed(0)} мин`);
  }, []);

  const handleAssign = useCallback((unit: VehicleUnit, taskId: string) => {
    setHighlightId(unit.wialon_id);
    const shortName = unit.name.split(" ").slice(1, 3).join(" ");
    showToast(`✓ ${shortName} назначена на ${taskId}`);
    // Refresh fleet to reflect updated busy status
    setTimeout(() => {
      api.fleet(200).then((r) => setVehicles(r.vehicles)).catch(() => {});
    }, 500);
  }, []);

  const handleFleetSelect = useCallback((v: FleetVehicle) => {
    setSelectedFleetId(v.wialon_id);
    setHighlightId(v.wialon_id);
    setDrawerVehicle(v);
    setDrawerTask(null);
  }, []);

  const handleTaskClick = useCallback((t: Task) => {
    setDrawerTask(t);
    setDrawerVehicle(null);
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerVehicle(null);
    setDrawerTask(null);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#0d1117" }}>
      <Sidebar />

      <div className="flex flex-col flex-1 min-w-0">
        {/* Top bar */}
        <div
          className="flex items-center gap-3 px-5 shrink-0"
          style={{ height: 52, borderBottom: "1px solid #21262d", background: "#0d1117" }}
        >
          <div className="relative" style={{ width: 320 }}>
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#484f58" }} />
            <input
              type="text"
              placeholder="Поиск объектов, ТС или адресов..."
              className="w-full rounded-lg pl-8 pr-3 py-1.5 text-xs outline-none"
              style={{ background: "#161b22", border: "1px solid #21262d", color: "#e6edf3" }}
            />
          </div>

          <div className="flex-1 text-center">
            <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: "#30363d" }}>
              Интеллектуальное управление маршрутами
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              className="relative p-2 rounded-lg"
              style={{ color: "#8b949e" }}
            >
              <Bell size={15} />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full" style={{ background: "#d4a017" }} />
            </button>
            <button className="p-2 rounded-lg" style={{ color: "#8b949e" }}>
              <HelpCircle size={15} />
            </button>
            <div
              className="rounded-full flex items-center justify-center text-xs font-bold ml-1"
              style={{ width: 30, height: 30, background: "#1f6feb", color: "#fff" }}
            >
              AA
            </div>
          </div>
        </div>

        {/* Map + right panel */}
        <div className="flex flex-1 min-h-0">
          {/* Map */}
          <div className="relative flex-1 min-w-0">
            <MapView
              vehicles={vehicles}
              tasks={tasks}
              route={route}
              highlightVehicleId={highlightId}
              onVehicleClick={handleFleetSelect}
              onTaskClick={handleTaskClick}
            />
            <DetailDrawer
              vehicle={drawerVehicle}
              task={drawerTask}
              onClose={closeDrawer}
              onRouteBuilt={handleRoute}
            />

            {/* Map controls */}
            <div
              className="absolute top-4 right-4 flex flex-col rounded-xl overflow-hidden"
              style={{ border: "1px solid #21262d", background: "#161b22bb", backdropFilter: "blur(8px)" }}
            >
              {[
                { Icon: Layers, title: "Слои" },
                { Icon: Crosshair, title: "Моё положение" },
              ].map(({ Icon, title }) => (
                <button
                  key={title}
                  title={title}
                  className="p-2.5 transition-colors"
                  style={{ color: "#8b949e" }}
                  onMouseOver={(e) => (e.currentTarget.style.color = "#e6edf3")}
                  onMouseOut={(e) => (e.currentTarget.style.color = "#8b949e")}
                >
                  <Icon size={15} />
                </button>
              ))}
              <div style={{ height: 1, background: "#21262d" }} />
              <button
                className="p-2.5 transition-colors"
                style={{ color: "#8b949e" }}
                onMouseOver={(e) => (e.currentTarget.style.color = "#e6edf3")}
                onMouseOut={(e) => (e.currentTarget.style.color = "#8b949e")}
              >
                <Plus size={15} />
              </button>
              <button
                className="p-2.5 transition-colors"
                style={{ color: "#8b949e" }}
                onMouseOver={(e) => (e.currentTarget.style.color = "#e6edf3")}
                onMouseOut={(e) => (e.currentTarget.style.color = "#8b949e")}
              >
                <Minus size={15} />
              </button>
            </div>

            {/* Bottom overlay */}
            <div
              className="absolute bottom-4 left-4 rounded-xl px-4 py-2.5"
              style={{ background: "#161b22cc", border: "1px solid #21262d", backdropFilter: "blur(8px)" }}
            >
              <div className="flex items-center gap-5 text-xs">
                <div>
                  <span style={{ color: "#484f58" }}>На карте: </span>
                  <span className="font-semibold" style={{ color: "#e6edf3" }}>{vehicles.length} ТС</span>
                </div>
                <div>
                  <span style={{ color: "#484f58" }}>Заявки: </span>
                  <span className="font-semibold" style={{ color: "#e6edf3" }}>{tasks.length}</span>
                </div>
                {route && (
                  <div>
                    <span style={{ color: "#484f58" }}>Маршрут: </span>
                    <span className="font-bold" style={{ color: "#d4a017" }}>
                      {route.distance_km.toFixed(1)} км
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Toast */}
            {toastMsg && (
              <div
                className="absolute bottom-16 left-1/2 -translate-x-1/2 px-5 py-2.5 rounded-xl text-sm font-medium fade-in"
                style={{
                  background: "#161b22",
                  border: "1px solid #3fb95055",
                  color: "#3fb950",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                  whiteSpace: "nowrap",
                }}
              >
                {toastMsg}
              </div>
            )}
          </div>

          {/* Right panel */}
          <div
            className="flex flex-col shrink-0"
            style={{ width: 400, borderLeft: "1px solid #21262d", background: "#0d1117" }}
          >
            {/* Tabs */}
            <div className="flex shrink-0" style={{ borderBottom: "1px solid #21262d" }}>
              {TABS.map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className="flex-1 py-3.5 text-xs font-semibold relative transition-colors"
                  style={{ color: tab === t ? "#e6edf3" : "#8b949e" }}
                >
                  {t}
                  {tab === t && (
                    <span
                      className="absolute bottom-0 left-3 right-3 h-0.5 rounded-t"
                      style={{ background: "#d4a017" }}
                    />
                  )}
                </button>
              ))}
            </div>

            <div className="flex-1 min-h-0 overflow-hidden">
              {tab === "Рекомендации" && (
                <RecommendPanel onRoute={handleRoute} onAssign={handleAssign} />
              )}
              {tab === "Группировка" && <GroupingPanel tasks={tasks} />}
              {tab === "Парк техники" && (
                <FleetPanel
                  vehicles={vehicles}
                  onSelect={handleFleetSelect}
                  selectedId={selectedFleetId}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
