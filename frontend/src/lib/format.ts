import type { CongestionLevel } from "./api";

export function levelFor(utilisation: number): CongestionLevel {
  if (utilisation <= 0) return "Empty";
  if (utilisation < 0.2) return "Low";
  if (utilisation < 0.45) return "Moderate";
  if (utilisation < 0.7) return "High";
  return "Severe";
}

export function number(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return value.toFixed(digits);
}

export function percent(value: number, digits = 0): string {
  return `${(value * 100).toFixed(digits)}%`;
}

export function seconds(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${value.toFixed(1)} s`;
}

export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const diff = Math.max(0, Date.now() - then);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours} h ago`;
}

export function timestampLabel(value: number): string {
  return `${value.toFixed(1)} s`;
}
