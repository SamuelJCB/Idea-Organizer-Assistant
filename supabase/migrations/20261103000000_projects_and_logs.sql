-- Project Hub: core store.
-- Two tables (projects, project_logs), each row owned by one auth user and
-- protected by Row Level Security.

-- ---------------------------------------------------------------------------
-- projects
-- ---------------------------------------------------------------------------
create table public.projects (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at   timestamptz not null default now(),
  title        text not null check (length(trim(title)) > 0),
  domain       text,
  status       text not null default 'raw'
               check (status in ('raw', 'exploring', 'active', 'parked', 'killed', 'done')),
  next_action  text,
  notes        text,
  last_touched timestamptz not null default now()
);

create index projects_user_status_idx on public.projects (user_id, status);

-- ---------------------------------------------------------------------------
-- project_logs
-- ---------------------------------------------------------------------------
create table public.project_logs (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects (id) on delete cascade,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  body        text not null check (length(trim(body)) > 0)
);

create index project_logs_project_created_idx on public.project_logs (project_id, created_at desc);

-- ---------------------------------------------------------------------------
-- last_touched upkeep
-- Any edit to a project, or any change to its logs, bumps last_touched.
-- ---------------------------------------------------------------------------
create function public.touch_project()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.last_touched := now();
  return new;
end;
$$;

create trigger projects_touch
  before update on public.projects
  for each row execute function public.touch_project();

create function public.touch_project_from_log()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.projects
     set last_touched = now()
   where id = coalesce(new.project_id, old.project_id);
  return null;
end;
$$;

create trigger project_logs_touch
  after insert or update or delete on public.project_logs
  for each row execute function public.touch_project_from_log();

-- ---------------------------------------------------------------------------
-- Row Level Security: a user sees and changes only their own rows.
-- ---------------------------------------------------------------------------
alter table public.projects enable row level security;
alter table public.project_logs enable row level security;

create policy "projects_select_own" on public.projects
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "projects_insert_own" on public.projects
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "projects_update_own" on public.projects
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "projects_delete_own" on public.projects
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "project_logs_select_own" on public.project_logs
  for select to authenticated using ((select auth.uid()) = user_id);

-- A log can only be attached to a project the same user owns.
create policy "project_logs_insert_own" on public.project_logs
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.projects p
       where p.id = project_id and p.user_id = (select auth.uid())
    )
  );

create policy "project_logs_update_own" on public.project_logs
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "project_logs_delete_own" on public.project_logs
  for delete to authenticated using ((select auth.uid()) = user_id);
