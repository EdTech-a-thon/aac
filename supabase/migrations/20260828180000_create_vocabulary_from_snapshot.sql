-- Creating a Vocabulary from a snapshot the caller supplies, with no source
-- Vocabulary they must already manage. This is how a Visitor keeps what a
-- Share Link showed them: the link authorises the read, and the save creates
-- something wholly theirs. See ADR 0010 and ADR 0011.
--
-- The snapshot is client-supplied, exactly as it is for duplicate_vocabulary.
-- That is safe because the result belongs solely to the caller and touches no
-- existing Vocabulary.

create function public.create_vocabulary_from_snapshot(
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
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  if jsonb_typeof(p_initial_snapshot) <> 'object' then
    raise exception 'Initial Snapshot must be an object';
  end if;

  insert into public.vocabularies (name, initial_snapshot)
  values (coalesce(p_name, ''), p_initial_snapshot)
  returning * into result;

  -- Sole Manager, and therefore also its Communicator. See ADR 0012.
  insert into public.vocabulary_managers (vocabulary_id, user_id)
  values (result.id, uid);

  perform private.apply_change_set_mutations(result.id, p_mutations);
  return result;
end;
$$;

revoke all on function public.create_vocabulary_from_snapshot(text, jsonb, jsonb)
  from public, anon;
grant execute on function public.create_vocabulary_from_snapshot(text, jsonb, jsonb)
  to authenticated;
