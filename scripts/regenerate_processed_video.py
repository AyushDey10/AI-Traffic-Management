"""Regenerate the annotated detection sample video.

Usage (from the project root):

    .venv/Scripts/python.exe scripts/regenerate_processed_video.py

The source video in data/videos is never modified. Detection runs on the
native frame and the annotated output is written as H.264 through
imageio-ffmpeg (falling back to OpenCV's mp4v writer if that is unavailable).
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.traffic.video_processor import TrafficVideoProcessor  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--video", default="data/videos/traffic_compressed_crf28.mp4")
    parser.add_argument("--output", default="data/processed/traffic_compressed_crf28_detected_h264.mp4")
    parser.add_argument("--confidence", type=float, default=0.10)
    parser.add_argument("--image-size", type=int, default=1920)
    parser.add_argument("--frame-skip", type=int, default=1)
    parser.add_argument("--max-width", type=int, default=1280)
    args = parser.parse_args()

    source = PROJECT_ROOT / args.video
    output = PROJECT_ROOT / args.output

    if not source.exists():
        print(f"Source video not found: {source}", file=sys.stderr)
        return 1

    started = time.perf_counter()
    processor = TrafficVideoProcessor(
        confidence=args.confidence,
        image_size=args.image_size,
        frame_skip=args.frame_skip,
        max_width=args.max_width,
    )

    def progress(frame_number: int, total: int) -> None:
        percent = (frame_number / total * 100) if total else 0
        print(f"  {frame_number}/{total} frames ({percent:.0f}%)", flush=True)

    result = processor.process(source, output, progress=progress)
    result["wall_seconds"] = round(time.perf_counter() - started, 1)
    result["output_size_mb"] = round(output.stat().st_size / (1024 * 1024), 2)

    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
