-- Independent Vocabulary duplication and atomic Board Copy operations.

alter table public.change_sets add column summary text;

create table public.unresolved_copy_actions (
  id uuid primary key default gen_random_uuid(),
  vocabulary_id uuid not null references public.vocabularies (id) on delete cascade,
  button_id uuid not null references public.buttons (id) on delete cascade,
  previous_board_name text not null default '',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (button_id)
);

create index unresolved_copy_actions_vocabulary_id_idx
  on public.unresolved_copy_actions (vocabulary_id);

alter table public.unresolved_copy_actions enable row level security;

create policy "Managers can select unresolved copy actions"
  on public.unresolved_copy_actions for select to authenticated
  using ((select private.is_vocabulary_manager(vocabulary_id)));

revoke all on table public.unresolved_copy_actions from anon, authenticated;
grant select on table public.unresolved_copy_actions to authenticated;

create or replace function private.resolve_copy_action_warning()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.action is not null then
    delete from public.unresolved_copy_actions where button_id = new.id;
  end if;
  return new;
end;
$$;

create trigger buttons_resolve_copy_action_warning
  after update of action on public.buttons
  for each row
  when (new.action is not null)
  execute function private.resolve_copy_action_warning();

create or replace function public.duplicate_vocabulary(
  p_source_vocabulary_id uuid,
  p_name text,
  p_initial_snapshot jsonb,
  p_mutations jsonb
)
returns public.vocabularies
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  result public.vocabularies;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if not private.is_vocabulary_manager(p_source_vocabulary_id) then
    raise exception 'Not a manager of source Vocabulary';
  end if;
  if jsonb_typeof(p_initial_snapshot) <> 'object' then
    raise exception 'Initial Snapshot must be an object';
  end if;

  insert into public.vocabularies (name, initial_snapshot)
  values (coalesce(p_name, ''), p_initial_snapshot)
  returning * into result;

  insert into public.vocabulary_managers (vocabulary_id, user_id)
  values (result.id, uid);

  perform private.apply_change_set_mutations(result.id, p_mutations);
  return result;
end;
$$;

create or replace function public.submit_board_copy(
  p_source_vocabulary_id uuid,
  p_destination_vocabulary_id uuid,
  p_mutations jsonb,
  p_warnings jsonb,
  p_summary text
)
returns public.change_sets
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  result public.change_sets;
  warning jsonb;
  next_seq bigint;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if not private.is_vocabulary_manager(p_source_vocabulary_id) then
    raise exception 'Not a manager of source Vocabulary';
  end if;
  if not private.is_vocabulary_manager(p_destination_vocabulary_id) then
    raise exception 'Not a manager of destination Vocabulary';
  end if;
  if jsonb_typeof(p_mutations) <> 'array' or jsonb_typeof(p_warnings) <> 'array' then
    raise exception 'Board Copy mutations and warnings must be arrays';
  end if;

  perform 1 from public.vocabularies
    where id = p_destination_vocabulary_id for update;
  next_seq := private.next_applied_seq(p_destination_vocabulary_id);
  perform private.apply_change_set_mutations(p_destination_vocabulary_id, p_mutations);

  insert into public.change_sets (
    vocabulary_id, author_id, status, mutations, summary, applied_seq, applied_at
  ) values (
    p_destination_vocabulary_id, uid, 'applied', p_mutations,
    nullif(p_summary, ''), next_seq, now()
  ) returning * into result;

  for warning in select value from jsonb_array_elements(p_warnings)
  loop
    -- A warning may only name a Button this copy just created in the
    -- destination, so it can never be pointed at another Vocabulary's Button.
    if not exists (
      select 1
      from public.buttons btn
      join public.boards b on b.id = btn.board_id
      where btn.id = (warning ->> 'button_id')::uuid
        and b.vocabulary_id = p_destination_vocabulary_id
    ) then
      raise exception 'Unresolved Copy Action must name a Button in the destination Vocabulary';
    end if;

    insert into public.unresolved_copy_actions (
      vocabulary_id, button_id, previous_board_name, created_by
    ) values (
      p_destination_vocabulary_id,
      (warning ->> 'button_id')::uuid,
      coalesce(warning ->> 'previous_board_name', ''),
      uid
    );
  end loop;

  return result;
end;
$$;

revoke all on function public.duplicate_vocabulary(uuid, text, jsonb, jsonb) from public, anon;
revoke all on function public.submit_board_copy(uuid, uuid, jsonb, jsonb, text) from public, anon;
grant execute on function public.duplicate_vocabulary(uuid, text, jsonb, jsonb) to authenticated;
grant execute on function public.submit_board_copy(uuid, uuid, jsonb, jsonb, text) to authenticated;
