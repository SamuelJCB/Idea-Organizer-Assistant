-- Quick to-dos: small tasks that aren't projects (homework, errands).

create table public.todos (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  body        text not null check (length(trim(body)) > 0),
  due_date    date,
  done        boolean not null default false,
  done_at     timestamptz
);

create index todos_user_done_due_idx on public.todos (user_id, done, due_date);

alter table public.todos enable row level security;

create policy "todos_select_own" on public.todos
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "todos_insert_own" on public.todos
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "todos_update_own" on public.todos
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "todos_delete_own" on public.todos
  for delete to authenticated using ((select auth.uid()) = user_id);
