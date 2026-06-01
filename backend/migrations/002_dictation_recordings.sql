create table if not exists dictation_recordings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  study_id uuid references studies(id) on delete set null,
  filename varchar(256) not null,
  content_type varchar(128),
  audio_data bytea,
  transcript text,
  structured_report text,
  created_at timestamptz not null default now()
);

create index if not exists idx_dictation_recordings_created on dictation_recordings(created_at);
create index if not exists idx_dictation_recordings_user on dictation_recordings(user_id);
create index if not exists idx_dictation_recordings_study on dictation_recordings(study_id);
