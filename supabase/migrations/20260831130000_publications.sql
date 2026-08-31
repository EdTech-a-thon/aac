-- The Gallery's write side: a Vocabulary submitted to the public gallery as a
-- Publication, which owns an ordered series of immutable Publication Versions.
--
-- A Publication is frozen where a Share Link is live (ADR 0013): editing the
-- Vocabulary changes nothing on the Gallery until someone publishes again. The
-- Publication belongs to the Vocabulary rather than to the Manager who created
-- it, so it survives that Manager leaving and dies only with the Vocabulary.
--
-- Anonymous reads are served by the API with the service role, following ADR
-- 0010 — anon gains no table access here and none of these grants admit it.

-- The exact wordings a Manager can be asked to confirm. Immutable records: a
-- past Attestation must always be able to say what its author actually agreed
-- to, so a reworded clause is a new row rather than an edit (ADR 0015).
create table public.consent_texts (
  id uuid primary key default gen_random_uuid(),
  clause text not null check (
    clause in ('rights', 'free_to_copy', 'no_personal_content')
  ),
  wording text not null,
  created_at timestamptz not null default now()
);

create unique index consent_texts_clause_wording
  on public.consent_texts (clause, wording);

insert into public.consent_texts (clause, wording) values
  (
    'rights',
    'I own this, or I otherwise have the right to share it.'
  ),
  (
    'free_to_copy',
    'I understand this will be free and publicly available for anyone to copy and use.'
  ),
  (
    'no_personal_content',
    'This contains no photos of, or identifying information about, a real person who has not agreed to it.'
  );

create table public.publications (
  id uuid primary key default gen_random_uuid(),
  -- One Publication per Vocabulary, for the life of that Vocabulary: publishing
  -- again after withdrawing resumes this row rather than starting from zero.
  vocabulary_id uuid not null unique references public.vocabularies (id) on delete cascade,
  -- Derived from the name at first publish and never changed afterwards, so a
  -- link that escaped keeps working when the Vocabulary is renamed.
  slug text not null unique,
  published boolean not null default true,
  current_version_id uuid,
  created_at timestamptz not null default now()
);

create table public.publication_versions (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.publications (id) on delete cascade,
  seq integer not null,
  -- Name and description as they stood at publish. Captured rather than joined,
  -- because a published version does not move when the Vocabulary does.
  name text not null,
  description text not null,
  attribution text not null default '',
  -- Boards, Snippets, Buttons, Snippet Inclusions, and Palette, in the same
  -- shape a Vocabulary copy is taken from, so copying from the Gallery is the
  -- duplication path that already exists.
  snapshot jsonb not null,
  -- Computed once at publish so the Gallery never reads live Vocabulary tables.
  -- Snippets are excluded from board_count; button_count is every Button.
  board_count integer not null,
  button_count integer not null,
  min_columns integer not null,
  min_rows integer not null,
  max_columns integer not null,
  max_rows integer not null,
  created_at timestamptz not null default now(),
  unique (publication_id, seq)
);

alter table public.publications
  add constraint publications_current_version_fkey
  foreign key (current_version_id)
  references public.publication_versions (id) on delete set null;

create index publication_versions_publication_idx
  on public.publication_versions (publication_id, seq desc);

create table public.publication_attestations (
  id uuid primary key default gen_random_uuid(),
  publication_version_id uuid not null
    references public.publication_versions (id) on delete cascade,
  clause text not null check (
    clause in ('rights', 'free_to_copy', 'no_personal_content')
  ),
  consent_text_id uuid not null references public.consent_texts (id),
  -- Deliberately not a foreign key to profiles. An Attestation is the evidence
  -- that a specific person claimed the right to share this, so it must outlive
  -- that User: a cascade would delete the record and a set-null would gut it.
  -- This is the one place the codebase keeps a user id after the User is gone,
  -- and it differs from change_sets.author_id on purpose. See ADR 0015.
  attested_by uuid not null,
  attested_at timestamptz not null default now(),
  unique (publication_version_id, clause)
);

-- A human-readable slug, unique across Publications. Names are not unique and
-- may be any text at all, so this falls back rather than failing.
create function private.unique_publication_slug(p_name text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  base text;
  candidate text;
  n integer := 1;
begin
  base := lower(coalesce(p_name, ''));
  base := pg_catalog.regexp_replace(base, '[^a-z0-9]+', '-', 'g');
  base := pg_catalog.btrim(base, '-');
  if base = '' then
    base := 'vocabulary';
  end if;
  base := pg_catalog.left(base, 60);

  candidate := base;
  while exists (select 1 from public.publications where slug = candidate) loop
    n := n + 1;
    candidate := base || '-' || n::text;
  end loop;
  return candidate;
end;
$$;

/*
 * Publish a Vocabulary, or publish it again. Mints a Publication Version and
 * records the Manager's three confirmations against it — every version is
 * attested separately, because consent to one version's content says nothing
 * about another's.
 *
 * The snapshot and its figures are computed by the API from the live
 * Vocabulary, never supplied by the browser.
 */
create function public.publish_vocabulary(
  p_vocabulary_id uuid,
  p_attribution text,
  p_snapshot jsonb,
  p_figures jsonb,
  p_consent jsonb
)
returns public.publication_versions
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  vocabulary public.vocabularies;
  publication public.publications;
  version public.publication_versions;
  clause text;
  entry jsonb;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;
  if not private.is_vocabulary_manager(p_vocabulary_id) then
    raise exception 'Not a manager of this Vocabulary';
  end if;

  select * into vocabulary from public.vocabularies where id = p_vocabulary_id for update;
  if not found then
    raise exception 'Vocabulary not found';
  end if;

  -- A listing needs to say what it is and who it suits. A blank name or
  -- description is fine on a private Vocabulary and not fine on the Gallery.
  if pg_catalog.btrim(vocabulary.name) = '' then
    raise exception 'A published Vocabulary needs a name';
  end if;
  if pg_catalog.btrim(vocabulary.description) = '' then
    raise exception 'A published Vocabulary needs a description';
  end if;
  if coalesce((p_figures ->> 'board_count')::integer, 0) < 1 then
    raise exception 'A published Vocabulary needs at least one Board';
  end if;

  if jsonb_typeof(p_snapshot) <> 'object' then
    raise exception 'Snapshot must be an object';
  end if;
  if jsonb_typeof(p_consent) <> 'array' then
    raise exception 'Confirmations must be an array';
  end if;

  -- All three, every time. Publishing without them is not a degraded publish.
  foreach clause in array array['rights', 'free_to_copy', 'no_personal_content'] loop
    if not exists (
      select 1 from jsonb_array_elements(p_consent) as item
      where item ->> 'clause' = clause
    ) then
      raise exception 'Every confirmation is required to publish';
    end if;
  end loop;

  select * into publication from public.publications
    where vocabulary_id = p_vocabulary_id for update;

  if not found then
    insert into public.publications (vocabulary_id, slug)
    values (p_vocabulary_id, private.unique_publication_slug(vocabulary.name))
    returning * into publication;
  else
    -- Publishing again lists a withdrawn Publication once more, keeping its
    -- slug and everything that has accumulated against it.
    update public.publications set published = true
      where id = publication.id
      returning * into publication;
  end if;

  insert into public.publication_versions (
    publication_id, seq, name, description, attribution, snapshot,
    board_count, button_count, min_columns, min_rows, max_columns, max_rows
  )
  values (
    publication.id,
    coalesce(
      (select max(seq) from public.publication_versions where publication_id = publication.id),
      0
    ) + 1,
    vocabulary.name,
    vocabulary.description,
    coalesce(p_attribution, ''),
    p_snapshot,
    coalesce((p_figures ->> 'board_count')::integer, 0),
    coalesce((p_figures ->> 'button_count')::integer, 0),
    coalesce((p_figures ->> 'min_columns')::integer, 0),
    coalesce((p_figures ->> 'min_rows')::integer, 0),
    coalesce((p_figures ->> 'max_columns')::integer, 0),
    coalesce((p_figures ->> 'max_rows')::integer, 0)
  )
  returning * into version;

  for entry in select value from jsonb_array_elements(p_consent) loop
    insert into public.publication_attestations (
      publication_version_id, clause, consent_text_id, attested_by
    )
    values (
      version.id,
      entry ->> 'clause',
      (entry ->> 'consent_text_id')::uuid,
      uid
    );
  end loop;

  update public.publications
    set current_version_id = version.id
    where id = publication.id;

  return version;
end;
$$;

alter table public.consent_texts enable row level security;
alter table public.publications enable row level security;
alter table public.publication_versions enable row level security;
alter table public.publication_attestations enable row level security;

-- The publish flow shows the wording it is about to record, so it has to be
-- able to read it. Nothing here is secret.
create policy "Authenticated can read consent texts"
  on public.consent_texts for select to authenticated
  using (true);

create policy "Managers can select their publications"
  on public.publications for select to authenticated
  using (private.is_vocabulary_manager(vocabulary_id));

create policy "Managers can select their publication versions"
  on public.publication_versions for select to authenticated
  using (
    exists (
      select 1 from public.publications p
      where p.id = publication_id
        and private.is_vocabulary_manager(p.vocabulary_id)
    )
  );

create policy "Managers can select their attestations"
  on public.publication_attestations for select to authenticated
  using (
    exists (
      select 1
      from public.publication_versions v
      join public.publications p on p.id = v.publication_id
      where v.id = publication_version_id
        and private.is_vocabulary_manager(p.vocabulary_id)
    )
  );

revoke all on table public.consent_texts from anon, authenticated;
revoke all on table public.publications from anon, authenticated;
revoke all on table public.publication_versions from anon, authenticated;
revoke all on table public.publication_attestations from anon, authenticated;

grant select on table public.consent_texts to authenticated;
grant select on table public.publications to authenticated;
grant select on table public.publication_versions to authenticated;
grant select on table public.publication_attestations to authenticated;

revoke all on function private.unique_publication_slug(text) from public, anon, authenticated;
revoke all on function public.publish_vocabulary(uuid, text, jsonb, jsonb, jsonb)
  from public, anon;
grant execute on function public.publish_vocabulary(uuid, text, jsonb, jsonb, jsonb)
  to authenticated;
