-- Keeping a Board that arrived through a Share Link, into a Vocabulary the
-- saver already manages. This is submit_board_copy without the requirement to
-- manage the source: the Share Link authorises the source side, and the API
-- validates it. Managing the destination is still required, and still checked
-- here. See ADR 0010.

create function public.save_shared_board(
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
  if uid is null then
    raise exception 'Not authenticated';
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

revoke all on function public.save_shared_board(uuid, jsonb, jsonb, text) from public, anon;
grant execute on function public.save_shared_board(uuid, jsonb, jsonb, text) to authenticated;
