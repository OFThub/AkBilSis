import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core import (
    Base,
    CardMedium,
    CardType,
    Direction,
    SoftDeleteMixin,
    TimestampMixin,
    TripStatus,
    UUIDMixin,
)

class Passenger(Base,UUIDMixin,TimestampMixin,SoftDeleteMixin):
    __tablename__ = "passengers"

    full_name: Mapped[str]=mapped_column(String(100),nullable=False)
    email: Mapped[str]=mapped_column(String(255),unique=True,index=True,nullable=False)
    password_hash: Mapped[str]=mapped_column(String(255),nullable=False)
    is_admin: Mapped[bool]=mapped_column(Boolean,default=False,nullable=False)

    cards:Mapped[list["Card"]]=relationship(back_populates="passengers")
    favorites: Mapped[list["Favorite"]]=relationship(back_populates="passengers")

class Card(Base,UUIDMixin,TimestampMixin,SoftDeleteMixin):
    __tablename__ = "cards"

    nfc_uid: Mapped[str | None] = mapped_column(String(32), unique=True, index=True)
    medium: Mapped[CardMedium] = mapped_column(
        Enum(CardMedium, native_enum=False), default=CardMedium.MOBILE, nullable=False
    )
    card_type: Mapped[CardType] = mapped_column(
        Enum(CardType, native_enum=False), default=CardType.NORMAL, nullable=False
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    passenger_id: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("passengers.id"), index=True
    )

    passenger: Mapped["Passenger | None"] = relationship(back_populates="cards")
    trips: Mapped[list["Trip"]] = relationship(back_populates="card")

class Line(Base,UUIDMixin,TimestampMixin,SoftDeleteMixin):
    __tablename__ = "lines"
    code: Mapped[str] = mapped_column(String(16), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    line_stops: Mapped[list["LineStop"]] = relationship(
        back_populates="line", order_by="LineStop.sequence"
    )
    buses: Mapped[list["Bus"]] = relationship(back_populates="line")

class Stop(Base, UUIDMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "stops"

    name: Mapped[str] = mapped_column(String(150), index=True, nullable=False)
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)

    line_stops: Mapped[list["LineStop"]] = relationship(back_populates="stop")


class LineStop(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "line_stops"
    __table_args__ = (
        UniqueConstraint("line_id", "direction", "sequence", name="uq_line_direction_sequence"),
        UniqueConstraint("line_id", "direction", "stop_id", name="uq_line_direction_stop"),
    )

    line_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("lines.id"), index=True, nullable=False
    )
    stop_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("stops.id"), index=True, nullable=False
    )
    direction: Mapped[Direction] = mapped_column(
        Enum(Direction, native_enum=False), default=Direction.FORWARD, nullable=False
    )
    sequence: Mapped[int] = mapped_column(Integer, nullable=False)
    minutes_from_previous: Mapped[int | None] = mapped_column(Integer)

    line: Mapped["Line"] = relationship(back_populates="line_stops")
    stop: Mapped["Stop"] = relationship(back_populates="line_stops")


class Bus(Base, UUIDMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "buses"

    plate: Mapped[str] = mapped_column(String(16), unique=True, index=True, nullable=False)
    line_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("lines.id"), index=True, nullable=False
    )
    direction: Mapped[Direction] = mapped_column(
        Enum(Direction, native_enum=False), default=Direction.FORWARD, nullable=False
    )
    current_stop_id: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("stops.id")
    )
    location_updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    line: Mapped["Line"] = relationship(back_populates="buses")
    current_stop: Mapped["Stop | None"] = relationship()
    devices: Mapped[list["Device"]] = relationship(back_populates="bus")
    trips: Mapped[list["Trip"]] = relationship(back_populates="bus")

class  Device(Base, UUIDMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "devices"
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    api_key_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    bus_id: Mapped[uuid.UUID | None] = mapped_column(PGUUID(as_uuid=True), ForeignKey("buses.id"), index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    bus: Mapped["Bus | None"] = relationship(back_populates="devices")

class Trip(Base, UUIDMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "trips"
    card_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("cards.id"), index=True, nullable=False)
    bus_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("buses.id"), index=True, nullable=False)
    line_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("lines.id"), index=True, nullable=False)
    board_stop_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("stops.id"), index=True, nullable=False)
    alight_stop_id: Mapped[uuid.UUID | None] = mapped_column( PGUUID(as_uuid=True), ForeignKey("stops.id"))
    boarded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    alighted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[TripStatus] = mapped_column(Enum(TripStatus, native_enum=False), default=TripStatus.OPEN, index=True, nullable=False)
    card_type_snapshot: Mapped[CardType] = mapped_column(Enum(CardType, native_enum=False), nullable=False)
    card: Mapped["Card"] = relationship(back_populates="trips")
    bus: Mapped["Bus"] = relationship(back_populates="trips")
    line: Mapped["Line"] = relationship()
    board_stop: Mapped["Stop"] = relationship(foreign_keys=[board_stop_id])
    alight_stop: Mapped["Stop | None"] = relationship(foreign_keys=[alight_stop_id])


class Favorite(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "favorites"
    __table_args__ = (UniqueConstraint("passenger_id", "line_id", name="uq_passenger_line"),)

    passenger_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("passengers.id"), index=True, nullable=False)
    line_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("lines.id"), index=True, nullable=False)

    passenger: Mapped["Passenger"] = relationship(back_populates="favorites")
    line: Mapped["Line"] = relationship()
