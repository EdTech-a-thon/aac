-- Vocabulary domain: vocabularies, boards, buttons, management/usage relationships.
-- Applied to project rdbccbmetigibvhdwpvu (plus follow-up fixes folded into this file for fresh installs).

create schema if not exists private;

-- Profiles (email lookup + display for managers)
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  name text,
  created_at timestamptz not null default now()
);

create function private.handle_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, name)
  values (
    new.id,
    coalesce(new.email, ''),
    nullif(new.raw_user_meta_data ->> 'name', '')
  );
  return new;
end;
$$;

create function private.handle_auth_user_updated()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
  set
    email = coalesce(new.email, ''),
    name = nullif(new.raw_user_meta_data ->> 'name', '')
  where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_auth_user_created();

create trigger on_auth_user_updated
  after update of email, raw_user_meta_data on auth.users
  for each row execute function private.handle_auth_user_updated();

insert into public.profiles (id, email, name)
select
  id,
  coalesce(email, ''),
  nullif(raw_user_meta_data ->> 'name', '')
from auth.users
on conflict (id) do nothing;

create table public.vocabularies (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.boards (
  id uuid primary key default gen_random_uuid(),
  vocabulary_id uuid not null references public.vocabularies (id) on delete cascade,
  name text not null default '',
  width integer not null check (width >= 1),
  height integer not null check (height >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index boards_vocabulary_id_idx on public.boards (vocabulary_id);

create table public.buttons (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards (id) on delete cascade,
  row_index integer not null,
  col_index integer not null,
  label text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index buttons_board_id_idx on public.buttons (board_id);

create table public.vocabulary_managers (
  vocabulary_id uuid not null references public.vocabularies (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (vocabulary_id, user_id)
);

alter table public.vocabulary_managers
  add constraint vocabulary_managers_profile_fkey
  foreign key (user_id) references public.profiles (id) on delete cascade;

create index vocabulary_managers_user_id_idx on public.vocabulary_managers (user_id);

create table public.vocabulary_users (
  vocabulary_id uuid not null references public.vocabularies (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (vocabulary_id, user_id)
);

create index vocabulary_users_user_id_idx on public.vocabulary_users (user_id);

create function private.is_vocabulary_manager(p_vocabulary_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.vocabulary_managers
    where vocabulary_id = p_vocabulary_id
      and user_id = (select auth.uid())
  );
$$;

create function private.user_id_by_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id
  from public.profiles
  where lower(email) = lower(trim(p_email))
  limit 1;
$$;

create function private.shares_vocabulary_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.vocabulary_managers mine
    join public.vocabulary_managers theirs
      on theirs.vocabulary_id = mine.vocabulary_id
    where mine.user_id = (select auth.uid())
      and theirs.user_id = p_user_id
  );
$$;

create function private.prevent_removing_last_manager()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.vocabularies where id = old.vocabulary_id
  ) and not exists (
    select 1
    from public.vocabulary_managers
    where vocabulary_id = old.vocabulary_id
      and user_id is distinct from old.user_id
  ) then
    raise exception 'Vocabulary must retain at least one manager';
  end if;
  return old;
end;
$$;

create trigger vocabulary_managers_prevent_last_delete
  before delete on public.vocabulary_managers
  for each row execute function private.prevent_removing_last_manager();

create function private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger vocabularies_set_updated_at
  before update on public.vocabularies
  for each row execute function private.set_updated_at();

create trigger boards_set_updated_at
  before update on public.boards
  for each row execute function private.set_updated_at();

create trigger buttons_set_updated_at
  before update on public.buttons
  for each row execute function private.set_updated_at();

create function public.create_vocabulary(p_name text default '')
returns public.vocabularies
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.vocabularies;
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.vocabularies (name)
  values (coalesce(p_name, ''))
  returning * into v;

  insert into public.vocabulary_managers (vocabulary_id, user_id)
  values (v.id, uid);

  return v;
end;
$$;

create function public.add_vocabulary_manager(p_vocabulary_id uuid, p_email text)
returns public.vocabulary_managers
language plpgsql
security definer
set search_path = public
as $$
declare
  target_user_id uuid;
  row public.vocabulary_managers;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not private.is_vocabulary_manager(p_vocabulary_id) then
    raise exception 'Not a manager of this vocabulary';
  end if;

  target_user_id := private.user_id_by_email(p_email);
  if target_user_id is null then
    raise exception 'No user found with that email';
  end if;

  insert into public.vocabulary_managers (vocabulary_id, user_id)
  values (p_vocabulary_id, target_user_id)
  on conflict do nothing
  returning * into row;

  if row.vocabulary_id is null then
    select * into row
    from public.vocabulary_managers
    where vocabulary_id = p_vocabulary_id and user_id = target_user_id;
  end if;

  return row;
end;
$$;

create function public.remove_vocabulary_manager(p_vocabulary_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not private.is_vocabulary_manager(p_vocabulary_id) then
    raise exception 'Not a manager of this vocabulary';
  end if;

  delete from public.vocabulary_managers
  where vocabulary_id = p_vocabulary_id
    and user_id = p_user_id;

  if not found then
    raise exception 'Manager not found';
  end if;
end;
$$;

alter table public.profiles enable row level security;
alter table public.vocabularies enable row level security;
alter table public.boards enable row level security;
alter table public.buttons enable row level security;
alter table public.vocabulary_managers enable row level security;
alter table public.vocabulary_users enable row level security;

create policy "Users can view own profile"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

create policy "Managers can view co-manager profiles"
  on public.profiles for select to authenticated
  using (private.shares_vocabulary_with(id));

create policy "Managers can select vocabularies"
  on public.vocabularies for select to authenticated
  using (private.is_vocabulary_manager(id));

create policy "Authenticated can insert vocabularies"
  on public.vocabularies for insert to authenticated
  with check ((select auth.uid()) is not null);

create policy "Managers can update vocabularies"
  on public.vocabularies for update to authenticated
  using (private.is_vocabulary_manager(id))
  with check (private.is_vocabulary_manager(id));

create policy "Managers can delete vocabularies"
  on public.vocabularies for delete to authenticated
  using (private.is_vocabulary_manager(id));

create policy "Managers can select vocabulary_managers"
  on public.vocabulary_managers for select to authenticated
  using (private.is_vocabulary_manager(vocabulary_id));

create policy "Users can insert self as manager"
  on public.vocabulary_managers for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Managers can insert managers"
  on public.vocabulary_managers for insert to authenticated
  with check (private.is_vocabulary_manager(vocabulary_id));

create policy "Managers can delete managers"
  on public.vocabulary_managers for delete to authenticated
  using (private.is_vocabulary_manager(vocabulary_id));

create policy "Managers can select boards"
  on public.boards for select to authenticated
  using (private.is_vocabulary_manager(vocabulary_id));

create policy "Managers can insert boards"
  on public.boards for insert to authenticated
  with check (private.is_vocabulary_manager(vocabulary_id));

create policy "Managers can update boards"
  on public.boards for update to authenticated
  using (private.is_vocabulary_manager(vocabulary_id))
  with check (private.is_vocabulary_manager(vocabulary_id));

create policy "Managers can delete boards"
  on public.boards for delete to authenticated
  using (private.is_vocabulary_manager(vocabulary_id));

create policy "Managers can select buttons"
  on public.buttons for select to authenticated
  using (
    private.is_vocabulary_manager(
      (select b.vocabulary_id from public.boards b where b.id = buttons.board_id)
    )
  );

create policy "Managers can insert buttons"
  on public.buttons for insert to authenticated
  with check (
    private.is_vocabulary_manager(
      (select b.vocabulary_id from public.boards b where b.id = board_id)
    )
  );

create policy "Managers can update buttons"
  on public.buttons for update to authenticated
  using (
    private.is_vocabulary_manager(
      (select b.vocabulary_id from public.boards b where b.id = buttons.board_id)
    )
  )
  with check (
    private.is_vocabulary_manager(
      (select b.vocabulary_id from public.boards b where b.id = board_id)
    )
  );

create policy "Managers can delete buttons"
  on public.buttons for delete to authenticated
  using (
    private.is_vocabulary_manager(
      (select b.vocabulary_id from public.boards b where b.id = buttons.board_id)
    )
  );

create policy "Users can select own usage relationships"
  on public.vocabulary_users for select to authenticated
  using ((select auth.uid()) = user_id);

grant usage on schema public to authenticated;
grant usage on schema private to authenticated;

grant select on public.profiles to authenticated;
grant select, insert, update, delete on public.vocabularies to authenticated;
grant select, insert, update, delete on public.boards to authenticated;
grant select, insert, update, delete on public.buttons to authenticated;
grant select, insert, delete on public.vocabulary_managers to authenticated;
grant select on public.vocabulary_users to authenticated;

grant execute on function private.is_vocabulary_manager(uuid) to authenticated;
grant execute on function private.shares_vocabulary_with(uuid) to authenticated;

grant execute on function public.create_vocabulary(text) to authenticated;
grant execute on function public.add_vocabulary_manager(uuid, text) to authenticated;
grant execute on function public.remove_vocabulary_manager(uuid, uuid) to authenticated;

revoke execute on function public.create_vocabulary(text) from public, anon;
revoke execute on function public.add_vocabulary_manager(uuid, text) from public, anon;
revoke execute on function public.remove_vocabulary_manager(uuid, uuid) from public, anon;

revoke all on function private.user_id_by_email(text) from public;
revoke all on function private.handle_auth_user_created() from public;
revoke all on function private.handle_auth_user_updated() from public;
revoke all on function private.prevent_removing_last_manager() from public;
revoke all on function private.set_updated_at() from public;
