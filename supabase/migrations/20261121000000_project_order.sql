-- Remembers where projects sit on the dashboard board.
-- One row per user, so rearranging never counts as "touching" a project.
create table public.project_order (
  user_id    uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  ids        uuid[] not null default '{}',
  updated_at timestamptz not null default now()
);

alter table public.project_order enable row level security;

create policy "project_order_select_own" on public.project_order
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "project_order_insert_own" on public.project_order
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "project_order_update_own" on public.project_order
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "project_order_delete_own" on public.project_order
  for delete to authenticated using ((select auth.uid()) = user_id);
