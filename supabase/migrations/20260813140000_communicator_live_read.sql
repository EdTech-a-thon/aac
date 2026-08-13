-- Communicators may read the live Vocabulary they have Usage for.
-- Multiple SELECT policies OR together; Management mutations stay Manager-only.

create function private.is_vocabulary_communicator(p_vocabulary_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.vocabulary_users
    where vocabulary_id = p_vocabulary_id
      and user_id = (select auth.uid())
  );
$$;

grant execute on function private.is_vocabulary_communicator(uuid) to authenticated;

create policy "Communicators can select vocabularies"
  on public.vocabularies for select to authenticated
  using (private.is_vocabulary_communicator(id));

create policy "Communicators can select boards"
  on public.boards for select to authenticated
  using (private.is_vocabulary_communicator(vocabulary_id));

create policy "Communicators can select buttons"
  on public.buttons for select to authenticated
  using (
    private.is_vocabulary_communicator(
      (select b.vocabulary_id from public.boards b where b.id = buttons.board_id)
    )
  );

create policy "Communicators can select palette colors"
  on public.palette_colors for select to authenticated
  using (private.is_vocabulary_communicator(vocabulary_id));

-- Tip Applied sequence for a live snapshot, without exposing Change Set mutations.
create function public.live_vocabulary_revision(p_vocabulary_id uuid)
returns bigint
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (
    private.is_vocabulary_manager(p_vocabulary_id)
    or private.is_vocabulary_communicator(p_vocabulary_id)
  ) then
    return null;
  end if;

  return (
    select coalesce(max(applied_seq), 0)
    from public.change_sets
    where vocabulary_id = p_vocabulary_id
      and status = 'applied'
  );
end;
$$;

revoke all on function public.live_vocabulary_revision(uuid) from public;
grant execute on function public.live_vocabulary_revision(uuid) to authenticated;
