from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import AcademicScope, get_academic_scope, require_roles
from app.models.enums import UserRole
from app.models.program_studi import ProgramStudi
from app.models.range_nilai_cpl import RangeNilaiCPL
from app.models.user import User
from app.schemas.range_nilai_cpl import RangeNilaiCPLBatchRequest, RangeNilaiCPLResponse

router = APIRouter()


@router.get("/{prodi_id}/range-nilai-cpl", response_model=list[RangeNilaiCPLResponse])
def get_range_nilai_cpl(
    prodi_id: int,
    db: Session = Depends(get_db),
    scope: AcademicScope = Depends(get_academic_scope),
):
    prodi = db.query(ProgramStudi).filter(ProgramStudi.id == prodi_id).first()
    if not prodi:
        raise HTTPException(status_code=404, detail="Program studi tidak ditemukan")

    if scope.program_studi_id and prodi_id != scope.program_studi_id:
        raise HTTPException(status_code=403, detail="Program studi ini di luar prodi Anda")
    if scope.fakultas_id and prodi.fakultas_id != scope.fakultas_id:
        raise HTTPException(status_code=403, detail="Program studi ini di luar fakultas Anda")

    ranges = (
        db.query(RangeNilaiCPL)
        .filter(RangeNilaiCPL.program_studi_id == prodi_id)
        .order_by(RangeNilaiCPL.batas_bawah.desc())
        .all()
    )
    return ranges


@router.post("/{prodi_id}/range-nilai-cpl", response_model=list[RangeNilaiCPLResponse], status_code=status.HTTP_201_CREATED)
def atur_range_nilai_cpl(
    prodi_id: int,
    payload: RangeNilaiCPLBatchRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.admin_prodi, UserRole.kaprodi)),
):
    prodi = db.query(ProgramStudi).filter(ProgramStudi.id == prodi_id).first()
    if not prodi:
        raise HTTPException(status_code=404, detail="Program studi tidak ditemukan")

    if user.role in (UserRole.admin_prodi, UserRole.kaprodi):
        if prodi_id != user.program_studi_id:
            raise HTTPException(status_code=403, detail="Program studi ini di luar wewenang Anda")

    items = payload.ranges
    if not items:
        raise HTTPException(status_code=400, detail="Daftar range tidak boleh kosong")

    # 1. Validasi setiap rentang dan rentang 0..100
    seen_nama: set[str] = set()
    cleaned = []
    for item in items:
        bawah = Decimal(str(item.batas_bawah))
        atas = Decimal(str(item.batas_atas))

        if bawah < Decimal("0") or bawah > Decimal("100") or atas < Decimal("0") or atas > Decimal("100"):
            raise HTTPException(status_code=400, detail="Batas nilai harus berada dalam rentang 0 sampai 100")

        if bawah >= atas:
            raise HTTPException(status_code=400, detail=f"Batas bawah ({bawah}) harus lebih kecil dari batas atas ({atas})")

        nama_clean = item.nama.strip()
        if not nama_clean:
            raise HTTPException(status_code=400, detail="Nama kategori tidak boleh kosong")
        if nama_clean.lower() in seen_nama:
            raise HTTPException(status_code=400, detail=f"Duplikat nama kategori '{nama_clean}' dalam satu prodi")
        seen_nama.add(nama_clean.lower())

        cleaned.append({
            "nama": nama_clean,
            "batas_bawah": bawah,
            "batas_atas": atas,
            "warna": item.warna,
            "keterangan": item.keterangan,
        })

    # 2. Validasi overlap (tumpang tindih)
    # Urutkan berdasarkan batas_bawah naik
    sorted_ranges = sorted(cleaned, key=lambda x: x["batas_bawah"])
    for i in range(1, len(sorted_ranges)):
        prev_atas = sorted_ranges[i - 1]["batas_atas"]
        curr_bawah = sorted_ranges[i]["batas_bawah"]
        if curr_bawah < prev_atas:
            raise HTTPException(
                status_code=400,
                detail=f"Rentang '{sorted_ranges[i]['nama']}' ({curr_bawah} - {sorted_ranges[i]['batas_atas']}) tumpang tindih dengan rentang '{sorted_ranges[i-1]['nama']}' ({sorted_ranges[i-1]['batas_bawah']} - {prev_atas})"
            )

    # 3. Hapus dan simpan ulang (atomic replace)
    db.query(RangeNilaiCPL).filter(RangeNilaiCPL.program_studi_id == prodi_id).delete()
    created = []
    for r in cleaned:
        obj = RangeNilaiCPL(
            program_studi_id=prodi_id,
            nama=r["nama"],
            batas_bawah=r["batas_bawah"],
            batas_atas=r["batas_atas"],
            warna=r["warna"],
            keterangan=r["keterangan"],
        )
        db.add(obj)
        created.append(obj)

    db.commit()
    for obj in created:
        db.refresh(obj)

    created.sort(key=lambda x: x.batas_bawah, reverse=True)
    return created

