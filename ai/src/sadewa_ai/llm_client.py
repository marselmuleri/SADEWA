"""
Klien LLM Qwen dan utilitas parsing keluaran.

Dua hal yang ditangani di sini:
1. Klien OpenAI-compatible dibuat sekali saja (singleton) lengkap dengan timeout
   dan retry, bukan dibuat ulang tiap panggilan.
2. Ekstraksi JSON yang tahan banting. Model kadang tetap menambahkan kalimat
   pembuka atau pagar markdown walau sudah dilarang di prompt, sehingga parsing
   yang hanya mengandalkan split("```") mudah gagal total.
"""

import json
import threading
from typing import Any, Dict, List, Optional

from openai import OpenAI, APIError, APITimeoutError, AuthenticationError, PermissionDeniedError

from .config import settings

_client: Optional[OpenAI] = None
_lock = threading.Lock()


class LLMError(RuntimeError):
    """Kegagalan saat memanggil LLM, sudah diterjemahkan ke pesan yang bisa dibaca."""


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


def chat(
    messages: List[Dict[str, str]],
    max_tokens: int,
    temperature: float,
    model: Optional[str] = None,
) -> str:
    """Panggil LLM dan kembalikan teks jawaban, dengan error yang informatif."""
    client = get_client()
    try:
        response = client.chat.completions.create(
            model=model or settings.qwen_model,
            messages=messages,
            max_tokens=max_tokens,
            temperature=temperature,
        )
    except AuthenticationError as exc:
        raise LLMError(
            "API key ditolak. Periksa QWEN_API_KEY di .env dan pastikan key "
            "dibuat dari workspace yang sama dengan region pada QWEN_BASE_URL."
        ) from exc
    except PermissionDeniedError as exc:
        raise LLMError(
            f"Akses ke model '{model or settings.qwen_model}' ditolak. Kemungkinan "
            "kuota gratis habis atau model belum diaktifkan di Model Studio. "
            f"Detail: {exc}"
        ) from exc
    except APITimeoutError as exc:
        raise LLMError(
            f"LLM tidak merespons dalam {settings.llm_timeout_seconds} detik."
        ) from exc
    except APIError as exc:
        raise LLMError(f"Panggilan LLM gagal: {exc}") from exc

    if not response.choices:
        raise LLMError("LLM mengembalikan respons kosong.")

    content = response.choices[0].message.content
    if not content:
        raise LLMError("LLM mengembalikan konten kosong.")

    return content.strip()


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
