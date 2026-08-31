-- Two holes in how an Attestation was recorded, both of which let it claim
-- something that was never confirmed. An Attestation is the evidence that a
-- specific person claimed the right to share this (ADR 0015), so it has to be
-- true by construction rather than because a button was disabled.
--
-- 1. Every clause was accepted as present because the browser always sent all
--    three, whatever was ticked. The clause list is now taken from what the
--    caller actually confirmed, so omitting one refuses the publish.
-- 2. A consent_text id was filed under whatever clause the caller named, so the
--    privacy wording could be recorded as the copyright confirmation. The id
--    must now belong to the clause it is filed under.

create or replace function public.publish_vocabulary(
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
  wording_clause text;
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

  -- All three, every time, and each one carrying the wording it belongs to.
  foreach clause in array array['rights', 'free_to_copy', 'no_personal_content'] loop
    if not exists (
      select 1 from jsonb_array_elements(p_consent) as item
      where item ->> 'clause' = clause
    ) then
      raise exception 'Every confirmation is required to publish';
    end if;
  end loop;

  for entry in select value from jsonb_array_elements(p_consent) loop
    select ct.clause into wording_clause
      from public.consent_texts ct
      where ct.id = (entry ->> 'consent_text_id')::uuid;

    if wording_clause is null then
      raise exception 'That confirmation wording is not one we recorded';
    end if;
    if wording_clause <> (entry ->> 'clause') then
      raise exception 'A confirmation was filed under the wrong wording';
    end if;
  end loop;

  select * into publication from public.publications
    where vocabulary_id = p_vocabulary_id for update;

  if not found then
    insert into public.publications (vocabulary_id, slug)
    values (p_vocabulary_id, private.unique_publication_slug(vocabulary.name))
    returning * into publication;
  else
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

-- Un-claiming Reports whose notification could not be sent.
--
-- The claim commits before the mail is attempted — it has to, or two callers
-- would each see an empty last hour. So a failed send is compensated rather
-- than rolled back: the Reports go back to un-notified and the next attempt
-- picks them up, which is what keeps the throttle from swallowing one.
create function public.release_report_notifications(p_report_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  released integer;
begin
  update public.publication_reports
    set notified_at = null
    where id = any(p_report_ids);
  get diagnostics released = row_count;
  return released;
end;
$$;

revoke all on function public.release_report_notifications(uuid[])
  from public, anon, authenticated;
