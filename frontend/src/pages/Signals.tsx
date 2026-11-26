import { useEffect, useState } from "react";
import { APPROACHES, api, type Approach, type SignalDecision } from "../lib/api";
import { Badge, Card, Note, PageHeader, Spinner } from "../components/ui";
import { number } from "../lib/format";
import { errorMessage } from "../lib/TrafficContext";
import { useTraffic } from "../lib/TrafficContext";

const EMPTY_DEMAND: Record<Approach, number> = { North: 0, South: 0, East: 0, West: 0 };

const PRIORITY_LABEL: Record<string, string> = {
  max_demand: "Highest weighted demand",
  max_wait: "Maximum-wait fairness",
  none: "Idle",
  fixed_rotation: "Fixed-time rotation",
};

export default function Signals() {
  const { snapshot } = useTraffic();
  const [demand, setDemand] = useState<Record<Approach, number>>(EMPTY_DEMAND);
  const [waits, setWaits] = useState<Record<Approach, number>>(EMPTY_DEMAND);
  const [decision, setDecision] = useState<SignalDecision | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState("Manual scenario");

  const applySnapshot = () => {
    if (!snapshot) return;
    const next = { ...EMPTY_DEMAND };
    snapshot.lanes.forEach((lane) => {
      next[lane.name] = lane.weighted_demand;
    });
    setDemand(next);
    setWaits({ ...EMPTY_DEMAND });
    setSource(`Frame at ${number(snapshot.timestamp, 1)} s (${snapshot.video_id})`);
    setDecision(snapshot.signal);
  };

  useEffect(() => {
    if (snapshot) applySnapshot();
    // Only re-seed when a new snapshot arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot?.analysed_at]);

  const compute = async () => {
    setPending(true);
    setError(null);
    try {
      const result = await api.recommend({ demand, wait: waits });
      setDecision(result);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setPending(false);
    }
  };

  const loadStarvationScenario = () => {
    setDemand({ North: 3, South: 2, East: 40, West: 2 });
    setWaits({ North: 10, South: 62, East: 4, West: 8 });
    setSource("Fairness scenario: low-demand South waiting 62 s");
  };

  const greenLow = decision?.green_bounds?.[0] ?? 12;
  const greenHigh = decision?.green_bounds?.[1] ?? 45;
  const serviceRate = decision?.service_rate ?? 1.5;
  const requiredGreen = decision ? Math.ceil(decision.demand / serviceRate) : 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Signal Recommendations"
        description="Rule-based next-phase recommendation from approach demand, with maximum-wait fairness. A decision support view, not a signal controller."
      >
        <span className="rounded-full border border-border bg-panel/70 px-3 py-1 text-[11px] text-muted">
          Source: {source}
        </span>
      </PageHeader>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card
          className="xl:col-span-2"
          title="Recommended next green"
          subtitle="Computed from the weighted demand and waiting times below."
          action={
            <div className="flex gap-2">
              <button type="button" className="btn-ghost" onClick={applySnapshot} disabled={!snapshot}>
                Use current frame
              </button>
              <button type="button" className="btn-primary" onClick={compute} disabled={pending}>
                {pending ? "Computing…" : "Recompute"}
              </button>
            </div>
          }
        >
          {pending && <Spinner label="Evaluating demand and fairness rules…" />}
          {error && <Note tone="error">{error}</Note>}

          {decision && !pending && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-4">
                <div className="grid h-20 w-20 place-items-center rounded-full border-2 border-cyan/40 bg-cyan/10">
                  <span className="font-mono text-lg font-semibold text-cyan">
                    {decision.green_lane ?? "—"}
                  </span>
                </div>
                <div>
                  <p className="text-3xl font-semibold text-ink">
                    {decision.green_duration}
                    <span className="ml-1 text-base font-normal text-muted">s green</span>
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {PRIORITY_LABEL[decision.priority] ?? decision.priority} · demand{" "}
                    {number(decision.demand)} units · waited{" "}
                    {number(decision.waiting_seconds, 0)} s
                  </p>
                </div>
                <div className="ml-auto flex flex-wrap gap-2">
                  <Badge level={decision.priority === "max_wait" ? "Moderate" : "Low"} />
                  <span className="rounded-full border border-border px-2.5 py-0.5 text-[11px] text-muted">
                    cycle #{decision.cycle}
                  </span>
                </div>
              </div>

              <p className="rounded-lg border border-border bg-panel/60 px-3 py-2 text-xs leading-relaxed text-muted">
                {decision.reason}
              </p>

              <div>
                <p className="label mb-2">Phase timing</p>
                <div className="flex h-8 overflow-hidden rounded-lg border border-border">
                  <div
                    className="flex items-center justify-center bg-cyan/25 text-[11px] text-cyan"
                    style={{ flexGrow: decision.green_duration }}
                  >
                    green {decision.green_duration}s
                  </div>
                  <div
                    className="flex items-center justify-center bg-warning/20 text-[11px] text-warning"
                    style={{ flexGrow: decision.yellow_duration }}
                  >
                    {decision.yellow_duration}s
                  </div>
                  <div
                    className="flex items-center justify-center bg-danger/20 text-[11px] text-danger"
                    style={{ flexGrow: decision.all_red_duration }}
                  >
                    {decision.all_red_duration}s
                  </div>
                </div>
              </div>

              <dl className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-border bg-panel/50 p-3">
                  <dt className="label">Clearance time</dt>
                  <dd className="mt-1 font-mono text-sm text-ink">
                    {decision.demand} ÷ {serviceRate} = {number(decision.demand / serviceRate)} s
                  </dd>
                  <p className="mt-1 text-[11px] text-muted">Demand divided by service rate.</p>
                </div>
                <div className="rounded-lg border border-border bg-panel/50 p-3">
                  <dt className="label">Applied bounds</dt>
                  <dd className="mt-1 font-mono text-sm text-ink">
                    {decision.green_duration} s ∈ [{greenLow}, {greenHigh}]
                  </dd>
                  <p className="mt-1 text-[11px] text-muted">Minimum and maximum green.</p>
                </div>
                <div className="rounded-lg border border-border bg-panel/50 p-3">
                  <dt className="label">Expected clearance</dt>
                  <dd className="mt-1 font-mono text-sm text-ink">
                    {number(decision.expected_cleared_units)} units
                  </dd>
                  <p className="mt-1 text-[11px] text-muted">
                    Raw requirement was {requiredGreen} s before clamping.
                  </p>
                </div>
              </dl>
            </div>
          )}
        </Card>

        <Card title="Rules applied" subtitle="Evaluated in this order.">
          <ol className="space-y-3 text-xs text-muted">
            <li>
              <span className="font-mono text-cyan">1.</span> Approaches with zero demand are never
              selected.
            </li>
            <li>
              <span className="font-mono text-cyan">2.</span> Any approach waiting at least{" "}
              {decision?.max_wait_limit ?? 45} s is served regardless of demand.
            </li>
            <li>
              <span className="font-mono text-cyan">3.</span> Otherwise the highest weighted demand
              wins.
            </li>
            <li>
              <span className="font-mono text-cyan">4.</span> Ties rotate from the last served
              approach, so equal lanes alternate.
            </li>
            <li>
              <span className="font-mono text-cyan">5.</span> Green time is
              half the minimum plus the clearance time, clamped to [{greenLow}, {greenHigh}] s.
            </li>
          </ol>
          <div className="mt-4">
            <Note tone="warn">
              Demand comes from a single frame, so waiting time is only available in the simulator
              where queue history exists. Here it is an input you control.
            </Note>
          </div>
        </Card>
      </div>

      <Card
        title="What-if scenario"
        subtitle="Adjust weighted demand and waiting time per approach, then recompute."
        action={
          <button type="button" className="btn-ghost" onClick={loadStarvationScenario}>
            Load fairness scenario
          </button>
        }
      >
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-4">
            <p className="label">Weighted demand (vehicle units)</p>
            {APPROACHES.map((lane) => (
              <div key={lane}>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-ink">{lane}</span>
                  <span className="font-mono text-muted">{number(demand[lane])}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={40}
                  step={0.5}
                  value={demand[lane]}
                  onChange={(event) =>
                    setDemand((current) => ({ ...current, [lane]: Number(event.target.value) }))
                  }
                  className="mt-1 w-full"
                  aria-label={`${lane} demand`}
                />
              </div>
            ))}
          </div>

          <div className="space-y-4">
            <p className="label">Waiting time since last green (seconds)</p>
            {APPROACHES.map((lane) => (
              <div key={lane}>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-ink">{lane}</span>
                  <span className="font-mono text-muted">{number(waits[lane], 0)} s</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={120}
                  step={1}
                  value={waits[lane]}
                  onChange={(event) =>
                    setWaits((current) => ({ ...current, [lane]: Number(event.target.value) }))
                  }
                  className="mt-1 w-full"
                  aria-label={`${lane} waiting time`}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="btn-primary" onClick={compute} disabled={pending}>
            {pending ? "Computing…" : "Compute recommendation"}
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              setDemand(EMPTY_DEMAND);
              setWaits(EMPTY_DEMAND);
              setSource("Manual scenario");
            }}
          >
            Clear
          </button>
        </div>
      </Card>
    </div>
  );
}
