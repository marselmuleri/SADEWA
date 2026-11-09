"""Tabel portofolio_berkas & rpp_pertemuan (fitur Portofolio mata kuliah)

Revision ID: 20261109_008
Revises: 20261108_007
Create Date: 2026-11-09 10:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = '20261109_008'
down_revision: Union[str, Sequence[str], None] = '20261108_007'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'portofolio_berkas',
        sa.Column('id', sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('mata_kuliah_id', sa.BigInteger(), sa.ForeignKey('mata_kuliah.id'), nullable=False),
        sa.Column('jenis', sa.String(20), nullable=False),
        sa.Column('judul', sa.String(255), nullable=False),
        sa.Column('keterangan', sa.Text(), nullable=True),
        sa.Column('nama_file', sa.String(255), nullable=False),
        sa.Column('path_file', sa.String(500), nullable=False),
        sa.Column('content_type', sa.String(120), nullable=True),
        sa.Column('ukuran', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('uploaded_by', sa.BigInteger(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(), server_default=sa.func.now()),
    )
    op.create_index('ix_portofolio_berkas_mata_kuliah_id', 'portofolio_berkas', ['mata_kuliah_id'])

    op.create_table(
        'rpp_pertemuan',
        sa.Column('id', sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('mata_kuliah_id', sa.BigInteger(), sa.ForeignKey('mata_kuliah.id'), nullable=False),
        sa.Column('pertemuan_ke', sa.Integer(), nullable=False),
        sa.Column('tanggal', sa.Date(), nullable=True),
        sa.Column('cpmk', sa.String(100), nullable=True),
        sa.Column('materi', sa.Text(), nullable=True),
        sa.Column('metode', sa.Text(), nullable=True),
        sa.Column('realisasi', sa.Text(), nullable=True),
        sa.Column('catatan', sa.Text(), nullable=True),
        sa.Column('updated_by', sa.BigInteger(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('updated_at', sa.TIMESTAMP(), server_default=sa.func.now()),
        sa.UniqueConstraint('mata_kuliah_id', 'pertemuan_ke', name='uq_rpp_mk_pertemuan'),
    )
    op.create_index('ix_rpp_pertemuan_mata_kuliah_id', 'rpp_pertemuan', ['mata_kuliah_id'])


def downgrade() -> None:
    op.drop_index('ix_rpp_pertemuan_mata_kuliah_id', table_name='rpp_pertemuan')
    op.drop_table('rpp_pertemuan')
    op.drop_index('ix_portofolio_berkas_mata_kuliah_id', table_name='portofolio_berkas')
    op.drop_table('portofolio_berkas')
