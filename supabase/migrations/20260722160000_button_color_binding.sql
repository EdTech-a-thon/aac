-- Button background: unset (both null), Palette Color binding, or custom hex.
alter table public.buttons
  alter column background_color drop not null;

alter table public.buttons
  alter column background_color drop default;

alter table public.buttons
  drop constraint if exists buttons_background_color_hex_check;

alter table public.buttons
  add constraint buttons_background_color_hex_check
  check (background_color is null or background_color ~ '^#[0-9A-Fa-f]{6}$');

alter table public.buttons
  add column palette_color_id uuid references public.palette_colors (id) on delete restrict;

alter table public.buttons
  add constraint buttons_color_xor_check
  check (palette_color_id is null or background_color is null);

create index buttons_palette_color_id_idx on public.buttons (palette_color_id);

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
        -- Color modes: binding clears custom hex; custom clears binding; explicit nulls = unset.
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
      delete from public.palette_colors
      where id = entity_id
        and vocabulary_id = p_vocabulary_id;

    else
      raise exception 'Unknown mutation op: %', op;
    end if;
  end loop;
end;
$$;
