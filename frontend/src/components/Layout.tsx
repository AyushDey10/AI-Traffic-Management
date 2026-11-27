import { useState, type ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { useTraffic } from "../lib/TrafficContext";
import { Icon } from "./ui";

const NAVIGATION = [
  { to: "/", label: "Home", hint: "See what the AI found", icon: "home", end: true },
  { to: "/video", label: "Check a Video", hint: "Find vehicles in traffic footage", icon: "video" },
  { to: "/signals", label: "Smart Signal", hint: "Which road should go next?", icon: "signals" },
  { to: "/simulation", label: "Compare Signals", hint: "Old timer vs smart signal", icon: "simulation" },
  { to: "/analytics", label: "Traffic Report", hint: "Scan the video over time", icon: "analytics" },
  { to: "/about", label: "How It Works", hint: "Learn the ideas in simple words", icon: "about" },
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
      ? "AI is ready"
      : state === "offline"
        ? "AI is offline"
        : state === "missing"
          ? "AI model missing"
          : "Starting AI…";

  return (
    <span
      title={
        state === "loaded"
          ? "The detection model loaded successfully."
          : state === "offline"
            ? "The dashboard cannot reach the local API."
            : "The dashboard is checking the local API."
      }
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
    <nav className="flex flex-col gap-1.5" aria-label="Main sections">
      {NAVIGATION.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={() => setOpen(false)}
          className={({ isActive }) =>
            `group flex items-start gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
              isActive
                ? "border-cyan/30 bg-cyan/10 text-cyan"
                : "border-transparent text-muted hover:border-border hover:bg-panel/70 hover:text-ink"
            }`
          }
        >
          {({ isActive }) => (
            <>
              <span
                className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border ${
                  isActive
                    ? "border-cyan/40 bg-cyan/10 text-cyan"
                    : "border-border/70 bg-panel/60 text-muted group-hover:text-ink"
                }`}
              >
                <Icon name={item.icon} className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium leading-tight">{item.label}</span>
                <span className="mt-0.5 block text-[11px] leading-snug opacity-70">{item.hint}</span>
              </span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 flex-col justify-between border-r border-border/70 bg-panel/80 px-4 py-5 backdrop-blur lg:flex">
        <div>
          <div className="mb-6 flex items-center gap-3 px-1">
            <div className="grid h-10 w-10 place-items-center rounded-xl border border-cyan/40 bg-cyan/10 text-cyan">
              <Icon name="signals" className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold leading-tight text-ink">Smart Traffic AI</p>
              <p className="text-[11px] text-muted">School exhibition project</p>
            </div>
          </div>

          {navigation}
        </div>

        <div className="space-y-3 border-t border-border/70 pt-4 text-[11px] leading-relaxed text-muted">
          <p>
            This is a learning project. It <span className="text-ink">suggests</span> a traffic
            signal — it does not control real traffic lights.
          </p>
          <p className="font-mono text-[10px] text-border">
            v{health?.api_version ?? "1.0.0"} · runs on this computer
          </p>
        </div>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-border/70 bg-base/85 backdrop-blur">
          <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                className="rounded-lg border border-border p-2 text-muted hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan lg:hidden"
                aria-label="Toggle navigation"
                aria-expanded={open}
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" stroke="currentColor" fill="none" strokeWidth="2">
                  <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
                </svg>
              </button>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">
                  AI-Powered Intelligent Traffic Management
                </p>
                <p className="hidden text-[11px] text-muted sm:block">
                  Watch traffic · find vehicles · suggest a smarter green light
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <NavLink
                to="/about"
                className="hidden items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[11px] text-muted hover:border-cyan/40 hover:text-cyan sm:inline-flex"
              >
                <Icon name="help" className="h-3.5 w-3.5" />
                How does it work?
              </NavLink>
              <StatusPill />
            </div>
          </div>

          {open && (
            <div className="border-t border-border/70 bg-panel px-4 py-3 lg:hidden">{navigation}</div>
          )}
        </header>

        <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
