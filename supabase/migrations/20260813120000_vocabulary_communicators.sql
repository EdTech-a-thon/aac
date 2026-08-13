-- Usage write path: Managers add/remove Communicators; Managers can list Usage and see Communicator profiles.

alter table public.vocabulary_users
  add constraint vocabulary_users_profile_fkey
  foreign key (user_id) references public.profiles (id) on delete cascade;

create function private.manages_communicator(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.vocabulary_users vu
    join public.vocabulary_managers vm
      on vm.vocabulary_id = vu.vocabulary_id
    where vu.user_id = p_user_id
      and vm.user_id = (select auth.uid())
  );
$$;

create function public.add_vocabulary_communicator(p_vocabulary_id uuid, p_email text)
returns public.vocabulary_users
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_user_id uuid;
  row public.vocabulary_users;
begin
  if (select auth.uid()) is null then
    raise exception 'Not authenticated';
  end if;

  if not private.is_vocabulary_manager(p_vocabulary_id) then
    raise exception 'Not a manager of this vocabulary';
  end if;

  target_user_id := private.user_id_by_email(p_email);
  if target_user_id is null then
    raise exception 'No user found with that email';
  end if;

  insert into public.vocabulary_users (vocabulary_id, user_id)
  values (p_vocabulary_id, target_user_id)
  on conflict do nothing
  returning * into row;

  if row.vocabulary_id is null then
    select * into row
    from public.vocabulary_users
    where vocabulary_id = p_vocabulary_id and user_id = target_user_id;
  end if;

  return row;
end;
$$;

create function public.remove_vocabulary_communicator(p_vocabulary_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Not authenticated';
  end if;

  if not private.is_vocabulary_manager(p_vocabulary_id) then
    raise exception 'Not a manager of this vocabulary';
  end if;

  delete from public.vocabulary_users
  where vocabulary_id = p_vocabulary_id
    and user_id = p_user_id;

  if not found then
    raise exception 'Communicator not found';
  end if;
end;
$$;

create policy "Managers can select usage relationships"
  on public.vocabulary_users for select to authenticated
  using (private.is_vocabulary_manager(vocabulary_id));

create policy "Managers can view communicator profiles"
  on public.profiles for select to authenticated
  using (private.manages_communicator(id));

grant select, insert, delete on public.vocabulary_users to authenticated;
grant execute on function private.manages_communicator(uuid) to authenticated;
grant execute on function public.add_vocabulary_communicator(uuid, text) to authenticated;
grant execute on function public.remove_vocabulary_communicator(uuid, uuid) to authenticated;

revoke execute on function public.add_vocabulary_communicator(uuid, text) from public, anon;
revoke execute on function public.remove_vocabulary_communicator(uuid, uuid) from public, anon;
revoke all on function private.manages_communicator(uuid) from public;
