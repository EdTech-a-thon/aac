-- What accumulates against a Publication once it is on the Gallery: withdrawal,
-- Endorsements, Copies, and Reports.
--
-- All four belong to the Publication rather than to any one Publication
-- Version, so republishing never resets them (ADR 0013). Endorsements are the
-- public ranking signal and Copies are deliberately private; neither is a view
-- count, which the Gallery still refuses to keep (ADR 0014).

-- Withdrawing delists without deleting: every row survives, and publishing this
-- Vocabulary again resumes the same Publication with its slug and history.
create function public.unpublish_vocabulary(p_vocabulary_id uuid)
returns public.publications
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  result public.publications;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;
  if not private.is_vocabulary_manager(p_vocabulary_id) then
    raise exception 'Not a manager of this Vocabulary';
  end if;

  update public.publications
    set published = false
    where vocabulary_id = p_vocabulary_id
    returning * into result;

  if not found then
    raise exception 'This Vocabulary is not on the Gallery';
  end if;
  return result;
end;
$$;

-- Current standing, one row per User per Publication, for counting.
create table public.endorsements (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.publications (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  standing boolean not null default true,
  endorsed_at timestamptz not null default now(),
  withdrawn_at timestamptz,
  unique (publication_id, user_id)
);

create index endorsements_standing_idx
  on public.endorsements (publication_id)
  where standing;

-- Append-only history, so withdrawing records that it happened rather than
-- erasing that it ever did, and endorsing again does not lose what came before.
create table public.endorsement_events (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.publications (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  standing boolean not null,
  created_at timestamptz not null default now()
);

create index endorsement_events_publication_idx
  on public.endorsement_events (publication_id, created_at);

/*
 * Endorse or withdraw, as one gesture. Returns the standing count so the caller
 * never has to ask a second question.
 */
create function public.set_endorsement(p_publication_id uuid, p_standing boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  owns boolean;
  total integer;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  -- Endorsing your own Publication would be noise in the one public ranking
  -- signal the Gallery has.
  select private.is_vocabulary_manager(p.vocabulary_id) into owns
    from public.publications p where p.id = p_publication_id;
  if owns is null then
    raise exception 'Publication not found';
  end if;
  if owns then
    raise exception 'You cannot endorse your own Vocabulary';
  end if;

  insert into public.endorsements (publication_id, user_id, standing, withdrawn_at)
  values (
    p_publication_id,
    uid,
    p_standing,
    case when p_standing then null else now() end
  )
  on conflict (publication_id, user_id) do update
    set standing = excluded.standing,
        endorsed_at = case
          when excluded.standing and not public.endorsements.standing then now()
          else public.endorsements.endorsed_at
        end,
        withdrawn_at = case when excluded.standing then null else now() end;

  insert into public.endorsement_events (publication_id, user_id, standing)
  values (p_publication_id, uid, p_standing);

  select count(*) into total from public.endorsements
    where publication_id = p_publication_id and standing;

  return jsonb_build_object('standing', p_standing, 'count', total);
end;
$$;

-- One row per Vocabulary that came out of a Publication. Written on completion,
-- so a failed copy records nothing, and repeat copies by one person each count.
create table public.publication_copies (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.publications (id) on delete cascade,
  publication_version_id uuid not null
    references public.publication_versions (id) on delete cascade,
  -- The count is what the publisher sees; the identity is operator-only, and
  -- losing it with the account costs nothing that matters.
  user_id uuid references public.profiles (id) on delete set null,
  vocabulary_id uuid references public.vocabularies (id) on delete set null,
  created_at timestamptz not null default now()
);

create index publication_copies_publication_idx
  on public.publication_copies (publication_id);

-- Where a copied Vocabulary came from. A dead reference: it never updates the
-- copy, and it stops resolving when the Publication is withdrawn or gone.
alter table public.vocabularies
  add column origin_publication_version_id uuid
    references public.publication_versions (id) on delete set null;

/*
 * Keep a Publication as a Vocabulary of your own, recording the Copy in the
 * same transaction so the count cannot drift from the Vocabularies that exist.
 */
create function public.save_publication_copy(
  p_publication_version_id uuid,
  p_name text,
  p_description text,
  p_initial_snapshot jsonb,
  p_mutations jsonb
)
returns public.vocabularies
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  version public.publication_versions;
  publication public.publications;
  result public.vocabularies;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;
  if jsonb_typeof(p_initial_snapshot) <> 'object' then
    raise exception 'Initial Snapshot must be an object';
  end if;

  select * into version from public.publication_versions where id = p_publication_version_id;
  if not found then
    raise exception 'This isn''t available';
  end if;

  select * into publication from public.publications where id = version.publication_id;
  if not found or not publication.published then
    raise exception 'This isn''t available';
  end if;

  insert into public.vocabularies (name, description, initial_snapshot, origin_publication_version_id)
  values (coalesce(p_name, ''), coalesce(p_description, ''), p_initial_snapshot, version.id)
  returning * into result;

  insert into public.vocabulary_managers (vocabulary_id, user_id)
  values (result.id, uid);

  perform private.apply_change_set_mutations(result.id, p_mutations);

  insert into public.publication_copies (
    publication_id, publication_version_id, user_id, vocabulary_id
  )
  values (publication.id, version.id, uid, result.id);

  return result;
end;
$$;

-- A complaint about a Publication. The record is what matters; the email is a
-- nudge toward it, so a failed send never loses one (ADR 0016).
create table public.publication_reports (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.publications (id) on delete cascade,
  reporter_id uuid references public.profiles (id) on delete set null,
  reason text not null check (pg_catalog.btrim(reason) <> ''),
  created_at timestamptz not null default now(),
  notified_at timestamptz
);

create index publication_reports_unnotified_idx
  on public.publication_reports (created_at)
  where notified_at is null;

alter table public.endorsements enable row level security;
alter table public.endorsement_events enable row level security;
alter table public.publication_copies enable row level security;
alter table public.publication_reports enable row level security;

-- A User may see their own Endorsement, so the control can show its state. No
-- one sees anyone else's, including the Publication's own Managers.
create policy "Users can select their own endorsements"
  on public.endorsements for select to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.endorsements from anon, authenticated;
revoke all on table public.endorsement_events from anon, authenticated;
revoke all on table public.publication_copies from anon, authenticated;
revoke all on table public.publication_reports from anon, authenticated;

grant select on table public.endorsements to authenticated;

revoke all on function public.unpublish_vocabulary(uuid) from public, anon;
revoke all on function public.set_endorsement(uuid, boolean) from public, anon;
revoke all on function public.save_publication_copy(uuid, text, text, jsonb, jsonb)
  from public, anon;

grant execute on function public.unpublish_vocabulary(uuid) to authenticated;
grant execute on function public.set_endorsement(uuid, boolean) to authenticated;
grant execute on function public.save_publication_copy(uuid, text, text, jsonb, jsonb)
  to authenticated;
