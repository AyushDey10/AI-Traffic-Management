import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AXIS, ChartTooltip, LANE_COLOURS, Legend, SERIES_COLOURS } from "../components/charts";
import { Card, Note, PageHeader, Spinner, Stat } from "../components/ui";
import { APPROACHES, api, type CompareResult, type SeedSweep } from "../lib/api";
import { number } from "../lib/format";
import { errorMessage } from "../lib/TrafficContext";

function delta(adaptive: number, fixed: number, invert = true) {
  const difference = adaptive - fixed;
  const sign = difference > 0 ? "+" : "";
  const tone = difference === 0 ? "text-muted" : (difference < 0) === invert ? "text-success" : "text-danger";
  return <span className={tone}>{`${sign}${difference.toFixed(1)}`}</span>;
}

export default function Simulation() {
  const [duration, setDuration] = useState(600);
  const [seed, setSeed] = useState(42);
  const [compare, setCompare] = useState<CompareResult | null>(null);
  const [sweep, setSweep] = useState<SeedSweep | null>(null);
  const [busy, setBusy] = useState<"compare" | "sweep" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runCompare = async () => {
    setBusy("compare");
    setError(null);
    try {
      setCompare(await api.compare({ duration, seed }));
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(null);
    }
  };

  const runSweep = async () => {
    setBusy("sweep");
    setError(null);
    try {
      setSweep(await api.sweepSeeds({ duration, seeds: Array.from({ length: 10 }, (_, i) => i) }));
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(null);
    }
  };

  const queueSeries =
    compare?.fixed_time.timeseries.t.map((time, index) => ({
      time,
      fixed: compare.fixed_time.timeseries.total[index],
      adaptive: compare.adaptive.timeseries.total[index],
    })) ?? [];

  const waitByLane = compare
    ? APPROACHES.map((lane) => ({
        lane,
        fixed: compare.fixed_time.per_lane[lane].average_wait_seconds,
        adaptive: compare.adaptive.per_lane[lane].average_wait_seconds,
      }))
    : [];

  const fixed = compare?.fixed_time;
  const adaptive = compare?.adaptive;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Traffic Simulation"
        description="Same arrivals, same seed, two control strategies. Every number below is produced by the project's queueing model — it is synthetic traffic, not a measurement."
      />

      <Card title="Simulation controls" subtitle="Both strategies receive identical arrival sequences.">
        <div className="grid gap-5 sm:grid-cols-3">
          <div>
            <div className="flex items-center justify-between text-xs">
              <label htmlFor="duration">Duration</label>
              <span className="font-mono text-ink">{duration} s</span>
            </div>
            <input
              id="duration"
              type="range"
              min={120}
              max={1200}
              step={60}
              value={duration}
              onChange={(event) => setDuration(Number(event.target.value))}
              className="mt-2 w-full"
            />
          </div>
          <div>
            <label htmlFor="seed" className="label">
              Random seed
            </label>
            <input
              id="seed"
              type="number"
              min={0}
              max={9999}
              value={seed}
              onChange={(event) => setSeed(Math.max(0, Number(event.target.value) || 0))}
              className="field mt-2 w-full"
            />
          </div>
          <div className="flex items-end gap-2">
            <button
              type="button"
              className="btn-primary w-full"
              onClick={runCompare}
              disabled={busy !== null}
            >
              {busy === "compare" ? "Running…" : "Run comparison"}
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button type="button" className="btn-ghost" onClick={runSweep} disabled={busy !== null}>
            {busy === "sweep" ? "Sweeping 10 seeds…" : "Run 10-seed sweep"}
          </button>
          <span className="text-[11px] text-muted">
            Fixed-time: {compare?.fixed_time.simulation_seconds ?? duration} s cycle of 15 s green +
            3 s yellow + 1 s all-red per approach.
          </span>
        </div>

        {busy && (
          <div className="mt-4">
            <Spinner label={busy === "sweep" ? "Simulating ten seeds…" : "Simulating both strategies…"} />
          </div>
        )}
        {error && (
          <div className="mt-4">
            <Note tone="error">{error}</Note>
          </div>
        )}
      </Card>

      {fixed && adaptive && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat
              label="Vehicles served"
              value={adaptive.vehicles_served}
              hint={<>fixed {fixed.vehicles_served} · Δ {delta(adaptive.vehicles_served, fixed.vehicles_served, false)}</>}
              tone="accent"
            />
            <Stat
              label="Average wait"
              value={`${number(adaptive.average_wait_seconds)} s`}
              hint={<>fixed {number(fixed.average_wait_seconds)} s · Δ {delta(adaptive.average_wait_seconds, fixed.average_wait_seconds)}</>}
            />
            <Stat
              label="Worst-case wait"
              value={`${number(adaptive.maximum_wait_seconds, 0)} s`}
              hint={<>fixed {number(fixed.maximum_wait_seconds, 0)} s · Δ {delta(adaptive.maximum_wait_seconds, fixed.maximum_wait_seconds)}</>}
              tone={adaptive.maximum_wait_seconds > fixed.maximum_wait_seconds ? "warn" : "good"}
            />
            <Stat
              label="Still queued at end"
              value={adaptive.vehicles_remaining}
              hint={<>fixed {fixed.vehicles_remaining} · throughput {number(adaptive.throughput_per_minute)} veh/min</>}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <Card
              className="xl:col-span-2"
              title="Total queue over time"
              subtitle="Vehicles queued at every 5 s sample across all four approaches."
            >
              <div style={{ width: "100%", height: 280 }}>
                <ResponsiveContainer>
                  <LineChart data={queueSeries} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid stroke="#263750" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="time" {...AXIS} unit="s" />
                    <YAxis {...AXIS} />
                    <Tooltip content={<ChartTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="fixed"
                      name="Fixed-time"
                      stroke={SERIES_COLOURS.fixed}
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="adaptive"
                      name="Adaptive"
                      stroke={SERIES_COLOURS.adaptive}
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <Legend
                items={[
                  { label: "Fixed-time", colour: SERIES_COLOURS.fixed },
                  { label: "Adaptive", colour: SERIES_COLOURS.adaptive },
                ]}
              />
            </Card>

            <Card title="Average wait per approach" subtitle="Seconds, seed selected above.">
              <div style={{ width: "100%", height: 240 }}>
                <ResponsiveContainer>
                  <BarChart data={waitByLane} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid stroke="#263750" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="lane" {...AXIS} />
                    <YAxis {...AXIS} unit="s" />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(0,213,255,0.06)" }} />
                    <Bar dataKey="fixed" name="Fixed-time" fill={SERIES_COLOURS.fixed} radius={[5, 5, 0, 0]} />
                    <Bar dataKey="adaptive" name="Adaptive" fill={SERIES_COLOURS.adaptive} radius={[5, 5, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <Legend
                items={[
                  { label: "Fixed-time", colour: SERIES_COLOURS.fixed },
                  { label: "Adaptive", colour: SERIES_COLOURS.adaptive },
                ]}
              />
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card title="Per-approach results" subtitle="Fixed-time versus adaptive for the selected seed.">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/70">
                      <th className="th">Approach</th>
                      <th className="th">Served F/A</th>
                      <th className="th">Left F/A</th>
                      <th className="th">Avg wait F/A</th>
                      <th className="th">Max wait F/A</th>
                    </tr>
                  </thead>
                  <tbody>
                    {APPROACHES.map((lane) => (
                      <tr key={lane} className="border-b border-border/40 last:border-0">
                        <td className="td">
                          <span className="inline-flex items-center gap-2">
                            <span
                              className="h-2 w-2 rounded-sm"
                              style={{ background: LANE_COLOURS[lane] }}
                            />
                            {lane}
                          </span>
                        </td>
                        <td className="td font-mono">
                          {fixed.per_lane[lane].served}/{adaptive.per_lane[lane].served}
                        </td>
                        <td className="td font-mono">
                          {fixed.per_lane[lane].remaining}/{adaptive.per_lane[lane].remaining}
                        </td>
                        <td className="td font-mono">
                          {number(fixed.per_lane[lane].average_wait_seconds)}/
                          {number(adaptive.per_lane[lane].average_wait_seconds)}
                        </td>
                        <td className="td font-mono">
                          {number(fixed.per_lane[lane].maximum_wait_seconds, 0)}/
                          {number(adaptive.per_lane[lane].maximum_wait_seconds, 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-muted">
                {adaptive.wait_note} Long waits (&gt;45 s): {adaptive.long_wait_events} adaptive vs{" "}
                {fixed.long_wait_events} fixed.
              </p>
            </Card>

            <Card
              title="Adaptive decisions"
              subtitle={`First ${adaptive.decisions.length} cycles recorded in the run.`}
            >
              <div className="max-h-72 overflow-y-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/70">
                      <th className="th">Cycle</th>
                      <th className="th">Start</th>
                      <th className="th">Phase</th>
                      <th className="th">Green</th>
                      <th className="th">Rule</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adaptive.decisions.map((decision) => (
                      <tr key={decision.cycle} className="border-b border-border/40 last:border-0">
                        <td className="td font-mono">{decision.cycle}</td>
                        <td className="td font-mono">{decision.start_second}s</td>
                        <td className="td">{decision.green_lane ?? "—"}</td>
                        <td className="td font-mono">{decision.green_duration}s</td>
                        <td className="td text-xs text-muted">{decision.priority}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </>
      )}

      {sweep && (
        <Card
          title={`Ten-seed comparison (${sweep.duration} s each)`}
          subtitle="Averages across seeds 0–9 with identical demand for both strategies."
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat
              label="Adaptive lower avg wait"
              value={`${sweep.adaptive_lower_wait_seeds}/${sweep.seed_count}`}
              hint="Seeds where adaptive beat fixed-time"
              tone="good"
            />
            <Stat
              label="Mean avg wait"
              value={`${number(sweep.summary.adaptive.average_wait_seconds.mean)} s`}
              hint={`fixed ${number(sweep.summary.fixed_time.average_wait_seconds.mean)} s (σ ${number(
                sweep.summary.adaptive.average_wait_seconds.std,
              )})`}
            />
            <Stat
              label="Mean worst wait"
              value={`${number(sweep.summary.adaptive.maximum_wait_seconds.mean, 0)} s`}
              hint={`fixed ${number(sweep.summary.fixed_time.maximum_wait_seconds.mean, 0)} s`}
              tone={
                sweep.summary.adaptive.maximum_wait_seconds.mean >
                sweep.summary.fixed_time.maximum_wait_seconds.mean
                  ? "warn"
                  : "good"
              }
            />
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/70">
                  <th className="th">Seed</th>
                  <th className="th">Wait F</th>
                  <th className="th">Wait A</th>
                  <th className="th">Served F</th>
                  <th className="th">Served A</th>
                  <th className="th">Avg queue F</th>
                  <th className="th">Avg queue A</th>
                  <th className="th">Max wait F</th>
                  <th className="th">Max wait A</th>
                </tr>
              </thead>
              <tbody>
                {sweep.rows.map((row) => (
                  <tr key={row.seed} className="border-b border-border/40 last:border-0">
                    <td className="td font-mono">{row.seed}</td>
                    <td className="td font-mono">{number(row.fixed_wait)}</td>
                    <td className="td font-mono text-cyan">{number(row.adaptive_wait)}</td>
                    <td className="td font-mono">{row.fixed_served}</td>
                    <td className="td font-mono">{row.adaptive_served}</td>
                    <td className="td font-mono">{number(row.fixed_queue)}</td>
                    <td className="td font-mono">{number(row.adaptive_queue)}</td>
                    <td className="td font-mono">{number(row.fixed_max_wait, 0)}</td>
                    <td className="td font-mono">{number(row.adaptive_max_wait, 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4">
            <Note>{sweep.honesty_note}</Note>
          </div>
        </Card>
      )}

      {!fixed && !sweep && (
        <Note>
          Run a comparison to populate the charts. Results are generated by the queueing model in{" "}
          <span className="font-mono">src/simulation/traffic_simulator.py</span> — no measured road
          data is used.
        </Note>
      )}
    </div>
  );
}
