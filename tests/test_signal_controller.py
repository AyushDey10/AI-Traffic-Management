import pytest

from src.simulation.signal_controller import (
    MAX_GREEN,
    MIN_GREEN,
    SERVICE_RATE,
    AdaptiveSignalController,
)

LANES = ("North", "South", "East", "West")


def demand(**values):
    base = {lane: 0 for lane in LANES}
    base.update(values)
    return base


def test_idle_when_no_demand():
    controller = AdaptiveSignalController()
    decision = controller.decide(demand())

    assert decision["green_lane"] is None
    assert decision["green_duration"] == 0
    assert decision["priority"] == "none"


def test_selects_highest_demand():
    controller = AdaptiveSignalController()
    decision = controller.decide(demand(North=2, South=1, East=9, West=3))

    assert decision["green_lane"] == "East"
    assert decision["priority"] == "max_demand"
    assert "highest weighted demand" in decision["reason"]


def test_green_duration_is_clamped():
    controller = AdaptiveSignalController()
    low = controller.decide(demand(North=0.5))
    high = controller.decide(demand(North=500))

    assert low["green_duration"] == MIN_GREEN
    assert high["green_duration"] == MAX_GREEN
    assert MIN_GREEN <= controller.green_for(12) <= MAX_GREEN


def test_green_scales_between_bounds():
    controller = AdaptiveSignalController()
    small = controller.green_for(4)
    large = controller.green_for(30)

    assert small < large
    assert small >= MIN_GREEN
    assert large <= MAX_GREEN


def test_max_wait_overrides_higher_demand():
    controller = AdaptiveSignalController(max_wait=45)
    decision = controller.decide(
        demand(North=3, South=2, East=40, West=2),
        {"North": 10, "South": 62, "East": 4, "West": 8},
    )

    assert decision["green_lane"] == "South"
    assert decision["priority"] == "max_wait"
    assert "fairness limit" in decision["reason"]


def test_fairness_skips_approaches_with_no_vehicles():
    controller = AdaptiveSignalController(max_wait=45)
    decision = controller.decide(
        demand(North=0, South=1, East=20, West=0),
        {"North": 500, "South": 2, "East": 5, "West": 400},
    )

    # No active approach reached the fairness limit, so demand decides and the
    # empty approaches are ignored even though they have waited longest.
    assert decision["green_lane"] == "East"
    assert decision["priority"] == "max_demand"


def test_zero_demand_approach_is_never_forced_by_wait():
    controller = AdaptiveSignalController(max_wait=45)
    decision = controller.decide(
        demand(North=0, South=2, East=6, West=0),
        {"North": 400, "South": 60, "East": 3, "West": 300},
    )

    assert decision["green_lane"] == "South"
    assert decision["priority"] == "max_wait"


def test_ties_rotate_round_robin():
    controller = AdaptiveSignalController()
    first = controller.decide(demand(North=5, South=5))
    second = controller.decide(demand(North=5, South=5))

    assert first["green_lane"] == "North"
    assert second["green_lane"] == "South"
    assert second["cycle"] > first["cycle"]


def test_service_rate_matches_green_arithmetic():
    controller = AdaptiveSignalController()
    decision = controller.decide(demand(West=10))

    expected = min(MAX_GREEN, max(MIN_GREEN, round(MIN_GREEN * 0.5 + 10 / SERVICE_RATE)))
    assert decision["green_duration"] == expected
    assert decision["expected_cleared_units"] == pytest.approx(expected * SERVICE_RATE, abs=0.11)


def test_invalid_configuration_is_rejected():
    with pytest.raises(ValueError):
        AdaptiveSignalController(min_green=1)
    with pytest.raises(ValueError):
        AdaptiveSignalController(min_green=30, max_green=10)
    with pytest.raises(ValueError):
        AdaptiveSignalController(service_rate=0)
    with pytest.raises(ValueError):
        AdaptiveSignalController(max_wait=0)


def test_negative_demand_is_treated_as_zero():
    controller = AdaptiveSignalController()
    decision = controller.decide({"North": -5, "East": 3})

    assert decision["green_lane"] == "East"
