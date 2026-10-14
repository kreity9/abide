-- Abide: one table holds every synced record, one row per (user, collection, key).
-- Paste this whole file into Supabase → SQL Editor → New query → Run.

create table if not exists public.notebook (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  coll       text        not null check (coll in ('days', 'prayers', 'favorites', 'meta')),
  key        text        not null,
  body       jsonb       not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, coll, key)
);

-- Row Level Security: each signed-in person can only ever see and change their own rows.
alter table public.notebook enable row level security;

drop policy if exists "own rows: read"   on public.notebook;
drop policy if exists "own rows: insert" on public.notebook;
drop policy if exists "own rows: update" on public.notebook;
drop policy if exists "own rows: delete" on public.notebook;

create policy "own rows: read"   on public.notebook for select using (auth.uid() = user_id);
create policy "own rows: insert" on public.notebook for insert with check (auth.uid() = user_id);
create policy "own rows: update" on public.notebook for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows: delete" on public.notebook for delete using (auth.uid() = user_id);

-- Live updates between phone and computer.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notebook'
  ) then
    alter publication supabase_realtime add table public.notebook;
  end if;
end $$;
