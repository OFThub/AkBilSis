import argparse
import json
from pathlib import Path

from sqlalchemy.orm import Session

from app.core import CardMedium, Direction, hash_password
from app.database import SessionLocal
from app.models import Bus, Card, Line, LineStop, Passenger, Stop
from app.simulation import BUSES_PER_LINE

DATA_FILE = Path(__file__).resolve().parent.parent / "lines.json"


def _normalize(name: str) -> str:
    return " ".join(name.strip().lower().split())


def _get_or_create_stop(db: Session, cache: dict[str, Stop], raw: dict) -> Stop:
    key = _normalize(raw["name"])
    if key in cache:
        return cache[key]

    stop = Stop(
        name=raw["name"].strip(),
        latitude=raw.get("lat"),
        longitude=raw.get("lon"),
    )
    db.add(stop)
    db.flush()
    cache[key] = stop
    return stop


def _hourly(payload: dict) -> list[int]:
    """24 elemanlı yoğunluk profili — eksik/bozuk veri sıfır dizisine düşer."""
    raw = payload.get("hourly") or []
    if len(raw) != 24:
        return [0] * 24
    return [int(v) for v in raw]


def _get_or_create_line(db: Session, payload: dict) -> Line:
    line = db.query(Line).filter(Line.code == payload["code"]).first()
    if line:
        line.name = payload["name"]
        line.hourly_profile = _hourly(payload)
        return line

    line = Line(
        code=payload["code"],
        name=payload["name"],
        hourly_profile=_hourly(payload),
    )
    db.add(line)
    db.flush()
    return line


def _sync_line_stops(db: Session, line: Line, stops: list[Stop], minutes: list[int | None]) -> None:
    db.query(LineStop).filter(LineStop.line_id == line.id).delete()
    db.flush()

    for index, (stop, mins) in enumerate(zip(stops, minutes), start=1):
        db.add(
            LineStop(
                line_id=line.id,
                stop_id=stop.id,
                direction=Direction.FORWARD,
                sequence=index,
                minutes_from_previous=mins,
            )
        )

    reverse_stops = list(reversed(stops))
    reverse_minutes = [None] + list(reversed(minutes[1:]))

    for index, (stop, mins) in enumerate(zip(reverse_stops, reverse_minutes), start=1):
        db.add(
            LineStop(
                line_id=line.id,
                stop_id=stop.id,
                direction=Direction.BACKWARD,
                sequence=index,
                minutes_from_previous=mins,
            )
        )

    db.flush()


def _ensure_buses(db: Session, line: Line, count: int = BUSES_PER_LINE) -> None:
    existing = db.query(Bus).filter(Bus.line_id == line.id).count()
    for index in range(existing, count):
        db.add(
            Bus(
                plate=f"34 {line.code}{index + 1:02d}",
                line_id=line.id,
                direction=Direction.FORWARD,
                current_stop_id=line.line_stops[0].stop_id if line.line_stops else None,
            )
        )
    db.flush()


def make_admin(db: Session, email: str, password: str) -> Passenger:
    """Yönetici hesabı oluşturur ya da var olanı yönetici yapar.

    Kayıt ucunda (AuthService.register) is_admin her zaman False'tur; ilk
    yöneticiyi üretecek tek yol budur.
    """
    email = email.strip().lower()
    passenger = db.query(Passenger).filter(Passenger.email == email).first()

    if passenger:
        passenger.is_admin = True
        passenger.password_hash = hash_password(password)
        print(f"{email} yönetici yapıldı, parolası güncellendi.")
    else:
        passenger = Passenger(
            full_name="Sistem Yöneticisi",
            email=email,
            password_hash=hash_password(password),
            is_admin=True,
        )
        db.add(passenger)
        db.flush()
        # Kayıt akışıyla aynı: her yolcunun bir mobil kartı olur
        db.add(Card(passenger_id=passenger.id, medium=CardMedium.MOBILE))
        print(f"{email} yönetici olarak oluşturuldu.")

    db.commit()
    return passenger


def run() -> None:
    payload = json.loads(DATA_FILE.read_text(encoding="utf-8"))

    db = SessionLocal()
    try:
        stop_cache: dict[str, Stop] = {}

        for line_data in payload:
            line = _get_or_create_line(db, line_data)

            stops = [_get_or_create_stop(db, stop_cache, s) for s in line_data["stops"]]
            minutes = [s.get("minutes_from_previous") for s in line_data["stops"]]

            _sync_line_stops(db, line, stops, minutes)
            db.refresh(line)
            _ensure_buses(db, line)

        db.commit()
        print(f"{len(payload)} hat, {len(stop_cache)} durak yüklendi.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Hat/durak verisini yükler.")
    parser.add_argument(
        "--admin",
        nargs=2,
        metavar=("EPOSTA", "PAROLA"),
        help="Yönetici hesabı oluşturur ya da var olanı yönetici yapar",
    )
    args = parser.parse_args()

    if args.admin:
        db = SessionLocal()
        try:
            make_admin(db, args.admin[0], args.admin[1])
        finally:
            db.close()
        return

    run()


if __name__ == "__main__":
    main()