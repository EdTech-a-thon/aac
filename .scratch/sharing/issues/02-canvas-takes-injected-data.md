# 02 — The board canvas takes its data from an injected source

**What to build:** No user-visible change. Today the editing canvas fetches its own Boards, Buttons, Palette Colors, and Snippet Inclusions using the signed-in User's session, so it cannot render for anyone without an account. Give it one seam through which its data arrives, so the same canvas can later be fed from a Share Link instead of a session.

This is a prefactor. Make the change easy, then make the easy change — every ticket after this one renders the same canvas for a Visitor.

**Blocked by:** None — can start immediately.

**Status:** resolved

- [x] The canvas renders from data supplied to it rather than reaching for the signed-in User's credentials itself.
- [x] Actions that write — submitting Change Sets, uploading Symbols, copying a Board, reloading and rebasing — remain available and unchanged when a signed-in Manager is the source.
- [x] Whether the canvas may write is something it is told, not something it infers from whether it happens to hold credentials.
- [x] Every existing manager flow behaves exactly as before: opening a Vocabulary, editing, staging, saving, previewing a Suggested Change Set, and the Unresolved Copy Action warnings.
- [x] The full manager and API suites pass with no new failures, and typechecking is clean.
