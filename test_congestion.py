from src.traffic.congestion_estimator import CongestionEstimator

sample_lanes = {
    "North": {"total": 3, "Car": 2, "Motorcycle": 1, "Bus": 0, "Truck": 0},
    "South": {"total": 0, "Car": 0, "Motorcycle": 0, "Bus": 0, "Truck": 0},
    "East": {"total": 4, "Car": 2, "Motorcycle": 0, "Bus": 1, "Truck": 1},
    "West": {"total": 1, "Car": 1, "Motorcycle": 0, "Bus": 0, "Truck": 0},
    "Unassigned": {"total": 1, "Car": 1, "Motorcycle": 0, "Bus": 0, "Truck": 0}
}

estimator = CongestionEstimator()
result = estimator.estimate(sample_lanes)

print("\n========== CONGESTION ESTIMATION TEST ==========")

for lane, data in result.items():
    print(
        f"{lane}: Vehicles={data['vehicle_count']}, "
        f"Demand={data['weighted_demand']}, "
        f"Congestion={data['congestion']}"
    )
