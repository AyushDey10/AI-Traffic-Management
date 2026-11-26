import type { ReactNode } from "react";
import type { CongestionLevel } from "../lib/api";

export const LEVEL_STYLES: Record<CongestionLevel, string> = {
  Empty: "border-border bg-panel text-muted",
  Low: "border-success/40 bg-success/10 text-success",
  Moderate: "border-warning/40 bg-warning/10 text-warning",
  High: "border-danger/40 bg-danger/10 text-danger",
  Severe: "border-danger/60 bg-danger/25 text-danger",
};

export const LEVEL_BAR: Record<CongestionLevel, string> = {
  Empty: "bg-border",
  Low: "bg-success",
  Moderate: "bg-warning",
  High: "bg-danger",
  Severe: "bg-danger",
};

export function Badge({ level }: { level: CongestionLevel }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${LEVEL_STYLES[level]}`}
    >
      {level}
    </span>
  );
}

export function Card({
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card card-pad animate-rise ${className}`}>
      {(title || action) && (
        <header className="mb-4 flex items-start justify-between gap-3">
          <div>
            {title && <h2 className="text-sm font-semibold text-ink">{title}</h2>}
            {subtitle && <p className="mt-1 text-xs text-muted">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "default" | "good" | "warn" | "bad" | "accent";
}) {
  const toneClass = {
    default: "text-ink",
    good: "text-success",
    warn: "text-warning",
    bad: "text-danger",
    accent: "text-cyan",
  }[tone];

  return (
    <div className="card card-pad">
      <p className="label">{label}</p>
      <p className={`mt-2 font-mono text-2xl font-semibold ${toneClass}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function Note({
  children,
  tone = "info",
}: {
  children: ReactNode;
  tone?: "info" | "warn" | "error";
}) {
  const styles = {
    info: "border-border bg-panel/60 text-muted",
    warn: "border-warning/30 bg-warning/5 text-warning",
    error: "border-danger/40 bg-danger/10 text-danger",
  }[tone];

  return (
    <p className={`rounded-lg border px-3 py-2 text-xs leading-relaxed ${styles}`}>{children}</p>
  );
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 text-sm text-muted">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-cyan" />
      {label}
    </div>
  );
}

export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-border/60">
      <div
        className="h-full rounded-full bg-cyan transition-all duration-300"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">{title}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p>
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </header>
  );
}

export function EmptyState({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="card card-pad flex flex-col items-start gap-2">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <p className="max-w-xl text-xs text-muted">{description}</p>
      {children}
    </div>
  );
}

const ICON_PATHS: Record<string, string> = {
  overview: "M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm9 0h7V11h-7v9Zm0-16v5h7V4h-7Z",
  video: "M4 6h11a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Zm13 4 4-2v8l-4-2v-4Z",
  simulation: "M3 3v18h18M7 15l3-4 3 2 4-6",
  signals: "M12 3v3m0 12v3M4.2 7.8l2.1 2.1m11.4 4.2 2.1 2.1M3 12h3m12 0h3M4.2 16.2l2.1-2.1m11.4-4.2 2.1-2.1M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z",
  analytics: "M4 19V9m5 10V5m5 14v-7m5 7V8",
  about: "M12 8h.01M11 12h1v5h1M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z",
  cpu: "M9 3v3m6-3v3M9 18v3m6-3v3M3 9h3m-3 6h3m12-6h3m-3 6h3M6 6h12v12H6z",
  alert: "M12 4 2.5 20h19L12 4Zm0 6v5m0 3h.01",
};

export function Icon({ name, className = "h-4 w-4" }: { name: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={ICON_PATHS[name] ?? ICON_PATHS.about} />
    </svg>
  );
}
