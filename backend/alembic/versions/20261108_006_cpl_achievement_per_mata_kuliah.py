"""Capaian CPL per mata kuliah: tambah mata_kuliah_id dan bobot_cp ke cpl_achievement

Baris lama (mata_kuliah_id NULL) dibiarkan sebagai cadangan dan diganti otomatis
saat mata kuliah dikalkulasi ulang.

Revision ID: 20261108_006
Revises: 20261108_005
Create Date: 2026-11-08 21:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = '20261108_006'
down_revision: Union[str, Sequence[str], None] = '20261108_005'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('cpl_achievement', sa.Column('mata_kuliah_id', sa.BigInteger(), sa.ForeignKey('mata_kuliah.id'), nullable=True))
    op.add_column('cpl_achievement', sa.Column('bobot_cp', sa.Numeric(), nullable=True))
    op.create_index('ix_cpl_achievement_mata_kuliah_id', 'cpl_achievement', ['mata_kuliah_id'])


def downgrade() -> None:
    op.drop_index('ix_cpl_achievement_mata_kuliah_id', table_name='cpl_achievement')
    op.drop_column('cpl_achievement', 'bobot_cp')
    op.drop_column('cpl_achievement', 'mata_kuliah_id')
