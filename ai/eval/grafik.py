"""
Membuat grafik dan ringkasan angka dari CSV hasil uji_ai.py, siap tempel ke C500.

    python eval/grafik.py                         # baca eval/hasil, tulis eval/hasil/grafik
    python eval/grafik.py --hasil eval/hasil --target 10 15

--target: satu atau dua garis target waktu generate (detik). Default 10 dan 15
karena spesifikasi non-fungsional menulis 5-10 detik sedangkan kriteria uji
menulis < 15 detik; pilih yang disepakati tim lalu jalankan ulang.

Grafik hanya dibuat untuk data yang ada. Tidak ada angka yang diisi otomatis.
"""

import argparse
import csv
import json
from collections import Counter, defaultdict
from pathlib import Path
from statistics import mean, median

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
from matplotlib.patches import FancyBboxPatch  # noqa: E402

# Warna tetap terbedakan saat dicetak hitam-putih (gelap / terang / arsir).
BIRU_TUA, BIRU_MUDA, JINGGA, ABU = "#1f4e79", "#9dc3e6", "#c55a11", "#7f7f7f"

plt.rcParams.update({
    "font.family": "DejaVu Sans", "font.size": 11, "axes.titlesize": 12,
    "axes.spines.top": False, "axes.spines.right": False, "savefig.dpi": 300,
    "savefig.bbox": "tight",
})


def baca(path: Path) -> list:
    if not path.exists():
        return []
    with path.open(encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


def label_bar(ax, bars, fmt="{:.0f}"):
    for b in bars:
        w = b.get_width()
        if w > 0:
            ax.text(b.get_x() + w / 2, b.get_y() + b.get_height() / 2, fmt.format(w),
                    ha="center", va="center", fontsize=9,
                    bbox=dict(boxstyle="round,pad=0.2", fc="white", ec="none", alpha=0.9))


# --- Grafik --------------------------------------------------------------------

def grafik_rps_per_mk(rps, out):
    per_mk = defaultdict(lambda: [0, 0, 0])  # lolos-1, lolos setelah retry, gagal
    for r in rps:
        i = 0 if r["lolos_percobaan_1"] == "1" else (1 if r["lolos_akhir"] == "1" else 2)
        per_mk[r["mk"]][i] += 1
    mk = list(per_mk)[::-1]
    data = [[per_mk[m][i] for m in mk] for i in range(3)]

    fig, ax = plt.subplots(figsize=(7.5, 0.55 * len(mk) + 1.6))
    kiri = [0] * len(mk)
    for vals, warna, arsir, nama in zip(
        data, (BIRU_TUA, BIRU_MUDA, JINGGA), (None, "//", "xx"),
        ("Lolos di percobaan pertama", "Lolos setelah retry otomatis", "Tidak lolos"),
    ):
        bars = ax.barh(mk, vals, left=kiri, color=warna, hatch=arsir, edgecolor="white", label=nama)
        label_bar(ax, bars)
        kiri = [a + b for a, b in zip(kiri, vals)]
    ax.set_xlabel("Jumlah RPS yang dibangkitkan")
    ax.xaxis.get_major_locator().set_params(integer=True)
    ax.legend(loc="upper center", bbox_to_anchor=(0.5, -0.18 - 0.02 * len(mk)), ncol=3, frameon=False, fontsize=9)
    fig.savefig(out / "rps_kepatuhan_per_mk.png")
    plt.close(fig)


def grafik_kegagalan(pel, out):
    # Dihitung per keluaran LLM (bukan per pesan) agar satu RPS dengan 5 field kosong tidak dihitung 5 kali.
    unik = {(p["mk"], p["ulangan"], p["percobaan_llm"], p["kategori"]) for p in pel}
    hitung = Counter(k[3] for k in unik)
    if not hitung:
        return
    nama, nilai = zip(*sorted(hitung.items(), key=lambda x: x[1]))
    fig, ax = plt.subplots(figsize=(7.5, 0.5 * len(nama) + 1.2))
    bars = ax.barh(nama, nilai, color=JINGGA)
    for b in bars:
        ax.text(b.get_width() + 0.05, b.get_y() + b.get_height() / 2, f"{b.get_width():.0f}", va="center", fontsize=9)
    ax.set_xlabel("Jumlah keluaran LLM yang mengandung pelanggaran")
    ax.xaxis.get_major_locator().set_params(integer=True)
    fig.savefig(out / "rps_jenis_kegagalan.png")
    plt.close(fig)


def grafik_angka(nar, out):
    nar = [n for n in nar if int(n["angka_total"]) > 0]
    if not nar:
        return
    label = [f"{n['id']} ({n['mk']})" for n in nar][::-1]
    cocok = [int(n["angka_cocok"]) for n in nar][::-1]
    salah = [int(n["angka_total"]) - int(n["angka_cocok"]) for n in nar][::-1]
    fig, ax = plt.subplots(figsize=(7.5, 0.5 * len(nar) + 1.6))
    b1 = ax.barh(label, cocok, color=BIRU_TUA, edgecolor="white", label="Sama dengan data backend")
    b2 = ax.barh(label, salah, left=cocok, color=JINGGA, hatch="xx", edgecolor="white", label="Tidak ditemukan di data")
    label_bar(ax, b1)
    label_bar(ax, b2)
    ax.set_xlabel("Jumlah angka yang disebut dalam narasi")
    ax.xaxis.get_major_locator().set_params(integer=True)
    ax.legend(loc="upper center", bbox_to_anchor=(0.5, -0.18 - 0.02 * len(nar)), ncol=2, frameon=False, fontsize=9)
    fig.savefig(out / "narasi_ketepatan_angka.png")
    plt.close(fig)


def grafik_waktu(rps, nar, target, out):
    seri = [(nama, [float(r["durasi_detik"]) for r in rows]) for nama, rows in (("Generate RPS", rps), ("Narasi evaluasi", nar)) if rows]
    if not seri:
        return
    fig, axes = plt.subplots(1, len(seri), figsize=(4.2 * len(seri), 3.6), squeeze=False)
    for ax, (nama, d) in zip(axes[0], seri):
        x = range(1, len(d) + 1)
        ax.plot(x, d, "o", color=BIRU_TUA, label="Durasi per percobaan")
        ax.axhline(mean(d), color=ABU, lw=1, label=f"Rata-rata {mean(d):.1f} s".replace(".", ","))
        for t, gaya in zip(target, ("--", ":")):
            ax.axhline(t, color=JINGGA, ls=gaya, lw=1.3, label=f"Target {t:g} s")
        ax.set_title(nama)
        ax.set_xlabel("Percobaan ke-")
        ax.set_ylabel("Waktu (detik)")
        ax.set_ylim(0, max(max(d), *target) * 1.15)
        ax.xaxis.get_major_locator().set_params(integer=True)
        ax.legend(fontsize=8, frameon=False)
    fig.tight_layout()
    fig.savefig(out / "waktu_generate.png")
    plt.close(fig)


def diagram_alur(out):
    langkah = [
        "Kasus uji\n(mata kuliah,\ndata capaian)", "Retrieval\nChromaDB\n(top-k chunk)",
        "Generate\nLLM Qwen", "Validator\n(retry bila\ngagal)", "Cek angka\nnarasi vs\nbackend", "CSV hasil\n& grafik",
    ]
    fig, ax = plt.subplots(figsize=(10, 1.9))
    ax.set_xlim(0, len(langkah) * 1.7)
    ax.set_ylim(0, 1)
    ax.axis("off")
    for i, teks in enumerate(langkah):
        x = i * 1.7 + 0.1
        ax.add_patch(FancyBboxPatch((x, 0.1), 1.3, 0.8, boxstyle="round,pad=0.02",
                                    fc=BIRU_MUDA if i % 2 else "white", ec=BIRU_TUA, lw=1.2))
        ax.text(x + 0.65, 0.5, teks, ha="center", va="center", fontsize=9)
        if i < len(langkah) - 1:
            ax.annotate("", xy=(x + 1.68, 0.5), xytext=(x + 1.32, 0.5),
                        arrowprops=dict(arrowstyle="->", color=BIRU_TUA, lw=1.2))
    fig.savefig(out / "diagram_alur_pengujian.png")
    plt.close(fig)


# --- Ringkasan angka untuk tabel laporan -------------------------------------------

def persen(a, b):
    return f"{a / b * 100:.1f}%".replace(".", ",") if b else "-"


def ringkasan(rps, nar, pel, target, folder):
    baris = []
    if rps:
        n = len(rps)
        l1 = sum(r["lolos_percobaan_1"] == "1" for r in rps)
        la = sum(r["lolos_akhir"] == "1" for r in rps)
        d = [float(r["durasi_detik"]) for r in rps]
        baris += [
            ("RPS dibangkitkan", f"{n} ({len({r['mk'] for r in rps})} mata kuliah)"),
            ("Lolos validate_rps di percobaan pertama", f"{l1}/{n} = {persen(l1, n)}"),
            ("Lolos validate_rps setelah retry", f"{la}/{n} = {persen(la, n)}"),
            ("Rata-rata percobaan LLM per RPS", f"{mean(int(r['jumlah_percobaan_llm']) for r in rps):.2f}".replace(".", ",")),
            ("Waktu generate RPS rata-rata / median / maks (s)", f"{mean(d):.1f} / {median(d):.1f} / {max(d):.1f}".replace(".", ",")),
        ]
        baris += [(f"RPS di atas target {t:g} s", f"{sum(x > t for x in d)}/{n}") for t in target]
        web = [float(r["durasi_web_detik"]) for r in rps if r.get("durasi_web_detik") not in (None, "")]
        if web:
            ada = sum(r.get("referensi_web") == "1" for r in rps)
            baris += [
                ("Waktu langkah web rata-rata / maks (s)", f"{mean(web):.1f} / {max(web):.1f}".replace(".", ",")),
                ("Waktu generate tanpa langkah web, rata-rata (s)", f"{mean(d) - mean(web):.1f}".replace(".", ",")),
                ("RPS yang mendapat referensi web", f"{ada}/{n}"),
            ]
    if pel:
        unik = {(p["mk"], p["ulangan"], p["percobaan_llm"], p["kategori"]) for p in pel}
        for kat, jml in Counter(k[3] for k in unik).most_common():
            baris.append((f"Kegagalan: {kat}", f"{jml} keluaran"))
    if nar:
        n = len(nar)
        lv = sum(r["lolos_validator"] == "1" for r in nar)
        tot, ok = sum(int(r["angka_total"]) for r in nar), sum(int(r["angka_cocok"]) for r in nar)
        sb, st = sum(int(r["status_benar"]) for r in nar), sum(int(r["status_total"]) for r in nar)
        d = [float(r["durasi_detik"]) for r in nar]
        baris += [
            ("Narasi dibangkitkan", str(n)),
            ("Lolos validate_narasi", f"{lv}/{n} = {persen(lv, n)}"),
            ("Ketepatan angka (faithfulness)", f"{ok}/{tot} = {persen(ok, tot)}"),
            ("Ketepatan status Tercapai/Belum", f"{sb}/{st} = {persen(sb, st)}"),
            ("Waktu generate narasi rata-rata / maks (s)", f"{mean(d):.1f} / {max(d):.1f}".replace(".", ",")),
        ]
    with (folder / "ringkasan.csv").open("w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        w.writerow(["metrik", "hasil"])
        w.writerows(baris)
    for k, v in baris:
        print(f"{k:<52} {v}")


def main():
    import sys
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--hasil", default=str(Path(__file__).resolve().parent / "hasil"))
    ap.add_argument("--target", type=float, nargs="+", default=[10, 15])
    args = ap.parse_args()

    folder = Path(args.hasil)
    out = folder / "grafik"
    out.mkdir(parents=True, exist_ok=True)
    rps, pel = baca(folder / "rps.csv"), baca(folder / "rps_pelanggaran.csv")
    nar = baca(folder / "narasi.csv")
    if not (rps or nar):
        raise SystemExit(f"Tidak ada rps.csv / narasi.csv di {folder}. Jalankan uji_ai.py dulu.")

    diagram_alur(out)
    if rps:
        grafik_rps_per_mk(rps, out)
        grafik_kegagalan(pel, out)
    if nar:
        grafik_angka(nar, out)
    grafik_waktu(rps, nar, args.target[:2], out)
    ringkasan(rps, nar, pel, args.target[:2], folder)

    konf = folder / "konfigurasi.json"
    if konf.exists():
        print("\nKonfigurasi uji:", json.dumps(json.loads(konf.read_text(encoding="utf-8")), ensure_ascii=False))
    print(f"\nGrafik tersimpan di {out}")


if __name__ == "__main__":
    main()
