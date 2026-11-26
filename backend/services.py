"""Shared services for the HTTP API.

Everything heavy (YOLO weights, frame analysis, simulation) lives here so the
routes stay thin and the detector is created once per process instead of once
per request.
"""

from __future__ import annotations

import hashlib
import logging
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path

import cv2

from src.detection.vehicle_detector import available_device
from src.simulation.signal_controller import (
    ALL_RED_TIME,
    MAX_GREEN,
    MAX_WAIT,
    MIN_GREEN,
    SERVICE_RATE,
    YELLOW_TIME,
    AdaptiveSignalController,
)
from src.simulation.traffic_simulator import (
    DEFAULT_ARRIVAL_RATES,
    FIXED_GREEN_TIME,
    TrafficSimulator,
)
from src.traffic.congestion_estimator import DEFAULT_VEHICLE_WEIGHTS, CongestionEstimator
from src.traffic.lane_config import LANE_POLYGONS, LANES
from src.traffic.traffic_analyzer import TrafficAnalyzer

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = PROJECT_ROOT / "data"
VIDEO_DIR = DATA_DIR / "videos"
PROCESSED_DIR = DATA_DIR / "processed"
PREVIEW_DIR = PROCESSED_DIR / "previews"
UPLOAD_DIR = DATA_DIR / "uploads"

for directory in (VIDEO_DIR, PROCESSED_DIR, PREVIEW_DIR, UPLOAD_DIR):
    directory.mkdir(parents=True, exist_ok=True)

DEFAULT_CONFIDENCE = 0.10
DEFAULT_IMAGE_SIZE = 1920
PREVIEW_WIDTH = 1280
MAX_UPLOAD_BYTES = 250 * 1024 * 1024
VIDEO_EXTENSIONS = {".mp4", ".avi", ".mov", ".mkv"}
CLASS_NAMES = ("Car", "Motorcycle", "Bus", "Truck")

NOTE_TRACKING = (
    "Detections are frame-level only. No multi-object tracking is used, so "
    "the same vehicle is counted again in every frame."
)
NOTE_RECALL = (
    "The stock COCO model was not trained on this aerial footage; recall on "
    "approach vehicles is low, so counts are a lower bound."
)


LOGGER = logging.getLogger("traffic.api")


@lru_cache(maxsize=8)
def get_analyzer(confidence: float = DEFAULT_CONFIDENCE, image_size: int = DEFAULT_IMAGE_SIZE):
    """Return a reusable analyzer (the YOLO weights are shared process-wide).

    One dummy inference is run so the first real request does not pay the
    graph warm-up cost and report an inflated processing time.
    """
    import numpy as np

    analyzer = TrafficAnalyzer(confidence=confidence, image_size=image_size)
    try:
        analyzer.detector.detect(np.zeros((720, 1280, 3), dtype=np.uint8))
    except Exception as error:  # a warm-up failure must not hide the real request
        LOGGER.warning("Detector warm-up failed: %s: %s", type(error).__name__, error)
    return analyzer


def get_estimator():
    return CongestionEstimator()


# --------------------------------------------------------------------------
# Video catalogue
# --------------------------------------------------------------------------


def _processed_path_for(stem: str):
    if not PROCESSED_DIR.exists():
        return None
    for candidate in (f"{stem}_detected_h264.mp4", f"{stem}_detected.mp4"):
        path = PROCESSED_DIR / candidate
        if path.exists():
            return path
    for path in sorted(PROCESSED_DIR.glob(f"{stem}_detected*")):
        if path.suffix.lower() == ".mp4":
            return path
    return None


def probe_video(path: Path) -> dict:
    path = Path(path)
    if not path.exists():
        raise FileNotFoundError(f"Video not found: {path.name}")

    capture = cv2.VideoCapture(str(path))
    if not capture.isOpened():
        raise ValueError(f"Could not open video: {path.name}")

    fps = float(capture.get(cv2.CAP_PROP_FPS)) or 0.0
    frames = int(capture.get(cv2.CAP_PROP_FRAME_COUNT))
    width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT))
    capture.release()

    if width <= 0 or height <= 0 or frames <= 0:
        raise ValueError(f"Video has no readable frames: {path.name}")

    duration = frames / fps if fps else 0.0

    return {
        "id": path.name,
        "filename": path.name,
        "duration_seconds": round(duration, 2),
        "fps": round(fps, 2),
        "frame_count": frames,
        "width": width,
        "height": height,
        "size_mb": round(path.stat().st_size / (1024 * 1024), 2),
    }


def resolve_video(video_id: str) -> Path:
    """Map an id to a real file inside the video directory (no traversal)."""
    if not video_id:
        raise FileNotFoundError("No video selected")

    name = Path(video_id).name

    for directory in (VIDEO_DIR, UPLOAD_DIR):
        path = (directory / name).resolve()
        if directory.resolve() in path.parents and path.exists():
            return path

    raise FileNotFoundError(f"Video not found: {video_id}")


def list_videos() -> list[dict]:
    videos = []

    if not VIDEO_DIR.exists():
        return videos

    for path in sorted(
        VIDEO_DIR.iterdir(),
        key=lambda item: (
            item.name != "traffic_compressed_crf28.mp4",
            item.name.lower(),
        ),
    ):
        if path.suffix.lower() not in VIDEO_EXTENSIONS:
            continue
        try:
            info = probe_video(path)
        except (ValueError, FileNotFoundError):
            continue

        processed = _processed_path_for(path.stem)
        info["has_processed_video"] = bool(processed)
        info["processed_filename"] = processed.name if processed else None
        info["source_url"] = f"/api/videos/{path.name}/source"
        info["processed_url"] = f"/api/videos/{path.name}/processed" if processed else None
        videos.append(info)

    return videos


def read_frame(path: Path, timestamp: float):
    info = probe_video(path)

    if timestamp < 0 or timestamp > info["duration_seconds"] + 0.5:
        raise ValueError(
            f"Timestamp {timestamp}s is outside the video "
            f"(0-{info['duration_seconds']}s)"
        )

    capture = cv2.VideoCapture(str(path))
    capture.set(cv2.CAP_PROP_POS_MSEC, max(0.0, timestamp) * 1000.0)
    ok, frame = capture.read()
    capture.release()

    if not ok or frame is None:
        raise ValueError(f"Could not read a frame at {timestamp}s")

    return frame, info


# --------------------------------------------------------------------------
# Frame analysis
# --------------------------------------------------------------------------


def save_preview(frame, video_id: str, timestamp: float, confidence: float, image_size: int) -> str:
    height, width = frame.shape[:2]
    scale = min(1.0, PREVIEW_WIDTH / width)
    preview = cv2.resize(frame, (int(width * scale), int(height * scale))) if scale < 1.0 else frame

    stem = Path(video_id).stem
    digest = hashlib.sha1(
        f"{video_id}|{timestamp:.3f}|{confidence}|{image_size}".encode()
    ).hexdigest()[:10]
    name = f"{stem}_{timestamp:07.2f}_{digest}.jpg"
    cv2.imwrite(str(PREVIEW_DIR / name), preview, [cv2.IMWRITE_JPEG_QUALITY, 86])
    return f"/media/{name}"


def _shape_detections(analysis, width, height):
    detections = []
    for item in analysis["detections"]:
        x1, y1, x2, y2 = item["box"]
        detections.append(
            {
                "class": item["class"],
                "confidence": item["confidence"],
                "lane": item.get("lane", "Unassigned"),
                "box_normalised": [
                    round(x1 / width, 4),
                    round(y1 / height, 4),
                    round(x2 / width, 4),
                    round(y2 / height, 4),
                ],
            }
        )
    return detections


_SNAPSHOT_CACHE: dict[str, dict] = {}
_CACHE_LOCK = threading.Lock()
_CACHE_LIMIT = 64


def analyse_frame(video_id: str, timestamp: float, confidence: float, image_size: int) -> dict:
    key = f"{video_id}|{timestamp:.2f}|{confidence}|{image_size}"

    with _CACHE_LOCK:
        cached = _SNAPSHOT_CACHE.get(key)
    if cached:
        return cached

    path = resolve_video(video_id)
    frame, info = read_frame(path, timestamp)

    analyzer = get_analyzer(round(float(confidence), 2), int(image_size))
    started = time.perf_counter()
    analysis = analyzer.analyze_frame(frame)
    processing_ms = round((time.perf_counter() - started) * 1000, 1)

    estimator = get_estimator()
    congestion = estimator.estimate(analysis["lanes"])

    demand = {lane: congestion[lane]["weighted_demand"] for lane in LANES}
    signal = AdaptiveSignalController().decide(demand)

    total = max(1, analysis["total_vehicles"])
    lanes = []
    for lane in LANES:
        bucket = analysis["lanes"][lane]
        lanes.append(
            {
                "name": lane,
                "total": bucket["total"],
                "classes": {name: bucket[name] for name in CLASS_NAMES},
                "share": round(bucket["total"] / total, 3),
                "weighted_demand": congestion[lane]["weighted_demand"],
                "utilisation": congestion[lane]["utilisation"],
                "congestion": congestion[lane]["congestion"],
            }
        )

    # Class totals across every lane, including unassigned detections.
    class_totals = []
    for name in CLASS_NAMES:
        count = analysis["lanes"]["Unassigned"][name] + sum(
            analysis["lanes"][lane][name] for lane in LANES
        )
        class_totals.append({"name": name, "count": count})

    payload = {
        "video_id": video_id,
        "timestamp": round(float(timestamp), 2),
        "analysed_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "processing_ms": processing_ms,
        "image_url": save_preview(analysis["frame"], video_id, timestamp, confidence, image_size),
        "video": {
            "width": info["width"],
            "height": info["height"],
            "fps": info["fps"],
            "duration_seconds": info["duration_seconds"],
        },
        "total_detections": analysis["total_vehicles"],
        "unassigned": analysis["unassigned"],
        "lanes": lanes,
        "classes": class_totals,
        "detections": _shape_detections(analysis, analysis["width"], analysis["height"]),
        "congestion_summary": estimator.snapshot_summary(congestion),
        "signal": signal,
        "settings": analysis["settings"],
        "notes": [NOTE_TRACKING, NOTE_RECALL],
    }

    with _CACHE_LOCK:
        if len(_SNAPSHOT_CACHE) >= _CACHE_LIMIT:
            _SNAPSHOT_CACHE.pop(next(iter(_SNAPSHOT_CACHE)))
        _SNAPSHOT_CACHE[key] = payload

    return payload


# --------------------------------------------------------------------------
# Multi-timestamp analysis jobs
# --------------------------------------------------------------------------


class JobStore:
    def __init__(self):
        self._jobs: dict[str, dict] = {}
        self._lock = threading.Lock()
        self._executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="analysis")

    def create(self, video_id: str, interval: float, limit: int, confidence: float, image_size: int):
        job_id = uuid.uuid4().hex[:12]
        with self._lock:
            self._jobs[job_id] = {
                "job_id": job_id,
                "video_id": video_id,
                "status": "queued",
                "progress": 0,
                "total": limit,
                "error": None,
                "result": None,
                "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            }
        self._executor.submit(self._run, job_id, video_id, interval, limit, confidence, image_size)
        return self._jobs[job_id]

    def get(self, job_id: str):
        with self._lock:
            job = self._jobs.get(job_id)
            return dict(job) if job else None

    def latest_completed(self):
        with self._lock:
            completed = [job for job in self._jobs.values() if job["status"] == "completed"]
        if not completed:
            return None
        return dict(sorted(completed, key=lambda job: job["created_at"])[-1])

    def _update(self, job_id: str, **fields):
        with self._lock:
            if job_id in self._jobs:
                self._jobs[job_id].update(fields)

    def _run(self, job_id, video_id, interval, limit, confidence, image_size):
        self._update(job_id, status="running")

        try:
            path = resolve_video(video_id)
            info = probe_video(path)
            duration = info["duration_seconds"]

            timestamps = []
            step = max(0.5, float(interval))
            index = 0
            while len(timestamps) < limit and index * step < duration:
                timestamps.append(round(index * step, 2))
                index += 1

            if not timestamps:
                timestamps = [0.0]

            samples = []
            for position, timestamp in enumerate(timestamps, start=1):
                snapshot = analyse_frame(video_id, timestamp, confidence, image_size)
                samples.append(
                    {
                        "timestamp": timestamp,
                        "total": snapshot["total_detections"],
                        "unassigned": snapshot["unassigned"],
                        "lanes": {lane["name"]: lane["total"] for lane in snapshot["lanes"]},
                        "demand": {lane["name"]: lane["weighted_demand"] for lane in snapshot["lanes"]},
                        "congestion": {lane["name"]: lane["congestion"] for lane in snapshot["lanes"]},
                        "signal": {
                            "green_lane": snapshot["signal"]["green_lane"],
                            "green_duration": snapshot["signal"]["green_duration"],
                            "reason": snapshot["signal"]["reason"],
                        },
                        "classes": {item["name"]: item["count"] for item in snapshot["classes"]},
                        "image_url": snapshot["image_url"],
                        "processing_ms": snapshot["processing_ms"],
                    }
                )
                self._update(job_id, progress=position)

            totals = {lane: 0 for lane in LANES}
            class_totals = {name: 0 for name in CLASS_NAMES}
            for sample in samples:
                for lane in LANES:
                    totals[lane] += sample["lanes"][lane]
                for name in CLASS_NAMES:
                    class_totals[name] += sample["classes"][name]

            peak = max(samples, key=lambda sample: sample["total"])
            congestion_counts = {}
            for sample in samples:
                for level in sample["congestion"].values():
                    congestion_counts[level] = congestion_counts.get(level, 0) + 1

            interval_seconds = round(step, 2)
            summary = {
                "samples": len(samples),
                "interval_seconds": interval_seconds,
                "video_duration_seconds": duration,
                "mean_detections_per_sampled_frame": round(
                    sum(sample["total"] for sample in samples) / len(samples), 2
                ),
                "max_detections": peak["total"],
                "peak_timestamp": peak["timestamp"],
                "approach_totals": totals,
                "class_totals": class_totals,
                "congestion_counts": congestion_counts,
                "mean_processing_ms": round(
                    sum(sample["processing_ms"] for sample in samples) / len(samples), 1
                ),
                "note": (
                    "Summed per-frame detections over sampled timestamps. "
                    "This is not a unique vehicle count and the sample interval "
                    f"({interval_seconds}s) skips frames in between."
                ),
            }

            self._update(
                job_id,
                status="completed",
                result={
                    "video_id": video_id,
                    "video": info,
                    "samples": samples,
                    "summary": summary,
                    "settings": get_analyzer(confidence, image_size).settings,
                    "notes": [NOTE_TRACKING, NOTE_RECALL],
                },
            )
        except Exception as error:  # surfaced through the job status
            self._update(job_id, status="failed", error=f"{type(error).__name__}: {error}")


JOBS = JobStore()


# --------------------------------------------------------------------------
# Simulation and signal helpers
# --------------------------------------------------------------------------


def run_simulation(duration: int, seed: int, policy: str):
    return TrafficSimulator(duration=duration, seed=seed).run(policy)


def compare_simulation(duration: int, seed: int):
    return TrafficSimulator(duration=duration, seed=seed).compare()


def sweep_seeds(duration: int, seeds):
    return TrafficSimulator.compare_seeds(seeds=seeds, duration=duration)


def recommend_signal(demand: dict, wait: dict | None = None):
    controller = AdaptiveSignalController()
    decision = controller.decide(demand, wait)
    decision["service_rate"] = controller.service_rate
    decision["green_bounds"] = [controller.min_green, controller.max_green]
    decision["max_wait_limit"] = controller.max_wait
    return decision


def platform_config():
    return {
        "approaches": LANES,
        "lane_polygons": LANE_POLYGONS,
        "congestion": {
            "capacity_units": get_estimator().lane_capacity,
            "vehicle_weights": get_estimator().vehicle_weights,
            "level_thresholds": {
                "Empty": 0.0,
                "Low": 0.20,
                "Moderate": 0.45,
                "High": 0.70,
                "Severe": 1.0,
            },
            "note": "Utilisation = weighted detection units / approach capacity.",
        },
        "detection": {
            "confidence": DEFAULT_CONFIDENCE,
            "image_size": DEFAULT_IMAGE_SIZE,
            "device": "cpu",
            "available_device": available_device(),
            "model": "yolov8n.pt",
        },
        "signal": {
            "min_green": MIN_GREEN,
            "max_green": MAX_GREEN,
            "yellow_seconds": YELLOW_TIME,
            "all_red_seconds": ALL_RED_TIME,
            "max_wait": MAX_WAIT,
            "service_rate": SERVICE_RATE,
        },
        "simulation": {
            "default_duration": 600,
            "arrival_rates": DEFAULT_ARRIVAL_RATES,
            "fixed_green_seconds": FIXED_GREEN_TIME,
            "service_rate": SERVICE_RATE,
        },
        "disclaimer": (
            "Educational prototype: detections, congestion estimates, signal "
            "recommendations and simulations are not real-world measurements "
            "and are not for use as a traffic controller."
        ),
    }
