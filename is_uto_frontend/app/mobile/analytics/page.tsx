"use client";

import { useState, useEffect } from "react";
import {
  Route,
  Fuel,
  Clock,
  Coins,
  Leaf,
  TrendingDown,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { api } from "@/lib/api";
import type { BusinessCaseResponse } from "@/lib/types";

function fmt(n: number, decimals = 1) {
  return n.toLocaleString("ru-RU", { maximumFractionDigits: decimals });
}

function fmtKzt(n: number) {
  if (n >= 1_000_000) return `${fmt(n / 1_000_000, 1)} млн ₸`;
  if (n >= 1_000) return `${fmt(n / 1_000, 0)} тыс ₸`;
  return `${fmt(n, 0)} ₸`;
}

const SAVING_CARDS = (s: BusinessCaseResponse["savings"]) => [
  { Icon: Route, color: "#58a6ff", label: "Дистанция", value: `${fmt(s.distance_km)} км`, sub: "в день" },
  { Icon: Fuel, color: "#d4a017", label: "Топливо", value: `${fmt(s.fuel_liters)} л`, sub: "в день" },
  { Icon: Clock, color: "#3fb950", label: "Время", value: `${fmt(s.time_hours)} ч`, sub: "в день" },
  { Icon: Coins, color: "#f78166", label: "Стоимость", value: fmtKzt(s.cost_kzt), sub: "в день" },
];

export default function MobileAnalyticsPage() {
  const [bc, setBc] = useState<BusinessCaseResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [narrativeOpen, setNarrativeOpen] = useState(false);

  useEffect(() => {
    api
      .businessCase()
      .then(setBc)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ padding: "0 0 8px" }}>
        <div style={{ padding: "16px 16px 12px", borderBottom: "1px solid #21262d" }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: "#e6edf3" }}>Аналитика</span>
        </div>
        <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton" style={{ height: i === 1 ? 100 : 70, borderRadius: 12 }} />
          ))}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="skeleton" style={{ height: 80, borderRadius: 12 }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!bc) {
    return (
      <div style={{ padding: "40px 16px", textAlign: "center", color: "#484f58" }}>
        <BarChart3 size={32} style={{ margin: "0 auto 8px" }} />
        <div style={{ fontSize: 13 }}>Данные недоступны</div>
      </div>
    );
  }

  const { savings, baseline, optimized, meta, narrative } = bc;

  return (
    <div style={{ padding: "0 0 8px" }}>
      {/* Header */}
      <div
        style={{
          padding: "16px 16px 12px",
          borderBottom: "1px solid #21262d",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#e6edf3" }}>Аналитика</div>
          <div style={{ fontSize: 11, color: "#484f58", marginTop: 2 }}>{meta.field_name}</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#58a6ff" }}>{meta.vehicles_count}</div>
            <div style={{ fontSize: 9, color: "#484f58" }}>ТС</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#d4a017" }}>{meta.tasks_count}</div>
            <div style={{ fontSize: 9, color: "#484f58" }}>заявок</div>
          </div>
        </div>
      </div>

      <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
        {/* Hero banner */}
        <div
          style={{
            background: "linear-gradient(135deg, #d4a01715, #d4a01730)",
            border: "1px solid #d4a01740",
            borderRadius: 14,
            padding: "18px 16px",
            textAlign: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 6 }}>
            <TrendingDown size={18} color="#d4a017" />
            <span style={{ fontSize: 11, fontWeight: 600, color: "#d4a017", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Экономия дистанции
            </span>
          </div>
          <div style={{ fontSize: 52, fontWeight: 800, color: "#d4a017", lineHeight: 1, marginBottom: 6 }}>
            ▼{fmt(savings.distance_pct, 1)}%
          </div>
          <div style={{ fontSize: 12, color: "#8b949e" }}>
            {fmt(savings.distance_km)} км/день экономии относительно базового сценария
          </div>
        </div>

        {/* 2x2 savings grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {SAVING_CARDS(savings).map(({ Icon, color, label, value, sub }) => (
            <div
              key={label}
              style={{
                background: "#161b22",
                border: "1px solid #21262d",
                borderRadius: 12,
                padding: "14px 12px",
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    background: `${color}18`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon size={15} color={color} />
                </div>
                <span style={{ fontSize: 11, color: "#8b949e" }}>{label}</span>
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
              <div style={{ fontSize: 10, color: "#484f58" }}>экономия {sub}</div>
            </div>
          ))}
        </div>

        {/* Annual projections */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div
            style={{
              background: "#161b22",
              border: "1px solid #d4a01740",
              borderRadius: 12,
              padding: "14px 12px",
            }}
          >
            <div style={{ fontSize: 10, color: "#484f58", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Год · Экономия
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#d4a017" }}>
              {fmtKzt(savings.annual_cost_kzt)}
            </div>
            <div style={{ fontSize: 10, color: "#484f58", marginTop: 3 }}>в год</div>
          </div>
          <div
            style={{
              background: "#161b22",
              border: "1px solid #3fb95040",
              borderRadius: 12,
              padding: "14px 12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 6 }}>
              <Leaf size={11} color="#3fb950" />
              <span style={{ fontSize: 10, color: "#484f58", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Снижение CO₂
              </span>
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#3fb950" }}>
              {fmt(savings.annual_co2_tons, 1)} т
            </div>
            <div style={{ fontSize: 10, color: "#484f58", marginTop: 3 }}>в год</div>
          </div>
        </div>

        {/* Comparison table */}
        <div
          style={{
            background: "#161b22",
            border: "1px solid #21262d",
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "10px 14px",
              borderBottom: "1px solid #21262d",
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 4,
            }}
          >
            <div style={{ fontSize: 10, color: "#484f58", fontWeight: 600 }}>Метрика</div>
            <div style={{ fontSize: 10, color: "#484f58", fontWeight: 600, textAlign: "right" }}>Базовый</div>
            <div style={{ fontSize: 10, color: "#d4a017", fontWeight: 600, textAlign: "right" }}>ИС УТО</div>
          </div>
          {[
            {
              label: "Дистанция",
              baseline: `${fmt(baseline.distance_km)} км`,
              opt: `${fmt(optimized.distance_km)} км`,
            },
            {
              label: "Топливо",
              baseline: `${fmt(baseline.fuel_liters)} л`,
              opt: `${fmt(optimized.fuel_liters)} л`,
            },
            {
              label: "Стоимость",
              baseline: fmtKzt(baseline.cost_kzt),
              opt: fmtKzt(optimized.cost_kzt),
            },
          ].map(({ label, baseline: b, opt }, i) => (
            <div
              key={label}
              style={{
                padding: "10px 14px",
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: 4,
                borderBottom: i < 2 ? "1px solid #21262d" : "none",
                background: i % 2 === 1 ? "#0d111722" : "transparent",
              }}
            >
              <div style={{ fontSize: 12, color: "#8b949e" }}>{label}</div>
              <div style={{ fontSize: 12, color: "#484f58", textAlign: "right" }}>{b}</div>
              <div style={{ fontSize: 12, color: "#3fb950", textAlign: "right", fontWeight: 600 }}>{opt}</div>
            </div>
          ))}
        </div>

        {/* AI Narrative (collapsible) */}
        {narrative && (
          <div
            style={{
              background: "#161b22",
              border: "1px solid #21262d",
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            <button
              type="button"
              onClick={() => setNarrativeOpen((o) => !o)}
              style={{
                width: "100%",
                padding: "12px 14px",
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "transparent",
                border: "none",
                cursor: "pointer",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background: "#d4a01718",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Sparkles size={15} color="#d4a017" />
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#e6edf3", flex: 1, textAlign: "left" }}>
                Анализ от ИИ
              </span>
              <span style={{ fontSize: 10, color: "#484f58", marginRight: 4 }}>GPT-4o</span>
              {narrativeOpen ? (
                <ChevronUp size={16} color="#484f58" />
              ) : (
                <ChevronDown size={16} color="#484f58" />
              )}
            </button>

            {narrativeOpen && (
              <div
                style={{
                  padding: "0 14px 14px",
                  borderTop: "1px solid #21262d",
                  paddingTop: 12,
                }}
              >
                <p
                  style={{
                    fontSize: 12,
                    color: "#c9d1d9",
                    lineHeight: 1.7,
                    margin: 0,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {narrative}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Meta footer */}
        <div style={{ textAlign: "center", paddingTop: 4 }}>
          <div style={{ fontSize: 10, color: "#30363d" }}>
            {meta.field_name} · {new Date(meta.calculation_date).toLocaleDateString("ru-RU")}
          </div>
        </div>
      </div>
    </div>
  );
}

// Fallback import for no-data state
function BarChart3({ size, style }: { size: number; style?: React.CSSProperties }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
    >
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
      <line x1="2" y1="20" x2="22" y2="20" />
    </svg>
  );
}
