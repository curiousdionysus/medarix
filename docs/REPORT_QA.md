# Report Quality Assurance (QA) Subsystem

## Architecture analysis

Medarix uses a layered FastAPI backend and React SPA. The dictation pipeline today is:

```
Audio → POST /api/v1/ai/transcribe → POST /api/v1/ai/format-report → Report editor / PACS
```

The QA subsystem extends this **without modifying** existing endpoints' contracts:

```
… → format-report (unchanged fields) → optional `qa` object in response
                                    → POST /api/v1/reports/validate (manual)
                                    → GET  /api/v1/reports/{id}/qa
                                    → GET  /api/v1/reports/{id}/audit
```

### Design principles

| Principle | Implementation |
|-----------|----------------|
| Extension over modification | New `app/services/qa/*`, `app/api/qa.py`, migration `007_report_qa.sql` |
| Feature flags | `qa.enabled`, `qa.secondary_review_enabled`, `qa.traceability_enabled` (default **off**) |
| Read-only validation | Validator never mutates report text |
| Immutable audit | `report_qa_audit_log` append-only with HMAC integrity |
| Backward compatibility | `FormatReportResponse.qa` is optional (`null` when QA disabled) |

## Modules

| Module | Responsibility |
|--------|----------------|
| `measurements.py` | mm, cm, %, HU, SUV extraction & comparison |
| `laterality.py` | TR/EN right/left/bilateral checks |
| `entities.py` | Rule-based clinical entity preservation |
| `traceability.py` | Sentence-level transcript mapping (timestamps reserved) |
| `reviewer.py` | Optional secondary LLM JSON review |
| `scoring.py` | Weighted quality score & risk band |
| `validator.py` | Orchestrator |
| `persistence.py` | DB save + immutable audit log |
| `service.py` | High-level `run_report_qa()` for API & format hook |

## Database (migration 007)

- **`report_qa_validations`** — full validation snapshot (findings, scores, traceability JSONB)
- **`report_qa_audit_log`** — immutable event log per validation

No changes to existing `reports` or `dictation_recordings` tables.

## API specification

### POST `/api/v1/reports/validate`

Permission: `qa:run`. Requires `qa.enabled=true`.

```json
{
  "transcript": "...",
  "report": "...",
  "report_id": "uuid?",
  "recording_id": "uuid?",
  "study_id": "uuid?"
}
```

### GET `/api/v1/reports/{report_id}/qa`

Latest QA result for a saved report. Permission: `qa:view`.

### GET `/api/v1/reports/{report_id}/audit`

Immutable QA audit entries. Permission: `qa:view`.

### GET `/api/v1/analytics/qa-summary`

Aggregate QA metrics (Enterprise + `analytics:view` + `qa:view`).

## Quality score

```json
{
  "transcription_confidence": 0.97,
  "measurement_accuracy": 1.00,
  "laterality_accuracy": 1.00,
  "entity_preservation": 0.96,
  "reviewer_confidence": 0.94,
  "overall_score": 97,
  "risk_level": "low"
}
```

| Score | Risk |
|-------|------|
| 95–100 | LOW |
| 80–94 | MEDIUM |
| 0–79 | HIGH |

## Feature flags (Admin → System settings)

| Key | Default | Description |
|-----|---------|-------------|
| `qa.enabled` | `false` | Master QA switch |
| `qa.secondary_review_enabled` | `false` | Secondary LLM reviewer |
| `qa.traceability_enabled` | `true` | Sentence mapping (when QA on) |
| `qa.review_model` | `""` | Reviewer model (falls back to `ai.text_model`) |

## Rollback strategy

1. Set `qa.enabled=false` in system settings (instant, no deploy).
2. QA router remains registered but returns 503 when disabled.
3. To remove schema: `DROP TABLE report_qa_audit_log; DROP TABLE report_qa_validations;` (data loss only for QA tables).
4. Revert migration version row in `schema_migrations` if re-applying.

## Enable in production

1. Admin → **Yapay Zeka ve Kalite Denetimi** → **Rapor kalite denetimi** bölümünde **Rapor kalite denetimi (QA)** anahtarını açın.
2. Optionally enable secondary reviewer and set `qa.review_model`.
3. Rebuild backend: `docker compose up -d --build medarix-backend`.
4. Dictation → **Yapılandır** → QA panel appears when enabled.

## Testing

```bash
docker exec medarix-backend pytest tests/test_qa_validation.py -q
```

Coverage targets measurement mismatch, laterality, entity hallucination, scoring bands, and orchestrator read-only behavior.
