import uuid
from datetime import datetime, timedelta, timezone

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
    create_card_token,
    create_refresh_token,
    decode_card_token,
    decode_refresh_token,
    generate_api_key,
    hash_api_key,
    hash_password,
    verify_password,
)
from app.models import Bus, Card, Device, Favorite, Line, Passenger, Stop, Trip
from app.repositories import (
    BusRepository,
    CardRepository,
    DeviceRepository,
    FavoriteRepository,
    LineRepository,
    LineStopRepository,
    PassengerRepository,
    StopRepository,
    TripRepository,
)
from app.schemas import (
    BusOccupancy,
    BusOccupancyDetail,
    HourlyBoarding,
    LineLiveStatus,
    OccupancyPassenger,
    StatsSummary,
    StopBoarding,
    ValidateResponse,
)


def _now() -> datetime:
    return datetime.now(timezone.utc)


class AuthService:
    def __init__(self, db: Session):
        self.db = db
        self.passengers = PassengerRepository(db)

    def register(self, full_name: str, email: str, password: str) -> Passenger:
        if self.passengers.get_by_email(email):
            raise ConflictError("Bu e-posta zaten kayıtlı")

        passenger = Passenger(
            full_name=full_name,
            email=email.lower(),
            password_hash=hash_password(password),
        )
        self.passengers.add(passenger)
        self.db.commit()
        self.db.refresh(passenger)
        return passenger

    def login(self, email: str, password: str) -> tuple[str, str]:
        passenger = self.passengers.get_by_email(email.lower())
        if passenger is None or not verify_password(password, passenger.password_hash):
            raise AuthError("E-posta veya şifre hatalı")

        return (
            create_access_token(passenger.id, passenger.is_admin),
            create_refresh_token(passenger.id),
        )

    def refresh(self, refresh_token: str) -> tuple[str, str]:
        payload = decode_refresh_token(refresh_token)
        passenger = self.passengers.get(uuid.UUID(payload["sub"]))
        if passenger is None:
            raise AuthError("Kullanıcı bulunamadı")

        return (
            create_access_token(passenger.id, passenger.is_admin),
            create_refresh_token(passenger.id),
        )


class PassengerService:
    def __init__(self, db: Session):
        self.db = db
        self.passengers = PassengerRepository(db)

    def get(self, passenger_id: uuid.UUID) -> Passenger:
        return self.passengers.get_or_fail(passenger_id)

    def update(self, passenger: Passenger, full_name: str | None) -> Passenger:
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
        if nfc_uid and self.cards.get_by_nfc_uid(nfc_uid):
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

    def issue_token(self, passenger: Passenger, card_id: uuid.UUID) -> tuple[str, int]:
        card = self.cards.get_or_fail(card_id)
        if card.passenger_id != passenger.id:
            raise ForbiddenError("Bu kart size ait değil")
        if not card.is_active:
            raise ConflictError("Kart pasif durumda")

        return create_card_token(card.id), settings.card_token_expire_seconds

    def set_active(self, card_id: uuid.UUID, is_active: bool) -> Card:
        card = self.cards.get_or_fail(card_id)
        card.is_active = is_active
        self.db.commit()
        self.db.refresh(card)
        return card


class DeviceService:
    def __init__(self, db: Session):
        self.db = db
        self.devices = DeviceRepository(db)
        self.buses = BusRepository(db)

    def create(self, name: str, bus_id: uuid.UUID | None) -> tuple[Device, str]:
        if bus_id:
            self.buses.get_or_fail(bus_id)

        raw_key = generate_api_key()
        device = Device(name=name, bus_id=bus_id, api_key_hash=hash_api_key(raw_key))
        self.devices.add(device)
        self.db.commit()
        self.db.refresh(device)
        return device, raw_key

    def authenticate(self, raw_key: str) -> Device:
        device = self.devices.get_by_api_key_hash(hash_api_key(raw_key))
        if device is None:
            raise AuthError("Geçersiz cihaz anahtarı")
        return device

    def assign_bus(self, device_id: uuid.UUID, bus_id: uuid.UUID) -> Device:
        device = self.devices.get_or_fail(device_id)
        self.buses.get_or_fail(bus_id)
        device.bus_id = bus_id
        self.db.commit()
        self.db.refresh(device)
        return device

    def revoke(self, device_id: uuid.UUID) -> Device:
        device = self.devices.get_or_fail(device_id)
        device.is_active = False
        self.db.commit()
        self.db.refresh(device)
        return device

    def list(self, skip: int = 0, limit: int = 100):
        return self.devices.list(skip, limit)


class TransitService:
    def __init__(self, db: Session):
        self.db = db
        self.lines = LineRepository(db)
        self.stops = StopRepository(db)
        self.line_stops = LineStopRepository(db)
        self.buses = BusRepository(db)
        self.trips = TripRepository(db)

    def list_lines(self, skip: int = 0, limit: int = 100):
        return self.lines.list(skip, limit)

    def get_line(self, line_id: uuid.UUID) -> Line:
        line = self.lines.get_with_stops(line_id)
        if line is None:
            raise NotFoundError("Hat bulunamadı")
        return line

    def search_stops(self, term: str):
        return self.stops.search(term)

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

    def update_location(self, bus_id: uuid.UUID, stop_id: uuid.UUID) -> Bus:
        bus = self.buses.get_or_fail(bus_id)
        entry = self.line_stops.get_entry(bus.line_id, bus.direction, stop_id)
        if entry is None:
            raise ConflictError("Durak bu hattın güzergâhında değil")

        bus.current_stop_id = stop_id
        bus.location_updated_at = _now()
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
        self.stops = StopRepository(db)
        self.line_stops = LineStopRepository(db)
        self.trips = TripRepository(db)

    def _resolve_card(self, card_token: str | None, nfc_uid: str | None) -> Card:
        if card_token:
            payload = decode_card_token(card_token)
            card = self.cards.get(uuid.UUID(payload["sub"]))
        elif nfc_uid:
            card = self.cards.get_by_nfc_uid(nfc_uid)
        else:
            raise ConflictError("Kart jetonu veya NFC kimliği gerekli")

        if card is None:
            raise NotFoundError("Kart tanımlı değil")
        if not card.is_active:
            raise ForbiddenError("Kart pasif durumda")
        return card

    def _resolve_stop(self, bus: Bus, stop_id: uuid.UUID) -> Stop:
        entry = self.line_stops.get_entry(bus.line_id, bus.direction, stop_id)
        if entry is None:
            raise ConflictError("Durak bu hattın güzergâhında değil")
        return entry.stop

    def validate(
        self, device: Device, stop_id: uuid.UUID, card_token: str | None, nfc_uid: str | None
    ) -> ValidateResponse:
        if device.bus_id is None:
            raise ConflictError("Cihaz bir otobüse atanmamış")

        bus = self.buses.get_or_fail(device.bus_id)
        if not bus.is_active:
            raise ConflictError("Otobüs pasif durumda")

        card = self._resolve_card(card_token, nfc_uid)
        stop = self._resolve_stop(bus, stop_id)
        now = _now()

        bus.current_stop_id = stop.id
        bus.location_updated_at = now

        open_trip = self.trips.get_open_by_card(card.id)

        if open_trip is None:
            trip = Trip(
                card_id=card.id,
                bus_id=bus.id,
                line_id=bus.line_id,
                board_stop_id=stop.id,
                boarded_at=now,
                status=TripStatus.OPEN,
                card_type_snapshot=card.card_type,
            )
            self.trips.add(trip)
            action = "boarded"
        elif open_trip.bus_id != bus.id:
            open_trip.status = TripStatus.ABANDONED
            open_trip.alighted_at = now
            trip = Trip(
                card_id=card.id,
                bus_id=bus.id,
                line_id=bus.line_id,
                board_stop_id=stop.id,
                boarded_at=now,
                status=TripStatus.OPEN,
                card_type_snapshot=card.card_type,
            )
            self.trips.add(trip)
            action = "boarded"
        elif open_trip.board_stop_id == stop.id:
            raise ConflictError("İniş, biniş durağında yapılamaz")
        else:
            open_trip.alight_stop_id = stop.id
            open_trip.alighted_at = now
            open_trip.status = TripStatus.COMPLETED
            trip = open_trip
            action = "alighted"

        self.db.commit()
        self.db.refresh(trip)

        passenger_name = card.passenger.full_name if card.passenger else None

        return ValidateResponse(
            action=action,
            trip_id=trip.id,
            passenger_name=passenger_name,
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
        cards = self.cards.list_by_passenger(passenger.id)
        result: list[Trip] = []
        for card in cards:
            result.extend(self.trips.list_by_card(card.id, skip, limit))
        return sorted(result, key=lambda t: t.boarded_at, reverse=True)[:limit]

    def active(self, passenger: Passenger) -> Trip | None:
        for card in self.cards.list_by_passenger(passenger.id):
            trip = self.trips.get_open_by_card(card.id)
            if trip:
                return trip
        return None

    def close_stale(self) -> int:
        cutoff = _now() - timedelta(minutes=settings.trip_auto_close_minutes)
        stale = self.trips.list_stale_open(cutoff)
        for trip in stale:
            trip.status = TripStatus.ABANDONED
            trip.alighted_at = _now()
        self.db.commit()
        return len(stale)

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

    def occupancy(self) -> list[BusOccupancy]:
        counts = self.trips.count_open_by_bus()
        result = []
        for bus in self.buses.list_active():
            result.append(
                BusOccupancy(
                    bus_id=bus.id,
                    plate=bus.plate,
                    line_code=bus.line.code,
                    current_stop_name=bus.current_stop.name if bus.current_stop else None,
                    passenger_count=counts.get(bus.id, 0),
                )
            )
        return result

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
            current_stop_name=bus.current_stop.name if bus.current_stop else None,
            passenger_count=len(passengers),
            passengers=passengers,
        )

    def summary(self) -> StatsSummary:
        counts = self.trips.count_by_status()
        return StatsSummary(
            total_trips=sum(counts.values()),
            open_trips=counts.get(TripStatus.OPEN.value, 0),
            abandoned_trips=counts.get(TripStatus.ABANDONED.value, 0),
            active_buses=len(self.buses.list_active()),
            hourly=[HourlyBoarding(hour=h, count=c) for h, c in self.trips.hourly_boardings()],
            top_stops=[
                StopBoarding(stop_id=sid, stop_name=name, count=count)
                for sid, name, count in self.trips.top_board_stops()
            ],
        )
