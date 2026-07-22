# 03 — Edit Palette via Change Sets on vocabulary settings

**What to build:** Managers open `/vocabularies/[id]/settings` (settings shell with Palette first) from the Vocabulary ⋯ menu via an accessible `<a>` link. They can add, update, reorder, and delete Palette Colors into the same shared pending Change Set as Board/Button edits, then Apply or Suggest from that page. Palette mutations become Applied history (or Suggested) like Boards/Buttons.

**Blocked by:** 01 — Shared pending Change Set across vocabulary navigation; 02 — Initial Snapshot with Fitzgerald-default Palette on Vocabulary create.

**Status:** resolved

## Notes

Palette create/update/delete via Change Sets; settings page edits into shared session; PendingChangeSetBar submits board+palette mutations together. Delete-in-use resolution deferred to ticket 05.


- [ ] `/vocabularies/[id]/settings` exists as a settings shell; Palette editing is the first (and for now only) section
- [ ] The Vocabulary ⋯ menu includes a Settings item that is an `<a>` to that route (not a button navigation)
- [ ] Palette Color create/update/reorder/delete stage into the shared pending set and submit as Applied or Suggested Change Sets
- [ ] Applying Palette mutations updates the live Palette; Suggested ones do not until applied
- [ ] Unsaved Palette edits survive navigating between the board workspace and settings (shared pending set)
