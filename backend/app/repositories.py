import uuid
from datetime import datetime
from typing import Generic, Sequence, TypeVar

from sqlalchemy import Integer, cast, func, literal, select, union_all
from sqlalchemy.orm import Session, aliased, selectinload

from app.config import settings
from app.core import Direction, NotFoundError, TripStatus
from app.models import (
    Bus,
    Card,
    Favorite,
    Line,
    LineStop,
    Passenger,
    Stop,
    Trip,
)

T = TypeVar("T")


class BaseRepository(Generic[T]):
    model: type[T]

    def __init__(self, db: Session):
        self.db = db

    def _base_query(self):
        stmt = select(self.model)
        if hasattr(self.model, "is_deleted"):
            stmt = stmt.where(self.model.is_deleted.is_(False))
        return stmt

    def get(self, item_id: uuid.UUID) -> T | None:
        stmt = self._base_query().where(self.model.id == item_id)
        return self.db.scalars(stmt).first()

    def get_or_fail(self, item_id: uuid.UUID) -> T:
        item = self.get(item_id)
        if item is None:
            raise NotFoundError(f"{self.model.__name__} bulunamadı")
        return item

    def list(self, skip: int = 0, limit: int = 100) -> Sequence[T]:
        stmt = self._base_query().offset(skip).limit(limit)
        return self.db.scalars(stmt).all()

    def add(self, obj: T) -> T:
        self.db.add(obj)
        self.db.flush()
        return obj

    def update(self, obj: T, **fields) -> T:
        for key, value in fields.items():
            setattr(obj, key, value)
        self.db.flush()
        return obj

    def soft_delete(self, obj: T) -> None:
        obj.is_deleted = True
        self.db.flush()

    def hard_delete(self, obj: T) -> None:
        self.db.delete(obj)
        self.db.flush()


class PassengerRepository(BaseRepository[Passenger]):
    model = Passenger

    def email_taken(self, email: str) -> bool:
        stmt = select(Passenger.id).where(Passenger.email == email)
        return self.db.scalars(stmt).first() is not None

    def get_by_email(self, email: str) -> Passenger | None:
        stmt = self._base_query().where(Passenger.email == email)
        return self.db.scalars(stmt).first()

    def search(self, term: str, skip: int = 0, limit: int = 50) -> Sequence[Passenger]:
        pattern = f"%{term.lower()}%"
        stmt = (
            self._base_query()
            .where(
                func.lower(Passenger.full_name).like(pattern)
                | func.lower(Passenger.email).like(pattern)
            )
            .offset(skip)
            .limit(limit)
        )
        return self.db.scalars(stmt).all()


class CardRepository(BaseRepository[Card]):
    model = Card

    def get_by_nfc_uid(self, nfc_uid: str) -> Card | None:
        stmt = self._base_query().where(Card.nfc_uid == nfc_uid)
        return self.db.scalars(stmt).first()

    def nfc_uid_taken(self, nfc_uid: str) -> bool:
        stmt = select(Card.id).where(Card.nfc_uid == nfc_uid)
        return self.db.scalars(stmt).first() is not None

    def list_by_passenger(self, passenger_id: uuid.UUID) -> Sequence[Card]:
        stmt = (
            self._base_query()
            .where(Card.passenger_id == passenger_id)
            .order_by(Card.created_at, Card.id)
        )
        return self.db.scalars(stmt).all()


class LineRepository(BaseRepository[Line]):
    model = Line

    def get_by_code(self, code: str) -> Line | None:
        stmt = self._base_query().where(Line.code == code)
        return self.db.scalars(stmt).first()

    def get_with_stops(self, line_id: uuid.UUID, direction: Direction) -> Line | None:
        stmt = (
            self._base_query()
            .where(Line.id == line_id)
            .options(
                selectinload(
                    Line.line_stops.and_(LineStop.direction == direction)
                ).selectinload(LineStop.stop)
            )
        )
        return self.db.scalars(stmt).first()


class StopRepository(BaseRepository[Stop]):
    model = Stop

    def get_by_name(self, name: str) -> Stop | None:
        stmt = self._base_query().where(func.lower(Stop.name) == name.lower())
        return self.db.scalars(stmt).first()

    def search(self, term: str, limit: int = 20) -> Sequence[Stop]:
        stmt = (
            self._base_query()
            .where(func.lower(Stop.name).like(f"%{term.lower()}%"))
            .limit(limit)
        )
        return self.db.scalars(stmt).all()


class LineStopRepository(BaseRepository[LineStop]):
    model = LineStop

    def list_ordered(self, line_id: uuid.UUID, direction: Direction) -> Sequence[LineStop]:
        stmt = (
            select(LineStop)
            .where(LineStop.line_id == line_id, LineStop.direction == direction)
            .order_by(LineStop.sequence)
            .options(selectinload(LineStop.stop))
        )
        return self.db.scalars(stmt).all()

    def get_entry(
        self, line_id: uuid.UUID, direction: Direction, stop_id: uuid.UUID
    ) -> LineStop | None:
        stmt = select(LineStop).where(
            LineStop.line_id == line_id,
            LineStop.direction == direction,
            LineStop.stop_id == stop_id,
        )
        return self.db.scalars(stmt).first()

    def get_last(self, line_id: uuid.UUID, direction: Direction) -> LineStop | None:
        stmt = (
            select(LineStop)
            .where(LineStop.line_id == line_id, LineStop.direction == direction)
            .order_by(LineStop.sequence.desc())
            .limit(1)
        )
        return self.db.scalars(stmt).first()


class BusRepository(BaseRepository[Bus]):
    model = Bus

    def get_by_plate(self, plate: str) -> Bus | None:
        stmt = self._base_query().where(Bus.plate == plate)
        return self.db.scalars(stmt).first()

    def list_by_line(self, line_id: uuid.UUID, only_active: bool = True) -> Sequence[Bus]:
        stmt = self._base_query().where(Bus.line_id == line_id)
        if only_active:
            stmt = stmt.where(Bus.is_active.is_(True))
        return self.db.scalars(stmt).all()

    def list_active(self) -> Sequence[Bus]:
        stmt = (
            self._base_query()
            .where(Bus.is_active.is_(True))
            .options(selectinload(Bus.line))
        )
        return self.db.scalars(stmt).all()


class TripRepository(BaseRepository[Trip]):
    model = Trip

    @staticmethod
    def _live(stmt):
        return stmt.where(Trip.is_deleted.is_(False))

    @classmethod
    def _in_range(cls, stmt, since: datetime | None, until: datetime | None):
        stmt = cls._live(stmt)
        if since is not None:
            stmt = stmt.where(Trip.boarded_at >= since)
        if until is not None:
            stmt = stmt.where(Trip.boarded_at < until)
        return stmt

    @staticmethod
    def _local_hour():
        return func.extract(
            "hour", func.timezone(settings.analytics_timezone, Trip.boarded_at)
        )

    def get_open_by_card(self, card_id: uuid.UUID) -> Trip | None:
        stmt = self._base_query().where(
            Trip.card_id == card_id, Trip.status == TripStatus.OPEN
        )
        return self.db.scalars(stmt).first()

    def list_open_by_bus(self, bus_id: uuid.UUID) -> Sequence[Trip]:
        stmt = (
            self._base_query()
            .where(Trip.bus_id == bus_id, Trip.status == TripStatus.OPEN)
            .order_by(Trip.boarded_at)
            .options(
                selectinload(Trip.card).selectinload(Card.passenger),
                selectinload(Trip.board_stop),
            )
        )
        return self.db.scalars(stmt).all()

    def list_by_cards(
        self, card_ids: Sequence[uuid.UUID], skip: int = 0, limit: int = 50
    ) -> Sequence[Trip]:
        """Yolcunun tüm kartlarının yolculukları, tek sorguda sayfalanmış."""
        if not card_ids:
            return []
        stmt = (
            self._base_query()
            .where(Trip.card_id.in_(card_ids))
            .order_by(Trip.boarded_at.desc(), Trip.id.desc())
            .offset(skip)
            .limit(limit)
            .options(
                selectinload(Trip.line),
                selectinload(Trip.board_stop),
                selectinload(Trip.alight_stop),
            )
        )
        return self.db.scalars(stmt).all()

    def count_open_by_bus(self) -> dict[uuid.UUID, int]:
        stmt = (
            self._live(select(Trip.bus_id, func.count(Trip.id)))
            .where(Trip.status == TripStatus.OPEN)
            .group_by(Trip.bus_id)
        )
        return {bus_id: count for bus_id, count in self.db.execute(stmt).all()}

    def count_open_by_line(self, line_id: uuid.UUID) -> int:
        stmt = self._live(select(func.count(Trip.id))).where(
            Trip.line_id == line_id, Trip.status == TripStatus.OPEN
        )
        return self.db.scalar(stmt) or 0

    def count_by_status(
        self, since: datetime | None = None, until: datetime | None = None
    ) -> dict[str, int]:
        stmt = self._in_range(
            select(Trip.status, func.count(Trip.id)), since, until
        ).group_by(Trip.status)
        return {status.value: count for status, count in self.db.execute(stmt).all()}

    def hourly_boardings(
        self, since: datetime | None = None, until: datetime | None = None
    ) -> list[tuple[int, int]]:
        hour = self._local_hour()
        stmt = (
            self._in_range(select(hour, func.count(Trip.id)), since, until)
            .group_by(hour)
            .order_by(hour)
        )
        return [(int(h), c) for h, c in self.db.execute(stmt).all()]

    def top_board_stops(
        self,
        limit: int = 10,
        since: datetime | None = None,
        until: datetime | None = None,
    ) -> list[tuple[uuid.UUID, str, int]]:
        stmt = (
            self._in_range(
                select(Stop.id, Stop.name, func.count(Trip.id).label("total")),
                since,
                until,
            )
            .join(Stop, Stop.id == Trip.board_stop_id)
            .group_by(Stop.id, Stop.name)
            .order_by(func.count(Trip.id).desc())
            .limit(limit)
        )
        return [(sid, name, total) for sid, name, total in self.db.execute(stmt).all()]

    def hourly_by_line(
        self, since: datetime | None = None, until: datetime | None = None
    ) -> list[tuple[uuid.UUID, int, int]]:
        hour = self._local_hour()
        stmt = (
            self._in_range(
                select(Trip.line_id, hour, func.count(Trip.id)), since, until
            )
            .group_by(Trip.line_id, hour)
            .order_by(Trip.line_id, hour)
        )
        return [(lid, int(h), c) for lid, h, c in self.db.execute(stmt).all()]

    def count_by_line(
        self, since: datetime | None = None, until: datetime | None = None
    ) -> dict[uuid.UUID, int]:
        stmt = self._in_range(
            select(Trip.line_id, func.count(Trip.id)), since, until
        ).group_by(Trip.line_id)
        return {line_id: count for line_id, count in self.db.execute(stmt).all()}

    def stop_usage(
        self,
        limit: int = 12,
        since: datetime | None = None,
        until: datetime | None = None,
    ) -> list[tuple[uuid.UUID, str, int, int]]:
        zero = cast(literal(0), Integer)

        boardings = self._in_range(
            select(
                Trip.board_stop_id.label("stop_id"),
                func.count(Trip.id).label("boarding"),
                zero.label("alighting"),
            ),
            since,
            until,
        ).group_by(Trip.board_stop_id)

        alightings = (
            self._in_range(
                select(
                    Trip.alight_stop_id.label("stop_id"),
                    zero.label("boarding"),
                    func.count(Trip.id).label("alighting"),
                ),
                since,
                until,
            )
            .where(Trip.alight_stop_id.is_not(None))
            .group_by(Trip.alight_stop_id)
        )

        combined = union_all(boardings, alightings).subquery()

        stmt = (
            select(
                Stop.id,
                Stop.name,
                func.sum(combined.c.boarding),
                func.sum(combined.c.alighting),
            )
            .join(Stop, Stop.id == combined.c.stop_id)
            .group_by(Stop.id, Stop.name)
            .order_by((func.sum(combined.c.boarding) + func.sum(combined.c.alighting)).desc())
            .limit(limit)
        )
        return [
            (sid, name, int(board or 0), int(alight or 0))
            for sid, name, board, alight in self.db.execute(stmt).all()
        ]

    def top_pairs(
        self,
        limit: int = 10,
        since: datetime | None = None,
        until: datetime | None = None,
    ) -> list[tuple[str, str, int]]:
        board_stop = aliased(Stop)
        alight_stop = aliased(Stop)
        stmt = (
            self._in_range(
                select(
                    board_stop.name, alight_stop.name, func.count(Trip.id).label("total")
                ),
                since,
                until,
            )
            .join(board_stop, board_stop.id == Trip.board_stop_id)
            .join(alight_stop, alight_stop.id == Trip.alight_stop_id)
            .where(Trip.status == TripStatus.COMPLETED)
            .group_by(board_stop.name, alight_stop.name)
            .order_by(func.count(Trip.id).desc())
            .limit(limit)
        )
        return [(a, b, total) for a, b, total in self.db.execute(stmt).all()]

    def count_by_card_type(
        self, since: datetime | None = None, until: datetime | None = None
    ) -> dict[str, int]:
        stmt = self._in_range(
            select(Trip.card_type_snapshot, func.count(Trip.id)), since, until
        ).group_by(Trip.card_type_snapshot)
        return {card_type.value: count for card_type, count in self.db.execute(stmt).all()}

    def recent(self, limit: int = 20) -> Sequence[Trip]:
        stmt = (
            self._base_query()
            .order_by(Trip.boarded_at.desc())
            .limit(limit)
            .options(
                selectinload(Trip.line),
                selectinload(Trip.board_stop),
                selectinload(Trip.alight_stop),
                selectinload(Trip.bus),
                selectinload(Trip.card).selectinload(Card.passenger),
            )
        )
        return self.db.scalars(stmt).all()

    def list_due(self, now: datetime) -> Sequence[Trip]:
        stmt = self._base_query().where(
            Trip.status == TripStatus.OPEN,
            Trip.auto_alight_at.is_not(None),
            Trip.auto_alight_at <= now,
        )
        return self.db.scalars(stmt).all()


class FavoriteRepository(BaseRepository[Favorite]):
    model = Favorite

    def get_entry(self, passenger_id: uuid.UUID, line_id: uuid.UUID) -> Favorite | None:
        stmt = select(Favorite).where(
            Favorite.passenger_id == passenger_id, Favorite.line_id == line_id
        )
        return self.db.scalars(stmt).first()

    def list_by_passenger(self, passenger_id: uuid.UUID) -> Sequence[Favorite]:
        stmt = (
            select(Favorite)
            .where(Favorite.passenger_id == passenger_id)
            .options(selectinload(Favorite.line))
        )
        return self.db.scalars(stmt).all()
