import cv2
from src.traffic.traffic_analyzer import TrafficAnalyzer

VIDEO_PATH = "data/videos/traffic.mp4"

analyzer = TrafficAnalyzer(confidence=0.15)

timestamps = [2, 5, 8, 10, 13, 16, 20, 25, 30, 35]

video = cv2.VideoCapture(VIDEO_PATH)

if not video.isOpened():
    raise RuntimeError("Cannot open traffic video")

print("\n========== MULTI-FRAME DETECTION TEST ==========")

for seconds in timestamps:
    video.set(cv2.CAP_PROP_POS_MSEC, seconds * 1000)
    success, frame = video.read()

    if not success:
        print(f"{seconds}s: Could not read frame")
        continue

    frame = cv2.resize(frame, (1280, 720))
    result = analyzer.analyze_frame(frame)

    print(f"\nTimestamp: {seconds}s")
    print("Vehicles detected:", result["total_vehicles"])

    for detection in result["detections"]:
        print(
            detection["class"],
            "Confidence:", detection["confidence"],
            "Lane:", detection["lane"],
            "Box:", detection["box"]
        )

    if result["total_vehicles"] > 0:
        cv2.imwrite(
            f"data/processed/detection_{seconds}s.jpg",
            result["frame"]
        )

video.release()
print("\nDiagnostic test completed.")
