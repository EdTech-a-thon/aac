# 05 — A Visitor edits what they were sent

**What to build:** A Visitor following a Share Link can change what they see — move and edit Buttons, recolour them, add and delete Boards and Snippets, place Snippet Inclusions, edit the Palette — without signing in. Those edits are theirs alone. They never touch the source Vocabulary, and they survive a reload so nothing is lost while the Visitor decides what to do next.

Their edits live only in their own browser. See ADR 0011. Saving them arrives in 06.

**Blocked by:** 03 — Share a Vocabulary by link.

**Status:** ready-for-agent

- [ ] A Visitor can make the full range of edits a Manager can stage on the canvas, with one exception below, and see them reflected immediately.
- [ ] A Visitor cannot add a Symbol, and the control makes clear this needs an account.
- [ ] Nothing a Visitor does creates a Change Set on the source Vocabulary or changes anything a Manager of it would see.
- [ ] Reloading the page, or following the same link again on the same device, offers the Visitor their edits back, with a visible way to discard them and start from the current source.
- [ ] Starting over discards the edits for that link and shows the source's current live state.
- [ ] Edits are kept per Share Link, so following a different link does not show another link's work.
- [ ] A Visitor who already loaded a link keeps their session and their edits if the link is revoked while they work; revocation stops new access, not work in progress.
- [ ] A Visitor sees, at any time, that their changes are unsaved and belong to them.
