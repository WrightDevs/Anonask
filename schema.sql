
-- ---------- profiles: the public handle for each account ----------
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  username     text unique not null check (username ~ '^[a-z0-9-]{3,20}$'),
  display_name text,
  created_at   timestamptz not null default now()
);

-- ---------- messages: belong to the RECIPIENT, never a sender ----------
create table if not exists public.messages (
  id           uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  content      text not null check (char_length(content) between 1 and 500),
  created_at   timestamptz not null default now(),
  is_read      boolean not null default false,
  status       text not null default 'active'
               check (status in ('active','reported','deleted'))
);

-- Fast inbox loads: newest active notes for a recipient.
create index if not exists messages_recipient_idx
  on public.messages (recipient_id, created_at desc);

-- ============================================================
--  Row Level Security
-- ============================================================
alter table public.profiles enable row level security;
alter table public.messages enable row level security;

-- ---------- profiles policies ----------
drop policy if exists "profiles are public" on public.profiles;
create policy "profiles are public"
  on public.profiles for select
  using (true);

drop policy if exists "insert own profile" on public.profiles;
create policy "insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "update own profile" on public.profiles;
create policy "update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ---------- messages policies ----------

-- Anyone (logged in or not) may drop a note. Length + clean defaults enforced.
drop policy if exists "anyone can send" on public.messages;
create policy "anyone can send"
  on public.messages for insert
  with check (
    char_length(content) between 1 and 500
    and status = 'active'
    and is_read = false
  );

-- Only the recipient can read their own inbox.
drop policy if exists "recipient reads own" on public.messages;
create policy "recipient reads own"
  on public.messages for select
  using (auth.uid() = recipient_id);

-- Only the recipient can update (mark read / report / soft-delete).
drop policy if exists "recipient updates own" on public.messages;
create policy "recipient updates own"
  on public.messages for update
  using (auth.uid() = recipient_id)
  with check (auth.uid() = recipient_id);

-- Only the recipient can hard-delete.
drop policy if exists "recipient deletes own" on public.messages;
create policy "recipient deletes own"
  on public.messages for delete
  using (auth.uid() = recipient_id);

-- ============================================================
--  Optional: live inbox updates (new notes appear instantly).
--  If this line errors with "already member", it's already on — ignore it.
-- ============================================================
alter publication supabase_realtime add table public.messages;
