/** Typed client for the FastAPI backend. All data comes from the real API. */

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

export type Approach = "North" | "South" | "East" | "West";
export type CongestionLevel = "Empty" | "Low" | "Moderate" | "High" | "Severe";

export const APPROACHES: Approach[] = ["North", "South", "East", "West"];

export interface Health {
  status: string;
  api_version: string;
  model: {
    file: string;
    state: string;
    error: string | null;
    device: string;
    confidence: number;
    image_size: number;
    custom_trained: boolean;
  };
  versions: Record<string, string>;
  videos_available: number;
  processed_video_available: boolean;
  uptime_seconds: number;
  time: string;
}

export interface VideoInfo {
  id: string;
  filename: string;
  duration_seconds: number;
  fps: number;
  frame_count: number;
  width: number;
  height: number;
  size_mb: number;
  has_processed_video: boolean;
  processed_filename: string | null;
  source_url: string | null;
  processed_url: string | null;
  stored_in?: string;
}

export interface LaneSnapshot {
  name: Approach;
  total: number;
  classes: Record<string, number>;
  share: number;
  weighted_demand: number;
  utilisation: number;
  congestion: CongestionLevel;
}

export interface SignalDecision {
  green_lane: Approach | null;
  green_duration: number;
  yellow_duration: number;
  all_red_duration: number;
  demand: number;
  waiting_seconds: number;
  priority: string;
  expected_cleared_units: number;
  status: string;
  reason: string;
  cycle: number;
  service_rate?: number;
  green_bounds?: [number, number];
  max_wait_limit?: number;
}

export interface FrameSnapshot {
  video_id: string;
  timestamp: number;
  analysed_at: string;
  processing_ms: number;
  image_url: string;
  video: { width: number; height: number; fps: number; duration_seconds: number };
  total_detections: number;
  unassigned: number;
  lanes: LaneSnapshot[];
  classes: { name: string; count: number }[];
  detections: {
    class: string;
    confidence: number;
    lane: string;
    box_normalised: number[];
  }[];
  congestion_summary: {
    total_weighted_demand: number;
    dominant_approach: Approach | null;
    average_utilisation: number;
    level_counts: Record<string, number>;
    is_snapshot: boolean;
    note: string;
  };
  signal: SignalDecision;
  settings: { confidence: number; image_size: number; device: string; model: string };
  notes: string[];
}

export interface LaneStats {
  arrivals: number;
  served: number;
  remaining: number;
  served_wait_total: number;
  first_green_in_seconds: number | null;
  maximum_wait_seconds: number;
  average_wait_seconds: number;
}

export interface Timeseries {
  t: number[];
  total: number[];
  North: number[];
  South: number[];
  East: number[];
  West: number[];
}

export interface RunResult {
  policy: string;
  seed: number;
  simulation_seconds: number;
  arrival_rates: Record<Approach, number>;
  service_rate: number;
  total_arrivals: number;
  vehicles_served: number;
  vehicles_remaining: number;
  throughput_per_minute: number;
  average_queue: number;
  maximum_queue: number;
  average_wait_seconds: number;
  average_wait_served_seconds: number;
  average_wait_remaining_seconds: number;
  maximum_wait_seconds: number;
  long_wait_events: number;
  cycles: number;
  per_lane: Record<Approach, LaneStats>;
  timeseries: Timeseries;
  decisions: {
    cycle: number;
    start_second: number;
    green_lane: Approach | null;
    green_duration: number;
    demand: number;
    priority: string;
    reason: string;
  }[];
  wait_note: string;
}

export interface CompareResult {
  seed: number;
  fixed_time: RunResult;
  adaptive: RunResult;
}

export interface SeedRow {
  seed: number;
  fixed_served: number;
  adaptive_served: number;
  fixed_wait: number;
  adaptive_wait: number;
  fixed_queue: number;
  adaptive_queue: number;
  fixed_max_wait: number;
  adaptive_max_wait: number;
}

export interface SeedSweep {
  duration: number;
  seed_count: number;
  seeds: number[];
  rows: SeedRow[];
  summary: Record<
    "fixed_time" | "adaptive",
    Record<string, { mean: number; std: number; min: number; max: number }>
  >;
  adaptive_lower_wait_seeds: number;
  adaptive_served_more_seeds: number;
  honesty_note: string;
}

export interface AnalysisSample {
  timestamp: number;
  total: number;
  unassigned: number;
  lanes: Record<Approach, number>;
  demand: Record<Approach, number>;
  congestion: Record<Approach, CongestionLevel>;
  signal: { green_lane: Approach | null; green_duration: number; reason: string };
  classes: Record<string, number>;
  image_url: string;
  processing_ms: number;
}

export interface AnalysisJobDetail {
  video_id: string;
  video: VideoInfo;
  samples: AnalysisSample[];
  summary: {
    samples: number;
    interval_seconds: number;
    video_duration_seconds: number;
    mean_detections_per_sampled_frame: number;
    max_detections: number;
    peak_timestamp: number;
    approach_totals: Record<Approach, number>;
    class_totals: Record<string, number>;
    congestion_counts: Record<string, number>;
    mean_processing_ms: number;
    note: string;
  };
  settings: Record<string, string | number>;
  notes: string[];
}

export interface AnalysisJob {
  job_id: string;
  video_id: string;
  status: "queued" | "running" | "completed" | "failed";
  progress: number;
  total: number;
  error: string | null;
  result: AnalysisJobDetail | null;
  created_at: string;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });

  if (!response.ok) {
    let detail = `Request failed (${response.status})`;
    try {
      const body = await response.json();
      if (typeof body.detail === "string") detail = body.detail;
      else if (body.detail) detail = JSON.stringify(body.detail);
    } catch {
      /* keep the generic message */
    }
    throw new ApiError(detail, response.status);
  }

  return (await response.json()) as T;
}

export const api = {
  health: () => request<Health>("/api/health"),
  config: () => request<Record<string, unknown>>("/api/config"),
  videos: () => request<{ count: number; videos: VideoInfo[] }>("/api/videos"),

  analyseFrame: (payload: {
    video_id: string;
    timestamp: number;
    confidence?: number;
    image_size?: number;
  }) =>
    request<FrameSnapshot>("/api/analysis/frame", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  startJob: (payload: {
    video_id: string;
    interval_seconds: number;
    limit: number;
  }) =>
    request<{ job_id: string; status: string }>("/api/analysis/jobs", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  job: (jobId: string) => request<AnalysisJob>(`/api/analysis/jobs/${jobId}`),

  compare: (payload: { duration: number; seed: number }) =>
    request<CompareResult>("/api/simulation/compare", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  sweepSeeds: (payload: { duration: number; seeds: number[] }) =>
    request<SeedSweep>("/api/simulation/seeds", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  recommend: (payload: { demand: Record<string, number>; wait?: Record<string, number> }) =>
    request<SignalDecision>("/api/signals/recommend", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  upload: async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    const response = await fetch(`${API_BASE}/api/videos/upload`, {
      method: "POST",
      body: form,
    });
    if (!response.ok) {
      let detail = `Upload failed (${response.status})`;
      try {
        const body = await response.json();
        if (typeof body.detail === "string") detail = body.detail;
      } catch {
        /* ignore */
      }
      throw new ApiError(detail, response.status);
    }
    return (await response.json()) as VideoInfo;
  },
};

export function mediaUrl(path: string | null | undefined): string {
  if (!path) return "";
  return path.startsWith("/") ? `${API_BASE}${path}` : path;
}
