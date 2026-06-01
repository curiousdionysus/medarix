alter table patients add column if not exists name_search text;
alter table reports add column if not exists transcript text;
create index if not exists idx_patients_name_search on patients(name_search);
