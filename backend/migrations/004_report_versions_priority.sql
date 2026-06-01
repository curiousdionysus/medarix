-- Report version history
create table if not exists report_versions (
    id uuid primary key default gen_random_uuid(),
    report_id uuid not null references reports(id),
    version integer not null,
    status varchar(32) not null default 'draft',
    content text not null,
    transcript text,
    author_id uuid references users(id),
    created_at timestamptz not null default now()
);
create index if not exists idx_report_versions_report on report_versions(report_id, version);
create index if not exists idx_report_versions_created on report_versions(created_at);

-- Study priority for worklist indicators
alter table studies add column if not exists priority varchar(16) not null default 'routine';
create index if not exists idx_studies_priority on studies(priority);
