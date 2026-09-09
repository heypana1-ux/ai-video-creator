-- =============================================================================
-- AdReel AI - initial schema
--
-- Every table is workspace scoped and protected by row level security. The
-- application additionally filters by workspace_id on every query, so a policy
-- mistake cannot silently turn into a data leak.
-- =============================================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------

-- Mirrors auth.users so the app can store a display name and its own flags.
create table if not exists public.users (
  id            uuid primary key references auth.users (id) on delete cascade,
  email         text not null unique,
  display_name  text not null default '',
  password_hash text,                      -- unused with Supabase auth; demo mode only
  is_demo       boolean not null default false,
  created_at    timestamptz not null default now()
);

create table if not exists public.workspaces (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references public.users (id) on delete cascade,
  name         text not null default 'Mein Workspace',
  credits      numeric(12, 2) not null default 500,
  onboarded_at timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists workspaces_owner_id_idx on public.workspaces (owner_id);

-- Single point of truth for "may the current user touch this workspace".
-- Extending to real teams later means changing only this function.
create or replace function public.is_workspace_member(target_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspaces w
    where w.id = target_workspace
      and w.owner_id = auth.uid()
  );
$$;

-- -----------------------------------------------------------------------------
-- Core content
-- -----------------------------------------------------------------------------

create table if not exists public.brand_kits (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.workspaces (id) on delete cascade,
  name            text not null,
  primary_color   text not null,
  secondary_color text not null,
  accent_color    text not null,
  font_family     text not null default 'Inter',
  logo_asset_id   uuid,
  created_at      timestamptz not null default now()
);

create index if not exists brand_kits_workspace_idx on public.brand_kits (workspace_id);

create table if not exists public.projects (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null references public.workspaces (id) on delete cascade,
  owner_id            uuid not null references public.users (id) on delete cascade,
  name                text not null,
  category            text not null check (category in (
                        'music','website','app','mixing_mastering',
                        'product','service','event','custom')),
  status              text not null default 'draft' check (status in (
                        'draft','concept_generating','media_generating',
                        'rendering','ready','failed')),
  brief               jsonb not null default '{}'::jsonb,
  selected_concept_id uuid,
  thumbnail_url       text,
  duration_seconds    integer not null default 15,
  brand_kit_id        uuid references public.brand_kits (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists projects_workspace_idx on public.projects (workspace_id, updated_at desc);

create table if not exists public.project_assets (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id   uuid references public.projects (id) on delete cascade,
  kind         text not null check (kind in (
                 'image','video','audio','logo','screenshot','cover','other')),
  file_name    text not null,
  mime_type    text not null,
  byte_size    bigint not null default 0,
  url          text not null,
  storage_key  text not null,
  width        integer,
  height       integer,
  duration_ms  integer,
  is_demo      boolean not null default false,
  created_at   timestamptz not null default now()
);

create index if not exists project_assets_workspace_idx
  on public.project_assets (workspace_id, created_at desc);
create index if not exists project_assets_project_idx on public.project_assets (project_id);

create table if not exists public.concepts (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references public.workspaces (id) on delete cascade,
  project_id        uuid not null references public.projects (id) on delete cascade,
  title             text not null,
  big_idea          text not null default '',
  audience          text not null default '',
  hook              text not null default '',
  voiceover_script  text not null default '',
  call_to_action    text not null default '',
  caption           text not null default '',
  hashtags          jsonb not null default '[]'::jsonb,
  rationale         text not null default '',
  music_note        text not null default '',
  music_url         text,
  style_id          text not null default 'viral_ugc',
  selected          boolean not null default false,
  is_demo           boolean not null default false,
  created_at        timestamptz not null default now()
);

create index if not exists concepts_project_idx on public.concepts (project_id, created_at);

create table if not exists public.scenes (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null references public.workspaces (id) on delete cascade,
  project_id          uuid not null references public.projects (id) on delete cascade,
  concept_id          uuid not null references public.concepts (id) on delete cascade,
  index               integer not null,
  duration_ms         integer not null,
  title               text not null default '',
  visual_description  text not null default '',
  source              jsonb not null default '{}'::jsonb,
  text                jsonb not null default '{}'::jsonb,
  transition          text not null default 'fade',
  effect              text not null default 'ken_burns',
  voiceover_text      text not null default '',
  voiceover_asset_id  uuid,
  voiceover_url       text,
  voiceover_words     jsonb not null default '[]'::jsonb,
  voice_volume        numeric(4, 3) not null default 1,
  music_volume        numeric(4, 3) not null default 0.25,
  show_subtitles      boolean not null default true,
  sound_note          text not null default ''
);

create index if not exists scenes_concept_idx on public.scenes (concept_id, index);

create table if not exists public.scene_assets (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  scene_id     uuid not null references public.scenes (id) on delete cascade,
  asset_id     uuid not null references public.project_assets (id) on delete cascade,
  role         text not null default 'background',
  created_at   timestamptz not null default now(),
  unique (scene_id, role)
);

create index if not exists scene_assets_scene_idx on public.scene_assets (scene_id);

-- -----------------------------------------------------------------------------
-- Jobs, exports, accounting
-- -----------------------------------------------------------------------------

create table if not exists public.generation_jobs (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.workspaces (id) on delete cascade,
  project_id      uuid not null references public.projects (id) on delete cascade,
  kind            text not null check (kind in (
                    'concepts','scene_media','voiceover','music','website_import')),
  status          text not null default 'queued' check (status in (
                    'queued','running','succeeded','failed','cancelled')),
  progress        numeric(4, 3) not null default 0,
  step            text not null default '',
  error           text,
  result_ref      text,
  provider_job_id text,
  credits_spent   numeric(10, 2) not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists generation_jobs_project_idx
  on public.generation_jobs (project_id, created_at desc);

create table if not exists public.render_jobs (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  project_id    uuid not null references public.projects (id) on delete cascade,
  concept_id    uuid not null references public.concepts (id) on delete cascade,
  quality       text not null default 'preview' check (quality in ('preview','final')),
  status        text not null default 'queued' check (status in (
                  'queued','running','succeeded','failed','cancelled')),
  progress      numeric(4, 3) not null default 0,
  step          text not null default '',
  error         text,
  export_id     uuid,
  credits_spent numeric(10, 2) not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists render_jobs_project_idx
  on public.render_jobs (project_id, created_at desc);

create table if not exists public.exports (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  project_id    uuid not null references public.projects (id) on delete cascade,
  render_job_id uuid not null references public.render_jobs (id) on delete cascade,
  quality       text not null check (quality in ('preview','final')),
  width         integer not null,
  height        integer not null,
  fps           integer not null default 30,
  duration_ms   integer not null,
  byte_size     bigint not null default 0,
  url           text not null,
  storage_key   text not null,
  is_demo       boolean not null default false,
  created_at    timestamptz not null default now()
);

create index if not exists exports_project_idx on public.exports (project_id, created_at desc);

alter table public.render_jobs
  add constraint render_jobs_export_fk
  foreign key (export_id) references public.exports (id) on delete set null;

create table if not exists public.provider_usage (
  id                 uuid primary key default gen_random_uuid(),
  workspace_id       uuid not null references public.workspaces (id) on delete cascade,
  project_id         uuid references public.projects (id) on delete set null,
  provider_kind      text not null,
  provider_id        text not null,
  operation          text not null,
  provider_job_id    text,
  duration_ms        integer not null default 0,
  estimated_cost_usd numeric(10, 4) not null default 0,
  credits            numeric(10, 2) not null default 0,
  success            boolean not null default true,
  created_at         timestamptz not null default now()
);

create index if not exists provider_usage_workspace_idx
  on public.provider_usage (workspace_id, created_at desc);

create table if not exists public.subscriptions (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null unique references public.workspaces (id) on delete cascade,
  plan              text not null default 'demo' check (plan in ('demo','starter','creator','studio')),
  status            text not null default 'active' check (status in ('active','past_due','cancelled')),
  credits_per_month integer not null default 500,
  renews_at         timestamptz,
  created_at        timestamptz not null default now()
);

create table if not exists public.credit_transactions (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  project_id    uuid references public.projects (id) on delete set null,
  amount        numeric(10, 2) not null,
  reason        text not null,
  balance_after numeric(12, 2) not null,
  created_at    timestamptz not null default now()
);

create index if not exists credit_transactions_workspace_idx
  on public.credit_transactions (workspace_id, created_at desc);

-- -----------------------------------------------------------------------------
-- updated_at maintenance
-- -----------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists projects_touch_updated_at on public.projects;
create trigger projects_touch_updated_at
  before update on public.projects
  for each row execute function public.touch_updated_at();

drop trigger if exists generation_jobs_touch_updated_at on public.generation_jobs;
create trigger generation_jobs_touch_updated_at
  before update on public.generation_jobs
  for each row execute function public.touch_updated_at();

drop trigger if exists render_jobs_touch_updated_at on public.render_jobs;
create trigger render_jobs_touch_updated_at
  before update on public.render_jobs
  for each row execute function public.touch_updated_at();

-- -----------------------------------------------------------------------------
-- Row level security
-- -----------------------------------------------------------------------------

alter table public.users               enable row level security;
alter table public.workspaces          enable row level security;
alter table public.brand_kits          enable row level security;
alter table public.projects            enable row level security;
alter table public.project_assets      enable row level security;
alter table public.concepts            enable row level security;
alter table public.scenes              enable row level security;
alter table public.scene_assets        enable row level security;
alter table public.generation_jobs     enable row level security;
alter table public.render_jobs         enable row level security;
alter table public.exports             enable row level security;
alter table public.provider_usage      enable row level security;
alter table public.subscriptions       enable row level security;
alter table public.credit_transactions enable row level security;

-- users: a row is visible only to the account it belongs to.
drop policy if exists users_self_select on public.users;
create policy users_self_select on public.users
  for select using (id = auth.uid());

drop policy if exists users_self_insert on public.users;
create policy users_self_insert on public.users
  for insert with check (id = auth.uid());

drop policy if exists users_self_update on public.users;
create policy users_self_update on public.users
  for update using (id = auth.uid()) with check (id = auth.uid());

-- workspaces: owner only.
drop policy if exists workspaces_owner_all on public.workspaces;
create policy workspaces_owner_all on public.workspaces
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Every workspace scoped table shares the same policy shape.
do $$
declare
  target text;
begin
  foreach target in array array[
    'brand_kits','projects','project_assets','concepts','scenes','scene_assets',
    'generation_jobs','render_jobs','exports','provider_usage','subscriptions',
    'credit_transactions'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', target || '_workspace_all', target);
    execute format(
      'create policy %I on public.%I for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id))',
      target || '_workspace_all',
      target
    );
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- Storage: private bucket, one folder per workspace
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('adreel-media', 'adreel-media', false)
on conflict (id) do nothing;

drop policy if exists adreel_media_workspace_read on storage.objects;
create policy adreel_media_workspace_read on storage.objects
  for select using (
    bucket_id = 'adreel-media'
    and public.is_workspace_member(nullif(split_part(name, '/', 1), '')::uuid)
  );

drop policy if exists adreel_media_workspace_write on storage.objects;
create policy adreel_media_workspace_write on storage.objects
  for insert with check (
    bucket_id = 'adreel-media'
    and public.is_workspace_member(nullif(split_part(name, '/', 1), '')::uuid)
  );

drop policy if exists adreel_media_workspace_delete on storage.objects;
create policy adreel_media_workspace_delete on storage.objects
  for delete using (
    bucket_id = 'adreel-media'
    and public.is_workspace_member(nullif(split_part(name, '/', 1), '')::uuid)
  );
