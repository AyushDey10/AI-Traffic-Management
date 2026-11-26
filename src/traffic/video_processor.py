"""Render an annotated detection sample from a traffic video.

Detection runs on the **native** frame (the model downsamples internally to
``image_size``); the annotated frame is only resized afterwards for output.
Resizing before detection throws away the small-vehicle detail the model needs.

The output is an annotated *sample*, not a count of unique vehicles: boxes are
per-frame detections and the same vehicle appears in many frames.
"""

import subprocess
from pathlib import Path

import cv2

from src.traffic.congestion_estimator import CongestionEstimator
from src.traffic.traffic_analyzer import TrafficAnalyzer


class FFmpegH264Writer:
    """Write BGR frames to an H.264 mp4 through imageio-ffmpeg."""

    def __init__(self, path, width, height, fps, crf=26):
        import imageio_ffmpeg

        self.path = str(path)
        self.width = width
        self.height = height
        self.process = subprocess.Popen(
            [
                imageio_ffmpeg.get_ffmpeg_exe(),
                "-y",
                "-loglevel", "error",
                "-f", "rawvideo",
                "-pix_fmt", "bgr24",
                "-s", f"{width}x{height}",
                "-r", str(fps),
                "-i", "-",
                "-an",
                "-c:v", "libx264",
                "-preset", "veryfast",
                "-crf", str(crf),
                "-pix_fmt", "yuv420p",
                "-movflags", "+faststart",
                self.path,
            ],
            stdin=subprocess.PIPE,
        )

    def write(self, frame):
        self.process.stdin.write(frame.tobytes())

    def release(self):
        if self.process.stdin:
            self.process.stdin.close()
        self.process.wait()


class TrafficVideoProcessor:
    def __init__(self, confidence=0.15, image_size=640, frame_skip=1, max_width=1280):
        if frame_skip < 1:
            raise ValueError("frame_skip must be at least 1")
        if max_width < 320:
            raise ValueError("max_width must be at least 320")

        self.analyzer = TrafficAnalyzer(confidence=confidence, image_size=image_size)
        self.estimator = CongestionEstimator()
        self.frame_skip = frame_skip
        self.max_width = max_width

    def process(self, video_path, output_path, progress=None):
        video_path = Path(video_path)
        if not video_path.exists():
            raise FileNotFoundError(f"Video not found: {video_path}")

        capture = cv2.VideoCapture(str(video_path))
        if not capture.isOpened():
            raise ValueError(f"Cannot open video: {video_path}")

        fps = capture.get(cv2.CAP_PROP_FPS) or 24.0
        source_width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH))
        source_height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT))
        total_frames = int(capture.get(cv2.CAP_PROP_FRAME_COUNT))

        scale = min(1.0, self.max_width / source_width)
        width = int(source_width * scale) // 2 * 2
        height = int(source_height * scale) // 2 * 2

        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)

        try:
            writer = FFmpegH264Writer(output_path, width, height, fps)
            codec = "h264"
        except Exception:
            writer = cv2.VideoWriter(
                str(output_path),
                cv2.VideoWriter_fourcc(*"mp4v"),
                fps,
                (width, height),
            )
            codec = "mp4v"

        class_counts = {"Car": 0, "Motorcycle": 0, "Bus": 0, "Truck": 0}
        lane_totals = {"North": 0, "South": 0, "East": 0, "West": 0, "Unassigned": 0}
        processed_frames = 0
        frame_number = 0
        last_analysis = None

        try:
            while True:
                ok, frame = capture.read()
                if not ok:
                    break

                if frame_number % self.frame_skip == 0:
                    last_analysis = self.analyzer.analyze_frame(frame)
                    processed_frames += 1

                    for lane in ("North", "South", "East", "West", "Unassigned"):
                        lane_totals[lane] += last_analysis["lanes"][lane]["total"]
                        for name in class_counts:
                            class_counts[name] += last_analysis["lanes"][lane][name]

                annotated = (
                    last_analysis["frame"]
                    if last_analysis is not None
                    else frame
                )

                if annotated.shape[1] != width or annotated.shape[0] != height:
                    annotated = cv2.resize(annotated, (width, height))

                stamp = frame_number / fps
                cv2.putText(
                    annotated,
                    "ANNOTATED DETECTION SAMPLE - frame-level YOLO, no vehicle tracking",
                    (12, 26),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.55,
                    (0, 220, 255),
                    2,
                    cv2.LINE_AA,
                )
                cv2.putText(
                    annotated,
                    f"t={stamp:05.1f}s  detections in frame={last_analysis['total_vehicles'] if last_analysis else 0}",
                    (12, 50),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.5,
                    (230, 230, 230),
                    1,
                    cv2.LINE_AA,
                )

                writer.write(annotated)
                frame_number += 1

                if progress and frame_number % 50 == 0:
                    progress(frame_number, total_frames)
        finally:
            capture.release()
            writer.release()

        return {
            "source": str(video_path),
            "output_video": str(output_path),
            "codec": codec,
            "output_resolution": f"{width}x{height}",
            "source_resolution": f"{source_width}x{source_height}",
            "fps": round(float(fps), 2),
            "total_frames": total_frames,
            "processed_frames": processed_frames,
            "frame_skip": self.frame_skip,
            "detection_settings": self.analyzer.settings,
            "class_counts": class_counts,
            "lane_totals": lane_totals,
            "note": (
                "Counts are per-frame detections summed over sampled frames. "
                "They are not unique vehicle counts."
            ),
        }
