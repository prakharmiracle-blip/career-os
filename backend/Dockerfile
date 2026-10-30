FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
WORKDIR /app

COPY requirements.txt .
# DejaVu fonts let PDF resumes print any Unicode name, not just Latin-1.
RUN apt-get update && apt-get install -y --no-install-recommends fonts-dejavu-core && rm -rf /var/lib/apt/lists/*
RUN pip install -r requirements.txt

COPY . .
RUN useradd --create-home appuser && chown -R appuser /app
USER appuser

ENV PORT=8000
EXPOSE 8000
# Migrations run on every boot (idempotent), then the API starts.
CMD ["sh", "scripts/start.sh"]
