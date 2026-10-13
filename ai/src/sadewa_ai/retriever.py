"""
Akses ke vector store ChromaDB.

Model embedding dan koneksi Chroma dimuat SEKALI saja (singleton), lalu dipakai
ulang untuk seluruh permintaan. Pada versi sebelumnya keduanya dimuat ulang di
setiap panggilan retrieve_context(), sehingga setiap request menanggung beban
loading model embedding (beberapa detik). Dengan pola ini beban itu hanya
terjadi pada request pertama, atau saat warmup() dipanggil ketika server start.

Catatan lock: `_lock` sengaja berupa RLock (reentrant), bukan Lock biasa.
get_vectorstore() mengunci lock ini lalu memanggil get_embeddings() yang juga
mengunci lock yang sama dari thread yang sama — dengan Lock biasa ini deadlock
permanen (proses tampak "menggantung" tanpa pernah traceback).
"""

import os
import threading
from typing import Any, Dict, List, Optional, Tuple

from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings

from .config import settings

_embeddings: Optional[HuggingFaceEmbeddings] = None
_vectorstore: Optional[Chroma] = None
_lock = threading.RLock()


class VectorstoreNotFoundError(RuntimeError):
    """Vector store belum dibangun."""


def _ensure_vectorstore_exists() -> None:
    if not os.path.isdir(settings.vectorstore_dir):
        raise VectorstoreNotFoundError(
            f"Folder '{settings.vectorstore_dir}' tidak ditemukan. "
            "Jalankan 'sadewa-ingest' (atau 'python -m sadewa_ai.ingest') "
            "terlebih dahulu untuk membangun knowledge base."
        )


def get_embeddings() -> HuggingFaceEmbeddings:
    """
    Model embedding multilingual, dimuat sekali lalu di-cache.

    model_kwargs di bawah ini sengaja disamakan persis dengan kode awal
    (device=cpu, local_files_only=False) karena versi itu terbukti cepat dan
    berhasil di komputer pengguna. Sempat dicoba memaksa HF_HUB_OFFLINE=1
    dengan asumsi mempercepat, tapi ternyata malah menyebabkan proses
    menggantung -- jadi pola itu tidak dipakai lagi di sini.
    """
    global _embeddings
    if _embeddings is None:
        with _lock:
            if _embeddings is None:
                print(
                    f"[retriever] Memuat model embedding '{settings.embedding_model}' ...",
                    flush=True,
                )
                _embeddings = HuggingFaceEmbeddings(
                    model_name=settings.embedding_model,
                    model_kwargs={"device": "cpu", "local_files_only": False},
                    encode_kwargs={"normalize_embeddings": True},
                )
                print("[retriever] Model embedding siap.", flush=True)
    return _embeddings


def get_vectorstore() -> Chroma:
    """Koneksi ChromaDB, dimuat sekali lalu di-cache."""
    global _vectorstore
    if _vectorstore is None:
        _ensure_vectorstore_exists()
        with _lock:
            if _vectorstore is None:
                _vectorstore = Chroma(
                    persist_directory=settings.vectorstore_dir,
                    embedding_function=get_embeddings(),
                    collection_name=settings.collection_name,
                )
    return _vectorstore


def warmup() -> None:
    """
    Panggil saat startup server (FastAPI lifespan/startup event) agar request
    pertama dari pengguna tidak ikut menanggung waktu loading model.
    """
    get_vectorstore()


def count_chunks() -> int:
    """Jumlah chunk yang tersimpan di knowledge base. Berguna untuk health check."""
    try:
        return get_vectorstore()._collection.count()
    except Exception:
        return -1


def format_context(docs: List) -> str:
    """Susun dokumen hasil retrieval menjadi satu blok konteks untuk prompt."""
    if not docs:
        return "Tidak ditemukan konteks relevan dari dokumen kurikulum."

    parts = []
    for i, doc in enumerate(docs, start=1):
        source = doc.metadata.get("source_file", "unknown")
        page = doc.metadata.get("page")
        label = f"[Dokumen {i} — {source}"
        if page is not None:
            label += f", hal. {page + 1}"
        label += "]"
        parts.append(f"{label}\n{doc.page_content}")

    return "\n\n---\n\n".join(parts)


def retrieve_context(query: str, k: Optional[int] = None) -> str:
    """Ambil potongan dokumen kurikulum yang paling relevan dengan query."""
    k = k or settings.top_k_chunks
    docs = get_vectorstore().similarity_search(query, k=k)
    return format_context(docs)


def _extract_sources(docs: List) -> List[Dict[str, Any]]:
    """Ekstrak metadata sumber dari daftar Document hasil retrieval.

    Mengembalikan list of dict dengan kunci:
      - file    : nama file sumber dokumen
      - page    : nomor halaman (1-indexed), atau None jika tidak tersedia
      - snippet : potongan awal konten dokumen (maks 200 karakter)
    """
    sources: List[Dict[str, Any]] = []
    for doc in docs:
        source_file = doc.metadata.get("source_file", "unknown")
        raw_page = doc.metadata.get("page")
        page = (raw_page + 1) if raw_page is not None else None
        snippet = doc.page_content[:200].strip() if doc.page_content else ""
        sources.append({
            "file": source_file,
            "page": page,
            "snippet": snippet,
        })
    return sources


def retrieve_context_with_metadata(
    query: str, k: Optional[int] = None,
) -> Tuple[str, List[Dict[str, Any]]]:
    """Ambil konteks kurikulum beserta metadata sumber dokumen.

    Mengembalikan tuple (context_text, sources) di mana:
      - context_text : string konteks yang sudah diformat (sama seperti
                       retrieve_context())
      - sources      : list of dict metadata sumber, masing-masing berisi
                       kunci 'file', 'page', dan 'snippet'
    """
    k = k or settings.top_k_chunks
    docs = get_vectorstore().similarity_search(query, k=k)
    return format_context(docs), _extract_sources(docs)


def retrieve_documents(query: str, k: Optional[int] = None) -> List:
    """Versi retrieve_context yang mengembalikan objek Document mentah."""
    k = k or settings.top_k_chunks
    return get_vectorstore().similarity_search(query, k=k)
