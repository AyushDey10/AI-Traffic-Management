# AI-Powered Intelligent Traffic Management System

An educational, exhibition-ready prototype that analyses recorded intersection
footage with YOLOv8, estimates per-approach congestion, recommends adaptive
signal phases and simulates fixed-time versus adaptive control.

> **This is not a production traffic controller.** Detections, congestion levels,
> signal recommendations and simulation results are approximations for
> demonstration and learning. Nothing here is a measurement of a real road.

---

## What the project actually does

| Stage | Implementation | Honest description |
| --- | --- | --- |
| Vehicle detection | `src/detection/vehicle_detector.py` | Stock **YOLOv8n COCO** weights, four vehicle classes, per-frame boxes |
| Approach assignment | `src/traffic/lane_config.py` | Box-centre test against four calibrated polygons covering only incoming carriageways |
| Congestion estimate | `src/traffic/congestion_estimator.py` | Weighted detection units ÷ configurable approach capacity, mapped to a level |
| Signal recommendation | `src/simulation/signal_controller.py` | Rule-based next green phase with min/max green and maximum-wait fairness |
| Traffic simulation | `src/simulation/traffic_simulator.py` | Discrete-time queueing model of the four approaches |
| Annotated video | `src/traffic/video_processor.py` | Frame-level detections rendered to H.264, no tracking |
| HTTP API | `backend/` | FastAPI service wrapping the modules above |
| Dashboard | `frontend/` | React + TypeScript + Tailwind command-centre UI |
| Legacy dashboard | `app.py` | Original Streamlit UI, retained and working |

### What it does **not** do

- No custom-trained traffic model — the weights are stock YOLOv8n COCO.
- No multi-object tracking, therefore **no unique vehicle counts** and no
  direction-of-travel inference.
- No measurement of physical queue length, speed, density or delay.
- No live camera support: the input is prerecorded footage.
- No certified signal plan: the controller output is a recommendation.

The detector misses a large share of vehicles on this aerial footage. On a frame
where roughly 35–40 approach vehicles are visible, about 8 detections are
returned at the default confidence of 0.10. This is a known limitation of a
stock COCO model on this camera angle, not a configuration bug.

---

## Architecture

```
data/videos/traffic_compressed_crf28.mp4 (3840x2160, 24 fps, 37.4 s)
        │
        ▼
backend/services.py ── read frame at timestamp
        │
        ▼
TrafficAnalyzer ──► VehicleDetector (YOLOv8n, imgsz 1920, CPU)
        │                    │
        │                    └─ boxes + class + confidence
        ▼
lane_config.get_lane()  ──► North / South / East / West / Unassigned
        │
        ├──► CongestionEstimator ──► weighted demand, utilisation, level
        ├──► AdaptiveSignalController ──► next phase + green time + reason
        └──► annotated JPEG preview (1280 px)
                    │
                    ▼
            FastAPI  ◄──►  React dashboard
```

The Streamlit app in `app.py` uses the same modules directly.

---

## Installation

Python 3.12 and Node 18+ are required. From the project root:

```bash
python -m venv .venv
.venv/Scripts/python.exe -m pip install -r requirements.txt
```

Place the YOLO weights at `yolov8n.pt` in the project root (already present).

Frontend dependencies:

```bash
cd frontend
npm install
```

---

## Running

### 1. Backend API

```bash
.venv/Scripts/python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

- API root: <http://127.0.0.1:8000>
- Interactive docs: <http://127.0.0.1:8000/docs>
- Health: <http://127.0.0.1:8000/api/health>

### 2. Frontend dashboard

```bash
cd frontend
npm run dev
```

Open **<http://127.0.0.1:5173>**. The dev server proxies `/api` and `/media` to
port 8000, so both processes must be running.

Production build:

```bash
cd frontend
npm run build      # type-checks, then writes frontend/dist
npm run preview    # serves the build on http://127.0.0.1:4173
```

The preview server does not proxy the API; set `VITE_API_BASE` at build time if
you serve the build from another origin.

### 3. Legacy Streamlit dashboard

```bash
.venv/Scripts/python.exe -m streamlit run app.py
```

---

## Configuration

### Lane polygons

All four approaches live in `src/traffic/lane_config.py` as normalised
polygons. They were calibrated against grid-annotated frames of the source
video. Each polygon covers only the incoming carriageway; the opposing
carriageway, the painted median and the crosswalks are excluded. See
`docs/LANE_CALIBRATION.md` for the measurements and the validation results.

### Detection

| Setting | Default | Where |
| --- | --- | --- |
| Confidence | `0.10` | `VehicleDetector.DEFAULT_CONFIDENCE` |
| Inference size | `1920` | `VehicleDetector.DEFAULT_IMAGE_SIZE` |
| Device | `cpu` | `VehicleDetector.DEFAULT_DEVICE` |
| Weights | `yolov8n.pt` | `DEFAULT_MODEL_PATH` |

Measured at a fixed frame: 640 px → 0 detections, 1280 px → 1, 1920 px → 8,
2560 px → 8. 1920 is the practical ceiling. A larger checkpoint (YOLOv8s) found
*fewer* boxes (13 vs 31 across four frames) at about 2.5× the cost, so it is not
used.

### Congestion

`CongestionEstimator(vehicle_weights=..., lane_capacity=18.0, max_class_weight=1.6)`.
Utilisation thresholds: `0` Empty, `<0.20` Low, `<0.45` Moderate, `<0.70` High,
otherwise Severe. Class weights are unit multipliers capped at 1.6, so a single
mislabelled bus cannot dominate demand.

### Signal control

| Constant | Value | Meaning |
| --- | --- | --- |
| `SERVICE_RATE` | 1.5 veh/s | ~3 lanes × 0.5 veh/s saturation flow on one green approach |
| `MIN_GREEN` / `MAX_GREEN` | 12 s / 45 s | Green bounds |
| `YELLOW_TIME` / `ALL_RED_TIME` | 3 s / 1 s | Intergreen |
| `MAX_WAIT` | 45 s | Fairness limit: an approach waiting this long is served regardless of demand |

Green time = `MIN_GREEN * 0.5 + demand / SERVICE_RATE`, clamped to the bounds.

### Simulation

Default arrival rates (vehicles/second): North 0.13, East 0.24, South 0.11,
West 0.22 — 0.70 veh/s total against roughly 1.18 veh/s of capacity, i.e. a
v/c ratio near 0.59. The intersection is deliberately loaded but **not**
saturated, so both strategies operate under identical, fair conditions.

The headline wait metric includes vehicles still queued at the end of the run
(censored wait); `average_wait_served_seconds` and
`average_wait_remaining_seconds` are reported separately.

---

## API

Full details in [`docs/API.md`](docs/API.md). Summary:

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Service and model state |
| GET | `/api/config` | Polygons, thresholds, signal and simulation settings |
| GET | `/api/videos` | Available videos with metadata |
| POST | `/api/videos/upload` | Upload footage |
| GET | `/api/videos/{id}/source` | Range-enabled source stream |
| GET | `/api/videos/{id}/processed` | Range-enabled annotated stream |
| POST | `/api/analysis/frame` | Analyse one frame |
| POST | `/api/analysis/jobs` | Start a multi-timestamp scan |
| GET | `/api/analysis/jobs/{id}` | Poll the scan |
| GET | `/api/analysis/latest` | Last completed scan |
| POST | `/api/simulation/run` | Single strategy run |
| POST | `/api/simulation/compare` | Fixed vs adaptive, one seed |
| POST | `/api/simulation/seeds` | Multi-seed aggregate |
| POST | `/api/signals/recommend` | Next-phase recommendation |

The detector is created once per process (`lru_cache`) and reused; snapshots are
cached by `(video, timestamp, confidence, image_size)`.

---

## Testing

```bash
.venv/Scripts/python.exe -m py_compile $(find src backend scripts -name "*.py")
.venv/Scripts/python.exe -m pytest
cd frontend && npm run build
```

`tests/` covers polygon conversion and non-overlap, approach assignment
(including opposing carriageways and crosswalks), congestion thresholds and
weights, controller fairness and green bounds, simulation reproducibility and
vehicle conservation, and the API endpoints including invalid input handling.

The `test_*.py` scripts in the project root are older print-only diagnostics and
are **not** collected by pytest (`testpaths = tests`).

---

## Regenerating the annotated video

```bash
.venv/Scripts/python.exe scripts/regenerate_processed_video.py
```

Detects on native 4K frames, draws polygons/boxes/counts, and encodes H.264 via
the bundled `imageio-ffmpeg` binary. The source video is never modified. A full
render of the 37 s clip takes roughly 3–4 minutes on CPU and writes about 15 MB.

---

## Hardware and performance

- Tested on Windows 11, Intel Core i7, 16 GB RAM, **CPU-only** PyTorch.
- Steady-state inference: about 200 ms per 4K frame at 1920 px.
- Frame previews are downscaled to 1280 px JPEG so the browser never receives a
  13 MB 4K image.
- The annotated video is a one-off render, not regenerated per request.

To use CUDA when available, pass `device="cuda"` to `VehicleDetector`.

---

## Known limitations

1. Low recall on aerial footage; North and South approaches often report zero
   detections even though vehicles are clearly present.
2. Occasional class errors (groups of cars reported as a bus).
3. Box-centre assignment can mis-assign vehicles straddling a polygon edge.
4. Congestion is a single-frame estimate and cannot show a trend.
5. Signal recommendations have no queue history in the single-frame view, so
   waiting time is only meaningful in the simulator or the what-if form.
6. The simulation is a queueing abstraction (one green approach at a time), not
   a microsimulation with lane changes, turning movements or spillback.
7. Uploaded videos can be analysed frame by frame but have no annotated video
   until one is rendered.

---

## Project layout

```
app.py                     Streamlit dashboard (legacy, working)
backend/                   FastAPI app, service layer, schemas
  main.py                  Routes
  services.py              Analyzer cache, frame reads, jobs, simulation helpers
frontend/                  React + TypeScript + Tailwind dashboard
  src/pages/               Overview, Video, Simulation, Signals, Analytics, About
  src/lib/api.ts           Typed API client
data/videos/traffic_compressed_crf28.mp4    Source footage (untouched)
data/processed/            Annotated video + preview JPEGs
scripts/                   Reproducible video regeneration
src/detection/             YOLO wrapper
src/traffic/               Lane config, analyzer, congestion, video processor
src/simulation/            Signal controller, queueing simulator
tests/                     Pytest suite
docs/                      API, architecture and lane calibration notes
```

---

## Data honesty

Values shown in the dashboard are labelled by origin:

- **Detections** — frame-level YOLO output, not unique vehicles.
- **Congestion** — snapshot estimate from weighted detections.
- **Signal recommendation** — rule-based decision support.
- **Simulation** — synthetic traffic from the queueing model.

Simulated results are never presented as measurements of the recorded footage.
