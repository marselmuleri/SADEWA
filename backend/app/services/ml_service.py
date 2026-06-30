from __future__ import annotations

from pathlib import Path
import numpy as np
import joblib
from sqlalchemy import func
from sqlalchemy.orm import Session
from sklearn.ensemble import RandomForestClassifier

from app.models.cpl import CPL
from app.models.hasil_prediksi import HasilPrediksi
from app.models.mahasiswa import Mahasiswa
from app.models.penilaian import Penilaian

FEATURE_NAMES = [
    "nilai_tugas",
    "nilai_kuis",
    "nilai_uts",
    "nilai_uas",
    "nilai_proyek",
    "persentase_kehadiran",
]

MODEL_PATH = Path(__file__).resolve().parents[2] / "ml" / "model_rf_cpl.pkl"


def _generate_synthetic_data(n_samples: int = 400):
    np.random.seed(42)
    nilai_tugas = np.random.uniform(40, 95, size=n_samples)
    nilai_kuis = np.random.uniform(35, 95, size=n_samples)
    nilai_uts = np.random.uniform(30, 95, size=n_samples)
    nilai_uas = np.random.uniform(30, 100, size=n_samples)
    nilai_proyek = np.random.uniform(40, 100, size=n_samples)
    persentase_kehadiran = np.random.uniform(50, 100, size=n_samples)

    X = np.column_stack([nilai_tugas, nilai_kuis, nilai_uts, nilai_uas, nilai_proyek, persentase_kehadiran])
    nilai_akhir = 0.2 * nilai_tugas + 0.1 * nilai_kuis + 0.25 * nilai_uts + 0.3 * nilai_uas + 0.15 * nilai_proyek
    y = (nilai_akhir >= 60).astype(int)
    return X, y


def _extract_training_data_from_db(db: Session):
    rows = (
        db.query(
            Penilaian.mahasiswa_id,
            Penilaian.mata_kuliah_id,
            Penilaian.jenis,
            func.avg(Penilaian.nilai).label("rata"),
        )
        .group_by(Penilaian.mahasiswa_id, Penilaian.mata_kuliah_id, Penilaian.jenis)
        .all()
    )

    grouped: dict[tuple[int, int], dict[str, float]] = {}
    for row in rows:
        key = (row.mahasiswa_id, row.mata_kuliah_id)
        grouped.setdefault(key, {})[row.jenis.value] = float(row.rata)

    if len(grouped) < 20:
        return _generate_synthetic_data()

    X, y = [], []
    for _, vals in grouped.items():
        fitur = [
            vals.get("tugas", 60.0),
            vals.get("kuis", 60.0),
            vals.get("uts", 60.0),
            vals.get("uas", 60.0),
            vals.get("proyek", 60.0),
            min(100.0, max(50.0, np.mean(list(vals.values())) + np.random.uniform(-10, 10))),
        ]
        nilai_akhir = 0.2 * fitur[0] + 0.1 * fitur[1] + 0.25 * fitur[2] + 0.3 * fitur[3] + 0.15 * fitur[4]
        X.append(fitur)
        y.append(1 if nilai_akhir >= 60 else 0)

    return np.array(X), np.array(y)


def train_model(db: Session):
    X, y = _extract_training_data_from_db(db)
    model = RandomForestClassifier(n_estimators=200, random_state=42, class_weight="balanced")
    model.fit(X, y)

    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, MODEL_PATH)

    return {
        "message": "Model Random Forest berhasil dilatih",
        "model_path": str(MODEL_PATH),
        "jumlah_data": int(len(X)),
    }


def _build_feature_vector(db: Session, mahasiswa_id: int, mata_kuliah_id: int):
    rows = (
        db.query(Penilaian.jenis, func.avg(Penilaian.nilai).label("rata"))
        .filter(Penilaian.mahasiswa_id == mahasiswa_id, Penilaian.mata_kuliah_id == mata_kuliah_id)
        .group_by(Penilaian.jenis)
        .all()
    )
    by_jenis = {row.jenis.value: float(row.rata) for row in rows}

    vector = np.array(
        [[
            by_jenis.get("tugas", 60.0),
            by_jenis.get("kuis", 60.0),
            by_jenis.get("uts", 60.0),
            by_jenis.get("uas", 60.0),
            by_jenis.get("proyek", 60.0),
            min(100.0, max(50.0, np.mean(list(by_jenis.values() or [60.0])) + 5.0)),
        ]]
    )
    return vector


def predict(db: Session, mahasiswa_id: int, cpl_id: int, mata_kuliah_id: int):
    if not MODEL_PATH.exists():
        train_model(db)

    model: RandomForestClassifier = joblib.load(MODEL_PATH)
    vector = _build_feature_vector(db, mahasiswa_id, mata_kuliah_id)

    probs = model.predict_proba(vector)[0]
    prob_gagal = float(probs[0])
    prob_lulus = float(probs[1]) if len(probs) > 1 else float(1 - prob_gagal)
    prediksi = "lulus" if prob_lulus >= 0.6 else "berisiko gagal"

    importance = {name: float(val) for name, val in zip(FEATURE_NAMES, model.feature_importances_)}

    result = HasilPrediksi(
        mahasiswa_id=mahasiswa_id,
        cpl_id=cpl_id,
        mata_kuliah_id=mata_kuliah_id,
        probabilitas_lulus=prob_lulus,
        probabilitas_gagal=prob_gagal,
        prediksi=prediksi,
        feature_importance=importance,
    )
    db.add(result)
    db.commit()

    rekomendasi = "Tingkatkan pendampingan pada komponen dengan kontribusi terbesar dan nilai terendah."

    return {
        "probabilitas_lulus": round(prob_lulus * 100, 2),
        "probabilitas_gagal": round(prob_gagal * 100, 2),
        "prediksi": prediksi,
        "feature_importance": importance,
        "rekomendasi_singkat": rekomendasi,
    }


def predict_batch(db: Session, mata_kuliah_id: int):
    mahasiswa_ids = (
        db.query(Penilaian.mahasiswa_id)
        .filter(Penilaian.mata_kuliah_id == mata_kuliah_id)
        .distinct()
        .all()
    )
    cpl = db.query(CPL).first()
    if not cpl:
        return []

    results = []
    for (mahasiswa_id,) in mahasiswa_ids:
        results.append(predict(db, mahasiswa_id=mahasiswa_id, cpl_id=cpl.id, mata_kuliah_id=mata_kuliah_id))
    return results


def early_warning(db: Session):
    data = (
        db.query(HasilPrediksi, Mahasiswa)
        .join(Mahasiswa, Mahasiswa.id == HasilPrediksi.mahasiswa_id)
        .filter(HasilPrediksi.probabilitas_lulus < 0.6)
        .all()
    )

    return [
        {
            "mahasiswa_id": m.id,
            "nama": m.nama,
            "probabilitas_lulus": round(h.probabilitas_lulus * 100, 2),
            "prediksi": h.prediksi,
        }
        for h, m in data
    ]


def ketercapaian_cpl(db: Session, prodi_id: int):
    cpl_rows = db.query(CPL).filter(CPL.program_studi_id == prodi_id).all()
    out = []
    for row in cpl_rows:
        avg = (
            db.query(func.avg(HasilPrediksi.probabilitas_lulus))
            .filter(HasilPrediksi.cpl_id == row.id)
            .scalar()
        )
        out.append(
            {
                "cpl_id": row.id,
                "kode_cpl": row.kode_cpl,
                "persentase_ketercapaian": round(float(avg or 0) * 100, 2),
            }
        )
    return out
