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

/** Plain-English label for each congestion level. */
export const LEVEL_TEXT: Record<CongestionLevel, string> = {
  Empty: "No vehicles",
  Low: "Light traffic",
  Moderate: "Getting busy",
  High: "Very busy",
  Severe: "Heavy jam",
};

/** One short sentence a student can read without any traffic knowledge. */
export const LEVEL_HELP: Record<CongestionLevel, string> = {
  Empty: "The AI did not find any vehicles on this road in this picture.",
  Low: "A few vehicles. The road is mostly free.",
  Moderate: "A fair number of vehicles are waiting on this road.",
  High: "Many vehicles. This road needs a longer green light.",
  Severe: "The road is almost full. It should be cleared first.",
};

export function Badge({ level }: { level: CongestionLevel }) {
  return (
    <span
      title={`Technical level: ${level}`}
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${LEVEL_STYLES[level]}`}
    >
      {LEVEL_TEXT[level]}
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
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {title && <h2 className="text-base font-semibold text-ink">{title}</h2>}
            {subtitle && <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-muted">{subtitle}</p>}
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
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{label}</p>
      <p className={`mt-2 font-mono text-3xl font-semibold leading-none ${toneClass}`}>{value}</p>
      {hint && <p className="mt-2 text-xs leading-relaxed text-muted">{hint}</p>}
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
    <p className={`rounded-lg border px-3 py-2 text-[13px] leading-relaxed ${styles}`}>{children}</p>
  );
}

/** A small, friendly "what does this mean?" box that opens on click. */
export function Explain({
  summary = "What does this mean?",
  children,
  className = "",
}: {
  summary?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <details
      className={`group rounded-lg border border-border/70 bg-panel/40 px-3 py-2 text-[13px] text-muted ${className}`}
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 font-medium text-ink/90 [&::-webkit-details-marker]:hidden">
        <Icon name="help" className="h-4 w-4 text-cyan" />
        <span>{summary}</span>
        <span className="ml-auto text-muted transition-transform group-open:rotate-180">▾</span>
      </summary>
      <div className="mt-2 space-y-2 leading-relaxed">{children}</div>
    </details>
  );
}

/** Numbered step used by the guided video workflow and the "how it works" page. */
export function StepCard({
  step,
  title,
  children,
  active = false,
}: {
  step: number | string;
  title: string;
  children: ReactNode;
  active?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        active ? "border-cyan/40 bg-cyan/5" : "border-border/70 bg-panel/40"
      }`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`grid h-6 w-6 place-items-center rounded-full text-[11px] font-semibold ${
            active ? "bg-cyan/20 text-cyan" : "bg-border/60 text-ink"
          }`}
        >
          {step}
        </span>
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
      </div>
      <div className="mt-2 text-[13px] leading-relaxed text-muted">{children}</div>
    </div>
  );
}

/** Big highlighted sentence at the top of a page. */
export function Callout({
  icon = "bulb",
  title,
  children,
}: {
  icon?: string;
  title?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-cyan/25 bg-cyan/5 p-4">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-cyan/30 bg-cyan/10 text-cyan">
        <Icon name={icon} className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        {title && <p className="text-sm font-semibold text-ink">{title}</p>}
        <p className="mt-0.5 text-[13px] leading-relaxed text-muted">{children}</p>
      </div>
    </div>
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
    <div className="h-2 w-full overflow-hidden rounded-full bg-border/60">
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
  eyebrow,
  children,
}: {
  title: string;
  description: string;
  eyebrow?: string;
  children?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan">
            {eyebrow}
          </p>
        )}
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{title}</h1>
        <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-muted">{description}</p>
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
      <p className="max-w-xl text-[13px] leading-relaxed text-muted">{description}</p>
      {children}
    </div>
  );
}

const ICON_PATHS: Record<string, string> = {
  home: "M3 10.5 12 3l9 7.5M5 9.5V21h5v-6h4v6h5V9.5",
  overview: "M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm9 0h7V11h-7v9Zm0-16v5h7V4h-7Z",
  video: "M4 6h11a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Zm13 4 4-2v8l-4-2v-4Z",
  simulation: "M3 3v18h18M7 15l3-4 3 2 4-6",
  signals: "M12 3v3m0 12v3M4.2 7.8l2.1 2.1m11.4 4.2 2.1 2.1M3 12h3m12 0h3M4.2 16.2l2.1-2.1m11.4-4.2 2.1-2.1M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z",
  analytics: "M4 19V9m5 10V5m5 14v-7m5 7V8",
  about: "M12 8h.01M11 12h1v5h1M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z",
  cpu: "M9 3v3m6-3v3M9 18v3m6-3v3M3 9h3m-3 6h3m12-6h3m-3 6h3M6 6h12v12H6z",
  alert: "M12 4 2.5 20h19L12 4Zm0 6v5m0 3h.01",
  help: "M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7v.5M12 17h.01M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z",
  bulb: "M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.4.3.5.7.5 1.1v1h6v-1c0-.4.1-.8.5-1.1A6 6 0 0 0 12 3Z",
  clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 4v5l3 2",
  check: "M5 12.5 9.5 17 19 7",
  play: "M8 5v14l11-7L8 5Z",
  road: "M6 21 9 3h6l3 18M12 7v2m0 3v2m0 3v2",
  car: "M4 16v-3l2-5h12l2 5v3M4 16h16M7 16v2m10-2v2M8 12h8",
  spark: "M12 3v4m0 10v4M5.6 5.6l2.8 2.8m7.2 7.2 2.8 2.8M3 12h4m10 0h4M5.6 18.4l2.8-2.8m7.2-7.2 2.8-2.8",
  arrow: "M5 12h14m-6-6 6 6-6 6",
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
