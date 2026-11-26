import pytest

from src.traffic.congestion_estimator import CongestionEstimator


def lane_data(**counts):
    bucket = {"total": 0, "Car": 0, "Motorcycle": 0, "Bus": 0, "Truck": 0}
    bucket.update(counts)
    bucket["total"] = bucket["Car"] + bucket["Motorcycle"] + bucket["Bus"] + bucket["Truck"]
    return bucket


def test_zero_demand_is_empty():
    estimator = CongestionEstimator()
    results = estimator.estimate({lane: lane_data() for lane in ("North", "South", "East", "West")})

    assert all(result["congestion"] == "Empty" for result in results.values())
    assert all(result["utilisation"] == 0 for result in results.values())


def test_weighted_demand_uses_configured_weights():
    estimator = CongestionEstimator(lane_capacity=18.0)
    results = estimator.estimate({"North": lane_data(Car=2, Bus=1)})

    # 2 cars x 1.0 + 1 bus x 1.6
    assert results["North"]["weighted_demand"] == pytest.approx(3.6)
    assert results["North"]["vehicle_count"] == 3


def test_levels_follow_utilisation_thresholds():
    estimator = CongestionEstimator(lane_capacity=10.0)
    cases = {
        0: "Empty",
        1: "Low",
        3: "Moderate",
        6: "High",
        9: "Severe",
    }

    for cars, expected in cases.items():
        results = estimator.estimate({"East": lane_data(Car=cars)})
        assert results["East"]["congestion"] == expected, f"{cars} cars"


def test_capacity_is_configurable():
    small = CongestionEstimator(lane_capacity=5.0)
    large = CongestionEstimator(lane_capacity=50.0)
    data = {"West": lane_data(Car=4)}

    assert small.estimate(data)["West"]["congestion"] != large.estimate(data)["West"]["congestion"]
    assert small.estimate(data)["West"]["utilisation"] > large.estimate(data)["West"]["utilisation"]


def test_class_weight_cap_limits_one_detection():
    estimator = CongestionEstimator(max_class_weight=1.0)
    results = estimator.estimate({"South": lane_data(Bus=1)})

    assert results["South"]["weighted_demand"] == pytest.approx(1.0)


def test_single_bus_does_not_dominate_demand():
    estimator = CongestionEstimator(lane_capacity=18.0)
    results = estimator.estimate({"South": lane_data(Bus=1)})
    assert results["South"]["utilisation"] < 0.2


def test_invalid_capacity_is_rejected():
    with pytest.raises(ValueError):
        CongestionEstimator(lane_capacity=0)


def test_snapshot_summary_reports_dominant_approach():
    estimator = CongestionEstimator()
    results = estimator.estimate(
        {
            "North": lane_data(Car=1),
            "South": lane_data(Car=1),
            "East": lane_data(Car=5),
            "West": lane_data(Car=2),
        }
    )
    summary = estimator.snapshot_summary(results)

    assert summary["dominant_approach"] == "East"
    assert summary["total_weighted_demand"] == pytest.approx(9.0)
    assert summary["is_snapshot"] is True
    assert sum(summary["level_counts"].values()) == 4


def test_missing_approach_is_treated_as_empty():
    estimator = CongestionEstimator()
    results = estimator.estimate({"North": lane_data(Car=1)})

    assert results["West"]["congestion"] == "Empty"
    assert results["West"]["weighted_demand"] == 0
