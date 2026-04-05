"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  Bell,
  Search,
  HelpCircle,
  Layers,
  Crosshair,
  Plus,
  Minus,
  Clapperboard,
  Settings,
  LogOut,
  MapPin,
  Truck,
} from "lucide-react";
import Sidebar from "@/components/Sidebar";
import RecommendPanel from "@/components/RecommendPanel";
import GroupingPanel from "@/components/GroupingPanel";
import FleetPanel from "@/components/FleetPanel";
import DetailDrawer from "@/components/DetailDrawer";
import SimulationControls from "@/components/SimulationControls";
import { useSimulation } from "@/hooks/useSimulation";
import { api } from "@/lib/api";
import type { FleetVehicle, Task, RouteResponse, VehicleUnit, SimulationPlan } from "@/lib/types";

const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });

const TABS = ["Рекомендации", "Группировка", "Парк техники"] as const;
type Tab = (typeof TABS)[number];

type SearchHit =
  | { kind: "vehicle"; vehicle: FleetVehicle }
  | { kind: "task"; task: Task };

function norm(s: string) {
  return s.trim().toLowerCase();
}

function searchHits(query: string, vehicles: FleetVehicle[], tasks: Task[], vLimit = 8, tLimit = 8): SearchHit[] {
  const q = norm(query);
  if (!q) return [];

  const vHits: SearchHit[] = [];
  for (const v of vehicles) {
    if (vHits.length >= vLimit) break;
    const hay = [v.name, v.registration, String(v.wialon_id), v.vehicle_type_code].map(norm).join(" ");
    if (hay.includes(q)) vHits.push({ kind: "vehicle", vehicle: v });
  }
  const tHits: SearchHit[] = [];
  for (const t of tasks) {
    if (tHits.length >= tLimit) break;
    const hay = [t.task_id, t.destination_uwi, t.task_type, t.shift].map(norm).join(" ");
    if (hay.includes(q)) tHits.push({ kind: "task", task: t });
  }
  return [...vHits, ...tHits];
}

export default function HomePage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("Рекомендации");
  const [vehicles, setVehicles] = useState<FleetVehicle[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [route, setRoute] = useState<RouteResponse | null>(null);
  const [highlightId, setHighlightId] = useState<number | null>(null);
  const [selectedFleetId, setSelectedFleetId] = useState<number | null>(null);
  const [drawerVehicle, setDrawerVehicle] = useState<FleetVehicle | null>(null);
  const [drawerTask, setDrawerTask] = useState<Task | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [simPlan, setSimPlan] = useState<SimulationPlan | null>(null);
  const [simLoading, setSimLoading] = useState(false);
  const sim = useSimulation(simPlan);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [flyTo, setFlyTo] = useState<{ lat: number; lon: number; zoom?: number; stamp: number } | null>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifications, setNotifications] = useState(() => [
    { id: "n1", title: "Назначение", body: "Заявка T-104 пересчитана и готова к отправке.", time: "2 мин", read: false },
    { id: "n2", title: "Автопарк", body: "3 ТС вышли на линию в смену «День».", time: "18 мин", read: false },
    { id: "n3", title: "Система", body: "Синхронизация с Wialon завершена.", time: "1 ч", read: true },
  ]);

  const searchWrapRef = useRef<HTMLDivElement>(null);
  const notifWrapRef = useRef<HTMLDivElement>(null);
  const profileWrapRef = useRef<HTMLDivElement>(null);

  const searchResults = useMemo(
    () => searchHits(searchQuery, vehicles, tasks),
    [searchQuery, vehicles, tasks],
  );

  const unreadNotifCount = notifications.filter((n) => !n.read).length;

  const panTo = useCallback((lat: number, lon: number, zoom = 15) => {
    setFlyTo((prev) => ({
      lat,
      lon,
      zoom,
      stamp: (prev?.stamp ?? 0) + 1,
    }));
  }, []);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (searchWrapRef.current && !searchWrapRef.current.contains(t)) setSearchOpen(false);
      if (notifWrapRef.current && !notifWrapRef.current.contains(t)) setNotifOpen(false);
      if (profileWrapRef.current && !profileWrapRef.current.contains(t)) setProfileOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSearchOpen(false);
        setNotifOpen(false);
        setProfileOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    api.fleet(200).then((r) => setVehicles(r.vehicles)).catch(() => {});
    api.tasks(undefined, 100).then((r) => setTasks(r.tasks)).catch(() => {});
  }, []);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  }, []);

  const handleRoute = useCallback((r: RouteResponse, vehicleId: number) => {
    setRoute(r);
    setHighlightId(vehicleId);
    showToast(`Маршрут: ${r.distance_km.toFixed(1)} км · ${r.time_minutes.toFixed(0)} мин`);
  }, [showToast]);

  const handleAssign = useCallback((unit: VehicleUnit, taskId: string) => {
    setHighlightId(unit.wialon_id);
    const shortName = unit.name.split(" ").slice(1, 3).join(" ");
    showToast(`✓ ${shortName} назначена на ${taskId}`);
    setTimeout(() => {
      api.fleet(200).then((r) => setVehicles(r.vehicles)).catch(() => {});
    }, 500);
  }, [showToast]);

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

  const applySearchHit = useCallback(
    (hit: SearchHit) => {
      setSearchOpen(false);
      setSearchQuery("");
      if (hit.kind === "vehicle") {
        const v = hit.vehicle;
        handleFleetSelect(v);
        panTo(v.start_lat, v.start_lon);
        showToast(`На карте: ${v.name}`);
        return;
      }
      const t = hit.task;
      handleTaskClick(t);
      if (t.dest_lat != null && t.dest_lon != null) {
        panTo(t.dest_lat, t.dest_lon);
        showToast(`Заявка ${t.task_id} · ${t.destination_uwi}`);
      } else {
        showToast(`Заявка ${t.task_id} — координаты цели не заданы`);
      }
    },
    [handleFleetSelect, handleTaskClick, panTo, showToast],
  );

  const closeDrawer = useCallback(() => {
    setDrawerVehicle(null);
    setDrawerTask(null);
  }, []);

  const startSimulation = useCallback(async () => {
    setSimLoading(true);
    try {
      const plan = await api.simulation({ max_tasks: 25, time_limit_seconds: 20 });
      setSimPlan(plan);
      sim.reset();
      showToast(`Симуляция готова: ${plan.vehicles.length} машин, ${plan.tasks.length} заявок`);
    } catch (e) {
      showToast("Ошибка запуска симуляции");
    } finally {
      setSimLoading(false);
    }
  }, [sim, showToast]);

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#0d1117" }}>
      <Sidebar />

      <div className="flex flex-col flex-1 min-w-0">
        {/* Top bar */}
        <div
          className="flex items-center gap-3 px-5 shrink-0 relative z-[2000]"
          style={{ height: 52, borderBottom: "1px solid #21262d", background: "#0d1117" }}
        >
          <div ref={searchWrapRef} className="relative" style={{ width: 320 }}>
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-[1]" style={{ color: "#484f58" }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && searchResults.length > 0) {
                  e.preventDefault();
                  applySearchHit(searchResults[0]);
                }
              }}
              placeholder="Поиск объектов, ТС или адресов..."
              className="w-full rounded-lg pl-8 pr-3 py-1.5 text-xs outline-none"
              style={{ background: "#161b22", border: "1px solid #21262d", color: "#e6edf3" }}
              aria-autocomplete="list"
              aria-expanded={searchOpen}
              aria-controls="global-search-results"
            />
            {searchOpen && norm(searchQuery) && (
              <div
                id="global-search-results"
                className="absolute left-0 right-0 top-full mt-1 rounded-lg overflow-hidden shadow-xl max-h-72 overflow-y-auto"
                style={{ background: "#161b22", border: "1px solid #30363d", boxShadow: "0 12px 40px rgba(0,0,0,0.55)" }}
                role="listbox"
              >
                {searchResults.length === 0 ? (
                  <div className="px-3 py-2.5 text-xs" style={{ color: "#8b949e" }}>
                    Ничего не найдено
                  </div>
                ) : (
                  searchResults.map((hit, i) =>
                    hit.kind === "vehicle" ? (
                      <button
                        key={`v-${hit.vehicle.wialon_id}-${i}`}
                        type="button"
                        role="option"
                        className="flex items-start gap-2 w-full text-left px-3 py-2 transition-colors"
                        style={{ color: "#e6edf3", borderBottom: "1px solid #21262d" }}
                        onMouseOver={(e) => (e.currentTarget.style.background = "#21262d")}
                        onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}
                        onClick={() => applySearchHit(hit)}
                      >
                        <Truck size={14} className="shrink-0 mt-0.5" style={{ color: "#3fb950" }} />
                        <div className="min-w-0">
                          <div className="text-xs font-semibold truncate">{hit.vehicle.name}</div>
                          <div className="text-[11px] truncate" style={{ color: "#8b949e" }}>
                            {hit.vehicle.registration} · {hit.vehicle.vehicle_type_code}
                          </div>
                        </div>
                      </button>
                    ) : (
                      <button
                        key={`t-${hit.task.task_id}-${i}`}
                        type="button"
                        role="option"
                        className="flex items-start gap-2 w-full text-left px-3 py-2 transition-colors"
                        style={{ color: "#e6edf3", borderBottom: "1px solid #21262d" }}
                        onMouseOver={(e) => (e.currentTarget.style.background = "#21262d")}
                        onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}
                        onClick={() => applySearchHit(hit)}
                      >
                        <MapPin size={14} className="shrink-0 mt-0.5" style={{ color: "#d4a017" }} />
                        <div className="min-w-0">
                          <div className="text-xs font-semibold truncate">{hit.task.task_id}</div>
                          <div className="text-[11px] truncate" style={{ color: "#8b949e" }}>
                            {hit.task.destination_uwi} · {hit.task.task_type}
                          </div>
                        </div>
                      </button>
                    ),
                  )
                )}
              </div>
            )}
          </div>

          <div className="flex-1 text-center pointer-events-none">
            <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: "#30363d" }}>
              Интеллектуальное управление маршрутами
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={startSimulation}
              disabled={simLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
              style={{
                background: simPlan ? "#d4a01722" : "#161b22",
                border: `1px solid ${simPlan ? "#d4a017" : "#30363d"}`,
                color: simPlan ? "#d4a017" : "#8b949e",
                cursor: simLoading ? "wait" : "pointer",
              }}
            >
              <Clapperboard size={13} />
              {simLoading ? "Расчёт..." : simPlan ? "Симуляция" : "Симуляция"}
            </button>

            <div ref={notifWrapRef} className="relative">
              <button
                type="button"
                className="relative p-2 rounded-lg transition-colors"
                style={{ color: notifOpen ? "#e6edf3" : "#8b949e", background: notifOpen ? "#21262d" : "transparent" }}
                aria-expanded={notifOpen}
                aria-haspopup="true"
                onClick={() => {
                  setNotifOpen((o) => !o);
                  setProfileOpen(false);
                }}
                title="Уведомления"
              >
                <Bell size={15} />
                {unreadNotifCount > 0 && (
                  <span
                    className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full"
                    style={{ background: "#d4a017" }}
                  />
                )}
              </button>
              {notifOpen && (
                <div
                  className="absolute right-0 top-full mt-1 w-[min(100vw-24px,340px)] rounded-xl overflow-hidden"
                  style={{ background: "#161b22", border: "1px solid #30363d", boxShadow: "0 12px 40px rgba(0,0,0,0.55)" }}
                >
                  <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: "1px solid #21262d" }}>
                    <span className="text-xs font-bold" style={{ color: "#e6edf3" }}>
                      Уведомления
                    </span>
                    {unreadNotifCount > 0 && (
                      <button
                        type="button"
                        className="text-[11px] font-semibold"
                        style={{ color: "#58a6ff" }}
                        onClick={() => setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))}
                      >
                        Прочитать все
                      </button>
                    )}
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {notifications.map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        className="w-full text-left px-3 py-2.5 transition-colors"
                        style={{
                          background: n.read ? "transparent" : "#d4a0170d",
                          borderBottom: "1px solid #21262d",
                        }}
                        onMouseOver={(e) => (e.currentTarget.style.background = "#21262d")}
                        onMouseOut={(e) =>
                          (e.currentTarget.style.background = n.read ? "transparent" : "#d4a0170d")
                        }
                        onClick={() => {
                          setNotifications((prev) =>
                            prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)),
                          );
                        }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold" style={{ color: "#e6edf3" }}>
                            {n.title}
                          </span>
                          <span className="text-[10px] shrink-0" style={{ color: "#484f58" }}>
                            {n.time}
                          </span>
                        </div>
                        <p className="text-[11px] mt-0.5 leading-snug" style={{ color: "#8b949e" }}>
                          {n.body}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              className="p-2 rounded-lg transition-colors"
              style={{ color: "#8b949e" }}
              title="Справка и поддержка"
              onClick={() => {
                setNotifOpen(false);
                setProfileOpen(false);
                router.push("/support");
              }}
            >
              <HelpCircle size={15} />
            </button>

            <div ref={profileWrapRef} className="relative ml-1">
              <button
                type="button"
                className="rounded-full flex items-center justify-center text-xs font-bold outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d1117] focus-visible:ring-[#58a6ff]"
                style={{ width: 30, height: 30, background: "#1f6feb", color: "#fff" }}
                aria-expanded={profileOpen}
                aria-haspopup="true"
                title="Профиль"
                onClick={() => {
                  setProfileOpen((o) => !o);
                  setNotifOpen(false);
                }}
              >
                AA
              </button>
              {profileOpen && (
                <div
                  className="absolute right-0 top-full mt-1 w-48 rounded-xl overflow-hidden py-1"
                  style={{ background: "#161b22", border: "1px solid #30363d", boxShadow: "0 12px 40px rgba(0,0,0,0.55)" }}
                >
                  <button
                    type="button"
                    className="flex items-center gap-2 w-full px-3 py-2 text-xs text-left transition-colors"
                    style={{ color: "#e6edf3" }}
                    onMouseOver={(e) => (e.currentTarget.style.background = "#21262d")}
                    onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}
                    onClick={() => {
                      setProfileOpen(false);
                      router.push("/settings");
                    }}
                  >
                    <Settings size={14} style={{ color: "#8b949e" }} />
                    Настройки
                  </button>
                  <button
                    type="button"
                    className="flex items-center gap-2 w-full px-3 py-2 text-xs text-left transition-colors"
                    style={{ color: "#e6edf3" }}
                    onMouseOver={(e) => (e.currentTarget.style.background = "#21262d")}
                    onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}
                    onClick={() => {
                      setProfileOpen(false);
                      router.push("/support");
                    }}
                  >
                    <HelpCircle size={14} style={{ color: "#8b949e" }} />
                    Поддержка
                  </button>
                  <div style={{ height: 1, background: "#21262d", margin: "4px 0" }} />
                  <button
                    type="button"
                    className="flex items-center gap-2 w-full px-3 py-2 text-xs text-left transition-colors"
                    style={{ color: "#f85149" }}
                    onMouseOver={(e) => (e.currentTarget.style.background = "#f8514918")}
                    onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}
                    onClick={() => {
                      setProfileOpen(false);
                      showToast("Вы вышли из системы (демо)");
                    }}
                  >
                    <LogOut size={14} />
                    Выйти
                  </button>
                </div>
              )}
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
              route={simPlan ? null : route}
              highlightVehicleId={simPlan ? null : highlightId}
              onVehicleClick={handleFleetSelect}
              onTaskClick={handleTaskClick}
              flyTo={flyTo}
              simVehiclePositions={simPlan ? sim.vehiclePositions : undefined}
              simTaskStatuses={simPlan ? sim.taskStatuses : undefined}
              simRoutes={simPlan ? sim.allRoutes : undefined}
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

            {/* Simulation controls */}
            {simPlan && (
              <SimulationControls
                plan={simPlan}
                simTime={sim.simTime}
                playing={sim.playing}
                speed={sim.speed}
                onPlayPause={() => sim.setPlaying(!sim.playing)}
                onReset={sim.reset}
                onSpeedChange={sim.setSpeed}
                onSeek={sim.setSimTime}
                onClose={() => { setSimPlan(null); sim.reset(); }}
              />
            )}

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
