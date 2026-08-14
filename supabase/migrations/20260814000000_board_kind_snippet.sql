-- Snippets are stored as boards with kind 'snippet' (ADR 0006).
alter table public.boards
  add column if not exists kind text not null default 'board';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'boards_kind_board_or_snippet'
      and conrelid = 'public.boards'::regclass
  ) then
    alter table public.boards
      add constraint boards_kind_board_or_snippet
      check (kind in ('board', 'snippet'));
  end if;
end $$;

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
      select 1 from public.boards b
      where b.id = board_id
        and b.vocabulary_id = p_vocabulary_id
        and b.kind = 'board'
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
  v_background_color text;
  v_palette_color_id uuid;
  board_name text;
  button_action jsonb;
  color_hex text;
  color_name text;
  color_description text;
  color_position integer;
  has_bg boolean;
  has_palette boolean;
  deleted_hex text;
  board_kind text;
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
      board_kind := coalesce(mutation ->> 'kind', 'board');
      if board_kind not in ('board', 'snippet') then
        raise exception 'Board kind must be board or snippet';
      end if;
      insert into public.boards (id, vocabulary_id, name, width, height, kind)
      values (entity_id, p_vocabulary_id, board_name, width, height, board_kind);

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
      has_bg := mutation ? 'background_color';
      has_palette := mutation ? 'palette_color_id';
      v_background_color := null;
      v_palette_color_id := null;
      if has_palette and mutation -> 'palette_color_id' is not null
         and mutation ->> 'palette_color_id' is not null
         and mutation ->> 'palette_color_id' <> '' then
        v_palette_color_id := (mutation ->> 'palette_color_id')::uuid;
        if not exists (
          select 1 from public.palette_colors pc
          where pc.id = v_palette_color_id and pc.vocabulary_id = p_vocabulary_id
        ) then
          raise exception 'Palette Color not found for button';
        end if;
      elsif has_bg and mutation -> 'background_color' is not null
            and jsonb_typeof(mutation -> 'background_color') <> 'null' then
        v_background_color := mutation ->> 'background_color';
        if v_background_color is null or v_background_color !~ '^#[0-9A-Fa-f]{6}$' then
          raise exception 'Button background_color must be #RRGGBB or null';
        end if;
        v_background_color := lower(v_background_color);
      end if;
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
        id, board_id, row_index, col_index, label, background_color, palette_color_id, action
      )
      values (
        entity_id, board_id, row_index, col_index, label, v_background_color, v_palette_color_id, button_action
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
      has_bg := mutation ? 'background_color';
      has_palette := mutation ? 'palette_color_id';
      if has_palette and mutation -> 'palette_color_id' is not null
         and mutation ->> 'palette_color_id' is not null
         and mutation ->> 'palette_color_id' <> '' then
        v_palette_color_id := (mutation ->> 'palette_color_id')::uuid;
        if not exists (
          select 1 from public.palette_colors pc
          where pc.id = v_palette_color_id and pc.vocabulary_id = p_vocabulary_id
        ) then
          raise exception 'Palette Color not found for button';
        end if;
      end if;
      if has_bg and mutation -> 'background_color' is not null
         and jsonb_typeof(mutation -> 'background_color') <> 'null' then
        v_background_color := mutation ->> 'background_color';
        if v_background_color !~ '^#[0-9A-Fa-f]{6}$' then
          raise exception 'Button background_color must be #RRGGBB or null';
        end if;
        v_background_color := lower(v_background_color);
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
        board_id = case
          when mutation ? 'board_id' then (mutation ->> 'board_id')::uuid
          else btn.board_id
        end,
        action = case
          when mutation ? 'action' then button_action
          else btn.action
        end,
        palette_color_id = case
          when has_palette and (
            mutation -> 'palette_color_id' is null
            or jsonb_typeof(mutation -> 'palette_color_id') = 'null'
            or mutation ->> 'palette_color_id' = ''
          ) then null
          when has_palette then v_palette_color_id
          when has_bg then null
          else btn.palette_color_id
        end,
        background_color = case
          when has_palette and not (
            mutation -> 'palette_color_id' is null
            or jsonb_typeof(mutation -> 'palette_color_id') = 'null'
            or mutation ->> 'palette_color_id' = ''
          ) then null
          when has_bg and (
            mutation -> 'background_color' is null
            or jsonb_typeof(mutation -> 'background_color') = 'null'
          ) then null
          when has_bg then v_background_color
          else btn.background_color
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

    elsif op = 'create_palette_color' then
      entity_id := (mutation ->> 'id')::uuid;
      color_hex := mutation ->> 'hex';
      if color_hex is null or color_hex !~ '^#[0-9A-Fa-f]{6}$' then
        raise exception 'Palette Color hex must be #RRGGBB';
      end if;
      color_name := coalesce(mutation ->> 'name', '');
      color_description := coalesce(mutation ->> 'description', '');
      color_position := coalesce((mutation ->> 'position')::integer, 0);
      if color_position < 0 then
        raise exception 'Palette Color position must be ≥ 0';
      end if;
      insert into public.palette_colors (
        id, vocabulary_id, hex, name, description, position
      ) values (
        entity_id, p_vocabulary_id, lower(color_hex), color_name, color_description, color_position
      );

    elsif op = 'update_palette_color' then
      entity_id := (mutation ->> 'id')::uuid;
      if mutation ? 'hex' then
        color_hex := mutation ->> 'hex';
        if color_hex is null or color_hex !~ '^#[0-9A-Fa-f]{6}$' then
          raise exception 'Palette Color hex must be #RRGGBB';
        end if;
      end if;
      if mutation ? 'position' then
        color_position := (mutation ->> 'position')::integer;
        if color_position < 0 then
          raise exception 'Palette Color position must be ≥ 0';
        end if;
      end if;
      update public.palette_colors pc
      set
        hex = case when mutation ? 'hex' then lower(color_hex) else pc.hex end,
        name = case when mutation ? 'name' then coalesce(mutation ->> 'name', '') else pc.name end,
        description = case
          when mutation ? 'description' then coalesce(mutation ->> 'description', '')
          else pc.description
        end,
        position = case when mutation ? 'position' then color_position else pc.position end
      where pc.id = entity_id
        and pc.vocabulary_id = p_vocabulary_id;
      if not found then
        raise exception 'Palette Color not found for update';
      end if;

    elsif op = 'delete_palette_color' then
      entity_id := (mutation ->> 'id')::uuid;
      select pc.hex into deleted_hex
      from public.palette_colors pc
      where pc.id = entity_id
        and pc.vocabulary_id = p_vocabulary_id;
      if found then
        -- Freeze any remaining bindings to custom hex (Suggested→Apply safety net).
        update public.buttons btn
        set
          background_color = lower(deleted_hex),
          palette_color_id = null
        from public.boards b
        where btn.palette_color_id = entity_id
          and btn.board_id = b.id
          and b.vocabulary_id = p_vocabulary_id;

        delete from public.palette_colors
        where id = entity_id
          and vocabulary_id = p_vocabulary_id;
      end if;

    else
      raise exception 'Unknown mutation op: %', op;
    end if;
  end loop;
end;
$$;
