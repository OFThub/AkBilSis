"""Kart basina tek acik yolculuk

Revision ID: 0002
Revises: 0001
Create Date: 2026-07-23

Eszamanli iki binis istegi uygulama katmaninda engellenemez: ikisi de "acik
yolculuk yok" gorur. Kisit bu yuzden veritabaninda duruyor.

Not: status sutunu Enum(native_enum=False) ile yazildigi icin degerler enum
ADIYLA saklanir -- 'OPEN', 'open' degil.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE trips t
           SET status = 'ABANDONED',
               alighted_at = COALESCE(t.alighted_at, now())
         WHERE t.status = 'OPEN'
           AND t.id <> (
                 SELECT x.id
                   FROM trips x
                  WHERE x.card_id = t.card_id
                    AND x.status = 'OPEN'
                  ORDER BY x.boarded_at DESC, x.id DESC
                  LIMIT 1
           )
        """
    )
    op.create_index(
        "uq_open_trip_per_card",
        "trips",
        ["card_id"],
        unique=True,
        postgresql_where=sa.text("status = 'OPEN'"),
    )


def downgrade() -> None:
    op.drop_index("uq_open_trip_per_card", table_name="trips")
