# 01 — Give a Vocabulary a description

**What to build:** A Vocabulary gains an optional description alongside its name — free text a Manager writes in the Vocabulary's settings to say what the Vocabulary is for and who it suits. Nothing else changes: a description may be blank, and a blank one is as valid as a blank name.

This exists because publishing to the Gallery requires a non-blank name and description (see `CONTEXT.md`, **Vocabulary**), and because a description is worth having on a private Vocabulary anyway. The description lives on the Vocabulary, not on its Publication, so there is one source of truth and a published listing's prose is whatever the Vocabulary said at publish time.

Description is not Vocabulary content in the Change Set sense — like the name, it is edited directly rather than through a Change Set, and it is not part of the Initial Snapshot.

**Blocked by:** None — can start immediately.

**Status:** resolved

- [x] A Manager can read and edit a Vocabulary's description in its settings, and the change persists.
- [x] The description may be blank, and is blank for every Vocabulary that existed before this ticket.
- [x] Editing a description is not a Change Set: it does not appear in Applied history and does not require one.
- [x] A Communicator who is not a Manager cannot edit a description; a non-Manager cannot edit one at all.
- [x] Duplicating a Vocabulary carries the description across, the same way the name is carried.
- [x] The description is not exposed through a Share Link's payload — Share Links are unchanged by this ticket.
