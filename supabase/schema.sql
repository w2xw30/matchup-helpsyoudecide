-- =====================================================================
--  Matchup — database schema for Supabase
--  Paste this whole file into: Supabase dashboard → SQL Editor → New query → Run.
--  It is safe to run more than once.
-- =====================================================================


-- ---------------------------------------------------------------------
--  Tables
-- ---------------------------------------------------------------------

create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  name        text not null default 'Guest',
  handle      text unique,                       -- lowercase username, e.g. "alex"
  bio         text not null default '',
  avatar      text not null default '',
  created_at  timestamptz not null default now()
);

-- emails live in their own table so profiles can be public without exposing them
create table if not exists public.private_emails (
  user_id  uuid primary key references auth.users (id) on delete cascade,
  email    text not null
);
create unique index if not exists private_emails_email_key on public.private_emails (lower(email));

create table if not exists public.lobbies (
  id              text primary key,
  code            text not null unique,          -- 6-digit session code
  name            text not null,
  description     text not null default '',
  kind            text not null default 'mixed',
  emoji           text not null default '🎉',
  deadline        text not null default '20:00',
  required_match  int  not null default 75 check (required_match in (50, 75, 100)),
  allow_friends   boolean not null default true,
  link_access     boolean not null default true,
  max_members     int  not null default 12 check (max_members between 2 and 50),
  locked          boolean not null default false,
  round           int  not null default 1,
  runoff          jsonb,                         -- item ids in play during a runoff
  decision        jsonb,                         -- set when the group locks in a pick
  history         jsonb not null default '[]'::jsonb,
  phase           text not null default 'planning' check (phase in ('planning', 'voting')),
  revealed        boolean not null default false,   -- an admin revealed this round's results early
  owner_id        uuid references auth.users (id) on delete set null,   -- creator (kept for reference)
  created_at      timestamptz not null default now()
);

create table if not exists public.lobby_members (
  lobby_id   text not null references public.lobbies (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  nickname   text not null,
  role       text not null default 'member' check (role in ('owner', 'admin', 'member')),
  ready      boolean not null default false,
  joined_at  timestamptz not null default now(),
  primary key (lobby_id, user_id)
);

create table if not exists public.lobby_invites (
  id          text primary key,
  lobby_id    text not null references public.lobbies (id) on delete cascade,
  handle      text not null,                     -- email or username that was invited
  invited_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);

create table if not exists public.lobby_items (
  id         text primary key,
  lobby_id   text not null references public.lobbies (id) on delete cascade,
  title      text not null,
  by_id      uuid references auth.users (id) on delete set null,
  by_name    text,
  kind       text not null default 'other',
  emoji      text not null default '✨',
  image      text,
  note       text,
  price      text,
  rating     text,
  distance   text,
  url        text,
  pos        double precision,
  added_at   timestamptz not null default now()
);

create table if not exists public.lobby_messages (
  id          text primary key,
  lobby_id    text not null references public.lobbies (id) on delete cascade,
  user_id     uuid references auth.users (id) on delete set null,
  from_name   text,
  body        text not null,
  created_at  timestamptz not null default now()
);

create table if not exists public.lobby_votes (
  lobby_id    text not null references public.lobbies (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  round       int  not null default 1,
  item_id     text not null references public.lobby_items (id) on delete cascade,
  choice      text not null check (choice in ('like', 'nope')),
  updated_at  timestamptz not null default now(),
  primary key (lobby_id, user_id, round, item_id)
);

create table if not exists public.friendships (
  id          uuid primary key default gen_random_uuid(),
  requester   uuid not null references auth.users (id) on delete cascade,
  addressee   uuid not null references auth.users (id) on delete cascade,
  status      text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at  timestamptz not null default now(),
  unique (requester, addressee),
  check (requester <> addressee)
);

create table if not exists public.clans (
  id           text primary key,
  owner_id     uuid not null references auth.users (id) on delete cascade,
  name         text not null,
  emoji        text not null default '🏕️',
  description  text not null default '',
  created_at   timestamptz not null default now()
);

create table if not exists public.clan_members (
  clan_id   text not null references public.clans (id) on delete cascade,
  user_id   uuid not null references auth.users (id) on delete cascade,
  primary key (clan_id, user_id)
);

-- for databases created before voting phases existed
alter table public.lobbies add column if not exists phase text not null default 'planning';
alter table public.lobbies add column if not exists revealed boolean not null default false;
do $$ begin
  alter table public.lobbies add constraint lobbies_phase_check check (phase in ('planning', 'voting'));
exception when duplicate_object then null;
end $$;

create index if not exists lobby_members_user_idx on public.lobby_members (user_id);
create index if not exists lobby_items_lobby_idx on public.lobby_items (lobby_id);
create index if not exists lobby_messages_lobby_idx on public.lobby_messages (lobby_id, created_at);
create index if not exists lobby_votes_lobby_idx on public.lobby_votes (lobby_id);

-- ---------------------------------------------------------------------
--  Helper functions (SECURITY DEFINER so policies can look at membership
--  without tripping over the policies on the same tables)
-- ---------------------------------------------------------------------

create or replace function public.is_lobby_member(l text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from lobby_members where lobby_id = l and user_id = auth.uid());
$$;

create or replace function public.is_lobby_admin(l text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from lobby_members where lobby_id = l and user_id = auth.uid() and role in ('owner', 'admin'));
$$;

create or replace function public.is_lobby_owner(l text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from lobby_members where lobby_id = l and user_id = auth.uid() and role = 'owner');
$$;

create or replace function public.is_lobby_creator(l text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from lobbies where id = l and owner_id = auth.uid());
$$;

create or replace function public.can_add_items(l text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from lobbies b
    join lobby_members m on m.lobby_id = b.id and m.user_id = auth.uid()
    where b.id = l and not b.locked and b.phase <> 'voting' and (b.allow_friends or m.role in ('owner', 'admin'))
  );
$$;

-- voting is only open once an admin/owner starts it (and stops when a decision is locked in)
create or replace function public.is_lobby_voting(l text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from lobbies where id = l and phase = 'voting' and decision is null);
$$;

-- has every member answered every option currently in play?
create or replace function public.lobby_all_voted(l text) returns boolean
language sql stable security definer set search_path = public as $$
  with b as (select id, round, runoff from lobbies where id = l),
  deck as (
    select count(*)::int as n from lobby_items i, b
    where i.lobby_id = b.id and (b.runoff is null or b.runoff ? i.id)
  )
  select coalesce(
    (select n from deck) > 0
    and not exists (
      select 1 from lobby_members m, b
      where m.lobby_id = b.id
        and (select count(*) from lobby_votes v
             where v.lobby_id = b.id and v.user_id = m.user_id and v.round = b.round
               and (b.runoff is null or b.runoff ? v.item_id)) < (select n from deck)
    ),
    false);
$$;

-- other people's votes stay hidden until everyone finished, an admin revealed them, or a decision was made
create or replace function public.votes_visible(l text, r int) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from lobbies b where b.id = l and (r < b.round or b.revealed or b.decision is not null))
      or public.lobby_all_voted(l);
$$;

create or replace function public.is_clan_owner(c text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from clans where id = c and owner_id = auth.uid());
$$;

create or replace function public.is_clan_member(c text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from clan_members where clan_id = c and user_id = auth.uid());
$$;

-- does an invite handle (email or username) belong to the signed-in user?
create or replace function public.invite_is_mine(h text) returns boolean
language sql stable security definer set search_path = public as $$
  select
    lower(h) = lower(coalesce((select email from private_emails where user_id = auth.uid()), '-'))
    or lower(regexp_replace(h, '^@', '')) = lower(coalesce((select handle from profiles where id = auth.uid()), '-'));
$$;

-- ---------------------------------------------------------------------
--  Guard triggers (things row-level security alone can't express)
-- ---------------------------------------------------------------------

create or replace function public.guard_lobby_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;              -- dashboard / service role
  if new.id <> old.id or new.owner_id <> old.owner_id then
    raise exception 'lobby id and creator cannot change';
  end if;
  return new;
end $$;
drop trigger if exists guard_lobby_update on public.lobbies;
create trigger guard_lobby_update before update on public.lobbies for each row execute function public.guard_lobby_update();

create or replace function public.guard_member_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  if new.lobby_id <> old.lobby_id or new.user_id <> old.user_id then raise exception 'immutable'; end if;
  if old.user_id <> auth.uid() and not is_lobby_admin(old.lobby_id) then raise exception 'not allowed'; end if;
  -- only people can change their own nickname / ready flag
  if old.user_id <> auth.uid() and (new.ready is distinct from old.ready or new.nickname is distinct from old.nickname) then
    raise exception 'you can only change your own nickname and ready state';
  end if;
  if new.role is distinct from old.role then
    if not is_lobby_admin(old.lobby_id) then raise exception 'only admins can change roles'; end if;
    if (new.role = 'owner' or old.role = 'owner') and not is_lobby_owner(old.lobby_id) then
      raise exception 'only the owner can change ownership';
    end if;
    if old.role = 'admin' and new.role = 'member' and not is_lobby_owner(old.lobby_id) then
      raise exception 'only the owner can remove an admin';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists guard_member_update on public.lobby_members;
create trigger guard_member_update before update on public.lobby_members for each row execute function public.guard_member_update();

create or replace function public.guard_member_delete() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return old; end if;
  if old.user_id <> auth.uid() then
    if old.role = 'owner' then raise exception 'the owner cannot be removed'; end if;
    if old.role = 'admin' and not is_lobby_owner(old.lobby_id) then raise exception 'only the owner can remove an admin'; end if;
  end if;
  return old;
end $$;
drop trigger if exists guard_member_delete on public.lobby_members;
create trigger guard_member_delete before delete on public.lobby_members for each row execute function public.guard_member_delete();

-- ---------------------------------------------------------------------
--  Row-level security
-- ---------------------------------------------------------------------

alter table public.profiles        enable row level security;
alter table public.private_emails  enable row level security;
alter table public.lobbies         enable row level security;
alter table public.lobby_members   enable row level security;
alter table public.lobby_invites   enable row level security;
alter table public.lobby_items     enable row level security;
alter table public.lobby_messages  enable row level security;
alter table public.lobby_votes     enable row level security;
alter table public.friendships     enable row level security;
alter table public.clans           enable row level security;
alter table public.clan_members    enable row level security;

-- drop old versions so this file can be re-run
do $$ declare r record; begin
  for r in select schemaname, tablename, policyname from pg_policies where schemaname = 'public' and policyname like 'mu\_%' loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- profiles: names/avatars are public to signed-in users; you edit only your own
create policy mu_profiles_read   on public.profiles for select to authenticated using (true);
create policy mu_profiles_insert on public.profiles for insert to authenticated with check (id = auth.uid());
create policy mu_profiles_update on public.profiles for update to authenticated using (id = auth.uid());

create policy mu_emails_read   on public.private_emails for select to authenticated using (user_id = auth.uid());
create policy mu_emails_insert on public.private_emails for insert to authenticated with check (user_id = auth.uid());
create policy mu_emails_update on public.private_emails for update to authenticated using (user_id = auth.uid());

-- lobbies
create policy mu_lobbies_read   on public.lobbies for select to authenticated using (public.is_lobby_member(id));
create policy mu_lobbies_insert on public.lobbies for insert to authenticated with check (owner_id = auth.uid());
create policy mu_lobbies_update on public.lobbies for update to authenticated using (public.is_lobby_admin(id));
create policy mu_lobbies_delete on public.lobbies for delete to authenticated using (public.is_lobby_owner(id));

-- members (joining goes through the join_lobby() function below)
create policy mu_members_read   on public.lobby_members for select to authenticated using (public.is_lobby_member(lobby_id));
create policy mu_members_insert on public.lobby_members for insert to authenticated
  with check (user_id = auth.uid() and role = 'owner' and public.is_lobby_creator(lobby_id));
create policy mu_members_update on public.lobby_members for update to authenticated
  using (user_id = auth.uid() or public.is_lobby_admin(lobby_id));
create policy mu_members_delete on public.lobby_members for delete to authenticated
  using (user_id = auth.uid() or public.is_lobby_admin(lobby_id));

-- invites
create policy mu_invites_read   on public.lobby_invites for select to authenticated using (public.is_lobby_member(lobby_id));
create policy mu_invites_insert on public.lobby_invites for insert to authenticated with check (public.is_lobby_admin(lobby_id) and invited_by = auth.uid());
create policy mu_invites_delete on public.lobby_invites for delete to authenticated using (public.is_lobby_admin(lobby_id));

-- items
create policy mu_items_read   on public.lobby_items for select to authenticated using (public.is_lobby_member(lobby_id));
create policy mu_items_insert on public.lobby_items for insert to authenticated with check (by_id = auth.uid() and public.can_add_items(lobby_id));
create policy mu_items_update on public.lobby_items for update to authenticated using (public.is_lobby_admin(lobby_id) or by_id = auth.uid());
create policy mu_items_delete on public.lobby_items for delete to authenticated using (public.is_lobby_admin(lobby_id) or by_id = auth.uid());

-- chat
create policy mu_msgs_read   on public.lobby_messages for select to authenticated using (public.is_lobby_member(lobby_id));
create policy mu_msgs_insert on public.lobby_messages for insert to authenticated with check (user_id = auth.uid() and public.is_lobby_member(lobby_id));

-- votes: you only write your own, and only while an admin has voting open; you see others' after the reveal
create policy mu_votes_read   on public.lobby_votes for select to authenticated
  using (user_id = auth.uid() or (public.is_lobby_member(lobby_id) and public.votes_visible(lobby_id, round)));
create policy mu_votes_insert on public.lobby_votes for insert to authenticated
  with check (user_id = auth.uid() and public.is_lobby_member(lobby_id) and public.is_lobby_voting(lobby_id));
create policy mu_votes_update on public.lobby_votes for update to authenticated
  using (user_id = auth.uid() and public.is_lobby_voting(lobby_id));
create policy mu_votes_delete on public.lobby_votes for delete to authenticated
  using (user_id = auth.uid() and public.is_lobby_voting(lobby_id));

-- friendships (requests are created through send_friend_request())
create policy mu_friends_read   on public.friendships for select to authenticated using (auth.uid() in (requester, addressee));
create policy mu_friends_update on public.friendships for update to authenticated using (addressee = auth.uid()) with check (status = 'accepted');
create policy mu_friends_delete on public.friendships for delete to authenticated using (auth.uid() in (requester, addressee));

-- clans
create policy mu_clans_read   on public.clans for select to authenticated using (owner_id = auth.uid() or public.is_clan_member(id));
create policy mu_clans_insert on public.clans for insert to authenticated with check (owner_id = auth.uid());
create policy mu_clans_update on public.clans for update to authenticated using (owner_id = auth.uid());
create policy mu_clans_delete on public.clans for delete to authenticated using (owner_id = auth.uid());

create policy mu_clanm_read   on public.clan_members for select to authenticated using (public.is_clan_owner(clan_id) or user_id = auth.uid());
create policy mu_clanm_insert on public.clan_members for insert to authenticated with check (public.is_clan_owner(clan_id));
create policy mu_clanm_delete on public.clan_members for delete to authenticated using (public.is_clan_owner(clan_id));

-- ---------------------------------------------------------------------
--  Functions the app calls
-- ---------------------------------------------------------------------

-- Everything about one lobby in a single JSON document (members, items, chat, votes…).
create or replace function public.lobby_bundle(l text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', b.id, 'code', b.code, 'name', b.name, 'description', b.description, 'kind', b.kind, 'emoji', b.emoji,
    'deadline', b.deadline, 'required_match', b.required_match, 'allow_friends', b.allow_friends,
    'link_access', b.link_access, 'max_members', b.max_members, 'locked', b.locked,
    'round', b.round, 'phase', b.phase, 'revealed', b.revealed, 'runoff', b.runoff, 'decision', b.decision, 'history', b.history,
    'deck_size', case when b.runoff is not null then jsonb_array_length(b.runoff) else (select count(*) from lobby_items t2 where t2.lobby_id = b.id) end,
    'progress', coalesce((
      select jsonb_object_agg(x.uid, x.n) from (
        select v.user_id::text as uid, count(*) as n from lobby_votes v
        where v.lobby_id = b.id and v.round = b.round and (b.runoff is null or b.runoff ? v.item_id)
        group by v.user_id) x), '{}'::jsonb),
    'created_at', (extract(epoch from b.created_at) * 1000)::bigint,
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id', m.user_id, 'nickname', m.nickname, 'role', m.role, 'ready', m.ready,
        'joined_at', (extract(epoch from m.joined_at) * 1000)::bigint,
        'avatar', p.avatar, 'full_name', p.name) order by m.joined_at)
      from lobby_members m left join profiles p on p.id = m.user_id where m.lobby_id = b.id), '[]'::jsonb),
    'invites', coalesce((
      select jsonb_agg(jsonb_build_object('id', i.id, 'handle', i.handle, 'created_at', (extract(epoch from i.created_at) * 1000)::bigint) order by i.created_at)
      from lobby_invites i where i.lobby_id = b.id), '[]'::jsonb),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id, 'title', t.title, 'by_id', t.by_id, 'by_name', t.by_name, 'kind', t.kind, 'emoji', t.emoji,
        'image', t.image, 'note', t.note, 'price', t.price, 'rating', t.rating, 'distance', t.distance, 'url', t.url,
        'pos', t.pos, 'added_at', (extract(epoch from t.added_at) * 1000)::bigint) order by t.added_at)
      from lobby_items t where t.lobby_id = b.id), '[]'::jsonb),
    'messages', coalesce((
      select jsonb_agg(recent.doc order by recent.ts) from (
        select jsonb_build_object('id', c.id, 'user_id', c.user_id, 'from_name', c.from_name, 'body', c.body) as doc, c.created_at as ts
        from lobby_messages c where c.lobby_id = b.id order by c.created_at desc limit 200) recent), '[]'::jsonb),
    'votes', coalesce((
      select jsonb_agg(jsonb_build_object('user_id', v.user_id, 'round', v.round, 'item_id', v.item_id, 'choice', v.choice,
        't', (extract(epoch from v.updated_at) * 1000)::bigint))
      from lobby_votes v where v.lobby_id = b.id and (v.user_id = auth.uid() or public.votes_visible(b.id, v.round))), '[]'::jsonb)
  )
  from lobbies b
  where b.id = l and public.is_lobby_member(l);
$$;

create or replace function public.my_lobby_bundles() returns setof jsonb
language sql stable security definer set search_path = public as $$
  select public.lobby_bundle(m.lobby_id) from lobby_members m where m.user_id = auth.uid();
$$;

-- what the invite page can show before someone has joined
create or replace function public.lobby_preview(l text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', b.id, 'name', b.name, 'emoji', b.emoji, 'description', b.description, 'kind', b.kind,
    'member_count', (select count(*) from lobby_members m where m.lobby_id = b.id),
    'max_members', b.max_members,
    'link_access', b.link_access or exists (select 1 from lobby_invites i where i.lobby_id = b.id and public.invite_is_mine(i.handle)),
    'is_member', public.is_lobby_member(b.id))
  from lobbies b where b.id = l;
$$;

create or replace function public.lobby_id_for_code(c text) returns text
language sql stable security definer set search_path = public as $$
  select b.id from lobbies b
  where b.code = regexp_replace(c, '\D', '', 'g')
    and (b.link_access or public.is_lobby_member(b.id)
         or exists (select 1 from lobby_invites i where i.lobby_id = b.id and public.invite_is_mine(i.handle)))
  limit 1;
$$;

create or replace function public.join_lobby(l text, nick text) returns text
language plpgsql security definer set search_path = public as $$
declare b lobbies%rowtype; cnt int;
begin
  if auth.uid() is null then return 'not_signed_in'; end if;
  select * into b from lobbies where id = l;
  if not found then return 'not_found'; end if;
  if public.is_lobby_member(l) then
    update lobby_members set nickname = left(nick, 20) where lobby_id = l and user_id = auth.uid();
    return 'ok';
  end if;
  if not b.link_access and not exists (select 1 from lobby_invites i where i.lobby_id = l and public.invite_is_mine(i.handle)) then
    return 'closed';
  end if;
  select count(*) into cnt from lobby_members where lobby_id = l;
  if cnt >= b.max_members then return 'full'; end if;
  insert into lobby_members (lobby_id, user_id, nickname, role) values (l, auth.uid(), left(nick, 20), 'member');
  delete from lobby_invites where lobby_id = l and public.invite_is_mine(handle);
  return 'ok';
end $$;

-- invites addressed to me (by email or username) for lobbies I'm not in yet
create or replace function public.my_invites() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'invite_id', i.id, 'lobby_id', b.id, 'lobby_name', b.name, 'emoji', b.emoji,
    'by_name', coalesce(p.name, 'Someone'), 'created_at', (extract(epoch from i.created_at) * 1000)::bigint) order by i.created_at desc), '[]'::jsonb)
  from lobby_invites i
  join lobbies b on b.id = i.lobby_id
  left join profiles p on p.id = i.invited_by
  where public.invite_is_mine(i.handle) and not public.is_lobby_member(b.id);
$$;

-- friends
create or replace function public.find_profile(q text) returns table (id uuid, name text, avatar text)
language sql stable security definer set search_path = public as $$
  select p.id, p.name, p.avatar from profiles p
  where p.handle = lower(regexp_replace(q, '^@', ''))
     or p.id in (select e.user_id from private_emails e where lower(e.email) = lower(q))
  limit 1;
$$;

create or replace function public.send_friend_request(q text) returns text
language plpgsql security definer set search_path = public as $$
declare target uuid; existing friendships%rowtype;
begin
  select f.id into target from public.find_profile(q) f;
  if target is null then return 'not_found'; end if;
  if target = auth.uid() then return 'self'; end if;
  select * into existing from friendships
    where (requester = auth.uid() and addressee = target) or (requester = target and addressee = auth.uid());
  if found then
    if existing.status = 'pending' and existing.requester = target then
      update friendships set status = 'accepted' where id = existing.id;
      return 'accepted';
    end if;
    return 'duplicate';
  end if;
  insert into friendships (requester, addressee) values (auth.uid(), target);
  return 'ok';
end $$;

create or replace function public.my_friends() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'user_id', o.id, 'name', o.name, 'handle', coalesce(o.handle, ''), 'avatar', o.avatar,
    'status', case when f.status = 'accepted' then 'friend' when f.requester = auth.uid() then 'pending' else 'incoming' end,
    'created_at', (extract(epoch from f.created_at) * 1000)::bigint)), '[]'::jsonb)
  from friendships f
  join profiles o on o.id = case when f.requester = auth.uid() then f.addressee else f.requester end
  where auth.uid() in (f.requester, f.addressee);
$$;

create or replace function public.my_clans() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id, 'name', c.name, 'emoji', c.emoji, 'description', c.description,
    'created_at', (extract(epoch from c.created_at) * 1000)::bigint,
    'member_ids', coalesce((select jsonb_agg(m.user_id) from clan_members m where m.clan_id = c.id), '[]'::jsonb)) order by c.created_at desc), '[]'::jsonb)
  from clans c where c.owner_id = auth.uid();
$$;

-- "Delete account" in Settings
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from auth.users where id = auth.uid();
end $$;

-- ---------------------------------------------------------------------
--  Realtime: push changes to everyone who can see them
-- ---------------------------------------------------------------------

alter table public.lobby_members  replica identity full;
alter table public.lobby_invites  replica identity full;
alter table public.lobby_items    replica identity full;
alter table public.lobby_messages replica identity full;
alter table public.lobby_votes    replica identity full;
alter table public.friendships    replica identity full;
alter table public.clan_members   replica identity full;

do $$ declare t text; begin
  foreach t in array array['lobbies','lobby_members','lobby_invites','lobby_items','lobby_messages','lobby_votes','friendships','clans','clan_members'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- functions are callable by signed-in users (guests included) only
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
