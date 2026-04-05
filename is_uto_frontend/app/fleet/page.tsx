"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import {
  Truck,
  BusFront,
  Search,
  X,
  Zap,
  Wrench,
  ChevronRight,
  CheckCircle,
  Circle,
} from "lucide-react";
import Sidebar from "@/components/Sidebar";
import { api } from "@/lib/api";
import type { FleetVehicle } from "@/lib/types";

const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });

const FILTERS = ["Все", "Свободна", "Занята"] as const;

function VehicleTypeIcon({ code, size = 22 }: { code: string; size?: number }) {
  const c = (code ?? "").toLowerCase();
  const iconProps = {
    size,
    className: "shrink-0" as const,
    style: { color: "#c9d1d9" as const },
    strokeWidth: 1.75 as const,
  };
  if (c.includes("truck") || c.includes("груз")) return <Truck {...iconProps} />;
  if (c.includes("spec") || c.includes("спец"))
    return (
      <span className="text-xl leading-none select-none" aria-hidden>
        🏗️
      </span>
    );
  /* bus / автобус / прочие типы (в т.ч. техпомощь) — автобус спереди вместо красной машины */
  return <BusFront {...iconProps} />;
}

function VehicleCard({ v, onClick }: { v: FleetVehicle; onClick: () => void }) {
  const isFree = v.free_at_minutes === 0;
  const shortName = v.name.split(" ").slice(1, 5).join(" ") || v.name;
  const maxSkills = 15;

  return (
    <div
      onClick={onClick}
      className="rounded-2xl p-4 cursor-pointer transition-all group"
      style={{ background: "#161b22", border: "1px solid #21262d" }}
      onMouseOver={(e) => (e.currentTarget.style.borderColor = "#30363d")}
      onMouseOut={(e) => (e.currentTarget.style.borderColor = "#21262d")}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 flex items-center justify-center rounded-xl" style={{ background: "#21262d" }}>
          <VehicleTypeIcon code={v.vehicle_type_code} />
        </div>
        <span
          className="text-xs font-semibold px-2 py-0.5 rounded-full"
          style={{ background: isFree ? "#0d4a1a" : "#4a0d0d", color: isFree ? "#3fb950" : "#f85149" }}
        >
          {isFree ? "Свободна" : "Занята"}
        </span>
      </div>

      <div className="font-semibold text-sm leading-tight mb-0.5" style={{ color: "#e6edf3" }}>{shortName}</div>
      <div className="font-mono text-xs mb-3" style={{ color: "#8b949e" }}>{v.registration}</div>

      <div className="flex gap-3 mb-3">
        <div className="flex items-center gap-1 text-xs" style={{ color: "#8b949e" }}>
          <Zap size={11} style={{ color: "#d4a017" }} />{v.avg_speed_kmh} км/ч
        </div>
        <div className="flex items-center gap-1 text-xs" style={{ color: "#8b949e" }}>
          <Wrench size={11} style={{ color: "#1f6feb" }} />{v.skills_count} типов
        </div>
      </div>

      <div className="mb-3">
        <div className="flex justify-between text-xs mb-1">
          <span style={{ color: "#484f58" }}>Навыки</span>
          <span style={{ color: "#8b949e" }}>{v.skills_count}/{maxSkills}</span>
        </div>
        <div className="h-1 rounded-full" style={{ background: "#21262d" }}>
          <div className="h-1 rounded-full" style={{ width: `${Math.min((v.skills_count / maxSkills) * 100, 100)}%`, background: "#1f6feb" }} />
        </div>
      </div>

      <div className="flex items-center justify-between pt-3" style={{ borderTop: "1px solid #21262d" }}>
        <span className="text-xs font-mono" style={{ color: "#484f58" }}>#{v.vehicle_type_code}</span>
        <ChevronRight size={14} className="transition-transform group-hover:translate-x-0.5" style={{ color: "#484f58" }} />
      </div>
    </div>
  );
}

function VehicleModal({ v, onClose }: { v: FleetVehicle; onClose: () => void }) {
  const isFree = v.free_at_minutes === 0;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl overflow-hidden fade-in"
        style={{ background: "#161b22", border: "1px solid #30363d" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid #21262d" }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center rounded-xl shrink-0" style={{ background: "#21262d" }}>
              <VehicleTypeIcon code={v.vehicle_type_code} size={24} />
            </div>
            <div>
              <div className="font-bold text-sm" style={{ color: "#e6edf3" }}>{v.name.split(" ").slice(1).join(" ") || v.name}</div>
              <div className="font-mono text-xs mt-0.5" style={{ color: "#8b949e" }}>{v.registration}</div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg" style={{ color: "#8b949e" }}><X size={16} /></button>
        </div>

        {v.start_lat && v.start_lon && (
          <div style={{ height: 180 }}>
            <MapView vehicles={[v]} tasks={[]} highlightVehicleId={v.wialon_id} />
          </div>
        )}

        <div className="p-5 grid grid-cols-2 gap-3">
          {[
            { label: "Wialon ID", value: String(v.wialon_id), mono: true },
            { label: "Тип техники", value: v.vehicle_type_code, mono: true },
            { label: "Скорость", value: `${v.avg_speed_kmh} км/ч` },
            { label: "Типов работ", value: String(v.skills_count) },
            { label: "Статус", value: isFree ? "Свободна" : `Занята ещё ${v.free_at_minutes.toFixed(0)} мин` },
            { label: "Узел графа", value: `#${v.start_node}`, mono: true },
            { label: "Координаты", value: v.start_lat ? `${v.start_lat.toFixed(4)}, ${v.start_lon.toFixed(4)}` : "—", mono: true },
          ].map(({ label, value, mono }) => (
            <div key={label} className="rounded-xl px-4 py-3" style={{ background: "#0d1117", border: "1px solid #21262d" }}>
              <div className="text-xs mb-1" style={{ color: "#484f58" }}>{label}</div>
              <div className={`text-sm font-semibold ${mono ? "font-mono" : ""}`} style={{ color: "#e6edf3" }}>{value}</div>
            </div>
          ))}
        </div>

        <div className="flex gap-3 px-5 pb-5">
          <div
            className="flex-1 flex items-center gap-2 justify-center py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: isFree ? "#0d4a1a" : "#4a0d0d", color: isFree ? "#3fb950" : "#f85149" }}
          >
            {isFree ? <CheckCircle size={14} /> : <Circle size={14} />}
            {isFree ? "Свободна сейчас" : "В работе"}
          </div>
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold" style={{ background: "#21262d", color: "#8b949e" }}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}

export default function FleetPage() {
  const [vehicles, setVehicles] = useState<FleetVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<typeof FILTERS[number]>("Все");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<FleetVehicle | null>(null);
  const [typeFilter, setTypeFilter] = useState("Все");

  useEffect(() => {
    api.fleet(200).then((r) => { setVehicles(r.vehicles); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const typeOptions = ["Все", ...Array.from(new Set(vehicles.map((v) => v.vehicle_type_code))).sort()];

  const filtered = vehicles.filter((v) => {
    const isFree = v.free_at_minutes === 0;
    if (filter === "Свободна" && !isFree) return false;
    if (filter === "Занята" && isFree) return false;
    if (typeFilter !== "Все" && v.vehicle_type_code !== typeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return v.name.toLowerCase().includes(q) || v.registration.toLowerCase().includes(q);
    }
    return true;
  });

  const freeCount = vehicles.filter((v) => v.free_at_minutes === 0).length;
  const busyCount = vehicles.length - freeCount;
  const avgSpeed = vehicles.length ? Math.round(vehicles.reduce((s, v) => s + v.avg_speed_kmh, 0) / vehicles.length) : 0;

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#0d1117" }}>
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center px-8 py-5 shrink-0" style={{ borderBottom: "1px solid #21262d" }}>
          <div>
            <h1 className="text-xl font-bold" style={{ color: "#e6edf3" }}>Автопарк</h1>
            <p className="text-xs mt-0.5" style={{ color: "#8b949e" }}>Управление транспортными средствами</p>
          </div>
        </div>

        {/* KPI strip */}
        <div className="flex gap-0 px-8 shrink-0" style={{ borderBottom: "1px solid #21262d" }}>
          {[
            { label: "Всего машин", value: vehicles.length, color: "#e6edf3" },
            { label: "Свободно", value: freeCount, color: "#3fb950" },
            { label: "Занято", value: busyCount, color: "#f85149" },
            { label: "Средняя скорость", value: `${avgSpeed} км/ч`, color: "#d4a017" },
            { label: "Типов техники", value: typeOptions.length - 1, color: "#1f6feb" },
          ].map(({ label, value, color }, i) => (
            <div key={label} className="flex items-center py-4 pr-8" style={{ borderRight: i < 4 ? "1px solid #21262d" : "none", paddingLeft: i > 0 ? 32 : 0 }}>
              <div>
                <div className="text-2xl font-bold" style={{ color }}>{value}</div>
                <div className="text-xs mt-0.5" style={{ color: "#484f58" }}>{label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 px-8 py-3 shrink-0" style={{ borderBottom: "1px solid #21262d" }}>
          <div className="relative" style={{ width: 260 }}>
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#484f58" }} />
            <input
              type="text"
              placeholder="Поиск по названию или номеру..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg pl-8 pr-3 py-1.5 text-xs outline-none"
              style={{ background: "#161b22", border: "1px solid #21262d", color: "#e6edf3" }}
            />
          </div>
          <div className="flex gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{
                  background: filter === f ? "#1f6feb" : "#161b22",
                  color: filter === f ? "#fff" : "#8b949e",
                  border: `1px solid ${filter === f ? "#1f6feb" : "#21262d"}`,
                }}
              >
                {f}
              </button>
            ))}
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-lg px-3 py-1.5 text-xs outline-none"
            style={{ background: "#161b22", border: "1px solid #21262d", color: "#8b949e" }}
          >
            {typeOptions.map((t) => <option key={t}>{t}</option>)}
          </select>
          <span className="ml-auto text-xs" style={{ color: "#484f58" }}>{filtered.length} из {vehicles.length}</span>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          {loading ? (
            <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
              {Array.from({ length: 9 }).map((_, i) => <div key={i} className="rounded-2xl h-44 skeleton" />)}
            </div>
          ) : (
            <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
              {filtered.map((v) => <VehicleCard key={v.wialon_id} v={v} onClick={() => setSelected(v)} />)}
              {filtered.length === 0 && (
                <div className="col-span-4 text-center py-20" style={{ color: "#484f58" }}>
                  <Truck size={32} className="mx-auto mb-3 opacity-30" />
                  <div className="text-sm">Нет результатов</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {selected && <VehicleModal v={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
