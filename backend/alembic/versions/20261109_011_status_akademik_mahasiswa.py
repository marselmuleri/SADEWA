"""Status keaktifan akademik mahasiswa (Aktif/Cuti/Non-Aktif/Lulus/Keluar)

Revision ID: 20261109_011
Revises: 20261109_010
Create Date: 2026-11-09 21:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = '20261109_011'
down_revision: Union[str, Sequence[str], None] = '20261109_010'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'mahasiswa',
        sa.Column('status_akademik', sa.String(20), nullable=False, server_default='Aktif'),
    )


def downgrade() -> None:
    op.drop_column('mahasiswa', 'status_akademik')
