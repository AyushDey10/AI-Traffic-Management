"""FastAPI application exposing the traffic analysis engine.

Run from the project root:

    .venv/Scripts/python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8000

Interactive docs: http://127.0.0.1:8000/docs
"""

from __future__ import annotations

import os
import re
import time
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

from backend import services
from backend.schemas import (
    AnalysisJobRequest,
    FrameAnalysisRequest,
    SeedSweepRequest,
    SignalRequest,
    SimulationCompareRequest,
    SimulationRequest,
)

STARTED_AT = time.time()
API_VERSION = "1.0.0"

app = FastAPI(
    title="AI Traffic Management API",
    version=API_VERSION,
    description=(
        "Detection, approach-level congestion snapshots, adaptive signal "
        "recommendations and traffic simulation for the exhibition prototype. "
        "All values come from the project's own video and models; detections are "
        "frame-level and simulations are synthetic."
    ),
)

CORS_ORIGINS = [
    origin.strip().rstrip("/")
    for origin in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173",
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

app.mount("/media", StaticFiles(directory=str(services.PREVIEW_DIR)), name="media")


@app.exception_handler(FileNotFoundError)
async def handle_missing_file(_: Request, error: FileNotFoundError):
    return JSONResponse(status_code=404, content={"detail": str(error)})


@app.exception_handler(ValueError)
async def handle_value_error(_: Request, error: ValueError):
    return JSONResponse(status_code=400, content={"detail": str(error)})


# --------------------------------------------------------------------------
# Meta
# --------------------------------------------------------------------------


@app.get("/", include_in_schema=False)
def index():
    return RedirectResponse(url="/docs")


@app.get("/api/health", tags=["meta"], summary="Service health and model state")
def health():
    weights = services.PROJECT_ROOT / "yolov8n.pt"
    model_state = "missing"
    model_error = None

    if weights.exists():
        try:
            services.get_analyzer(services.DEFAULT_CONFIDENCE, services.DEFAULT_IMAGE_SIZE)
            model_state = "loaded"
        except Exception as error:  # reported, not swallowed
            model_state = "error"
            model_error = f"{type(error).__name__}: {error}"

    videos = services.list_videos()

    try:
        import cv2
        import ultralytics

        versions = {
            "ultralytics": ultralytics.__version__,
            "opencv": cv2.__version__,
            "fastapi": app.version,
        }
    except Exception:
        versions = {"fastapi": app.version}

    return {
        "status": "ok" if model_state == "loaded" else "degraded",
        "api_version": API_VERSION,
        "model": {
            "file": weights.name,
            "state": model_state,
            "error": model_error,
            "device": "cpu",
            "confidence": services.DEFAULT_CONFIDENCE,
            "image_size": services.DEFAULT_IMAGE_SIZE,
            "custom_trained": False,
        },
        "versions": versions,
        "videos_available": len(videos),
        "processed_video_available": any(video["has_processed_video"] for video in videos),
        "uptime_seconds": round(time.time() - STARTED_AT, 1),
        "time": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }


@app.get("/api/config", tags=["meta"], summary="Lane polygons, thresholds and signal settings")
def config():
    return services.platform_config()


# --------------------------------------------------------------------------
# Video catalogue
# --------------------------------------------------------------------------


@app.get("/api/videos", tags=["videos"], summary="List videos available for analysis")
def videos():
    items = services.list_videos()
    return {"count": len(items), "videos": items}


@app.post("/api/videos/upload", tags=["videos"], status_code=201, summary="Upload a traffic video")
async def upload_video(file: UploadFile = File(...)):
    name = re.sub(r"[^A-Za-z0-9._-]", "_", Path(file.filename or "upload.mp4").name)
    suffix = Path(name).suffix.lower()

    if suffix not in services.VIDEO_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported video type '{suffix or 'unknown'}'. "
            f"Allowed: {', '.join(sorted(services.VIDEO_EXTENSIONS))}",
        )

    target = services.UPLOAD_DIR / name
    if target.exists():
        target = services.UPLOAD_DIR / f"{Path(name).stem}_{int(time.time())}{suffix}"

    written = 0
    try:
        with target.open("wb") as handle:
            while chunk := await file.read(1024 * 1024):
                written += len(chunk)
                if written > services.MAX_UPLOAD_BYTES:
                    raise HTTPException(
                        status_code=413,
                        detail=f"Video exceeds the {services.MAX_UPLOAD_BYTES // (1024 * 1024)} MB limit",
                    )
                handle.write(chunk)

        info = services.probe_video(target)
    except HTTPException:
        target.unlink(missing_ok=True)
        raise
    except (ValueError, FileNotFoundError) as error:
        target.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail=f"Unreadable video file: {error}")

    # Uploaded files are analysed from the uploads directory; expose them under
    # the same catalogue by copying the metadata only.
    info["has_processed_video"] = False
    info["processed_url"] = None
    info["source_url"] = None
    info["stored_in"] = "data/uploads"
    return info


def _video_path(video_id: str) -> Path:
    try:
        return services.resolve_video(video_id)
    except FileNotFoundError:
        uploaded = services.UPLOAD_DIR / Path(video_id).name
        if uploaded.exists():
            return uploaded
        raise HTTPException(status_code=404, detail=f"Video not found: {video_id}")


def _range_response(path: Path, request: Request, media_type: str = "video/mp4"):
    """Serve a file with HTTP range support so the player can seek."""
    size = path.stat().st_size
    range_header = request.headers.get("range")

    if not range_header:
        return FileResponse(path, media_type=media_type, filename=path.name)

    match = re.match(r"bytes=(\d*)-(\d*)", range_header)
    if not match:
        raise HTTPException(status_code=416, detail="Invalid Range header")

    start_raw, end_raw = match.groups()
    if start_raw:
        start = int(start_raw)
        end = int(end_raw) if end_raw else size - 1
    else:
        length = int(end_raw) if end_raw else 1
        start = max(0, size - length)
        end = size - 1

    if start >= size or end < start:
        raise HTTPException(status_code=416, detail="Requested range not satisfiable")

    end = min(end, size - 1)
    chunk_size = 1024 * 512

    def iterator():
        with path.open("rb") as handle:
            handle.seek(start)
            remaining = end - start + 1
            while remaining > 0:
                chunk = handle.read(min(chunk_size, remaining))
                if not chunk:
                    break
                remaining -= len(chunk)
                yield chunk

    headers = {
        "Content-Range": f"bytes {start}-{end}/{size}",
        "Accept-Ranges": "bytes",
        "Content-Length": str(end - start + 1),
    }
    return StreamingResponse(iterator(), status_code=206, media_type=media_type, headers=headers)


@app.get("/api/videos/{video_id}/source", tags=["videos"], summary="Stream the original video")
def video_source(video_id: str, request: Request):
    return _range_response(_video_path(video_id), request)


@app.get("/api/videos/{video_id}/processed", tags=["videos"], summary="Stream the annotated sample video")
def video_processed(video_id: str, request: Request):
    stem = Path(video_id).stem
    processed = services._processed_path_for(stem)

    if not processed or not processed.exists():
        raise HTTPException(
            status_code=404,
            detail=f"No annotated video for '{video_id}'. Generate one with scripts/regenerate_processed_video.py",
        )

    return _range_response(processed, request)


# --------------------------------------------------------------------------
# Analysis
# --------------------------------------------------------------------------


@app.post("/api/analysis/frame", tags=["analysis"], summary="Analyse one video frame")
def analyse_frame(body: FrameAnalysisRequest):
    return services.analyse_frame(
        video_id=body.video_id,
        timestamp=body.timestamp,
        confidence=body.confidence,
        image_size=body.image_size,
    )


@app.post("/api/analysis/jobs", tags=["analysis"], status_code=202, summary="Start a multi-timestamp scan")
def start_job(body: AnalysisJobRequest):
    try:
        services.resolve_video(body.video_id)
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error))

    job = services.JOBS.create(
        video_id=body.video_id,
        interval=body.interval_seconds,
        limit=body.limit,
        confidence=body.confidence,
        image_size=body.image_size,
    )
    return {"job_id": job["job_id"], "status": job["status"]}


@app.get("/api/analysis/jobs/{job_id}", tags=["analysis"], summary="Poll a scan job")
def get_job(job_id: str):
    job = services.JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Unknown job: {job_id}")
    return job


@app.get("/api/analysis/latest", tags=["analysis"], summary="Most recent completed scan")
def latest_job():
    job = services.JOBS.latest_completed()
    if not job:
        raise HTTPException(
            status_code=404,
            detail="No completed scan yet. POST /api/analysis/jobs to start one.",
        )
    return job


# --------------------------------------------------------------------------
# Simulation and signals
# --------------------------------------------------------------------------


@app.post("/api/simulation/run", tags=["simulation"], summary="Run one control strategy")
def simulate(body: SimulationRequest):
    return {
        "request": body.model_dump(),
        "result": services.run_simulation(body.duration, body.seed, body.policy),
    }


@app.post("/api/simulation/compare", tags=["simulation"], summary="Compare fixed vs adaptive for one seed")
def simulate_compare(body: SimulationCompareRequest):
    return services.compare_simulation(body.duration, body.seed)


@app.post("/api/simulation/seeds", tags=["simulation"], summary="Aggregate both strategies over several seeds")
def simulate_seeds(body: SeedSweepRequest):
    if len(set(body.seeds)) != len(body.seeds):
        raise HTTPException(status_code=400, detail="Seeds must be unique")
    if any(seed < 0 for seed in body.seeds):
        raise HTTPException(status_code=400, detail="Seeds must be zero or positive")
    return services.sweep_seeds(body.duration, body.seeds)


@app.post("/api/signals/recommend", tags=["signals"], summary="Recommend the next green phase")
def recommend(body: SignalRequest):
    unknown = set(body.demand) - set(services.LANES)
    if unknown:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown approach(es): {', '.join(sorted(unknown))}",
        )
    if any(value < 0 for value in body.demand.values()):
        raise HTTPException(status_code=400, detail="Demand values cannot be negative")

    return services.recommend_signal(body.demand, body.wait)
