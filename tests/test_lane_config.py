import numpy as np
import pytest

from src.traffic.lane_config import (
    LANE_POLYGONS,
    LANES,
    UNASSIGNED,
    get_lane,
    get_lane_pixel_regions,
    polygon_area_fraction,
)

FRAME_WIDTH = 3840
FRAME_HEIGHT = 2160


def box_at(x1, y1, width, height):
    return [int(x1), int(y1), int(x1 + width), int(y1 + height)]


def test_every_approach_has_a_polygon():
    assert set(LANE_POLYGONS) == set(LANES)
    for polygon in LANE_POLYGONS.values():
        assert len(polygon) == 4


def test_coordinates_are_normalised():
    for polygon in LANE_POLYGONS.values():
        for x, y in polygon:
            assert 0.0 <= x <= 1.0
            assert 0.0 <= y <= 1.0


def test_pixel_conversion_scales_to_frame():
    regions = get_lane_pixel_regions(FRAME_WIDTH, FRAME_HEIGHT)

    assert set(regions) == set(LANES)
    first = LANE_POLYGONS["North"][0]
    assert tuple(regions["North"][0]) == (
        round(first[0] * FRAME_WIDTH),
        round(first[1] * FRAME_HEIGHT),
    )
    for polygon in regions.values():
        assert polygon.dtype == np.int32


def test_pixel_conversion_respects_small_frames():
    regions = get_lane_pixel_regions(640, 360)
    assert tuple(regions["South"][0]) == (round(0.492 * 640), round(0.780 * 360))


def test_invalid_frame_size_is_rejected():
    with pytest.raises(ValueError):
        get_lane_pixel_regions(0, 720)
    with pytest.raises(ValueError):
        get_lane_pixel_regions(1280, -1)


@pytest.mark.parametrize("lane", LANES)
def test_polygon_centre_maps_to_its_own_approach(lane):
    polygon = LANE_POLYGONS[lane]
    centre_x = sum(point[0] for point in polygon) / len(polygon)
    centre_y = sum(point[1] for point in polygon) / len(polygon)

    width = int(0.02 * FRAME_WIDTH)
    height = int(0.02 * FRAME_HEIGHT)
    box = box_at(centre_x * FRAME_WIDTH - width / 2, centre_y * FRAME_HEIGHT - height / 2, width, height)

    assert get_lane(box, FRAME_WIDTH, FRAME_HEIGHT) == lane


def test_intersection_centre_is_unassigned():
    box = box_at(FRAME_WIDTH * 0.48, FRAME_HEIGHT * 0.45, 80, 60)
    assert get_lane(box, FRAME_WIDTH, FRAME_HEIGHT) == UNASSIGNED


def test_opposing_carriageways_are_not_counted():
    # Southbound departure lane at the bottom of the frame.
    south_outbound = box_at(FRAME_WIDTH * 0.44, FRAME_HEIGHT * 0.90, 60, 50)
    assert get_lane(south_outbound, FRAME_WIDTH, FRAME_HEIGHT) == UNASSIGNED

    # Westbound departure band above the painted median.
    west_outbound = box_at(FRAME_WIDTH * 0.18, FRAME_HEIGHT * 0.42, 60, 50)
    assert get_lane(west_outbound, FRAME_WIDTH, FRAME_HEIGHT) == UNASSIGNED

    # Eastbound departure lane below the double yellow line.
    east_outbound = box_at(FRAME_WIDTH * 0.85, FRAME_HEIGHT * 0.56, 60, 50)
    assert get_lane(east_outbound, FRAME_WIDTH, FRAME_HEIGHT) == UNASSIGNED


def test_crosswalks_are_excluded():
    # The north crosswalk sits just below the northern polygon.
    north_crosswalk = box_at(FRAME_WIDTH * 0.50, FRAME_HEIGHT * 0.235, 60, 30)
    assert get_lane(north_crosswalk, FRAME_WIDTH, FRAME_HEIGHT) == UNASSIGNED


def test_polygons_do_not_overlap():
    regions = get_lane_pixel_regions(1500, 1000)
    names = list(regions)

    for index, first in enumerate(names):
        for second in names[index + 1 :]:
            first_mask = np.zeros((1000, 1500), dtype=np.uint8)
            second_mask = np.zeros((1000, 1500), dtype=np.uint8)
            import cv2

            cv2.fillPoly(first_mask, [regions[first]], 1)
            cv2.fillPoly(second_mask, [regions[second]], 1)
            assert np.logical_and(first_mask, second_mask).sum() == 0, f"{first} overlaps {second}"


def test_polygon_areas_are_plausible():
    for lane, polygon in LANE_POLYGONS.items():
        area = polygon_area_fraction(polygon)
        assert 0.004 < area < 0.08, f"{lane} area {area}"
