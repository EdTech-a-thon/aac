# 02 — Live Snippet Inclusion on a Board

**What to build:** A Manager can place a Snippet on a Board as a live Snippet Inclusion. Left-click on an empty cell still creates a Button; right-click offers Add button or Insert snippet. The inclusion is a selectable layer, movable, and removable without deleting the Snippet. Covering is a host Button created elsewhere and dragged on top. The Communicator sees flattened Buttons (host Button wins). Editing the Snippet updates every Board that includes it.

**Blocked by:** 01 — Snippets as destination-less grids

**Status:** ready-for-agent

- [ ] Right-click an empty cell (no host Button, not inside an inclusion rectangle): Add button or Insert snippet; left-click still creates a Button
- [ ] Insert snippet picks a Snippet in this Vocabulary; origin is the right-clicked cell; rectangle is the Snippet’s width × height
- [ ] The same Snippet can be included on many Boards; editing it is live on all of them
- [ ] Manager shows the inclusion as a layer with inner Buttons de-emphasized; click selects the inclusion; a host Button on top is selected instead
- [ ] Delete on a selected inclusion removes that placement only; the Snippet remains
- [ ] Covering: create a Button on a real empty cell and drag it onto the inclusion; that host Button is drawn and hit in the AAC app even if older than the inclusion
- [ ] Open the Snippet canvas from the Snippets list, by double-clicking the inclusion, or via Edit snippet while it is selected; inner Buttons are not editable on the host canvas
- [ ] Inclusions that hang off the viewport remain; only the intersection is shown and hittable
- [ ] `/live` includes Snippet Inclusions; the device flattens; tapping a flattened Snippet Button performs its Action
- [ ] Change Sets persist inclusions; descriptions/grouping understand inclusion ops
- [ ] Tests at Projected Vocabulary, Communicator session, and Change Set apply + `/live`
