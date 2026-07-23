"""Biniş durağının güzergâhtaki sıra numarası

Revision ID: 0003
Revises: 0002
Create Date: 2026-07-23

İniş kuralı "farklı durak" yerine "farklı sıra" ölçütüne geçiyor: araç tur atıp
aynı durağa döndüğünde yolcu inebilmeli.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "trips",
        sa.Column("board_sequence", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("trips", "board_sequence")
