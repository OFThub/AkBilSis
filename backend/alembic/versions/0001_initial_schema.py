"""Başlangıç şeması

Revision ID: 0001
Revises:
Create Date: 2026-07-22

Tablolar bağımlılık sırasına göre oluşturulur: önce yabancı anahtar hedefleri
(passengers, stops, lines), sonra onlara bağlananlar.

Enum sütunları `native_enum=False` ile tanımlıdır — Postgres tarafında ayrı bir
TYPE üretmez, VARCHAR + CHECK olarak durur. Böylece yeni bir değer eklemek
ALTER TYPE gerektirmez.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID as PGUUID

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


CARD_TYPE = sa.Enum("normal", "student", "senior", name="cardtype", native_enum=False)
CARD_MEDIUM = sa.Enum("physical", "mobile", name="cardmedium", native_enum=False)
TRIP_STATUS = sa.Enum("open", "completed", "abandoned", name="tripstatus", native_enum=False)
DIRECTION = sa.Enum("forward", "backward", name="direction", native_enum=False)


def _timestamps() -> list[sa.Column]:
    return [
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    ]


def _soft_delete() -> sa.Column:
    return sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.false())


def upgrade() -> None:
    op.create_table(
        "passengers",
        sa.Column("id", PGUUID(as_uuid=True), primary_key=True),
        sa.Column("full_name", sa.String(100), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("is_admin", sa.Boolean(), nullable=False, server_default=sa.false()),
        *_timestamps(),
        _soft_delete(),
    )
    op.create_index("ix_passengers_email", "passengers", ["email"], unique=True)

    op.create_table(
        "stops",
        sa.Column("id", PGUUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(150), nullable=False),
        sa.Column("latitude", sa.Float(), nullable=True),
        sa.Column("longitude", sa.Float(), nullable=True),
        *_timestamps(),
        _soft_delete(),
    )
    op.create_index("ix_stops_name", "stops", ["name"])

    op.create_table(
        "lines",
        sa.Column("id", PGUUID(as_uuid=True), primary_key=True),
        sa.Column("code", sa.String(16), nullable=False),
        sa.Column("name", sa.String(150), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        # Saat başına beklenen yoğunluk (24 eleman) — lines.json'dan seed edilir
        sa.Column("hourly_profile", sa.JSON(), nullable=False, server_default="[]"),
        *_timestamps(),
        _soft_delete(),
    )
    op.create_index("ix_lines_code", "lines", ["code"], unique=True)

    op.create_table(
        "cards",
        sa.Column("id", PGUUID(as_uuid=True), primary_key=True),
        sa.Column("nfc_uid", sa.String(32), nullable=True),
        sa.Column("medium", CARD_MEDIUM, nullable=False),
        sa.Column("card_type", CARD_TYPE, nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column(
            "passenger_id", PGUUID(as_uuid=True), sa.ForeignKey("passengers.id"), nullable=True
        ),
        *_timestamps(),
        _soft_delete(),
    )
    op.create_index("ix_cards_nfc_uid", "cards", ["nfc_uid"], unique=True)
    op.create_index("ix_cards_passenger_id", "cards", ["passenger_id"])

    op.create_table(
        "buses",
        sa.Column("id", PGUUID(as_uuid=True), primary_key=True),
        sa.Column("plate", sa.String(16), nullable=False),
        sa.Column("line_id", PGUUID(as_uuid=True), sa.ForeignKey("lines.id"), nullable=False),
        sa.Column("direction", DIRECTION, nullable=False),
        sa.Column(
            "current_stop_id", PGUUID(as_uuid=True), sa.ForeignKey("stops.id"), nullable=True
        ),
        sa.Column("location_updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        *_timestamps(),
        _soft_delete(),
    )
    op.create_index("ix_buses_plate", "buses", ["plate"], unique=True)
    op.create_index("ix_buses_line_id", "buses", ["line_id"])

    op.create_table(
        "line_stops",
        sa.Column("id", PGUUID(as_uuid=True), primary_key=True),
        sa.Column("line_id", PGUUID(as_uuid=True), sa.ForeignKey("lines.id"), nullable=False),
        sa.Column("stop_id", PGUUID(as_uuid=True), sa.ForeignKey("stops.id"), nullable=False),
        sa.Column("direction", DIRECTION, nullable=False),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.Column("minutes_from_previous", sa.Integer(), nullable=True),
        *_timestamps(),
        sa.UniqueConstraint(
            "line_id", "direction", "sequence", name="uq_line_direction_sequence"
        ),
        sa.UniqueConstraint("line_id", "direction", "stop_id", name="uq_line_direction_stop"),
    )
    op.create_index("ix_line_stops_line_id", "line_stops", ["line_id"])
    op.create_index("ix_line_stops_stop_id", "line_stops", ["stop_id"])

    op.create_table(
        "devices",
        sa.Column("id", PGUUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("api_key_hash", sa.String(64), nullable=False),
        sa.Column("bus_id", PGUUID(as_uuid=True), sa.ForeignKey("buses.id"), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        *_timestamps(),
        _soft_delete(),
    )
    op.create_index("ix_devices_api_key_hash", "devices", ["api_key_hash"], unique=True)
    op.create_index("ix_devices_bus_id", "devices", ["bus_id"])

    op.create_table(
        "trips",
        sa.Column("id", PGUUID(as_uuid=True), primary_key=True),
        sa.Column("card_id", PGUUID(as_uuid=True), sa.ForeignKey("cards.id"), nullable=False),
        sa.Column("bus_id", PGUUID(as_uuid=True), sa.ForeignKey("buses.id"), nullable=False),
        sa.Column("line_id", PGUUID(as_uuid=True), sa.ForeignKey("lines.id"), nullable=False),
        sa.Column(
            "board_stop_id", PGUUID(as_uuid=True), sa.ForeignKey("stops.id"), nullable=False
        ),
        sa.Column(
            "alight_stop_id", PGUUID(as_uuid=True), sa.ForeignKey("stops.id"), nullable=True
        ),
        sa.Column("boarded_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("alighted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", TRIP_STATUS, nullable=False),
        sa.Column("card_type_snapshot", CARD_TYPE, nullable=False),
        # Son durakta otomatik iniş damgası — binişte hesaplanır
        sa.Column("auto_alight_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "auto_alight_stop_id", PGUUID(as_uuid=True), sa.ForeignKey("stops.id"), nullable=True
        ),
        *_timestamps(),
        _soft_delete(),
    )
    op.create_index("ix_trips_card_id", "trips", ["card_id"])
    op.create_index("ix_trips_bus_id", "trips", ["bus_id"])
    op.create_index("ix_trips_line_id", "trips", ["line_id"])
    op.create_index("ix_trips_board_stop_id", "trips", ["board_stop_id"])
    op.create_index("ix_trips_status", "trips", ["status"])
    op.create_index("ix_trips_auto_alight_at", "trips", ["auto_alight_at"])

    op.create_table(
        "favorites",
        sa.Column("id", PGUUID(as_uuid=True), primary_key=True),
        sa.Column(
            "passenger_id", PGUUID(as_uuid=True), sa.ForeignKey("passengers.id"), nullable=False
        ),
        sa.Column("line_id", PGUUID(as_uuid=True), sa.ForeignKey("lines.id"), nullable=False),
        *_timestamps(),
        sa.UniqueConstraint("passenger_id", "line_id", name="uq_passenger_line"),
    )
    op.create_index("ix_favorites_passenger_id", "favorites", ["passenger_id"])
    op.create_index("ix_favorites_line_id", "favorites", ["line_id"])


def downgrade() -> None:
    for table in (
        "favorites",
        "trips",
        "devices",
        "line_stops",
        "buses",
        "cards",
        "lines",
        "stops",
        "passengers",
    ):
        op.drop_table(table)
