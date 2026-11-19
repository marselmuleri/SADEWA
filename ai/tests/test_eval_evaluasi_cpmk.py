"""Uji fungsi pemeriksa pada eval/uji_ai.py untuk evaluasi CPMK (tanpa LLM)."""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "eval"))
import uji_ai  # noqa: E402

REQ = {
    "ambang": 70.0, "target_persen": 60.0, "target_rerata_skala": None, "skala_maks": None,
    "cpmk": [
        {"kode": "CPMK 1.1", "rata_rata": 68.4, "persen_tercapai": 55.0,
         "jumlah_mahasiswa": 40, "jumlah_tercapai": 22, "memenuhi": False},
        {"kode": "CPMK 1.2", "rata_rata": 82.5, "persen_tercapai": 90.0,
         "jumlah_mahasiswa": 40, "jumlah_tercapai": 36, "memenuhi": True},
    ],
}


@pytest.mark.parametrize("teks, harap", [
    ("CPMK ini belum memenuhi target 60%.", "belum"),
    ("Capaian berada di bawah target yang ditetapkan.", "belum"),
    ("CPMK ini telah memenuhi target.", "memenuhi"),
    ("Persentase 90% melampaui target.", "memenuhi"),
    ("Sebanyak 22 dari 40 mahasiswa mencapai ambang.", "tidak_jelas"),
    # Frasa tentang sebagian mahasiswa tidak boleh dibaca sebagai status CPMK.
    ("Capaian ini memenuhi target, meskipun masih terdapat mahasiswa yang belum mencapai ambang.", "memenuhi"),
    ("Mayoritas mahasiswa belum memenuhi target kompetensi.", "belum"),
    ("Persentase 59,4%, yang belum memenuhi target 60%.", "belum"),
    ("Sebagian besar mahasiswa belum memenuhi ambang batas kompetensi.", "tidak_jelas"),
    ("Meskipun target ambang 60,0% tercapai, masih perlu ditingkatkan.", "memenuhi"),
    ("Persentase 77.8% melebihi target minimal 60%.", "memenuhi"),
    ("Target ketercapaian ambang sebesar 60.0% terpenuhi.", "memenuhi"),
    ("Sebanyak 85.4% mahasiswa mencapai ambang, sehingga target 60.0% terlampaui.", "memenuhi"),
    ("Target ketercapaian belum tercapai.", "belum"),
    ("CPMK ini tidak memenuhi target karena hanya 25% mahasiswa yang mencapai ambang.", "belum"),
])
def test_klasifikasi_status(teks, harap):
    assert uji_ai.klasifikasi_status(teks) == harap


def test_angka_sah_mencakup_turunan_langsung():
    sah = uji_ai.angka_sah_cpmk(REQ)
    for v in (68.4, 55.0, 45.0, 22.0, 18.0, 1.6, 5.0, 82.5, 90.0, 30.0, 2.0, 1.0):
        assert any(abs(v - s) < 1e-9 for s in sah), v


def test_status_cpmk_terlewat_dihitung_salah():
    data = {"evaluasi": [{"kode": "CPMK 1.1", "analisis": "Belum memenuhi target.", "rencana_perbaikan": "x"}]}
    baris = uji_ai.periksa_status_cpmk(data, REQ)
    assert [(b["status_teks"], b["benar"]) for b in baris] == [("belum", 1), ("terlewat", 0)]


def test_galat_kuota_diulang_dan_tidak_dihitung_gagal(monkeypatch):
    from sadewa_ai import llm_client

    monkeypatch.setattr(uji_ai, "TUNGGU_KUOTA_DETIK", 0)
    monkeypatch.setattr(uji_ai, "JEDA_DETIK", 0)
    panggilan = []

    def generate_palsu(on_event=None, **kw):
        panggilan.append(1)
        if len(panggilan) < 3:
            raise llm_client.LLMRateLimitError("429")
        return {"data": {}, "valid": True, "pelanggaran_validasi": []}

    p, hasil, galat, _ = uji_ai.jalankan(generate_palsu, {})
    assert galat is None and hasil["valid"] and p.ulang_kuota == 2 and len(panggilan) == 3


def test_profil_gpt_non_reasoning(monkeypatch):
    from sadewa_ai.config import settings

    for k, v in {"OPENAI_API_KEY": "x", "OPENAI_BASE_URL": "https://contoh/v1",
                 "OPENAI_MODEL": "openai/gpt-4.1-mini", "OPENAI_REASONING_EFFORT": ""}.items():
        monkeypatch.setenv(k, v)
    asal = (settings.qwen_api_key, settings.qwen_base_url, settings.qwen_model, settings.llm_kirim_enable_thinking)
    try:
        info = uji_ai.terapkan_profil("gpt")
        assert info["reasoning_effort"] is None and info["parameter_batas_token"] == "max_tokens"
        monkeypatch.delenv("OPENAI_REASONING_EFFORT")
        monkeypatch.setattr(uji_ai, "dotenv_values", lambda *_: {})
        info = uji_ai.terapkan_profil("gpt")
        assert info["reasoning_effort"] == "none" and info["parameter_batas_token"] == "max_completion_tokens"
    finally:
        (settings.qwen_api_key, settings.qwen_base_url, settings.qwen_model,
         settings.llm_kirim_enable_thinking) = asal
        settings.llm_reasoning_effort, settings.llm_pakai_max_completion_tokens = "", False
        uji_ai.llm_client.reset_client()


def test_kuota_harian_menghentikan_uji_dan_menyimpan_hasil(monkeypatch, tmp_path):
    from sadewa_ai import llm_client, rag_chain

    monkeypatch.setattr(uji_ai, "JEDA_DETIK", 0)
    (tmp_path / "mentah").mkdir()
    n = {"panggil": 0}

    def generate_palsu(on_event=None, **kw):
        n["panggil"] += 1
        if n["panggil"] > 2:
            raise llm_client.LLMRateLimitError("429: you have used up your daily free allocation of 10,000 neurons")
        return {"data": {"evaluasi": [{"kode": "CPMK 1.1", "analisis": "Belum memenuhi target.",
                                       "rencana_perbaikan": "x"}]},
                "valid": True, "pelanggaran_validasi": []}

    monkeypatch.setattr(rag_chain, "generate_evaluasi_cpmk", generate_palsu)
    kasus = [{"_kode_kasus": "K01", "mk_name": "A", "prodi": "P", "semester": "Ganjil", "tahun_ajaran": "2025/2026",
              "cpmk": [dict(REQ["cpmk"][0])]}]
    ev, _, _, _, berhenti = uji_ai.uji_evaluasi_cpmk(kasus, 3, tmp_path)
    assert berhenti and [r["ulangan"] for r in ev] == [1, 2]

    # Mode lanjut: ulangan yang sudah ada dilewati.
    n["panggil"] = 0
    ev2, _, _, _, berhenti2 = uji_ai.uji_evaluasi_cpmk(kasus, 3, tmp_path, selesai={("K01", 1), ("K01", 2)})
    assert not berhenti2 and [r["ulangan"] for r in ev2] == [3] and ev2[0]["id"] == "evaluasi_K01_u3"
