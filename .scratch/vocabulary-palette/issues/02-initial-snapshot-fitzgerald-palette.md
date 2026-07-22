# 02 — Initial Snapshot with Fitzgerald-default Palette on Vocabulary create

**What to build:** Creating a Vocabulary records an immutable Initial Snapshot with no Boards/Buttons and a Fitzgerald-default Palette (category names, short descriptions, agreed hexes). That Palette is part of the live Vocabulary. Existing Vocabularies are wiped everywhere so there is no legacy hex-only migration.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] All existing Vocabularies (and dependents) are deleted in local and linked remote/dev environments used for this project
- [ ] Creating a Vocabulary stores an Initial Snapshot: empty Boards/Buttons + Fitzgerald-default Palette Colors
- [ ] Managers can read the live Palette for a Vocabulary after creation (matches the Fitzgerald-default rows)
- [ ] The Initial Snapshot is not modified by later edits (Palette changes come later via Change Sets)
