FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .
RUN useradd --create-home appuser && chown -R appuser /app
USER appuser

ENV PORT=8000
EXPOSE 8000
# Migrations run on every boot (idempotent), then the API starts.
CMD ["sh", "scripts/start.sh"]
