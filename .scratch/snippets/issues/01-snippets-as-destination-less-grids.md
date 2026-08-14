# 01 — Snippets as destination-less grids

**What to build:** A Manager can create, name, resize, and delete Snippets, and edit their Buttons on a dedicated canvas the same way as Boards. A Snippet is never a Home Board or an Open Board target. Communicators never land on one, even if it was created first. `/live` includes Snippet records as structured Vocabulary data, not as destinations. No Snippet Inclusions yet.

**Blocked by:** None — can start immediately.

**Status:** resolved

- [x] Managers create, rename, resize, and delete Snippets through Change Sets; blank names show as Untitled
- [x] Snippets are listed separately from Boards and edited on their own canvas (Buttons, Palette, Actions)
- [x] Open Board pickers list only Boards; an Action cannot target a Snippet
- [x] Home Board is the earliest-created Board, ignoring Snippets; a Vocabulary with only Snippets has no Home Board
- [x] Communicators never open a Snippet; `/live` still includes Snippet records (not as destinations)
- [x] Initial Snapshot for a blank Vocabulary has no Snippets; Applied history reconstructs them
- [x] Suggested Change Sets can propose Snippet and Snippet-Button mutations; descriptions/grouping understand those ops
- [x] Tests at Projected Vocabulary, Communicator session, and Change Set apply + `/live`
