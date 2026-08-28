-- Management entails Usage: a Manager of a Vocabulary can always communicate
-- with it, without holding a Usage relationship. Every communicator read
-- policy already routes through this predicate, so they all inherit the rule
-- from here. No rows are created and nothing is migrated. See ADR 0012.

create or replace function private.is_vocabulary_communicator(p_vocabulary_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.vocabulary_users
    where vocabulary_id = p_vocabulary_id
      and user_id = (select auth.uid())
  ) or private.is_vocabulary_manager(p_vocabulary_id);
$$;
