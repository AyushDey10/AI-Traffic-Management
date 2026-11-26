"""Frame-level traffic analysis: detection, approach assignment, annotation."""

import cv2

from src.detection.vehicle_detector import VehicleDetector
from src.traffic.lane_config import (
    LANE_COLOURS,
    LANES,
    UNASSIGNED,
    get_lane,
    get_lane_pixel_regions,
)

CLASS_NAMES = ("Car", "Motorcycle", "Bus", "Truck")


def empty_lane_bucket():
    bucket = {"total": 0}
    for name in CLASS_NAMES:
        bucket[name] = 0
    return bucket


class TrafficAnalyzer:
    """Run detection on a frame and split the boxes across the four approaches."""

    def __init__(self, confidence=0.10, image_size=1920, device="cpu"):
        self.detector = VehicleDetector(
            confidence=confidence,
            image_size=image_size,
            device=device,
        )

    @property
    def settings(self):
        return self.detector.settings

    def analyze_frame(self, frame, annotate=True):
        result = self.detector.detect(frame)

        lanes = {lane: empty_lane_bucket() for lane in LANES}
        lanes[UNASSIGNED] = empty_lane_bucket()

        height, width = frame.shape[:2]
        annotated = result["frame"].copy() if annotate else frame.copy()

        for detection in result["detections"]:
            lane = get_lane(detection["box"], width, height)
            detection["lane"] = lane
            lanes[lane]["total"] += 1
            lanes[lane][detection["class"]] += 1

        if annotate:
            thickness = max(2, int(round(min(width, height) / 540)))
            for lane, polygon in get_lane_pixel_regions(width, height).items():
                colour = LANE_COLOURS[lane]
                cv2.polylines(annotated, [polygon], True, colour, thickness)

                moments = cv2.moments(polygon)
                if moments["m00"] != 0:
                    centre_x = int(moments["m10"] / moments["m00"])
                    centre_y = int(moments["m01"] / moments["m00"])
                else:
                    centre_x, centre_y = polygon[0]

                cv2.putText(
                    annotated,
                    f"{lane}: {lanes[lane]['total']}",
                    (max(5, centre_x - 60), max(24, centre_y)),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    max(0.5, min(width, height) / 1200.0),
                    colour,
                    max(2, thickness - 1),
                    cv2.LINE_AA,
                )

        return {
            "lanes": lanes,
            "detections": result["detections"],
            "total_vehicles": result["total"],
            "unassigned": lanes[UNASSIGNED]["total"],
            "frame": annotated,
            "width": width,
            "height": height,
            "settings": result["settings"],
        }
