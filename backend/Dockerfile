# syntax=docker/dockerfile:1

# --- Stage 1: build the Medarix SPA ---
FROM node:22-slim AS frontend
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci || npm install
COPY frontend/ ./
RUN npm run build

# --- Stage 2: Python backend serving the built SPA ---
FROM python:3.12-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Retry apt on flaky networks; fonts are optional for PDF export.
RUN for i in 1 2 3 4 5; do \
      apt-get update \
      && apt-get install -y --no-install-recommends fonts-dejavu-core \
      && rm -rf /var/lib/apt/lists/* \
      && exit 0; \
      sleep 15; \
    done; \
    echo "WARN: fonts-dejavu-core install skipped" >&2

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/app ./app
COPY backend/migrations ./migrations
COPY backend/tests ./tests
COPY backend/pytest.ini .

# Built SPA assets served by FastAPI (see app/main.py SPA fallback).
COPY --from=frontend /frontend/dist ./app/spa

EXPOSE 8088

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8088"]
