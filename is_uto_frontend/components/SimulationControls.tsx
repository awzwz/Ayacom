"use client";

import { Play, Pause, RotateCcw, Zap } from "lucide-react";
import { SPEED_OPTIONS, simTimeToDisplay } from "@/hooks/useSimulation";
import type { SimulationPlan } from "@/lib/types";

interface Props {
  plan: SimulationPlan;
  simTime: number;
  playing: boolean;
  speed: number;
  onPlayPause: () => void;
  onReset: () => void;
  onSpeedChange: (s: number) => void;
  onSeek: (t: number) => void;
  onClose: () => void;
}

export default function SimulationControls({
  plan,
  simTime,
  playing,
  speed,
  onPlayPause,
  onReset,
  onSpeedChange,
  onSeek,
  onClose,
}: Props) {
  const progress = Math.min(simTime / plan.total_duration_minutes, 1);
  const currentDisplay = simTimeToDisplay(simTime);
  const endDisplay = simTimeToDisplay(plan.total_duration_minutes);

  const assignedCount = plan.tasks.length;
  const unassignedCount = plan.unassigned.length;
  const vehicleCount = plan.vehicles.length;

  return (
    <div
      style={{
        position: "absolute",
        bottom: 80,
        left: "50%",
        transform: "translateX(-50%)",
        background: "rgba(13,17,23,0.95)",
        border: "1px solid #30363d",
        borderRadius: 16,
        padding: "14px 20px",
        backdropFilter: "blur(12px)",
        zIndex: 1100,
        minWidth: 480,
        boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              background: "#d4a017",
              color: "#0d1117",
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.1em",
              padding: "2px 8px",
              borderRadius: 6,
              textTransform: "uppercase",
            }}
          >
            Симуляция
          </div>
          <span style={{ fontSize: 11, color: "#484f58" }}>
            {vehicleCount} машин · {assignedCount} заявок назначено
            {unassignedCount > 0 && (
              <span style={{ color: "#f85149" }}> · {unassignedCount} не назначено</span>
            )}
          </span>
        </div>
        <button
          onClick={onClose}
          style={{ color: "#484f58", background: "none", border: "none", cursor: "pointer", fontSize: 18, lineHeight: 1 }}
        >
          ×
        </button>
      </div>

      {/* Timeline bar */}
      <div style={{ marginBottom: 10, position: "relative" }}>
        <div
          style={{
            height: 6,
            background: "#21262d",
            borderRadius: 3,
            cursor: "pointer",
            position: "relative",
            overflow: "hidden",
          }}
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const ratio = (e.clientX - rect.left) / rect.width;
            onSeek(ratio * plan.total_duration_minutes);
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              height: "100%",
              width: `${progress * 100}%`,
              background: "linear-gradient(90deg, #d4a017, #f0c040)",
              borderRadius: 3,
              transition: playing ? "none" : "width 0.1s",
            }}
          />
        </div>
      </div>

      {/* Time display + controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {/* Time */}
        <div style={{ fontVariantNumeric: "tabular-nums", minWidth: 110 }}>
          <span style={{ fontSize: 20, fontWeight: 700, color: "#e6edf3", letterSpacing: "0.04em" }}>
            {currentDisplay}
          </span>
          <span style={{ fontSize: 12, color: "#484f58", marginLeft: 4 }}>/ {endDisplay}</span>
        </div>

        {/* Play / Pause / Reset */}
        <div style={{ display: "flex", gap: 6 }}>
          <button
            onClick={onReset}
            style={{
              background: "#21262d",
              border: "1px solid #30363d",
              borderRadius: 8,
              color: "#8b949e",
              width: 34,
              height: 34,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <RotateCcw size={14} />
          </button>
          <button
            onClick={onPlayPause}
            style={{
              background: playing ? "#d4a017" : "#238636",
              border: "none",
              borderRadius: 8,
              color: playing ? "#0d1117" : "#fff",
              width: 34,
              height: 34,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            {playing ? <Pause size={14} /> : <Play size={14} />}
          </button>
        </div>

        {/* Speed */}
        <div style={{ display: "flex", gap: 4, marginLeft: 4 }}>
          {SPEED_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onSpeedChange(opt.value)}
              style={{
                background: speed === opt.value ? "#d4a017" : "#161b22",
                border: `1px solid ${speed === opt.value ? "#d4a017" : "#30363d"}`,
                borderRadius: 6,
                color: speed === opt.value ? "#0d1117" : "#8b949e",
                fontSize: 11,
                fontWeight: 700,
                padding: "4px 8px",
                cursor: "pointer",
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Live indicator */}
        {playing && (
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginLeft: "auto" }}>
            <div
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: "#3fb950",
                animation: "pulse 1s infinite",
              }}
            />
            <span style={{ fontSize: 11, color: "#3fb950", fontWeight: 600 }}>идёт</span>
          </div>
        )}
      </div>
    </div>
  );
}
