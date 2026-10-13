# Dockerfile untuk layanan AI (RAG + Qwen) SADEWA
FROM python:3.10-slim

WORKDIR /app

# Instal dependensi terlebih dahulu untuk memanfaatkan cache layer Docker
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Salin kode sumber dan konfigurasi proyek
COPY src/ src/
COPY pyproject.toml .

# Instal paket dalam mode editable
RUN pip install -e .

EXPOSE 8001

CMD ["uvicorn", "sadewa_ai.api:app", "--host", "0.0.0.0", "--port", "8001"]
