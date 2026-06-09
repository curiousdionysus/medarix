-- Report QA validation results and immutable audit trail.

create table if not exists report_qa_validations (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references reports(id) on delete set null,
  dictation_recording_id uuid references dictation_recordings(id) on delete set null,
  study_id uuid references studies(id) on delete set null,
  created_by uuid references users(id) on delete set null,
  transcript_text text not null,
  report_text text not null,
  transcript_hash varchar(64) not null,
  report_hash varchar(64) not null,
  findings jsonb not null default '[]'::jsonb,
  scores jsonb not null default '{}'::jsonb,
  traceability jsonb not null default '[]'::jsonb,
  reviewer_findings jsonb,
  risk_level varchar(16) not null default 'high',
  overall_score integer not null default 0,
  primary_model varchar(128),
  review_model varchar(128),
  status varchar(32) not null default 'completed',
  created_at timestamptz not null default now()
);

create index if not exists idx_report_qa_validations_report on report_qa_validations(report_id, created_at desc);
create index if not exists idx_report_qa_validations_recording on report_qa_validations(dictation_recording_id, created_at desc);
create index if not exists idx_report_qa_validations_study on report_qa_validations(study_id, created_at desc);

create table if not exists report_qa_audit_log (
  id bigserial primary key,
  validation_id uuid not null references report_qa_validations(id) on delete restrict,
  event_type varchar(64) not null,
  payload jsonb not null default '{}'::jsonb,
  integrity_hash varchar(128) not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_report_qa_audit_validation on report_qa_audit_log(validation_id, created_at);
