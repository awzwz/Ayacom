"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import Sidebar from "@/components/Sidebar";
import { api } from "@/lib/api";
import { TrendingUp, TrendingDown, Calendar, Download } from "lucide-react";
import type { HealthResponse } from "@/lib/types";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

const HOURS = ["08", "10", "12", "14", "16", "18", "20"];
const etaData = HOURS.map((h, i) => ({
  hour: `${h}:00`,
  forecast: 20 + Math.sin(i * 0.8) * 8 + i * 1.5,
  actual: 18 + Math.sin(i * 0.8 + 0.3) * 6 + i * 1.2 + Math.random() * 3,
}));

const vehicleTypes = [
  { type: "Тяжеловозы", pct: 88 },
  { type: "Рефрижераторы", pct: 64 },
  { type: "Малотоннажные", pct: 42 },
  { type: "Спецтехника", pct: 15 },
];

const DAYS = ["ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ", "ВС"];
const HEAT_HOURS = Array.from({ length: 12 }, (_, i) => `${(i * 2).toString().padStart(2, "0")}:00`);
const heatData = DAYS.map((day) =>
  HEAT_HOURS.map((_, hi) => ({
    value: hi >= 3 && hi <= 8 ? Math.random() * 0.7 + 0.3 : Math.random() * 0.3,
  }))
);

function KPICard({
  label, value, unit, delta, deltaLabel, accent, inverted,
}: {
  label: string; value: string | number; unit?: string;
  delta?: number; deltaLabel?: string; accent?: boolean; inverted?: boolean;
}) {
  const positive = delta !== undefined && delta > 0;
  return (
    <div
      className="rounded-2xl p-5 flex-1"
      style={{
        background: inverted ? "#161b22" : "#0d1117",
        border: `1px solid ${inverted ? "#30363d" : "#21262d"}`,
      }}
    >
      <div className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: inverted ? "#8b949e" : "#484f58" }}>
        {label}
      </div>
      <div className="flex items-end gap-2 mb-2">
        <span className="text-4xl font-bold" style={{ color: accent ? "#d4a017" : "#e6edf3" }}>
          {value}
        </span>
        {unit && <span className="text-sm mb-1" style={{ color: "#8b949e" }}>{unit}</span>}
      </div>
      {delta !== undefined && (
        <div className="flex items-center gap-1 text-xs">
          {positive ? (
            <TrendingUp size={12} style={{ color: "#3fb950" }} />
          ) : (
            <TrendingDown size={12} style={{ color: "#3fb950" }} />
          )}
          <span style={{ color: "#3fb950" }}>
            {positive ? "+" : ""}{delta} {deltaLabel}
          </span>
        </div>
      )}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 8, padding: "8px 12px" }}>
      <p style={{ color: "#8b949e", fontSize: 11, marginBottom: 4 }}>{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color, fontSize: 12, fontWeight: 600 }}>
          {p.name === "forecast" ? "Прогноз" : "Факт"}: {p.value.toFixed(1)} мин
        </p>
      ))}
    </div>
  );
};

export default function AnalyticsPage() {
  const [health, setHealth] = useState<HealthResponse | null>(null);

  useEffect(() => {
    api.health().then(setHealth).catch(() => {});
  }, []);

  const heatColor = (v: number) => {
    if (v < 0.2) return "#161b22";
    if (v < 0.4) return "#1f6feb33";
    if (v < 0.6) return "#1f6feb88";
    if (v < 0.8) return "#1f6febbe";
    return "#1f6feb";
  };

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#0d1117" }}>
      <Sidebar />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Header */}
        <div className="px-8 py-6 shrink-0" style={{ borderBottom: "1px solid #21262d" }}>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold" style={{ color: "#e6edf3" }}>Аналитический отчёт</h1>
              <p className="text-sm mt-1" style={{ color: "#8b949e" }}>
                Системные показатели за последние 24 часа
              </p>
            </div>
            <div className="flex gap-2">
              <button
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
                style={{ background: "#161b22", border: "1px solid #30363d", color: "#8b949e" }}
              >
                <Calendar size={14} />
                Сегодня
              </button>
              <button
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
                style={{ background: "#d4a017", color: "#0d1117" }}
              >
                <Download size={14} />
                Экспорт
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
          {/* KPI cards */}
          <div className="flex gap-4">
            <KPICard label="Всего машин" value={health?.vehicles ?? "—"} delta={2} deltaLabel="сегодня" />
            <KPICard label="Активные заявки" value={health?.tasks ?? "—"} delta={12} deltaLabel="%" />
            <KPICard label="Среднее ETA" value={28} unit="мин" delta={-4} deltaLabel="мин" />
            <KPICard label="Экономия топлива" value="14.2" unit="%" accent inverted />
          </div>

          {/* Charts row */}
          <div className="flex gap-4" style={{ height: 280 }}>
            {/* ETA chart */}
            <div
              className="flex-1 rounded-2xl p-5"
              style={{ background: "#0d1117", border: "1px solid #21262d" }}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold" style={{ color: "#e6edf3" }}>
                  ETA по часам планирования
                </h2>
                <div className="flex items-center gap-4 text-xs" style={{ color: "#8b949e" }}>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-3 h-0.5 rounded" style={{ background: "#e6edf3" }} />
                    Прогноз
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-3 h-0.5 rounded border-t-2 border-dashed" style={{ borderColor: "#d4a017" }} />
                    Факт
                  </span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height="80%">
                <AreaChart data={etaData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                  <defs>
                    <linearGradient id="gradForecast" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#e6edf3" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="#e6edf3" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradActual" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#d4a017" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#d4a017" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#21262d" strokeDasharray="3 3" />
                  <XAxis dataKey="hour" tick={{ fill: "#484f58", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#484f58", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="forecast" stroke="#e6edf3" strokeWidth={2} fill="url(#gradForecast)" name="forecast" dot={false} />
                  <Area type="monotone" dataKey="actual" stroke="#d4a017" strokeWidth={2} strokeDasharray="6 4" fill="url(#gradActual)" name="actual" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Vehicle load */}
            <div
              className="rounded-2xl p-5"
              style={{ width: 280, background: "#0d1117", border: "1px solid #21262d" }}
            >
              <h2 className="text-sm font-semibold mb-4" style={{ color: "#e6edf3" }}>
                Загрузка по типам техники
              </h2>
              <div className="space-y-4">
                {vehicleTypes.map(({ type, pct }) => (
                  <div key={type}>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span style={{ color: "#8b949e" }}>{type}</span>
                      <span className="font-semibold" style={{ color: "#e6edf3" }}>{pct}%</span>
                    </div>
                    <div className="h-1.5 rounded-full" style={{ background: "#21262d" }}>
                      <div
                        className="h-1.5 rounded-full score-bar-fill"
                        style={{
                          width: `${pct}%`,
                          background: pct >= 80 ? "#d4a017" : pct >= 50 ? "#1f6feb" : "#8b949e",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div
                className="mt-5 pt-4 flex justify-between text-xs"
                style={{ borderTop: "1px solid #21262d" }}
              >
                <span style={{ color: "#8b949e" }}>Общая загрузка</span>
                <span className="font-bold text-base" style={{ color: "#d4a017" }}>62.4%</span>
              </div>
            </div>
          </div>

          {/* Heatmap */}
          <div
            className="rounded-2xl p-5"
            style={{ background: "#0d1117", border: "1px solid #21262d" }}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold" style={{ color: "#e6edf3" }}>Интенсивность заявок</h2>
                <p className="text-xs mt-0.5" style={{ color: "#484f58" }}>Активность по дням и часам</p>
              </div>
              <div className="flex items-center gap-2 text-xs" style={{ color: "#484f58" }}>
                <span>Низкая</span>
                {[0.1, 0.35, 0.6, 0.85, 1.0].map((v) => (
                  <div key={v} className="w-4 h-4 rounded" style={{ background: heatColor(v) }} />
                ))}
                <span>Высокая</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <div style={{ minWidth: 640 }}>
                {/* Hour labels */}
                <div className="flex gap-1 mb-1 ml-10">
                  {HEAT_HOURS.map((h) => (
                    <div key={h} className="flex-1 text-center text-xs" style={{ color: "#484f58", fontSize: 10 }}>
                      {h}
                    </div>
                  ))}
                </div>
                {/* Grid */}
                {DAYS.map((day, di) => (
                  <div key={day} className="flex items-center gap-1 mb-1">
                    <div className="w-8 text-xs text-right shrink-0" style={{ color: "#8b949e" }}>{day}</div>
                    {heatData[di].map((cell, hi) => (
                      <div
                        key={hi}
                        className="flex-1 rounded"
                        style={{ height: 24, background: heatColor(cell.value), cursor: "default", minWidth: 24 }}
                        title={`${day} ${HEAT_HOURS[hi]}: ${(cell.value * 100).toFixed(0)}%`}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
