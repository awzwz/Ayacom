"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import type { SimulationPlan, SimLeg } from "@/lib/types";

export type VehicleStatus = "idle" | "traveling" | "working";
export type TaskStatus = "pending" | "active" | "completed";

export interface SimVehiclePosition {
  lat: number;
  lon: number;
  status: VehicleStatus;
}

// Linearly interpolate position along a polyline [0..1]
function interpolateCoords(coords: [number, number][], progress: number): [number, number] {
  if (coords.length === 0) return [0, 0];
  if (coords.length === 1) return coords[0];
  if (progress <= 0) return coords[0];
  if (progress >= 1) return coords[coords.length - 1];

  // Compute cumulative segment lengths
  const lengths: number[] = [0];
  for (let i = 1; i < coords.length; i++) {
    const dx = coords[i][0] - coords[i - 1][0];
    const dy = coords[i][1] - coords[i - 1][1];
    lengths.push(lengths[i - 1] + Math.sqrt(dx * dx + dy * dy));
  }
  const total = lengths[lengths.length - 1];
  const target = progress * total;

  for (let i = 1; i < lengths.length; i++) {
    if (lengths[i] >= target) {
      const segProgress = (target - lengths[i - 1]) / (lengths[i] - lengths[i - 1]);
      const lon = coords[i - 1][0] + segProgress * (coords[i][0] - coords[i - 1][0]);
      const lat = coords[i - 1][1] + segProgress * (coords[i][1] - coords[i - 1][1]);
      return [lon, lat];
    }
  }
  return coords[coords.length - 1];
}

function getVehiclePositionAtTime(
  legs: SimLeg[],
  startLat: number,
  startLon: number,
  simTime: number
): SimVehiclePosition {
  if (legs.length === 0 || simTime < legs[0].depart_at) {
    return { lat: startLat, lon: startLon, status: "idle" };
  }

  for (const leg of legs) {
    if (simTime >= leg.depart_at && simTime < leg.arrive_at) {
      // Traveling along this leg
      const progress = (simTime - leg.depart_at) / (leg.arrive_at - leg.depart_at);
      const [lon, lat] = interpolateCoords(leg.coords, progress);
      return { lat, lon, status: "traveling" };
    }
    if (simTime >= leg.arrive_at && simTime < leg.work_end_at) {
      // Working at destination
      const last = leg.coords[leg.coords.length - 1];
      return { lat: last[1], lon: last[0], status: "working" };
    }
  }

  // After all legs — parked at last destination
  const lastLeg = legs[legs.length - 1];
  const last = lastLeg.coords[lastLeg.coords.length - 1];
  return { lat: last[1], lon: last[0], status: "idle" };
}

export const SPEED_OPTIONS = [
  { label: "×1", value: 1 },
  { label: "×30", value: 30 },
  { label: "×120", value: 120 },
  { label: "×600", value: 600 },
];

// Converts sim minutes to display time string (08:00 base)
export function simTimeToDisplay(minutes: number): string {
  const totalMin = Math.floor(8 * 60 + minutes);
  const h = Math.floor(totalMin / 60) % 24;
  const m = totalMin % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function useSimulation(plan: SimulationPlan | null) {
  const [simTime, setSimTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(60); // minutes per second of real time

  // Advance sim time
  useEffect(() => {
    if (!playing || !plan) return;
    const TICK_MS = 100;
    const minutesPerTick = (speed * TICK_MS) / 1000;

    const id = setInterval(() => {
      setSimTime((t) => {
        const next = t + minutesPerTick;
        if (next >= plan.total_duration_minutes) {
          setPlaying(false);
          return plan.total_duration_minutes;
        }
        return next;
      });
    }, TICK_MS);

    return () => clearInterval(id);
  }, [playing, speed, plan]);

  const reset = useCallback(() => {
    setSimTime(0);
    setPlaying(false);
  }, []);

  // Current vehicle positions
  const vehiclePositions = useMemo<Record<number, SimVehiclePosition>>(() => {
    if (!plan) return {};
    const result: Record<number, SimVehiclePosition> = {};
    for (const v of plan.vehicles) {
      result[v.wialon_id] = getVehiclePositionAtTime(v.legs, v.start_lat, v.start_lon, simTime);
    }
    return result;
  }, [plan, simTime]);

  // Task statuses
  const taskStatuses = useMemo<Record<string, TaskStatus>>(() => {
    if (!plan) return {};
    const result: Record<string, TaskStatus> = {};
    for (const t of plan.tasks) {
      if (simTime < t.arrive_at) result[t.task_id] = "pending";
      else if (simTime < t.work_end_at) result[t.task_id] = "active";
      else result[t.task_id] = "completed";
    }
    return result;
  }, [plan, simTime]);

  // All route polylines for simultaneous display
  const allRoutes = useMemo<[number, number][][]>(() => {
    if (!plan) return [];
    return plan.vehicles.flatMap((v) => v.legs.map((leg) => leg.coords));
  }, [plan]);

  return {
    simTime,
    playing,
    speed,
    vehiclePositions,
    taskStatuses,
    allRoutes,
    setSimTime,
    setPlaying,
    setSpeed,
    reset,
  };
}
