-- Flexible RBAC: role slug, label, permissions JSON; reporter builtin role.

alter table roles add column if not exists slug varchar(64);
alter table roles add column if not exists label varchar(128);
alter table roles add column if not exists description text;
alter table roles add column if not exists is_builtin boolean not null default false;
alter table roles add column if not exists permissions jsonb not null default '[]'::jsonb;
alter table roles add column if not exists created_at timestamptz not null default now();

update roles set slug = name::text where slug is null;

alter table roles drop constraint if exists roles_name_key;

do $$ begin
  alter table roles alter column name type varchar(64) using name::text;
exception when others then
  null;
end $$;

drop type if exists role_name;

update roles set name = slug where name is distinct from slug or name is null;
alter table roles alter column slug set not null;

create unique index if not exists idx_roles_slug on roles(slug);

insert into roles (name, slug, label, is_builtin, permissions)
select
  'reporter',
  'reporter',
  'Raportör',
  true,
  '[]'::jsonb
where not exists (select 1 from roles where slug = 'reporter');

update roles set label = 'Görüntüleyici', is_builtin = true where slug = 'viewer' and (label is null or label = '');
update roles set label = 'Radyolog', is_builtin = true where slug = 'radiologist' and (label is null or label = '');
update roles set label = 'Admin', is_builtin = true where slug = 'admin' and (label is null or label = '');
update roles set label = 'Teknisyen', is_builtin = true where slug = 'technician' and (label is null or label = '');
update roles set label = 'Dış Konsültan', is_builtin = true where slug = 'external_consultant' and (label is null or label = '');
