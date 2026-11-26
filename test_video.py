from src.traffic.video_processor import TrafficVideoProcessor

processor = TrafficVideoProcessor(
    confidence=0.25,
    frame_skip=5,
    max_width=1280
)

print("Processing traffic video...")

result = processor.process(
    "data/videos/traffic.mp4",
    "data/processed/traffic_detected.mp4"
)

print("\n========== VIDEO PROCESSING RESULTS ==========")
for key, value in result.items():
    print(f"{key}: {value}")
