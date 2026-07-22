# 01 — Shared pending Change Set across vocabulary navigation

**What to build:** When a Manager stages Board or Button edits on a Vocabulary, those pending mutations (and the unsaved-changes UI) survive navigating away from the board workspace and back within that Vocabulary — including to a future settings route — as one shared local pending set until Applied, Suggested, or discarded.

**Blocked by:** None — can start immediately.

**Status:** resolved

## Notes

Shared `vocabularyEditorSession` holds staged Boards/Buttons per Vocabulary across route remounts. `[id]/layout` hosts `PendingChangeSetBar` (Apply/Suggest/Discard). Stub `/vocabularies/[id]/settings` + ⋯ Settings `<a>` enable navigation to verify persistence.


- [ ] Staging Board/Button edits, navigating to another route under the same Vocabulary, and returning keeps the same pending mutations
- [ ] The unsaved-changes indicator and Apply / Suggest / Discard actions remain available and consistent across that navigation
- [ ] Discarding or successfully submitting as Applied/Suggested clears the shared pending set as today
