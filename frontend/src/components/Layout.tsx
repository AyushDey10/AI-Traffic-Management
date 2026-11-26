import { useState, type ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { useTraffic } from "../lib/TrafficContext";
import { Icon } from "./ui";

const NAVIGATION = [
  { to: "/", label: "Overview", icon: "overview", end: true },
  { to: "/video", label: "Video Analysis", icon: "video" },
  { to: "/simulation", label: "Traffic Simulation", icon: "simulation" },
  { to: "/signals", label: "Signal Recommendations", icon: "signals" },
  { to: "/analytics", label: "Analytics & Reports", icon: "analytics" },
  { to: "/about", label: "About the Project", icon: "about" },
];

function StatusPill() {
  const { health, error } = useTraffic();

  const state = error ? "offline" : health?.model.state ?? "checking";
  const styles =
    state === "loaded"
      ? "border-success/40 bg-success/10 text-success"
      : state === "offline"
        ? "border-danger/40 bg-danger/10 text-danger"
        : "border-warning/40 bg-warning/10 text-warning";

  const label =
    state === "loaded"
      ? "Detection engine online"
      : state === "offline"
        ? "API unreachable"
        : state === "missing"
          ? "Model weights missing"
          : "Checking engine";

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-medium ${styles}`}
    >
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
      </span>
      {label}
    </span>
  );
}

export default function Layout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { health } = useTraffic();

  const navigation = (
    <nav className="flex flex-col gap-1">
      {NAVIGATION.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={() => setOpen(false)}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
              isActive
                ? "border border-cyan/30 bg-cyan/10 text-cyan"
                : "border border-transparent text-muted hover:border-border hover:bg-panel/70 hover:text-ink"
            }`
          }
        >
          <Icon name={item.icon} />
          {item.label}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col justify-between border-r border-border/70 bg-panel/80 px-4 py-5 backdrop-blur lg:flex">
        <div>
          <div className="mb-6 flex items-center gap-3 px-1">
            <div className="grid h-9 w-9 place-items-center rounded-lg border border-cyan/40 bg-cyan/10 text-cyan">
              <Icon name="signals" className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold leading-tight text-ink">Traffic Command</p>
              <p className="text-[11px] text-muted">AI prototype</p>
            </div>
          </div>

          {navigation}
        </div>

        <div className="space-y-3 border-t border-border/70 pt-4 text-[11px] text-muted">
          <p className="leading-relaxed">
            Educational prototype. Not a real-world traffic controller.
          </p>
          <p className="font-mono text-[10px] text-border">
            v{health?.api_version ?? "1.0.0"} · CPU inference
          </p>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-border/70 bg-base/85 backdrop-blur">
          <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                className="rounded-lg border border-border p-2 text-muted hover:text-ink lg:hidden"
                aria-label="Toggle navigation"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" stroke="currentColor" fill="none" strokeWidth="2">
                  <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
                </svg>
              </button>
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-muted">
                  Smart-city traffic control
                </p>
                <p className="text-sm font-medium text-ink">
                  Intersection analysis &amp; adaptive signalling
                </p>
              </div>
            </div>
            <StatusPill />
          </div>

          {open && (
            <div className="border-t border-border/70 bg-panel px-4 py-3 lg:hidden">{navigation}</div>
          )}
        </header>

        <main className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
