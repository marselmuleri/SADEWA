from __future__ import annotations

try:
    # LangChain 1.x memindahkan prompt primitives ke langchain_core.
    from langchain_core.prompts import PromptTemplate
except ImportError:  # kompatibilitas dengan LangChain 0.x
    from langchain.prompts import PromptTemplate
from langchain_google_genai import ChatGoogleGenerativeAI
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.cpl import CPL
from app.models.hasil_prediksi import HasilPrediksi
from app.models.mahasiswa import Mahasiswa
from app.models.penilaian import Penilaian
from app.models.rekomendasi_llm import RekomendasiLLM

SYSTEM_PROMPT = (
    "Kamu adalah SADEWA AI, asisten cerdas untuk analisis Outcome-Based Education. "
    "Tugasmu membantu dosen dan kaprodi menganalisis capaian pembelajaran mahasiswa "
    "berdasarkan data prediksi Random Forest. Berikan analisis yang akademis, "
    "konkret, dan berikan rekomendasi intervensi yang actionable."
)

PROMPT_TEMPLATE = PromptTemplate.from_template(
    """
{system_prompt}

Berikut data mahasiswa [{nama_mahasiswa}]: {context_json}
Pertanyaan dosen: {pertanyaan}

Jawab dalam Bahasa Indonesia yang jelas, ringkas, dan actionable.
""".strip()
)


def build_context(db: Session, mahasiswa_id: int | None = None, mata_kuliah_id: int | None = None):
    context = {}
    if mahasiswa_id:
        mhs = db.query(Mahasiswa).filter(Mahasiswa.id == mahasiswa_id).first()
        if mhs:
            context["mahasiswa"] = {"id": mhs.id, "nim": mhs.nim, "nama": mhs.nama}

        nilai_query = db.query(Penilaian).filter(Penilaian.mahasiswa_id == mahasiswa_id)
        if mata_kuliah_id:
            nilai_query = nilai_query.filter(Penilaian.mata_kuliah_id == mata_kuliah_id)
        context["nilai"] = [
            {
                "mata_kuliah_id": n.mata_kuliah_id,
                "jenis": n.jenis.value,
                "nilai": n.nilai,
                "semester": n.semester,
                "tahun_akademik": n.tahun_akademik,
            }
            for n in nilai_query.all()
        ]

        pred_query = db.query(HasilPrediksi).filter(HasilPrediksi.mahasiswa_id == mahasiswa_id)
        if mata_kuliah_id:
            pred_query = pred_query.filter(HasilPrediksi.mata_kuliah_id == mata_kuliah_id)
        context["prediksi"] = [
            {
                "cpl_id": p.cpl_id,
                "probabilitas_lulus": p.probabilitas_lulus,
                "prediksi": p.prediksi,
            }
            for p in pred_query.all()
        ]

    context["cpl"] = [{"id": c.id, "kode": c.kode_cpl, "deskripsi": c.deskripsi} for c in db.query(CPL).all()]
    return context


def ask_llm(db: Session, pertanyaan: str, mahasiswa_id: int | None = None, mata_kuliah_id: int | None = None):
    context = build_context(db, mahasiswa_id=mahasiswa_id, mata_kuliah_id=mata_kuliah_id)
    nama = context.get("mahasiswa", {}).get("nama", "umum")

    prompt_text = PROMPT_TEMPLATE.format(
        system_prompt=SYSTEM_PROMPT,
        nama_mahasiswa=nama,
        context_json=context,
        pertanyaan=pertanyaan,
    )

    if settings.GEMINI_API_KEY:
        llm = ChatGoogleGenerativeAI(model="gemini-1.5-flash", google_api_key=settings.GEMINI_API_KEY, temperature=0.2)
        response = llm.invoke(prompt_text)
        content = response.content if hasattr(response, "content") else str(response)
    else:
        content = "GEMINI_API_KEY belum diset. Ini respons fallback: fokuskan intervensi pada nilai UTS/UAS dan monitoring berkala."

    row = RekomendasiLLM(
        mahasiswa_id=mahasiswa_id,
        pertanyaan=pertanyaan,
        respons_llm=content,
        context_data=context,
    )
    db.add(row)
    db.commit()

    return {"respons": content, "context_yang_digunakan": context}
