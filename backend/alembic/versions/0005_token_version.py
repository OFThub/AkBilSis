"""Oturum sürümü — refresh token iptali

Revision ID: 0005
Revises: 0004
Create Date: 2026-07-23

Her tazelemede sürüm artar; kullanılmış ya da çalınmış bir refresh token bir
sonraki meşru tazelemede geçersizleşir.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "passengers",
        sa.Column("token_version", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("passengers", "token_version")
