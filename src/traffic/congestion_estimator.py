"""Snapshot congestion estimate for each approach.

This module does **not** measure a physical queue. It converts the vehicles
detected in one frame into weighted vehicle units, divides by a configurable
approach capacity, and maps that utilisation onto a coarse level.

Limitations to keep in mind when presenting the output:

* Detection recall on this footage is low (a large share of approach vehicles
  are missed), so utilisation is a lower bound, not a true occupancy figure.
* A single frame cannot describe how a queue is evolving; congestion here is a
  snapshot, not a trend.
* Vehicle class labels come from a stock COCO model and can be wrong (a group
  of cars is occasionally reported as one bus). Class weights are therefore
  capped so one mislabelled box cannot dominate demand.
"""

LANES = ("North", "South", "East", "West")

# Unit multipliers, not measured passenger-car equivalents.
DEFAULT_VEHICLE_WEIGHTS = {
    "Car": 1.0,
    "Motorcycle": 0.6,
    "Bus": 1.6,
    "Truck": 1.6,
}

# Visible approach capacity in vehicle units (roughly four lanes of queued
# vehicles inside each polygon).
DEFAULT_LANE_CAPACITY_UNITS = 18.0

LEVEL_ORDER = ("Empty", "Low", "Moderate", "High", "Severe")


class CongestionEstimator:
    """Convert a per-approach vehicle breakdown into a snapshot congestion level."""

    LEVELS = (
        (0.20, "Low"),
        (0.45, "Moderate"),
        (0.70, "High"),
        (float("inf"), "Severe"),
    )

    def __init__(
        self,
        vehicle_weights=None,
        lane_capacity=DEFAULT_LANE_CAPACITY_UNITS,
        max_class_weight=1.6,
    ):
        weights = dict(DEFAULT_VEHICLE_WEIGHTS)
        if vehicle_weights:
            weights.update({key: float(value) for key, value in vehicle_weights.items()})

        if max_class_weight is not None:
            weights = {
                key: min(value, float(max_class_weight)) for key, value in weights.items()
            }

        if lane_capacity <= 0:
            raise ValueError("lane_capacity must be positive")

        self.vehicle_weights = weights
        self.lane_capacity = float(lane_capacity)

    def classify(self, utilisation):
        if utilisation <= 0:
            return "Empty"
        for threshold, level in self.LEVELS:
            if utilisation < threshold:
                return level
        return "Severe"

    def estimate(self, lane_data):
        """Return a per-approach snapshot estimate keyed by approach name."""
        results = {}

        for lane in LANES:
            data = lane_data.get(lane) or {}
            total = int(data.get("total", 0))

            weighted_demand = sum(
                data.get(vehicle, 0) * weight
                for vehicle, weight in self.vehicle_weights.items()
            )

            utilisation = weighted_demand / self.lane_capacity
            level = self.classify(utilisation)

            results[lane] = {
                "vehicle_count": total,
                "weighted_demand": round(weighted_demand, 2),
                "capacity_units": self.lane_capacity,
                "utilisation": round(utilisation, 3),
                "congestion": level,
                "level": level,
                "is_snapshot": True,
            }

        return results

    def snapshot_summary(self, results):
        """Aggregate an estimate produced by :meth:`estimate`."""
        demand = {lane: results[lane]["weighted_demand"] for lane in LANES}
        total = round(sum(demand.values()), 2)

        dominant = None
        if total > 0:
            dominant = max(LANES, key=lambda lane: demand[lane])

        level_counts = {level: 0 for level in LEVEL_ORDER}
        for lane in LANES:
            level_counts[results[lane]["congestion"]] += 1

        return {
            "total_weighted_demand": total,
            "dominant_approach": dominant,
            "average_utilisation": round(
                sum(results[lane]["utilisation"] for lane in LANES) / len(LANES), 3
            ),
            "level_counts": level_counts,
            "is_snapshot": True,
            "note": (
                "Snapshot estimate from detected vehicles in one frame; "
                "not a measured physical queue."
            ),
        }
