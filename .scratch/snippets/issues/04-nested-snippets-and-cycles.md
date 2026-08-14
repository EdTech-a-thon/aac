# 04 — Nested Snippets and cycles

**What to build:** A Snippet may include another Snippet. Flatten is recursive. A Snippet must not include itself, directly or through a chain — that inclusion is refused. Nested inclusions are selectable only on their host Snippet’s canvas. Deleting a Snippet removes every inclusion of it, including nested ones.

**Blocked by:** 02 — Live Snippet Inclusion on a Board

**Status:** ready-for-agent

- [ ] A Manager can insert a Snippet Inclusion onto a Snippet canvas, not only onto a Board
- [ ] Communicator flatten walks nested inclusions recursively
- [ ] Inserting an inclusion that would create a cycle is refused in the editor and on Change Set apply; no illegal graph is persisted
- [ ] On a Board, only that Board’s inclusions are selectable; nested inclusions are selected on their host Snippet’s canvas
- [ ] Deleting a Snippet removes its Buttons, the inclusions it holds, and every inclusion of it (on Boards and on other Snippets); covering host Buttons stay
- [ ] Deleting a Board still leaves Snippets themselves intact
- [ ] Tests at Projected Vocabulary, Communicator session, and Change Set apply
