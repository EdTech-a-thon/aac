-- Claiming the Reports an email is about to cover.
--
-- Notification is throttled rather than scheduled (ADR 0016): a Report sends an
-- email only when none has been sent in the last hour, and the email that does
-- go out covers every Report not yet notified rather than only the one that
-- triggered it. That is what keeps the throttle from ever dropping a Report.
--
-- Deciding and claiming has to be one indivisible step, or two Reports arriving
-- together each see an empty last hour and both send. An advisory lock held for
-- the transaction serialises exactly this, and is released whether the call
-- commits or fails.
--
-- Returns nothing when the last hour already had an email, which is the caller's
-- signal to stay quiet. The claim commits before the caller attempts to send, so
-- a failed send is compensated rather than rolled back: see
-- release_report_notifications, which puts those Reports back to un-notified.
create function public.claim_report_notifications()
returns setof public.publication_reports
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('publication_report_notifications')
  );

  if exists (
    select 1 from public.publication_reports
    where notified_at > pg_catalog.now() - interval '1 hour'
  ) then
    return;
  end if;

  return query
    update public.publication_reports
      set notified_at = pg_catalog.now()
      where notified_at is null
      returning *;
end;
$$;

-- The API calls this with the service role; nobody else may.
revoke all on function public.claim_report_notifications()
  from public, anon, authenticated;
