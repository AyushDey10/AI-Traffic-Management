"""Rule-based adaptive signal phase recommendation.

The controller recommends the *next* green phase from a snapshot of approach
demand (weighted vehicle units) and the time each approach has waited. It is
not a complete signal plan: there is no cycle optimisation, no coordination
with neighbouring junctions and no safety certification.

Units
-----
Demand is expressed in vehicle units. One green approach clears
``SERVICE_RATE`` vehicles per second, so a queue of ``n`` units needs about
``n / SERVICE_RATE`` seconds of green. The same constant is used by
``TrafficSimulator`` so recommendations and simulation agree.
"""

LANES = ("North", "South", "East", "West")

# Vehicles per second cleared by one green approach. The monitored approaches
# have roughly three lanes, and a saturated lane discharges about 0.5 veh/s
# (~1800 veh/h), so one green approach clears 3 x 0.5 = 1.5 veh/s.
SERVICE_RATE = 1.5

MIN_GREEN = 12
MAX_GREEN = 45
YELLOW_TIME = 3
ALL_RED_TIME = 1

# An approach waiting at least this long is served even if demand is low.
# Kept below one fixed-time cycle (~76 s) so fairness actually protects lanes.
MAX_WAIT = 45


class AdaptiveSignalController:
    def __init__(
        self,
        min_green=MIN_GREEN,
        max_green=MAX_GREEN,
        service_rate=SERVICE_RATE,
        max_wait=MAX_WAIT,
    ):
        if min_green < 5:
            raise ValueError("min_green must be at least 5 seconds")
        if max_green < min_green:
            raise ValueError("max_green must be greater than or equal to min_green")
        if service_rate <= 0:
            raise ValueError("service_rate must be positive")
        if max_wait <= 0:
            raise ValueError("max_wait must be positive")

        self.min_green = int(min_green)
        self.max_green = int(max_green)
        self.service_rate = float(service_rate)
        self.max_wait = float(max_wait)

        self.last_served = None
        self.cycle = 0

    def green_for(self, demand):
        """Green seconds for ``demand`` units, clamped to the configured bounds."""
        seconds = self.min_green * 0.5 + demand / self.service_rate
        return int(min(self.max_green, max(self.min_green, round(seconds))))

    def _round_robin(self, candidates):
        if self.last_served is None:
            return candidates[0]

        start = LANES.index(self.last_served)
        ordered = [LANES[(start + offset) % len(LANES)] for offset in range(1, len(LANES) + 1)]
        for lane in ordered:
            if lane in candidates:
                return lane
        return candidates[0]

    def decide(self, lane_demand, lane_wait=None):
        """Recommend the next green phase.

        ``lane_demand`` maps approach -> weighted vehicle units.
        ``lane_wait`` (optional) maps approach -> seconds since its last green.
        """
        demand = {}
        for lane in LANES:
            value = (lane_demand or {}).get(lane, 0) or 0
            demand[lane] = max(0.0, float(value))

        waits = {}
        for lane in LANES:
            value = (lane_wait or {}).get(lane, 0) or 0
            waits[lane] = max(0.0, float(value))

        active = [lane for lane in LANES if demand[lane] > 0]

        if not active:
            return {
                "green_lane": None,
                "green_duration": 0,
                "yellow_duration": YELLOW_TIME,
                "all_red_duration": ALL_RED_TIME,
                "demand": 0,
                "waiting_seconds": 0,
                "priority": "none",
                "expected_cleared_units": 0,
                "status": "Idle - no vehicles detected on any approach",
                "reason": "All approach demands are zero, so no green phase is needed.",
                "cycle": self.cycle,
            }

        starving = [lane for lane in active if waits[lane] >= self.max_wait]

        if starving:
            lane = max(starving, key=lambda name: waits[name])
            priority = "max_wait"
            reason = (
                f"{lane} has waited {waits[lane]:.0f}s, which reaches the "
                f"{self.max_wait:.0f}s fairness limit, so it is served even though "
                f"another approach may have higher demand."
            )
        else:
            highest = max(demand[lane] for lane in active)
            candidates = [lane for lane in active if demand[lane] == highest]
            lane = self._round_robin(candidates)
            priority = "max_demand"
            reason = (
                f"{lane} has the highest weighted demand "
                f"({demand[lane]:.1f} vehicle units) of the active approaches."
            )

        green_duration = self.green_for(demand[lane])

        self.last_served = lane
        self.cycle += 1

        return {
            "green_lane": lane,
            "green_duration": green_duration,
            "yellow_duration": YELLOW_TIME,
            "all_red_duration": ALL_RED_TIME,
            "demand": round(demand[lane], 2),
            "waiting_seconds": round(waits[lane], 1),
            "priority": priority,
            "expected_cleared_units": round(green_duration * self.service_rate, 1),
            "status": f"Recommended next green: {lane} for {green_duration}s",
            "reason": reason,
            "cycle": self.cycle,
        }
