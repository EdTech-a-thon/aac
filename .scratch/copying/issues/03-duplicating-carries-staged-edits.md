# 03 — Duplicating from the editor carries staged edits

**What to build:** A Manager with unsaved edits open on a Vocabulary duplicates it and gets a copy of what they can actually see, staged edits included — while the source keeps those edits staged and unapplied.

This is the rule `CONTEXT.md` states for a duplicated Vocabulary's Initial Snapshot: the source's visible state at duplication, including staged edits when duplication begins in its editor. Without it, a Manager who has spent an afternoon building a Board and then duplicates before saving gets a copy of the Vocabulary as it was that morning, silently.

The source must not be modified to achieve this. Duplication does not apply the pending edits, does not submit them as a Change Set, and does not clear them — the Manager returns to the source with exactly the pending changes they had. Only the copy embodies them, and it embodies them as its Initial Snapshot rather than as a Change Set, so the copy still starts with an empty history.

**Blocked by:** 02 — A Manager can duplicate a Vocabulary

**Status:** ready-for-agent

- [ ] Duplicating a Vocabulary that has staged edits produces a copy containing those edits
- [ ] Staged Board, Button, Snippet Inclusion and Palette edits are all carried, including creations, updates and deletions
- [ ] A Button created only in staged edits appears in the copy, with its Action, Palette Color binding or custom hex, and Symbol intact
- [ ] A Board deleted only in staged edits is absent from the copy, and Open Board Actions that targeted it are absent too
- [ ] After duplicating, the source still has exactly the same staged edits, still unapplied and still flagged as unsaved
- [ ] The source's Applied history gains nothing from the duplication
- [ ] The copy's Applied history is still empty — staged edits arrive as its Initial Snapshot, not as a Change Set
- [ ] Duplicating a Vocabulary with no staged edits behaves exactly as ticket 02 describes
- [ ] Duplicating a Vocabulary the Manager has not opened in the editor uses its live state
