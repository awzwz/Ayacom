"use client";

import { useState } from "react";
import { Search, Zap } from "lucide-react";
import type { FleetVehicle } from "@/lib/types";

interface Props {
  vehicles: FleetVehicle[];
  onSelect: (v: FleetVehicle) => void;
  selectedId: number | null;
}

const FILTERS = [
  { label: "Все", value: "all" },
  { label: "Свободна", value: "free" },
  { label: "Занята", value: "busy" },
];

export default function FleetPanel({ vehicles, onSelect, selectedId }: Props) {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const filtered = vehicles.filter((v) => {
    const isFree = v.free_at_minutes === 0;
    if (filter === "free" && !isFree) return false;
    if (filter === "busy" && isFree) return false;
    if (search) {
      const q = search.toLowerCase();
      return v.name.toLowerCase().includes(q) || v.registration.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="flex flex-col h-full">
      {/* Filters */}
      <div className="px-4 pt-4 pb-3" style={{ borderBottom: "1px solid #21262d" }}>
        <div className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "#8b949e" }}>
          Парк техники
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#484f58" }} />
          <input
            type="text"
            placeholder="Поиск по названию или номеру..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg pl-8 pr-3 py-2 text-xs outline-none"
            style={{ background: "#161b22", border: "1px solid #30363d", color: "#e6edf3" }}
          />
        </div>

        {/* Filter pills */}
        <div className="flex gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className="px-3 py-1 rounded-full text-xs font-medium transition-all"
              style={{
                background: filter === f.value ? "#1f6feb" : "#161b22",
                color: filter === f.value ? "#fff" : "#8b949e",
                border: `1px solid ${filter === f.value ? "#1f6feb" : "#30363d"}`,
              }}
            >
              {f.label}
            </button>
          ))}
          <span className="ml-auto text-xs self-center" style={{ color: "#484f58" }}>
            {filtered.length} из {vehicles.length}
          </span>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1">
        {filtered.map((v) => {
          const isFree = v.free_at_minutes === 0;
          const isSelected = selectedId === v.wialon_id;
          return (
            <button
              key={v.wialon_id}
              onClick={() => onSelect(v)}
              className="w-full text-left rounded-xl px-3 py-3 transition-all"
              style={{
                background: isSelected ? "#161b22" : "transparent",
                border: `1px solid ${isSelected ? "#d4a017" : "transparent"}`,
              }}
              onMouseOver={(e) => {
                if (!isSelected) e.currentTarget.style.background = "#161b22";
              }}
              onMouseOut={(e) => {
                if (!isSelected) e.currentTarget.style.background = "transparent";
              }}
            >
              <div className="flex items-start gap-3">
                {/* Status dot */}
                <div className="mt-1 shrink-0">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ background: isFree ? "#3fb950" : "#f85149" }}
                  />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold truncate" style={{ color: "#e6edf3" }}>
                      {v.name.split(" ").slice(1, 4).join(" ")}
                    </span>
                  </div>
                  <div className="text-xs font-mono mt-0.5 truncate" style={{ color: "#8b949e" }}>
                    {v.registration}
                  </div>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-xs" style={{ color: "#484f58" }}>
                      <Zap size={10} className="inline" style={{ color: "#d4a017" }} />
                      {" "}{v.avg_speed_kmh} км/ч
                    </span>
                    <span className="text-xs" style={{ color: "#484f58" }}>
                      {v.skills_count} типов работ
                    </span>
                  </div>
                </div>

                {/* Status badge */}
                <span
                  className="text-xs px-1.5 py-0.5 rounded shrink-0 self-start font-medium"
                  style={{
                    background: isFree ? "#0d4a1a" : "#4a0d0d",
                    color: isFree ? "#3fb950" : "#f85149",
                  }}
                >
                  {isFree ? "Своб." : "Занята"}
                </span>
              </div>
            </button>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center py-8 text-xs" style={{ color: "#484f58" }}>
            Нет результатов
          </div>
        )}
      </div>
    </div>
  );
}
