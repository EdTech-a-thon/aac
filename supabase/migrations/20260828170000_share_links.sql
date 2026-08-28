-- Share Links: revocable capabilities granting anonymous read of one
-- Vocabulary or one Board. Holding the token is the permission, the way a
-- Symbol digest is (ADR 0008). Anonymous reads are authorised in the API,
-- which validates the token and reads with the service role — anon gains no
-- table access here, and none of these grants admit it. See ADR 0010.

create table public.share_links (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  vocabulary_id uuid not null references public.vocabularies (id) on delete cascade,
  board_id uuid references public.boards (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- At most one live Share Link per shared thing.
create unique index share_links_one_per_vocabulary
  on public.share_links (vocabulary_id)
  where board_id is null;

create unique index share_links_one_per_board
  on public.share_links (board_id)
  where board_id is not null;

create index share_links_vocabulary_idx on public.share_links (vocabulary_id);

alter table public.share_links enable row level security;

create policy "Managers can select share links"
  on public.share_links for select to authenticated
  using (private.is_vocabulary_manager(vocabulary_id));

revoke all on table public.share_links from anon, authenticated;
grant select on table public.share_links to authenticated;

-- 64 lowercase hex characters, the same shape as a Symbol digest, built from
-- two random UUIDs so no extension is required.
create function private.new_share_token()
returns text
language sql
volatile
as $$
  select replace(pg_catalog.gen_random_uuid()::text, '-', '')
      || replace(pg_catalog.gen_random_uuid()::text, '-', '');
$$;

create function public.create_share_link(
  p_vocabulary_id uuid,
  p_board_id uuid default null
)
returns public.share_links
language plpgsql
security definer
set search_path = ''
as $$
declare
  link public.share_links;
begin
  if (select auth.uid()) is null then
    raise exception 'Not authenticated';
  end if;

  if not private.is_vocabulary_manager(p_vocabulary_id) then
    raise exception 'Not a manager of this vocabulary';
  end if;

  -- Only a Board can be shared. A Snippet is never a destination, so it is
  -- never the thing a link names.
  if p_board_id is not null and not exists (
    select 1
    from public.boards
    where id = p_board_id
      and vocabulary_id = p_vocabulary_id
      and kind = 'board'
  ) then
    raise exception 'Board not found';
  end if;

  -- One live Share Link per shared thing: asking again yields the same one
  -- rather than a second.
  select * into link
  from public.share_links
  where vocabulary_id = p_vocabulary_id
    and board_id is not distinct from p_board_id;

  if found then
    return link;
  end if;

  insert into public.share_links (token, vocabulary_id, board_id)
  values (private.new_share_token(), p_vocabulary_id, p_board_id)
  returning * into link;

  return link;
end;
$$;

-- Revoking destroys the link. A later Share Link for the same thing carries a
-- freshly minted token, so the revoked one never works again.
create function public.revoke_share_link(
  p_vocabulary_id uuid,
  p_board_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Not authenticated';
  end if;

  if not private.is_vocabulary_manager(p_vocabulary_id) then
    raise exception 'Not a manager of this vocabulary';
  end if;

  delete from public.share_links
  where vocabulary_id = p_vocabulary_id
    and board_id is not distinct from p_board_id;
end;
$$;

revoke all on function public.create_share_link(uuid, uuid) from public, anon;
revoke all on function public.revoke_share_link(uuid, uuid) from public, anon;
grant execute on function public.create_share_link(uuid, uuid) to authenticated;
grant execute on function public.revoke_share_link(uuid, uuid) to authenticated;
