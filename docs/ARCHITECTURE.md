# Architecture and design decisions

## Module map

| Path | Responsibility |
| --- | --- |
| `src/detection/vehicle_detector.py` | YOLO wrapper: configurable confidence/size/device, weight check, process-wide model cache, detection dicts |
| `src/traffic/lane_config.py` | Normalised approach polygons, pixel conversion, centre-point assignment, lane colours |
| `src/traffic/traffic_analyzer.py` | Detection + approach split + annotated frame (boxes, polygons, counts) |
| `src/traffic/congestion_estimator.py` | Weighted demand, capacity normalisation, levels, snapshot summary |
| `src/traffic/video_processor.py` | Native-resolution detection, H.264 rendering, honest detection totals |
| `src/simulation/signal_controller.py` | Service-rate constant, green bounds, fairness, decision reasons |
| `src/simulation/traffic_simulator.py` | Discrete-time queueing model, per-vehicle waits, per-lane stats, seed comparisons |
| `backend/services.py` | Analyzer cache, frame reads, preview saving, snapshot cache, job store, simulation helpers |
| `backend/main.py` | FastAPI routes, CORS, static media, range streaming, error handlers |
| `frontend/src` | React dashboard; `lib/api.ts` is the typed contract with the backend |
| `app.py` | Legacy Streamlit dashboard using the same modules |

## Request flow

```
POST /api/analysis/frame
  → services.analyse_frame
      → resolve_video (path-traversal safe, data/videos then data/uploads)
      → read_frame (OpenCV seek to timestamp)
      → get_analyzer (lru_cache keyed by confidence + image size)
      → TrafficAnalyzer.analyze_frame
          → VehicleDetector.detect (YOLOv8n, imgsz 1920, CPU)
          → get_lane(box centre) per detection
          → draw polygons + approach counts
      → CongestionEstimator.estimate
      → AdaptiveSignalController.decide
      → save_preview (1280 px JPEG)
  ← JSON snapshot + /media URL
```

Snapshot objects are cached by `(video, timestamp, confidence, image_size)`, so
revisiting a frame is instant. Jobs reuse the same function, which also warms
the cache for the frame views.

## Why the detector is configured this way

Measured on a single 10 s frame of the source video:

| `imgsz` | Detections | Time |
| --- | --- | --- |
| 640 | 0 | 0.10 s |
| 1280 | 1 | 0.10 s |
| 1920 | 8 | 0.20 s |
| 2560 | 8 | 0.41 s |

1920 is the practical ceiling: 2560 doubles the cost with no gain. Across four
timestamps (2, 10, 20, 30 s) at 1920 px:

| Confidence | Detections | Unassigned |
| --- | --- | --- |
| 0.05 | 49 | 9 |
| 0.08 | 36 | 6 |
| 0.10 | 31 | 6 |
| 0.15 | 22 | 3 |
| 0.10 @ 2560 | 34 | 7 |
| 0.10 @ 1280 | 16 | 1 |

`0.10` at `1920` was chosen: it recovers roughly twice as many vehicles as 0.15
while keeping unassigned boxes low. A larger checkpoint (`yolov8s.pt`) was also
tested and returned **fewer** boxes (13 vs 31 over the same four frames) at
about 500 ms/frame, so the nano model is retained and the larger weights were
removed.

## Approach assignment

Each detection is assigned by its box centre, tested against four polygons that
cover only the incoming carriageway. Consequences:

- Vehicles in the opposing carriageway, on the median or on crosswalks are
  `Unassigned` and excluded from demand.
- A vehicle straddling a polygon edge can be assigned to the neighbouring
  approach.
- Large merged boxes (for example a false-positive bus spanning several cars)
  are assigned by the centre of that box.

Polygon overlap is asserted in `tests/test_lane_config.py`; see
`docs/LANE_CALIBRATION.md` for the geometry.

## Congestion model

```
weighted_demand = Σ class_count × class_weight      (weights capped at 1.6)
utilisation     = weighted_demand / lane_capacity    (default 18 units)
level           = Empty | Low | Moderate | High | Severe
```

Thresholds are utilisation-based, not raw counts, so the estimate is independent
of how many lanes a polygon covers. Capacity is a single configurable constant
rather than a per-lane physical measurement — this is an estimate, not metering.

## Signal controller

The simulator and the controller share `SERVICE_RATE = 1.5 veh/s`, the discharge
rate of a ~3-lane approach at saturation flow. Green time is derived from the
same constant, so a recommendation and a simulation of that recommendation use
consistent units:

```
green = clamp(MIN_GREEN * 0.5 + demand / SERVICE_RATE, MIN_GREEN, MAX_GREEN)
```

Selection order:

1. Ignore approaches with zero demand.
2. Serve any approach whose wait reaches `MAX_WAIT` (45 s), longest wait first.
3. Otherwise serve the highest demand.
4. Break ties by rotating from the last served approach.

`MAX_WAIT` was tuned over ten seeds at 600 s:

| `MAX_WAIT` | Adaptive mean wait | Adaptive max wait |
| --- | --- | --- |
| 45 | 25.1 s | 61 s |
| 60 | 24.3 s | 72 s |
| 75 | 23.6 s | 83 s |
| 90 | 23.3 s | 93 s |

Fixed-time over the same seeds: 28.2 s mean, 66 s maximum. A 45 s bound gives a
worse mean than 90 s but a better worst case than the fixed plan, which is the
point of a fairness limit — a bound of 90 s produced a 93 s worst case, i.e. the
"protection" was the source of the longest wait.

## Simulation model

- One approach is green at a time; phases are green → yellow (3 s) → all-red (1 s).
- Arrivals are Bernoulli trials per second per approach with a seeded RNG.
- Service accrues as fractional credit at `SERVICE_RATE`, so 1.5 veh/s is exact
  over time rather than rounded per second.
- Every arrival timestamp is stored, so wait = departure − arrival. Vehicles
  still queued at the end contribute their elapsed wait (censored), and the
  headline average includes them.
- Fixed-time rotates 15 s green per approach; adaptive asks the controller each
  cycle with the live queue lengths and waits.
- Both policies draw from the same seed and the same per-second arrival loop, so
  they face identical traffic. Adaptive is not tuned per seed.

Demand (0.70 veh/s total) against capacity (~1.18 veh/s for four sequential
phases) gives v/c ≈ 0.59 — loaded but not saturated. An earlier configuration
(0.5 veh/s service rate with 0.70 veh/s arrivals) was 1.8× oversaturated and
produced 100+ vehicle queues, which made every metric meaningless.

## API and concurrency

- FastAPI runs sync endpoints in a threadpool; YOLO calls are serialised by the
  GIL and by a single-worker executor for jobs.
- The model is loaded once per process (`lru_cache`), never per request.
- Video streaming implements HTTP range requests manually so seeking works
  without loading a 15 MB file into memory.
- Errors map to explicit status codes; unexpected exceptions are logged by
  Uvicorn with a traceback rather than swallowed.

## Frontend

- React + TypeScript + Tailwind, six routes, no mock data.
- `lib/TrafficContext.tsx` loads health, the video list and one frame snapshot on
  start so the overview and signal pages share a single analysis.
- `lib/api.ts` types every payload; the build fails on a contract mismatch.
- Charts use Recharts; every series is fed from API responses.
- The video page explicitly labels its input as prerecorded footage.

## Data honesty

Four different kinds of numbers appear in the UI and are labelled separately:

1. **Detections** — what YOLO returned for one frame.
2. **Congestion** — a snapshot estimate derived from those detections.
3. **Signal recommendation** — a rule applied to that estimate.
4. **Simulation** — synthetic traffic, never derived from the footage.

No simulation output is presented as a measurement, and no unique-vehicle count
is claimed anywhere.
