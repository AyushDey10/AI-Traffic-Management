# HTTP API

Base URL: `http://127.0.0.1:8000` (loopback only). Interactive documentation is
served at `/docs` (Swagger UI) and `/redoc`.

Start the service from the project root:

```bash
.venv/Scripts/python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

All request and response bodies are JSON except video upload (`multipart/form-data`)
and media streaming (`video/mp4`, `image/jpeg`).

## Error format

Errors return a `detail` string:

```json
{ "detail": "Video not found: missing.mp4" }
```

| Status | Meaning |
| --- | --- |
| 400 | Validation that the schema cannot express (timestamp past the end of the video, unknown approach, unreadable upload) |
| 404 | Unknown video or job, or no annotated video generated yet |
| 413 | Upload larger than 250 MB |
| 422 | Pydantic schema violation (wrong type, out-of-range number, unknown enum) |
| 500 | Unhandled server error — check the Uvicorn log |

---

## Meta

### `GET /api/health`

```json
{
  "status": "ok",
  "api_version": "1.0.0",
  "model": {
    "file": "yolov8n.pt",
    "state": "loaded",
    "error": null,
    "device": "cpu",
    "confidence": 0.1,
    "image_size": 1920,
    "custom_trained": false
  },
  "versions": { "ultralytics": "8.4.218", "opencv": "5.1.0", "fastapi": "1.0.0" },
  "videos_available": 1,
  "processed_video_available": true,
  "uptime_seconds": 42.1,
  "time": "2026-11-26T13:00:00+00:00"
}
```

`status` is `degraded` when the weights are missing or fail to load; `model.state`
is then `missing` or `error` with the reason in `model.error`.

### `GET /api/config`

Returns lane polygons, congestion weights and thresholds, detection settings,
signal constants and simulation defaults. Used by the dashboard to explain the
numbers it shows.

---

## Videos

### `GET /api/videos`

```json
{
  "count": 1,
  "videos": [
    {
      "id": "traffic.mp4",
      "filename": "traffic.mp4",
      "duration_seconds": 37.38,
      "fps": 24.0,
      "frame_count": 897,
      "width": 3840,
      "height": 2160,
      "size_mb": 104.0,
      "has_processed_video": true,
      "processed_filename": "traffic_detected_h264.mp4",
      "source_url": "/api/videos/traffic.mp4/source",
      "processed_url": "/api/videos/traffic.mp4/processed"
    }
  ]
}
```

### `POST /api/videos/upload`

`multipart/form-data` with a single `file` field. Accepted extensions: `.mp4`,
`.avi`, `.mov`, `.mkv`; maximum 250 MB. Files are stored in `data/uploads`.

```bash
curl -X POST http://127.0.0.1:8000/api/videos/upload -F "file=@clip.mp4"
```

Returns the probe result with `stored_in: "data/uploads"`.

### `GET /api/videos/{video_id}/source` and `/processed`

Stream the original or annotated video. Both support `Range` requests, so the
browser player can seek:

```
GET /api/videos/traffic.mp4/processed
Range: bytes=0-1023

HTTP/1.1 206 Partial Content
Content-Range: bytes 0-1023/16053185
```

`/processed` returns 404 when no annotated video exists for that file.

---

## Analysis

### `POST /api/analysis/frame`

```json
{ "video_id": "traffic.mp4", "timestamp": 10, "confidence": 0.1, "image_size": 1920 }
```

| Field | Default | Bounds |
| --- | --- | --- |
| `video_id` | `traffic.mp4` | file name from `/api/videos` |
| `timestamp` | `10` | `0 ≤ t ≤ 3600`, and within the video |
| `confidence` | `0.10` | `0 < c ≤ 1` |
| `image_size` | `1920` | `320 ≤ px ≤ 2560` (rounded to a multiple of 32) |

Response (abridged):

```json
{
  "video_id": "traffic.mp4",
  "timestamp": 10.0,
  "processing_ms": 198.4,
  "image_url": "/media/traffic_0010.00_c140974546.jpg",
  "total_detections": 8,
  "unassigned": 0,
  "lanes": [
    {
      "name": "North",
      "total": 0,
      "classes": { "Car": 0, "Motorcycle": 0, "Bus": 0, "Truck": 0 },
      "share": 0.0,
      "weighted_demand": 0.0,
      "utilisation": 0.0,
      "congestion": "Empty"
    }
  ],
  "classes": [{ "name": "Car", "count": 5 }],
  "detections": [
    { "class": "Car", "confidence": 0.2, "lane": "East", "box_normalised": [0.83, 0.45, 0.9, 0.47] }
  ],
  "congestion_summary": {
    "total_weighted_demand": 7.2,
    "dominant_approach": "West",
    "average_utilisation": 0.1,
    "is_snapshot": true
  },
  "signal": {
    "green_lane": "West",
    "green_duration": 17,
    "priority": "max_demand",
    "reason": "West has the highest weighted demand (7.2 vehicle units) of the active approaches."
  },
  "settings": { "confidence": 0.1, "image_size": 1920, "device": "cpu", "model": "yolov8n.pt" }
}
```

Results are cached by `(video, timestamp, confidence, image_size)`; the preview
JPEG is written to `data/processed/previews` and served from `/media`.

### `POST /api/analysis/jobs`

```json
{ "video_id": "traffic.mp4", "interval_seconds": 5, "limit": 8 }
```

Returns `202` with `{ "job_id": "...", "status": "queued" }`. The job runs on a
single background worker (YOLO is CPU-bound, so work is serialised).

### `GET /api/analysis/jobs/{job_id}`

```json
{
  "job_id": "9f2c1a0b7d33",
  "status": "completed",
  "progress": 8,
  "total": 8,
  "error": null,
  "result": {
    "samples": [{ "timestamp": 0, "total": 8, "lanes": { "North": 0 }, "congestion": {}, "signal": {} }],
    "summary": {
      "samples": 8,
      "approach_totals": { "North": 0, "South": 0, "East": 6, "West": 39 },
      "class_totals": { "Car": 30, "Motorcycle": 1, "Bus": 5, "Truck": 3 },
      "note": "Summed per-frame detections over sampled timestamps..."
    }
  }
}
```

`status` is `queued`, `running`, `completed` or `failed` (with `error` set).

### `GET /api/analysis/latest`

Returns the most recently completed job, or `404` if none exists.

---

## Simulation

### `POST /api/simulation/run`

```json
{ "duration": 600, "seed": 42, "policy": "adaptive" }
```

`policy` is `fixed` or `adaptive`; `duration` is 60–1800 s. Returns the full run:
`total_arrivals`, `vehicles_served`, `vehicles_remaining`, `throughput_per_minute`,
`average_queue`, `maximum_queue`, `average_wait_seconds`,
`average_wait_served_seconds`, `average_wait_remaining_seconds`,
`maximum_wait_seconds`, `long_wait_events`, `per_lane`, a 5-second `timeseries`
and the first 24 `decisions`.

### `POST /api/simulation/compare`

```json
{ "duration": 600, "seed": 42 }
```

```json
{ "seed": 42, "fixed_time": { }, "adaptive": { } }
```

Both runs use the same seed, therefore identical arrival sequences.

### `POST /api/simulation/seeds`

```json
{ "duration": 600, "seeds": [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] }
```

Returns per-seed `rows` plus a `summary` with `mean`, `std`, `min` and `max` for
`vehicles_served`, `vehicles_remaining`, `average_queue`,
`average_wait_seconds`, `maximum_wait_seconds`, `throughput_per_minute` and
`long_wait_events`, along with `adaptive_lower_wait_seeds` and
`adaptive_served_more_seeds`. Seeds must be unique and non-negative (400 otherwise).

---

## Signals

### `POST /api/signals/recommend`

```json
{
  "demand": { "North": 3, "South": 2, "East": 40, "West": 2 },
  "wait": { "North": 10, "South": 62, "East": 4, "West": 8 }
}
```

`demand` values are weighted vehicle units; `wait` is optional (seconds since the
approach's last green) and drives the fairness rule.

```json
{
  "green_lane": "South",
  "green_duration": 12,
  "yellow_duration": 3,
  "all_red_duration": 1,
  "priority": "max_wait",
  "waiting_seconds": 62,
  "expected_cleared_units": 18,
  "reason": "South has waited 62s, which reaches the 45s fairness limit...",
  "service_rate": 1.5,
  "green_bounds": [12, 45],
  "max_wait_limit": 45
}
```

Unknown approach names and negative demand return `400`. When every demand is
zero the response has `green_lane: null` and `priority: "none"`.

---

## Media

Preview JPEGs are served at `GET /media/{filename}` (static). They are 1280 px
wide and are regenerated on demand by frame analysis.

---

## Limits and behaviour

- One background worker for scan jobs; a scan of 8 samples takes roughly 2–3 s.
- Frame analysis is CPU-bound (~200 ms per frame plus decode).
- Detector weights are loaded once per process.
- Snapshots are cached in memory (up to 64 entries).
- All services bind to loopback; there is no authentication because the API is
  intended for local exhibition use. Do not expose it to a network.
