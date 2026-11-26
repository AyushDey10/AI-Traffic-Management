import { useState } from "react";
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
import { Badge, Card, Icon, LEVEL_BAR, Note, PageHeader, Spinner, Stat } from "../components/ui";
import { mediaUrl } from "../lib/api";
import { number, percent, relativeTime } from "../lib/format";
import { useTraffic } from "../lib/TrafficContext";

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
    snapshot?.classes.filter((entry) => entry.count > 0).map((entry) => ({
      name: entry.name,
      value: entry.count,
    })) ?? [];

  const classColours: Record<string, string> = {
    Car: "#00D5FF",
    Motorcycle: "#22C55E",
    Bus: "#8B5CF6",
    Truck: "#F59E0B",
  };

  const signal = snapshot?.signal;
  const dominant = snapshot?.congestion_summary.dominant_approach;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Operations Overview"
        description="Live snapshot of the analysed intersection: frame-level YOLO detections, approach demand, congestion estimate and the recommended next phase."
      >
        {snapshot && (
          <span className="rounded-full border border-border bg-panel/70 px-3 py-1 text-[11px] text-muted">
            {snapshot.video_id} · t={number(snapshot.timestamp, 1)}s ·{" "}
            {relativeTime(snapshot.analysed_at)}
          </span>
        )}
      </PageHeader>

      {error && (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
          <span>{error}</span>
          <button type="button" onClick={dismissError} className="text-danger/80 hover:text-danger">
            Dismiss
          </button>
        </div>
      )}

      <Card
        title="Frame selection"
        subtitle="Choose a timestamp from the recorded footage, then analyse that frame."
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <div className="flex items-center justify-between text-xs text-muted">
              <label htmlFor="overview-timestamp">Timestamp</label>
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
          </div>
          <button
            type="button"
            className="btn-primary"
            disabled={loading || !videoId}
            onClick={() => analyse(videoId, timestamp)}
          >
            {loading ? "Analysing…" : "Analyse frame"}
          </button>
        </div>
        {loading && (
          <div className="mt-3">
            <Spinner label="Running YOLOv8n on the full-resolution frame…" />
          </div>
        )}
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Detected vehicles"
          value={snapshot?.total_detections ?? "—"}
          hint={
            snapshot
              ? `${snapshot.unassigned} outside any approach region`
              : "Awaiting first analysis"
          }
          tone="accent"
        />
        <Stat
          label="Dominant approach"
          value={dominant ?? "—"}
          hint={
            dominant && snapshot
              ? `${number(
                  snapshot.lanes.find((lane) => lane.name === dominant)?.weighted_demand ?? 0,
                )} weighted units`
              : "No approach demand"
          }
        />
        <Stat
          label="Mean utilisation"
          value={snapshot ? percent(snapshot.congestion_summary.average_utilisation) : "—"}
          hint="Weighted demand ÷ approach capacity"
          tone={
            !snapshot
              ? "default"
              : snapshot.congestion_summary.average_utilisation >= 0.45
                ? "bad"
                : snapshot.congestion_summary.average_utilisation >= 0.2
                  ? "warn"
                  : "good"
          }
        />
        <Stat
          label="Recommended phase"
          value={signal?.green_lane ? `${signal.green_lane}` : "Idle"}
          hint={signal?.green_lane ? `Green for ${signal.green_duration} s` : "No green phase needed"}
          tone="accent"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card
          className="xl:col-span-2"
          title="Approach demand"
          subtitle="Weighted vehicle units per incoming approach for this frame."
        >
          {demandData.length ? (
            <>
              <div style={{ width: "100%", height: 260 }}>
                <ResponsiveContainer>
                  <BarChart data={demandData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid stroke="#263750" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" {...AXIS} />
                    <YAxis {...AXIS} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(0,213,255,0.06)" }} />
                    <Bar dataKey="demand" name="Weighted demand" radius={[6, 6, 0, 0]}>
                      {demandData.map((entry) => (
                        <Cell key={entry.name} fill={LANE_COLOURS[entry.name]} />
                      ))}
                    </Bar>
                    <Bar dataKey="detections" name="Detections" fill="#263750" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <Legend
                items={demandData.map((entry) => ({
                  label: entry.name,
                  colour: LANE_COLOURS[entry.name],
                }))}
              />
            </>
          ) : (
            <p className="text-xs text-muted">No snapshot yet.</p>
          )}
        </Card>

        <Card title="Vehicle class mix" subtitle="Detections by COCO vehicle class.">
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
                        <Cell key={entry.name} fill={classColours[entry.name] ?? "#64748B"} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <Legend
                items={classData.map((entry) => ({
                  label: `${entry.name} (${entry.value})`,
                  colour: classColours[entry.name] ?? "#64748B",
                }))}
              />
            </>
          ) : (
            <p className="text-xs text-muted">No vehicles detected in this frame.</p>
          )}
        </Card>

        <Card
          className="xl:col-span-2"
          title="Annotated frame"
          subtitle="Lane polygons, detection boxes and approach counts drawn by the analysis engine."
        >
          {snapshot ? (
            <>
              <img
                src={mediaUrl(snapshot.image_url)}
                alt={`Annotated traffic frame at ${snapshot.timestamp} seconds`}
                className="w-full rounded-lg border border-border/70"
                loading="lazy"
              />
              <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-muted sm:grid-cols-4">
                <span>Source {snapshot.video.width}×{snapshot.video.height}</span>
                <span>{number(snapshot.video.fps, 0)} fps</span>
                <span>Inference {number(snapshot.processing_ms, 0)} ms</span>
                <span>JPEG preview 1280 px</span>
              </div>
            </>
          ) : (
            <p className="text-xs text-muted">Run an analysis to generate the annotated still.</p>
          )}
        </Card>

        <div className="space-y-4">
          <Card title="Approach status" subtitle="Snapshot estimate, not a measured queue.">
            <ul className="space-y-3">
              {(snapshot?.lanes ?? []).map((lane) => (
                <li key={lane.name}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-ink">{lane.name}</span>
                    <Badge level={lane.congestion} />
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-border/60">
                    <div
                      className={`h-full rounded-full ${LEVEL_BAR[lane.congestion]}`}
                      style={{ width: `${Math.min(100, lane.utilisation * 100)}%` }}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-muted">
                    {lane.total} vehicles · {number(lane.weighted_demand)} units ·{" "}
                    {percent(lane.utilisation)} of capacity
                  </p>
                </li>
              ))}
              {!snapshot && <li className="text-xs text-muted">No data yet.</li>}
            </ul>
          </Card>

          <Card title="Recommended phase" subtitle="Rule-based recommendation from this frame.">
            {signal?.green_lane ? (
              <div className="space-y-3">
                <div className="flex items-baseline gap-3">
                  <span className="font-mono text-3xl font-semibold text-cyan">
                    {signal.green_lane}
                  </span>
                  <span className="rounded-full border border-cyan/30 bg-cyan/10 px-2 py-0.5 text-[11px] text-cyan">
                    {signal.green_duration} s green
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-muted">{signal.reason}</p>
                <dl className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <dt className="text-muted">Priority rule</dt>
                    <dd className="font-mono text-ink">{signal.priority}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">Demand served</dt>
                    <dd className="font-mono text-ink">{number(signal.demand)} units</dd>
                  </div>
                  <div>
                    <dt className="text-muted">Yellow</dt>
                    <dd className="font-mono text-ink">{signal.yellow_duration} s</dd>
                  </div>
                  <div>
                    <dt className="text-muted">Clears up to</dt>
                    <dd className="font-mono text-ink">{number(signal.expected_cleared_units)} units</dd>
                  </div>
                </dl>
              </div>
            ) : (
              <p className="text-xs text-muted">{signal?.status ?? "No recommendation yet."}</p>
            )}
          </Card>

          <Card title="System" subtitle="Processing configuration for this snapshot.">
            <dl className="space-y-2 text-[11px]">
              <div className="flex items-center justify-between">
                <dt className="text-muted">Model</dt>
                <dd className="font-mono text-ink">{snapshot?.settings.model ?? health?.model.file}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted">Device</dt>
                <dd className="font-mono text-ink">{snapshot?.settings.device ?? "cpu"}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted">Inference size</dt>
                <dd className="font-mono text-ink">{snapshot?.settings.image_size ?? "—"} px</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted">Confidence</dt>
                <dd className="font-mono text-ink">{snapshot?.settings.confidence ?? "—"}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted">API version</dt>
                <dd className="font-mono text-ink">{health?.api_version ?? "—"}</dd>
              </div>
            </dl>
            <div className="mt-3 flex items-center gap-2 text-[11px] text-warning">
              <Icon name="alert" className="h-3.5 w-3.5" />
              Custom-trained model: {health?.model.custom_trained ? "yes" : "no (stock COCO)"}
            </div>
          </Card>
        </div>
      </div>

      <Note>
        Detections are per frame and the stock YOLOv8n COCO checkpoint was not trained on this
        aerial footage, so counts are a lower bound on the vehicles actually present. Congestion
        levels are snapshot estimates, not measured queues, and the signal phase is a rule-based
        recommendation for an educational prototype.
      </Note>
    </div>
  );
}
