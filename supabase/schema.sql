-- Supabase schema draft for future online Blood on the Clocktower rooms.
-- This file is documentation and migration preparation only.
-- It is not wired to the application yet.

create extension if not exists pgcrypto;

create table if not exists online_rooms (
  id uuid primary key default gen_random_uuid(),
  room_code text not null unique,
  game_id text null,
  storyteller_user_id text not null,
  status text not null check (status in ('waiting', 'playing', 'ended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table online_rooms is
  'Online room metadata. room_code is entered by players to join; game_id maps to the frontend Game.id.';
comment on column online_rooms.storyteller_user_id is
  'Text for now because the auth model is not decided yet.';

create table if not exists room_members (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references online_rooms(id) on delete cascade,
  user_id text not null,
  display_name text not null,
  role text not null check (role in ('storyteller', 'player', 'spectator')),
  player_id text null,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz null,
  constraint room_members_room_user_unique unique (room_id, user_id)
);

comment on table room_members is
  'Members inside an online room. player_id can bind a room member to Game.players[].id.';

create table if not exists game_states (
  game_id text primary key,
  room_id uuid not null references online_rooms(id) on delete cascade,
  state_json jsonb not null,
  version integer not null default 1,
  updated_at timestamptz not null default now()
);

comment on table game_states is
  'Stores the full serialized Game state. version is reserved for optimistic concurrency checks.';

create index if not exists game_states_room_id_idx
  on game_states(room_id);

create table if not exists game_actions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references online_rooms(id) on delete cascade,
  game_id text not null references game_states(game_id) on delete cascade,
  actor_user_id text not null,
  actor_member_id uuid null references room_members(id) on delete set null,
  action_type text not null,
  payload jsonb not null,
  client_action_id text null,
  created_at timestamptz not null default now(),
  constraint game_actions_game_client_action_unique unique (
    game_id,
    client_action_id
  )
);

comment on table game_actions is
  'Append-only action audit log for replay, debugging, and duplicate-submit protection.';
comment on column game_actions.payload is
  'Stores the submitted GameAction envelope payload.';
comment on column game_actions.client_action_id is
  'Client-generated id for idempotency. PostgreSQL unique constraints allow multiple null values.';

create index if not exists game_actions_game_created_at_idx
  on game_actions(game_id, created_at);

create index if not exists game_actions_room_created_at_idx
  on game_actions(room_id, created_at);

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists online_rooms_set_updated_at on online_rooms;
create trigger online_rooms_set_updated_at
before update on online_rooms
for each row
execute function set_updated_at();

drop trigger if exists game_states_set_updated_at on game_states;
create trigger game_states_set_updated_at
before update on game_states
for each row
execute function set_updated_at();

create or replace function submit_game_action(
  p_room_id uuid,
  p_game_id text,
  p_actor_user_id text,
  p_actor_member_id uuid,
  p_action_type text,
  p_payload jsonb,
  p_client_action_id text,
  p_expected_version integer,
  p_next_state_json jsonb
)
returns integer
language plpgsql
as $$
declare
  v_current_version integer;
  v_next_version integer;
begin
  select version
    into v_current_version
    from game_states
   where game_id = p_game_id
     and room_id = p_room_id
   for update;

  if not found then
    raise exception 'missing_game' using errcode = 'P0001';
  end if;

  if p_expected_version is not null and p_expected_version <> v_current_version then
    raise exception 'version_conflict' using errcode = 'P0001';
  end if;

  insert into game_actions (
    room_id,
    game_id,
    actor_user_id,
    actor_member_id,
    action_type,
    payload,
    client_action_id
  )
  values (
    p_room_id,
    p_game_id,
    p_actor_user_id,
    p_actor_member_id,
    p_action_type,
    p_payload,
    p_client_action_id
  );

  v_next_version := v_current_version + 1;

  update game_states
     set state_json = p_next_state_json,
         version = v_next_version
   where game_id = p_game_id
     and room_id = p_room_id;

  return v_next_version;
end;
$$;

comment on function submit_game_action(
  uuid,
  text,
  text,
  uuid,
  text,
  jsonb,
  text,
  integer,
  jsonb
) is
  'Atomically inserts a game action audit row and advances the serialized game state version.';

-- TODO: enable row level security after auth model is decided.
-- Open questions:
-- - Will the app use Supabase Auth users, anonymous users, or temporary userId values?
-- - Will the storyteller need service-role-only room management APIs?
-- - Which public room fields can be read before joining a room?
-- - Should spectators be allowed by room setting or storyteller approval?
