"""Discrete-time simulation of the four-approach intersection.

The simulation is a queueing model, not a traffic microsimulation: one
approach is green at a time, vehicles arrive at a configurable rate and the
green approach clears them at the shared ``SERVICE_RATE``.

Arrival rates are chosen so the intersection is loaded but not saturated by
construction (total demand is below total capacity), which is what allows two
control strategies to be compared fairly. Every vehicle's arrival time is
stored, so waiting time is measured rather than inferred from queue length.
"""

import random
from collections import deque

from src.simulation.signal_controller import (
    ALL_RED_TIME,
    SERVICE_RATE,
    YELLOW_TIME,
    AdaptiveSignalController,
)

LANES = ("North", "South", "East", "West")

# Vehicles per second per approach (~470-860 veh/h), deliberately uneven.
DEFAULT_ARRIVAL_RATES = {
    "North": 0.13,
    "East": 0.24,
    "South": 0.11,
    "West": 0.22,
}

FIXED_GREEN_TIME = 15
SAMPLE_INTERVAL = 5

SUMMARY_METRICS = (
    "vehicles_served",
    "vehicles_remaining",
    "average_queue",
    "average_wait_seconds",
    "maximum_wait_seconds",
    "throughput_per_minute",
    "long_wait_events",
)


def _empty_lane_stats():
    return {
        "arrivals": 0,
        "served": 0,
        "remaining": 0,
        "served_wait_total": 0.0,
        "first_green_in_seconds": None,
        "maximum_wait_seconds": 0.0,
    }


class TrafficSimulator:
    def __init__(self, duration=600, seed=42, arrival_rates=None, service_rate=SERVICE_RATE):
        if not 30 <= duration <= 3600:
            raise ValueError("duration must be between 30 and 3600 seconds")
        if service_rate <= 0:
            raise ValueError("service_rate must be positive")

        rates = dict(DEFAULT_ARRIVAL_RATES)
        if arrival_rates:
            for lane, rate in arrival_rates.items():
                if lane not in LANES:
                    raise ValueError(f"unknown approach: {lane}")
                if rate < 0:
                    raise ValueError("arrival rates cannot be negative")
                rates[lane] = float(rate)

        self.duration = int(duration)
        self.seed = int(seed)
        self.arrival_rates = rates
        self.service_rate = float(service_rate)

    def _simulate(self, policy):
        if policy not in ("fixed", "adaptive"):
            raise ValueError("Policy must be 'fixed' or 'adaptive'")

        rng = random.Random(self.seed)
        queues = {lane: deque() for lane in LANES}
        waits = {lane: 0.0 for lane in LANES}
        lane_stats = {lane: _empty_lane_stats() for lane in LANES}

        controller = AdaptiveSignalController(service_rate=self.service_rate)

        elapsed = 0
        fixed_index = 0
        served_wait_total = 0.0
        served_count = 0
        queue_sum = 0.0
        max_queue = 0
        maximum_wait = 0.0
        long_wait_events = 0
        cycles = 0
        decisions = []

        timeseries = {"t": [], "total": []}
        for lane in LANES:
            timeseries[lane] = []

        while elapsed < self.duration:
            if policy == "fixed":
                green_lane = LANES[fixed_index]
                fixed_index = (fixed_index + 1) % len(LANES)
                green_duration = FIXED_GREEN_TIME
                decision = {
                    "green_lane": green_lane,
                    "green_duration": green_duration,
                    "priority": "fixed_rotation",
                    "demand": len(queues[green_lane]),
                    "reason": "Fixed-time plan rotates through the approaches equally.",
                }
            else:
                decision = controller.decide(
                    {lane: float(len(queues[lane])) for lane in LANES},
                    waits,
                )
                green_lane = decision["green_lane"]
                green_duration = decision["green_duration"]

                if green_lane is None:
                    green_duration = 0

            if len(decisions) < 24:
                decisions.append(
                    {
                        "cycle": cycles + 1,
                        "start_second": elapsed,
                        "green_lane": green_lane,
                        "green_duration": green_duration,
                        "demand": round(float(decision.get("demand", 0)), 2),
                        "priority": decision.get("priority", "max_demand"),
                        "reason": decision.get("reason", ""),
                    }
                )

            phases = [
                (green_lane, green_duration),
                (None, YELLOW_TIME),
                (None, ALL_RED_TIME),
            ]

            for phase_lane, seconds in phases:
                credit = 0.0

                for _ in range(seconds):
                    if elapsed >= self.duration:
                        break

                    for lane in LANES:
                        if rng.random() < self.arrival_rates[lane]:
                            queues[lane].append(elapsed)
                            lane_stats[lane]["arrivals"] += 1

                    if phase_lane is not None:
                        credit += self.service_rate
                        while credit >= 1.0 and queues[phase_lane]:
                            arrival = queues[phase_lane].popleft()
                            credit -= 1.0
                            wait = elapsed - arrival

                            served_count += 1
                            served_wait_total += wait
                            lane_stats[phase_lane]["served"] += 1
                            lane_stats[phase_lane]["served_wait_total"] += wait
                            lane_stats[phase_lane]["maximum_wait_seconds"] = max(
                                lane_stats[phase_lane]["maximum_wait_seconds"], wait
                            )
                            maximum_wait = max(maximum_wait, wait)

                            if wait > controller.max_wait:
                                long_wait_events += 1

                    total_queue = sum(len(queue) for queue in queues.values())
                    queue_sum += total_queue
                    max_queue = max(max_queue, total_queue)

                    for lane in LANES:
                        if lane == phase_lane:
                            waits[lane] = 0.0
                            if lane_stats[lane]["first_green_in_seconds"] is None:
                                lane_stats[lane]["first_green_in_seconds"] = elapsed
                        else:
                            waits[lane] += 1.0

                    elapsed += 1

                    if elapsed % SAMPLE_INTERVAL == 0:
                        timeseries["t"].append(elapsed)
                        timeseries["total"].append(total_queue)
                        for lane in LANES:
                            timeseries[lane].append(len(queues[lane]))

            cycles += 1

        remaining_wait_total = 0.0
        remaining_count = 0

        for lane in LANES:
            lane_stats[lane]["remaining"] = len(queues[lane])
            for arrival in queues[lane]:
                wait = elapsed - arrival
                remaining_wait_total += wait
                remaining_count += 1
                lane_stats[lane]["maximum_wait_seconds"] = max(
                    lane_stats[lane]["maximum_wait_seconds"], wait
                )
                maximum_wait = max(maximum_wait, wait)
                if wait > controller.max_wait:
                    long_wait_events += 1

            if lane_stats[lane]["served"]:
                lane_stats[lane]["average_wait_seconds"] = round(
                    lane_stats[lane]["served_wait_total"] / lane_stats[lane]["served"], 2
                )
            else:
                lane_stats[lane]["average_wait_seconds"] = 0.0
            lane_stats[lane]["maximum_wait_seconds"] = round(
                lane_stats[lane]["maximum_wait_seconds"], 2
            )

        total_arrivals = sum(stats["arrivals"] for stats in lane_stats.values())
        all_wait_total = served_wait_total + remaining_wait_total

        return {
            "policy": policy,
            "seed": self.seed,
            "simulation_seconds": self.duration,
            "arrival_rates": self.arrival_rates,
            "service_rate": self.service_rate,
            "total_arrivals": total_arrivals,
            "vehicles_served": served_count,
            "vehicles_remaining": remaining_count,
            "throughput_per_minute": round(served_count / (self.duration / 60.0), 2),
            "average_queue": round(queue_sum / max(1, self.duration), 2),
            "maximum_queue": max_queue,
            "average_wait_seconds": round(all_wait_total / total_arrivals, 2)
            if total_arrivals
            else 0.0,
            "average_wait_served_seconds": round(served_wait_total / served_count, 2)
            if served_count
            else 0.0,
            "average_wait_remaining_seconds": round(remaining_wait_total / remaining_count, 2)
            if remaining_count
            else 0.0,
            "maximum_wait_seconds": round(maximum_wait, 2),
            "long_wait_events": long_wait_events,
            "cycles": cycles,
            "per_lane": lane_stats,
            "timeseries": timeseries,
            "decisions": decisions,
            "wait_note": (
                "average_wait_seconds includes vehicles still queued at the end, "
                "using the time they had already waited (censored wait)."
            ),
        }

    def run(self, policy):
        """Run one strategy in isolation."""
        return self._simulate(policy)

    def compare(self):
        fixed = self._simulate("fixed")
        adaptive = self._simulate("adaptive")
        return {"fixed_time": fixed, "adaptive": adaptive, "seed": self.seed}

    @classmethod
    def compare_seeds(cls, seeds, duration=600, arrival_rates=None):
        """Run both strategies over several seeds and aggregate the metrics."""
        seeds = [int(seed) for seed in seeds]
        if not seeds:
            raise ValueError("At least one seed is required")

        rows = []
        for seed in seeds:
            simulator = cls(duration=duration, seed=seed, arrival_rates=arrival_rates)
            result = simulator.compare()
            rows.append({"seed": seed, "fixed_time": result["fixed_time"], "adaptive": result["adaptive"]})

        summary = {}
        for policy in ("fixed_time", "adaptive"):
            summary[policy] = {}
            for metric in SUMMARY_METRICS:
                values = [row[policy][metric] for row in rows]
                mean = sum(values) / len(values)
                variance = sum((value - mean) ** 2 for value in values) / len(values)
                summary[policy][metric] = {
                    "mean": round(mean, 2),
                    "std": round(variance ** 0.5, 2),
                    "min": round(min(values), 2),
                    "max": round(max(values), 2),
                }

        adaptive_wins = sum(
            1
            for row in rows
            if row["adaptive"]["average_wait_seconds"] < row["fixed_time"]["average_wait_seconds"]
        )
        adaptive_served_more = sum(
            1
            for row in rows
            if row["adaptive"]["vehicles_served"] > row["fixed_time"]["vehicles_served"]
        )

        return {
            "duration": duration,
            "seed_count": len(seeds),
            "seeds": seeds,
            "rows": [
                {
                    "seed": row["seed"],
                    "fixed_served": row["fixed_time"]["vehicles_served"],
                    "adaptive_served": row["adaptive"]["vehicles_served"],
                    "fixed_wait": row["fixed_time"]["average_wait_seconds"],
                    "adaptive_wait": row["adaptive"]["average_wait_seconds"],
                    "fixed_queue": row["fixed_time"]["average_queue"],
                    "adaptive_queue": row["adaptive"]["average_queue"],
                    "fixed_max_wait": row["fixed_time"]["maximum_wait_seconds"],
                    "adaptive_max_wait": row["adaptive"]["maximum_wait_seconds"],
                }
                for row in rows
            ],
            "summary": summary,
            "adaptive_lower_wait_seeds": adaptive_wins,
            "adaptive_served_more_seeds": adaptive_served_more,
            "honesty_note": (
                "Both strategies use the same random seed and arrival rates. "
                "Adaptive control is not tuned per seed; where it loses, that "
                "result is reported unchanged."
            ),
        }
