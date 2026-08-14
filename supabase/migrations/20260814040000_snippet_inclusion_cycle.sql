create or replace function private.apply_snippet_inclusion_mutation(
  p_vocabulary_id uuid,
  p_mutation jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  op text;
  entity_id uuid;
  v_host_id uuid;
  v_snippet_id uuid;
  v_origin_row integer;
  v_origin_col integer;
begin
  op := p_mutation ->> 'op';
  entity_id := (p_mutation ->> 'id')::uuid;

  if op = 'create_snippet_inclusion' then
    v_host_id := (p_mutation ->> 'host_id')::uuid;
    v_snippet_id := (p_mutation ->> 'snippet_id')::uuid;
    v_origin_row := (p_mutation ->> 'origin_row')::integer;
    v_origin_col := (p_mutation ->> 'origin_col')::integer;
    if not exists (
      select 1 from public.boards b
      where b.id = v_host_id and b.vocabulary_id = p_vocabulary_id
    ) then
      raise exception 'Host not found for Snippet Inclusion';
    end if;
    if not exists (
      select 1 from public.boards b
      where b.id = v_snippet_id
        and b.vocabulary_id = p_vocabulary_id
        and b.kind = 'snippet'
    ) then
      raise exception 'Snippet Inclusion target must be a Snippet in the same Vocabulary';
    end if;
    if v_host_id = v_snippet_id then
      raise exception 'Snippet Inclusion would create a cycle';
    end if;
    if exists (
      with recursive chain as (
        select i.snippet_id
        from public.snippet_inclusions i
        join public.boards h on h.id = i.host_id
        where i.host_id = v_snippet_id
          and h.vocabulary_id = p_vocabulary_id
        union
        select i.snippet_id
        from public.snippet_inclusions i
        join chain c on i.host_id = c.snippet_id
        join public.boards h on h.id = i.host_id
        where h.vocabulary_id = p_vocabulary_id
      )
      select 1 from chain where chain.snippet_id = v_host_id
    ) then
      raise exception 'Snippet Inclusion would create a cycle';
    end if;
    insert into public.snippet_inclusions (
      id, host_id, snippet_id, origin_row, origin_col
    ) values (
      entity_id, v_host_id, v_snippet_id, v_origin_row, v_origin_col
    );

  elsif op = 'update_snippet_inclusion' then
    update public.snippet_inclusions inc
    set
      origin_row = case
        when p_mutation ? 'origin_row' then (p_mutation ->> 'origin_row')::integer
        else inc.origin_row
      end,
      origin_col = case
        when p_mutation ? 'origin_col' then (p_mutation ->> 'origin_col')::integer
        else inc.origin_col
      end
    where inc.id = entity_id
      and exists (
        select 1 from public.boards b
        where b.id = inc.host_id and b.vocabulary_id = p_vocabulary_id
      );
    if not found then
      raise exception 'Snippet Inclusion not found for update';
    end if;

  elsif op = 'delete_snippet_inclusion' then
    delete from public.snippet_inclusions inc
    using public.boards b
    where inc.id = entity_id
      and inc.host_id = b.id
      and b.vocabulary_id = p_vocabulary_id;
  end if;
end;
$$;
