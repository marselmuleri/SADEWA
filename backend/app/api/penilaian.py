import io
import pandas as pd
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.cpmk import CPMK
from app.models.mahasiswa import Mahasiswa
from app.models.penilaian import Penilaian
from app.models.user import User
from app.schemas.penilaian import PenilaianCreate, PenilaianResponse, PenilaianUpdate

router = APIRouter()


@router.post("", response_model=PenilaianResponse)
def create_penilaian(payload: PenilaianCreate, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    data = Penilaian(**payload.model_dump())
    db.add(data)
    db.commit()
    db.refresh(data)
    return data


@router.get("", response_model=list[PenilaianResponse])
def list_penilaian(
    mahasiswa_id: int | None = Query(default=None),
    mk_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    query = db.query(Penilaian)
    if mahasiswa_id:
        query = query.filter(Penilaian.mahasiswa_id == mahasiswa_id)
    if mk_id:
        query = query.filter(Penilaian.mata_kuliah_id == mk_id)
    return query.order_by(Penilaian.id.desc()).all()


@router.get("/{mahasiswa_id}", response_model=list[PenilaianResponse])
def get_penilaian_mahasiswa(mahasiswa_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(Penilaian).filter(Penilaian.mahasiswa_id == mahasiswa_id).order_by(Penilaian.id.desc()).all()


@router.put("/{penilaian_id}", response_model=PenilaianResponse)
def update_penilaian(penilaian_id: int, payload: PenilaianUpdate, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    data = db.query(Penilaian).filter(Penilaian.id == penilaian_id).first()
    if not data:
        raise HTTPException(status_code=404, detail="Data penilaian tidak ditemukan")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(data, key, value)
    db.commit()
    db.refresh(data)
    return data


@router.delete("/{penilaian_id}")
def delete_penilaian(penilaian_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    data = db.query(Penilaian).filter(Penilaian.id == penilaian_id).first()
    if not data:
        raise HTTPException(status_code=404, detail="Data penilaian tidak ditemukan")
    db.delete(data)
    db.commit()
    return {"message": "Penilaian dihapus"}


@router.post("/import")
@router.post("/import-csv")
def import_csv(file: UploadFile = File(...), db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="File harus CSV")
    content = file.file.read()
    df = pd.read_csv(io.BytesIO(content))
    rows = df.to_dict(orient="records")
    inserted, failed = 0, 0
    failures = []
    for idx, row in enumerate(rows, start=1):
        try:
            if {"nim", "cpmk_kode", "jenis", "nilai", "semester", "tahun_akademik"}.issubset(df.columns):
                mhs = db.query(Mahasiswa).filter(Mahasiswa.nim == str(row["nim"]), Mahasiswa.is_active.is_(True)).first()
                cpmk = db.query(CPMK).filter(CPMK.kode_cpmk == str(row["cpmk_kode"])).first()
                if not mhs or not cpmk:
                    raise ValueError("nim atau cpmk_kode tidak valid")
                payload = {
                    "mahasiswa_id": mhs.id,
                    "mata_kuliah_id": cpmk.mata_kuliah_id,
                    "cpmk_id": cpmk.id,
                    "jenis": str(row["jenis"]).lower(),
                    "nilai": float(row["nilai"]),
                    "semester": str(row["semester"]),
                    "tahun_akademik": str(row["tahun_akademik"]),
                }
            else:
                payload = {
                    "mahasiswa_id": int(row["mahasiswa_id"]),
                    "mata_kuliah_id": int(row["mata_kuliah_id"]),
                    "cpmk_id": int(row["cpmk_id"]),
                    "jenis": str(row["jenis"]).lower(),
                    "nilai": float(row["nilai"]),
                    "semester": str(row["semester"]),
                    "tahun_akademik": str(row["tahun_akademik"]),
                }
            data = Penilaian(**payload)
            db.add(data)
            inserted += 1
        except Exception as exc:
            failed += 1
            failures.append({"baris": idx, "error": str(exc)})
    db.commit()
    return {"message": "Import selesai", "berhasil": inserted, "gagal": failed, "detail_gagal": failures[:20]}
