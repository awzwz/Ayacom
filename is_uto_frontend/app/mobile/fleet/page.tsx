"use client";

import { useState, useEffect } from "react";
import { Truck, BusFront, ChevronDown, ChevronUp, Gauge, Wrench } from "lucide-react";
import { api } from "@/lib/api";
import type { FleetVehicle } from "@/lib/types";

type Filter = "all" | "free" | "busy";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "free", label: "Свободна" },
  { key: "busy", label: "Занята" },
];

function isFree(v: FleetVehicle) {
  return v.free_at_minutes <= 0;
}

function VehicleCard({ v }: { v: FleetVehicle }) {
  const [expanded, setExpanded] = useState(false);
  const free = isFree(v);
  const isBus = v.vehicle_type_code?.toLowerCase().includes("bpa") || v.vehicle_type_code?.toLowerCase().includes("bus");

  return (
    <button
      type="button"
      onClick={() => setExpanded((e) => !e)}
      style={{
        width: "100%",
        background: "#161b22",
        border: "1px solid #21262d",
        borderRadius: 12,
        padding: "14px",
        textAlign: "left",
        WebkitTapHighlightColor: "transparent",
        cursor: "pointer",
        display: "block",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        {/* Icon */}
        <div
          style={{
            width: 40,
            height: 40,
            background: "#21262d",
            borderRadius: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {isBus ? <BusFront size={20} color="#8b949e" /> : <Truck size={20} color="#8b949e" />}
        </div>

        {/* Main info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: "#e6edf3",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                flex: 1,
              }}
            >
              {v.name}
            </span>
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                padding: "2px 7px",
                borderRadius: 6,
                flexShrink: 0,
                background: free ? "#3fb95018" : "#f8514918",
                border: `1px solid ${free ? "#3fb95040" : "#f8514940"}`,
                color: free ? "#3fb950" : "#f85149",
              }}
            >
              {free ? "Свободна" : "Занята"}
            </span>
          </div>

          <div
            style={{
              fontFamily: "monospace",
              fontSize: 11,
              color: "#8b949e",
              marginBottom: 6,
            }}
          >
            {v.registration}
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "#484f58" }}>
              <Gauge size={11} />
              <span>{v.avg_speed_kmh} км/ч</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "#484f58" }}>
              <Wrench size={11} />
              <span>{v.skills_count} навыков</span>
            </div>
            <div style={{ fontSize: 10, color: "#484f58" }}>{v.vehicle_type_code}</div>
          </div>
        </div>

        {/* Expand icon */}
        <div style={{ color: "#484f58", flexShrink: 0, alignSelf: "center" }}>
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div
          style={{
            marginTop: 12,
            paddingTop: 12,
            borderTop: "1px solid #21262d",
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          {[
            { label: "Wialon ID", value: String(v.wialon_id) },
            { label: "Тип ТС", value: v.vehicle_type_code },
            { label: "Узел графа", value: String(v.start_node) },
            {
              label: "Свободна через",
              value: v.free_at_minutes > 0 ? `${Math.round(v.free_at_minutes)} мин` : "Сейчас",
            },
          ].map(({ label, value }) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 11, color: "#484f58" }}>{label}</span>
              <span style={{ fontSize: 11, color: "#8b949e", fontFamily: "monospace" }}>{value}</span>
            </div>
          ))}
        </div>
      )}
    </button>
  );
}

export default function MobileFleetPage() {
  const [vehicles, setVehicles] = useState<FleetVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    api
      .fleet(200)
      .then((r) => setVehicles(r.vehicles))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = vehicles.filter((v) => {
    if (filter === "free") return isFree(v);
    if (filter === "busy") return !isFree(v);
    return true;
  });

  const freeCount = vehicles.filter(isFree).length;
  const busyCount = vehicles.length - freeCount;

  return (
    <div style={{ padding: "0 0 8px" }}>
      {/* Header */}
      <div
        style={{
          padding: "16px 16px 12px",
          borderBottom: "1px solid #21262d",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <span style={{ fontSize: 18, fontWeight: 700, color: "#e6edf3" }}>Автопарк</span>
        {!loading && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              background: "#21262d",
              color: "#8b949e",
              borderRadius: 8,
              padding: "2px 8px",
            }}
          >
            {vehicles.length} ТС
          </span>
        )}
      </div>

      <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
        {/* KPI row */}
        {!loading && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            {[
              { label: "Всего", value: vehicles.length, color: "#8b949e" },
              { label: "Свободна", value: freeCount, color: "#3fb950" },
              { label: "Занята", value: busyCount, color: "#f85149" },
            ].map(({ label, value, color }) => (
              <div
                key={label}
                style={{
                  background: "#161b22",
                  border: "1px solid #21262d",
                  borderRadius: 10,
                  padding: "10px 8px",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 22, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
                <div style={{ fontSize: 10, color: "#484f58", marginTop: 3 }}>{label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Filter pills */}
        <div style={{ display: "flex", gap: 6 }}>
          {FILTERS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              style={{
                padding: "7px 14px",
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 600,
                border: `1px solid ${filter === key ? "#d4a017" : "#21262d"}`,
                background: filter === key ? "#d4a01718" : "transparent",
                color: filter === key ? "#d4a017" : "#8b949e",
                cursor: "pointer",
                WebkitTapHighlightColor: "transparent",
                minHeight: 36,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Vehicle list */}
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="skeleton"
                style={{ height: 84, borderRadius: 12 }}
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "#484f58" }}>
            <Truck size={32} style={{ margin: "0 auto 8px" }} />
            <div style={{ fontSize: 13 }}>Нет результатов</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filtered.map((v) => (
              <VehicleCard key={v.wialon_id} v={v} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
