# 02 — A Visitor can discard their local changes

**What to build:** A Visitor editing what a Share Link sent them can throw their edits away in one step and get back what the link actually shows. Today those edits accumulate in the browser with no way back short of clearing site data, so a Visitor who experiments has no way to see the original again.

The control is confirmed before it acts, because the edits exist only in that browser and discarding them is unrecoverable by definition. Restoring means re-reading what the link currently shows — the *live* Vocabulary or Board, which may have moved on since the Visitor started editing, since a Share Link is live (ADR 0010).

This lands before the Gallery so that previewing a Publication inherits it rather than reimplementing it.

**Blocked by:** None — can start immediately.

**Status:** resolved

- [x] A Visitor who has made local edits sees a control to discard them; a Visitor who has made none is not offered a no-op.
- [x] The control asks for confirmation, and cancelling leaves every edit intact.
- [x] Confirming restores what the link currently shows, including any changes applied to the source since the Visitor began.
- [x] Discarding clears every kind of local edit the Visitor can make, leaving nothing partially reverted.
- [x] Discarding affects only that browser: it writes nothing to the source Vocabulary and submits no Change Set.
- [x] Both Vocabulary Share Links and Board Share Links offer it, and it behaves the same in each.
- [x] A Visitor who discards can immediately edit again, and the new edits persist as before.
