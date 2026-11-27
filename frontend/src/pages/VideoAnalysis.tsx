import { useRef, useState } from "react";
import {
  Badge,
  Callout,
  Card,
  Explain,
  Icon,
  LEVEL_HELP,
  LEVEL_TEXT,
  Note,
  PageHeader,
  Spinner,
  Stat,
  StepCard,
} from "../components/ui";
import { api, mediaUrl } from "../lib/api";
import { number, percent, relativeTime } from "../lib/format";
import { errorMessage, useTraffic } from "../lib/TrafficContext";

export default function VideoAnalysis() {
  const { videos, videoId, selectVideo, snapshot, analyse, loading, error, refreshVideos } =
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

  const busiest = snapshot
    ? snapshot.lanes.reduce((best, lane) =>
        lane.weighted_demand > best.weighted_demand ? lane : best,
      )
    : null;

  const handleUpload = async (file: File | null) => {
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const info = await api.upload(file);
      const list = await refreshVideos();
      const uploaded =
        list.find((item) => item.id === info.filename) ?? list.find((item) => item.id === info.id);
      if (uploaded) {
        selectVideo(uploaded.id);
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
        eyebrow="Step by step"
        title="Check a traffic video"
        description="Choose a recorded traffic video, pick a moment, and let the AI find the vehicles. You will see exactly what it found and which road each vehicle is on."
      >
        {snapshot && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-panel/70 px-3 py-1 text-[11px] text-muted">
            <Icon name="clock" className="h-3.5 w-3.5" />
            Last check {relativeTime(snapshot.analysed_at)}
          </span>
        )}
      </PageHeader>

      {(error || uploadError) && <Note tone="error">{error ?? uploadError}</Note>}

      <Callout icon="video" title="Good to know">
        This page uses <strong>recorded videos</strong>, not a live camera. The AI looks at one picture
        at a time, so the same car can be counted again in the next picture.
      </Callout>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Card
            title="Step 1 · Choose a traffic video"
            subtitle="These videos are already on this computer. Pick the one you want the AI to look at."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="video-source" className="mb-1.5 block text-xs font-medium text-ink">
                  Traffic video
                </label>
                <select
                  id="video-source"
                  className="field w-full"
                  value={videoId}
                  onChange={(event) => {
                    selectVideo(event.target.value);
                    setTimestamp(0);
                  }}
                >
                  {videos.map((video) => (
                    <option key={video.id} value={video.id}>
                      {video.filename} ({number(video.duration_seconds, 1)} s)
                    </option>
                  ))}
                </select>
              </div>
              <div className="rounded-lg border border-border/70 bg-panel/50 p-3 text-xs text-muted">
                {selected ? (
                  <ul className="grid grid-cols-2 gap-1.5">
                    <li>
                      Size: <span className="font-mono text-ink">{selected.width}×{selected.height}</span>
                    </li>
                    <li>
                      Speed: <span className="font-mono text-ink">{number(selected.fps, 0)} fps</span>
                    </li>
                    <li>
                      Length: <span className="font-mono text-ink">{number(selected.duration_seconds, 1)} s</span>
                    </li>
                    <li>
                      File: <span className="font-mono text-ink">{selected.size_mb} MB</span>
                    </li>
                  </ul>
                ) : (
                  "No video selected."
                )}
              </div>
            </div>

            <div className="mt-4 border-t border-border/60 pt-4">
              <p className="mb-2 text-xs font-medium text-ink">Or upload your own video</p>
              <input
                ref={fileInput}
                type="file"
                accept="video/mp4,video/quicktime,video/x-msvideo,video/x-matroska"
                onChange={(event) => handleUpload(event.target.files?.[0] ?? null)}
                className="block w-full text-xs text-muted file:mr-3 file:rounded-md file:border file:border-border file:bg-panel file:px-3 file:py-1.5 file:text-xs file:text-ink"
              />
              <p className="mt-2 text-[11px] leading-relaxed text-muted">
                MP4, AVI, MOV or MKV up to 250 MB. Uploaded videos can be checked frame by frame, but
                they do not have an “AI version” video until one is made.
              </p>
              {uploading && (
                <div className="mt-3">
                  <Spinner label="Uploading your video…" />
                </div>
              )}
            </div>
          </Card>

          <Card
            title="Step 2 · Pick a moment and start the AI"
            subtitle="Move the slider to any moment. The AI looks at exactly one picture from that moment."
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="flex-1">
                <div className="flex items-center justify-between text-xs text-muted">
                  <label htmlFor="video-timestamp">Moment in the video</label>
                  <span className="font-mono text-ink">{Math.min(timestamp, maxTimestamp).toFixed(1)} s</span>
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
                <p className="mt-1 text-[11px] text-muted">
                  For example, 10 s means “look at the picture 10 seconds into the video”.
                </p>
              </div>
              <button
                type="button"
                className="btn-primary sm:min-w-56"
                disabled={loading || !videoId}
                onClick={() => analyse(videoId, Math.min(timestamp, maxTimestamp))}
              >
                <Icon name="play" className="h-4 w-4" />
                {loading ? "AI is checking…" : "Analyse Traffic Video"}
              </button>
            </div>
            {loading && (
              <div className="mt-4 rounded-lg border border-cyan/25 bg-cyan/5 p-3">
                <Spinner label="Step 3 · The AI is looking for vehicles. This usually takes under a second." />
              </div>
            )}
            <div className="mt-4">
              <Explain summary="What happens when I press the button?">
                <ol className="list-decimal space-y-1 pl-4">
                  <li>The computer opens the video and jumps to your chosen moment.</li>
                  <li>It takes that one picture at full quality.</li>
                  <li>YOLOv8n, a small AI model, looks for cars, motorcycles, buses and trucks.</li>
                  <li>Each vehicle gets a box, a type, and a “how sure” score.</li>
                  <li>The picture is sent back with the boxes drawn on it.</li>
                </ol>
              </Explain>
            </div>
          </Card>

          <Card
            title="Watch the video"
            subtitle="“AI version” is a video made earlier with boxes drawn on it. “Original” is the plain recording."
            action={
              <div className="flex rounded-lg border border-border p-0.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => setMode("annotated")}
                  className={`rounded-md px-2.5 py-1 ${
                    mode === "annotated" ? "bg-cyan/15 text-cyan" : "text-muted"
                  }`}
                >
                  AI version
                </button>
                <button
                  type="button"
                  onClick={() => setMode("source")}
                  className={`rounded-md px-2.5 py-1 ${
                    mode === "source" ? "bg-cyan/15 text-cyan" : "text-muted"
                  }`}
                >
                  Original
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
                  className="w-full rounded-xl border border-border/70 bg-black"
                />
                {mode === "annotated" && !annotatedUrl && (
                  <div className="mt-3">
                    <Note tone="warn">
                      There is no “AI version” video for this file yet. All other features still work.
                    </Note>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-muted">No videos available. Upload one above.</p>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <StepCard step={1} title="Choose a video">
            Pick one of the traffic recordings. Each one shows the same four-road crossing from above.
          </StepCard>
          <StepCard step={2} title="Pick a moment">
            Choose any second of the video. One picture from that moment is enough for the AI to look
            at.
          </StepCard>
          <StepCard step={3} title="Let the AI check it">
            Press <span className="text-ink">Analyse Traffic Video</span> and wait for the result. No
            fake progress bars — the result is real.
          </StepCard>
          <StepCard step={4} title="Read the result" active>
            You will see the number of vehicles, their types, the boxes around them and which road each
            one is on.
          </StepCard>

          <Card title="What the AI can see" subtitle="Four types of vehicles, and nothing else.">
            <ul className="grid grid-cols-2 gap-2 text-xs">
              {[
                ["Car", "#00D5FF"],
                ["Motorcycle", "#22C55E"],
                ["Bus", "#8B5CF6"],
                ["Truck", "#F59E0B"],
              ].map(([name, colour]) => (
                <li
                  key={name}
                  className="flex items-center gap-2 rounded-lg border border-border/70 bg-panel/50 px-2.5 py-2"
                >
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: colour }} />
                  {name}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] leading-relaxed text-muted">
              People, animals and other objects are ignored. Only these four vehicle types are counted.
            </p>
          </Card>
        </div>
      </div>

      {snapshot && (
        <>
          <Card
            title="Step 4 · What the AI found"
            subtitle={`Picture at ${number(snapshot.timestamp, 1)} s from ${snapshot.video_id}.`}
          >
            <div className="rounded-xl border border-cyan/25 bg-cyan/5 p-4">
              <p className="text-lg font-semibold text-ink">
                The AI found {snapshot.total_detections} vehicle
                {snapshot.total_detections === 1 ? "" : "s"} in this picture.
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-muted">
                {snapshot.unassigned > 0
                  ? `${snapshot.unassigned} of them were not inside any of the four road areas.`
                  : "Every vehicle it found was inside one of the four road areas."}
              </p>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Stat
                label="Vehicles found"
                value={snapshot.total_detections}
                hint="Boxes drawn by the AI in this picture."
                tone="accent"
              />
              <Stat
                label="Busiest road"
                value={busiest?.name ?? "—"}
                hint={
                  busiest
                    ? `${busiest.total} vehicles on ${busiest.name}.`
                    : "No road has vehicles."
                }
              />
              <Stat
                label="How busy"
                value={busiest ? LEVEL_TEXT[busiest.congestion] : "—"}
                hint={busiest ? LEVEL_HELP[busiest.congestion] : "Nothing to measure."}
                tone={
                  !busiest
                    ? "default"
                    : busiest.congestion === "High" || busiest.congestion === "Severe"
                      ? "bad"
                      : busiest.congestion === "Moderate"
                        ? "warn"
                        : "good"
                }
              />
              <Stat
                label="AI processing time"
                value={`${number(snapshot.processing_ms, 0)} ms`}
                hint="How long the AI took for this one picture."
              />
            </div>
          </Card>

          <div className="grid gap-4 xl:grid-cols-3">
            <Card
              className="xl:col-span-2"
              title="The picture with boxes"
              subtitle="Each box marks one vehicle. The coloured outlines show the four road areas."
            >
              <img
                src={mediaUrl(snapshot.image_url)}
                alt={`Vehicles the AI found at ${snapshot.timestamp} seconds, with boxes and road areas drawn`}
                className="w-full rounded-xl border border-border/70"
              />
              <p className="mt-3 text-[13px] leading-relaxed text-muted">
                A <strong className="text-ink">box</strong> is simply the computer showing you where it
                thinks a vehicle is. If a vehicle has no box, the AI did not notice it.
              </p>
            </Card>

            <Card
              title="Vehicles on each road"
              subtitle="Counts are for this one picture, not unique vehicles over time."
            >
              <ul className="space-y-3">
                {snapshot.lanes.map((lane) => (
                  <li key={lane.name} className="rounded-xl border border-border/70 bg-panel/40 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-ink">{lane.name}</span>
                      <Badge level={lane.congestion} />
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {lane.total} vehicles · {number(lane.weighted_demand)} vehicle units ·{" "}
                      {percent(lane.utilisation)} filled
                    </p>
                    <p className="mt-1 text-[11px] text-muted">
                      Cars {lane.classes.Car} · Motorcycles {lane.classes.Motorcycle} · Buses{" "}
                      {lane.classes.Bus} · Trucks {lane.classes.Truck}
                    </p>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card
              title="Every vehicle the AI found"
              subtitle="“How sure” is the AI's own confidence, from 0 to 1. A higher number means it is more certain."
            >
              <div className="max-h-80 overflow-y-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/70">
                      <th className="th">#</th>
                      <th className="th">Type</th>
                      <th className="th">How sure</th>
                      <th className="th">Road</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.detections.map((detection, index) => (
                      <tr key={index} className="border-b border-border/40 last:border-0">
                        <td className="td font-mono text-muted">{index + 1}</td>
                        <td className="td">{detection.class}</td>
                        <td className="td font-mono">{detection.confidence.toFixed(2)}</td>
                        <td className="td">{detection.lane}</td>
                      </tr>
                    ))}
                    {snapshot.detections.length === 0 && (
                      <tr>
                        <td className="td text-muted" colSpan={4}>
                          No vehicles were found in this picture.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="mt-3">
                <Explain summary="Why does the AI sometimes miss vehicles?">
                  <p>
                    The model was trained on ordinary photos taken from the street. Here the camera
                    looks straight down, so a car looks like a small rectangle. Vehicles can also be
                    hidden by trees, shadows, or other vehicles. That is why the AI may find fewer
                    vehicles than you can count with your eyes.
                  </p>
                </Explain>
              </div>
            </Card>

            <Card title="What this result means" subtitle="An honest explanation of the limits.">
              <ul className="space-y-2 text-[13px] leading-relaxed text-muted">
                {snapshot.notes.map((note) => (
                  <li key={note} className="flex gap-2">
                    <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                    <span>{note}</span>
                  </li>
                ))}
                <li className="flex gap-2">
                  <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                  <span>{snapshot.congestion_summary.note}</span>
                </li>
                <li className="flex gap-2">
                  <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                  <span>
                    Vehicles outside the four road areas ({snapshot.unassigned}) are shown separately
                    and do not count towards any road.
                  </span>
                </li>
              </ul>
            </Card>
          </div>
        </>
      )}

      {!snapshot && !loading && (
        <Card title="No result yet" subtitle="Follow steps 1 and 2 above to see the AI work.">
          <p className="text-sm text-muted">
            Choose a video, pick a moment, and press <strong className="text-ink">Analyse Traffic Video</strong>.
            The result will appear here with the number of vehicles and a picture with boxes.
          </p>
        </Card>
      )}
    </div>
  );
}
