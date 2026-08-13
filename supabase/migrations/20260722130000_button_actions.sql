-- Button Actions: optional discriminated JSON value on buttons; mutate via Change Sets.

alter table public.buttons
  add column action jsonb;

alter table public.buttons
  add constraint buttons_action_is_object_or_null check (
    action is null or jsonb_typeof(action) = 'object'
  );

create or replace function private.validate_button_action(
  p_vocabulary_id uuid,
  p_action jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  kind text;
  phrase text;
  board_id uuid;
  video_id text;
  start_sec double precision;
  end_sec double precision;
begin
  if p_action is null then
    return null;
  end if;

  if jsonb_typeof(p_action) <> 'object' then
    raise exception 'Action must be a JSON object or null';
  end if;

  kind := p_action ->> 'kind';

  if kind = 'insert_phrase' or kind = 'speak_immediately' then
    phrase := btrim(coalesce(p_action ->> 'phrase', ''));
    if phrase = '' then
      raise exception 'Action phrase must be non-empty';
    end if;
    return jsonb_build_object('kind', kind, 'phrase', phrase);

  elsif kind = 'open_board' then
    begin
      board_id := (p_action ->> 'board_id')::uuid;
    exception
      when others then
        raise exception 'Open Board Action requires a valid board_id';
    end;
    if board_id is null then
      raise exception 'Open Board Action requires a valid board_id';
    end if;
    if not exists (
      select 1 from public.boards
      where id = board_id and vocabulary_id = p_vocabulary_id
    ) then
      raise exception 'Open Board target must be a Board in the same Vocabulary';
    end if;
    return jsonb_build_object('kind', 'open_board', 'board_id', board_id);

  elsif kind = 'play_youtube_clip' then
    video_id := btrim(coalesce(p_action ->> 'video_id', ''));
    if video_id = '' then
      raise exception 'Play YouTube Clip requires a video_id';
    end if;
    if jsonb_typeof(p_action -> 'start') <> 'number'
      or jsonb_typeof(p_action -> 'end') <> 'number' then
      raise exception 'Play YouTube Clip start and end must be numbers';
    end if;
    start_sec := (p_action ->> 'start')::double precision;
    end_sec := (p_action ->> 'end')::double precision;
    if start_sec < 0 or end_sec <= start_sec then
      raise exception 'Play YouTube Clip requires start >= 0 and start before end';
    end if;
    return jsonb_build_object(
      'kind', 'play_youtube_clip',
      'video_id', video_id,
      'start', start_sec,
      'end', end_sec
    );

  elsif kind = 'clear_message_bar' then
    return jsonb_build_object('kind', 'clear_message_bar');

  elsif kind = 'backspace' then
    return jsonb_build_object('kind', 'backspace');

  else
    raise exception 'Unknown Action kind: %', kind;
  end if;
end;
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
  button_action jsonb;
begin
  if p_mutations is null or jsonb_typeof(p_mutations) <> 'array' then
    raise exception 'mutations must be a JSON array';
  end if;

  for mutation in select value from jsonb_array_elements(p_mutations)
  loop
    op := mutation ->> 'op';
    button_action := null;

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
      -- Clearing Open Board Actions that targeted the deleted Board.
      update public.buttons btn
      set action = null
      where btn.action ->> 'kind' = 'open_board'
        and btn.action ->> 'board_id' = entity_id::text
        and exists (
          select 1 from public.boards b
          where b.id = btn.board_id
            and b.vocabulary_id = p_vocabulary_id
        );

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
      if mutation ? 'action' then
        button_action := private.validate_button_action(
          p_vocabulary_id,
          case
            when mutation -> 'action' = 'null'::jsonb then null
            else mutation -> 'action'
          end
        );
      else
        button_action := null;
      end if;
      insert into public.buttons (
        id, board_id, row_index, col_index, label, background_color, action
      )
      values (
        entity_id, board_id, row_index, col_index, label, background_color, button_action
      );

    elsif op = 'update_button' then
      entity_id := (mutation ->> 'id')::uuid;
      if mutation ? 'action' then
        button_action := private.validate_button_action(
          p_vocabulary_id,
          case
            when mutation -> 'action' = 'null'::jsonb then null
            else mutation -> 'action'
          end
        );
      end if;
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
        end,
        action = case
          when mutation ? 'action' then button_action
          else btn.action
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

revoke all on function private.validate_button_action(uuid, jsonb) from public;
