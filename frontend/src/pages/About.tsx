import { Card, Note, PageHeader } from "../components/ui";

const PIPELINE = [
  {
    step: "01",
    title: "Frame extraction",
    body: "OpenCV seeks to the requested timestamp of the 3840×2160, 24 fps recording and reads the native frame.",
  },
  {
    step: "02",
    title: "YOLOv8n detection",
    body: "Stock COCO weights detect cars, motorcycles, buses and trucks at 1920 px inference size on CPU.",
  },
  {
    step: "03",
    title: "Approach assignment",
    body: "Each box centre is tested against four calibrated polygons that cover only the incoming carriageways.",
  },
  {
    step: "04",
    title: "Estimate & recommend",
    body: "Weighted demand is normalised by approach capacity, then the signal controller recommends the next phase.",
  },
];

export default function About() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="About the Project"
        description="An educational prototype that connects computer-vision detection, a snapshot congestion model, a rule-based signal recommender and a queueing simulation."
      >
        <span className="rounded-full border border-warning/40 bg-warning/10 px-3 py-1 text-[11px] text-warning">
          Exhibition prototype — not for road control
        </span>
      </PageHeader>

      <Card title="Processing pipeline" subtitle="Every stage runs locally on the project's own footage and models.">
        <ol className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {PIPELINE.map((stage) => (
            <li key={stage.step} className="rounded-lg border border-border/70 bg-panel/40 p-4">
              <p className="font-mono text-xs text-cyan">{stage.step}</p>
              <h3 className="mt-1 text-sm font-semibold text-ink">{stage.title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted">{stage.body}</p>
            </li>
          ))}
        </ol>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="What the system actually does" subtitle="Verified behaviour of this build.">
          <ul className="list-disc space-y-2 pl-4 text-xs leading-relaxed text-muted">
            <li>Detects four COCO vehicle classes in a single frame of recorded footage.</li>
            <li>Assigns each detection to one of four approaches using calibrated polygons.</li>
            <li>Estimates a screenshot-style congestion level per approach from weighted demand.</li>
            <li>Recommends the next green phase with minimum/maximum green and maximum-wait fairness.</li>
            <li>Simulates fixed-time versus adaptive control over the same arrivals, across seeds.</li>
            <li>Renders an annotated sample video with lane polygons, boxes and per-approach counts.</li>
          </ul>
        </Card>

        <Card title="What it does not do" subtitle="Stated plainly, so nothing is overclaimed.">
          <ul className="list-disc space-y-2 pl-4 text-xs leading-relaxed text-muted">
            <li>It does not use a custom-trained traffic model; the weights are stock YOLOv8n COCO.</li>
            <li>It does not track vehicles between frames, so it cannot count unique vehicles or direction of travel.</li>
            <li>It does not measure real queues, speeds, density or delay — congestion is a snapshot estimate.</li>
            <li>It cannot read a live camera feed; the input is prerecorded MP4 footage.</li>
            <li>The signal output is a recommendation, not a certified signal plan or controller.</li>
            <li>Simulation results are synthetic and are never mixed with measured values.</li>
          </ul>
        </Card>
      </div>

      <Card title="Detection limitations" subtitle="Measured on this footage.">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-border/70 bg-panel/40 p-4">
            <p className="font-mono text-lg text-ink">~8</p>
            <p className="mt-1 text-xs text-muted">
              detections on a frame where roughly 35–40 approach vehicles are visible
            </p>
          </div>
          <div className="rounded-lg border border-border/70 bg-panel/40 p-4">
            <p className="font-mono text-lg text-ink">0.10</p>
            <p className="mt-1 text-xs text-muted">
              default confidence; higher thresholds find almost nothing on this camera angle
            </p>
          </div>
          <div className="rounded-lg border border-border/70 bg-panel/40 p-4">
            <p className="font-mono text-lg text-ink">~200 ms</p>
            <p className="mt-1 text-xs text-muted">
              steady-state CPU inference per 4K frame at 1920 px
            </p>
          </div>
        </div>
        <div className="mt-4">
          <Note tone="warn">
            A larger checkpoint (YOLOv8s) was measured on the same frames and returned fewer boxes
            (13 vs 31 over four frames) at roughly 2.5× the cost, so the nano model is kept. Low
            recall is a property of the footage and the stock model, not of the lane configuration.
          </Note>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Technology" subtitle="Everything runs on this machine.">
          <dl className="grid grid-cols-2 gap-3 text-xs">
            {[
              ["Detection", "Ultralytics YOLOv8n"],
              ["Vision", "OpenCV"],
              ["API", "FastAPI + Uvicorn"],
              ["Frontend", "React + TypeScript + Tailwind"],
              ["Charts", "Recharts"],
              ["Video encode", "imageio-ffmpeg (H.264)"],
              ["Simulation", "Python queueing model"],
              ["Legacy UI", "Streamlit dashboard retained"],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-muted">{label}</dt>
                <dd className="font-mono text-ink">{value}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card title="Hardware &amp; performance" subtitle="CPU-only by design.">
          <p className="text-xs leading-relaxed text-muted">
            The project targets a CPU-only PyTorch install: Intel Core i7, 16 GB RAM, no CUDA. A
            3840×2160 frame is letterboxed to 1920 px for inference, which takes roughly 200 ms per
            frame; previews are downscaled to 1280 px JPEG so the browser never loads the full 4K
            image. The detector is created once per process and reused by every request.
          </p>
          <p className="mt-3 text-xs leading-relaxed text-muted">
            Video analysis of the 37 s clip is a one-off 3–4 minute render and is not repeated per
            page load.
          </p>
          <div className="mt-4">
            <Note>
              If CUDA becomes available, pass <span className="font-mono">device="cuda"</span> to{" "}
              <span className="font-mono">VehicleDetector</span>; nothing else needs to change.
            </Note>
          </div>
        </Card>
      </div>

      <Note tone="warn">
        This dashboard is an exhibition prototype. Detection, congestion levels, signal
        recommendations and simulation results are approximations for demonstration and learning —
        they are not measurements of a real intersection and must not be used to control traffic.
      </Note>
    </div>
  );
}
