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
import { Card, Note, PageHeader, ProgressBar, Spinner, Stat } from "../components/ui";
import { APPROACHES, api, type AnalysisJob } from "../lib/api";
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

export default function Analytics() {
  const { videos, videoId } = useTraffic();
  const [intervalSeconds, setIntervalSeconds] = useState(4);
  const [limit, setLimit] = useState(8);
  const [job, setJob] = useState<AnalysisJob | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    ? Object.entries(summary.congestion_counts).map(([level, count]) => ({ level, count }))
    : [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Analytics &amp; Reports"
        description="Scan several timestamps of the recording and summarise what the detector saw. Counts are summed per sampled frame, not unique vehicles."
      />

      {error && <Note tone="error">{error}</Note>}

      <Card title="Scan configuration" subtitle="Each sample is a full-resolution detection pass.">
        <div className="grid gap-5 sm:grid-cols-3">
          <div>
            <label htmlFor="interval" className="label">
              Sample interval
            </label>
            <select
              id="interval"
              className="field mt-2 w-full"
              value={intervalSeconds}
              onChange={(event) => setIntervalSeconds(Number(event.target.value))}
            >
              {[2, 4, 5, 8, 10].map((value) => (
                <option key={value} value={value}>
                  every {value} s
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className="flex items-center justify-between text-xs">
              <label htmlFor="samples">Samples</label>
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
          </div>
          <div className="flex items-end">
            <button
              type="button"
              className="btn-primary w-full"
              onClick={start}
              disabled={starting || job?.status === "running" || job?.status === "queued"}
            >
              {starting || job?.status === "running" ? "Scanning…" : "Run scan"}
            </button>
          </div>
        </div>

        {job && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-[11px] text-muted">
              <span>
                Job <span className="font-mono text-ink">{job.job_id}</span> · {job.status}
              </span>
              <span className="font-mono">
                {job.progress}/{job.total}
              </span>
            </div>
            <ProgressBar value={(job.progress / Math.max(1, job.total)) * 100} />
            {(job.status === "running" || job.status === "queued") && (
              <Spinner label="Detecting vehicles one timestamp at a time…" />
            )}
            {job.status === "failed" && <Note tone="error">{job.error}</Note>}
          </div>
        )}

        {!job && (
          <p className="mt-3 text-[11px] text-muted">
            A scan of {limit} samples processes about one frame every {intervalSeconds} s of{" "}
            {videos.find((video) => video.id === videoId)?.filename ?? "the selected video"}.
          </p>
        )}
      </Card>

      {summary && result && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Sampled frames" value={summary.samples} hint={`Every ${summary.interval_seconds} s`} />
            <Stat
              label="Mean detections / frame"
              value={number(summary.mean_detections_per_sampled_frame)}
              hint="Frame-level detections, not unique vehicles"
              tone="accent"
            />
            <Stat
              label="Peak frame"
              value={summary.max_detections}
              hint={`At ${number(summary.peak_timestamp, 1)} s`}
            />
            <Stat
              label="Mean inference"
              value={`${number(summary.mean_processing_ms, 0)} ms`}
              hint={`CPU · ${result.settings.image_size} px`}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <Card
              className="xl:col-span-2"
              title="Detections per sampled frame"
              subtitle="Stacked by incoming approach; grey are outside every approach region."
            >
              <div style={{ width: "100%", height: 280 }}>
                <ResponsiveContainer>
                  <BarChart data={trend} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid stroke="#263750" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="time" {...AXIS} unit="s" />
                    <YAxis {...AXIS} allowDecimals={false} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(0,213,255,0.06)" }} />
                    {APPROACHES.map((lane) => (
                      <Bar
                        key={lane}
                        dataKey={lane}
                        name={lane}
                        stackId="detections"
                        fill={LANE_COLOURS[lane]}
                      />
                    ))}
                    <Bar dataKey="unassigned" name="Unassigned" stackId="detections" fill="#475569" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <Legend
                items={[
                  ...APPROACHES.map((lane) => ({ label: lane, colour: LANE_COLOURS[lane] })),
                  { label: "Unassigned", colour: "#475569" },
                ]}
              />
            </Card>

            <Card title="Class totals" subtitle="Summed over sampled frames.">
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
                <p className="text-xs text-muted">No detections in the scanned frames.</p>
              )}
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <Card title="Congestion mix" subtitle="Approach-level snapshot levels across samples.">
              <div style={{ width: "100%", height: 220 }}>
                <ResponsiveContainer>
                  <BarChart data={levelData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid stroke="#263750" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="level" {...AXIS} />
                    <YAxis {...AXIS} allowDecimals={false} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(0,213,255,0.06)" }} />
                    <Bar dataKey="count" name="Approach-samples" radius={[5, 5, 0, 0]}>
                      {levelData.map((entry) => (
                        <Cell key={entry.level} fill={LEVEL_COLOURS[entry.level] ?? "#64748B"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card
              className="xl:col-span-2"
              title="Approach totals"
              subtitle="Detections assigned to each approach across the scan."
            >
              <ul className="space-y-3">
                {APPROACHES.map((lane) => {
                  const total = summary.approach_totals[lane];
                  const max = Math.max(1, ...APPROACHES.map((key) => summary.approach_totals[key]));
                  return (
                    <li key={lane}>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-ink">{lane}</span>
                        <span className="font-mono text-muted">{total}</span>
                      </div>
                      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-border/60">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${(total / max) * 100}%`,
                            background: LANE_COLOURS[lane],
                          }}
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

          <Card title="Sample log" subtitle="Signal recommendation is computed per sampled frame.">
            <div className="max-h-96 overflow-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/70">
                    <th className="th">Time</th>
                    <th className="th">Total</th>
                    <th className="th">N</th>
                    <th className="th">S</th>
                    <th className="th">E</th>
                    <th className="th">W</th>
                    <th className="th">Phase</th>
                    <th className="th">Green</th>
                    <th className="th">Inference</th>
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
          </Card>
        </>
      )}

      {!summary && !job && (
        <Note>
          No scan has run yet. The report is built from the same frame-analysis endpoint used
          elsewhere in the dashboard, so it reflects exactly what the detector returns.
        </Note>
      )}
    </div>
  );
}
