# 06 — Sign in and keep a shared Vocabulary

**What to build:** A Visitor looking at a shared Vocabulary — with or without edits of their own — signs in, or registers if they have no account, and keeps it. What they see becomes a new independent Vocabulary in their account, including their edits, while the source is untouched. They are its sole Manager and can therefore also communicate with it.

**Blocked by:** 01 — Management entails Usage; 05 — A Visitor edits what they were sent.

**Status:** ready-for-agent

- [ ] A Visitor with edits can sign in from the public view and save; the resulting Vocabulary contains exactly what they were looking at, edits included.
- [ ] A Visitor with no edits can save; the result is the source's live state at the moment of saving.
- [ ] A Visitor with no account can register from the public view and complete the save without losing their edits.
- [ ] The saved Vocabulary is independent: its Initial Snapshot is what the Visitor saw, its Change Set history starts empty, and later changes to the source do not reach it.
- [ ] The saver is its sole Manager, and can open it in the AAC app.
- [ ] The saved Vocabulary carries no Share Link of its own until its new Manager makes one.
- [ ] The source Vocabulary is unchanged: no Change Set, no new relationship, and any staged edits its Managers had remain staged and unapplied.
- [ ] A signed-in User who already manages the source can still save a copy; it is a separate Vocabulary, not a merge.
- [ ] Saving with a revoked link fails cleanly and tells the Visitor the link is no longer available, without discarding their edits.
- [ ] Registration that cannot return a session — if email confirmation is ever enabled — leaves the Visitor on the page with edits intact rather than navigating away.
