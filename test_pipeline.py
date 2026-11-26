import cv2

from src.traffic.traffic_analyzer import TrafficAnalyzer
from src.traffic.congestion_estimator import CongestionEstimator

VIDEO_PATH = "data/videos/traffic.mp4"
TIMESTAMPS = [2, 16, 35]

analyzer = TrafficAnalyzer(confidence=0.15)
estimator = CongestionEstimator()

video = cv2.VideoCapture(VIDEO_PATH)

if not video.isOpened():
    raise RuntimeError("Cannot open traffic video")

print("\n========== LIVE TRAFFIC ANALYSIS PIPELINE ==========")

for seconds in TIMESTAMPS:
    video.set(cv2.CAP_PROP_POS_MSEC, seconds * 1000)
    success, frame = video.read()

    if not success:
        print(f"Could not read frame at {seconds}s")
        continue

    frame = cv2.resize(frame, (1280, 720))

    analysis = analyzer.analyze_frame(frame)
    congestion = estimator.estimate(analysis["lanes"])

    print(f"\n--- Timestamp: {seconds}s ---")
    print("Total detections:", analysis["total_vehicles"])

    for lane, data in congestion.items():
        print(
            f"{lane}: Demand={data['weighted_demand']}, "
            f"Congestion={data['congestion']}"
        )

video.release()

print("\nPipeline test completed.")
