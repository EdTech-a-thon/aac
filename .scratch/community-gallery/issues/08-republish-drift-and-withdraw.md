# 08 — Republish, drift, and withdraw

**What to build:** The three things a Manager needs after publishing once: publishing again, knowing when they should, and taking a listing down.

Publishing again mints a new Publication Version on the same Publication, which becomes what the Gallery shows. Endorsements, Copies, and the slug all belong to the Publication and carry across untouched. Each new version requires its own Attestation, since consent to one version's content says nothing about another's (ADR 0015).

Because a published version is frozen, a Vocabulary edited after publishing has drifted from what the public sees — including a changed name or description, which are captured at publish. The manager app says so, since otherwise the only way to notice is to remember.

Withdrawing delists: the Gallery entry and the public URL go dead while every row survives — versions, Attestations, Endorsements, Copies, and Reports. Publishing that Vocabulary again resumes the same Publication with its Endorsements and history intact, rather than starting from zero. Any Manager may publish or withdraw without the others' agreement.

There is no rollback: the Gallery shows only the current version, and a version worse than its predecessor is answered by publishing a better one (ADR 0013).

**Blocked by:** 03 — Publish a Vocabulary to the Gallery.

**Status:** resolved

- [x] A Manager can publish an already-published Vocabulary again, minting a new version that becomes what the public URL and Gallery show.
- [x] Republishing requires a fresh Attestation and is refused without all three confirmations.
- [x] Earlier versions remain stored and still resolve as the origin of Copies taken from them.
- [x] The slug does not change on republishing, including when the Vocabulary has been renamed.
- [x] The manager app shows when a published Vocabulary has drifted from its current version, including drift caused only by a changed name or description.
- [x] A Vocabulary that has not changed since publishing is not reported as drifted.
- [x] Any Manager can withdraw a Publication, after which its Gallery entry and public URL are both dead.
- [x] Withdrawing deletes nothing: versions, Attestations, Endorsements, Copies, and Reports all survive.
- [x] Publishing a withdrawn Publication's Vocabulary again resumes the same Publication, keeping its slug and its Endorsement count.
- [x] Copies taken before a withdrawal are unaffected by it.
