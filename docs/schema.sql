-- ============================================================
-- Mattchat — Supabase SQL Schema
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Profiles (extends auth.users)
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  username text unique not null,
  email text unique,
  avatar_url text,
  is_external boolean default false,
  created_at timestamptz default now()
);

-- Auto-create profile on sign up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    new.email
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Conversations
create table public.conversations (
  id uuid default gen_random_uuid() primary key,
  name text,
  is_group boolean default false,
  last_message text,
  updated_at timestamptz default now(),
  created_at timestamptz default now()
);

-- Conversation members (many-to-many)
create table public.conversation_members (
  conversation_id uuid references public.conversations(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  joined_at timestamptz default now(),
  primary key (conversation_id, user_id)
);

-- Messages
create table public.messages (
  id uuid default gen_random_uuid() primary key,
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  sender_id uuid references public.profiles(id) on delete set null,
  content text not null,
  is_email boolean default false,
  read_at timestamptz,
  created_at timestamptz default now()
);

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================

alter table public.profiles enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;

-- Profiles: users can read all, update their own
create policy "Profiles are viewable by all users"
  on public.profiles for select using (true);

create policy "Users can update their own profile"
  on public.profiles for update using (auth.uid() = id);

-- Conversations: only members can see
create policy "Members can view their conversations"
  on public.conversations for select
  using (
    exists (
      select 1 from public.conversation_members
      where conversation_id = id and user_id = auth.uid()
    )
  );

create policy "Members can update conversations"
  on public.conversations for update
  using (
    exists (
      select 1 from public.conversation_members
      where conversation_id = id and user_id = auth.uid()
    )
  );

create policy "Authenticated users can create conversations"
  on public.conversations for insert
  with check (auth.role() = 'authenticated');

-- Conversation members
create policy "Members can view conversation membership"
  on public.conversation_members for select
  using (
    user_id = auth.uid() or
    exists (
      select 1 from public.conversation_members cm
      where cm.conversation_id = conversation_id and cm.user_id = auth.uid()
    )
  );

create policy "Authenticated users can join conversations"
  on public.conversation_members for insert
  with check (auth.role() = 'authenticated');

-- Messages: only members of the conversation can see/send
create policy "Members can view messages"
  on public.messages for select
  using (
    exists (
      select 1 from public.conversation_members
      where conversation_id = messages.conversation_id and user_id = auth.uid()
    )
  );

create policy "Members can send messages"
  on public.messages for insert
  with check (
    sender_id = auth.uid() and
    exists (
      select 1 from public.conversation_members
      where conversation_id = messages.conversation_id and user_id = auth.uid()
    )
  );

-- ============================================================
-- Realtime
-- ============================================================
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.conversations;

-- ============================================================
-- Indexes for performance
-- ============================================================
create index on public.messages(conversation_id, created_at);
create index on public.conversation_members(user_id);
create index on public.conversations(updated_at desc);
