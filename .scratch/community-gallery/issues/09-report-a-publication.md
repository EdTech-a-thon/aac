# 09 — Report a Publication

**What to build:** Anyone looking at a Publication — signed in or not — can report it, giving a short reason, and the operator finds out by email.

A Report is stored as a record naming the Publication, the reporter if known, the reason, the time, and whether it has been notified yet. The record is what matters and the email is only a nudge toward it, so a failed send never loses a Report. A reason is required: it is what makes a report actionable, and it raises the cost of drive-by abuse. Anonymous reporting stays, because the people best placed to spot a stolen symbol set may not have accounts.

Notification is throttled rather than scheduled. A Report triggers an email only when none has been sent in the past hour, and the email that goes out covers *every* Report not yet notified rather than only the one that triggered it — so the throttle delays a Report without ever dropping one. Claiming the un-notified Reports and marking them notified happens atomically, so two simultaneous Reports cannot both send, and a failed send leaves them unclaimed for the next attempt. There is no cron job and no timezone (ADR 0016).

Mail goes through Cloudflare Email Service's REST API to a single verified destination address. Sends to a verified destination need no onboarded sending domain and no paid plan, which is why this channel can only ever email us — notifying a publisher would be an arbitrary recipient and is out of scope. Sending sits behind a small interface whose unconfigured case is a logged no-op, so local development needs no Cloudflare account.

Reports do not withdraw a Publication. Acting on one is a manual operator matter; there is no takedown power in the product.

**Blocked by:** 03 — Publish a Vocabulary to the Gallery.

**Status:** in-review

- [x] Anyone, signed in or not, can report a Publication from its page, and a signed-in reporter is recorded as such.
- [x] A reason is required; a report with a blank reason is refused.
- [x] Every accepted report is stored, and it is stored even when sending mail fails.
- [ ] A report sends an email only when none has been sent in the last hour.
- [ ] The email covers every Report not yet notified, not only the triggering one.
- [ ] Reports suppressed by the throttle are included in the next email that goes out.
- [ ] Two reports arriving at once produce at most one email, and neither report is lost.
- [ ] A failed send leaves its Reports un-notified so the next attempt picks them up.
- [x] With no Cloudflare configuration present, reports are still stored and the send is a logged no-op.
- [x] Reporting changes nothing about the Publication: it stays listed and reachable.

## Comments

The throttle and catch-up are implemented and covered by
`apps/api/src/test/reportThrottle.test.ts`, which cannot run until
`supabase/migrations/20260831150000_claim_report_notifications.sql` is applied.
Claiming has to be one indivisible step or two simultaneous Reports each see an
empty last hour and both send, so it lives in a database function behind a
transaction-scoped advisory lock rather than in the API.

Report storage itself does not depend on that migration and is verified.
