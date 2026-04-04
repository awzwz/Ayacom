"use client";

import { useState, useEffect } from "react";
import { GitBranch, Sliders, TrendingDown, AlertCircle, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import type { Task, GroupingResult } from "@/lib/types";

interface Props {
  tasks: Task[];
}

export default function GroupingPanel({ tasks }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [maxTime, setMaxTime] = useState(480);
  const [maxDetour, setMaxDetour] = useState(1.3);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GroupingResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const priorityColor = (p: string) =>
    p === "high" ? "#d4a017" : p === "medium" ? "#1f6feb" : "#8b949e";

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleCalc = async () => {
    if (selected.size < 2) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await api.multitask({
        task_ids: Array.from(selected),
        constraints: { max_total_time_minutes: maxTime, max_detour_ratio: maxDetour },
      });
      setResult(res);
    } catch (e: any) {
      setError(e.message ?? "Ошибка");
    } finally {
      setLoading(false);
    }
  };

  const strategyLabel = (s: string) =>
    s === "combined" ? "Объединить" : s === "separate" ? "Раздельно" : "Смешанная";

  return (
    <div className="flex flex-col h-full">
      {/* Task list */}
      <div className="px-4 pt-4 pb-2" style={{ borderBottom: "1px solid #21262d" }}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#8b949e" }}>
            Выбор заявок
          </span>
          {selected.size > 0 && (
            <span className="text-xs px-2 py-0.5 rounded" style={{ background: "#1f6feb22", color: "#1f6feb" }}>
              Выбрано: {selected.size}
            </span>
          )}
        </div>
        <div className="space-y-1 max-h-52 overflow-y-auto pr-1">
          {tasks.slice(0, 30).map((t) => (
            <label
              key={t.task_id}
              className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all"
              style={{
                background: selected.has(t.task_id) ? "#161b22" : "transparent",
                border: `1px solid ${selected.has(t.task_id) ? "#30363d" : "transparent"}`,
              }}
            >
              <input
                type="checkbox"
                checked={selected.has(t.task_id)}
                onChange={() => toggle(t.task_id)}
                className="hidden"
              />
              <div
                className="w-4 h-4 rounded flex items-center justify-center shrink-0 transition-all"
                style={{
                  background: selected.has(t.task_id) ? "#1f6feb" : "#21262d",
                  border: `1px solid ${selected.has(t.task_id) ? "#1f6feb" : "#30363d"}`,
                }}
              >
                {selected.has(t.task_id) && (
                  <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                    <path d="M1 3L3.5 5.5L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-xs font-mono" style={{ color: "#e6edf3" }}>{t.task_id}</span>
                <span className="text-xs ml-2" style={{ color: "#8b949e" }}>{t.destination_uwi}</span>
              </div>
              <span
                className="text-xs px-1.5 py-0.5 rounded shrink-0"
                style={{ background: priorityColor(t.priority) + "22", color: priorityColor(t.priority) }}
              >
                {t.priority === "high" ? "В" : t.priority === "medium" ? "С" : "Н"}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Constraints */}
      <div className="px-4 py-4" style={{ borderBottom: "1px solid #21262d" }}>
        <div className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "#8b949e" }}>
          <Sliders size={12} className="inline mr-1" />
          Ограничения
        </div>
        <div className="mb-4">
          <div className="flex justify-between text-xs mb-2">
            <span style={{ color: "#8b949e" }}>Макс. время маршрута</span>
            <span className="font-semibold" style={{ color: "#e6edf3" }}>{maxTime} мин</span>
          </div>
          <input
            type="range" min={60} max={720} step={30}
            value={maxTime}
            onChange={(e) => setMaxTime(Number(e.target.value))}
            className="w-full h-1 rounded appearance-none cursor-pointer"
            style={{ accentColor: "#d4a017", background: "#21262d" }}
          />
        </div>
        <div className="mb-4">
          <div className="flex justify-between text-xs mb-2">
            <span style={{ color: "#8b949e" }}>Макс. коэф. объезда</span>
            <span className="font-semibold" style={{ color: "#e6edf3" }}>×{maxDetour.toFixed(1)}</span>
          </div>
          <input
            type="range" min={1.0} max={2.5} step={0.1}
            value={maxDetour}
            onChange={(e) => setMaxDetour(Number(e.target.value))}
            className="w-full h-1 rounded appearance-none cursor-pointer"
            style={{ accentColor: "#d4a017", background: "#21262d" }}
          />
        </div>
        <button
          onClick={handleCalc}
          disabled={selected.size < 2 || loading}
          className="w-full rounded-lg py-2.5 text-sm font-semibold flex items-center justify-center gap-2 transition-all"
          style={{
            background: selected.size < 2 ? "#21262d" : "#1f6feb",
            color: selected.size < 2 ? "#484f58" : "#fff",
          }}
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <GitBranch size={14} />}
          {loading ? "Расчёт..." : "Рассчитать группировку"}
        </button>
        {selected.size < 2 && (
          <p className="text-xs text-center mt-2" style={{ color: "#484f58" }}>
            Выберите минимум 2 заявки
          </p>
        )}
      </div>

      {/* Result */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {error && (
          <div className="rounded-lg p-3 text-xs flex gap-2" style={{ background: "#4a0d0d", color: "#f85149" }}>
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        {result && (
          <div className="fade-in">
            {/* Strategy badge */}
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xs font-bold px-3 py-1 rounded-full"
                style={{ background: "#1f6feb22", color: "#1f6feb", border: "1px solid #1f6feb44" }}>
                Стратегия: {strategyLabel(result.strategy_summary)}
              </span>
            </div>

            {/* Groups */}
            <div className="space-y-3 mb-4">
              {result.groups.map((group, gi) => (
                <div key={gi} className="rounded-xl p-3" style={{ background: "#161b22", border: "1px solid #21262d" }}>
                  <div className="text-xs mb-2" style={{ color: "#8b949e" }}>Группа {gi + 1}</div>
                  <div className="flex flex-wrap gap-2 items-center">
                    {group.map((id, ii) => (
                      <div key={id} className="flex items-center gap-1">
                        <span className="text-xs font-mono px-2 py-1 rounded"
                          style={{ background: "#21262d", color: "#e6edf3" }}>
                          {id}
                        </span>
                        {ii < group.length - 1 && (
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path d="M2 6H10M7 3L10 6L7 9" stroke="#484f58" strokeWidth="1.5" strokeLinecap="round"/>
                          </svg>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Metrics */}
            <div className="rounded-xl p-4" style={{ background: "#0d1f3c", border: "1px solid #1f6feb33" }}>
              <div className="flex items-center gap-2 mb-3">
                <TrendingDown size={14} style={{ color: "#3fb950" }} />
                <span className="text-xs font-semibold" style={{ color: "#3fb950" }}>
                  Экономия {result.savings_percent.toFixed(1)}%
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center mb-3">
                <div>
                  <div className="text-lg font-bold" style={{ color: "#8b949e" }}>
                    {result.baseline_distance_km.toFixed(0)}
                  </div>
                  <div className="text-xs" style={{ color: "#484f58" }}>км базово</div>
                </div>
                <div className="flex items-center justify-center">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M4 10H16M12 6L16 10L12 14" stroke="#3fb950" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </div>
                <div>
                  <div className="text-lg font-bold" style={{ color: "#3fb950" }}>
                    {result.total_distance_km.toFixed(0)}
                  </div>
                  <div className="text-xs" style={{ color: "#484f58" }}>км оптимально</div>
                </div>
              </div>
              <p className="text-xs italic leading-relaxed" style={{ color: "#8b949e" }}>
                {result.reason}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
