"use client";

import { useState } from "react";
import { Clock, MapPin, Zap, CheckCircle, AlertCircle, ChevronRight } from "lucide-react";
import { api } from "@/lib/api";
import type { VehicleUnit, RecommendResponse, RouteResponse } from "@/lib/types";
import clsx from "clsx";

interface Props {
  onRoute: (route: RouteResponse, vehicleId: number) => void;
  onAssign: (unit: VehicleUnit, taskId: string) => void;
}

const PRIORITIES = ["high", "medium", "low"] as const;
const PRIORITY_LABELS: Record<string, string> = { high: "Высокий", medium: "Средний", low: "Низкий" };
const TASK_TYPES = [
  "103", "104", "105", "201", "202", "301", "302", "401", "501",
];
const UWIS = [
  "ASA_0003", "ASA_0015", "ASA_0027", "ASA_0041", "ZHT_0001",
  "ZHT_0012", "ZHT_0025", "ZHT_0038", "ZHT_0050", "ZHT_0063",
];

export default function RecommendPanel({ onRoute, onAssign }: Props) {
  const [uwi, setUwi] = useState("ASA_0003");
  const [priority, setPriority] = useState<"high" | "medium" | "low">("high");
  const [shift, setShift] = useState<"day" | "night">("day");
  const [taskType, setTaskType] = useState("103");
  const [duration, setDuration] = useState(4);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RecommendResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [assigned, setAssigned] = useState<number | null>(null);

  const handleFind = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await api.recommend({
        task_id: `T-${Date.now()}`,
        priority,
        destination_uwi: uwi,
        planned_start: new Date().toISOString().slice(0, 19),
        duration_hours: duration,
        shift,
        task_type: taskType,
      });
      setResult(res);
    } catch (e: any) {
      setError(e.message ?? "Ошибка запроса");
    } finally {
      setLoading(false);
    }
  };

  const handleRoute = async (unit: VehicleUnit) => {
    if (!result) return;
    try {
      const route = await api.route({
        from_location: { wialon_id: unit.wialon_id },
        to_location: { uwi: result.destination_uwi },
      });
      onRoute(route, unit.wialon_id);
    } catch {}
  };

  const handleAssign = async (unit: VehicleUnit) => {
    if (!result) return;
    setAssigned(unit.wialon_id);
    try {
      await api.assign({ wialon_id: unit.wialon_id, task_id: result.task_id, duration_hours: duration });
    } catch {}
    onAssign(unit, result.task_id);
  };

  const scoreColor = (s: number) =>
    s >= 0.85 ? "#3fb950" : s >= 0.6 ? "#d4a017" : "#f85149";

  return (
    <div className="flex flex-col h-full">
      {/* Form */}
      <div className="px-4 pt-4 pb-3" style={{ borderBottom: "1px solid #21262d" }}>
        <div className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "#8b949e" }}>
          Параметры задачи
        </div>

        {/* UWI */}
        <div className="mb-3">
          <label className="block text-xs mb-1" style={{ color: "#8b949e" }}>UWI объекта</label>
          <select
            value={uwi}
            onChange={(e) => setUwi(e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm outline-none"
            style={{ background: "#161b22", border: "1px solid #30363d", color: "#e6edf3" }}
          >
            {UWIS.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </div>

        {/* Type + Duration */}
        <div className="flex gap-2 mb-3">
          <div className="flex-1">
            <label className="block text-xs mb-1" style={{ color: "#8b949e" }}>Тип работ</label>
            <select
              value={taskType}
              onChange={(e) => setTaskType(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{ background: "#161b22", border: "1px solid #30363d", color: "#e6edf3" }}
            >
              {TASK_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div style={{ width: 90 }}>
            <label className="block text-xs mb-1" style={{ color: "#8b949e" }}>Длит. (ч)</label>
            <input
              type="number"
              min={0.5}
              max={12}
              step={0.5}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{ background: "#161b22", border: "1px solid #30363d", color: "#e6edf3" }}
            />
          </div>
        </div>

        {/* Priority */}
        <div className="mb-3">
          <label className="block text-xs mb-1" style={{ color: "#8b949e" }}>Приоритет</label>
          <div className="flex gap-1">
            {PRIORITIES.map((p) => (
              <button
                key={p}
                onClick={() => setPriority(p)}
                className="flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all"
                style={{
                  background: priority === p
                    ? p === "high" ? "#d4a017" : p === "medium" ? "#1f6feb" : "#30363d"
                    : "#161b22",
                  color: priority === p ? (p === "high" ? "#0d1117" : "#fff") : "#8b949e",
                  border: "1px solid",
                  borderColor: priority === p
                    ? p === "high" ? "#d4a017" : p === "medium" ? "#1f6feb" : "#30363d"
                    : "#30363d",
                }}
              >
                {PRIORITY_LABELS[p]}
              </button>
            ))}
          </div>
        </div>

        {/* Shift */}
        <div className="mb-4">
          <label className="block text-xs mb-1" style={{ color: "#8b949e" }}>Смена</label>
          <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid #30363d" }}>
            {(["day", "night"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setShift(s)}
                className="flex-1 py-1.5 text-xs font-semibold transition-all"
                style={{
                  background: shift === s ? "#d4a017" : "#161b22",
                  color: shift === s ? "#0d1117" : "#8b949e",
                }}
              >
                {s === "day" ? "День" : "Ночь"}
              </button>
            ))}
          </div>
        </div>

        {/* Submit */}
        <button
          onClick={handleFind}
          disabled={loading}
          className="w-full rounded-lg py-3 text-sm font-bold transition-all flex items-center justify-center gap-2"
          style={{
            background: loading ? "#a07010" : "#d4a017",
            color: "#0d1117",
            opacity: loading ? 0.8 : 1,
          }}
        >
          <Zap size={15} />
          {loading ? "Поиск..." : "Найти технику"}
        </button>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {error && (
          <div className="rounded-lg p-3 text-sm flex items-start gap-2" style={{ background: "#4a0d0d", color: "#f85149" }}>
            <AlertCircle size={15} className="shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        {loading && (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-xl p-4" style={{ background: "#161b22", border: "1px solid #21262d" }}>
                <div className="skeleton h-4 w-3/4 mb-2" />
                <div className="skeleton h-3 w-1/3 mb-4" />
                <div className="skeleton h-2 w-full mb-2" />
                <div className="skeleton h-8 w-full" />
              </div>
            ))}
          </div>
        )}

        {result && !loading && (
          <>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#8b949e" }}>
                Результаты анализа
              </span>
              <span
                className="text-xs font-bold px-2 py-0.5 rounded"
                style={{ background: "#1f6feb22", color: "#1f6feb" }}
              >
                {result.units.length} варианта
              </span>
            </div>

            <div className="space-y-3">
              {result.units.map((unit, idx) => (
                <div
                  key={unit.wialon_id}
                  className="rounded-xl p-4 card-appear transition-all"
                  style={{
                    background: "#161b22",
                    border: `1px solid ${idx === 0 ? "#d4a017" : "#21262d"}`,
                    boxShadow: idx === 0 ? "0 0 16px #d4a01722" : "none",
                  }}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-1">
                    <div>
                      <div className="font-bold text-sm" style={{ color: "#e6edf3" }}>
                        {unit.name.split(" ").slice(1).join(" ") || unit.name}
                      </div>
                      <div className="text-xs font-mono mt-0.5" style={{ color: "#8b949e" }}>
                        {unit.registration}
                      </div>
                    </div>
                    {idx === 0 && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: "#d4a017", color: "#0d1117" }}>
                        ТОП
                      </span>
                    )}
                  </div>

                  {/* Metrics */}
                  <div className="flex gap-3 my-3">
                    <div className="flex items-center gap-1 text-xs" style={{ color: "#8b949e" }}>
                      <Clock size={12} style={{ color: "#d4a017" }} />
                      <span className="font-semibold" style={{ color: "#e6edf3" }}>
                        {unit.eta_minutes.toFixed(0)} мин
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-xs" style={{ color: "#8b949e" }}>
                      <MapPin size={12} style={{ color: "#1f6feb" }} />
                      <span className="font-semibold" style={{ color: "#e6edf3" }}>
                        {unit.distance_km.toFixed(1)} км
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-xs ml-auto">
                      <span
                        className="px-1.5 py-0.5 rounded text-xs font-semibold"
                        style={{
                          background: unit.is_free ? "#0d4a1a" : "#4a0d0d",
                          color: unit.is_free ? "#3fb950" : "#f85149",
                        }}
                      >
                        {unit.is_free ? "Свободна" : "Занята"}
                      </span>
                    </div>
                  </div>

                  {/* Score bar */}
                  <div className="mb-1 flex justify-between items-center">
                    <span className="text-xs" style={{ color: "#8b949e" }}>Соответствие критериям</span>
                    <span className="text-xs font-bold" style={{ color: scoreColor(unit.score) }}>
                      {(unit.score * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="rounded-full h-1.5 mb-3" style={{ background: "#21262d" }}>
                    <div
                      className="rounded-full h-1.5 score-bar-fill"
                      style={{
                        width: `${unit.score * 100}%`,
                        background: scoreColor(unit.score),
                      }}
                    />
                  </div>

                  {/* Reason */}
                  <p className="text-xs italic mb-3 leading-relaxed" style={{ color: "#8b949e" }}>
                    {unit.reason}
                  </p>

                  {/* Actions */}
                  <div className="flex gap-2">
                    {assigned === unit.wialon_id ? (
                      <div className="flex-1 rounded-lg py-2 text-sm font-semibold flex items-center justify-center gap-2"
                        style={{ background: "#0d4a1a", color: "#3fb950" }}>
                        <CheckCircle size={14} />
                        Назначено
                      </div>
                    ) : (
                      <button
                        onClick={() => handleAssign(unit)}
                        className="flex-1 rounded-lg py-2 text-sm font-semibold transition-all"
                        style={{ background: idx === 0 ? "#d4a017" : "#1f6feb", color: idx === 0 ? "#0d1117" : "#fff" }}
                      >
                        Назначить
                      </button>
                    )}
                    <button
                      onClick={() => handleRoute(unit)}
                      className="rounded-lg px-3 py-2 text-sm transition-all flex items-center gap-1"
                      style={{ background: "#21262d", color: "#8b949e", border: "1px solid #30363d" }}
                      onMouseOver={(e) => (e.currentTarget.style.color = "#e6edf3")}
                      onMouseOut={(e) => (e.currentTarget.style.color = "#8b949e")}
                    >
                      <MapPin size={13} />
                      <span>Маршрут</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* AI hint */}
            <div className="mt-3 rounded-lg p-3 flex items-start gap-2"
              style={{ background: "#0d1f3c", border: "1px solid #1f6feb33" }}>
              <Zap size={13} className="shrink-0 mt-0.5" style={{ color: "#1f6feb" }} />
              <p className="text-xs" style={{ color: "#8b949e" }}>
                AI оптимизация по 5 параметрам: расстояние, ETA, ожидание, SLA-штраф, совместимость
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
