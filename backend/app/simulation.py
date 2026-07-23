

import math
from dataclasses import dataclass
from datetime import datetime, timedelta

from app.config import settings
from app.core import Direction


BUSES_PER_LINE = 3
LAYOVER_MIN = 6
DWELL_MIN = 3


@dataclass(frozen=True)
class LivePosition:

    from_index: int
    to_index: int
    at_stop: bool
    minutes_to_next: int
    minutes_to_terminus: float
    layover: bool
    direction: Direction


def stop_schedule(minutes_between: list[int]) -> list[int]:
    arrival = [0]
    for gap in minutes_between:
        arrival.append(arrival[-1] + DWELL_MIN + gap)
    return arrival


def sim_minutes(now: datetime) -> float:
    return (now.timestamp() / 60.0) * settings.sim_speed


def opposite(direction: Direction) -> Direction:
    return Direction.BACKWARD if direction is Direction.FORWARD else Direction.FORWARD


def _on_route(pos: float, arrival: list[int], direction: Direction) -> LivePosition:
    last_index = len(arrival) - 1

    from_index = 0
    while from_index < last_index and arrival[from_index + 1] <= pos:
        from_index += 1

    departure = arrival[from_index] + DWELL_MIN
    at_stop = pos < departure
    to_index = from_index + 1
    next_event = departure if at_stop else arrival[to_index]

    return LivePosition(
        from_index=from_index,
        to_index=to_index,
        at_stop=at_stop,
        minutes_to_next=max(1, math.ceil(next_event - pos)),
        minutes_to_terminus=arrival[last_index] - pos,
        layover=False,
        direction=direction,
    )


def _at_layover(arrival: list[int], remaining: float, direction: Direction) -> LivePosition:
    last_index = len(arrival) - 1
    return LivePosition(
        from_index=last_index,
        to_index=last_index,
        at_stop=False,
        minutes_to_next=max(1, math.ceil(remaining)),
        minutes_to_terminus=0.0,
        layover=True,
        direction=direction,
    )


def round_trip_position(
    bus_index: int,
    bus_count: int,
    schedules: dict[Direction, list[int]],
    now: datetime,
    start: Direction = Direction.FORWARD,
) -> LivePosition:
    legs = [(d, schedules.get(d) or []) for d in (start, opposite(start))]
    legs = [(d, arrival) for d, arrival in legs if len(arrival) > 1]
    if not legs:
        return LivePosition(0, 0, True, 1, 0.0, False, start)

    cycle_min = sum(arrival[-1] for _, arrival in legs) + LAYOVER_MIN * len(legs)

    offset = (bus_index * cycle_min) / max(1, bus_count)
    pos = (sim_minutes(now) - offset) % cycle_min

    for direction, arrival in legs:
        if pos < arrival[-1]:
            return _on_route(pos, arrival, direction)
        pos -= arrival[-1]
        if pos < LAYOVER_MIN:
            return _at_layover(arrival, LAYOVER_MIN - pos, direction)
        pos -= LAYOVER_MIN

    return _on_route(0.0, legs[0][1], legs[0][0])


def terminus_moment(now: datetime, minutes_to_terminus: float) -> datetime:

    return now + timedelta(minutes=minutes_to_terminus / settings.sim_speed)


def peak_hours(hourly: list[int], count: int = 2) -> list[int]:

    if not hourly or not any(hourly):
        return []

    by_busiest = sorted(range(len(hourly)), key=lambda h: hourly[h], reverse=True)

    peaks: list[int] = []
    for hour in by_busiest:
        if len(peaks) >= count:
            break
        if any(abs(picked - hour) <= 1 for picked in peaks):
            continue
        peaks.append(hour)
    return sorted(peaks)


def load_level(ratio: float, low: float, high: float) -> str:
    if ratio < low:
        return "low"
    if ratio > high:
        return "high"
    return "normal"
