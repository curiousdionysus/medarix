create extension if not exists pgcrypto;

do $$ begin
  create type role_name as enum ('radiologist', 'technician', 'admin', 'viewer', 'external_consultant');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type report_status as enum ('draft', 'preliminary', 'signed', 'amended');
exception when duplicate_object then null;
end $$;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  username varchar(128) unique not null,
  display_name varchar(256),
  email varchar(256),
  auth_provider varchar(32) not null default 'local',
  password_hash text,
  ldap_dn text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists roles (
  id uuid primary key default gen_random_uuid(),
  name role_name unique not null
);

create table if not exists user_roles (
  user_id uuid not null references users(id) on delete cascade,
  role_id uuid not null references roles(id) on delete cascade,
  primary key (user_id, role_id)
);

create table if not exists groups (
  id uuid primary key default gen_random_uuid(),
  name varchar(128) unique not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists user_groups (
  user_id uuid not null references users(id) on delete cascade,
  group_id uuid not null references groups(id) on delete cascade,
  primary key (user_id, group_id)
);

create table if not exists patients (
  id uuid primary key default gen_random_uuid(),
  patient_hash varchar(128) unique not null,
  patient_id_enc text,
  name_enc text,
  name_search text,
  birth_date date,
  sex varchar(16),
  created_at timestamptz not null default now()
);

create table if not exists studies (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id),
  study_instance_uid varchar(128) unique not null,
  accession_number varchar(64),
  modality varchar(32),
  study_date date,
  study_description text,
  status varchar(32) not null default 'available',
  source_pacs_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists series (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null references studies(id) on delete cascade,
  series_instance_uid varchar(128) unique not null,
  modality varchar(32),
  series_number integer,
  body_part varchar(64),
  image_count integer not null default 0
);

create table if not exists instances (
  id uuid primary key default gen_random_uuid(),
  series_id uuid not null references series(id) on delete cascade,
  sop_instance_uid varchar(128) unique not null,
  instance_number integer,
  storage_uri text,
  dicom_tags jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null references studies(id) on delete cascade,
  author_id uuid not null references users(id),
  status report_status not null default 'draft',
  content text not null,
  version integer not null default 1,
  signed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists report_templates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references users(id) on delete cascade,
  modality varchar(32) not null,
  title varchar(128) not null,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists audit_events (
  id bigserial primary key,
  occurred_at timestamptz not null default now(),
  actor_user_id uuid,
  action varchar(128) not null,
  resource_type varchar(64) not null,
  resource_id varchar(128),
  ip_address inet,
  user_agent text,
  metadata jsonb not null default '{}',
  integrity_hash varchar(128) not null,
  unique (id, integrity_hash)
);

create table if not exists system_settings (
  key varchar(128) primary key,
  value text not null,
  category varchar(64) not null,
  label varchar(128) not null,
  description text,
  is_secret boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

create index if not exists idx_users_username on users(username);
create index if not exists idx_groups_name on groups(name);
create index if not exists idx_patients_hash on patients(patient_hash);
create index if not exists idx_studies_accession on studies(accession_number);
create index if not exists idx_studies_modality on studies(modality);
create index if not exists idx_studies_date on studies(study_date);
create index if not exists idx_studies_date_modality on studies(study_date, modality);
create index if not exists idx_series_study on series(study_id);
create index if not exists idx_instances_series on instances(series_id);
create index if not exists idx_instances_tags_gin on instances using gin(dicom_tags);
create index if not exists idx_report_templates_owner on report_templates(owner_id);
create index if not exists idx_report_templates_modality on report_templates(modality);
create index if not exists idx_report_templates_owner_modality on report_templates(owner_id, modality);
create index if not exists idx_audit_time on audit_events(occurred_at);
create index if not exists idx_audit_actor on audit_events(actor_user_id);
create index if not exists idx_audit_action on audit_events(action);
create index if not exists idx_audit_metadata_gin on audit_events using gin(metadata);
create index if not exists idx_system_settings_category on system_settings(category);
