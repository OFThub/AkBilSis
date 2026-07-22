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
    AnalyticsOverview,
    BusLive,
    BusOccupancy,
    BusOccupancyDetail,
    CardTypeShare,
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
    bus_position,
    load_level,
    peak_hours,
    stop_schedule,
    terminus_moment,
)

#: Kart tipinin arayüzde görünen adı — web ve mobil aynı etiketi kullanır
CARD_TYPE_LABELS = {
    CardType.NORMAL: "Tam",
    CardType.STUDENT: "Öğrenci",
    CardType.SENIOR: "65+",
}


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

        card = Card(passenger_id=passenger.id, medium=CardMedium.MOBILE)
        self.db.add(card)

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

    def set_type(self, card_id: uuid.UUID, card_type: CardType) -> Card:
        """Tam/öğrenci statüsü. Süregelen yolculuklar etkilenmez: tip yolculuk
        açılırken `card_type_snapshot` olarak damgalanır."""
        card = self.cards.get_or_fail(card_id)
        card.card_type = card_type
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
        lines = self.lines.list(skip, limit)
        for line in lines:
            self._attach_peaks(line)
        return lines

    def get_line(self, line_id: uuid.UUID) -> Line:
        line = self.lines.get_with_stops(line_id)
        if line is None:
            raise NotFoundError("Hat bulunamadı")
        self._attach_peaks(line)
        return line

    @staticmethod
    def _attach_peaks(line: Line) -> None:
        """Tepe saatleri şemaya taşınabilsin diye ORM nesnesine iliştirir.

        Kalıcı bir alan değil: profil değiştiğinde tepe saat de değişsin diye
        her okumada yeniden hesaplanır.
        """
        line.peak_hours = peak_hours(line.hourly_profile or [])

    def search_stops(self, term: str):
        return self.stops.search(term)

    def _schedule(self, line_id: uuid.UUID, direction: Direction) -> tuple[list, list[int]]:
        """Hattın sıralı durakları ve varış tarifesi."""
        entries = list(self.line_stops.list_ordered(line_id, direction))
        gaps = [e.minutes_from_previous or 0 for e in entries[1:]]
        return entries, stop_schedule(gaps)

    def live_buses(self, line_id: uuid.UUID) -> list[BusLive]:
        """Hattın canlı araç konumları — tek doğruluk kaynağı simulation.py.

        Araç sırası plakaya göre sabittir; `ValidationService._locate` aynı
        sıralamayı kullanır, böylece "listede gördüğüm araç" ile "kart bastığım
        araç" aynı konumda olur.
        """
        self.lines.get_or_fail(line_id)
        buses = sorted(self.buses.list_by_line(line_id), key=lambda b: b.plate)
        if not buses:
            return []

        occupancy = self.trips.count_open_by_bus()
        now = _now()
        # Tarife yöne göre değişir; her yön için bir kez okunup paylaşılır
        schedules: dict[Direction, tuple[list, list[int]]] = {}

        result: list[BusLive] = []
        for index, bus in enumerate(buses):
            if bus.direction not in schedules:
                schedules[bus.direction] = self._schedule(line_id, bus.direction)
            entries, arrival = schedules[bus.direction]
            if not entries:
                continue

            pos = bus_position(index, arrival, now)
            result.append(
                BusLive(
                    id=bus.id,
                    plate=bus.plate,
                    line_id=bus.line_id,
                    at_stop=pos.at_stop,
                    layover=pos.layover,
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
        self.line_stops = LineStopRepository(db)
        self.trips = TripRepository(db)

    def _resolve_card(self, passenger: Passenger) -> Card:
        active = [c for c in self.cards.list_by_passenger(passenger.id) if c.is_active]
        if not active:
            raise ForbiddenError("Hesabınıza bağlı aktif kart yok")
        return active[0]

    def _locate(self, bus: Bus, now: datetime) -> tuple[Stop, Stop, float]:
        """Aracın o an durduğu durak, son durak ve son durağa kalan sim-dakika.

        Durak istemciden gelmez: "yalnızca durakta binilir/inilir" kuralı
        burada, sunucuda zorlanır — istemci konumu taklit edemez.
        """
        entries = list(self.line_stops.list_ordered(bus.line_id, bus.direction))
        if not entries:
            raise ConflictError("Hattın güzergâhı tanımlı değil")

        gaps = [e.minutes_from_previous or 0 for e in entries[1:]]
        buses = sorted(self.buses.list_by_line(bus.line_id), key=lambda b: b.plate)
        index = next((i for i, b in enumerate(buses) if b.id == bus.id), 0)

        pos = bus_position(index, stop_schedule(gaps), now)

        if pos.layover:
            raise ConflictError("Bu araç son durakta sefer bekliyor — yoldaki bir araç seçin")
        if not pos.at_stop:
            raise ConflictError(
                f"Otobüs duraklar arasında. {entries[pos.to_index].stop.name} "
                "durağına varınca işlem yapabilirsiniz"
            )

        return entries[pos.from_index].stop, entries[-1].stop, pos.minutes_to_terminus

    def _open_trip(
        self, card: Card, bus: Bus, stop: Stop, terminus: Stop, minutes_left: float, now: datetime
    ) -> Trip:
        trip = Trip(
            card_id=card.id,
            bus_id=bus.id,
            line_id=bus.line_id,
            board_stop_id=stop.id,
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
        bus = self.buses.get_or_fail(bus_id)
        if not bus.is_active:
            raise ConflictError("Otobüs pasif durumda")

        card = self._resolve_card(passenger)
        now = _now()
        stop, terminus, minutes_left = self._locate(bus, now)

        bus.current_stop_id = stop.id
        bus.location_updated_at = now

        open_trip = self.trips.get_open_by_card(card.id)

        if open_trip is None:
            trip = self._open_trip(card, bus, stop, terminus, minutes_left, now)
            action = "boarded"
        elif open_trip.bus_id != bus.id:
            # Başka araca binildi: önceki yolculuk kapanmadan bırakıldı sayılır
            open_trip.status = TripStatus.ABANDONED
            open_trip.alighted_at = now
            trip = self._open_trip(card, bus, stop, terminus, minutes_left, now)
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
        # Arkaplan görevi gecikse bile yolcu tutarlı bir liste görsün
        self.close_due()
        cards = self.cards.list_by_passenger(passenger.id)
        result: list[Trip] = []
        for card in cards:
            result.extend(self.trips.list_by_card(card.id, skip, limit))
        return sorted(result, key=lambda t: t.boarded_at, reverse=True)[:limit]

    def active(self, passenger: Passenger) -> Trip | None:
        # Vakti gelmiş yolculuk "hâlâ araçtasınız" diye görünmesin
        self.close_due()
        for card in self.cards.list_by_passenger(passenger.id):
            trip = self.trips.get_open_by_card(card.id)
            if trip:
                return trip
        return None

    def close_due(self) -> int:
        """Son durakta otomatik iniş.

        Yolcu inmeyi unutursa aracın son durağa vardığı anda yolculuk kapanır
        ve geçmişe normal, tamamlanmış bir kayıt olarak yazılır. Aracın anlık
        konumuna bakılmaz — binişte saklanan damgaya bakılır, çünkü konum duvar
        saatinden döngüsel türetilir ve geçmiş bir turu ıskalayabilir.
        """
        due = self.trips.list_due(_now())
        for trip in due:
            trip.alight_stop_id = trip.auto_alight_stop_id
            trip.alighted_at = trip.auto_alight_at
            trip.status = TripStatus.COMPLETED
        if due:
            self.db.commit()
        return len(due)

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
        self.lines = LineRepository(db)

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

    # ── Yönetim analitiği ────────────────────────────────────────────────────

    def overview(self) -> AnalyticsOverview:
        counts = self.trips.count_by_status()
        hourly = self.trips.hourly_boardings()
        busiest = max(hourly, key=lambda row: row[1])[0] if hourly else None
        open_trips = counts.get(TripStatus.OPEN.value, 0)

        return AnalyticsOverview(
            total_trips=sum(counts.values()),
            open_trips=open_trips,
            completed_trips=counts.get(TripStatus.COMPLETED.value, 0),
            abandoned_trips=counts.get(TripStatus.ABANDONED.value, 0),
            active_buses=len(self.buses.list_active()),
            onboard_passengers=open_trips,
            busiest_hour=busiest,
            # Grafikte boş saatler de görünsün diye 24 saat tam doldurulur
            hourly=[
                HourlyBoarding(hour=h, count=dict(hourly).get(h, 0)) for h in range(24)
            ],
        )

    def line_analytics(self) -> list[LineAnalytics]:
        """Hat başına yoğunluk + sefer önerisi.

        Karar ölçütü: **zirve saatte araç başına düşen yolcu**. Toplam yolculuk
        tek başına yanıltıcıdır — üç araçla taşınan 90 yolcu rahat, tek araçla
        taşınan 40 yolcu sıkışıktır.
        """
        by_line_hour = self.trips.hourly_by_line()
        totals = self.trips.count_by_line()

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
            peak_hour, peak_trips = peaks.get(line.id, (None, 0))
            active = bus_counts.get(line.id, 0)
            per_bus = peak_trips / active if active else float(peak_trips)
            level = load_level(per_bus / capacity, 0.40, 0.75)

            result.append(
                LineAnalytics(
                    line_id=line.id,
                    code=line.code,
                    name=line.name,
                    total_trips=totals.get(line.id, 0),
                    peak_hour=peak_hour,
                    peak_hour_trips=peak_trips,
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

    def stop_analytics(self) -> list[StopAnalytics]:
        """Durak yoğunluğu — en yoğun durağa göre oranlanıp renklendirilir."""
        rows = self.trips.stop_usage()
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

    def stop_pairs(self) -> list[StopPair]:
        return [
            StopPair(board_stop=a, alight_stop=b, count=count)
            for a, b, count in self.trips.top_pairs()
        ]

    def card_type_shares(self) -> list[CardTypeShare]:
        counts = self.trips.count_by_card_type()
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
