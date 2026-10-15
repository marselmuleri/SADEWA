"""Langkah 3: Nilai per IK, Skala Nilai Huruf, dan Finalisasi Hasil Evaluasi

Revision ID: 20261015_001
Revises: None
Create Date: 2026-10-15 16:30:00.000000

Empat (4) Tahap Migrasi yang Aman dan Dapat Dibalik:
---------------------------------------------------
Tahap 1: Persiapan Skema Baru & Tabel Arsip (Non-breaking)
  - Buat tabel `skala_nilai` untuk skala huruf per kurikulum.
  - Buat tabel `nilai_bentuk_penilaian_legacy` untuk menyimpan data nilai lama
    yang tidak memiliki relasi matriks bentuk_penilaian x IK.
  - Tambah kolom `ik_id` (nullable=True) pada `nilai_bentuk_penilaian`.
  - Tambah kolom `kurikulum_version_id`, `is_final`, `finalized_at`, `finalized_by`
    pada `hasil_evaluasi`, serta jadikan `peserta_mata_kuliah_id` nullable.

Tahap 2: Backfill Data (Data Migration & Preservation)
  - Untuk baris `nilai_bentuk_penilaian` yang belum memiliki `ik_id`:
    a. Jika komponen penilaian memiliki mapping IK di `mk_bentuk_penilaian_ik_map` (bobot > 0):
       Duplikasi baris nilai untuk setiap `ik_id` terkait.
    b. Jika komponen penilaian TIDAK memiliki mapping IK:
       Pindahkan (arsipkan) baris nilai tersebut ke tabel `nilai_bentuk_penilaian_legacy`
       agar histori nilai tidak hilang dan admin dapat memverifikasi/memetakan ulang.
  - Hapus baris lama yang `ik_id IS NULL` dari `nilai_bentuk_penilaian`.

Tahap 3: Penegakan Constraint (Hardening)
  - Ubah kolom `ik_id` pada `nilai_bentuk_penilaian` menjadi `nullable=False`.
  - Buat ForeignKey ke tabel `ik(id)`.
  - Buat UniqueConstraint (`uq_nilai_peserta_bentuk_ik`) untuk kombinasi
    (`peserta_mata_kuliah_id`, `mk_bentuk_penilaian_id`, `ik_id`).

Tahap 4: Downgrade / Rollback yang Aman
  - Hapus UniqueConstraint dan ForeignKey pada `ik_id`.
  - Untuk setiap kombinasi peserta x bentuk penilaian, ambil satu record representatif (DISTINCT ON).
  - Kembalikan data dari `nilai_bentuk_penilaian_legacy` ke `nilai_bentuk_penilaian`.
  - Hapus kolom `ik_id`.
  - Hapus kolom tambahan pada `hasil_evaluasi`.
  - Hapus tabel `skala_nilai` dan `nilai_bentuk_penilaian_legacy`.
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20261015_001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # =========================================================================
    # TAHAP 1: Buat Tabel Baru & Tambah Kolom Nullable
    # =========================================================================
    
    # 1. Tabel skala_nilai
    op.create_table(
        'skala_nilai',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('kurikulum_version_id', sa.BigInteger(), nullable=False),
        sa.Column('huruf', sa.String(length=5), nullable=False),
        sa.Column('batas_min', sa.Numeric(precision=5, scale=2), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['kurikulum_version_id'], ['kurikulum_versions.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('kurikulum_version_id', 'huruf', name='uq_skala_nilai_kurikulum_huruf')
    )
    op.create_index('ix_skala_nilai_kurikulum_version_id', 'skala_nilai', ['kurikulum_version_id'], unique=False)

    # 2. Tabel arsip nilai_bentuk_penilaian_legacy
    op.create_table(
        'nilai_bentuk_penilaian_legacy',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('original_id', sa.BigInteger(), nullable=True),
        sa.Column('peserta_mata_kuliah_id', sa.BigInteger(), nullable=False),
        sa.Column('mk_bentuk_penilaian_id', sa.BigInteger(), nullable=False),
        sa.Column('nilai', sa.Numeric(precision=5, scale=2), nullable=False),
        sa.Column('alasan', sa.String(length=255), nullable=True),
        sa.Column('archived_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )

    # 3. Kolom hasil_evaluasi
    op.add_column('hasil_evaluasi', sa.Column('kurikulum_version_id', sa.BigInteger(), nullable=True))
    op.add_column('hasil_evaluasi', sa.Column('is_final', sa.Boolean(), server_default='false', nullable=False))
    op.add_column('hasil_evaluasi', sa.Column('finalized_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('hasil_evaluasi', sa.Column('finalized_by', sa.BigInteger(), nullable=True))
    op.create_foreign_key('fk_hasil_evaluasi_kurikulum_version', 'hasil_evaluasi', 'kurikulum_versions', ['kurikulum_version_id'], ['id'], ondelete='SET NULL')
    op.create_foreign_key('fk_hasil_evaluasi_finalized_by', 'hasil_evaluasi', 'users', ['finalized_by'], ['id'], ondelete='SET NULL')
    op.alter_column('hasil_evaluasi', 'peserta_mata_kuliah_id', nullable=True)

    # 4. Tambah kolom ik_id (nullable) di nilai_bentuk_penilaian
    op.add_column('nilai_bentuk_penilaian', sa.Column('ik_id', sa.BigInteger(), nullable=True))

    # =========================================================================
    # TAHAP 2: Backfill Data
    # =========================================================================
    
    # a. Arsipkan baris yang tidak memiliki mapping IK pada matriks bentuk penilaian
    op.execute("""
        INSERT INTO nilai_bentuk_penilaian_legacy (original_id, peserta_mata_kuliah_id, mk_bentuk_penilaian_id, nilai, alasan)
        SELECT n.id, n.peserta_mata_kuliah_id, n.mk_bentuk_penilaian_id, n.nilai, 'Bentuk penilaian belum memiliki relasi IK di matriks bobot'
        FROM nilai_bentuk_penilaian n
        WHERE n.ik_id IS NULL
          AND NOT EXISTS (
              SELECT 1 FROM mk_bentuk_penilaian_ik_map m
              WHERE m.mk_bentuk_penilaian_id = n.mk_bentuk_penilaian_id
                AND m.bobot > 0
          );
    """)

    # Hapus baris yang telah diarsipkan
    op.execute("""
        DELETE FROM nilai_bentuk_penilaian
        WHERE id IN (
            SELECT original_id FROM nilai_bentuk_penilaian_legacy WHERE original_id IS NOT NULL
        );
    """)

    # b. Duplikasi baris nilai untuk setiap IK yang memiliki bobot > 0 pada bentuk penilaian tersebut
    op.execute("""
        INSERT INTO nilai_bentuk_penilaian (peserta_mata_kuliah_id, mk_bentuk_penilaian_id, ik_id, nilai, created_at, updated_at)
        SELECT n.peserta_mata_kuliah_id, n.mk_bentuk_penilaian_id, m.ik_id, n.nilai, NOW(), NOW()
        FROM nilai_bentuk_penilaian n
        JOIN mk_bentuk_penilaian_ik_map m ON n.mk_bentuk_penilaian_id = m.mk_bentuk_penilaian_id
        WHERE n.ik_id IS NULL
          AND m.bobot > 0;
    """)

    # Hapus baris lama yang ik_id nya masih NULL (karena sudah digantikan oleh baris hasil join di atas)
    op.execute("""
        DELETE FROM nilai_bentuk_penilaian WHERE ik_id IS NULL;
    """)

    # =========================================================================
    # TAHAP 3: Penegakan Constraint (NOT NULL, FK, Unique)
    # =========================================================================
    op.alter_column('nilai_bentuk_penilaian', 'ik_id', nullable=False)
    op.create_foreign_key(
        'fk_nilai_bentuk_penilaian_ik_id',
        'nilai_bentuk_penilaian',
        'ik',
        ['ik_id'],
        ['id'],
        ondelete='RESTRICT'
    )
    op.create_unique_constraint(
        'uq_nilai_peserta_bentuk_ik',
        'nilai_bentuk_penilaian',
        ['peserta_mata_kuliah_id', 'mk_bentuk_penilaian_id', 'ik_id']
    )


def downgrade():
    # =========================================================================
    # TAHAP 4: Rollback
    # =========================================================================
    
    # Drop constraints
    op.drop_constraint('uq_nilai_peserta_bentuk_ik', 'nilai_bentuk_penilaian', type_='unique')
    op.drop_constraint('fk_nilai_bentuk_penilaian_ik_id', 'nilai_bentuk_penilaian', type_='foreignkey')

    # Collapse records back (PostgreSQL DISTINCT ON)
    op.execute("""
        CREATE TEMP TABLE tmp_collapsed_nilai AS
        SELECT DISTINCT ON (peserta_mata_kuliah_id, mk_bentuk_penilaian_id)
            peserta_mata_kuliah_id, mk_bentuk_penilaian_id, nilai
        FROM nilai_bentuk_penilaian;

        DELETE FROM nilai_bentuk_penilaian;

        INSERT INTO nilai_bentuk_penilaian (peserta_mata_kuliah_id, mk_bentuk_penilaian_id, nilai)
        SELECT peserta_mata_kuliah_id, mk_bentuk_penilaian_id, nilai FROM tmp_collapsed_nilai;

        -- Kembalikan dari tabel arsip legacy
        INSERT INTO nilai_bentuk_penilaian (peserta_mata_kuliah_id, mk_bentuk_penilaian_id, nilai)
        SELECT peserta_mata_kuliah_id, mk_bentuk_penilaian_id, nilai FROM nilai_bentuk_penilaian_legacy;

        DROP TABLE tmp_collapsed_nilai;
    """)

    # Drop column ik_id
    op.drop_column('nilai_bentuk_penilaian', 'ik_id')

    # Drop table legacy
    op.drop_table('nilai_bentuk_penilaian_legacy')

    # Drop hasil_evaluasi columns
    op.drop_constraint('fk_hasil_evaluasi_finalized_by', 'hasil_evaluasi', type_='foreignkey')
    op.drop_constraint('fk_hasil_evaluasi_kurikulum_version', 'hasil_evaluasi', type_='foreignkey')
    op.drop_column('hasil_evaluasi', 'finalized_by')
    op.drop_column('hasil_evaluasi', 'finalized_at')
    op.drop_column('hasil_evaluasi', 'is_final')
    op.drop_column('hasil_evaluasi', 'kurikulum_version_id')

    # Drop skala_nilai
    op.drop_index('ix_skala_nilai_kurikulum_version_id', table_name='skala_nilai')
    op.drop_table('skala_nilai')

