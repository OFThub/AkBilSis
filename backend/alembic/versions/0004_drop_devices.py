"""Validatör cihaz katmanı ve araç konum sütunları kaldırıldı

Revision ID: 0004
Revises: 0003
Create Date: 2026-07-23

NFC'den vazgeçilip liste-seçim akışına geçilince devices tablosunu tüketen bir
uç kalmadı. Araç konumu ise simulation.py'de duvar saatinden hesaplanıyor;
buses.current_stop_id yalnızca bayat bir ikinci kaynaktı.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID as PGUUID

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_table("devices")
    op.drop_column("buses", "current_stop_id")
    op.drop_column("buses", "location_updated_at")


def downgrade() -> None:
    op.add_column(
        "buses",
        sa.Column("location_updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "buses",
        sa.Column("current_stop_id", PGUUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "buses_current_stop_id_fkey", "buses", "stops", ["current_stop_id"], ["id"]
    )
    op.create_table(
        "devices",
        sa.Column("id", PGUUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("api_key_hash", sa.String(64), nullable=False),
        sa.Column(
            "bus_id", PGUUID(as_uuid=True), sa.ForeignKey("buses.id"), nullable=True
        ),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
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
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_index("ix_devices_api_key_hash", "devices", ["api_key_hash"], unique=True)
    op.create_index("ix_devices_bus_id", "devices", ["bus_id"])
