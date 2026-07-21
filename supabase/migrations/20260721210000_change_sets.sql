-- Change Sets: durable Applied/Suggested mutation history for Boards and Buttons.

create table public.change_sets (
  id uuid primary key default gen_random_uuid(),
  vocabulary_id uuid not null references public.vocabularies (id) on delete cascade,
  author_id uuid not null references auth.users (id) on delete cascade,
  status text not null check (status in ('applied', 'suggested')),
  mutations jsonb not null default '[]'::jsonb,
  applied_seq bigint,
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  constraint change_sets_applied_fields_check check (
    (status = 'applied' and applied_seq is not null and applied_at is not null)
    or (status = 'suggested' and applied_seq is null and applied_at is null)
  )
);

create unique index change_sets_vocabulary_applied_seq_uidx
  on public.change_sets (vocabulary_id, applied_seq)
  where status = 'applied';

create index change_sets_vocabulary_id_idx on public.change_sets (vocabulary_id);
create index change_sets_vocabulary_suggested_idx
  on public.change_sets (vocabulary_id)
  where status = 'suggested';

alter table public.change_sets enable row level security;

create policy "Managers can select change_sets"
  on public.change_sets for select to authenticated
  using (private.is_vocabulary_manager(vocabulary_id));

create policy "Managers can delete suggested change_sets"
  on public.change_sets for delete to authenticated
  using (
    private.is_vocabulary_manager(vocabulary_id)
    and status = 'suggested'
  );

grant select, delete on public.change_sets to authenticated;

-- Boards/Buttons mutate only via Applied Change Sets (security definer RPCs).
revoke insert, update, delete on public.boards from authenticated;
revoke insert, update, delete on public.buttons from authenticated;

create or replace function private.next_applied_seq(p_vocabulary_id uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(max(applied_seq), 0) + 1
  from public.change_sets
  where vocabulary_id = p_vocabulary_id
    and status = 'applied';
$$;

create or replace function private.apply_change_set_mutations(
  p_vocabulary_id uuid,
  p_mutations jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  mutation jsonb;
  op text;
  entity_id uuid;
  board_id uuid;
  width integer;
  height integer;
  row_index integer;
  col_index integer;
  label text;
  background_color text;
  board_name text;
begin
  if p_mutations is null or jsonb_typeof(p_mutations) <> 'array' then
    raise exception 'mutations must be a JSON array';
  end if;

  for mutation in select value from jsonb_array_elements(p_mutations)
  loop
    op := mutation ->> 'op';

    if op = 'create_board' then
      entity_id := (mutation ->> 'id')::uuid;
      board_name := coalesce(mutation ->> 'name', '');
      width := coalesce((mutation ->> 'width')::integer, 4);
      height := coalesce((mutation ->> 'height')::integer, 4);
      if width < 1 or height < 1 then
        raise exception 'Board width and height must be ≥ 1';
      end if;
      insert into public.boards (id, vocabulary_id, name, width, height)
      values (entity_id, p_vocabulary_id, board_name, width, height);

    elsif op = 'update_board' then
      entity_id := (mutation ->> 'id')::uuid;
      update public.boards b
      set
        name = case when mutation ? 'name' then coalesce(mutation ->> 'name', '') else b.name end,
        width = case
          when mutation ? 'width' then (mutation ->> 'width')::integer
          else b.width
        end,
        height = case
          when mutation ? 'height' then (mutation ->> 'height')::integer
          else b.height
        end
      where b.id = entity_id
        and b.vocabulary_id = p_vocabulary_id;
      if not found then
        raise exception 'Board not found for update';
      end if;
      if exists (
        select 1 from public.boards b
        where b.id = entity_id and (b.width < 1 or b.height < 1)
      ) then
        raise exception 'Board width and height must be ≥ 1';
      end if;

    elsif op = 'delete_board' then
      entity_id := (mutation ->> 'id')::uuid;
      delete from public.boards
      where id = entity_id
        and vocabulary_id = p_vocabulary_id;

    elsif op = 'create_button' then
      entity_id := (mutation ->> 'id')::uuid;
      board_id := (mutation ->> 'board_id')::uuid;
      if not exists (
        select 1 from public.boards
        where id = board_id and vocabulary_id = p_vocabulary_id
      ) then
        raise exception 'Board not found for button create';
      end if;
      row_index := (mutation ->> 'row_index')::integer;
      col_index := (mutation ->> 'col_index')::integer;
      label := coalesce(mutation ->> 'label', '');
      background_color := coalesce(mutation ->> 'background_color', '#FFFFFF');
      insert into public.buttons (
        id, board_id, row_index, col_index, label, background_color
      )
      values (
        entity_id, board_id, row_index, col_index, label, background_color
      );

    elsif op = 'update_button' then
      entity_id := (mutation ->> 'id')::uuid;
      update public.buttons btn
      set
        row_index = case
          when mutation ? 'row_index' then (mutation ->> 'row_index')::integer
          else btn.row_index
        end,
        col_index = case
          when mutation ? 'col_index' then (mutation ->> 'col_index')::integer
          else btn.col_index
        end,
        label = case
          when mutation ? 'label' then coalesce(mutation ->> 'label', '')
          else btn.label
        end,
        background_color = case
          when mutation ? 'background_color' then coalesce(mutation ->> 'background_color', '#FFFFFF')
          else btn.background_color
        end,
        board_id = case
          when mutation ? 'board_id' then (mutation ->> 'board_id')::uuid
          else btn.board_id
        end
      where btn.id = entity_id
        and exists (
          select 1 from public.boards b
          where b.id = btn.board_id and b.vocabulary_id = p_vocabulary_id
        );
      if not found then
        raise exception 'Button not found for update';
      end if;

    elsif op = 'delete_button' then
      entity_id := (mutation ->> 'id')::uuid;
      delete from public.buttons btn
      using public.boards b
      where btn.id = entity_id
        and btn.board_id = b.id
        and b.vocabulary_id = p_vocabulary_id;

    else
      raise exception 'Unknown mutation op: %', op;
    end if;
  end loop;
end;
$$;

create or replace function private.prune_suggested_change_sets(p_vocabulary_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cs record;
  mutation jsonb;
  kept jsonb;
  op text;
  entity_id uuid;
  board_id uuid;
  keep boolean;
begin
  for cs in
    select id, mutations
    from public.change_sets
    where vocabulary_id = p_vocabulary_id
      and status = 'suggested'
  loop
    kept := '[]'::jsonb;
    for mutation in select value from jsonb_array_elements(cs.mutations)
    loop
      op := mutation ->> 'op';
      keep := true;

      if op in ('update_board', 'delete_board') then
        entity_id := (mutation ->> 'id')::uuid;
        keep := exists (
          select 1 from public.boards
          where id = entity_id and vocabulary_id = p_vocabulary_id
        );
      elsif op in ('update_button', 'delete_button') then
        entity_id := (mutation ->> 'id')::uuid;
        keep := exists (
          select 1
          from public.buttons btn
          join public.boards b on b.id = btn.board_id
          where btn.id = entity_id
            and b.vocabulary_id = p_vocabulary_id
        );
      elsif op = 'create_button' then
        board_id := (mutation ->> 'board_id')::uuid;
        keep := exists (
          select 1 from public.boards
          where id = board_id and vocabulary_id = p_vocabulary_id
        );
      end if;

      if keep then
        kept := kept || jsonb_build_array(mutation);
      end if;
    end loop;

    if jsonb_array_length(kept) = 0 then
      delete from public.change_sets where id = cs.id;
    elsif kept is distinct from cs.mutations then
      update public.change_sets set mutations = kept where id = cs.id;
    end if;
  end loop;
end;
$$;

create or replace function public.submit_change_set(
  p_vocabulary_id uuid,
  p_status text,
  p_mutations jsonb
)
returns public.change_sets
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cs public.change_sets;
  seq bigint;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  if not private.is_vocabulary_manager(p_vocabulary_id) then
    raise exception 'Not a manager of this vocabulary';
  end if;

  if p_status not in ('applied', 'suggested') then
    raise exception 'status must be applied or suggested';
  end if;

  if p_mutations is null or jsonb_typeof(p_mutations) <> 'array' then
    raise exception 'mutations must be a JSON array';
  end if;

  if p_status = 'applied' then
    seq := private.next_applied_seq(p_vocabulary_id);
    perform private.apply_change_set_mutations(p_vocabulary_id, p_mutations);
    insert into public.change_sets (
      vocabulary_id, author_id, status, mutations, applied_seq, applied_at
    )
    values (
      p_vocabulary_id, uid, 'applied', p_mutations, seq, now()
    )
    returning * into cs;
    perform private.prune_suggested_change_sets(p_vocabulary_id);
  else
    insert into public.change_sets (
      vocabulary_id, author_id, status, mutations
    )
    values (
      p_vocabulary_id, uid, 'suggested', p_mutations
    )
    returning * into cs;
  end if;

  return cs;
end;
$$;

create or replace function public.apply_suggested_change_set(p_change_set_id uuid)
returns public.change_sets
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cs public.change_sets;
  seq bigint;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into cs
  from public.change_sets
  where id = p_change_set_id
  for update;

  if cs.id is null then
    raise exception 'Change set not found';
  end if;

  if not private.is_vocabulary_manager(cs.vocabulary_id) then
    raise exception 'Not a manager of this vocabulary';
  end if;

  if cs.status <> 'suggested' then
    raise exception 'Change set is not suggested';
  end if;

  seq := private.next_applied_seq(cs.vocabulary_id);
  perform private.apply_change_set_mutations(cs.vocabulary_id, cs.mutations);

  update public.change_sets
  set
    status = 'applied',
    applied_seq = seq,
    applied_at = now()
  where id = cs.id
  returning * into cs;

  perform private.prune_suggested_change_sets(cs.vocabulary_id);

  return cs;
end;
$$;

revoke all on function private.next_applied_seq(uuid) from public;
revoke all on function private.apply_change_set_mutations(uuid, jsonb) from public;
revoke all on function private.prune_suggested_change_sets(uuid) from public;

grant execute on function public.submit_change_set(uuid, text, jsonb) to authenticated;
grant execute on function public.apply_suggested_change_set(uuid) to authenticated;

revoke execute on function public.submit_change_set(uuid, text, jsonb) from public, anon;
revoke execute on function public.apply_suggested_change_set(uuid) from public, anon;
