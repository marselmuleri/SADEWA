"""Tabel arsip_kurikulum (Data Master: snapshot kurikulum saat publish dan tutup semester)

Revision ID: 20261108_007
Revises: 20261108_006
Create Date: 2026-11-08 23:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = '20261108_007'
down_revision: Union[str, Sequence[str], None] = '20261108_006'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    semester_enum = sa.Enum('Ganjil', 'Genap', name='semester_arsip_enum')
    op.create_table(
        'arsip_kurikulum',
        sa.Column('id', sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('program_studi_id', sa.BigInteger(), sa.ForeignKey('program_studi.id'), nullable=False),
        sa.Column('jenis', sa.String(30), nullable=False),
        sa.Column('kurikulum_version_id', sa.BigInteger(), sa.ForeignKey('kurikulum_versions.id'), nullable=True),
        sa.Column('semester', semester_enum, nullable=True),
        sa.Column('tahun_ajaran', sa.String(), nullable=True),
        sa.Column('judul', sa.String(255), nullable=False),
        sa.Column('ringkasan', sa.JSON(), nullable=True),
        sa.Column('data', sa.JSON(), nullable=False),
        sa.Column('dibuat_oleh', sa.BigInteger(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(), server_default=sa.func.now()),
    )
    op.create_index('ix_arsip_kurikulum_program_studi_id', 'arsip_kurikulum', ['program_studi_id'])
    op.create_index('ix_arsip_kurikulum_kurikulum_version_id', 'arsip_kurikulum', ['kurikulum_version_id'])
    op.create_index('ix_arsip_kurikulum_created_at', 'arsip_kurikulum', ['created_at'])


def downgrade() -> None:
    op.drop_index('ix_arsip_kurikulum_created_at', table_name='arsip_kurikulum')
    op.drop_index('ix_arsip_kurikulum_kurikulum_version_id', table_name='arsip_kurikulum')
    op.drop_index('ix_arsip_kurikulum_program_studi_id', table_name='arsip_kurikulum')
    op.drop_table('arsip_kurikulum')
    sa.Enum(name='semester_arsip_enum').drop(op.get_bind(), checkfirst=True)
