import { useState } from "react";
import { NavLink } from "react-router-dom";
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
  Badge,
  Callout,
  Card,
  Explain,
  Icon,
  LEVEL_BAR,
  LEVEL_HELP,
  LEVEL_TEXT,
  Note,
  PageHeader,
  Spinner,
  Stat,
} from "../components/ui";
import { mediaUrl } from "../lib/api";
import { number, percent, relativeTime } from "../lib/format";
import { useTraffic } from "../lib/TrafficContext";

const CLASS_COLOURS: Record<string, string> = {
  Car: "#00D5FF",
  Motorcycle: "#22C55E",
  Bus: "#8B5CF6",
  Truck: "#F59E0B",
};

const PRIORITY_TEXT: Record<string, string> = {
  max_demand: "This road has the most vehicles waiting.",
  max_wait: "This road has waited the longest, so it gets a turn now.",
  none: "No road has vehicles, so no green light is needed.",
  fixed_rotation: "The signal simply takes the next road in turn.",
};

const QUICK_LINKS = [
  {
    to: "/video",
    icon: "video",
    title: "Check a traffic video",
    body: "Pick a moment and let the AI find the vehicles.",
  },
  {
    to: "/signals",
    icon: "signals",
    title: "See the smart signal",
    body: "Find out which road should get the green light.",
  },
  {
    to: "/simulation",
    icon: "simulation",
    title: "Compare two signals",
    body: "Run a fair test: old timer vs smart signal.",
  },
];

export default function Overview() {
  const { snapshot, loading, error, dismissError, health, analyse, videoId } = useTraffic();
  const [timestamp, setTimestamp] = useState(10);

  const demandData =
    snapshot?.lanes.map((lane) => ({
      name: lane.name,
      demand: lane.weighted_demand,
      detections: lane.total,
    })) ?? [];

  const classData =
    snapshot?.classes
      .filter((entry) => entry.count > 0)
      .map((entry) => ({ name: entry.name, value: entry.count })) ?? [];

  const signal = snapshot?.signal;
  const dominant = snapshot?.congestion_summary.dominant_approach ?? null;
  const busiestLane = snapshot?.lanes.find((lane) => lane.name === dominant) ?? null;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Home"
        title="What is happening on the road right now?"
        description="This dashboard uses AI to find vehicles in a traffic video, see which road is busiest, and suggest a smarter green light."
      >
        {snapshot && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-panel/70 px-3 py-1 text-[11px] text-muted">
            <Icon name="clock" className="h-3.5 w-3.5" />
            Checked {relativeTime(snapshot.analysed_at)}
          </span>
        )}
      </PageHeader>

      {error && (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          <span>{error}</span>
          <button
            type="button"
            onClick={dismissError}
            className="shrink-0 font-medium text-danger/80 hover:text-danger"
          >
            Dismiss
          </button>
        </div>
      )}

      <Callout icon="spark" title="In one sentence">
        The computer watches a recorded traffic video, draws a box around every vehicle it finds,
        works out which of the four roads each vehicle is on, and recommends which road should get
        the green light next.
      </Callout>

      <div className="grid gap-3 sm:grid-cols-3">
        {QUICK_LINKS.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className="group flex items-start gap-3 rounded-xl border border-border/70 bg-panel/50 p-3.5 transition-colors hover:border-cyan/40 hover:bg-panel"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-cyan/30 bg-cyan/10 text-cyan">
              <Icon name={link.icon} className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-1 text-sm font-medium text-ink group-hover:text-cyan">
                {link.title}
                <Icon name="arrow" className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
              </span>
              <span className="mt-0.5 block text-xs leading-relaxed text-muted">{link.body}</span>
            </span>
          </NavLink>
        ))}
      </div>

      <section aria-labelledby="traffic-glance">
        <div className="mb-3 flex items-end justify-between gap-2">
          <div>
            <h2 id="traffic-glance" className="text-lg font-semibold text-ink">
              Traffic at a glance
            </h2>
            <p className="text-[13px] text-muted">Four simple numbers from the last picture the AI checked.</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat
            label="Vehicles found"
            value={snapshot?.total_detections ?? "—"}
            hint={
              snapshot
                ? `The AI spotted ${snapshot.total_detections} vehicles in this picture.`
                : "Waiting for the first check."
            }
            tone="accent"
          />
          <Stat
            label="Busiest road"
            value={dominant ?? "—"}
            hint={
              dominant
                ? `${dominant} has the most vehicles waiting right now.`
                : "No road has vehicles in this picture."
            }
          />
          <Stat
            label="How busy?"
            value={busiestLane ? LEVEL_TEXT[busiestLane.congestion] : "—"}
            hint={
              busiestLane
                ? LEVEL_HELP[busiestLane.congestion]
                : "The AI has not checked a picture yet."
            }
            tone={
              !busiestLane
                ? "default"
                : busiestLane.congestion === "High" || busiestLane.congestion === "Severe"
                  ? "bad"
                  : busiestLane.congestion === "Moderate"
                    ? "warn"
                    : "good"
            }
          />
          <Stat
            label="Next green light"
            value={signal?.green_lane ?? "Idle"}
            hint={
              signal?.green_lane
                ? `Green for ${signal.green_duration} seconds, then yellow for ${signal.yellow_duration} s.`
                : "No green light is needed right now."
            }
            tone="accent"
          />
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card
          className="xl:col-span-2"
          title="Which road has more traffic?"
          subtitle="Each bar shows how much road space the vehicles on that road need. A taller bar means a busier road."
        >
          {demandData.length ? (
            <>
              <div style={{ width: "100%", height: 260 }}>
                <ResponsiveContainer>
                  <BarChart data={demandData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid stroke="#263750" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" {...AXIS} />
                    <YAxis {...AXIS} />
                    <Tooltip
                      content={<ChartTooltip />}
                      cursor={{ fill: "rgba(0,213,255,0.06)" }}
                    />
                    <Bar dataKey="demand" name="Traffic (vehicle units)" radius={[6, 6, 0, 0]}>
                      {demandData.map((entry) => (
                        <Cell key={entry.name} fill={LANE_COLOURS[entry.name]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <Legend
                items={demandData.map((entry) => ({
                  label: `${entry.name} · ${entry.detections} vehicles`,
                  colour: LANE_COLOURS[entry.name],
                }))}
              />
              <div className="mt-3">
                <Explain summary="Why do we not simply count vehicles?">
                  <p>
                    A bus takes much more road space than a motorcycle. Instead of counting every
                    vehicle as “one”, the system gives each type a weight: motorcycle 0.6, car 1.0,
                    bus 1.6 and truck 1.6. Adding these weights gives the <strong>traffic demand</strong>{" "}
                    shown on the chart.
                  </p>
                </Explain>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted">No data yet. Check a frame below to fill this chart.</p>
          )}
        </Card>

        <Card
          title="Types of vehicles found"
          subtitle="The AI can recognise four kinds of vehicles. This circle shows how many of each it found."
        >
          {classData.length ? (
            <>
              <div style={{ width: "100%", height: 200 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={classData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={52}
                      outerRadius={82}
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
            <p className="text-sm text-muted">No vehicles detected in this picture.</p>
          )}
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card
          className="xl:col-span-2"
          title="What the AI saw"
          subtitle="The coloured shapes show the four roads. Each box marks one vehicle the AI found."
        >
          {snapshot ? (
            <>
              <img
                src={mediaUrl(snapshot.image_url)}
                alt={`Traffic picture with boxes drawn around the vehicles the AI found at ${snapshot.timestamp} seconds`}
                className="w-full rounded-xl border border-border/70"
                loading="lazy"
              />
              <p className="mt-3 text-[13px] leading-relaxed text-muted">
                The AI found <span className="font-semibold text-ink">{snapshot.total_detections}</span>{" "}
                vehicles here. {snapshot.unassigned > 0
                  ? `${snapshot.unassigned} of them were outside the four road areas, so they are not counted for any road.`
                  : "All of them were inside one of the four road areas."}
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-muted sm:grid-cols-4">
                <span>Video {snapshot.video.width}×{snapshot.video.height}</span>
                <span>{number(snapshot.video.fps, 0)} pictures / second</span>
                <span>AI took {number(snapshot.processing_ms, 0)} ms</span>
                <span>Moment {number(snapshot.timestamp, 1)} s</span>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted">
              Check a moment in the video below to generate a picture with boxes.
            </p>
          )}
        </Card>

        <div className="space-y-4">
          <Card title="Which road should go next?" subtitle="The system's suggestion for the next green light.">
            {signal?.green_lane ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-baseline gap-3">
                  <span className="font-mono text-4xl font-semibold text-cyan">
                    {signal.green_lane}
                  </span>
                  <span className="rounded-full border border-cyan/30 bg-cyan/10 px-2 py-0.5 text-xs text-cyan">
                    green for {signal.green_duration} s
                  </span>
                </div>
                <p className="text-[13px] leading-relaxed text-muted">
                  <span className="font-medium text-ink">Why? </span>
                  {PRIORITY_TEXT[signal.priority] ?? signal.reason}
                </p>
                <p className="rounded-lg border border-border bg-panel/60 px-3 py-2 text-xs leading-relaxed text-muted">
                  {signal.reason}
                </p>
                <dl className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <dt className="text-muted">Vehicles to clear</dt>
                    <dd className="font-mono text-ink">{number(signal.demand)} units</dd>
                  </div>
                  <div>
                    <dt className="text-muted">Yellow light</dt>
                    <dd className="font-mono text-ink">{signal.yellow_duration} s</dd>
                  </div>
                </dl>
                <Explain summary="What does “green for 12 seconds” mean?">
                  <p>
                    The green light stays on long enough to let the waiting vehicles pass. The system
                    calculates this from the amount of traffic, but never gives less than 12 seconds or
                    more than 45 seconds. A very short green would be unsafe; a very long green would
                    make other roads wait too long.
                  </p>
                </Explain>
              </div>
            ) : (
              <p className="text-sm text-muted">{signal?.status ?? "No recommendation yet."}</p>
            )}
          </Card>

          <Card title="Recent activity" subtitle="What the system did last.">
            <ul className="space-y-2.5 text-[13px]">
              <li className="flex items-start gap-2">
                <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                <span className="text-muted">
                  {snapshot
                    ? `Checked ${snapshot.video_id} at ${number(snapshot.timestamp, 1)} s.`
                    : "No video checked yet."}
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Icon name="cpu" className="mt-0.5 h-4 w-4 shrink-0 text-cyan" />
                <span className="text-muted">
                  {health?.model.state === "loaded"
                    ? "The AI model is loaded and ready."
                    : "Waiting for the AI model."}
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Icon name="clock" className="mt-0.5 h-4 w-4 shrink-0 text-violet" />
                <span className="text-muted">
                  {snapshot ? `Last update ${relativeTime(snapshot.analysed_at)}.` : "Nothing yet."}
                </span>
              </li>
            </ul>
            <div className="mt-4">
              <Explain summary="Technical details">
                <dl className="grid grid-cols-2 gap-2">
                  <div>
                    <dt>Model</dt>
                    <dd className="font-mono text-ink">{snapshot?.settings.model ?? health?.model.file}</dd>
                  </div>
                  <div>
                    <dt>Runs on</dt>
                    <dd className="font-mono text-ink">{snapshot?.settings.device ?? "cpu"}</dd>
                  </div>
                  <div>
                    <dt>Image size</dt>
                    <dd className="font-mono text-ink">{snapshot?.settings.image_size ?? "—"} px</dd>
                  </div>
                  <div>
                    <dt>Confidence cut-off</dt>
                    <dd className="font-mono text-ink">{snapshot?.settings.confidence ?? "—"}</dd>
                  </div>
                </dl>
                <p>
                  The model is <strong>yolov8n</strong>, a small ready-made AI model. It was trained on
                  ordinary street-level photos, not on this top-down view, so it misses some vehicles.
                  All counts are therefore a lower bound.
                </p>
              </Explain>
            </div>
          </Card>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card
          className="xl:col-span-2"
          title="How busy is each road?"
          subtitle="Each road gets its own bar. The colour shows whether that road is quiet or crowded."
        >
          <ul className="space-y-4">
            {(snapshot?.lanes ?? []).map((lane) => (
              <li key={lane.name}>
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="inline-flex items-center gap-2 font-medium text-ink">
                    <span
                      className="h-2.5 w-2.5 rounded-sm"
                      style={{ background: LANE_COLOURS[lane.name] }}
                    />
                    {lane.name}
                  </span>
                  <Badge level={lane.congestion} />
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-border/60">
                  <div
                    className={`h-full rounded-full ${LEVEL_BAR[lane.congestion]}`}
                    style={{ width: `${Math.min(100, lane.utilisation * 100)}%` }}
                  />
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-muted">
                  {lane.total} vehicles · {number(lane.weighted_demand)} vehicle units ·{" "}
                  {percent(lane.utilisation)} of the road area filled
                </p>
              </li>
            ))}
            {!snapshot && <li className="text-sm text-muted">No data yet.</li>}
          </ul>
        </Card>

        <Card
          title="Check another moment"
          subtitle="Move the slider to choose a moment in the recorded video, then let the AI look at that picture."
        >
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between text-xs text-muted">
                <label htmlFor="overview-timestamp">Moment in the video</label>
                <span className="font-mono text-ink">{timestamp.toFixed(1)} s</span>
              </div>
              <input
                id="overview-timestamp"
                type="range"
                min={0}
                max={Math.max(1, Math.floor((snapshot?.video.duration_seconds ?? 37) - 1))}
                step={0.5}
                value={timestamp}
                onChange={(event) => setTimestamp(Number(event.target.value))}
                className="mt-2 w-full"
              />
              <p className="mt-1 text-[11px] text-muted">
                {videoId ? `Video: ${videoId}` : "No video selected"}
              </p>
            </div>
            <button
              type="button"
              className="btn-primary w-full"
              disabled={loading || !videoId}
              onClick={() => analyse(videoId, timestamp)}
            >
              <Icon name="play" className="h-4 w-4" />
              {loading ? "AI is checking…" : "Check this frame"}
            </button>
            {loading && <Spinner label="The AI is looking at the picture…" />}
            <p className="text-[11px] leading-relaxed text-muted">
              Each check looks at one single picture from the video. It is not a live camera.
            </p>
          </div>
        </Card>
      </div>

      <Note>
        This is a learning prototype. The AI finds vehicles in <strong>recorded video</strong>, not a
        live camera. Because the ready-made model was trained on street-level photos, it misses some
        vehicles in this top-down view, so counts are a lower bound. “How busy” is an estimate from one
        picture, not a measured queue. The signal suggestion is advice for learning — it does not
        control real traffic lights.
      </Note>
    </div>
  );
}
