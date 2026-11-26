"""YOLOv8 vehicle detection wrapper.

The model is the stock COCO ``yolov8n.pt`` checkpoint. It was **not** trained on
aerial traffic footage, so recall on this camera angle is limited and some
vehicles are classified as the wrong COCO class. Detection boxes are per frame:
nothing here tracks a vehicle between frames.
"""

from functools import lru_cache
from pathlib import Path

import cv2
from ultralytics import YOLO

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_MODEL_PATH = PROJECT_ROOT / "yolov8n.pt"

VEHICLE_CLASSES = {
    2: "Car",
    3: "Motorcycle",
    5: "Bus",
    7: "Truck",
}

# CPU inference is the supported configuration for this project.
DEFAULT_CONFIDENCE = 0.10
DEFAULT_IMAGE_SIZE = 640
DEFAULT_DEVICE = "cpu"

# BGR colours used to draw each class when ultralytics' own plot is not used.
CLASS_COLOURS = {
    "Car": (255, 200, 0),
    "Motorcycle": (0, 200, 255),
    "Bus": (255, 0, 200),
    "Truck": (0, 255, 120),
}

MIN_IMAGE_SIZE = 320
MAX_IMAGE_SIZE = 2560


@lru_cache(maxsize=4)
def _load_model(model_path: str) -> YOLO:
    """Load a YOLO checkpoint once per process (weights are shared)."""
    path = Path(model_path)

    if not path.exists():
        raise FileNotFoundError(
            f"YOLO weights not found at {path}. "
            "Place yolov8n.pt in the project root or pass model_path=..."
        )

    return YOLO(str(path))


def available_device() -> str:
    """Return 'cuda' when a working GPU is present, otherwise 'cpu'."""
    try:
        import torch

        return "cuda" if torch.cuda.is_available() else "cpu"
    except Exception:  # pragma: no cover - torch is always installed with ultralytics
        return "cpu"


def _validate_image_size(image_size: int) -> int:
    if not isinstance(image_size, int) or isinstance(image_size, bool):
        raise ValueError("image_size must be an integer")

    if image_size < MIN_IMAGE_SIZE or image_size > MAX_IMAGE_SIZE:
        raise ValueError(
            f"image_size must be between {MIN_IMAGE_SIZE} and {MAX_IMAGE_SIZE}"
        )

    # YOLO strides are 32; a multiple of 32 avoids letterbox padding surprises.
    return int(round(image_size / 32.0) * 32)


class VehicleDetector:
    """Thin, reusable wrapper around an Ultralytics YOLO model."""

    def __init__(
        self,
        confidence: float = DEFAULT_CONFIDENCE,
        image_size: int = DEFAULT_IMAGE_SIZE,
        device: str = DEFAULT_DEVICE,
        model_path=None,
    ):
        if not 0.0 < confidence <= 1.0:
            raise ValueError("confidence must be greater than 0 and at most 1")

        self.confidence = float(confidence)
        self.image_size = _validate_image_size(int(image_size))
        self.device = device or DEFAULT_DEVICE
        self.model_path = Path(model_path or DEFAULT_MODEL_PATH)
        self.model = _load_model(str(self.model_path))

    @property
    def settings(self):
        return {
            "confidence": self.confidence,
            "image_size": self.image_size,
            "device": self.device,
            "model": self.model_path.name,
        }

    def detect(self, frame):
        """Run detection on a BGR frame.

        Returns the per-class counts, the flat detection list, the total number
        of boxes and an annotated copy of the frame.
        """
        if frame is None or getattr(frame, "size", 0) == 0:
            raise ValueError("Cannot run detection on an empty frame")

        height, width = frame.shape[:2]

        results = self.model.predict(
            source=frame,
            conf=self.confidence,
            classes=list(VEHICLE_CLASSES.keys()),
            imgsz=self.image_size,
            device=self.device,
            verbose=False,
        )

        counts = {name: 0 for name in VEHICLE_CLASSES.values()}
        detections = []

        for result in results:
            for box in result.boxes:
                class_id = int(box.cls[0])
                confidence = float(box.conf[0])
                x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())

                vehicle_name = VEHICLE_CLASSES[class_id]
                counts[vehicle_name] += 1

                detections.append(
                    {
                        "class": vehicle_name,
                        "confidence": round(confidence, 3),
                        "box": [x1, y1, x2, y2],
                        # Normalised centre point, useful for the API/UI.
                        "centre": [
                            round((x1 + x2) / 2.0 / width, 4),
                            round((y1 + y2) / 2.0 / height, 4),
                        ],
                    }
                )

        annotated_frame = results[0].plot() if results else frame.copy()

        return {
            "counts": counts,
            "total": len(detections),
            "detections": detections,
            "frame": annotated_frame,
            "width": width,
            "height": height,
            "settings": self.settings,
        }


def draw_detections(frame, detections, thickness=2):
    """Draw boxes/labels without relying on ultralytics' plotter."""
    annotated = frame.copy()

    for detection in detections:
        x1, y1, x2, y2 = detection["box"]
        colour = CLASS_COLOURS.get(detection["class"], (255, 255, 255))
        label = f"{detection['class']} {detection['confidence']:.2f}"

        cv2.rectangle(annotated, (x1, y1), (x2, y2), colour, thickness)
        cv2.putText(
            annotated,
            label,
            (x1, max(12, y1 - 6)),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.5,
            colour,
            1,
            cv2.LINE_AA,
        )

    return annotated
