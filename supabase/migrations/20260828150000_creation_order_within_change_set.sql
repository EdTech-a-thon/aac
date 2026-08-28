-- Creation order within one Change Set.
--
-- now() returns the transaction timestamp, so every row a single Change Set
-- created shared one creation time. The domain breaks creation-time ties by
-- identifier — overlapping Buttons by the higher one, the Home Board by the
-- lower one — and freshly minted identifiers carry no order, so draw order,
-- inclusion layering, and the Home Board were all decided arbitrarily whenever
-- one Change Set created several rows.
--
-- clock_timestamp() advances during the transaction, so each row is stamped as
-- it is inserted and rows land in the order their mutations were submitted.
-- Rows created by separate Change Sets keep ordering by when each was applied,
-- because real time advances between transactions too.

alter table public.boards
  alter column created_at set default clock_timestamp();

alter table public.buttons
  alter column created_at set default clock_timestamp();

alter table public.snippet_inclusions
  alter column created_at set default clock_timestamp();
