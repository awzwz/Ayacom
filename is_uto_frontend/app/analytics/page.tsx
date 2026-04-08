"use client";

import { useState, useEffect, useRef } from "react";
import Sidebar from "@/components/Sidebar";
import AnalyticsChat from "@/components/AnalyticsChat";
import { api } from "@/lib/api";
import {
  TrendingUp, TrendingDown, Calendar, Download,
  Fuel, Clock, MapPin, DollarSign, Leaf, Sparkles, Loader2,
  FileText, Table,
} from "lucide-react";
import type { HealthResponse, BusinessCaseResponse } from "@/lib/types";
import {
  BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";

function fmt(n: number | undefined, decimals = 0): string {
  if (n === undefined || n === null) return "—";
  return n.toLocaleString("ru-RU", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function KPICard({
  label, value, unit, delta, deltaLabel, accent, inverted, icon: Icon,
}: {
  label: string; value: string | number; unit?: string;
  delta?: number; deltaLabel?: string; accent?: boolean; inverted?: boolean;
  icon?: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
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
      <div className="flex items-center gap-2 mb-3">
        {Icon && <Icon size={14} style={{ color: "#484f58" }} />}
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: inverted ? "#8b949e" : "#484f58" }}>
          {label}
        </span>
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

function SavingsCard({
  label, value, unit, sub, icon: Icon, color,
}: {
  label: string; value: string; unit: string; sub?: string;
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  color: string;
}) {
  return (
    <div
      className="rounded-2xl p-5 flex-1"
      style={{ background: "#0d1117", border: `1px solid ${color}33` }}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
        style={{ background: `${color}18` }}
      >
        <Icon size={20} style={{ color }} />
      </div>
      <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#8b949e" }}>
        {label}
      </div>
      <div className="flex items-end gap-1.5">
        <span className="text-3xl font-bold" style={{ color: "#e6edf3" }}>{value}</span>
        <span className="text-sm mb-0.5" style={{ color: "#8b949e" }}>{unit}</span>
      </div>
      {sub && (
        <div className="text-xs mt-2" style={{ color: "#8b949e" }}>{sub}</div>
      )}
    </div>
  );
}

function Skeleton({ w = "100%", h = 20 }: { w?: string | number; h?: number }) {
  return (
    <div
      className="rounded-lg animate-pulse"
      style={{ width: w, height: h, background: "#21262d" }}
    />
  );
}

const ComparisonTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 8, padding: "8px 12px" }}>
      <p style={{ color: "#8b949e", fontSize: 11, marginBottom: 4 }}>{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.fill, fontSize: 12, fontWeight: 600 }}>
          {p.name}: {p.value.toLocaleString("ru-RU")}
        </p>
      ))}
    </div>
  );
};

function exportCSV(bc: BusinessCaseResponse) {
  const rows = [
    ["Метрика", "Без оптимизации", "IS УТО", "Экономия"],
    ["Дистанция (км)", bc.baseline.distance_km, bc.optimized.distance_km, bc.savings.distance_km],
    ["Время (ч)", bc.baseline.time_hours, bc.optimized.time_hours, bc.savings.time_hours],
    ["Топливо (л)", bc.baseline.fuel_liters, bc.optimized.fuel_liters, bc.savings.fuel_liters],
    ["Стоимость (₸)", bc.baseline.cost_kzt, bc.optimized.cost_kzt, bc.savings.cost_kzt],
    ["CO₂ (кг)", "", "", bc.savings.co2_kg],
    [],
    ["Экономия дистанции (%)", bc.savings.distance_pct],
    ["Годовая экономия (₸)", bc.savings.annual_cost_kzt],
    ["Годовое снижение CO₂ (т)", bc.savings.annual_co2_tons],
    [],
    ["Машин", bc.meta.vehicles_count],
    ["Задач", bc.meta.tasks_count],
    ["Месторождение", bc.meta.field_name],
    ["Дата расчёта", bc.meta.calculation_date],
    [],
    ["AI-нарратив"],
    [bc.narrative],
  ];
  const csv = rows.map((r) => r.join(";")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `IS_UTO_business_case_${bc.meta.calculation_date.slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

async function exportPDF(bc: BusinessCaseResponse) {
  const { default: jsPDF } = await import("jspdf");
  await import("jspdf-autotable");

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  doc.setFontSize(18);
  doc.text("IS UTO — Business Case", 14, 20);
  doc.setFontSize(10);
  doc.text(`${bc.meta.field_name} | ${bc.meta.calculation_date}`, 14, 28);
  doc.text(`Vehicles: ${bc.meta.vehicles_count} | Tasks: ${bc.meta.tasks_count}`, 14, 34);

  (doc as any).autoTable({
    startY: 42,
    head: [["Metric", "Baseline", "IS UTO", "Savings"]],
    body: [
      ["Distance (km)", bc.baseline.distance_km, bc.optimized.distance_km, `${bc.savings.distance_km} (${bc.savings.distance_pct}%)`],
      ["Time (h)", bc.baseline.time_hours, bc.optimized.time_hours, bc.savings.time_hours],
      ["Fuel (L)", bc.baseline.fuel_liters, bc.optimized.fuel_liters, bc.savings.fuel_liters],
      ["Cost (KZT)", fmt(bc.baseline.cost_kzt), fmt(bc.optimized.cost_kzt), fmt(bc.savings.cost_kzt)],
      ["CO2 (kg)", "—", "—", bc.savings.co2_kg],
    ],
    theme: "grid",
    headStyles: { fillColor: [31, 111, 235] },
    styles: { fontSize: 9 },
  });

  const afterTable = (doc as any).lastAutoTable.finalY + 10;
  doc.setFontSize(11);
  doc.text("Annual projections", 14, afterTable);
  doc.setFontSize(9);
  doc.text(`Cost savings: ${fmt(bc.savings.annual_cost_kzt)} KZT/year`, 14, afterTable + 7);
  doc.text(`CO2 reduction: ${bc.savings.annual_co2_tons} tons/year`, 14, afterTable + 13);

  if (bc.narrative) {
    doc.setFontSize(11);
    doc.text("AI Narrative", 14, afterTable + 24);
    doc.setFontSize(9);
    const lines = doc.splitTextToSize(bc.narrative, 180);
    doc.text(lines, 14, afterTable + 31);
  }

  doc.save(`IS_UTO_business_case_${bc.meta.calculation_date.slice(0, 10)}.pdf`);
}

export default function AnalyticsPage() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [bc, setBc] = useState<BusinessCaseResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.health().then(setHealth).catch(() => {});
    api
      .businessCase()
      .then((data) => {
        setBc(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message ?? "Ошибка загрузки бизнес-кейса");
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!exportOpen) return;
    const handler = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [exportOpen]);

  const comparisonData = bc
    ? [
        {
          metric: "Дистанция (км)",
          "Без оптимизации": bc.baseline.distance_km,
          "IS УТО": bc.optimized.distance_km,
        },
        {
          metric: "Время (ч)",
          "Без оптимизации": bc.baseline.time_hours,
          "IS УТО": bc.optimized.time_hours,
        },
        {
          metric: "Топливо (л)",
          "Без оптимизации": bc.baseline.fuel_liters,
          "IS УТО": bc.optimized.fuel_liters,
        },
        {
          metric: "Стоимость (тыс. ₸)",
          "Без оптимизации": Math.round(bc.baseline.cost_kzt / 1000),
          "IS УТО": Math.round(bc.optimized.cost_kzt / 1000),
        },
      ]
    : [];

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
                {bc
                  ? `Бизнес-кейс · ${bc.meta.field_name} · ${new Date(bc.meta.calculation_date).toLocaleDateString("ru-RU")}`
                  : "Системные показатели"}
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
              <div className="relative" ref={exportRef}>
                <button
                  onClick={() => setExportOpen((v) => !v)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
                  style={{ background: "#d4a017", color: "#0d1117" }}
                >
                  <Download size={14} />
                  Экспорт
                </button>
                {exportOpen && bc && (
                  <div
                    className="absolute right-0 mt-2 rounded-xl overflow-hidden z-50"
                    style={{ background: "#161b22", border: "1px solid #30363d", minWidth: 180 }}
                  >
                    <button
                      onClick={() => { exportPDF(bc); setExportOpen(false); }}
                      className="flex items-center gap-3 w-full px-4 py-3 text-sm text-left hover:bg-[#21262d] transition-colors"
                      style={{ color: "#e6edf3" }}
                    >
                      <FileText size={14} style={{ color: "#1f6feb" }} />
                      Скачать PDF
                    </button>
                    <button
                      onClick={() => { exportCSV(bc); setExportOpen(false); }}
                      className="flex items-center gap-3 w-full px-4 py-3 text-sm text-left hover:bg-[#21262d] transition-colors"
                      style={{ color: "#e6edf3", borderTop: "1px solid #21262d" }}
                    >
                      <Table size={14} style={{ color: "#3fb950" }} />
                      Скачать CSV
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
          {/* KPI cards */}
          <div className="flex gap-4">
            <KPICard
              icon={MapPin}
              label="Всего машин"
              value={health?.vehicles ?? "—"}
              delta={bc ? bc.meta.vehicles_count : undefined}
              deltaLabel="в расчёте"
            />
            <KPICard
              icon={Clock}
              label="Активные заявки"
              value={health?.tasks ?? "—"}
              delta={bc ? bc.meta.tasks_count : undefined}
              deltaLabel="в расчёте"
            />
            <KPICard
              icon={TrendingDown}
              label="Экономия дистанции"
              value={loading ? "—" : bc ? `${fmt(bc.savings.distance_pct, 1)}` : "—"}
              unit="%"
              delta={bc ? bc.savings.distance_km : undefined}
              deltaLabel="км/день"
            />
            <KPICard
              icon={Fuel}
              label="Экономия топлива"
              value={loading ? "—" : bc ? fmt(bc.savings.fuel_liters, 1) : "—"}
              unit="л/день"
              accent
              inverted
            />
          </div>

          {/* Error message */}
          {error && (
            <div
              className="rounded-xl p-4 text-sm"
              style={{ background: "#3d1f1f", border: "1px solid #6e3630", color: "#f87171" }}
            >
              {error}
            </div>
          )}

          {/* Savings section */}
          <div>
            <h2 className="text-lg font-semibold mb-4" style={{ color: "#e6edf3" }}>
              Экономический эффект
            </h2>
            {loading ? (
              <div className="flex gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex-1 rounded-2xl p-5" style={{ background: "#0d1117", border: "1px solid #21262d" }}>
                    <Skeleton w={40} h={40} />
                    <Skeleton w="60%" h={12} />
                    <Skeleton w="80%" h={28} />
                  </div>
                ))}
              </div>
            ) : bc ? (
              <div className="flex gap-4">
                <SavingsCard
                  icon={MapPin}
                  label="Дистанция"
                  value={fmt(bc.savings.distance_km, 1)}
                  unit="км/день"
                  sub={`${fmt(bc.savings.distance_pct, 1)}% от базового маршрута`}
                  color="#1f6feb"
                />
                <SavingsCard
                  icon={Fuel}
                  label="Топливо"
                  value={fmt(bc.savings.fuel_liters, 1)}
                  unit="л/день"
                  sub={`−${fmt(bc.savings.co2_kg, 1)} кг CO₂/день`}
                  color="#d4a017"
                />
                <SavingsCard
                  icon={Clock}
                  label="Время"
                  value={fmt(bc.savings.time_hours, 1)}
                  unit="ч/день"
                  sub="Сокращение простоев"
                  color="#3fb950"
                />
                <SavingsCard
                  icon={DollarSign}
                  label="Стоимость"
                  value={fmt(bc.savings.cost_kzt)}
                  unit="₸/день"
                  sub="Топливо + ФОТ водителей"
                  color="#f78166"
                />
              </div>
            ) : null}
          </div>

          {/* Comparison chart */}
          {bc && (
            <div
              className="rounded-2xl p-5"
              style={{ background: "#0d1117", border: "1px solid #21262d" }}
            >
              <h2 className="text-sm font-semibold mb-4" style={{ color: "#e6edf3" }}>
                Baseline vs IS УТО
              </h2>
              <div style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={comparisonData} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
                    <CartesianGrid stroke="#21262d" strokeDasharray="3 3" />
                    <XAxis dataKey="metric" tick={{ fill: "#8b949e", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#484f58", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<ComparisonTooltip />} />
                    <Legend
                      wrapperStyle={{ fontSize: 12, color: "#8b949e" }}
                      iconType="circle"
                      iconSize={8}
                    />
                    <Bar dataKey="Без оптимизации" fill="#484f58" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="IS УТО" fill="#1f6feb" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Annual projections */}
          {bc && (
            <div className="flex gap-4">
              <div
                className="flex-1 rounded-2xl p-5"
                style={{ background: "#161b22", border: "1px solid #30363d" }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign size={14} style={{ color: "#d4a017" }} />
                  <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#8b949e" }}>
                    Годовая экономия
                  </span>
                </div>
                <div className="flex items-end gap-2">
                  <span className="text-3xl font-bold" style={{ color: "#d4a017" }}>
                    {fmt(bc.savings.annual_cost_kzt)}
                  </span>
                  <span className="text-sm mb-0.5" style={{ color: "#8b949e" }}>₸ / год</span>
                </div>
              </div>
              <div
                className="flex-1 rounded-2xl p-5"
                style={{ background: "#161b22", border: "1px solid #30363d" }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Leaf size={14} style={{ color: "#3fb950" }} />
                  <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#8b949e" }}>
                    Снижение CO₂ в год
                  </span>
                </div>
                <div className="flex items-end gap-2">
                  <span className="text-3xl font-bold" style={{ color: "#3fb950" }}>
                    {fmt(bc.savings.annual_co2_tons, 1)}
                  </span>
                  <span className="text-sm mb-0.5" style={{ color: "#8b949e" }}>тонн / год</span>
                </div>
              </div>
            </div>
          )}

          {/* AI narrative */}
          <div
            className="rounded-2xl p-6"
            style={{
              background: "#0d1117",
              border: "1px solid #d4a01744",
            }}
          >
            <div className="flex items-center gap-2 mb-4">
              <Sparkles size={18} style={{ color: "#d4a017" }} />
              <h2 className="text-sm font-semibold" style={{ color: "#e6edf3" }}>
                AI-анализ для питча
              </h2>
              <span
                className="text-xs px-2 py-0.5 rounded-full"
                style={{ background: "#d4a01722", color: "#d4a017" }}
              >
                AI
              </span>
            </div>
            {loading ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs" style={{ color: "#8b949e" }}>
                  <Loader2 size={12} className="animate-spin" />
                  Генерация нарратива...
                </div>
                <Skeleton h={16} />
                <Skeleton h={16} />
                <Skeleton h={16} w="70%" />
              </div>
            ) : bc?.narrative ? (
              <p
                className="text-base leading-relaxed"
                style={{ color: "#c9d1d9", lineHeight: 1.8 }}
              >
                {bc.narrative}
              </p>
            ) : (
              <p className="text-sm" style={{ color: "#484f58" }}>
                Нарратив недоступен
              </p>
            )}
          </div>
        </div>
      </div>

      <AnalyticsChat bc={bc} />
    </div>
  );
}
