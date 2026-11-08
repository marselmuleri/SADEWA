"""Make semester in kurikulum_versions nullable (version-only curriculum)

Revision ID: 20261108_004
Revises: 20261105_003
Create Date: 2026-11-08 15:35:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '20261108_004'
down_revision: Union[str, Sequence[str], None] = '20261105_003'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        'kurikulum_versions',
        'semester',
        existing_type=sa.Enum('Ganjil', 'Genap', name='semester_kurikulum_enum'),
        nullable=True
    )


def downgrade() -> None:
    op.alter_column(
        'kurikulum_versions',
        'semester',
        existing_type=sa.Enum('Ganjil', 'Genap', name='semester_kurikulum_enum'),
        nullable=False
    )

