# Medarix

**AI-powered radiology reporting and clinical workflow platform**

Medarix unifies dictation, speech transcription, structured report authoring, PACS-aware worklists, patient and study management, DICOM integration, and enterprise audit controls in a single hospital-grade web application. It is designed for on-premise deployment via Docker Compose in pilot or production environments.

**Repository:** [github.com/curiousdionysus/medarix](https://github.com/curiousdionysus/medarix)

---

## Table of contents

- [Overview](#overview)
- [Key features](#key-features)
- [Architecture](#architecture)
- [Technology stack](#technology-stack)
- [Repository layout](#repository-layout)
- [Requirements](#requirements)
- [Quick start](#quick-start)
- [Docker services and ports](#docker-services-and-ports)
- [Environment variables](#environment-variables)
- [AI services](#ai-services)
- [PACS and DICOM integration](#pacs-and-dicom-integration)
- [API overview](#api-overview)
- [Security and RBAC](#security-and-rbac)
- [Development](#development)
- [Database and migrations](#database-and-migrations)
- [First login and administration](#first-login-and-administration)
- [Production deployment](#production-deployment)
- [Troubleshooting](#troubleshooting)
- [Documentation](#documentation)
- [License](#license)

---

## Overview

Medarix targets radiology departments that need:

- A unified **worklist** synced from an external PACS (DICOM Study Root Query/Retrieve, C-FIND)
- **Voice dictation** with Whisper-based transcription and LLM-assisted report formatting
- **Structured reports** with versioning, signing, PDF export, and optional DICOM SR delivery
- **Local DICOM archive** via Orthanc (DICOMweb) for retrieve and viewer proxy
- **Role-based access control**, LDAP/Active Directory, and tamper-evident audit logging
- **Enterprise analytics** and licensing gates for advanced modules

The production image builds the React SPA inside `backend/Dockerfile` and serves it from FastAPI at `/`. All REST APIs live under `/api/v1`.

---

## Key features

### Workspace

| Module | Description |
|--------|-------------|
| **Worklist** | Single-table study queue with date/time and modality filters; PACS sync on search (C-FIND); priority and report status columns |
| **Report dictation** | In-browser recording, waveform, file upload, transcription, AI formatting, template selection; linked study persists in `localStorage` until removed |
| **Reports** | Studies with completed dictation (`has_report`); section-based editor, autosave, version history, sign & send to PACS |

### Imaging and PACS

- **Study Root Q/R** (`pynetdicom`): query remote PACS and upsert patients/studies into PostgreSQL
- **C-MOVE retrieve** into Orthanc (configurable destination AE)
- **Imaging status** on worklist: local series counts + Orthanc lookup (`include_imaging=true`)
- **External PACS web viewer** via configurable URL template (`{accession}`, `{study_instance_uid}`)
- **DICOMweb proxy** and internal viewer URL for studies in Orthanc
- **DICOM SR** report send (enterprise)

### AI center (Enterprise license)

- Radiology-tuned Ollama model **`medarix-ai`** (`ollama/Modelfile.medarix`)
- OpenAI-compatible endpoints for Ollama (LLM) and faster-whisper (transcription)
- AI assistant, smart suggestions, and user report templates
- Live model discovery from Admin → AI settings

### Patients and studies

- Encrypted patient demographics (field-level encryption + searchable name hash)
- Study search with patient TC, name, accession, modality, date/time range
- Patient timeline and study metadata (including `study_time` from DICOM)

### Administration

- Users, groups, flexible **RBAC** (built-in roles + custom roles/permissions)
- LDAP / Active Directory with connection verification
- System settings (AI, PACS, auth, security, branding, retention)
- License activation (Enterprise features)
- Immutable **audit log** (HMAC-signed events)
- Session model: short-lived JWT + httpOnly refresh cookie (Redis-backed refresh rotation)

### User experience

- Modern React UI (Tailwind, Radix primitives)
- **Turkish and English** UI (`frontend/src/features/i18n`)
- Light/dark theme and high-contrast mode
- Command palette and configurable hospital branding

---

## Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│   Browser   │────▶│ medarix-backend  │────▶│  PostgreSQL │
│  (React SPA)│     │    (FastAPI)     │     │  (metadata) │
└─────────────┘     └────────┬─────────┘     └─────────────┘
                             │
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
   ┌──────────┐       ┌──────────┐       ┌──────────┐
   │  Redis   │       │medarix-ai│      │medarix-  │
   │ (sessions)│      │ (Ollama) │      │ whisper  │
   └──────────┘       └──────────┘       └──────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
        ┌──────────┐   ┌──────────────┐   ┌─────────────┐
        │ External │   │medarix-orthanc│  │  (optional) │
        │   PACS   │   │  (DICOMweb)  │  │  LDAP / AD  │
        └──────────┘   └──────────────┘   └─────────────┘
```

| Path | Purpose |
|------|---------|
| `/` | Single-page application (production build in `backend/app/spa`) |
| `/api/v1/*` | REST API |
| `/healthz` | Liveness probe |
| `/healthz/deps` | Dependency health (AI, DB, Redis, Orthanc) — restricted in production |
| `/static` | Legacy static assets |
| `/legacy` | Legacy HTML UI (when `MEDARIX_ALLOW_LEGACY_UI=true`) |

**Networking:** All Compose services attach to `medarix-network`. Internal DNS uses **service names** (`postgres`, `ollama`, `whisper`, `orthanc`), not container names.

---

## Technology stack

| Layer | Technologies |
|-------|----------------|
| Frontend | React 19, TypeScript, Vite 8, Tailwind CSS 4, TanStack Query, React Router 7, Radix UI, Recharts |
| API | FastAPI, Pydantic v2, SQLAlchemy 2 |
| Database | PostgreSQL 16 |
| Cache / sessions | Redis 7 |
| DICOM archive | Orthanc (DICOMweb enabled) |
| Remote PACS | DICOM DIMSE via `pynetdicom` (C-FIND / C-MOVE) |
| LLM | Ollama (OpenAI-compatible API) |
| Transcription | faster-whisper-server (CUDA image in Compose) |
| PDF reports | ReportLab |
| Auth | JWT + httpOnly refresh cookie, optional LDAP (`ldap3`) |

---

## Repository layout

| Path | Description |
|------|-------------|
| `frontend/` | React SPA source |
| `backend/app/` | FastAPI application (`api/`, `services/`, `core/`, `models.py`) |
| `backend/migrations/` | SQL migrations `001`–`006` |
| `backend/tests/` | Pytest suite |
| `backend/Dockerfile` | Multi-stage build (Node → Python + embedded SPA) |
| `docker-compose.yml` | Full stack definition |
| `.env.example` | Environment template (copy to `.env`; never commit secrets) |
| `ollama/Modelfile.medarix` | Custom `medarix-ai` Ollama model definition |
| `docs/KURULUM.md` | Detailed installation guide (Turkish) |

---

## Requirements

| Component | Recommendation |
|-----------|----------------|
| Docker Desktop / Docker Engine | 4.x+ |
| Git | Clone and updates |
| Disk | ~30 GB (AI models, PostgreSQL, Orthanc) |
| RAM | 16 GB minimum, 32 GB recommended |
| NVIDIA GPU | Optional but recommended for Ollama and Whisper |

Without a GPU, CPU fallback works but transcription and LLM latency increase significantly. If NVIDIA Container Toolkit is unavailable, remove or comment the `deploy.resources` GPU sections in `docker-compose.yml`.

---

## Quick start

### 1. Clone the repository

```bash
git clone https://github.com/curiousdionysus/medarix.git
cd medarix
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and set **strong, unique** values at minimum for:

- `POSTGRES_PASSWORD` and `MEDARIX_DATABASE_PASSWORD` (must match)
- `ORTHANC_PASSWORD` / `MEDARIX_ORTHANC_PASSWORD`
- `MEDARIX_SESSION_JWT_SECRET`, `MEDARIX_AUDIT_HMAC_SECRET`, `MEDARIX_LICENSE_SIGNING_SECRET` (32+ characters)

Generate a random secret (PowerShell example):

```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }) -as [byte[]])
```

### 3. Start the stack

```bash
docker compose up -d --build
```

### 4. Pull AI models (first-time setup)

```bash
docker exec medarix-ai ollama pull llama3.1:latest
docker exec medarix-ai ollama pull qwen2.5:14b
```

Create the custom Medarix radiology model:

```bash
docker cp ollama/Modelfile.medarix medarix-ai:/tmp/Modelfile.medarix
docker exec medarix-ai ollama create medarix-ai -f /tmp/Modelfile.medarix
```

Adjust the `FROM` line in `Modelfile.medarix` to match your pulled base model.

### 5. Open the application

| URL | Notes |
|-----|-------|
| **http://localhost:8090** | Default host port mapped to backend `8088` |
| http://localhost:8088 | Direct if you run backend without port mapping |

Health check:

```bash
curl http://localhost:8090/healthz
# {"status":"ok","service":"Medarix"}
```

---

## Docker services and ports

| Container | Role | Host port(s) |
|-----------|------|----------------|
| `medarix-backend` | Web UI + API | **8090** → 8088 |
| `medarix-postgres` | Application database | `127.0.0.1:15432` |
| `medarix-redis` | Refresh token store | `127.0.0.1:16379` |
| `medarix-orthanc` | DICOM + DICOMweb | `127.0.0.1:8042`, `4242` |
| `medarix-ai` | Ollama | `11434` |
| `medarix-whisper` | Transcription API | `10300` → 8000 |

**Persistent volumes**

| Volume | Contents |
|--------|----------|
| `medarix-postgres` | Clinical metadata, users, reports, audit |
| `medarix-orthanc` | Retrieved DICOM studies |
| `medarix-ollama-data` | Downloaded LLM weights |

---

## Environment variables

Root `.env` is read by Docker Compose and the backend (`MEDARIX_*` prefix via Pydantic Settings).

| Variable | Description |
|----------|-------------|
| `POSTGRES_*` | PostgreSQL credentials for Compose and backend |
| `ORTHANC_PASSWORD` | Orthanc `RegisteredUsers` password |
| `MEDARIX_ENVIRONMENT` | `development` or `production` |
| `MEDARIX_SESSION_JWT_SECRET` | JWT signing key |
| `MEDARIX_AUDIT_HMAC_SECRET` | Audit log integrity (HMAC) |
| `MEDARIX_LICENSE_SIGNING_SECRET` | License payload signing |
| `MEDARIX_PATIENT_DATA_KEY` | Patient field encryption (required in production) |
| `MEDARIX_REDIS_URL` | e.g. `redis://medarix-redis:6379/0` |
| `MEDARIX_OLLAMA_BASE_URL` | In Compose: `http://ollama:11434/v1` |
| `MEDARIX_OLLAMA_MODEL` | e.g. `medarix-ai` |
| `MEDARIX_WHISPER_BASE_URL` | In Compose: `http://whisper:8000/v1` |
| `MEDARIX_WHISPER_MODEL` | e.g. `Systran/faster-whisper-large-v3` |
| `MEDARIX_PACS_HOST` / `MEDARIX_PACS_PORT` | Remote PACS DIMSE endpoint |
| `MEDARIX_PACS_AE_TITLE` | Local AE title |
| `MEDARIX_PACS_CALLED_AE_TITLE` | Remote PACS AE title |
| `MEDARIX_DICOMWEB_BASE_URL` | Orthanc DICOMweb root |
| `MEDARIX_ALLOW_BOOTSTRAP_ADMIN` | Create default admin on startup (`false` in production) |
| `MEDARIX_CORS_ORIGINS` | JSON array of allowed origins |

Full template: [`.env.example`](.env.example). Runtime overrides also exist in **Admin → System settings** (database-backed).

**Never commit:** `.env`, `.credentials.local.txt`, real passwords, or signing secrets.

---

## AI services

| Service | Internal URL (Compose) | Admin UI label |
|---------|------------------------|----------------|
| Ollama | `http://ollama:11434/v1` | Text / LLM server |
| Whisper | `http://whisper:8000/v1` | Transcription server |

Use **List models** in Admin to query live model lists from each server.

**Recommended radiology model:** `medarix-ai` — built from [`ollama/Modelfile.medarix`](ollama/Modelfile.medarix) with Turkish radiology transcript-editing instructions.

**Typical dictation flow**

1. Link a study on the Dictation page (persists across navigation until unlinked).
2. Record or upload audio → **Transcribe** (`POST /api/v1/ai/transcribe`).
3. Optional **Format** with LLM (`POST /api/v1/ai/format-report`).
4. **Save** report to the study (`PUT /api/v1/studies/{id}/report`).

---

## PACS and DICOM integration

Configure in **Admin → System settings → PACS / DICOM**:

| Setting key | Purpose |
|-------------|---------|
| `pacs.host`, `pacs.port`, `pacs.called_ae_title` | Remote PACS DIMSE |
| `pacs.ae_title`, `pacs.move_destination_ae` | Local AE and C-MOVE destination (Orthanc) |
| `pacs.dicomweb_base_url` | Orthanc DICOMweb for archive checks and proxy |
| `pacs.mwl_auto_sync` | Auto Q/R when worklist search runs |
| `pacs.query_sync_days` | C-FIND date window (days before/after today) |
| `pacs.web_viewer_url_template` | External viewer link from worklist |

**Viewer URL template example** (placeholders replaced per study):

```text
http://10.230.32.54/?an={accession}&usr=extreme
```

Supported placeholders: `{accession}`, `{AccessionNumber}`, `{study_instance_uid}`, `{StudyInstanceUID}`.

**API endpoints** (Enterprise license + `pacs:query` / `pacs:retrieve` permissions):

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/pacs/worklist/sync` | C-FIND studies → database upsert |
| `POST` | `/api/v1/pacs/query` | Ad-hoc PACS query |
| `POST` | `/api/v1/pacs/retrieve` | C-MOVE to Orthanc |
| `GET` | `/api/v1/pacs/viewer-url/{study_instance_uid}` | Internal DICOMweb viewer URL |

**Studies list flags**

- `include_imaging=true` — adds `has_images`, `image_count`, `pacs_viewer_url`
- `has_report=true` — only studies with saved report content or transcript

---

## API overview

Base URL: `/api/v1` (requires `Authorization: Bearer <access_token>` except auth and public branding).

| Router | Prefix | Highlights |
|--------|--------|------------|
| `auth` | `/auth` | login, refresh, logout, `/me` |
| `clinical` | `/` | studies, reports, templates, PDF |
| `dicom` | `/pacs` | query, sync, retrieve, viewer |
| `ai` | `/ai` | transcribe, format-report, assistant, suggestions |
| `recordings` | `/recordings` | dictation audio storage |
| `patients` | `/patients` | patient list and timeline |
| `analytics` | `/analytics` | dashboard KPIs (enterprise) |
| `admin` | `/admin` | users, roles, audit, settings, license |
| `branding` | `/branding` | public hospital branding |

OpenAPI docs (development): `http://localhost:8090/docs`

---

## Security and RBAC

### Built-in roles

`admin`, `radiologist`, `reporter`, `viewer`, `technician`, `external_consultant`

Custom roles can be created in Admin with granular permissions, including:

- Clinical: `study:read`, `image:view`, `pacs:query`, `pacs:retrieve`
- Reports: `report:read`, `report:write`, `report:sign`, `template:write`, `recording:*`
- AI: `ai:use`, `analytics:view`
- Admin: `admin:access`, `admin:users`, `admin:audit`, `*`

### Security features

- Rate-limited login and refresh endpoints
- Security headers middleware
- Patient PHI encrypted at rest; audit events HMAC-chained
- Refresh tokens stored in Redis with rotation on use
- Enterprise license gate for PACS sync, analytics, and AI center routes

---

## Development

### Frontend (hot reload)

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173** — Vite proxies `/api` and `/healthz` to `http://localhost:8088` (or `8090` if using Compose mapping).

### Backend only

Ensure PostgreSQL and Redis are running. Point `.env` database host to `127.0.0.1:15432` and Redis to `127.0.0.1:16379` when using Compose-published ports.

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8088 --reload
```

### Tests

```bash
cd backend
pytest -q
```

### Production SPA build

```bash
cd frontend && npm run build
```

The Docker image runs this automatically and copies `dist/` to `backend/app/spa`.

---

## Database and migrations

| File | Purpose |
|------|---------|
| `001_initial.sql` | Core schema (applied via Postgres `initdb` on first volume create) |
| `002`–`005` | Dictation recordings, transcripts, report versions, flexible roles |
| `006_study_time.sql` | `study_time` column for worklist datetime filters |

On **every backend startup**, SQLAlchemy `create_all` runs, then migrations `002`–`006` are applied idempotently via `schema_migrations`.

> **Note:** Changing `POSTGRES_PASSWORD` after the volume was created does not update the existing database user password. Align secrets with the volume or recreate the volume (data loss). See [docs/KURULUM.md](docs/KURULUM.md).

---

## First login and administration

When `MEDARIX_ALLOW_BOOTSTRAP_ADMIN=true` (default in development):

| Field | Default |
|-------|---------|
| Username | `admin` (or `MEDARIX_DEFAULT_ADMIN_USERNAME`) |
| Password | `MEDARIX_DEFAULT_ADMIN_PASSWORD` in `.env` (template: `admin-change-me`) |

**Change these credentials immediately** on any shared or production system.

Recommended post-install steps:

1. **Admin → AI** — verify Ollama/Whisper URLs and select models  
2. **Admin → Authentication** — configure LDAP and run connection test  
3. **Admin → System settings → PACS** — remote PACS host/AE and web viewer URL template  
4. **Admin → License** — activate Enterprise if using PACS sync and analytics  

---

## Production deployment

Minimum production checklist:

```env
MEDARIX_ENVIRONMENT=production
MEDARIX_ALLOW_BOOTSTRAP_ADMIN=false
MEDARIX_ALLOW_LICENSE_ISSUE=false
MEDARIX_ALLOW_LEGACY_UI=false
MEDARIX_COOKIE_SECURE=true
MEDARIX_PATIENT_DATA_KEY=<strong-key>
MEDARIX_REDIS_URL=redis://...
```

Also required:

- Unique 32+ character secrets for JWT, audit HMAC, and license signing  
- HTTPS termination at reverse proxy / ingress  
- Redis for refresh token storage  
- Regular backups of `medarix-postgres` and `medarix-orthanc` volumes  
- SIEM export of audit logs (`/api/v1/admin/audit`)

---

## Troubleshooting

| Symptom | Likely fix |
|---------|------------|
| Backend restart loop | `POSTGRES_PASSWORD` must equal `MEDARIX_DATABASE_PASSWORD` |
| `password authentication failed` for Postgres | Password changed but old volume retained — align or reset volume |
| Worklist empty after search | Run Enterprise license; check PACS host/firewall; widen `pacs.query_sync_days` |
| PACS viewer icon grey (“not configured”) | Save `pacs.web_viewer_url_template` in system settings; ensure API calls include `include_imaging=true` |
| Empty Ollama model list | `docker exec medarix-ai ollama pull <model>` |
| GPU / Compose deploy errors | Remove NVIDIA `deploy.resources` blocks or install Container Toolkit |
| Port 8090 in use | Change host mapping in `docker-compose.yml` |

---

## Documentation

| Document | Language | Content |
|----------|----------|---------|
| [docs/KURULUM.md](docs/KURULUM.md) | Turkish | Step-by-step installation, GPU, volumes, backups |

---

## Contributing

Use GitHub **Issues** for bugs and feature requests. For installation questions, start with this README and [docs/KURULUM.md](docs/KURULUM.md).

---

## License

Proprietary software. All rights reserved by the repository owner unless otherwise stated.
