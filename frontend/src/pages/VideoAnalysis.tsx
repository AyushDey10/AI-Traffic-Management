import { useRef, useState } from "react";
import { Badge, Card, Note, PageHeader, Spinner } from "../components/ui";
import { api, mediaUrl } from "../lib/api";
import { number, percent, relativeTime } from "../lib/format";
import { errorMessage, useTraffic } from "../lib/TrafficContext";

export default function VideoAnalysis() {
  const { videos, videoId, setVideoId, snapshot, analyse, loading, error, refreshVideos } =
    useTraffic();
  const [mode, setMode] = useState<"annotated" | "source">("annotated");
  const [timestamp, setTimestamp] = useState(10);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const selected = videos.find((video) => video.id === videoId);
  const maxTimestamp = Math.max(1, Math.floor((selected?.duration_seconds ?? 37) - 1));

  const annotatedUrl = selected?.processed_url ?? null;
  const sourceUrl = `/api/videos/${encodeURIComponent(selected?.id ?? "")}/source`;
  const playerUrl = mode === "annotated" && annotatedUrl ? annotatedUrl : sourceUrl;

  const handleUpload = async (file: File | null) => {
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const info = await api.upload(file);
      const list = await refreshVideos();
      const uploaded = list.find((item) => item.id === info.filename) ?? list.find((item) => item.id === info.id);
      if (uploaded) {
        setVideoId(uploaded.id);
        setTimestamp(0);
      }
    } catch (cause) {
      setUploadError(errorMessage(cause));
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Video Analysis"
        description="Prerecorded footage only — this is not a live camera feed. Analysis runs on the selected frame; the annotated video is a pre-rendered sample."
      >
        {snapshot && (
          <span className="rounded-full border border-border bg-panel/70 px-3 py-1 text-[11px] text-muted">
            Last analysis {relativeTime(snapshot.analysed_at)}
          </span>
        )}
      </PageHeader>

      {(error || uploadError) && (
        <Note tone="error">{error ?? uploadError}</Note>
      )}

      <div className="grid gap-4 xl:grid-cols-3">
        <Card
          className="xl:col-span-2"
          title="Playback"
          subtitle="Switch between the annotated detection sample and the untouched source."
          action={
            <div className="flex rounded-lg border border-border p-0.5 text-[11px]">
              <button
                type="button"
                onClick={() => setMode("annotated")}
                className={`rounded-md px-2.5 py-1 ${mode === "annotated" ? "bg-cyan/15 text-cyan" : "text-muted"}`}
              >
                Annotated
              </button>
              <button
                type="button"
                onClick={() => setMode("source")}
                className={`rounded-md px-2.5 py-1 ${mode === "source" ? "bg-cyan/15 text-cyan" : "text-muted"}`}
              >
                Source
              </button>
            </div>
          }
        >
          {selected ? (
            <>
              <video
                key={playerUrl}
                src={mediaUrl(playerUrl)}
                controls
                playsInline
                className="w-full rounded-lg border border-border/70 bg-black"
              />
              <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-muted">
                <span className="font-mono text-ink">{selected.filename}</span>
                <span>
                  {selected.width}×{selected.height}
                </span>
                <span>{number(selected.fps, 0)} fps</span>
                <span>{number(selected.duration_seconds, 1)} s</span>
                <span>{selected.size_mb} MB</span>
              </div>
              {mode === "annotated" && !annotatedUrl && (
                <div className="mt-3">
                  <Note tone="warn">
                    No annotated video exists for this file. Generate one with{" "}
                    <span className="font-mono">scripts/regenerate_processed_video.py</span>.
                  </Note>
                </div>
              )}
            </>
          ) : (
            <p className="text-xs text-muted">No videos available. Upload one below.</p>
          )}
        </Card>

        <div className="space-y-4">
          <Card title="Source selection" subtitle="Videos discovered in data/videos.">
            <select
              className="field w-full"
              value={videoId}
              onChange={(event) => {
                setVideoId(event.target.value);
                setTimestamp(0);
              }}
            >
              {videos.map((video) => (
                <option key={video.id} value={video.id}>
                  {video.filename} ({number(video.duration_seconds, 1)} s)
                </option>
              ))}
            </select>

            <div className="mt-4">
              <div className="flex items-center justify-between text-xs text-muted">
                <label htmlFor="video-timestamp">Frame timestamp</label>
                <span className="font-mono text-ink">{timestamp.toFixed(1)} s</span>
              </div>
              <input
                id="video-timestamp"
                type="range"
                min={0}
                max={maxTimestamp}
                step={0.5}
                value={Math.min(timestamp, maxTimestamp)}
                onChange={(event) => setTimestamp(Number(event.target.value))}
                className="mt-2 w-full"
              />
              <button
                type="button"
                className="btn-primary mt-3 w-full"
                disabled={loading || !videoId}
                onClick={() => analyse(videoId, Math.min(timestamp, maxTimestamp))}
              >
                {loading ? "Analysing…" : "Analyse this frame"}
              </button>
              {loading && (
                <div className="mt-3">
                  <Spinner label="Running detection on the full-resolution frame…" />
                </div>
              )}
            </div>
          </Card>

          <Card title="Upload footage" subtitle="MP4, AVI, MOV or MKV up to 250 MB.">
            <input
              ref={fileInput}
              type="file"
              accept="video/mp4,video/quicktime,video/x-msvideo,video/x-matroska"
              onChange={(event) => handleUpload(event.target.files?.[0] ?? null)}
              className="block w-full text-xs text-muted file:mr-3 file:rounded-md file:border file:border-border file:bg-panel file:px-3 file:py-1.5 file:text-xs file:text-ink"
            />
            {uploading && (
              <div className="mt-3">
                <Spinner label="Uploading…" />
              </div>
            )}
            <p className="mt-3 text-[11px] leading-relaxed text-muted">
              Uploaded files are stored under data/uploads and can be analysed frame by frame. They
              have no annotated video until one is rendered.
            </p>
          </Card>
        </div>
      </div>

      {snapshot && (
        <>
          <div className="grid gap-4 xl:grid-cols-3">
            <Card
              className="xl:col-span-2"
              title={`Annotated frame at ${number(snapshot.timestamp, 1)} s`}
              subtitle={`${snapshot.total_detections} detections · ${number(snapshot.processing_ms, 0)} ms inference`}
            >
              <img
                src={mediaUrl(snapshot.image_url)}
                alt={`Detection overlay at ${snapshot.timestamp} seconds`}
                className="w-full rounded-lg border border-border/70"
              />
            </Card>

            <Card title="Approach breakdown" subtitle="Counts are per frame, not unique vehicles.">
              <ul className="space-y-3">
                {snapshot.lanes.map((lane) => (
                  <li key={lane.name} className="rounded-lg border border-border/60 bg-panel/40 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-ink">{lane.name}</span>
                      <Badge level={lane.congestion} />
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {lane.total} vehicles · {number(lane.weighted_demand)} units ·{" "}
                      {percent(lane.utilisation)} utilisation
                    </p>
                    <p className="mt-1 font-mono text-[11px] text-border">
                      car {lane.classes.Car} · moto {lane.classes.Motorcycle} · bus{" "}
                      {lane.classes.Bus} · truck {lane.classes.Truck}
                    </p>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card title="Detections" subtitle="Class, confidence and assigned approach.">
              <div className="max-h-80 overflow-y-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/70">
                      <th className="th">#</th>
                      <th className="th">Class</th>
                      <th className="th">Confidence</th>
                      <th className="th">Approach</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.detections.map((detection, index) => (
                      <tr key={index} className="border-b border-border/40 last:border-0">
                        <td className="td font-mono text-muted">{index + 1}</td>
                        <td className="td">{detection.class}</td>
                        <td className="td font-mono">{detection.confidence.toFixed(3)}</td>
                        <td className="td">{detection.lane}</td>
                      </tr>
                    ))}
                    {snapshot.detections.length === 0 && (
                      <tr>
                        <td className="td text-muted" colSpan={4}>
                          No vehicles detected in this frame.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card title="Analysis notes" subtitle="What this output does and does not mean.">
              <ul className="list-disc space-y-2 pl-4 text-xs leading-relaxed text-muted">
                {snapshot.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
                <li>{snapshot.congestion_summary.note}</li>
                <li>
                  Detected vehicles outside every approach polygon ({snapshot.unassigned}) are
                  reported separately and excluded from approach demand.
                </li>
              </ul>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
