-- A Vocabulary gains an optional description: free text saying what it is for
-- and who it suits. Like the name, it is edited directly rather than through a
-- Change Set, and it is not part of the Initial Snapshot — a description is not
-- Vocabulary content in the sense ADR 0001 and ADR 0003 govern.
--
-- Publishing to the Gallery will require a non-blank name and description, but
-- a private Vocabulary is free to leave both blank.

alter table public.vocabularies
  add column description text not null default '';

-- Duplication carries the description across the way it carries the name, so a
-- duplicate reads as the same Vocabulary rather than losing half its identity.
-- The old four-argument form is dropped rather than overloaded: leaving it in
-- place would let a caller silently take the description-less path.
drop function public.duplicate_vocabulary(uuid, text, jsonb, jsonb);

create function public.duplicate_vocabulary(
  p_source_vocabulary_id uuid,
  p_name text,
  p_description text,
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

  insert into public.vocabularies (name, description, initial_snapshot)
  values (coalesce(p_name, ''), coalesce(p_description, ''), p_initial_snapshot)
  returning * into result;

  insert into public.vocabulary_managers (vocabulary_id, user_id)
  values (result.id, uid);

  perform private.apply_change_set_mutations(result.id, p_mutations);
  return result;
end;
$$;

revoke all on function public.duplicate_vocabulary(uuid, text, text, jsonb, jsonb)
  from public, anon;
grant execute on function public.duplicate_vocabulary(uuid, text, text, jsonb, jsonb)
  to authenticated;
