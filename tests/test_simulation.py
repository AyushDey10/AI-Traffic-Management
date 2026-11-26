import pytest

from src.simulation.traffic_simulator import LANES, TrafficSimulator


def test_same_seed_is_reproducible():
    first = TrafficSimulator(duration=300, seed=7).compare()
    second = TrafficSimulator(duration=300, seed=7).compare()

    assert first["fixed_time"] == second["fixed_time"]
    assert first["adaptive"] == second["adaptive"]


def test_different_seeds_change_the_arrivals():
    first = TrafficSimulator(duration=300, seed=1).compare()
    second = TrafficSimulator(duration=300, seed=2).compare()

    assert first["fixed_time"]["total_arrivals"] != second["fixed_time"]["total_arrivals"]


def test_both_policies_see_identical_arrivals():
    result = TrafficSimulator(duration=300, seed=3).compare()

    assert result["fixed_time"]["total_arrivals"] == result["adaptive"]["total_arrivals"]


def test_vehicles_are_conserved():
    for policy in ("fixed", "adaptive"):
        result = TrafficSimulator(duration=400, seed=5).run(policy)
        assert result["vehicles_served"] + result["vehicles_remaining"] == result["total_arrivals"]


def test_average_wait_includes_remaining_vehicles():
    result = TrafficSimulator(duration=300, seed=9).run("adaptive")
    served = result["vehicles_served"]
    remaining = result["vehicles_remaining"]

    assert result["total_arrivals"] == served + remaining
    if served and remaining:
        expected = (
            result["average_wait_served_seconds"] * served
            + result["average_wait_remaining_seconds"] * remaining
        ) / (served + remaining)
        assert result["average_wait_seconds"] == pytest.approx(expected, abs=0.05)


def test_demand_is_below_capacity():
    result = TrafficSimulator(duration=600, seed=42).compare()

    for policy in ("fixed_time", "adaptive"):
        metrics = result[policy]
        assert metrics["vehicles_served"] / metrics["total_arrivals"] > 0.85
        assert metrics["vehicles_remaining"] < metrics["total_arrivals"] * 0.15


def test_timeseries_is_consistent():
    result = TrafficSimulator(duration=300, seed=11).run("adaptive")
    series = result["timeseries"]
    length = len(series["t"])

    assert length > 0
    assert len(series["total"]) == length
    for lane in LANES:
        assert len(series[lane]) == length


def test_per_lane_stats_are_present():
    result = TrafficSimulator(duration=300, seed=4).run("fixed")

    assert set(result["per_lane"]) == set(LANES)
    for lane in LANES:
        stats = result["per_lane"][lane]
        assert stats["arrivals"] == stats["served"] + stats["remaining"]
        assert stats["maximum_wait_seconds"] >= 0


def test_compare_seeds_aggregates_ten_runs():
    sweep = TrafficSimulator.compare_seeds(list(range(10)), duration=300)

    assert sweep["seed_count"] == 10
    assert len(sweep["rows"]) == 10
    assert sweep["rows"][0]["seed"] == 0

    for policy in ("fixed_time", "adaptive"):
        for metric in ("vehicles_served", "average_wait_seconds", "maximum_wait_seconds"):
            entry = sweep["summary"][policy][metric]
            assert entry["min"] <= entry["mean"] <= entry["max"]

    assert 0 <= sweep["adaptive_lower_wait_seeds"] <= 10
    assert sweep["honesty_note"]


def test_policies_produce_different_queues():
    result = TrafficSimulator(duration=600, seed=42).compare()

    assert result["fixed_time"]["average_queue"] != result["adaptive"]["average_queue"]


def test_invalid_policy_is_rejected():
    with pytest.raises(ValueError):
        TrafficSimulator(duration=300).run("magic")


def test_invalid_duration_is_rejected():
    with pytest.raises(ValueError):
        TrafficSimulator(duration=10)


def test_unknown_arrival_rate_approach_is_rejected():
    with pytest.raises(ValueError):
        TrafficSimulator(arrival_rates={"Upward": 0.1})
