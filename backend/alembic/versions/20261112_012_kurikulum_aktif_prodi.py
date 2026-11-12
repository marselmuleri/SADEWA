"""Kurikulum aktif per prodi (dipakai Analitik OBE, ditetapkan Admin Prodi)

Revision ID: 20261112_012
Revises: 20261109_011
Create Date: 2026-11-12 10:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = '20261112_012'
down_revision: Union[str, Sequence[str], None] = '20261109_011'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('program_studi', sa.Column('kurikulum_aktif_id', sa.BigInteger(), nullable=True))
    op.create_foreign_key(
        'fk_program_studi_kurikulum_aktif', 'program_studi', 'kurikulum_versions',
        ['kurikulum_aktif_id'], ['id'], ondelete='SET NULL',
    )
    # Isi awal: versi published yang paling banyak dipakai mata kuliah prodi,
    # lalu versi published terbaru. Admin Prodi tetap bisa mengubahnya.
    op.execute("""
        UPDATE program_studi ps
        SET kurikulum_aktif_id = (
            SELECT kv.id
            FROM kurikulum_versions kv
            LEFT JOIN mata_kuliah mk ON mk.kurikulum_version_id = kv.id
            WHERE kv.program_studi_id = ps.id AND kv.status = 'published'
            GROUP BY kv.id, kv.published_at
            ORDER BY COUNT(mk.id) DESC, kv.published_at DESC NULLS LAST, kv.id DESC
            LIMIT 1
        )
    """)


def downgrade() -> None:
    op.drop_constraint('fk_program_studi_kurikulum_aktif', 'program_studi', type_='foreignkey')
    op.drop_column('program_studi', 'kurikulum_aktif_id')
