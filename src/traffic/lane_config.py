"""Approach (lane) polygons for the monitored intersection.

Coordinates are normalised to the frame (0-1) so the same configuration works
for the 4K source video and for any preview resolution.

The polygons were calibrated against frames from ``data/videos/traffic.mp4``
(10 s, 20 s and 30 s) with a normalised grid overlay. Each polygon covers
**only the incoming carriageway** of its approach: the opposing carriageway,
the painted median and the pedestrian crossings are deliberately excluded so
that leaving traffic is not counted as demand.

Known limitation
----------------
Assignment uses the centre point of each detection box. This is a frame-level
snapshot heuristic, not vehicle tracking: a vehicle straddling the edge of a
polygon, or a large merged detection, can be assigned to the wrong approach.
"""

import cv2
import numpy as np

LANES = ("North", "South", "East", "West")

# Measured from grid-annotated frames of the source video:
#   North: southbound lane group at the top, stops at the crosswalk.
#   South: northbound lane group at the bottom, right of the painted median.
#   East : westbound approach on the right, above the double yellow line.
#   West : eastbound approach on the left, below the painted median.
LANE_POLYGONS = {
    "North": [
        (0.400, 0.000),
        (0.632, 0.000),
        (0.636, 0.212),
        (0.396, 0.212),
    ],
    "South": [
        (0.492, 0.780),
        (0.607, 0.780),
        (0.617, 1.000),
        (0.497, 1.000),
    ],
    "East": [
        (0.696, 0.368),
        (1.000, 0.357),
        (1.000, 0.498),
        (0.696, 0.512),
    ],
    "West": [
        (0.000, 0.497),
        (0.345, 0.487),
        (0.345, 0.632),
        (0.000, 0.646),
    ],
}

# BGR colours used when the polygons are drawn on an annotated frame.
LANE_COLOURS = {
    "North": (255, 176, 32),
    "South": (32, 220, 128),
    "East": (255, 96, 150),
    "West": (80, 200, 255),
    "Unassigned": (200, 200, 200),
}

UNASSIGNED = "Unassigned"


def get_lane_pixel_regions(frame_width, frame_height):
    """Convert the normalised polygons into OpenCV pixel polygons."""
    if frame_width <= 0 or frame_height <= 0:
        raise ValueError("frame_width and frame_height must be positive")

    regions = {}

    for lane, polygon in LANE_POLYGONS.items():
        points = [
            (int(round(x * frame_width)), int(round(y * frame_height)))
            for x, y in polygon
        ]
        regions[lane] = np.array(points, dtype=np.int32)

    return regions


def box_centre(box):
    """Return the centre point of an (x1, y1, x2, y2) box."""
    x1, y1, x2, y2 = box
    return (x1 + x2) / 2.0, (y1 + y2) / 2.0


def get_lane(box, frame_width, frame_height):
    """Return the approach a detection box belongs to, or ``Unassigned``."""
    regions = get_lane_pixel_regions(frame_width, frame_height)
    centre_x, centre_y = box_centre(box)

    for lane, polygon in regions.items():
        if cv2.pointPolygonTest(polygon, (float(centre_x), float(centre_y)), False) >= 0:
            return lane

    return UNASSIGNED


def polygon_area_fraction(polygon):
    """Area of a normalised polygon (shoelace formula)."""
    area = 0.0
    for index, (x1, y1) in enumerate(polygon):
        x2, y2 = polygon[(index + 1) % len(polygon)]
        area += x1 * y2 - x2 * y1
    return abs(area) / 2.0
