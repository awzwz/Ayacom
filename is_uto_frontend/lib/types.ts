export interface VehicleUnit {
  wialon_id: number;
  name: string;
  registration: string;
  eta_minutes: number;
  distance_km: number;
  score: number;
  reason: string;
  is_free: boolean;
  compatible: boolean;
}

export interface RecommendResponse {
  task_id: string;
  destination_uwi: string;
  dest_node: number;
  units: VehicleUnit[];
}

export interface RouteResponse {
  distance_km: number;
  time_minutes: number;
  nodes: number[];
  coords: [number, number][];
  from_node: number;
  to_node: number;
}

export interface FleetVehicle {
  wialon_id: number;
  name: string;
  registration: string;
  start_node: number;
  start_lon: number;
  start_lat: number;
  free_at_minutes: number;
  avg_speed_kmh: number;
  skills_count: number;
  vehicle_type_code: string;
}

export interface Task {
  task_id: string;
  priority: "high" | "medium" | "low";
  planned_start: string;
  planned_duration_hours: number;
  destination_uwi: string;
  task_type: string;
  shift: string;
  dest_node: number | null;
  dest_lon: number | null;
  dest_lat: number | null;
}

export interface HealthResponse {
  status: string;
  vehicles: number;
  tasks: number;
  wells: number;
}

export interface SimLeg {
  task_id: string;
  depart_at: number;   // minutes from sim start
  arrive_at: number;
  work_end_at: number;
  coords: [number, number][]; // [lon, lat]
}

export interface SimVehicle {
  wialon_id: number;
  name: string;
  start_lat: number;
  start_lon: number;
  legs: SimLeg[];
}

export interface SimTask {
  task_id: string;
  priority: "high" | "medium" | "low";
  dest_lat: number;
  dest_lon: number;
  assigned_to: number;
  arrive_at: number;
  work_end_at: number;
}

export interface SimulationPlan {
  total_duration_minutes: number;
  vehicles: SimVehicle[];
  tasks: SimTask[];
  unassigned: string[];
}

export interface GroupingResult {
  groups: string[][];
  strategy_summary: string;
  total_distance_km: number;
  baseline_distance_km: number;
  savings_percent: number;
  reason: string;
}

export interface BusinessCaseMetrics {
  distance_km: number;
  time_hours: number;
  trips: number;
  fuel_liters: number;
  cost_kzt: number;
}

export interface BusinessCaseOptimized extends BusinessCaseMetrics {
  groups: number;
}

export interface BusinessCaseSavings {
  distance_km: number;
  distance_pct: number;
  time_hours: number;
  fuel_liters: number;
  cost_kzt: number;
  co2_kg: number;
  annual_cost_kzt: number;
  annual_co2_tons: number;
}

export interface BusinessCaseMeta {
  tasks_count: number;
  vehicles_count: number;
  field_name: string;
  calculation_date: string;
}

export interface BusinessCaseResponse {
  baseline: BusinessCaseMetrics;
  optimized: BusinessCaseOptimized;
  savings: BusinessCaseSavings;
  meta: BusinessCaseMeta;
  narrative: string;
}
