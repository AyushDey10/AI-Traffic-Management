from src.simulation.traffic_simulator import TrafficSimulator

seeds = range(10)

metrics = [
    "vehicles_served",
    "vehicles_remaining",
    "average_queue",
    "estimated_average_wait"
]

totals = {
    "fixed_time": {key: 0 for key in metrics},
    "adaptive": {key: 0 for key in metrics}
}

for seed in seeds:
    results = TrafficSimulator(duration=600, seed=seed).compare()

    for policy in ["fixed_time", "adaptive"]:
        for key in metrics:
            totals[policy][key] += results[policy][key]

print("\n========== 10-RUN AVERAGE ==========")

for policy in ["fixed_time", "adaptive"]:
    print(f"\n{policy.upper()}")

    for key in metrics:
        average = totals[policy][key] / len(seeds)
        print(f"{key}: {average:.2f}")

print("\n========== ADAPTIVE IMPROVEMENT ==========")

for key in metrics:
    fixed = totals["fixed_time"][key] / len(seeds)
    adaptive = totals["adaptive"][key] / len(seeds)

    if fixed:
        improvement = ((fixed - adaptive) / fixed) * 100

        if key == "vehicles_served":
            improvement = -improvement

        print(f"{key}: {improvement:.2f}%")
