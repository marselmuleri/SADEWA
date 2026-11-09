"""Tabel evaluasi_cpmk (sheet Evaluasi portofolio: analisis & rencana perbaikan per CPMK)

Revision ID: 20261109_009
Revises: 20261109_008
Create Date: 2026-11-09 14:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = '20261109_009'
down_revision: Union[str, Sequence[str], None] = '20261109_008'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'evaluasi_cpmk',
        sa.Column('id', sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('mata_kuliah_id', sa.BigInteger(), sa.ForeignKey('mata_kuliah.id'), nullable=False),
        sa.Column('cpmk_id', sa.BigInteger(), sa.ForeignKey('cpmk.id', ondelete='CASCADE'), nullable=False),
        sa.Column('analisis', sa.Text(), nullable=True),
        sa.Column('rencana_perbaikan', sa.Text(), nullable=True),
        sa.Column('updated_by', sa.BigInteger(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('updated_at', sa.TIMESTAMP(), server_default=sa.func.now()),
        sa.UniqueConstraint('mata_kuliah_id', 'cpmk_id', name='uq_evaluasi_mk_cpmk'),
    )
    op.create_index('ix_evaluasi_cpmk_mata_kuliah_id', 'evaluasi_cpmk', ['mata_kuliah_id'])


def downgrade() -> None:
    op.drop_index('ix_evaluasi_cpmk_mata_kuliah_id', table_name='evaluasi_cpmk')
    op.drop_table('evaluasi_cpmk')
