import cv2
from src.detection.vehicle_detector import VehicleDetector

image = cv2.imread("data/bus.jpg")

detector = VehicleDetector(confidence=0.25)
result = detector.detect(image)

print("\n========== DETECTION RESULTS ==========")
print("Total vehicles:", result["total"])
print("Vehicle counts:", result["counts"])
print("\nIndividual detections:")

for item in result["detections"]:
    print(item)

cv2.imwrite("data/processed/bus_detected.jpg", result["frame"])
print("\nAnnotated image saved: data/processed/bus_detected.jpg")
