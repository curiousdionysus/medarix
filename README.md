<<<<<<< HEAD
# Medarix

**AI-powered Radiology Reporting & Clinical Intelligence Platform**

Enterprise web platform for AI-powered radiology dictation, transcription, structured reporting, and clinical documentation. React + TypeScript SPA with a FastAPI backend, PostgreSQL, Redis, LDAP-ready authentication, flexible RBAC, append-only audit trail, and Orthanc/DICOMweb integration.

## Repository layout

| Path | Description |
|------|-------------|
| `frontend/` | React 19 + Vite SPA |
| `backend/` | FastAPI API and services |
| `backend/migrations/` | PostgreSQL SQL migrations |
| `ollama/` | `Modelfile.medarix` for the `medarix-ai` Ollama model |
| `docker-compose.yml` | Full stack: app, Postgres, Redis, Orthanc, Ollama, Whisper |
| `docs/KURULUM.md` | Installation guide (Turkish) |
| `docs/SECURITY-CHECKLIST.md` | Production security checklist |

## Quick start (Docker)

```powershell
git clone <your-repo-url> medarix
cd medarix
copy .env.example .env
# Edit .env: POSTGRES_PASSWORD, ORTHANC_PASSWORD, JWT/HMAC secrets
docker compose up -d --build
docker exec ollama ollama pull llama3.1:latest
```

Open **http://localhost:8088**

Detailed steps, GPU notes, and the `medarix-ai` model: **[docs/KURULUM.md](docs/KURULUM.md)**

## Development

**Frontend** (proxies API to backend on `:8088`):

```powershell
cd frontend
npm install
npm run dev
```

**Backend only** (requires Postgres/Redis elsewhere): copy `.env.example` to `.env`, adjust `MEDARIX_DATABASE_*` and run uvicorn from `backend/`.

Production images build the SPA inside `backend/Dockerfile` and serve it from `app/spa`.

## Pilot credentials (development only)

Default admin (when `MEDARIX_ALLOW_BOOTSTRAP_ADMIN=true`):

```text
Username: admin
Password: admin-change-me  (or MEDARIX_DEFAULT_ADMIN_PASSWORD in .env)
```

**Do not use these on shared or production hosts.**

## Configuration

- Copy **`.env.example`** → **`.env`** at the repository root before `docker compose up`.
- Never commit `.env`, `.credentials.local.txt`, or real keys.
- See `backend/app/core/config.py` and [docs/SECURITY-CHECKLIST.md](docs/SECURITY-CHECKLIST.md).

## AI services (compose)

| Service | URL (inside Docker network) |
|---------|----------------------------|
| Ollama | `http://ollama:11434/v1` |
| Whisper | `http://whisper:8000/v1` |

Recommended text model: **`medarix-ai`** (create from `ollama/Modelfile.medarix`).

## Production notes

- Set `MEDARIX_ENVIRONMENT=production` and follow the security checklist.
- Use strong secrets, Redis, `MEDARIX_PATIENT_DATA_KEY`, HTTPS, and `MEDARIX_COOKIE_SECURE=true`.
- Disable bootstrap admin, license issue, and legacy UI in production.

## License

Proprietary. All rights reserved unless otherwise stated by the repository owner.
=======
# medarix
>>>>>>> 7d4aa9c8042c3978dd1c0a2e8343ca1aa2715a4a
