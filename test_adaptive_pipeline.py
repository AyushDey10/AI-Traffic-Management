import cv2

from src.traffic.traffic_analyzer import TrafficAnalyzer
from src.traffic.congestion_estimator import CongestionEstimator
from src.simulation.signal_controller import AdaptiveSignalController

VIDEO_PATH = "data/videos/traffic.mp4"
TIMESTAMPS = [2, 16, 35]

analyzer = TrafficAnalyzer(confidence=0.15)
estimator = CongestionEstimator()
controller = AdaptiveSignalController()

video = cv2.VideoCapture(VIDEO_PATH)

if not video.isOpened():
    raise RuntimeError("Cannot open traffic video")

print("\n========== ADAPTIVE TRAFFIC MANAGEMENT ==========")

for seconds in TIMESTAMPS:
    video.set(cv2.CAP_PROP_POS_MSEC, seconds * 1000)
    success, frame = video.read()

    if not success:
        print(f"Could not read frame at {seconds}s")
        continue

    frame = cv2.resize(frame, (1280, 720))

    analysis = analyzer.analyze_frame(frame)
    congestion = estimator.estimate(analysis["lanes"])

    demand = {
        lane: data["weighted_demand"]
        for lane, data in congestion.items()
    }

    decision = controller.decide(demand)

    print(f"\nTimestamp: {seconds}s")
    print("Detected vehicles:", analysis["total_vehicles"])
    print("Lane demand:", demand)
    print("Selected green lane:", decision["green_lane"])
    print("Green duration:", decision["green_duration"], "seconds")
    print("Yellow duration:", decision["yellow_duration"], "seconds")
    print("Controller status:", decision["status"])

video.release()

print("\nAdaptive pipeline test completed.")
