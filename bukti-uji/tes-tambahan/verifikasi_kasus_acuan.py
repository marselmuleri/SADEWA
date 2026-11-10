"""Verifikasi mesin kalkulasi terhadap Kasus Acuan 1, yaitu data contoh spesifikasi formula SIMAK-NG
yang juga dipakai backend/tests/test_obe_formula.py (test_kasus_putu_sandra). Masukan dan nilai
harapan disalin dari tes tersebut; keluaran dihitung oleh obe_formula.compute_result.
Jalankan dari folder backend: python ../bukti-uji/tes-tambahan/verifikasi_kasus_acuan.py"""
import os, sys
sys.path.insert(0, os.getcwd())
from decimal import Decimal as D
from app.services.calculation.obe_formula import compute_result

cpmk_ik = {"CPMK1": {"IK1b": D("5")}, "CPMK2": {"IK2a": D("10"), "IK2c": D("10")},
           "CPMK4": {"IK4c": D("37.5")}, "CPMK6": {"IK6c": D("12.5")}, "CPMK7": {"IK7a": D("12.5")},
           "CPMK8": {"IK8a": D("4"), "IK8b": D("4.5"), "IK8c": D("4")}}
ik_cpl = {"IK1b": "CP1", "IK2a": "CP2", "IK2c": "CP2", "IK4c": "CP4", "IK6c": "CP6", "IK7a": "CP7",
          "IK8a": "CP8", "IK8b": "CP8", "IK8c": "CP8"}
matrix = {"Tugas": {"IK1b": D("0.5"), "IK2a": D("4"), "IK2c": D("10"), "IK4c": D("6"), "IK6c": D("12.5"),
                    "IK7a": D("4.5"), "IK8a": D("4"), "IK8b": D("4.5"), "IK8c": D("4")},
          "Kuis": {"IK1b": D("1.5"), "IK4c": D("4"), "IK7a": D("4.5")},
          "UTS": {"IK1b": D("3"), "IK4c": D("13.5"), "IK7a": D("3.5")},
          "UAS": {"IK2a": D("6"), "IK4c": D("14")}}
nilai = {"Tugas": {"IK1b": D("100"), "IK2a": D("100"), "IK2c": D("75"), "IK4c": D("100"), "IK6c": D("75"),
                   "IK7a": D("50"), "IK8a": D("50"), "IK8b": D("50"), "IK8c": D("100")},
         "Kuis": {"IK1b": D("50"), "IK4c": D("100"), "IK7a": D("100")},
         "UTS": {"IK1b": D("75"), "IK4c": D("75"), "IK7a": D("50")},
         "UAS": {"IK2a": D("100"), "IK4c": D("50")}}
harapan_poin = {"CP1": "3.50", "CP2": "17.50", "CP4": "27.13", "CP6": "9.38", "CP7": "8.50", "CP8": "8.25"}
harapan_persen = {"CP1": "70.00", "CP2": "87.50", "CP4": "72.35", "CP6": "75.04", "CP7": "68.00", "CP8": "66.00"}

h = compute_result(cpmk_ik=cpmk_ik, matrix=matrix, nilai=nilai, ik_cpl=ik_cpl)
print("CPL | poin harapan | poin sistem | selisih | persen harapan | persen sistem | selisih")
for k in harapan_poin:
    p, q, r, s = D(harapan_poin[k]), h.poin_cpl[k], D(harapan_persen[k]), h.persen_cpl[k]
    print(f"{k} | {p} | {q} | {q - p} | {r} | {s} | {s - r}")
print(f"nilai_akhir | 74.25 | {h.nilai_akhir} | {h.nilai_akhir - D('74.25')}")
