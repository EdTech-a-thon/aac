-- Wipe existing Vocabularies (no legacy hex-only migration).
delete from public.vocabularies;

-- Live Palette projection (mutable via Change Sets after creation).
create table public.palette_colors (
  id uuid primary key default gen_random_uuid(),
  vocabulary_id uuid not null references public.vocabularies (id) on delete cascade,
  hex text not null check (hex ~ '^#[0-9A-Fa-f]{6}$'),
  name text not null default '',
  description text not null default '',
  position integer not null check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (vocabulary_id, position)
);

create index palette_colors_vocabulary_id_idx on public.palette_colors (vocabulary_id);

create trigger palette_colors_set_updated_at
  before update on public.palette_colors
  for each row execute function private.set_updated_at();

alter table public.palette_colors enable row level security;

create policy "Managers can select palette colors"
  on public.palette_colors for select to authenticated
  using (private.is_vocabulary_manager(vocabulary_id));

grant select on public.palette_colors to authenticated;

-- Palette Colors are mutated only via Change Sets (security definer apply path),
-- same pattern as Boards/Buttons: no direct client insert/update/delete policies.

-- Immutable genesis state: Boards, Buttons, and Palette at creation.
alter table public.vocabularies
  add column initial_snapshot jsonb not null default '{"boards":[],"buttons":[],"palette_colors":[]}'::jsonb;

alter table public.vocabularies
  alter column initial_snapshot drop default;

create or replace function private.fitzgerald_default_palette_colors()
returns jsonb
language sql
immutable
set search_path = public
as $$
  select jsonb_build_array(
    jsonb_build_object(
      'name', 'Conjunctions',
      'hex', '#ffffff',
      'description', 'Words that link ideas together (and, but, because)'
    ),
    jsonb_build_object(
      'name', 'Pronouns',
      'hex', '#ffe566',
      'description', 'Words that stand in for people or things (I, you, it, they)'
    ),
    jsonb_build_object(
      'name', 'Verbs',
      'hex', '#a8d08d',
      'description', 'Actions, states, and things someone can do'
    ),
    jsonb_build_object(
      'name', 'Nouns',
      'hex', '#ffb74d',
      'description', 'People, places, things, and ideas you name'
    ),
    jsonb_build_object(
      'name', 'Adjectives',
      'hex', '#90caf9',
      'description', 'Words that describe or qualify something'
    ),
    jsonb_build_object(
      'name', 'Prepositions / social',
      'hex', '#f8bbd0',
      'description', 'Location/relation words, plus social phrases (please, thank you)'
    ),
    jsonb_build_object(
      'name', 'Questions',
      'hex', '#ce93d8',
      'description', 'Asking — question words and question messages'
    ),
    jsonb_build_object(
      'name', 'Adverbs',
      'hex', '#bcaaa4',
      'description', 'Words about how, when, or where something happens'
    ),
    jsonb_build_object(
      'name', 'Negation / emergency',
      'hex', '#ef9a9a',
      'description', 'No/not/stop, plus urgent or critical messages'
    ),
    jsonb_build_object(
      'name', 'Determiners',
      'hex', '#bdbdbd',
      'description', 'Words that point to or introduce which thing (a, the, this, my)'
    )
  );
$$;

create or replace function public.create_vocabulary(p_name text default '')
returns public.vocabularies
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.vocabularies;
  uid uuid := auth.uid();
  defaults jsonb := private.fitzgerald_default_palette_colors();
  entry jsonb;
  idx integer := 0;
  color_id uuid;
  snapshot_colors jsonb := '[]'::jsonb;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.vocabularies (name, initial_snapshot)
  values (
    coalesce(p_name, ''),
    jsonb_build_object(
      'boards', '[]'::jsonb,
      'buttons', '[]'::jsonb,
      'palette_colors', '[]'::jsonb
    )
  )
  returning * into v;

  insert into public.vocabulary_managers (vocabulary_id, user_id)
  values (v.id, uid);

  for entry in
    select value from jsonb_array_elements(defaults)
  loop
    color_id := gen_random_uuid();
    insert into public.palette_colors (
      id, vocabulary_id, hex, name, description, position
    ) values (
      color_id,
      v.id,
      entry ->> 'hex',
      coalesce(entry ->> 'name', ''),
      coalesce(entry ->> 'description', ''),
      idx
    );

    snapshot_colors := snapshot_colors || jsonb_build_array(
      jsonb_build_object(
        'id', color_id,
        'hex', entry ->> 'hex',
        'name', coalesce(entry ->> 'name', ''),
        'description', coalesce(entry ->> 'description', ''),
        'position', idx
      )
    );
    idx := idx + 1;
  end loop;

  update public.vocabularies
  set initial_snapshot = jsonb_build_object(
    'boards', '[]'::jsonb,
    'buttons', '[]'::jsonb,
    'palette_colors', snapshot_colors
  )
  where id = v.id
  returning * into v;

  return v;
end;
$$;

revoke all on function private.fitzgerald_default_palette_colors() from public;
grant execute on function public.create_vocabulary(text) to authenticated;
