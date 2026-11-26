import type { ReactNode } from "react";

export const LANE_COLOURS: Record<string, string> = {
  North: "#00D5FF",
  South: "#22C55E",
  East: "#8B5CF6",
  West: "#F59E0B",
  Unassigned: "#64748B",
};

export const SERIES_COLOURS = {
  fixed: "#8B5CF6",
  adaptive: "#00D5FF",
};

export const AXIS = {
  stroke: "#94A3B8",
  tickLine: false,
  axisLine: false,
  tick: { fontSize: 11 },
} as const;

export function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-border bg-panel/95 px-3 py-2 text-xs shadow-lg">
      {label !== undefined && <p className="mb-1 font-medium text-ink">{label}</p>}
      {payload.map((entry: any) => (
        <p key={String(entry.dataKey ?? entry.name)} className="flex items-center gap-2 text-muted">
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: entry.color ?? entry.fill ?? "#94A3B8" }}
          />
          {entry.name}: <span className="font-mono text-ink">{entry.value}</span>
        </p>
      ))}
    </div>
  );
}

export function ChartFrame({
  children,
  height = 240,
}: {
  children: ReactNode;
  height?: number;
}) {
  return (
    <div style={{ width: "100%", height }}>
      {children}
    </div>
  );
}

export function Legend({ items }: { items: { label: string; colour: string }[] }) {
  return (
    <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-muted">
      {items.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm" style={{ background: item.colour }} />
          {item.label}
        </span>
      ))}
    </div>
  );
}
