"""
Pipeline ingestion knowledge base SADEWA.

Membaca PDF kurikulum di folder docs/, memotongnya menjadi chunk, lalu
menyimpan embedding-nya ke ChromaDB.

Dijalankan lewat: `sadewa-ingest` (setelah `pip install -e .`) atau
`python -m sadewa_ai.ingest`.

Selain membangun vector store, skrip ini menulis ingest_manifest.json berisi
daftar dokumen, jumlah halaman, dan jumlah chunk. Angka pada manifest itulah
yang sebaiknya dikutip di bagian Hasil Simulasi dokumen C300, supaya laporan
dan isi knowledge base selalu konsisten.
"""

import argparse
import json
import logging
import shutil
from datetime import datetime
from pathlib import Path
from typing import Dict, List

from langchain_chroma import Chroma
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter

from .config import settings
from .logging_config import setup_logging
from .retriever import get_embeddings

logger = logging.getLogger(__name__)


def load_pdfs(docs_dir: str) -> List:
    """Muat seluruh PDF pada folder docs_dir."""
    all_docs = []
    pdf_files = sorted(Path(docs_dir).glob("*.pdf"))

    if not pdf_files:
        logger.error("Tidak ada file PDF di folder '%s'", docs_dir)
        return []

    for pdf_path in pdf_files:
        logger.info("Membaca: %s", pdf_path.name)
        docs = PyPDFLoader(str(pdf_path)).load()
        for doc in docs:
            doc.metadata["source_file"] = pdf_path.name
        all_docs.extend(docs)
        logger.info("  -> %d halaman dimuat", len(docs))

    return all_docs


def split_documents(docs: List) -> List:
    """Potong dokumen sesuai parameter chunking pada C300 Tabel 24."""
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=settings.chunk_size,
        chunk_overlap=settings.chunk_overlap,
        separators=["\n\n", "\n", ".", " ", ""],
    )
    chunks = splitter.split_documents(docs)
    logger.info("Total chunk setelah splitting: %d", len(chunks))
    return chunks


def build_vectorstore(chunks: List) -> Chroma:
    """Bangun ChromaDB dari daftar chunk."""
    logger.info("Memuat model embedding %s ...", settings.embedding_model)
    embeddings = get_embeddings()

    logger.info("Menyimpan %d chunk ke ChromaDB ...", len(chunks))
    vectorstore = Chroma.from_documents(
        documents=chunks,
        embedding=embeddings,
        persist_directory=settings.vectorstore_dir,
        collection_name=settings.collection_name,
    )
    logger.info("ChromaDB tersimpan di: %s/", settings.vectorstore_dir)
    return vectorstore


def write_manifest(docs: List, chunks: List) -> Dict:
    """Catat statistik ingestion untuk dikutip pada dokumen dan health check."""
    per_dokumen: Dict[str, int] = {}
    for doc in docs:
        nama = doc.metadata.get("source_file", "unknown")
        per_dokumen[nama] = per_dokumen.get(nama, 0) + 1

    manifest = {
        "waktu_ingestion": datetime.now().isoformat(timespec="seconds"),
        "embedding_model": settings.embedding_model,
        "chunk_size": settings.chunk_size,
        "chunk_overlap": settings.chunk_overlap,
        "jumlah_dokumen": len(per_dokumen),
        "jumlah_halaman": len(docs),
        "jumlah_chunk": len(chunks),
        "dokumen": [
            {"nama": nama, "halaman": jml} for nama, jml in sorted(per_dokumen.items())
        ],
    }

    Path(settings.vectorstore_dir).mkdir(parents=True, exist_ok=True)
    with open(settings.ingest_manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)

    logger.info("Manifest ditulis ke: %s", settings.ingest_manifest_path)
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingestion knowledge base SADEWA")
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Hapus vector store lama sebelum membangun ulang",
    )
    args = parser.parse_args()

    setup_logging()

    print("=" * 60)
    print("  SADEWA — Ingestion Pipeline")
    print("=" * 60)

    if args.reset and Path(settings.vectorstore_dir).exists():
        logger.warning("Menghapus vector store lama di %s", settings.vectorstore_dir)
        shutil.rmtree(settings.vectorstore_dir)

    print("\n[1/4] Membaca dokumen PDF ...")
    docs = load_pdfs(settings.docs_dir)
    if not docs:
        print("Ingestion dibatalkan: tidak ada dokumen yang bisa dibaca.")
        return
    print(f"  Total halaman dimuat: {len(docs)}")

    print("\n[2/4] Memotong dokumen menjadi chunk ...")
    chunks = split_documents(docs)

    print("\n[3/4] Membangun vector database ...")
    build_vectorstore(chunks)

    print("\n[4/4] Menulis manifest ingestion ...")
    manifest = write_manifest(docs, chunks)

    print("\n" + "=" * 60)
    print("  Ingestion selesai.")
    print(f"  Dokumen : {manifest['jumlah_dokumen']}")
    print(f"  Halaman : {manifest['jumlah_halaman']}")
    print(f"  Chunk   : {manifest['jumlah_chunk']}")
    print("  Angka di atas yang sebaiknya dikutip pada dokumen C300.")
    print("=" * 60)


if __name__ == "__main__":
    main()
