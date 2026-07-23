import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import settings
from app.core import (
    AuthError,
    CardMedium,
    CardType,
    ConflictError,
    Direction,
    ForbiddenError,
    NotFoundError,
    TripStatus,
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    hash_password,
    verify_password,
)
from app.models import Bus, Card, Favorite, Line, Passenger, Stop, Trip
from app.repositories import (
    BusRepository,
    CardRepository,
    FavoriteRepository,
    LineRepository,
    LineStopRepository,
    PassengerRepository,
    StopRepository,
    TripRepository,
)
from app.schemas import (
    AnalyticsOverview,
    BusLive,
    BusOccupancy,
    BusOccupancyDetail,
    CardTypeShare,
    DailyBoarding,
    DailyTrend,
    HourlyBoarding,
    LineAnalytics,
    LineLiveStatus,
    OccupancyPassenger,
    RecentTrip,
    StatsSummary,
    StopAnalytics,
    StopBoarding,
    StopPair,
    ValidateResponse,
)
from app.simulation import (
    round_trip_position,
    load_level,
    peak_hours,
    stop_schedule,
    terminus_moment,
)

CARD_TYPE_LABELS = {
    CardType.NORMAL: "Tam",
    CardType.STUDENT: "Öğrenci",
    CardType.SENIOR: "65+",
}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _phase_group(buses, direction: Direction) -> list[Bus]:

    return sorted((b for b in buses if b.direction == direction), key=lambda b: b.plate)


class AuthService:
    def __init__(self, db: Session):
        self.db = db
        self.passengers = PassengerRepository(db)

    def register(
        self,
        full_name: str,
        email: str,
        password: str,
        card_type: CardType = CardType.NORMAL,
    ) -> Passenger:
        email = email.strip().lower()

        if self.passengers.email_taken(email):
            raise ConflictError("Bu e-posta zaten kayıtlı")

        passenger = Passenger(
            full_name=full_name,
            email=email,
            password_hash=hash_password(password),
        )
        self.passengers.add(passenger)


        card = Card(
            passenger_id=passenger.id,
            medium=CardMedium.MOBILE,
            card_type=card_type,
        )
        self.db.add(card)

        self.db.commit()
        self.db.refresh(passenger)
        return passenger

    def login(self, email: str, password: str) -> tuple[str, str]:
        passenger = self.passengers.get_by_email(email.strip().lower())
        if passenger is None or not verify_password(password, passenger.password_hash):
            raise AuthError("E-posta veya şifre hatalı")

        return (
            create_access_token(passenger.id, passenger.is_admin, passenger.token_version),
            create_refresh_token(passenger.id, passenger.token_version),
        )

    def refresh(self, refresh_token: str) -> tuple[str, str]:
        payload = decode_refresh_token(refresh_token)
        passenger = self.passengers.get(uuid.UUID(payload["sub"]))
        if passenger is None:
            raise AuthError("Kullanıcı bulunamadı")

        if payload.get("ver") != passenger.token_version:
            raise AuthError("Oturum geçersiz kılınmış")

        passenger.token_version += 1
        self.db.commit()

        return (
            create_access_token(passenger.id, passenger.is_admin, passenger.token_version),
            create_refresh_token(passenger.id, passenger.token_version),
        )


class PassengerService:
    def __init__(self, db: Session):
        self.db = db
        self.passengers = PassengerRepository(db)

    def get(self, passenger_id: uuid.UUID) -> Passenger:
        return self.passengers.get_or_fail(passenger_id)

    def update(self, passenger: Passenger, full_name: str | None) -> Passenger:
        if full_name is not None:
            self.passengers.update(passenger, full_name=full_name)
            self.db.commit()
            self.db.refresh(passenger)
        return passenger

    def search(self, term: str | None, skip: int, limit: int):
        if term:
            return self.passengers.search(term, skip, limit)
        return self.passengers.list(skip, limit)


class CardService:
    def __init__(self, db: Session):
        self.db = db
        self.cards = CardRepository(db)
        self.passengers = PassengerRepository(db)

    def create(
        self,
        card_type: CardType,
        medium: CardMedium,
        nfc_uid: str | None,
        passenger_id: uuid.UUID | None,
    ) -> Card:
        if nfc_uid and self.cards.nfc_uid_taken(nfc_uid):
            raise ConflictError("Bu NFC kimliği başka bir karta ait")

        if passenger_id:
            self.passengers.get_or_fail(passenger_id)

        card = Card(
            card_type=card_type,
            medium=medium,
            nfc_uid=nfc_uid,
            passenger_id=passenger_id,
        )
        self.cards.add(card)
        self.db.commit()
        self.db.refresh(card)
        return card

    def list_for_passenger(self, passenger_id: uuid.UUID):
        return self.cards.list_by_passenger(passenger_id)

    def link(self, passenger: Passenger, nfc_uid: str) -> Card:
        card = self.cards.get_by_nfc_uid(nfc_uid)
        if card is None:
            raise NotFoundError("Kart bulunamadı")
        if card.passenger_id and card.passenger_id != passenger.id:
            raise ConflictError("Kart başka bir hesaba bağlı")

        card.passenger_id = passenger.id
        self.db.commit()
        self.db.refresh(card)
        return card

    def set_active(self, card_id: uuid.UUID, is_active: bool) -> Card:
        card = self.cards.get_or_fail(card_id)
        card.is_active = is_active
        self.db.commit()
        self.db.refresh(card)
        return card

    def set_type(self, card_id: uuid.UUID, card_type: CardType) -> Card:
        card = self.cards.get_or_fail(card_id)
        card.card_type = card_type
        self.db.commit()
        self.db.refresh(card)
        return card


class TransitService:
    def __init__(self, db: Session):
        self.db = db
        self.lines = LineRepository(db)
        self.stops = StopRepository(db)
        self.line_stops = LineStopRepository(db)
        self.buses = BusRepository(db)
        self.trips = TripRepository(db)

    def list_lines(self, skip: int = 0, limit: int = 100):
        lines = self.lines.list(skip, limit)
        for line in lines:
            self._attach_peaks(line)
        return lines

    def get_line(self, line_id: uuid.UUID, direction: Direction = Direction.FORWARD) -> Line:
        line = self.lines.get_with_stops(line_id, direction)
        if line is None:
            raise NotFoundError("Hat bulunamadı")
        self._attach_peaks(line)
        return line

    @staticmethod
    def _attach_peaks(line: Line) -> None:

        line.peak_hours = peak_hours(line.hourly_profile or [])

    def search_stops(self, term: str):
        return self.stops.search(term)

    def _schedule(self, line_id: uuid.UUID, direction: Direction) -> tuple[list, list[int]]:
        entries = list(self.line_stops.list_ordered(line_id, direction))
        gaps = [e.minutes_from_previous or 0 for e in entries[1:]]
        return entries, stop_schedule(gaps)

    def _round_trip(self, line_id: uuid.UUID) -> tuple[dict, dict]:
        entries_by_direction = {}
        schedules = {}
        for direction in Direction:
            entries, arrival = self._schedule(line_id, direction)
            entries_by_direction[direction] = entries
            schedules[direction] = arrival
        return entries_by_direction, schedules

    def live_buses(self, line_id: uuid.UUID) -> list[BusLive]:
        self.lines.get_or_fail(line_id)
        all_buses = self.buses.list_by_line(line_id, only_active=False)
        if not all_buses:
            return []

        occupancy = self.trips.count_open_by_bus()
        now = _now()
        entries_by_direction, schedules = self._round_trip(line_id)
        result: list[BusLive] = []

        for start in Direction:
            group = _phase_group(all_buses, start)
            if not group:
                continue

            for index, bus in enumerate(group):
                if not bus.is_active:
                    continue
                pos = round_trip_position(index, len(group), schedules, now, start)
                entries = entries_by_direction[pos.direction]
                if not entries:
                    continue
                result.append(
                    BusLive(
                        id=bus.id,
                        plate=bus.plate,
                        line_id=bus.line_id,
                        at_stop=pos.at_stop,
                        layover=pos.layover,
                        direction=pos.direction,
                        current_stop=entries[pos.from_index].stop,
                        next_stop=entries[pos.to_index].stop,
                        minutes_to_next=pos.minutes_to_next,
                        passenger_count=occupancy.get(bus.id, 0),
                    )
                )
        return result

    def list_buses(self, line_id: uuid.UUID):
        return self.buses.list_by_line(line_id)

    def create_bus(self, plate: str, line_id: uuid.UUID, direction: Direction) -> Bus:
        if self.buses.get_by_plate(plate):
            raise ConflictError("Bu plaka zaten kayıtlı")
        self.lines.get_or_fail(line_id)

        bus = Bus(plate=plate.upper(), line_id=line_id, direction=direction)
        self.buses.add(bus)
        self.db.commit()
        self.db.refresh(bus)
        return bus

    def line_live_status(self, line_id: uuid.UUID) -> LineLiveStatus:
        line = self.lines.get_or_fail(line_id)
        buses = self.buses.list_by_line(line_id)
        return LineLiveStatus(
            line_id=line.id,
            line_code=line.code,
            active_bus_count=len(buses),
            total_passengers=self.trips.count_open_by_line(line_id),
        )


class FavoriteService:
    def __init__(self, db: Session):
        self.db = db
        self.favorites = FavoriteRepository(db)
        self.lines = LineRepository(db)

    def add(self, passenger_id: uuid.UUID, line_id: uuid.UUID) -> Favorite:
        self.lines.get_or_fail(line_id)
        if self.favorites.get_entry(passenger_id, line_id):
            raise ConflictError("Hat zaten favorilerde")

        favorite = Favorite(passenger_id=passenger_id, line_id=line_id)
        self.favorites.add(favorite)
        self.db.commit()
        self.db.refresh(favorite)
        return favorite

    def remove(self, passenger_id: uuid.UUID, line_id: uuid.UUID) -> None:
        favorite = self.favorites.get_entry(passenger_id, line_id)
        if favorite is None:
            raise NotFoundError("Favori bulunamadı")
        self.favorites.hard_delete(favorite)
        self.db.commit()

    def list(self, passenger_id: uuid.UUID):
        return self.favorites.list_by_passenger(passenger_id)


class ValidationService:
    def __init__(self, db: Session):
        self.db = db
        self.cards = CardRepository(db)
        self.buses = BusRepository(db)
        self.line_stops = LineStopRepository(db)
        self.trips = TripRepository(db)

    def _resolve_card(self, passenger: Passenger) -> Card:
        active = [c for c in self.cards.list_by_passenger(passenger.id) if c.is_active]
        if not active:
            raise ForbiddenError("Hesabınıza bağlı aktif kart yok")
        return active[0]

    def _locate(self, bus: Bus, now: datetime) -> tuple[Stop, Stop, float, int]:
        entries_by_direction = {}
        schedules = {}
        for direction in Direction:
            legs = list(self.line_stops.list_ordered(bus.line_id, direction))
            entries_by_direction[direction] = legs
            gaps = [e.minutes_from_previous or 0 for e in legs[1:]]
            schedules[direction] = stop_schedule(gaps)

        if not entries_by_direction[bus.direction]:
            raise ConflictError("Hattın güzergâhı tanımlı değil")

        group = _phase_group(
            self.buses.list_by_line(bus.line_id, only_active=False), bus.direction
        )
        index = next((i for i, b in enumerate(group) if b.id == bus.id), 0)

        pos = round_trip_position(index, len(group), schedules, now, bus.direction)
        entries = entries_by_direction[pos.direction]

        if pos.layover:
            raise ConflictError("Bu araç son durakta sefer bekliyor — yoldaki bir araç seçin")
        if not pos.at_stop:
            raise ConflictError(
                f"Otobüs duraklar arasında. {entries[pos.to_index].stop.name} "
                "durağına varınca işlem yapabilirsiniz"
            )

        return (
            entries[pos.from_index].stop,
            entries[-1].stop,
            pos.minutes_to_terminus,
            pos.from_index,
        )

    def _open_trip(
        self,
        card: Card,
        bus: Bus,
        stop: Stop,
        terminus: Stop,
        minutes_left: float,
        sequence: int,
        now: datetime,
    ) -> Trip:
        trip = Trip(
            card_id=card.id,
            bus_id=bus.id,
            line_id=bus.line_id,
            board_stop_id=stop.id,
            board_sequence=sequence,
            boarded_at=now,
            status=TripStatus.OPEN,
            card_type_snapshot=card.card_type,
            # Yolcu inmezse son durakta otomatik indirilir; an burada damgalanır
            auto_alight_at=terminus_moment(now, minutes_left),
            auto_alight_stop_id=terminus.id,
        )
        self.trips.add(trip)
        return trip

    def validate(self, passenger: Passenger, bus_id: uuid.UUID) -> ValidateResponse:
        TripService(self.db).close_due()

        bus = self.buses.get_or_fail(bus_id)
        if not bus.is_active:
            raise ConflictError("Otobüs pasif durumda")

        card = self._resolve_card(passenger)
        now = _now()
        stop, terminus, minutes_left, sequence = self._locate(bus, now)

        try:
            open_trip = self.trips.get_open_by_card(card.id)

            if open_trip is None:
                trip = self._open_trip(
                    card, bus, stop, terminus, minutes_left, sequence, now
                )
                action = "boarded"
            elif open_trip.bus_id != bus.id:
                open_trip.status = TripStatus.ABANDONED
                open_trip.alighted_at = now
                trip = self._open_trip(
                    card, bus, stop, terminus, minutes_left, sequence, now
                )
                action = "boarded"
            elif open_trip.board_sequence == sequence:
                raise ConflictError("Henüz durak değişmedi — sonraki durakta inebilirsiniz")
            else:
                open_trip.alight_stop_id = stop.id
                open_trip.alighted_at = now
                open_trip.status = TripStatus.COMPLETED
                trip = open_trip
                action = "alighted"

            self.db.commit()
        except IntegrityError:
            self.db.rollback()
            raise ConflictError("Bu kart için işlem zaten sürüyor, tekrar deneyin")

        self.db.refresh(trip)

        return ValidateResponse(
            action=action,
            trip_id=trip.id,
            passenger_name=passenger.full_name,
            line_code=bus.line.code,
            stop_name=stop.name,
            occurred_at=now,
        )


class TripService:
    def __init__(self, db: Session):
        self.db = db
        self.trips = TripRepository(db)
        self.cards = CardRepository(db)

    def history(self, passenger: Passenger, skip: int = 0, limit: int = 50):
        self.close_due()
        card_ids = [c.id for c in self.cards.list_by_passenger(passenger.id)]
        return self.trips.list_by_cards(card_ids, skip, limit)

    def active(self, passenger: Passenger) -> Trip | None:
        self.close_due()
        for card in self.cards.list_by_passenger(passenger.id):
            trip = self.trips.get_open_by_card(card.id)
            if trip:
                return trip
        return None

    def close_due(self) -> int:
        due = self.trips.list_due(_now())
        for trip in due:
            trip.alight_stop_id = trip.auto_alight_stop_id
            trip.alighted_at = trip.auto_alight_at
            trip.status = TripStatus.COMPLETED
        if due:
            self.db.commit()
        return len(due)

    def close_manually(self, trip_id: uuid.UUID, stop_id: uuid.UUID | None) -> Trip:
        trip = self.trips.get_or_fail(trip_id)
        if trip.status != TripStatus.OPEN:
            raise ConflictError("Seyahat zaten kapalı")

        trip.alight_stop_id = stop_id
        trip.alighted_at = _now()
        trip.status = TripStatus.COMPLETED if stop_id else TripStatus.ABANDONED
        self.db.commit()
        self.db.refresh(trip)
        return trip


class StatsService:
    def __init__(self, db: Session):
        self.db = db
        self.trips = TripRepository(db)
        self.buses = BusRepository(db)
        self.lines = LineRepository(db)

    def occupancy(self) -> list[BusOccupancy]:
        counts = self.trips.count_open_by_bus()
        return [
            BusOccupancy(
                bus_id=bus.id,
                plate=bus.plate,
                line_code=bus.line.code,
                passenger_count=counts.get(bus.id, 0),
            )
            for bus in self.buses.list_active()
        ]

    def occupancy_detail(self, bus_id: uuid.UUID) -> BusOccupancyDetail:
        bus = self.buses.get_or_fail(bus_id)
        trips = self.trips.list_open_by_bus(bus_id)

        passengers = [
            OccupancyPassenger(
                trip_id=trip.id,
                passenger_id=trip.card.passenger_id,
                passenger_name=trip.card.passenger.full_name if trip.card.passenger else None,
                card_type=trip.card_type_snapshot,
                board_stop_name=trip.board_stop.name,
                boarded_at=trip.boarded_at,
            )
            for trip in trips
        ]

        return BusOccupancyDetail(
            bus_id=bus.id,
            plate=bus.plate,
            line_code=bus.line.code,
            passenger_count=len(passengers),
            passengers=passengers,
        )

    @staticmethod
    def _since(days: int) -> datetime:
        return _now() - timedelta(days=days)

    def summary(self, days: int = 7) -> StatsSummary:
        since = self._since(days)
        counts = self.trips.count_by_status(since=since)
        return StatsSummary(
            total_trips=sum(counts.values()),
            open_trips=self.trips.count_by_status().get(TripStatus.OPEN.value, 0),
            abandoned_trips=counts.get(TripStatus.ABANDONED.value, 0),
            active_buses=len(self.buses.list_active()),
            hourly=[
                HourlyBoarding(hour=h, count=c)
                for h, c in self.trips.hourly_boardings(since=since)
            ],
            top_stops=[
                StopBoarding(stop_id=sid, stop_name=name, count=count)
                for sid, name, count in self.trips.top_board_stops(since=since)
            ],
        )



    def overview(self, days: int = 7) -> AnalyticsOverview:
        since = self._since(days)
        windowed = self.trips.count_by_status(since=since)
        # "Şu an araçta" penceresizdir: geçmiş aralıkla sınırlanamaz
        open_now = self.trips.count_by_status().get(TripStatus.OPEN.value, 0)
        hourly = self.trips.hourly_boardings(since=since)
        by_hour = dict(hourly)
        busiest = max(hourly, key=lambda row: row[1])[0] if hourly else None

        return AnalyticsOverview(
            total_trips=sum(windowed.values()),
            open_trips=open_now,
            completed_trips=windowed.get(TripStatus.COMPLETED.value, 0),
            abandoned_trips=windowed.get(TripStatus.ABANDONED.value, 0),
            active_buses=len(self.buses.list_active()),
            onboard_passengers=open_now,
            busiest_hour=busiest,
            # Grafikte boş saatler de görünsün diye 24 saat tam doldurulur
            hourly=[HourlyBoarding(hour=h, count=by_hour.get(h, 0)) for h in range(24)],
        )

    def line_analytics(self, days: int = 7) -> list[LineAnalytics]:
        since = self._since(days)
        by_line_hour = self.trips.hourly_by_line(since=since)
        totals = self.trips.count_by_line(since=since)

        peaks: dict[uuid.UUID, tuple[int, int]] = {}
        for line_id, hour, count in by_line_hour:
            if line_id not in peaks or count > peaks[line_id][1]:
                peaks[line_id] = (hour, count)

        bus_counts: dict[uuid.UUID, int] = {}
        for bus in self.buses.list_active():
            bus_counts[bus.line_id] = bus_counts.get(bus.line_id, 0) + 1

        capacity = max(1, settings.bus_capacity)
        result: list[LineAnalytics] = []

        for line in self.lines.list(limit=200):
            peak_hour, peak_total = peaks.get(line.id, (None, 0))
            daily_peak = peak_total / max(1, days)
            active = bus_counts.get(line.id, 0)
            per_bus = daily_peak / active if active else daily_peak
            level = load_level(per_bus / capacity, 0.40, 0.75)

            result.append(
                LineAnalytics(
                    line_id=line.id,
                    code=line.code,
                    name=line.name,
                    total_trips=totals.get(line.id, 0),
                    peak_hour=peak_hour,
                    peak_hour_trips=round(daily_peak),
                    active_buses=active,
                    peak_per_bus=round(per_bus, 1),
                    load_level=level,
                    recommendation={
                        "high": "Zirve saatte araçlar doluyor — sefer artırılmalı",
                        "low": "Araçlar boş gidiyor — sefer azaltılabilir",
                        "normal": "Sefer sayısı yeterli",
                    }[level],
                )
            )

        result.sort(key=lambda item: item.peak_per_bus, reverse=True)
        return result

    def stop_analytics(self, days: int = 7) -> list[StopAnalytics]:
        rows = self.trips.stop_usage(since=self._since(days))
        if not rows:
            return []

        busiest = max(board + alight for _, _, board, alight in rows) or 1

        return [
            StopAnalytics(
                stop_id=stop_id,
                name=name,
                boardings=board,
                alightings=alight,
                total=board + alight,
                load_level=load_level((board + alight) / busiest, 0.35, 0.70),
            )
            for stop_id, name, board, alight in rows
        ]

    def stop_pairs(self, days: int = 7) -> list[StopPair]:
        return [
            StopPair(board_stop=a, alight_stop=b, count=count)
            for a, b, count in self.trips.top_pairs(since=self._since(days))
        ]

    def daily_trend(self, days: int = 7) -> DailyTrend:
        """Gun gun binis sayisi ve donem basi/sonu arasindaki degisim.

        Saatlik dagilimdan farkli bir soruya cevap verir: talep artiyor mu,
        azaliyor mu.
        """
        rows = self.trips.daily_boardings(since=self._since(days))
        counts = [c for _, c in rows]
        total = sum(counts)

        change = None
        if len(rows) >= 2:
            half = len(counts) // 2
            first, second = counts[:half], counts[half:]
            if first and sum(first):
                avg_first = sum(first) / len(first)
                avg_second = sum(second) / len(second)
                change = round((avg_second - avg_first) / avg_first * 100, 1)

        return DailyTrend(
            days=[DailyBoarding(day=d, count=c) for d, c in rows],
            total=total,
            daily_average=round(total / len(rows), 1) if rows else 0.0,
            busiest_day=max(rows, key=lambda r: r[1])[0] if rows else None,
            change_percent=change,
        )

    def card_type_shares(self, days: int = 7) -> list[CardTypeShare]:
        counts = self.trips.count_by_card_type(since=self._since(days))
        return [
            CardTypeShare(
                card_type=card_type,
                label=CARD_TYPE_LABELS[card_type],
                count=counts.get(card_type.value, 0),
            )
            for card_type in CardType
        ]

    def recent_trips(self, limit: int = 20) -> list[RecentTrip]:
        result: list[RecentTrip] = []
        for trip in self.trips.recent(limit):
            duration = None
            if trip.alighted_at:
                duration = max(
                    1, round((trip.alighted_at - trip.boarded_at).total_seconds() / 60)
                )

            result.append(
                RecentTrip(
                    id=trip.id,
                    passenger_name=trip.card.passenger.full_name if trip.card.passenger else None,
                    card_type=trip.card_type_snapshot,
                    line_code=trip.line.code,
                    line_name=trip.line.name,
                    bus_plate=trip.bus.plate,
                    board_stop=trip.board_stop.name,
                    alight_stop=trip.alight_stop.name if trip.alight_stop else None,
                    boarded_at=trip.boarded_at,
                    alighted_at=trip.alighted_at,
                    duration_min=duration,
                    status=trip.status,
                )
            )
        return result
