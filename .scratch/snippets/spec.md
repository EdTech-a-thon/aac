# Board Snippets

**Status:** ready-for-agent

Managers can design Snippets — reusable grid fragments included live on many Boards — so a Vocabulary can share a common area (top row, right column, and so on) without copying Buttons.

Domain language: `CONTEXT.md`. Storage flag vs domain split: ADR 0006. Communicator snapshot shape: ADR 0005 and ADR 0007.

## Problem Statement

A Manager designing a Vocabulary often wants the same strip of Buttons on many Boards — a common top row of actions, a common right column, and similar. Today the only reuse is by copy: each Board has its own Buttons. Changing the shared area means editing every Board. There is no way to design a fragment once and have every Board that uses it stay in sync.

## Solution

A Manager creates **Snippets**: grids with a viewport, Buttons, and optional nested Snippet Inclusions, edited on their own canvas like Boards. A Snippet is not a Board. A Communicator never lands on one (not Home Board, not an Open Board target).

The Manager places a **Snippet Inclusion** on a Board (or on another Snippet) at an origin cell. The inclusion occupies the Snippet’s own width × height and is live: editing the Snippet updates every inclusion. Host Buttons cover inclusion content. The Communicator sees a flattened Board. The Manager sees inclusions as selectable layers.

## User Stories

1. As a Manager, I want to create a Snippet in a Vocabulary, so that I can design a shared grid fragment once.
2. As a Manager, I want Snippets listed separately from Boards, so that I treat them as a different kind of thing.
3. As a Manager, I want a new Snippet to have a name, width, and height the same way a new Board does, so that I can size a 6×1 strip or a right column without pretending it is a destination Board.
4. As a Manager, I want a Snippet’s name to be blank and shown as Untitled, so that naming works like Boards.
5. As a Manager, I want to rename and resize a Snippet through Change Sets, so that edits are durable the same way Board edits are.
6. As a Manager, I want to delete a Snippet through a Change Set, so that I can remove a shared fragment I no longer need.
7. As a Manager, I want to open a Snippet on its own canvas, so that I edit its Buttons there and not on every host Board.
8. As a Manager, I want to place, move, label, color, and assign Actions to Buttons on a Snippet exactly as I do on a Board, so that I am not learning a second editor.
9. As a Manager, I want Snippet Buttons to use the Vocabulary’s Palette, custom hex, or unset/None, so that color rules are the same everywhere.
10. As a Manager, I want a Snippet Button to have any Action a Board Button can have, including Open Board to a real Board, so that a common strip can jump to Food or Home.
11. As a Manager, I want the Open Board picker to list only Boards, so that I cannot point an Action at a Snippet.
12. As a Manager, I want to insert a Snippet Inclusion onto a Board, so that several Boards can share one live strip.
13. As a Manager, I want left-click on an empty host cell to still create a Button, so that the common path for adding Buttons does not change.
14. As a Manager, I want to right-click an empty host cell and choose Add button or Insert snippet, so that I can place an inclusion without losing click-to-create-Button.
15. As a Manager, I want Insert snippet to ask which Snippet to place, with the origin at the cell I right-clicked, so that placement is explicit.
16. As a Manager, I want an empty cell to mean no host Button and not inside another inclusion’s rectangle, so that right-click on an inclusion is not confused with inserting on empty space.
17. As a Manager, I want a Snippet Inclusion to occupy a rectangle of that Snippet’s width × height from its origin, so that a 6×1 strip covers six cells.
18. As a Manager, I want to include the same Snippet on many Boards, so that one edit updates the common area everywhere.
19. As a Manager, I want to include the same Snippet more than once on one host, so that there is no special ban on repeated placements.
20. As a Manager, I want to include different Snippets on one Board, including overlapping rectangles, so that a top row and a right column can share a corner.
21. As a Manager, I want each inclusion on a host canvas shown as a distinct layer over its rectangle, with inner Buttons de-emphasized, so that I see the inclusion as a unit rather than a pile of Buttons.
22. As a Manager, I want clicking an inclusion rectangle to select that inclusion (the newest inclusion whose rectangle contains the point), even if flattened content at that point comes from an older inclusion, so that selection matches the layer, not the punch-through.
23. As a Manager, I want clicking a host Button that sits on an inclusion to select that Button, so that covers remain first-class.
24. As a Manager, I want to move a selected inclusion by dragging it, so that I can reposition a strip the same way I reposition a Button.
25. As a Manager, I want Delete on a selected inclusion to remove only that placement, so that twenty other Boards keep the Snippet.
26. As a Manager, I want to create a covering Button on a real empty cell and drag it onto an inclusion, so that one Board can hide a Snippet Button without editing the Snippet.
27. As a Manager, I want a covering host Button to win even if it was created before the inclusion, so that kind (host Button vs inclusion) beats recency.
28. As a Manager, I want to open a Snippet’s canvas from the Snippets list, so that I can find and edit fragments without hunting through Boards.
29. As a Manager, I want to double-click an inclusion to open that Snippet’s canvas, so that the layer I am looking at has a door to the only place its Buttons can be edited.
30. As a Manager, I want an Edit snippet control in the right sidebar when an inclusion is selected, so that I can open the Snippet without remembering double-click.
31. As a Manager, I want not to be able to edit inner Snippet Buttons on a host canvas, so that I do not accidentally change every Board that includes that Snippet.
32. As a Manager, I want to include a Snippet on another Snippet, so that a common-actions strip can itself be composed of smaller live fragments.
33. As a Manager, I want the editor to refuse an inclusion that would make a Snippet include itself, directly or through a chain, so that the Vocabulary cannot contain a cycle.
34. As a Manager, I want nested inclusions to be selectable only on their host Snippet’s canvas, so that a Board’s canvas only selects inclusions that belong to that Board.
35. As a Manager, I want an inclusion that hangs off the host viewport to remain part of the host, with only the intersection shown, so that shrinking a Board or placing near the edge does not destroy the inclusion.
36. As a Manager, I want resizing a Snippet to change every inclusion’s occupied rectangle while origins stay put, so that growing a 6×1 into a 6×2 updates all hosts live.
37. As a Manager, I want deleting a Snippet to remove its Buttons, the inclusions it holds, and every inclusion of it, so that hosts are not left pointing at a missing fragment.
38. As a Manager, I want deleting a Board to remove that Board’s Buttons and inclusions without deleting the Snippets themselves, so that other Boards keep the shared strip.
39. As a Manager, I want Snippet and inclusion edits to go through Change Sets (Applied or Suggested), so that history and suggestions work as they do for Boards and Buttons.
40. As a Manager, I want the Projected Vocabulary to include Snippets and Snippet Inclusions, so that unsaved local edits preview correctly.
41. As a Manager, I want a blank Vocabulary’s Initial Snapshot to have no Snippets and no inclusions, so that new Vocabularies stay empty of grid content.
42. As a Manager, I want Applied history plus the Initial Snapshot to reconstruct Snippets and inclusions, so that live state stays reconstructable.
43. As a Manager, I want Suggested Change Sets to be able to propose Snippet and inclusion mutations, so that another Manager can review shared-area edits.
44. As a Communicator, I want never to land on a Snippet, so that Open Board and Home only move me between Boards.
45. As a Communicator, I want Home Board to be the earliest-created Board, ignoring Snippets even if a Snippet was created first, so that a shared strip cannot become the entry grid.
46. As a Communicator, I want a Vocabulary that has Snippets but no Boards to have no Home Board, so that empty-of-Boards still means empty for communication.
47. As a Communicator, I want to see flattened inclusion content on a Board, so that the common strip is just Buttons I can press.
48. As a Communicator, I want a host Button to be drawn and hit instead of inclusion content at the same coordinates, so that a Manager’s cover works while I communicate.
49. As a Communicator, I want empty cells in an inclusion to punch through to older inclusions, so that a top row and a right column compose at a corner when one side leaves the corner empty.
50. As a Communicator, I want the newest inclusion’s Button to win when two inclusions both have a Button at the same coordinates (tie-break: higher identifier), so that overlap has a stable rule matching overlapping Buttons.
51. As a Communicator, I want nested inclusions to flatten recursively, so that a strip made of smaller Snippets still appears as one grid of Buttons.
52. As a Communicator, I want cells of an inclusion that sit outside the Board viewport to be hidden and not hittable, so that hanging-off content behaves like out-of-viewport Buttons.
53. As a Communicator, I want tapping a flattened Snippet Button to perform that Button’s Action, so that a shared Open Board or Insert Phrase works.
54. As a Communicator, I want the Message Bar to survive Open Board from a Snippet Button, so that navigation from a common strip does not clear composition.
55. As a Communicator, I want `/live` to include Snippets and Snippet Inclusions as structured Vocabulary data, so that the device flattens from the live Vocabulary rather than a picture of each Board.
56. As a Communicator, I want Snippets in that snapshot not to appear as places I can open, so that structured data does not become a destination list.
57. As a User who is both Manager and Communicator, I want editing a Snippet in the manager app to show up on every Board that includes it the next time the AAC app loads the live Vocabulary, so that live sharing is real, not a stamp.
58. As a Manager, I want not to convert a Board into a Snippet or a Snippet into a Board, so that destinations cannot vanish or appear by flipping a flag.
59. As a Manager, I want Snippets not to be shared across Vocabularies, so that reuse across Vocabularies stays by copy, like Boards.
60. As a Manager, I want Buttons on a Snippet that sit outside that Snippet’s viewport to remain part of the Snippet but not appear in inclusions’ mapped rectangles, so that viewport rules match Boards.
61. As a Manager, I want inserting an inclusion whose Snippet would create a cycle to fail without placing it, so that I get a refusal, not a broken graph.
62. As a Manager, I want the editor lists, Home Board derivation, Open Board targets, and Communicator current Board to all exclude Snippets, so that the storage flag never leaks into “places you can be.”

## Implementation Decisions

- Persist Snippets as Board rows with a kind flag (`board` | `snippet`), default `board`. The glossary still does not call a Snippet a Board. Every destination-shaped path (Home Board, Open Board targets, Communicator current Board) must keep only `board`. ADR 0006.
- Persist Snippet Inclusions as their own records: identity, host (a Board or Snippet row), included Snippet, origin row and column, creation time. Newest-wins among overlapping inclusions uses that creation time, then higher identifier.
- Buttons remain occupants of a Board row (`board_id`). Snippet Buttons use the same shape, with `board_id` pointing at the Snippet row.
- Change Sets are the only durable way to create, update, or delete Snippets, Snippet Inclusions, and their Buttons after Vocabulary creation. Extend mutation ops accordingly. Creating a Snippet is a Board-create-shaped mutation that sets kind `snippet`. Inclusion ops are first-class (create / update origin / delete), not stamped Buttons.
- Applying delete-Snippet removes that row’s Buttons, inclusions it holds, and every inclusion of it. Applying delete-Board (kind `board`) removes that Board’s Buttons and inclusions; Snippets remain. Open Board Actions that targeted a deleted Board still clear.
- Applying an inclusion that would introduce a cycle (a Snippet including itself, directly or through a chain) is rejected. The same refusal belongs in Projected Vocabulary / editor staging so the Manager never previews an illegal graph.
- Open Board Action validation: `board_id` must refer to a kind-`board` row in the same Vocabulary. A Snippet id is invalid, same as a missing id.
- Home Board is the earliest-created kind-`board` row (oldest creation time; tie: lower identifier). Kind-`snippet` rows never win.
- Initial Snapshot records Boards, Snippets (as flagged Board records), Buttons, Snippet Inclusions, and Palette. A blank Vocabulary has no Boards, Snippets, Buttons, or inclusions, and the Fitzgerald-default Palette.
- `/live` returns Boards, Snippets, Buttons, Snippet Inclusions, and Palette, plus revision. The AAC app flattens per Board for draw and hit. Snippets are not destinations. Do not pre-flatten Boards into Buttons-only. ADR 0005, ADR 0007.
- Flattening (Communicator draw/hit, and any preview of Communicator appearance): for each viewport cell, the host’s own Buttons at that cell win (newest Button on that host, same tie-break as today). If none, walk the host’s inclusions newest-first; each inclusion maps local coordinates and contributes its Snippet’s host Buttons, then that Snippet’s inclusions recursively. Empty mapped cells are transparent. Content outside the current viewport is skipped.
- Manager host canvas does not use Communicator flatten for hit-testing. Each inclusion is a layer over its rectangle (inner Buttons de-emphasized). Click selects the newest inclusion whose rectangle contains the point, unless a host Button is at that cell — then the host Button is selected. Nested inclusions of a Snippet are not independently selectable on a Board; only that Board’s inclusions are.
- Manager empty cell: no host Button and not inside any inclusion rectangle on that host. Left-click creates a Button. Right-click offers Add button and Insert snippet. Insert snippet picks a Snippet in this Vocabulary that would not create a cycle; origin is the right-clicked cell. Covering is create-elsewhere then drag onto the inclusion.
- Manager opens a Snippet canvas from the Snippets list, double-click on an inclusion, or an Edit snippet control while an inclusion is selected. Inner Buttons are not editable on the host canvas.
- Editor and Change Set diff paths for Snippets should reuse Board/Button paths (kind flag), plus inclusion diffing. Do not duplicate a second grid editor.
- No Board↔Snippet conversion in this spec.
- Suggested Change Set grouping and preview should treat Snippet and inclusion mutations as Vocabulary mutations in the same Change Set pipeline; exact suggestion-update rules when a later Applied Change Set lands remain unspecified (existing glossary).
- Communicator session: `currentBoard` is only a kind-`board` row; Home uses the Home Board rule above; `visibleCells` / tap use flatten. Tapping a flattened Snippet Button performs that Button’s Action. Message Bar still survives Open Board.

## Testing Decisions

Good tests assert observable Vocabulary and Communicator behavior through public interfaces: after these mutations, the Projected Vocabulary contains these Snippets and inclusions; after opening this snapshot, this Board’s visible cells and taps behave like this. They do not assert table layout, flag column names, or Manager CSS.

**Seam 1 — Projected Vocabulary** (existing Change Set projection). Durable rules: create/update/delete Snippet; create/update/delete Snippet Inclusion; live identity (one Snippet, many inclusions); resize changes occupied rectangles; delete inclusion vs delete Snippet; delete Board leaves Snippets; cycle rejection; Home Board ignores Snippets; Open Board cannot target a Snippet (Action cleared or refused); covering is a host Button at mapped coordinates, not an override record.

Prior art: existing Projected Vocabulary tests for Board, Button, and Palette mutations.

**Seam 2 — Communicator session** (`visibleCells` / tap). Flatten: host Button covers inclusion content; newest inclusion Button wins; empty cells punch through; nesting flattens; out-of-viewport inclusion cells are hidden; Home Board is never a Snippet; Vocabulary with only Snippets is empty for communication; tap performs the flattened Button’s Action (including Open Board to a Board).

Prior art: existing Communicator session tests for visible cells, overlap newest-wins, Home Board, and Actions.

**Persistence (existing API tests, not a new seam type).** Change Set apply and `/live` round-trip Snippets and inclusions in Initial Snapshot reconstruction and the Communicator snapshot. Home Board / Open Board exclusion holds on the server. Cycle-creating inclusions are rejected on apply.

Prior art: Change Sets HTTP API tests; Communicator live Vocabulary read tests.

**Not a seam.** Manager chrome: translucent inclusion layer, right-click menu, double-click, sidebar Edit snippet. Specify in user stories; verify by hand.

## Out of Scope

- Converting a Board into a Snippet or a Snippet into a Board
- Cross-Vocabulary live Snippet libraries (reuse across Vocabularies remains by copy)
- Per-Board overrides of Snippet Buttons other than covering host Buttons
- Explicit z-order UI (creation time is the stack)
- Opaque inclusion rectangles (empty cells are transparent)
- Pre-flattened Communicator snapshots
- Vocabulary templates and duplicating a Vocabulary (planned elsewhere; when they exist they must snapshot Snippets and inclusions)
- Manager-chosen Home Board
- Automated tests of Manager canvas chrome
- Copy-paste of Buttons independent of Snippets
- Changing left-click-creates-Button on empty cells

## Further Notes

- Other AAC products do not document a live embedded mini-board. Closest cousins are Proloquo2Go live templates (whole-page layout with holes) and GoTalk NOW Synced Buttons (live Buttons, not a region). Vendor “template” means a static page copy. Keep the term **Snippet**. Notes: `docs/research/aac-reusable-board-regions.md`.
- Assumed, not grilled: new Snippets are created and listed analogously to Boards; after Insert snippet the Manager picks which Snippet; inclusions move by drag like Buttons.
- The storage flag is an implementation shortcut. If a destination-shaped query forgets to filter kind, a Communicator can land on a strip. Treat that as a product bug, not a leaky abstraction to preserve.
