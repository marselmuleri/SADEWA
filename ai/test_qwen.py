"""
Diagnosa kecepatan Qwen, terpisah dari seluruh aplikasi SADEWA.

Jalankan dari folder ai/ (venv aktif):
    python test_qwen.py                       -> model dari .env, thinking OFF
    python test_qwen.py qwen3.8-flash on      -> thinking ON (pembanding)
    python test_qwen.py qwen-flash off        -> model lain

Yang dilaporkan:
- waktu sampai token pertama (TTFT)
- apakah model mengirim reasoning_content (artinya thinking MASIH jalan)
- jumlah token keluaran dan kecepatan token/detik
"""

import os
import sys
import time

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

model = sys.argv[1] if len(sys.argv) > 1 else os.getenv("QWEN_MODEL", "qwen3.8-flash")
thinking = len(sys.argv) > 2 and sys.argv[2].lower() == "on"

api_key = os.getenv("QWEN_API_KEY")
if not api_key:
    sys.exit("QWEN_API_KEY kosong. Jalankan dari folder ai/ yang berisi file .env")

client = OpenAI(
    api_key=api_key,
    base_url=os.getenv("QWEN_BASE_URL", "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"),
    timeout=300,
    max_retries=0,
)

prompt = (
    "Buat RPS mata kuliah Machine Learning untuk 16 pertemuan dalam format JSON valid. "
    'Struktur: {"kode_mk": "", "deskripsi_mk": "", "cpl": [{"kode": "", "deskripsi": ""}], '
    '"cpmk": [{"kode": "", "deskripsi": ""}], "pertemuan": [{"minggu": 1, "cpmk": "", '
    '"sub_cpmk": "", "materi": "", "metode": "", "bobot": 3}]}. '
    "Minggu 8 UTS bobot 20, minggu 16 UAS bobot 30, total bobot 100. "
    "Hanya JSON, tanpa teks lain."
)

print(f"Model    : {model}")
print(f"Thinking : {'ON' if thinking else 'OFF'}")
print("Memanggil... (tunggu)\n", flush=True)

mulai = time.time()
token_pertama = None
reasoning_chars = 0
jawaban_chars = 0
usage = None

try:
    stream = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=4000,
        temperature=0.4,
        stream=True,
        stream_options={"include_usage": True},
        extra_body={"enable_thinking": thinking},
    )
    for chunk in stream:
        if getattr(chunk, "usage", None):
            usage = chunk.usage
        if not chunk.choices:
            continue
        delta = chunk.choices[0].delta
        r = getattr(delta, "reasoning_content", None)
        if r:
            reasoning_chars += len(r)
            if token_pertama is None:
                token_pertama = time.time() - mulai
        if delta.content:
            jawaban_chars += len(delta.content)
            if token_pertama is None:
                token_pertama = time.time() - mulai
except Exception as exc:  # noqa: BLE001
    print(f"GAGAL setelah {time.time() - mulai:.1f} detik: {type(exc).__name__}: {exc}")
    sys.exit(1)

total = time.time() - mulai
print("=== HASIL ===")
print(f"Total waktu            : {total:.1f} detik")
print(f"Token pertama          : {token_pertama:.1f} detik" if token_pertama else "Token pertama          : tidak ada")
print(f"Karakter reasoning     : {reasoning_chars}  <- kalau > 0, thinking MASIH aktif")
print(f"Karakter jawaban       : {jawaban_chars}")
if usage:
    out = getattr(usage, "completion_tokens", None)
    print(f"Token keluaran         : {out}")
    if out and total > 0:
        print(f"Kecepatan              : {out / total:.1f} token/detik")
