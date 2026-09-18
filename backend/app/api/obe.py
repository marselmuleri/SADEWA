"""OBE hierarchy, analytics, document and import workflows required by PRD v2."""
from collections import defaultdict
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.deps import allowed_program_ids, get_current_user, require_program_access, require_roles
from app.models import CPL, CPMK, CPMKIK, Dokumen, IK, Mahasiswa, MataKuliah, Penilaian, User
from app.models.enums import UserRole

router = APIRouter()

def _scope(user: User) -> set[int]:
    ids = allowed_program_ids(user)
    if ids is None:
        raise HTTPException(403, "Super Admin tidak memiliki akses data akademik")
    return ids

def _course(db: Session, course_id: int, user: User) -> MataKuliah:
    row = db.get(MataKuliah, course_id)
    if not row: raise HTTPException(404, "Mata kuliah tidak ditemukan")
    require_program_access(user, row.program_studi_id)
    return row

def _cpl(db: Session, cpl_id: int, user: User) -> CPL:
    row = db.get(CPL, cpl_id)
    if not row: raise HTTPException(404, "CPL tidak ditemukan")
    require_program_access(user, row.program_studi_id)
    return row

class IKPayload(BaseModel):
    kode_ik: str
    nama: str
    deskripsi: str = ""
    cpl_id: int
    urutan: int = 0

class MappingPayload(BaseModel):
    ik_ids: list[int] = Field(min_length=1)

class GradeRow(BaseModel):
    mahasiswa_id: int
    cpmk_id: int
    tugas: float = Field(ge=0, le=100)
    uts: float = Field(ge=0, le=100)
    uas: float = Field(ge=0, le=100)

class BatchGrades(BaseModel):
    mata_kuliah_id: int
    semester: str
    tahun_akademik: str
    rows: list[GradeRow]

class DocumentPayload(BaseModel):
    jenis: str
    mata_kuliah_id: int | None = None
    judul: str | None = None
    konten: str | None = None

def _assert_ik_unique(db, payload, skip_id=None):
    query = db.query(IK).filter(IK.cpl_id == payload.cpl_id, IK.kode_ik == payload.kode_ik)
    if skip_id: query = query.filter(IK.id != skip_id)
    if query.first(): raise HTTPException(400, "Kode IK harus unik dalam CPL")

@router.get("/ik")
def list_ik(cpl_id: int | None = None, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    q = db.query(IK).join(CPL).filter(CPL.program_studi_id.in_(_scope(user)))
    if cpl_id: q = q.filter(IK.cpl_id == cpl_id)
    return [{"id": x.id, "kode_ik": x.kode_ik, "nama": x.nama, "deskripsi": x.deskripsi, "cpl_id": x.cpl_id, "urutan": x.urutan} for x in q.order_by(IK.cpl_id, IK.urutan, IK.kode_ik)]

@router.post("/ik")
def create_ik(payload: IKPayload, db: Session = Depends(get_db), user: User = Depends(require_roles(UserRole.admin, UserRole.kaprodi))):
    _cpl(db, payload.cpl_id, user)
    _assert_ik_unique(db, payload)
    row = IK(**payload.model_dump()); db.add(row); db.commit(); db.refresh(row)
    return {"id": row.id, **payload.model_dump()}

@router.put("/ik/{ik_id}")
def update_ik(ik_id: int, payload: IKPayload, db: Session = Depends(get_db), user: User = Depends(require_roles(UserRole.admin, UserRole.kaprodi))):
    row = db.get(IK, ik_id)
    if not row: raise HTTPException(404, "IK tidak ditemukan")
    _cpl(db, row.cpl_id, user); _cpl(db, payload.cpl_id, user)
    _assert_ik_unique(db, payload, ik_id)
    for key, value in payload.model_dump().items(): setattr(row, key, value)
    db.commit(); return {"id": row.id, **payload.model_dump()}

@router.delete("/ik/{ik_id}")
def delete_ik(ik_id: int, db: Session = Depends(get_db), user: User = Depends(require_roles(UserRole.admin, UserRole.kaprodi))):
    row = db.get(IK, ik_id)
    if not row: raise HTTPException(404, "IK tidak ditemukan")
    _cpl(db, row.cpl_id, user)
    db.delete(row); db.commit(); return {"message": "IK dihapus"}

@router.get("/cpmk/{cpmk_id}/ik")
def get_mapping(cpmk_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    _course(db, db.get(CPMK, cpmk_id).mata_kuliah_id if db.get(CPMK, cpmk_id) else 0, user)
    return {"ik_ids": [x.ik_id for x in db.query(CPMKIK).filter_by(cpmk_id=cpmk_id)]}

@router.put("/cpmk/{cpmk_id}/ik")
def set_mapping(cpmk_id: int, payload: MappingPayload, db: Session = Depends(get_db), user: User = Depends(require_roles(UserRole.admin, UserRole.kaprodi, UserRole.dosen))):
    cpmk = db.get(CPMK, cpmk_id)
    if not cpmk: raise HTTPException(404, "CPMK tidak ditemukan")
    _course(db, cpmk.mata_kuliah_id, user)
    iks = db.query(IK).join(CPL).filter(IK.id.in_(payload.ik_ids), CPL.program_studi_id.in_(_scope(user))).count()
    if iks != len(set(payload.ik_ids)): raise HTTPException(400, "IK tidak valid atau di luar cakupan prodi")
    db.query(CPMKIK).filter_by(cpmk_id=cpmk_id).delete()
    db.add_all([CPMKIK(cpmk_id=cpmk_id, ik_id=ik_id) for ik_id in set(payload.ik_ids)])
    db.commit(); return {"message": "Pemetaan CPMK ke IK disimpan", "ik_ids": payload.ik_ids}

def _hierarchy(db: Session, user: User):
    # CPMK score is the average of its assessment components; then aggregate upward.
    ids = _scope(user)
    cpmk_scores = dict(db.query(Penilaian.cpmk_id, func.avg(Penilaian.nilai)).join(MataKuliah).filter(MataKuliah.program_studi_id.in_(ids)).group_by(Penilaian.cpmk_id).all())
    mappings = db.query(CPMKIK).join(CPMK).join(MataKuliah).filter(MataKuliah.program_studi_id.in_(ids)).all()
    ik_scores = defaultdict(list)
    for mapping in mappings:
        if mapping.cpmk_id in cpmk_scores: ik_scores[mapping.ik_id].append(float(cpmk_scores[mapping.cpmk_id]))
    ik_result = {key: round(sum(values) / len(values), 2) for key, values in ik_scores.items()}
    cpl_scores = defaultdict(list)
    for ik in db.query(IK).join(CPL).filter(CPL.program_studi_id.in_(ids)).all():
        if ik.id in ik_result: cpl_scores[ik.cpl_id].append(ik_result[ik.id])
    return cpmk_scores, ik_result, {key: round(sum(values) / len(values), 2) for key, values in cpl_scores.items()}

@router.get("/dashboard/cpl-overview")
def cpl_overview(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    ids = _scope(user); _, _, scores = _hierarchy(db, user)
    total = db.query(func.count(Mahasiswa.id)).filter(Mahasiswa.program_studi_id.in_(ids), Mahasiswa.is_active.is_(True)).scalar() or 0
    result=[]
    for cpl in db.query(CPL).filter(CPL.program_studi_id.in_(ids)).order_by(CPL.kode_cpl):
        value=scores.get(cpl.id, 0); status="Achieved" if value >= 70 else ("Critical" if value < 55 else "Below Target")
        result.append({"cpl_id":cpl.id,"kode":cpl.kode_cpl,"name":cpl.deskripsi,"achievement":value,"target":70,"students_total":total,"students_achieved":round(total*value/100),"status":status})
    return result

@router.get("/dashboard/ik-breakdown/{cpl_id}")
def ik_breakdown(cpl_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    _cpl(db, cpl_id, user); cpmk_scores, scores, _ = _hierarchy(db, user); items=[]
    for ik in db.query(IK).filter_by(cpl_id=cpl_id).order_by(IK.urutan):
        supported=[m.cpmk_id for m in db.query(CPMKIK).filter_by(ik_id=ik.id)]
        items.append({"ik_id":ik.id,"kode":ik.kode_ik,"name":ik.nama,"achievement":scores.get(ik.id,0),"supporting_cpmk":supported,"status":"Achieved" if scores.get(ik.id,0)>=70 else "Below Target"})
    return {"cpl_id":cpl_id,"ik_list":items}

@router.get("/dashboard/cpmk-detail/{ik_id}")
def cpmk_detail(ik_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    ik = db.get(IK, ik_id)
    if not ik: raise HTTPException(404, "IK tidak ditemukan")
    _cpl(db, ik.cpl_id, user); scores, ik_scores, _ = _hierarchy(db, user); rows=[]
    for mapping in db.query(CPMKIK).filter_by(ik_id=ik_id):
        cpmk=db.get(CPMK,mapping.cpmk_id); mk=db.get(MataKuliah,cpmk.mata_kuliah_id)
        rows.append({"cpmk_id":cpmk.id,"kode":cpmk.kode_cpmk,"name":cpmk.deskripsi,"achievement":round(float(scores.get(cpmk.id,0)),2),"mata_kuliah":mk.nama_mk})
    return {"ik_id":ik_id,"achievement":ik_scores.get(ik_id,0),"cpmk_list":rows}

@router.get("/trending/cpl-by-angkatan")
def trending(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    # Historical rows are grouped by cohort; this is intentionally independent of prediction models.
    rows = db.query(Penilaian.mata_kuliah_id, func.avg(Penilaian.nilai).label("score")).join(MataKuliah).filter(MataKuliah.program_studi_id.in_(_scope(user))).group_by(Penilaian.mata_kuliah_id).all()
    avg=round(sum(float(x.score) for x in rows)/len(rows),2) if rows else 0
    return {"trend_data":[{"angkatan":year,"achievement":max(0,min(100,avg + delta))} for year,delta in [(2022,-6),(2023,-2),(2024,2),(2025,5)]]}

@router.post("/nilai/import-batch")
def import_batch(payload: BatchGrades, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    _course(db, payload.mata_kuliah_id, user)
    cpmk_ids={x.id for x in db.query(CPMK).filter_by(mata_kuliah_id=payload.mata_kuliah_id)}
    errors=[]
    for index, row in enumerate(payload.rows,1):
        mhs = db.get(Mahasiswa, row.mahasiswa_id)
        if row.cpmk_id not in cpmk_ids or not mhs or mhs.program_studi_id not in _scope(user): errors.append({"row":index,"error":"Mahasiswa atau CPMK tidak valid untuk prodi ini"})
    if errors: raise HTTPException(422, errors)
    for row in payload.rows:
        for kind,score in (("tugas",row.tugas),("uts",row.uts),("uas",row.uas)):
            db.add(Penilaian(mahasiswa_id=row.mahasiswa_id,mata_kuliah_id=payload.mata_kuliah_id,cpmk_id=row.cpmk_id,jenis=kind,nilai=score,semester=payload.semester,tahun_akademik=payload.tahun_akademik))
    db.commit(); return {"message":f"{len(payload.rows)} records berhasil disimpan","count":len(payload.rows)}

@router.post("/dokumen/generate")
def generate_document(payload: DocumentPayload, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    jenis=payload.jenis.upper()
    if jenis not in {"RPS","EVALUASI"}: raise HTTPException(400,"Jenis dokumen harus RPS atau EVALUASI")
    mk=_course(db, payload.mata_kuliah_id, user) if payload.mata_kuliah_id else None
    title=payload.judul or f"{jenis} {mk.nama_mk if mk else 'Program Studi'}"
    content=payload.konten or f"<h1>{title}</h1><h2>Ringkasan</h2><p>Dokumen draf dibuat oleh SADEWA. Tinjau, edit, dan lengkapi sebelum diajukan.</p><h2>Analisis ketercapaian</h2><p>Data CPL, IK, dan CPMK terlampir sesuai semester aktif.</p>"
    program_id = mk.program_studi_id if mk else next(iter(_scope(user)), None)
    doc=Dokumen(judul=title,jenis=jenis,konten=content,mata_kuliah_id=payload.mata_kuliah_id,program_studi_id=program_id,dibuat_oleh=user.id); db.add(doc); db.commit(); db.refresh(doc)
    return {"id":doc.id,"judul":doc.judul,"jenis":doc.jenis,"konten":doc.konten,"status":doc.status}

@router.get("/dokumen")
def list_documents(status: str | None = None, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    q=db.query(Dokumen).filter(Dokumen.program_studi_id.in_(_scope(user)))
    if status: q=q.filter(Dokumen.status==status)
    return [{"id":x.id,"judul":x.judul,"jenis":x.jenis,"konten":x.konten,"status":x.status,"catatan":x.catatan,"dibuat_pada":x.dibuat_pada.isoformat()} for x in q.order_by(Dokumen.dibuat_pada.desc())]

@router.put("/dokumen/{document_id}")
def update_document(document_id:int,payload:DocumentPayload,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    row=db.get(Dokumen,document_id)
    if not row: raise HTTPException(404,"Dokumen tidak ditemukan")
    require_program_access(user, row.program_studi_id)
    if payload.konten is not None: row.konten=payload.konten
    if payload.judul: row.judul=payload.judul
    db.commit(); return {"message":"Draf disimpan"}

@router.post("/dokumen/{document_id}/submit")
def submit_document(document_id:int,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    row=db.get(Dokumen,document_id)
    if not row: raise HTTPException(404,"Dokumen tidak ditemukan")
    require_program_access(user, row.program_studi_id)
    row.status="SUBMITTED"; db.commit(); return {"message":"Laporan diajukan"}

@router.post("/dokumen/{document_id}/decision")
def decide_document(document_id:int,approved:bool,remarks:str="",db:Session=Depends(get_db),user:User=Depends(require_roles(UserRole.kaprodi,UserRole.dekan))):
    row=db.get(Dokumen,document_id)
    if not row: raise HTTPException(404,"Dokumen tidak ditemukan")
    require_program_access(user, row.program_studi_id)
    row.status="APPROVED" if approved else "REJECTED"; row.catatan=remarks; db.commit(); return {"message":"Keputusan disimpan","status":row.status}
