# 04 — Preview a published Vocabulary as a Visitor

**What to build:** The public URL stops being a static read and becomes a real try-before-you-take: a Visitor can use the published Vocabulary the way a Communicator would — press Buttons, build a message in the Message Bar, follow Open Board Actions — and can also edit it locally, exactly as a Visitor following a Share Link can, and discard those edits.

This is the same Visitor capability that already exists, entered from a different route (`CONTEXT.md`, **Visitor**). The canvas already takes its data from an injected source, so this ticket feeds it a frozen Publication Version instead of a live Share Link scope. Edits are the Visitor's alone: they live in that browser, never become Change Sets on the source Vocabulary, and are never seen by anyone else.

Restoring differs from the Share Link case in one way worth getting right: discarding restores *that Publication Version*, which is frozen, rather than re-reading a live source that may have moved on.

**Blocked by:** 02 — A Visitor can discard their local changes; 03 — Publish a Vocabulary to the Gallery.

**Status:** resolved

- [x] A signed-out Visitor can use a published Vocabulary: press Buttons, build and clear a message, and navigate between its Boards.
- [x] Open Board Actions work within the published version; nothing outside it is reachable or disclosed.
- [x] A Visitor can make the same local edits a Share Link Visitor can, and they persist in that browser.
- [x] Discarding restores that Publication Version, not a live read of the source Vocabulary.
- [x] Local edits never reach the source Vocabulary, submit no Change Set, and are invisible to its Managers.
- [x] A Visitor cannot see Suggested Change Sets, Applied history, Unresolved Copy Actions, Managers, or Communicators.
- [x] The Visitor experience is the same whether reached from a Share Link or a Publication, apart from what discarding restores.
