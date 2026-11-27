import { useEffect, useState } from "react";
import { APPROACHES, api, type Approach, type SignalDecision } from "../lib/api";
import { Callout, Card, Explain, Icon, Note, PageHeader, Spinner } from "../components/ui";
import { number } from "../lib/format";
import { errorMessage } from "../lib/TrafficContext";
import { useTraffic } from "../lib/TrafficContext";

const EMPTY_DEMAND: Record<Approach, number> = { North: 0, South: 0, East: 0, West: 0 };

const PRIORITY_LABEL: Record<string, string> = {
  max_demand: "Busiest road first",
  max_wait: "Longest wait first",
  none: "No green light needed",
  fixed_rotation: "Taking turns",
};

const PRIORITY_HELP: Record<string, string> = {
  max_demand: "This road has the most vehicles waiting, so it gets the next turn.",
  max_wait: "This road has been waiting a long time, so fairness gives it the next turn.",
  none: "No road has vehicles waiting.",
  fixed_rotation: "Every road simply takes the next turn, like an old fixed timer.",
};

export default function Signals() {
  const { snapshot } = useTraffic();
  const [demand, setDemand] = useState<Record<Approach, number>>(EMPTY_DEMAND);
  const [waits, setWaits] = useState<Record<Approach, number>>(EMPTY_DEMAND);
  const [decision, setDecision] = useState<SignalDecision | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState("Your own numbers");

  const applySnapshot = () => {
    if (!snapshot) return;
    const next = { ...EMPTY_DEMAND };
    snapshot.lanes.forEach((lane) => {
      next[lane.name] = lane.weighted_demand;
    });
    setDemand(next);
    setWaits({ ...EMPTY_DEMAND });
    setSource(`The picture at ${number(snapshot.timestamp, 1)} s`);
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
    setSource("Fairness example: South has been waiting 62 seconds");
  };

  const greenLow = decision?.green_bounds?.[0] ?? 12;
  const greenHigh = decision?.green_bounds?.[1] ?? 45;
  const serviceRate = decision?.service_rate ?? 1.5;
  const requiredGreen = decision ? Math.ceil(decision.demand / serviceRate) : 0;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Smart signal"
        title="Which road should get the green light?"
        description="The system looks at how many vehicles are waiting on each road and how long each road has waited, then suggests the next green light."
      >
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-panel/70 px-3 py-1 text-[11px] text-muted">
          <Icon name="road" className="h-3.5 w-3.5" />
          Numbers from: {source}
        </span>
      </PageHeader>

      <Callout icon="signals" title="This is a suggestion, not a real traffic light">
        The project calculates what a smart signal <em>could</em> do. It is not connected to any road,
        and it never switches a real light.
      </Callout>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card
          className="xl:col-span-2"
          title="The recommendation"
          subtitle="Based on the traffic numbers you see below."
          action={
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-ghost" onClick={applySnapshot} disabled={!snapshot}>
                Use current picture
              </button>
              <button type="button" className="btn-primary" onClick={compute} disabled={pending}>
                {pending ? "Working…" : "Update suggestion"}
              </button>
            </div>
          }
        >
          {pending && <Spinner label="Checking the traffic rules…" />}
          {error && <Note tone="error">{error}</Note>}

          {decision && !pending && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-4">
                <div className="grid h-24 w-24 place-items-center rounded-full border-2 border-cyan/40 bg-cyan/10">
                  <span className="text-center font-mono text-xl font-semibold leading-tight text-cyan">
                    {decision.green_lane ?? "—"}
                  </span>
                </div>
                <div>
                  <p className="text-4xl font-semibold text-ink">
                    {decision.green_duration}
                    <span className="ml-1 text-base font-normal text-muted">{" "}seconds of green</span>
                  </p>
                  <p className="mt-1 text-[13px] text-muted">
                    {PRIORITY_LABEL[decision.priority] ?? decision.priority} ·{" "}
                    {number(decision.demand)} vehicle units · waited{" "}
                    {number(decision.waiting_seconds, 0)} s
                  </p>
                </div>
                <span className="ml-auto rounded-full border border-border px-2.5 py-0.5 text-[11px] text-muted">
                  turn #{decision.cycle}
                </span>
              </div>

              <div className="rounded-xl border border-cyan/25 bg-cyan/5 p-3">
                <p className="text-sm font-medium text-ink">Why this road?</p>
                <p className="mt-1 text-[13px] leading-relaxed text-muted">
                  {PRIORITY_HELP[decision.priority] ?? decision.reason}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-muted">{decision.reason}</p>
              </div>

              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
                  What happens next
                </p>
                <div className="flex h-10 overflow-hidden rounded-lg border border-border">
                  <div
                    className="flex items-center justify-center bg-cyan/20 text-[11px] text-cyan"
                    style={{ flexGrow: decision.green_duration }}
                  >
                    green {decision.green_duration} s
                  </div>
                  <div
                    className="flex items-center justify-center bg-warning/20 text-[11px] text-warning"
                    style={{ flexGrow: decision.yellow_duration }}
                  >
                    yellow {decision.yellow_duration} s
                  </div>
                  <div
                    className="flex items-center justify-center bg-danger/20 text-[11px] text-danger"
                    style={{ flexGrow: decision.all_red_duration }}
                  >
                    all red {decision.all_red_duration} s
                  </div>
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-muted">
                  Yellow warns drivers to stop. “All red” gives everyone a short moment to clear the
                  crossing safely.
                </p>
              </div>

              <dl className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-border/70 bg-panel/40 p-3">
                  <dt className="text-[11px] uppercase tracking-[0.12em] text-muted">Time to clear</dt>
                  <dd className="mt-1 font-mono text-sm text-ink">
                    {number(decision.demand)} ÷ {serviceRate} ={" "}
                    {number(decision.demand / serviceRate)} s
                  </dd>
                  <p className="mt-1 text-[11px] text-muted">Vehicles divided by how fast one road clears.</p>
                </div>
                <div className="rounded-xl border border-border/70 bg-panel/40 p-3">
                  <dt className="text-[11px] uppercase tracking-[0.12em] text-muted">Allowed range</dt>
                  <dd className="mt-1 font-mono text-sm text-ink">
                    {greenLow}–{greenHigh} s
                  </dd>
                  <p className="mt-1 text-[11px] text-muted">
                    Never shorter than {greenLow} s, never longer than {greenHigh} s.
                  </p>
                </div>
                <div className="rounded-xl border border-border/70 bg-panel/40 p-3">
                  <dt className="text-[11px] uppercase tracking-[0.12em] text-muted">Can clear</dt>
                  <dd className="mt-1 font-mono text-sm text-ink">
                    {number(decision.expected_cleared_units)} units
                  </dd>
                  <p className="mt-1 text-[11px] text-muted">
                    The exact time needed was {requiredGreen} s before the safety limits were applied.
                  </p>
                </div>
              </dl>

              <Explain summary="Show technical details">
                <dl className="grid grid-cols-2 gap-2">
                  <div>
                    <dt>Priority rule</dt>
                    <dd className="font-mono text-ink">{decision.priority}</dd>
                  </div>
                  <div>
                    <dt>Demand served</dt>
                    <dd className="font-mono text-ink">{number(decision.demand)} units</dd>
                  </div>
                  <div>
                    <dt>Waiting time used</dt>
                    <dd className="font-mono text-ink">{number(decision.waiting_seconds, 0)} s</dd>
                  </div>
                  <div>
                    <dt>Cycle number</dt>
                    <dd className="font-mono text-ink">#{decision.cycle}</dd>
                  </div>
                </dl>
              </Explain>
            </div>
          )}

          {!decision && !pending && (
            <p className="text-sm text-muted">
              No suggestion yet. Set some traffic numbers below and press “Update suggestion”.
            </p>
          )}
        </Card>

        <Card title="How the choice is made" subtitle="Five simple rules, checked in this order.">
          <ol className="space-y-3 text-[13px] text-muted">
            <li className="flex gap-2">
              <span className="font-mono text-cyan">1.</span>
              <span>A road with <span className="text-ink">no vehicles</span> is never chosen.</span>
            </li>
            <li className="flex gap-2">
              <span className="font-mono text-cyan">2.</span>
              <span>
                If a road has waited <span className="text-ink">{decision?.max_wait_limit ?? 45} seconds</span>{" "}
                or more, it goes next — even if another road has more vehicles.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="font-mono text-cyan">3.</span>
              <span>Otherwise, the road with the <span className="text-ink">most vehicles</span> goes next.</span>
            </li>
            <li className="flex gap-2">
              <span className="font-mono text-cyan">4.</span>
              <span>If two roads are equal, they take turns instead of one always winning.</span>
            </li>
            <li className="flex gap-2">
              <span className="font-mono text-cyan">5.</span>
              <span>
                Green time is based on traffic, then kept between{" "}
                <span className="text-ink">
                  {greenLow} and {greenHigh} seconds
                </span>
                .
              </span>
            </li>
          </ol>
          <div className="mt-4">
            <Explain summary="Why is fairness important?">
              <p>
                Imagine waiting at a crossing for three minutes while the other road keeps going. People
                get impatient and start crossing on red, which is dangerous. The{" "}
                <strong>45-second rule</strong> makes sure every road gets a turn, even if it has fewer
                vehicles.
              </p>
            </Explain>
          </div>
          <div className="mt-3">
            <Note tone="warn">
              A picture can show how many vehicles are waiting, but not how long they have waited.
              Waiting time is something you set here, or something the simulation keeps track of.
            </Note>
          </div>
        </Card>
      </div>

      <Card
        title="Try your own traffic situation"
        subtitle="Move the sliders to change how many vehicles are on each road and how long each road has waited. Then update the suggestion."
        action={
          <button type="button" className="btn-ghost" onClick={loadStarvationScenario}>
            <Icon name="bulb" className="h-4 w-4" />
            Load fairness example
          </button>
        }
      >
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-ink">How many vehicles are waiting?</p>
              <p className="text-xs text-muted">
                Measured in <span className="text-ink">vehicle units</span>: a car is 1, a motorcycle
                0.6, a bus or truck 1.6.
              </p>
            </div>
            {APPROACHES.map((lane) => (
              <div key={lane}>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-ink">{lane}</span>
                  <span className="font-mono text-muted">{number(demand[lane])} units</span>
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
                  aria-label={`${lane} traffic in vehicle units`}
                />
              </div>
            ))}
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-ink">How long has each road waited?</p>
              <p className="text-xs text-muted">
                Seconds since that road last had a green light. Above 45 seconds, fairness kicks in.
              </p>
            </div>
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
                  aria-label={`${lane} waiting time in seconds`}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" className="btn-primary" onClick={compute} disabled={pending}>
            <Icon name="check" className="h-4 w-4" />
            {pending ? "Working…" : "Update suggestion"}
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              setDemand(EMPTY_DEMAND);
              setWaits(EMPTY_DEMAND);
              setSource("Your own numbers");
            }}
          >
            Clear all
          </button>
        </div>
      </Card>
    </div>
  );
}
