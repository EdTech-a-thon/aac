-- Qualify boards.kind so it is not shadowed by validate_button_action's kind variable.
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
