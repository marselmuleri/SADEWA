"""Schema hardening: add angkatan to mahasiswa, konten & sumber_dokumen_rag to rps, bobot to jenis_evaluasi

Revision ID: 20261105_003
Revises: 5a78a3809846, 20261015_001
Create Date: 2026-11-05 14:35:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20261105_003'
down_revision: Union[str, Sequence[str], None] = ('5a78a3809846', '20261015_001')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Tambah kolom angkatan pada mahasiswa jika belum ada
    op.add_column('mahasiswa', sa.Column('angkatan', sa.SmallInteger(), nullable=True))

    # 2. Tambah kolom konten dan sumber_dokumen_rag pada rps
    op.add_column('rps', sa.Column('konten', sa.JSON(), nullable=True))
    op.add_column('rps', sa.Column('sumber_dokumen_rag', sa.JSON(), nullable=True))

    # 3. Tambah kolom bobot pada jenis_evaluasi jika belum ada
    op.add_column('jenis_evaluasi', sa.Column('bobot', sa.Numeric(precision=5, scale=2), nullable=True))


def downgrade() -> None:
    op.drop_column('jenis_evaluasi', 'bobot')
    op.drop_column('rps', 'sumber_dokumen_rag')
    op.drop_column('rps', 'konten')
    op.drop_column('mahasiswa', 'angkatan')

