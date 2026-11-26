from src.simulation.signal_controller import AdaptiveSignalController

controller = AdaptiveSignalController()

test_cases = [
    {
        "North": 2.5,
        "East": 6.0,
        "South": 0,
        "West": 1.0
    },
    {
        "North": 5.0,
        "East": 1.0,
        "South": 2.0,
        "West": 3.0
    },
    {
        "North": 0,
        "East": 0,
        "South": 0,
        "West": 0
    }
]

print("\n========== ADAPTIVE SIGNAL TEST ==========")

for number, demand in enumerate(test_cases, start=1):
    decision = controller.decide(demand)

    print(f"\nTest {number}")
    print("Demand:", demand)
    print("Green lane:", decision["green_lane"])
    print("Green duration:", decision["green_duration"], "seconds")
    print("Yellow duration:", decision["yellow_duration"], "seconds")
    print("Status:", decision["status"])
