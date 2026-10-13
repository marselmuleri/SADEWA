# Dockerfile untuk layanan backend FastAPI SADEWA
FROM python:3.10-slim

WORKDIR /app

# Instal dependensi terlebih dahulu untuk memanfaatkan cache layer Docker
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Salin seluruh kode sumber aplikasi
COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
