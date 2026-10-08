-- STEP 1: persistence for the new ProfileMenuSheet
-- Run the whole script in the Supabase SQL editor. It is safe to run twice.

-- 1) Public-facing profile fields (other people will see these, so they live on profiles)
alter table public.profiles
  add column if not exists bio               text        check (bio is null or char_length(bio) <= 120),
  add column if not exists theme             text        not null default 'violet'
    check (theme in ('violet','ocean','aurora','sunset','forest','gold','rose','graphite')),
  add column if not exists presence_pref     text        not null default 'online'
    check (presence_pref in ('online','idle','busy','invisible')),
  add column if not exists status_emoji      text        check (status_emoji is null or char_length(status_emoji) <= 8),
  add column if not exists status_text       text        check (status_text is null or char_length(status_text) <= 40),
  add column if not exists status_expires_at timestamptz,
  add column if not exists note_text         text        check (note_text is null or char_length(note_text) <= 60),
  add column if not exists note_expires_at   timestamptz;

-- 2) Private per-user settings (only the owner can read or write)
create table if not exists public.user_settings (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  settings   jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;

drop policy if exists "user_settings_select_own" on public.user_settings;
drop policy if exists "user_settings_insert_own" on public.user_settings;
drop policy if exists "user_settings_update_own" on public.user_settings;

create policy "user_settings_select_own" on public.user_settings
  for select to authenticated using (user_id = (select auth.uid()));
create policy "user_settings_insert_own" on public.user_settings
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "user_settings_update_own" on public.user_settings
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- 3) Atomic "change one setting" call, so two devices never overwrite each other's other keys.
--    Only whitelisted keys are accepted. twoStep, chatLock, blockScreenshots and hideIp are
--    deliberately NOT here: they need real implementations (see the roadmap), and a saved
--    flag that enforces nothing would be misleading for security features.
create or replace function public.set_user_setting(p_key text, p_value jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  if p_key <> all (array[
    'lastSeen','photoVis','showOnline','readReceipts','typing','whoCanAdd',
    'disappearing','keepArchived','enterToSend',
    'chatTheme','bubbleStyle','fontSize','autoplayMotion',
    'dnd','quietHours','previews','mentionsOnly',
    'dataSaver','autoDownload',
    'language','reduceMotion'
  ]) then
    raise exception 'Unknown setting key: %', p_key;
  end if;

  insert into public.user_settings (user_id, settings)
  values (auth.uid(), jsonb_build_object(p_key, p_value))
  on conflict (user_id) do update
    set settings   = public.user_settings.settings || jsonb_build_object(p_key, p_value),
        updated_at = now();
end;
$$;

revoke all on function public.set_user_setting(text, jsonb) from public, anon;
grant execute on function public.set_user_setting(text, jsonb) to authenticated;
