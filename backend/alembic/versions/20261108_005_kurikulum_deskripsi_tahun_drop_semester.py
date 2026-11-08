"""Add deskripsi and tahun to kurikulum_versions, drop semester

Revision ID: 20261108_005
Revises: 20261108_004
Create Date: 2026-11-08 18:50:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20261108_005'
down_revision: Union[str, Sequence[str], None] = '20261108_004'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('kurikulum_versions', sa.Column('deskripsi', sa.Text(), nullable=True))
    op.add_column('kurikulum_versions', sa.Column('tahun', sa.Integer(), nullable=True))
    op.drop_column('kurikulum_versions', 'semester')


def downgrade() -> None:
    op.add_column('kurikulum_versions', sa.Column('semester', sa.Enum('Ganjil', 'Genap', name='semester_kurikulum_enum'), nullable=True))
    op.drop_column('kurikulum_versions', 'tahun')
    op.drop_column('kurikulum_versions', 'deskripsi')

