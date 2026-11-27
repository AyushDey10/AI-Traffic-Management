import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AXIS, ChartTooltip, LANE_COLOURS, Legend, SERIES_COLOURS } from "../components/charts";
import { Callout, Card, Explain, Icon, Note, PageHeader, Spinner, Stat } from "../components/ui";
import { APPROACHES, api, type CompareResult, type SeedSweep } from "../lib/api";
import { number } from "../lib/format";
import { errorMessage } from "../lib/TrafficContext";

function delta(adaptive: number, fixed: number, invert = true) {
  const difference = adaptive - fixed;
  const sign = difference > 0 ? "+" : "";
  const tone =
    difference === 0 ? "text-muted" : (difference < 0) === invert ? "text-success" : "text-danger";
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
        eyebrow="Fair test"
        title="Old timer vs smart signal"
        description="We create pretend traffic, then send exactly the same vehicles to two different signals. The only thing that changes is how the green light is chosen."
      />

      <Callout icon="simulation" title="These results are simulated">
        No real road was measured. The numbers come from the project's own mathematical traffic model.
        The same vehicles are used for both signals, so the comparison is fair.
      </Callout>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-violet/30 bg-violet/5 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-ink">
            <span className="h-2.5 w-2.5 rounded-sm bg-violet" />
            Old fixed timer
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-muted">
            Gives every road <span className="text-ink">15 seconds</span> of green, one after another,
            all day. Simple and safe — but it cannot see whether a road is empty or full.
          </p>
        </div>
        <div className="rounded-xl border border-cyan/30 bg-cyan/5 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-ink">
            <span className="h-2.5 w-2.5 rounded-sm bg-cyan" />
            Smart signal (this project)
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-muted">
            Gives green to the busiest road, or to a road that has waited more than 45 seconds. Green
            time changes with the traffic, between 12 and 45 seconds.
          </p>
        </div>
      </div>

      <Card
        title="Set up the test"
        subtitle="Both signals get exactly the same vehicles. Only the signal changes."
        action={
          <button type="button" className="btn-primary" onClick={runCompare} disabled={busy !== null}>
            <Icon name="play" className="h-4 w-4" />
            {busy === "compare" ? "Running…" : "Run comparison"}
          </button>
        }
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <div className="flex items-center justify-between text-xs">
              <label htmlFor="duration">How long should the test run?</label>
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
            <p className="mt-1 text-[11px] text-muted">
              {duration} seconds of pretend traffic — about {Math.round(duration / 60)} minutes.
            </p>
          </div>
          <div>
            <label htmlFor="seed" className="mb-1.5 block text-xs font-medium text-ink">
              Traffic pattern number
            </label>
            <input
              id="seed"
              type="number"
              min={0}
              max={9999}
              value={seed}
              onChange={(event) => setSeed(Math.max(0, Number(event.target.value) || 0))}
              className="field w-full"
            />
            <p className="mt-1 text-[11px] text-muted">
              A different number makes a different pretend traffic pattern. Both signals always get
              the same pattern.
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" className="btn-ghost" onClick={runSweep} disabled={busy !== null}>
            {busy === "sweep" ? "Testing 10 patterns…" : "Test 10 different patterns"}
          </button>
          <span className="text-[11px] leading-relaxed text-muted">
            Runs the same comparison ten times with different traffic patterns, to check the result is
            not just luck.
          </span>
        </div>

        {busy && (
          <div className="mt-4">
            <Spinner
              label={busy === "sweep" ? "Simulating ten traffic patterns…" : "Simulating both signals…"}
            />
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
          <section aria-labelledby="sim-results">
            <h2 id="sim-results" className="mb-3 text-lg font-semibold text-ink">
              What happened
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Stat
                label="Vehicles that got through"
                value={adaptive.vehicles_served}
                hint={
                  <>
                    Old timer let {fixed.vehicles_served} through · difference{" "}
                    {delta(adaptive.vehicles_served, fixed.vehicles_served, false)}
                  </>
                }
                tone="accent"
              />
              <Stat
                label="Average waiting time"
                value={`${number(adaptive.average_wait_seconds)} s`}
                hint={
                  <>
                    Old timer {number(fixed.average_wait_seconds)} s · difference{" "}
                    {delta(adaptive.average_wait_seconds, fixed.average_wait_seconds)}
                  </>
                }
              />
              <Stat
                label="Longest wait"
                value={`${number(adaptive.maximum_wait_seconds, 0)} s`}
                hint={
                  <>
                    Old timer {number(fixed.maximum_wait_seconds, 0)} s · difference{" "}
                    {delta(adaptive.maximum_wait_seconds, fixed.maximum_wait_seconds)}
                  </>
                }
                tone={adaptive.maximum_wait_seconds > fixed.maximum_wait_seconds ? "warn" : "good"}
              />
              <Stat
                label="Still waiting at the end"
                value={adaptive.vehicles_remaining}
                hint={
                  <>
                    Old timer {fixed.vehicles_remaining} · {number(adaptive.throughput_per_minute)}{" "}
                    vehicles per minute
                  </>
                }
              />
            </div>
          </section>

          <div className="grid gap-4 xl:grid-cols-3">
            <Card
              className="xl:col-span-2"
              title="How many vehicles were waiting over time?"
              subtitle="The line goes up when a queue is growing and down when vehicles get through."
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
                      name="Old fixed timer"
                      stroke={SERIES_COLOURS.fixed}
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="adaptive"
                      name="Smart signal"
                      stroke={SERIES_COLOURS.adaptive}
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <Legend
                items={[
                  { label: "Old fixed timer", colour: SERIES_COLOURS.fixed },
                  { label: "Smart signal", colour: SERIES_COLOURS.adaptive },
                ]}
              />
              <p className="mt-2 text-xs leading-relaxed text-muted">
                Lower is better: a lower line means fewer vehicles were stuck waiting.
              </p>
            </Card>

            <Card
              title="Average wait on each road"
              subtitle="How long a vehicle waited, on average, on each road."
            >
              <div style={{ width: "100%", height: 240 }}>
                <ResponsiveContainer>
                  <BarChart data={waitByLane} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid stroke="#263750" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="lane" {...AXIS} />
                    <YAxis {...AXIS} unit="s" />
                    <Tooltip
                      content={<ChartTooltip />}
                      cursor={{ fill: "rgba(0,213,255,0.06)" }}
                    />
                    <Bar dataKey="fixed" name="Old fixed timer" fill={SERIES_COLOURS.fixed} radius={[5, 5, 0, 0]} />
                    <Bar dataKey="adaptive" name="Smart signal" fill={SERIES_COLOURS.adaptive} radius={[5, 5, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <Legend
                items={[
                  { label: "Old fixed timer", colour: SERIES_COLOURS.fixed },
                  { label: "Smart signal", colour: SERIES_COLOURS.adaptive },
                ]}
              />
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card
              title="Results for each road"
              subtitle="F = old fixed timer, A = smart signal (adaptive)."
            >
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/70">
                      <th className="th">Road</th>
                      <th className="th">Got through F/A</th>
                      <th className="th">Left F/A</th>
                      <th className="th">Avg wait F/A</th>
                      <th className="th">Longest F/A</th>
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
                {adaptive.wait_note} Long waits (over 45 s): {adaptive.long_wait_events} with the smart
                signal vs {fixed.long_wait_events} with the old timer.
              </p>
            </Card>

            <Card
              title="What the smart signal decided"
              subtitle={`The first ${adaptive.decisions.length} turns in this test.`}
            >
              <div className="max-h-72 overflow-y-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/70">
                      <th className="th">Turn</th>
                      <th className="th">Starts at</th>
                      <th className="th">Green road</th>
                      <th className="th">Green time</th>
                      <th className="th">Why</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adaptive.decisions.map((decision) => (
                      <tr key={decision.cycle} className="border-b border-border/40 last:border-0">
                        <td className="td font-mono">{decision.cycle}</td>
                        <td className="td font-mono">{decision.start_second}s</td>
                        <td className="td">{decision.green_lane ?? "—"}</td>
                        <td className="td font-mono">{decision.green_duration}s</td>
                        <td className="td text-xs text-muted">
                          {decision.priority === "max_wait" ? "Longest wait" : "Busiest road"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          <Explain summary="How is this simulation calculated?">
            <p>
              Vehicles arrive on each road at fixed average rates. A green road can clear about 1.5
              vehicle units every second. The model moves the pretend traffic forward in time and counts
              how long every vehicle waits. Both signals receive exactly the same arrivals and the same
              random seed, so the comparison is fair.
            </p>
          </Explain>
        </>
      )}

      {sweep && (
        <Card
          title="Ten different traffic patterns"
          subtitle={`Each pattern ran for ${sweep.duration} seconds. Averages across the ten tests.`}
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat
              label="Patterns where smart was faster"
              value={`${sweep.adaptive_lower_wait_seeds}/${sweep.seed_count}`}
              hint="Number of traffic patterns where the smart signal had a lower average wait."
              tone="good"
            />
            <Stat
              label="Average wait across patterns"
              value={`${number(sweep.summary.adaptive.average_wait_seconds.mean)} s`}
              hint={`Old timer ${number(sweep.summary.fixed_time.average_wait_seconds.mean)} s`}
            />
            <Stat
              label="Average longest wait"
              value={`${number(sweep.summary.adaptive.maximum_wait_seconds.mean, 0)} s`}
              hint={`Old timer ${number(sweep.summary.fixed_time.maximum_wait_seconds.mean, 0)} s`}
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
                  <th className="th">Pattern</th>
                  <th className="th">Wait F</th>
                  <th className="th">Wait A</th>
                  <th className="th">Through F</th>
                  <th className="th">Through A</th>
                  <th className="th">Queue F</th>
                  <th className="th">Queue A</th>
                  <th className="th">Longest F</th>
                  <th className="th">Longest A</th>
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
        <Card title="No test run yet" subtitle="Press “Run comparison” above.">
          <p className="text-sm text-muted">
            You will see how many vehicles got through, how long they waited, and a chart that shows
            the queue growing and shrinking for both signals.
          </p>
        </Card>
      )}
    </div>
  );
}
