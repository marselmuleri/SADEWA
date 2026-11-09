"""Aturan penilaian per prodi, skala huruf per angkatan, data portofolio & kolom RPP tambahan

Revision ID: 20261109_010
Revises: 20261109_009
Create Date: 2026-11-09 20:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = '20261109_010'
down_revision: Union[str, Sequence[str], None] = '20261109_009'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'aturan_penilaian_prodi',
        sa.Column('id', sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('program_studi_id', sa.BigInteger(), sa.ForeignKey('program_studi.id'), nullable=False, unique=True),
        sa.Column('ambang', sa.Numeric(5, 2), nullable=False),
        sa.Column('target_rerata_skala', sa.Numeric(4, 2), nullable=False),
        sa.Column('target_persen', sa.Numeric(5, 2), nullable=False),
        sa.Column('gpm_nama', sa.String(255), nullable=True),
        sa.Column('gpm_nip', sa.String(100), nullable=True),
        sa.Column('updated_by', sa.BigInteger(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('updated_at', sa.TIMESTAMP(), server_default=sa.func.now()),
    )

    op.create_table(
        'portofolio_info',
        sa.Column('id', sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('mata_kuliah_id', sa.BigInteger(), sa.ForeignKey('mata_kuliah.id'), nullable=False, unique=True),
        sa.Column('no_dokumen', sa.String(150), nullable=True),
        sa.Column('revisi', sa.String(100), nullable=True),
        sa.Column('tanggal_terbit', sa.Date(), nullable=True),
        sa.Column('prasyarat', sa.String(255), nullable=True),
        sa.Column('manfaat', sa.Text(), nullable=True),
        sa.Column('deskripsi', sa.Text(), nullable=True),
        sa.Column('strategi', sa.Text(), nullable=True),
        sa.Column('tata_tertib', sa.Text(), nullable=True),
        sa.Column('waktu_tempat', sa.Text(), nullable=True),
        sa.Column('referensi', sa.Text(), nullable=True),
        sa.Column('updated_by', sa.BigInteger(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('updated_at', sa.TIMESTAMP(), server_default=sa.func.now()),
    )

    op.add_column('rpp_pertemuan', sa.Column('waktu', sa.String(100), nullable=True))
    op.add_column('rpp_pertemuan', sa.Column('pengalaman_belajar', sa.Text(), nullable=True))
    op.add_column('rpp_pertemuan', sa.Column('indikator_kriteria', sa.Text(), nullable=True))

    # Skala huruf per rentang angkatan: keunikan huruf/batas kini per kelompok angkatan.
    # IF EXISTS: constraint batas_min hanya ada di database yang dibuat lewat create_all.
    op.execute("ALTER TABLE skala_nilai DROP CONSTRAINT IF EXISTS uq_skala_nilai_kurikulum_huruf")
    op.execute("ALTER TABLE skala_nilai DROP CONSTRAINT IF EXISTS uq_skala_nilai_kurikulum_batas")
    op.add_column('skala_nilai', sa.Column('angkatan_min', sa.Integer(), nullable=True))
    op.add_column('skala_nilai', sa.Column('angkatan_max', sa.Integer(), nullable=True))
    op.execute("CREATE INDEX IF NOT EXISTS ix_skala_nilai_kurikulum_version_id ON skala_nilai (kurikulum_version_id)")


def downgrade() -> None:
    # Hapus skala khusus angkatan agar constraint lama bisa dipasang kembali.
    op.execute("DELETE FROM skala_nilai WHERE angkatan_min IS NOT NULL OR angkatan_max IS NOT NULL")
    op.drop_column('skala_nilai', 'angkatan_max')
    op.drop_column('skala_nilai', 'angkatan_min')
    op.create_unique_constraint('uq_skala_nilai_kurikulum_huruf', 'skala_nilai', ['kurikulum_version_id', 'huruf'])

    op.drop_column('rpp_pertemuan', 'indikator_kriteria')
    op.drop_column('rpp_pertemuan', 'pengalaman_belajar')
    op.drop_column('rpp_pertemuan', 'waktu')
    op.drop_table('portofolio_info')
    op.drop_table('aturan_penilaian_prodi')
