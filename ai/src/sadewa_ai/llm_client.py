"""
Klien LLM Qwen dan utilitas parsing keluaran.

Dua hal yang ditangani di sini:
1. Klien OpenAI-compatible dibuat sekali saja (singleton) lengkap dengan timeout
   dan retry, bukan dibuat ulang tiap panggilan.
2. Ekstraksi JSON yang tahan banting. Model kadang tetap menambahkan kalimat
   pembuka atau pagar markdown walau sudah dilarang di prompt, sehingga parsing
   yang hanya mengandalkan split("```") mudah gagal total.

Perubahan terbaru:
- Pemanggilan memakai STREAMING. Uji langsung (test_qwen.py) dengan streaming
  selesai dalam ~34 detik, sedangkan panggilan non-streaming di service sempat
  habis waktu pada 90 detik. Pada streaming, timeout dihitung per potongan data
  yang diterima, bukan untuk seluruh jawaban sekaligus.
- Mode thinking Qwen3.8 dimatikan (enable_thinking=False).
- finish_reason == "length" dideteksi dan dilaporkan dengan pesan yang jelas.
"""

import json
import logging
import threading
import time
from typing import Any, Callable, Dict, List, Optional

from openai import (
    APIError,
    APITimeoutError,
    AuthenticationError,
    OpenAI,
    PermissionDeniedError,
    RateLimitError,
)

from .config import settings

logger = logging.getLogger(__name__)

_client: Optional[OpenAI] = None
_lock = threading.Lock()


class LLMError(RuntimeError):
    """Kegagalan saat memanggil LLM, sudah diterjemahkan ke pesan yang bisa dibaca."""


class LLMRateLimitError(LLMError):
    """Kuota/batas laju penyedia habis (HTTP 429). Masalah infrastruktur, bukan kualitas model."""


class JSONExtractionError(ValueError):
    """Keluaran model tidak bisa diubah menjadi JSON."""


def get_client() -> OpenAI:
    global _client
    if _client is None:
        settings.validate_llm_config()
        with _lock:
            if _client is None:
                _client = OpenAI(
                    api_key=settings.qwen_api_key,
                    base_url=settings.qwen_base_url,
                    timeout=settings.llm_timeout_seconds,
                    max_retries=settings.llm_max_retries,
                )
    return _client


def reset_client() -> None:
    """Buang klien singleton agar dibuat ulang dari settings terbaru (dipakai skrip evaluasi)."""
    global _client
    with _lock:
        _client = None


# Pendengar opsional untuk statistik setiap panggilan LLM: model, token, durasi.
# Dipakai skrip evaluasi (eval/uji_ai.py) untuk mencatat waktu LLM murni dan biaya
# token tanpa mengubah alur rag_chain. Aplikasi biasa tidak memasangnya.
UsageListener = Callable[[Dict[str, Any]], None]
_usage_listener: Optional[UsageListener] = None


def set_usage_listener(fn: Optional[UsageListener]) -> None:
    """Pasang (atau lepas dengan None) pendengar statistik panggilan LLM."""
    global _usage_listener
    _usage_listener = fn


def _laporkan_usage(catatan: Dict[str, Any]) -> None:
    if _usage_listener is None:
        return
    try:
        _usage_listener(dict(catatan))
    except Exception:  # noqa: BLE001 - pendengar tidak boleh memutus generate
        logger.debug("Usage listener gagal", exc_info=True)


def chat(
    messages: List[Dict[str, str]],
    max_tokens: int,
    temperature: float,
    model: Optional[str] = None,
    on_token: Optional[Callable[[str], None]] = None,
) -> str:
    """
    Panggil LLM (streaming) dan kembalikan teks jawaban utuh, dengan error informatif.
    Statistik panggilan (berhasil maupun gagal) diteruskan ke usage listener bila ada.
    """
    catatan: Dict[str, Any] = {
        "model": model or settings.qwen_model,
        "prompt_tokens": None,
        "completion_tokens": None,
        "finish_reason": None,
        "reasoning_tokens": None,
        "biaya_usd": None,
        "provider": None,
        "berhasil": False,
    }
    mulai = time.perf_counter()
    try:
        hasil = _chat_stream(messages, max_tokens, temperature, model, on_token, catatan)
        catatan["berhasil"] = True
        return hasil
    finally:
        catatan["durasi_detik"] = time.perf_counter() - mulai
        _laporkan_usage(catatan)


def _chat_stream(
    messages: List[Dict[str, str]],
    max_tokens: int,
    temperature: float,
    model: Optional[str],
    on_token: Optional[Callable[[str], None]],
    catatan: Dict[str, Any],
) -> str:
    """
    Inti pemanggilan streaming; `catatan` diisi token dan finish_reason untuk chat().

    on_token (opsional) dipanggil untuk setiap potongan teks yang diterima, sehingga
    pemanggil bisa meneruskan hasil secara bertahap ke pengguna. Kegagalan di dalam
    callback diabaikan agar tidak menggagalkan proses generate.
    """
    client = get_client()
    nama_model = model or settings.qwen_model

    potongan: List[str] = []
    finish_reason: Optional[str] = None
    usage = None
    mulai = time.time()

    try:
        # Parameter tambahan per penyedia; bawaan (Qwen) tidak berubah.
        opsi: Dict[str, Any] = {}
        if settings.llm_pakai_max_completion_tokens:
            opsi["max_completion_tokens"] = max_tokens
        else:
            opsi["max_tokens"] = max_tokens
        if settings.llm_kirim_temperature:
            opsi["temperature"] = temperature
        if settings.llm_reasoning_effort:
            # Mis. "none" pada model reasoning OpenAI agar temperature diterima dan
            # mode berpikir mati, setara enable_thinking=False pada Qwen.
            opsi["reasoning_effort"] = settings.llm_reasoning_effort
        stream = client.chat.completions.create(
            model=nama_model,
            messages=messages,
            stream=True,
            stream_options={"include_usage": True},
            extra_body=_extra_body(),
            **opsi,
        )
        for chunk in stream:
            if getattr(chunk, "usage", None):
                usage = chunk.usage
            # OpenRouter menyertakan nama provider yang benar-benar melayani di tiap chunk.
            if getattr(chunk, "provider", None):
                catatan["provider"] = chunk.provider
            if not chunk.choices:
                continue
            pilihan = chunk.choices[0]
            if pilihan.delta and pilihan.delta.content:
                potongan.append(pilihan.delta.content)
                if on_token is not None:
                    try:
                        on_token(pilihan.delta.content)
                    except Exception:  # noqa: BLE001 - callback tidak boleh memutus generate
                        logger.debug("Callback on_token gagal", exc_info=True)
            if pilihan.finish_reason:
                finish_reason = pilihan.finish_reason
    except AuthenticationError as exc:
        raise LLMError(
            "API key ditolak. Periksa QWEN_API_KEY di .env dan pastikan key "
            "dibuat dari workspace yang sama dengan region pada QWEN_BASE_URL."
        ) from exc
    except PermissionDeniedError as exc:
        raise LLMError(
            f"Akses ke model '{nama_model}' ditolak. Kemungkinan "
            "kuota gratis habis atau model belum diaktifkan di Model Studio. "
            f"Detail: {exc}"
        ) from exc
    except RateLimitError as exc:
        # Sudah dicoba ulang klien (max_retries). Dipisah dari LLMError biasa agar
        # skrip evaluasi tidak mencatatnya sebagai kegagalan model.
        raise LLMRateLimitError(f"Batas kuota penyedia tercapai (429): {exc}") from exc
    except APITimeoutError as exc:
        raise LLMError(
            f"LLM tidak merespons dalam {settings.llm_timeout_seconds} detik "
            f"(sudah menerima {sum(len(p) for p in potongan)} karakter)."
        ) from exc
    except APIError as exc:
        raise LLMError(f"Panggilan LLM gagal: {exc}") from exc

    durasi = time.time() - mulai
    catatan["prompt_tokens"] = getattr(usage, "prompt_tokens", None)
    catatan["completion_tokens"] = getattr(usage, "completion_tokens", None)
    catatan["finish_reason"] = finish_reason
    detail = getattr(usage, "completion_tokens_details", None)
    catatan["reasoning_tokens"] = getattr(detail, "reasoning_tokens", None)
    # Biaya nyata (USD) yang dilaporkan OpenRouter di objek usage; penyedia lain tidak mengirimnya.
    catatan["biaya_usd"] = getattr(usage, "cost", None)
    logger.info(
        "LLM selesai (model=%s, finish=%s, prompt_tokens=%s, completion_tokens=%s, %.1f detik)",
        nama_model,
        finish_reason,
        getattr(usage, "prompt_tokens", "?"),
        getattr(usage, "completion_tokens", "?"),
        durasi,
    )

    # Keluaran terpotong karena kehabisan token: JSON pasti tidak lengkap.
    if finish_reason == "length":
        raise LLMError(
            f"Keluaran model terpotong karena melebihi max_tokens ({max_tokens}). "
            "Naikkan RPS_MAX_TOKENS (atau NARASI_MAX_TOKENS) di file .env "
            "pada folder ai/, lalu restart AI service."
        )

    content = "".join(potongan).strip()
    if not content:
        raise LLMError("LLM mengembalikan konten kosong.")

    return content


def _extra_body() -> Optional[Dict[str, Any]]:
    """Susun extra_body: parameter non-standar OpenAI yang diteruskan apa adanya ke penyedia."""
    isi: Dict[str, Any] = {}
    if settings.llm_kirim_enable_thinking:
        # Khusus DashScope (Qwen): mode thinking dimatikan agar generate cepat dan seluruh
        # max_tokens dipakai untuk JSON. Penyedia lain bisa menolak parameter ini.
        isi["enable_thinking"] = False
    if settings.llm_extra_body:
        # Mis. OpenRouter: provider yang dikunci, objek reasoning, dan pelaporan biaya.
        isi.update(settings.llm_extra_body)
    return isi or None


def _strip_code_fence(text: str) -> str:
    """Buang pagar markdown ```json ... ``` bila ada."""
    stripped = text.strip()
    if not stripped.startswith("```"):
        return stripped

    lines = stripped.splitlines()
    if lines and lines[0].startswith("```"):
        lines = lines[1:]
    if lines and lines[-1].strip().startswith("```"):
        lines = lines[:-1]
    return "\n".join(lines).strip()


def _extract_balanced_object(text: str) -> Optional[str]:
    """
    Ambil objek JSON terluar dengan menghitung kurung kurawal, sambil
    mengabaikan kurung yang berada di dalam string dan escape sequence.
    Lebih aman daripada regex greedy untuk JSON bersarang.
    """
    start = text.find("{")
    if start == -1:
        return None

    depth = 0
    in_string = False
    escaped = False

    for i in range(start, len(text)):
        ch = text[i]

        if in_string:
            if escaped:
                escaped = False
            elif ch == "\\":
                escaped = True
            elif ch == '"':
                in_string = False
            continue

        if ch == '"':
            in_string = True
        elif ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return text[start : i + 1]

    return None


def extract_json(raw: str) -> Dict[str, Any]:
    """
    Ubah keluaran mentah LLM menjadi dict, dengan tiga lapis usaha:
    1. Parse langsung.
    2. Buang pagar markdown lalu parse.
    3. Ambil objek JSON terluar dengan penghitungan kurung lalu parse.
    """
    candidates = []

    raw = raw.strip()
    candidates.append(raw)

    unfenced = _strip_code_fence(raw)
    if unfenced != raw:
        candidates.append(unfenced)

    balanced = _extract_balanced_object(unfenced)
    if balanced:
        candidates.append(balanced)

    last_error: Optional[Exception] = None
    for candidate in candidates:
        if not candidate:
            continue
        try:
            parsed = json.loads(candidate)
        except json.JSONDecodeError as exc:
            last_error = exc
            continue
        if isinstance(parsed, dict):
            return parsed
        last_error = ValueError("JSON yang ditemukan bukan objek.")

    preview = raw[:300]
    raise JSONExtractionError(
        f"Tidak bisa mengekstrak JSON dari respons model. "
        f"Error terakhir: {last_error}. Cuplikan respons: {preview}"
    )