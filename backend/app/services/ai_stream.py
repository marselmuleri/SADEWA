"""
Pembantu Server-Sent Events untuk endpoint generate AI versi streaming.

Endpoint `.../generate/stream` mengalirkan progres pembuatan RPS / narasi ke
frontend supaya dosen bisa melihat tahap yang sedang berjalan, sumber pedoman
yang dipakai, dan draf yang sedang ditulis, alih-alih menunggu layar kosong.

Format event (semua `data` berupa JSON):
    mulai    info mata kuliah (dan data capaian untuk narasi) yang dipakai
    tahap    {"id", "status": "mulai"|"selesai", "detail"?, "percobaan"?}
    sumber   {"sumber": [{"file", "page", "snippet"}]}
    token    {"teks"}       potongan JSON mentah yang sedang ditulis LLM
    ulang    {"percobaan", "pelanggaran"}   draf diulang karena belum lolos aturan OBE
    selesai  record yang tersimpan (bentuk sama dengan respons endpoint non-streaming)
    error    {"pesan", "status"}   proses gagal; status mengikuti kode HTTP versi non-streaming
"""

from __future__ import annotations

import json
import logging
from typing import Any, AsyncIterator, Dict, Optional, Tuple

from fastapi import HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

Event = Tuple[str, Dict[str, Any]]


def format_sse(jenis: str, data: Dict[str, Any]) -> str:
    return f"event: {jenis}\ndata: {json.dumps(data, ensure_ascii=False, default=str)}\n\n"


def sse_response(alur: AsyncIterator[Event], db: Optional[Session] = None) -> StreamingResponse:
    """
    Bungkus generator event menjadi StreamingResponse.

    Kegagalan di tengah jalan (HTTPException dari ai_client, atau error lain)
    dikirim sebagai event `error` karena status HTTP 200 sudah terlanjur terkirim.
    """

    async def badan() -> AsyncIterator[str]:
        try:
            async for jenis, data in alur:
                yield format_sse(jenis, data)
        except HTTPException as exc:
            if db is not None:
                db.rollback()
            yield format_sse("error", {"pesan": str(exc.detail), "status": exc.status_code})
        except Exception as exc:  # noqa: BLE001
            logger.exception("Streaming generate AI gagal")
            if db is not None:
                db.rollback()
            yield format_sse("error", {"pesan": f"Kesalahan tak terduga: {exc}", "status": 500})
        finally:
            # Sesi dari dependency get_db bisa sudah ditutup sebelum streaming dimulai
            # (tergantung versi FastAPI); sesi SQLAlchemy tetap bisa dipakai lagi setelah
            # close(), jadi cukup pastikan ditutup kembali di akhir.
            if db is not None:
                db.close()

    return StreamingResponse(
        badan(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
