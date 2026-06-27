# ---- Stage 1: build the React frontend ----
FROM node:20-slim AS frontend
WORKDIR /fe
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---- Stage 2: Python backend that also serves the built frontend ----
FROM python:3.12-slim
WORKDIR /app
ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1

COPY backend/requirements.txt ./
RUN pip install -r requirements.txt

COPY backend/ ./
# The built SPA lands at /app/static, which FastAPI serves (see main.py _STATIC_DIR).
COPY --from=frontend /fe/dist ./static

ENV PORT=8080
# Shell form so ${PORT} (set by Cloud Run) is expanded at runtime.
CMD exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}
