import cv2
from src.traffic.lane_config import get_lane_pixel_regions

video = cv2.VideoCapture("data/videos/traffic.mp4")
video.set(cv2.CAP_PROP_POS_MSEC, 10000)

success, frame = video.read()
video.release()

if not success:
    raise RuntimeError("Could not read reference frame")

height, width = frame.shape[:2]
regions = get_lane_pixel_regions(width, height)

for lane, (x1, y1, x2, y2) in regions.items():
    cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 4)

    cv2.putText(
        frame, lane,
        (x1 + 10, y1 + 40),
        cv2.FONT_HERSHEY_SIMPLEX,
        1.2, (0, 255, 0), 3
    )

cv2.imwrite("data/processed/lane_regions.jpg", frame)
print("Lane regions saved: data/processed/lane_regions.jpg")
print("Frame dimensions:", width, "x", height)
