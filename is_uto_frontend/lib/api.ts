import type {
  RecommendResponse,
  RouteResponse,
  FleetVehicle,
  Task,
  HealthResponse,
  GroupingResult,
  SimulationPlan,
} from "./types";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json();
}

export const api = {
  health: () => req<HealthResponse>("/health"),

  recommend: (body: {
    task_id: string;
    priority: string;
    destination_uwi: string;
    planned_start: string;
    duration_hours: number;
    shift: string;
    task_type: string;
  }) =>
    req<RecommendResponse>("/api/recommendations", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  route: (body: {
    from_location: { wialon_id?: number; lon?: number; lat?: number };
    to_location: { uwi?: string; lon?: number; lat?: number };
  }) =>
    req<RouteResponse>("/api/route", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  multitask: (body: {
    task_ids: string[];
    constraints: { max_total_time_minutes: number; max_detour_ratio: number };
  }) =>
    req<GroupingResult>("/api/multitask", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  fleet: (limit = 100) =>
    req<{ count: number; vehicles: FleetVehicle[] }>(`/api/fleet?limit=${limit}`),

  tasks: (priority?: string, limit = 100) => {
    const qs = new URLSearchParams({ limit: String(limit) });
    if (priority) qs.set("priority", priority);
    return req<{ count: number; tasks: Task[] }>(`/api/tasks?${qs}`);
  },

  simulation: (body?: { task_ids?: string[]; time_limit_seconds?: number; max_tasks?: number }) =>
    req<SimulationPlan>("/api/simulation", {
      method: "POST",
      body: JSON.stringify(body ?? {}),
    }),

  assign: (body: { wialon_id: number; task_id: string; duration_hours: number }) =>
    req<{ status: string; wialon_id: number; task_id: string; free_at_minutes: number }>(
      "/api/assign",
      { method: "POST", body: JSON.stringify(body) }
    ),
};
