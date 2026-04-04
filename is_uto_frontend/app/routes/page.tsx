"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { Search, Plus, X, MapPin, Clock, Route, ChevronRight, Loader2 } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import { api } from "@/lib/api";
import type { Task, RouteResponse } from "@/lib/types";

const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });

const STATUS_OPTIONS = ["Все", "Ожидает", "Активен", "Завершён"] as const;
type Status = typeof STATUS_OPTIONS[number];

const PRIORITY_LABELS: Record<string, string> = { high: "Высокий", medium: "Средний", low: "Низкий" };
const PRIORITY_COLORS: Record<string, string> = { high: "#d4a017", medium: "#1f6feb", low: "#8b949e" };

function getStatus(task: Task): Status {
  const p = task.priority;
  if (p === "high") return "Активен";
  if (p === "medium") return "Ожидает";
  return "Завершён";
}

const STATUS_COLORS: Record<Status, string> = {
  "Все": "#8b949e",
  "Ожидает": "#d4a017",
  "Активен": "#3fb950",
  "Завершён": "#484f58",
};

export default function RoutesPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<Status>("Все");
  const [search, setSearch] = useState("");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [route, setRoute] = useState<RouteResponse | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);

  useEffect(() => {
    api.tasks(undefined, 100).then((r) => {
      setTasks(r.tasks);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const filtered = tasks.filter((t) => {
    const s = getStatus(t);
    if (statusFilter !== "Все" && s !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return t.task_id.toLowerCase().includes(q) || t.destination_uwi.toLowerCase().includes(q);
    }
    return true;
  });

  const handleSelectTask = async (task: Task) => {
    setSelectedTask(task);
    setRoute(null);
    if (task.dest_lon && task.dest_lat) {
      setRouteLoading(true);
      try {
        const r = await api.route({
          from_location: { lon: task.dest_lon - 0.05, lat: task.dest_lat - 0.03 },
          to_location: { uwi: task.destination_uwi },
        });
        setRoute(r);
      } catch { /* no route */ }
      finally { setRouteLoading(false); }
    }
  };

  const counts = {
    "Все": tasks.length,
    "Ожидает": tasks.filter((t) => getStatus(t) === "Ожидает").length,
    "Активен": tasks.filter((t) => getStatus(t) === "Активен").length,
    "Завершён": tasks.filter((t) => getStatus(t) === "Завершён").length,
  };

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#0d1117" }}>
      <Sidebar />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-5 shrink-0" style={{ borderBottom: "1px solid #21262d" }}>
          <div>
            <h1 className="text-xl font-bold" style={{ color: "#e6edf3" }}>Маршруты</h1>
            <p className="text-xs mt-0.5" style={{ color: "#8b949e" }}>История заявок и назначений</p>
          </div>
          <button
            onClick={() => setShowNewForm(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: "#d4a017", color: "#0d1117" }}
          >
            <Plus size={14} />
            Новый маршрут
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 px-8 py-3 shrink-0" style={{ borderBottom: "1px solid #21262d" }}>
          <div className="relative" style={{ width: 280 }}>
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#484f58" }} />
            <input
              type="text"
              placeholder="Поиск по ID или UWI..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg pl-8 pr-3 py-1.5 text-xs outline-none"
              style={{ background: "#161b22", border: "1px solid #21262d", color: "#e6edf3" }}
            />
          </div>
          <div className="flex gap-1.5">
            {STATUS_OPTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5"
                style={{
                  background: statusFilter === s ? "#1f6feb" : "#161b22",
                  color: statusFilter === s ? "#fff" : "#8b949e",
                  border: `1px solid ${statusFilter === s ? "#1f6feb" : "#21262d"}`,
                }}
              >
                {s}
                <span className="text-xs opacity-60">{counts[s]}</span>
              </button>
            ))}
          </div>
          <span className="ml-auto text-xs" style={{ color: "#484f58" }}>{filtered.length} заявок</span>
        </div>

        {/* Main content: table + detail */}
        <div className="flex flex-1 min-h-0">
          {/* Table */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-full" style={{ color: "#484f58" }}>
                <Loader2 size={24} className="animate-spin" />
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead style={{ background: "#0d1117", borderBottom: "1px solid #21262d" }}>
                  <tr>
                    {["ID заявки", "UWI объекта", "Тип работ", "Приоритет", "Смена", "Длит.", "Статус", ""].map((h) => (
                      <th key={h} className="text-left px-6 py-3 font-semibold" style={{ color: "#484f58" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((task) => {
                    const status = getStatus(task);
                    const pc = PRIORITY_COLORS[task.priority] ?? "#8b949e";
                    const sc = STATUS_COLORS[status];
                    const isSelected = selectedTask?.task_id === task.task_id;
                    return (
                      <tr
                        key={task.task_id}
                        onClick={() => handleSelectTask(task)}
                        className="cursor-pointer transition-colors"
                        style={{
                          borderBottom: "1px solid #161b22",
                          background: isSelected ? "#161b22" : "transparent",
                        }}
                        onMouseOver={(e) => { if (!isSelected) e.currentTarget.style.background = "#0d1117cc"; }}
                        onMouseOut={(e) => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
                      >
                        <td className="px-6 py-3 font-mono font-semibold" style={{ color: "#e6edf3" }}>{task.task_id}</td>
                        <td className="px-6 py-3 font-mono" style={{ color: "#8b949e" }}>{task.destination_uwi}</td>
                        <td className="px-6 py-3" style={{ color: "#8b949e" }}>{task.task_type}</td>
                        <td className="px-6 py-3">
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: pc + "22", color: pc }}>
                            {PRIORITY_LABELS[task.priority]}
                          </span>
                        </td>
                        <td className="px-6 py-3" style={{ color: "#8b949e" }}>{task.shift === "day" ? "День" : "Ночь"}</td>
                        <td className="px-6 py-3" style={{ color: "#8b949e" }}>{task.planned_duration_hours}ч</td>
                        <td className="px-6 py-3">
                          <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: sc }}>
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: sc }} />
                            {status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <ChevronRight size={14} style={{ color: isSelected ? "#d4a017" : "#484f58" }} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Detail panel */}
          {selectedTask && (
            <div
              className="shrink-0 flex flex-col"
              style={{ width: 380, borderLeft: "1px solid #21262d", background: "#0d1117" }}
            >
              <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: "1px solid #21262d" }}>
                <div>
                  <div className="font-bold text-sm font-mono" style={{ color: "#e6edf3" }}>{selectedTask.task_id}</div>
                  <div className="text-xs mt-0.5" style={{ color: "#8b949e" }}>{selectedTask.destination_uwi}</div>
                </div>
                <button onClick={() => setSelectedTask(null)} style={{ color: "#8b949e" }}><X size={15} /></button>
              </div>

              {/* Mini map */}
              <div style={{ height: 200 }} className="shrink-0">
                {routeLoading ? (
                  <div className="h-full flex items-center justify-center" style={{ color: "#484f58" }}>
                    <Loader2 size={20} className="animate-spin" />
                  </div>
                ) : (
                  <MapView
                    vehicles={[]}
                    tasks={[selectedTask]}
                    route={route}
                  />
                )}
              </div>

              {/* Route metrics */}
              {route && (
                <div className="flex gap-3 px-5 py-3 shrink-0" style={{ borderBottom: "1px solid #21262d" }}>
                  {[
                    { icon: MapPin, label: "Расстояние", value: `${route.distance_km.toFixed(1)} км`, color: "#d4a017" },
                    { icon: Clock, label: "Время", value: `${route.time_minutes.toFixed(0)} мин`, color: "#1f6feb" },
                    { icon: Route, label: "Узлов", value: route.nodes.length, color: "#3fb950" },
                  ].map(({ icon: Icon, label, value, color }) => (
                    <div key={label} className="flex-1 rounded-xl p-3 text-center" style={{ background: "#161b22", border: "1px solid #21262d" }}>
                      <Icon size={12} className="mx-auto mb-1" style={{ color }} />
                      <div className="font-bold text-sm" style={{ color: "#e6edf3" }}>{value}</div>
                      <div className="text-xs mt-0.5" style={{ color: "#484f58" }}>{label}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Task details */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
                {[
                  { label: "Тип работ", value: selectedTask.task_type },
                  { label: "Приоритет", value: PRIORITY_LABELS[selectedTask.priority] },
                  { label: "Смена", value: selectedTask.shift === "day" ? "Дневная" : "Ночная" },
                  { label: "Длительность", value: `${selectedTask.planned_duration_hours} ч` },
                  { label: "Начало", value: new Date(selectedTask.planned_start).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) },
                  { label: "Узел графа", value: selectedTask.dest_node ? `#${selectedTask.dest_node}` : "—" },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between items-center rounded-xl px-4 py-2.5" style={{ background: "#161b22", border: "1px solid #21262d" }}>
                    <span className="text-xs" style={{ color: "#484f58" }}>{label}</span>
                    <span className="text-xs font-semibold" style={{ color: "#e6edf3" }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* New route slide-in */}
      {showNewForm && (
        <div className="fixed inset-0 z-50 flex" onClick={() => setShowNewForm(false)}>
          <div className="flex-1" />
          <div
            className="w-96 h-full flex flex-col fade-in"
            style={{ background: "#161b22", borderLeft: "1px solid #30363d" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: "1px solid #21262d" }}>
              <div className="font-bold text-sm" style={{ color: "#e6edf3" }}>Новый маршрут</div>
              <button onClick={() => setShowNewForm(false)} style={{ color: "#8b949e" }}><X size={15} /></button>
            </div>
            <div className="flex-1 flex items-center justify-center p-6">
              <div className="text-center" style={{ color: "#484f58" }}>
                <Route size={32} className="mx-auto mb-3 opacity-30" />
                <div className="text-sm font-medium mb-1">Используйте главную страницу</div>
                <div className="text-xs">Перейдите в «Обзор» → вкладка «Рекомендации»</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
