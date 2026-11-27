import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AXIS, ChartTooltip, LANE_COLOURS, Legend } from "../components/charts";
import {
  Callout,
  Card,
  Explain,
  Icon,
  LEVEL_TEXT,
  Note,
  PageHeader,
  ProgressBar,
  Spinner,
  Stat,
} from "../components/ui";
import { APPROACHES, api, type AnalysisJob, type CongestionLevel } from "../lib/api";
import { number } from "../lib/format";
import { errorMessage, useTraffic } from "../lib/TrafficContext";

const CLASS_COLOURS: Record<string, string> = {
  Car: "#00D5FF",
  Motorcycle: "#22C55E",
  Bus: "#8B5CF6",
  Truck: "#F59E0B",
};

const LEVEL_COLOURS: Record<string, string> = {
  Empty: "#334155",
  Low: "#22C55E",
  Moderate: "#F59E0B",
  High: "#EF4444",
  Severe: "#B91C1C",
};

const LEVEL_ORDER = ["Empty", "Low", "Moderate", "High", "Severe"];

export default function Analytics() {
  const { videos, videoId } = useTraffic();
  const [intervalSeconds, setIntervalSeconds] = useState(4);
  const [limit, setLimit] = useState(8);
  const [job, setJob] = useState<AnalysisJob | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A report belongs to the video that was selected when it started.
  useEffect(() => {
    setJob(null);
    setError(null);
  }, [videoId]);

  const start = async () => {
    if (!videoId) return;
    setStarting(true);
    setError(null);
    try {
      const created = await api.startJob({
        video_id: videoId,
        interval_seconds: intervalSeconds,
        limit,
      });
      setJob(await api.job(created.job_id));
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setStarting(false);
    }
  };

  useEffect(() => {
    if (!job || job.status === "completed" || job.status === "failed") return;

    const timer = setTimeout(async () => {
      try {
        setJob(await api.job(job.job_id));
      } catch (cause) {
        setError(errorMessage(cause));
      }
    }, 900);

    return () => clearTimeout(timer);
  }, [job]);

  const result = job?.result ?? null;
  const summary = result?.summary;

  const trend =
    result?.samples.map((sample) => ({
      time: sample.timestamp,
      North: sample.lanes.North,
      South: sample.lanes.South,
      East: sample.lanes.East,
      West: sample.lanes.West,
      unassigned: sample.unassigned,
    })) ?? [];

  const classData = summary
    ? Object.entries(summary.class_totals)
        .filter(([, count]) => count > 0)
        .map(([name, count]) => ({ name, value: count }))
    : [];

  const levelData = summary
    ? LEVEL_ORDER.filter((level) => (summary.congestion_counts[level] ?? 0) > 0).map((level) => ({
        level,
        label: LEVEL_TEXT[level as CongestionLevel] ?? level,
        count: summary.congestion_counts[level] ?? 0,
      }))
    : [];

  const selectedVideo = videos.find((video) => video.id === videoId);
  const running = starting || job?.status === "running" || job?.status === "queued";

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Traffic report"
        title="What happens across the whole video?"
        description="Instead of one picture, the AI checks several moments spread across the video and puts the results into one simple report."
      />

      <Callout icon="analytics" title="How this works">
        The AI checks one picture every few seconds. The report adds those pictures together, so you
        can see how traffic changes — for example, more vehicles near the end of the video.
      </Callout>

      {error && <Note tone="error">{error}</Note>}

      <Card
        title="Build a traffic report"
        subtitle="Choose how often the AI should look, and how many pictures it should check."
        action={
          <button type="button" className="btn-primary" onClick={start} disabled={running || !videoId}>
            <Icon name="play" className="h-4 w-4" />
            {running ? "Building report…" : "Start traffic report"}
          </button>
        }
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="interval" className="mb-1.5 block text-xs font-medium text-ink">
              Check one picture every…
            </label>
            <select
              id="interval"
              className="field w-full"
              value={intervalSeconds}
              onChange={(event) => setIntervalSeconds(Number(event.target.value))}
            >
              {[2, 4, 5, 8, 10].map((value) => (
                <option key={value} value={value}>
                  {value} seconds
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-muted">
              A shorter gap gives a more detailed report but takes a little longer.
            </p>
          </div>
          <div>
            <div className="flex items-center justify-between text-xs">
              <label htmlFor="samples">How many pictures?</label>
              <span className="font-mono text-ink">{limit}</span>
            </div>
            <input
              id="samples"
              type="range"
              min={2}
              max={16}
              value={limit}
              onChange={(event) => setLimit(Number(event.target.value))}
              className="mt-2 w-full"
            />
            <p className="mt-1 text-[11px] text-muted">
              {limit} pictures, spread {intervalSeconds} seconds apart.
            </p>
          </div>
        </div>

        {job && (
          <div className="mt-5 space-y-2 rounded-xl border border-border/70 bg-panel/40 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted">
              <span>
                Checked <span className="font-mono text-ink">{job.progress}</span> of{" "}
                <span className="font-mono text-ink">{job.total}</span> pictures
              </span>
              <span className="font-mono">{job.status}</span>
            </div>
            <ProgressBar value={(job.progress / Math.max(1, job.total)) * 100} />
            {(job.status === "running" || job.status === "queued") && (
              <Spinner label="The AI is checking the pictures one at a time. You can stay on this page." />
            )}
            {job.status === "failed" && <Note tone="error">{job.error}</Note>}
          </div>
        )}

        {!job && (
          <p className="mt-3 text-[11px] text-muted">
            This will check {limit} pictures of{" "}
            {selectedVideo?.filename ?? "the selected video"}, {intervalSeconds} seconds apart.
          </p>
        )}
      </Card>

      {summary && result && (
        <>
          <section aria-labelledby="report-summary">
            <h2 id="report-summary" className="mb-3 text-lg font-semibold text-ink">
              Report summary
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Stat
                label="Pictures checked"
                value={summary.samples}
                hint={`One picture every ${summary.interval_seconds} seconds.`}
              />
              <Stat
                label="Vehicles per picture"
                value={number(summary.mean_detections_per_sampled_frame)}
                hint="The average number of vehicles the AI found in one picture."
                tone="accent"
              />
              <Stat
                label="Busiest picture"
                value={summary.max_detections}
                hint={`The most vehicles were found at ${number(summary.peak_timestamp, 1)} s.`}
              />
              <Stat
                label="AI time per picture"
                value={`${number(summary.mean_processing_ms, 0)} ms`}
                hint={`Running on the CPU at ${result.settings.image_size} px.`}
              />
            </div>
          </section>

          <div className="grid gap-4 xl:grid-cols-3">
            <Card
              className="xl:col-span-2"
              title="Vehicles found at each moment"
              subtitle="Each bar is one picture. The colours show which road the vehicles were on."
            >
              <div style={{ width: "100%", height: 280 }}>
                <ResponsiveContainer>
                  <BarChart data={trend} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid stroke="#263750" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="time" {...AXIS} unit="s" />
                    <YAxis {...AXIS} allowDecimals={false} />
                    <Tooltip
                      content={<ChartTooltip />}
                      cursor={{ fill: "rgba(0,213,255,0.06)" }}
                    />
                    {APPROACHES.map((lane) => (
                      <Bar
                        key={lane}
                        dataKey={lane}
                        name={lane}
                        stackId="detections"
                        fill={LANE_COLOURS[lane]}
                      />
                    ))}
                    <Bar dataKey="unassigned" name="Outside the roads" stackId="detections" fill="#475569" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <Legend
                items={[
                  ...APPROACHES.map((lane) => ({ label: lane, colour: LANE_COLOURS[lane] })),
                  { label: "Outside the roads", colour: "#475569" },
                ]}
              />
            </Card>

            <Card title="Types of vehicles found" subtitle="Added up over all the pictures in the report.">
              {classData.length ? (
                <>
                  <div style={{ width: "100%", height: 200 }}>
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie
                          data={classData}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={2}
                          stroke="#101827"
                        >
                          {classData.map((entry) => (
                            <Cell key={entry.name} fill={CLASS_COLOURS[entry.name] ?? "#64748B"} />
                          ))}
                        </Pie>
                        <Tooltip content={<ChartTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <Legend
                    items={classData.map((entry) => ({
                      label: `${entry.name} (${entry.value})`,
                      colour: CLASS_COLOURS[entry.name] ?? "#64748B",
                    }))}
                  />
                </>
              ) : (
                <p className="text-sm text-muted">No vehicles were found in the checked pictures.</p>
              )}
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <Card
              title="How busy the roads were"
              subtitle="Each time a road was checked, it got a label. This chart counts the labels."
            >
              <div style={{ width: "100%", height: 220 }}>
                <ResponsiveContainer>
                  <BarChart data={levelData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid stroke="#263750" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" {...AXIS} tick={{ fontSize: 10 }} />
                    <YAxis {...AXIS} allowDecimals={false} />
                    <Tooltip
                      content={<ChartTooltip />}
                      cursor={{ fill: "rgba(0,213,255,0.06)" }}
                    />
                    <Bar dataKey="count" name="Times seen" radius={[5, 5, 0, 0]}>
                      {levelData.map((entry) => (
                        <Cell key={entry.level} fill={LEVEL_COLOURS[entry.level] ?? "#64748B"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted">
                “No vehicles” and “Light traffic” are quiet roads. “Very busy” and “Heavy jam” mean that
                road needed more green time.
              </p>
            </Card>

            <Card
              className="xl:col-span-2"
              title="Which road had the most traffic?"
              subtitle="Total vehicles found on each road across all the checked pictures."
            >
              <ul className="space-y-4">
                {APPROACHES.map((lane) => {
                  const total = summary.approach_totals[lane];
                  const max = Math.max(1, ...APPROACHES.map((key) => summary.approach_totals[key]));
                  return (
                    <li key={lane}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="inline-flex items-center gap-2 text-ink">
                          <span
                            className="h-2.5 w-2.5 rounded-sm"
                            style={{ background: LANE_COLOURS[lane] }}
                          />
                          {lane}
                        </span>
                        <span className="font-mono text-muted">{total} vehicles</span>
                      </div>
                      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-border/60">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${(total / max) * 100}%`, background: LANE_COLOURS[lane] }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-4">
                <Note>{summary.note}</Note>
              </div>
            </Card>
          </div>

          <Card
            title="Every picture the AI checked"
            subtitle="N, S, E and W mean North, South, East and West. “Phase” is the road the system would give green to."
          >
            <div className="max-h-96 overflow-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/70">
                    <th className="th">Moment</th>
                    <th className="th">Total</th>
                    <th className="th">N</th>
                    <th className="th">S</th>
                    <th className="th">E</th>
                    <th className="th">W</th>
                    <th className="th">Phase</th>
                    <th className="th">Green</th>
                    <th className="th">AI time</th>
                  </tr>
                </thead>
                <tbody>
                  {result.samples.map((sample) => (
                    <tr key={sample.timestamp} className="border-b border-border/40 last:border-0">
                      <td className="td font-mono">{number(sample.timestamp, 1)}s</td>
                      <td className="td font-mono">{sample.total}</td>
                      <td className="td font-mono">{sample.lanes.North}</td>
                      <td className="td font-mono">{sample.lanes.South}</td>
                      <td className="td font-mono">{sample.lanes.East}</td>
                      <td className="td font-mono">{sample.lanes.West}</td>
                      <td className="td">{sample.signal.green_lane ?? "—"}</td>
                      <td className="td font-mono">{sample.signal.green_duration}s</td>
                      <td className="td font-mono text-muted">{number(sample.processing_ms, 0)} ms</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3">
              <Explain summary="Why is this not a count of different cars?">
                <p>
                  The AI looks at separate pictures. It does not remember a car from one picture to the
                  next, so the same car can be counted again. The report tells you how many vehicles
                  were <strong>seen per picture</strong>, not how many different vehicles passed.
                </p>
              </Explain>
            </div>
          </Card>
        </>
      )}

      {!summary && !job && (
        <Card title="No report yet" subtitle="Press “Start traffic report” above.">
          <p className="text-sm text-muted">
            The report will show how many vehicles were found at different moments, which road had the
            most traffic, and which types of vehicles appeared.
          </p>
        </Card>
      )}
    </div>
  );
}
