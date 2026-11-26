# Lane (approach) calibration

## Method

1. Extract a native 3840×2160 frame from `data/videos/traffic.mp4` at 10 s.
2. Overlay a normalised grid (0.01 minor, 0.05 major lines) on zoomed crops of
   each arm and read the pavement boundaries off the grid.
3. Record each approach as a four-point normalised polygon covering **only the
   incoming carriageway**: stop line to frame edge, excluding the opposing
   carriageway, painted median and crosswalk.
4. Verify with detections at five timestamps and confirm that known outbound
   vehicles fall outside every polygon (`tests/test_lane_config.py`).

The camera is an angled aerial view, so edges are slightly trapezoidal. Each
polygon is therefore a quadrilateral rather than a rectangle.

## Polygons

| Approach | Polygon (x, y normalised) | Covers |
| --- | --- | --- |
| North | (0.400, 0.000) (0.632, 0.000) (0.636, 0.212) (0.396, 0.212) | Southbound lane group at the top, ending at the crosswalk |
| South | (0.492, 0.780) (0.607, 0.780) (0.617, 1.000) (0.497, 1.000) | Northbound lanes right of the painted median |
| East | (0.696, 0.368) (1.000, 0.357) (1.000, 0.498) (0.696, 0.512) | Westbound approach above the double yellow line, after the crosswalk |
| West | (0.000, 0.497) (0.345, 0.487) (0.345, 0.632) (0.000, 0.646) | Eastbound approach below the median, before the crosswalk |

### What was corrected

The original rectangles included the opposite direction:

- **West** covered y 0.46–0.63, which spans the westbound departure band
  (≈0.39–0.46), the median and the eastbound approach. It now starts at the
  median (≈0.497).
- **South** covered x 0.39–0.63, which includes the southbound departure lanes
  left of the median at x ≈ 0.48. It now starts at 0.492.
- **East** stopped at y 0.50, just past the yellow line, and started at x 0.65
  inside the crosswalk. It now starts at 0.696 and ends at the yellow line.
- **North** stopped at y 0.22 (already correct) but clipped the leftmost lane at
  x 0.39; it now starts at 0.400 and follows the road edge to 0.636.

## Validation

Detections at confidence 0.10 and inference size 1920 on the full-resolution
frames:

| Timestamp | North | South | East | West | Unassigned | Total |
| --- | --- | --- | --- | --- | --- | --- |
| 2 s | 0 | 0 | 0 | 9 | 2 | 11 |
| 10 s | 0 | 0 | 1 | 6 | 1 | 8 |
| 20 s | 0 | 0 | 1 | 7 | 1 | 9 |
| 30 s | 0 | 0 | 0 | 1 | 2 | 3 |
| 35 s | 0 | 0 | 0 | 0 | 2 | 2 |

`Unassigned` boxes are vehicles inside the junction box, on crosswalks, or on
the opposing carriageways — exactly what the polygons are meant to exclude.

### Why North and South are usually zero

This is a detection limitation, not a geometry problem. Roughly 5–10 vehicles
are visible on each of those arms, but the stock YOLOv8n COCO model does not
fire on them at this camera angle and scale. The earlier rectangle version
showed the same behaviour (North 0, South 0). Lowering confidence to 0.05 adds
boxes but they appear almost entirely in the same western queue, plus more
false positives.

A cropped-inference experiment (running the detector on per-arm crops) was also
tried during calibration: at 1280 px it produced North 0, South 2, East 1,
West 5 — no meaningful gain for four times the inference cost. It is not used.

## Known limitations

1. Assignment is by box centre; a vehicle on a polygon boundary can be
   attributed to the neighbouring approach.
2. Polygons are hand-calibrated for this one camera position; a different video
   needs new coordinates.
3. The far end of each approach loses detail at 1920 px inference size, so small
   distant vehicles are the least likely to be detected.
4. Detections are per frame. Nothing here tracks a vehicle, so the same vehicle
   is counted again at the next timestamp.

## Reproducing the calibration images

The grid overlays used to measure these boundaries were produced by drawing
0.05-interval lines with their normalised labels on arm crops, then reading the
pavement edges. Any calibrated override should keep the same format: four
`(x, y)` pairs in `LANE_POLYGONS` inside `src/traffic/lane_config.py`, with the
non-overlap and assignment tests still passing:

```bash
.venv/Scripts/python.exe -m pytest tests/test_lane_config.py
```
