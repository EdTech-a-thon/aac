# 07 — Endorse a Publication

**What to build:** A signed-in User can endorse a Publication — the Gallery's public vote of confidence — and the Gallery orders by it.

An Endorsement is a toggle, at most one per User per Publication, and belongs to the Publication rather than to any one version, so it survives republishing. Withdrawing one is recorded rather than erased: the row keeps that it was withdrawn and when, so the history stays intact even though the displayed count is of Endorsements currently standing (`CONTEXT.md`, **Endorsement**).

Counts are public. Who endorsed is shown to nobody — not to other visitors, and not to the Publication's own Managers, for whom knowing which named clinicians endorsed has no upside (ADR 0014). A Manager cannot endorse their own Publication.

With Endorsements in place, most-endorsed becomes the Gallery's default ordering, with newest kept as the alternative.

**Blocked by:** 05 — Browse and search the Gallery.

**Status:** resolved

- [x] A signed-in User can endorse a Publication and withdraw it again, and the control shows their current state.
- [x] A signed-out visitor sees the count and is asked to sign in rather than silently failing.
- [x] A User cannot hold more than one Endorsement of the same Publication however many times they toggle.
- [x] Withdrawing keeps the record and marks when it was withdrawn; endorsing again after withdrawing does not lose the earlier history.
- [x] The displayed count is of Endorsements currently standing.
- [x] A Manager of the Vocabulary cannot endorse its own Publication.
- [x] Endorsements survive republishing — a new Publication Version does not reset the count.
- [x] No endorser identity is exposed anywhere, including to the Publication's Managers.
- [x] The Gallery defaults to most-endorsed ordering, with newest available alongside it.
