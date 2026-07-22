import json
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path

from sqlalchemy import select

from app.core import CardType, Direction, TripStatus, hash_password
from app.database import SessionLocal
from app.models import Bus, Card, Line, LineStop, Passenger, Trip

DATA_FILE = Path(__file__).resolve().parent.parent / "lines.json"

DAYS = 14
PASSENGER_COUNT = 40
TRIPS_PER_LINE_PER_DAY = (18, 34)
OPEN_TRIP_COUNT = 12

FIRST_NAMES = [
    "Ahmet", "Mehmet", "Ayşe", "Fatma", "Mustafa", "Zeynep", "Emre", "Elif",
    "Burak", "Merve", "Hakan", "Selin", "Onur", "Büşra", "Kerem", "Deniz",
    "Serkan", "Gizem", "Yusuf", "Ece",
]

LAST_NAMES = [
    "Yılmaz", "Kaya", "Demir", "Şahin", "Çelik", "Yıldız", "Yıldırım", "Öztürk",
    "Aydın", "Özdemir", "Arslan", "Doğan", "Kılıç", "Aslan", "Çetin", "Kara",
]

CARD_TYPE_WEIGHTS = [(CardType.NORMAL, 60), (CardType.STUDENT, 30), (CardType.SENIOR, 10)]


def _pick_card_type() -> CardType:
    types = [t for t, _ in CARD_TYPE_WEIGHTS]
    weights = [w for _, w in CARD_TYPE_WEIGHTS]
    return random.choices(types, weights=weights, k=1)[0]


def _ensure_passengers(db) -> list[Card]:
    existing = db.scalars(select(Card).where(Card.is_deleted.is_(False))).all()
    if len(existing) >= PASSENGER_COUNT:
        return list(existing)

    cards = list(existing)
    password_hash = hash_password("demo1234")

    for index in range(len(existing), PASSENGER_COUNT):
        full_name = f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}"
        passenger = Passenger(
            full_name=full_name,
            email=f"demo{index + 1}@akbil.local",
            password_hash=password_hash,
        )
        db.add(passenger)
        db.flush()

        card = Card(passenger_id=passenger.id, card_type=_pick_card_type())
        db.add(card)
        db.flush()
        cards.append(card)

    return cards


def _ordered_stops(db, line_id, direction) -> list[LineStop]:
    stmt = (
        select(LineStop)
        .where(LineStop.line_id == line_id, LineStop.direction == direction)
        .order_by(LineStop.sequence)
    )
    return list(db.scalars(stmt).all())


def _travel_minutes(stops: list[LineStop], board_index: int, alight_index: int) -> int:
    return sum(
        (ls.minutes_from_previous or 0) for ls in stops[board_index + 1 : alight_index + 1]
    )


def _make_trip(card, bus, line_id, stops, board_index, alight_index, boarded_at, status):
    duration = _travel_minutes(stops, board_index, alight_index)
    trip = Trip(
        card_id=card.id,
        bus_id=bus.id,
        line_id=line_id,
        board_stop_id=stops[board_index].stop_id,
        boarded_at=boarded_at,
        card_type_snapshot=card.card_type,
        status=status,
    )
    if status == TripStatus.COMPLETED:
        trip.alight_stop_id = stops[alight_index].stop_id
        trip.alighted_at = boarded_at + timedelta(minutes=duration)
    elif status == TripStatus.ABANDONED:
        trip.alighted_at = boarded_at + timedelta(hours=3)
    return trip


def run() -> None:
    payload = json.loads(DATA_FILE.read_text(encoding="utf-8"))
    hourly_by_code = {item["code"]: item.get("hourly") for item in payload}

    db = SessionLocal()
    try:
        db.query(Trip).delete()
        db.flush()

        cards = _ensure_passengers(db)
        lines = db.scalars(select(Line).where(Line.is_deleted.is_(False))).all()

        if not lines:
            print("Hat bulunamadi. Once 'python -m app.seed' calistir.")
            return

        now = datetime.now(timezone.utc)
        created = 0

        for line in lines:
            buses = db.scalars(
                select(Bus).where(Bus.line_id == line.id, Bus.is_deleted.is_(False))
            ).all()
            if not buses:
                continue

            hourly = hourly_by_code.get(line.code) or [1] * 24
            directions = {
                Direction.FORWARD: _ordered_stops(db, line.id, Direction.FORWARD),
                Direction.BACKWARD: _ordered_stops(db, line.id, Direction.BACKWARD),
            }

            for day_offset in range(DAYS, 0, -1):
                day = (now - timedelta(days=day_offset)).replace(
                    hour=0, minute=0, second=0, microsecond=0
                )
                count = random.randint(*TRIPS_PER_LINE_PER_DAY)

                for _ in range(count):
                    direction = random.choice(list(directions))
                    stops = directions[direction]
                    if len(stops) < 2:
                        continue

                    hour = random.choices(range(24), weights=hourly, k=1)[0]
                    boarded_at = day + timedelta(
                        hours=hour, minutes=random.randint(0, 59)
                    )

                    board_index = random.randint(0, len(stops) - 2)
                    alight_index = random.randint(board_index + 1, len(stops) - 1)

                    status = (
                        TripStatus.ABANDONED
                        if random.random() < 0.08
                        else TripStatus.COMPLETED
                    )

                    db.add(
                        _make_trip(
                            random.choice(cards),
                            random.choice(buses),
                            line.id,
                            stops,
                            board_index,
                            alight_index,
                            boarded_at,
                            status,
                        )
                    )
                    created += 1

                db.flush()

        open_cards = random.sample(cards, min(OPEN_TRIP_COUNT, len(cards)))
        for card in open_cards:
            line = random.choice(lines)
            buses = db.scalars(
                select(Bus).where(Bus.line_id == line.id, Bus.is_deleted.is_(False))
            ).all()
            if not buses:
                continue

            direction = random.choice([Direction.FORWARD, Direction.BACKWARD])
            stops = _ordered_stops(db, line.id, direction)
            if len(stops) < 2:
                continue

            board_index = random.randint(0, len(stops) - 2)
            boarded_at = now - timedelta(minutes=random.randint(2, 25))
            bus = random.choice(buses)

            db.add(
                _make_trip(
                    card, bus, line.id, stops, board_index, len(stops) - 1,
                    boarded_at, TripStatus.OPEN,
                )
            )
            bus.current_stop_id = stops[board_index].stop_id
            bus.location_updated_at = boarded_at
            created += 1

        db.commit()
        print(f"{created} seyahat uretildi ({len(cards)} kart, {len(lines)} hat).")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    run()