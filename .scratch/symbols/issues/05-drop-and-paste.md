# 05 — Drop and paste input paths

**What to build:** A Manager can get an image onto a Button without opening a file picker: drag a file straight onto a Button, drag onto an empty cell to create a Button carrying that image, or copy an image in a web browser and paste it onto the selected Button.

**Blocked by:** 04 — Client-side downscale before upload

**Status:** ready-for-agent

- [ ] Dropping an image file on an existing Button sets its Symbol
- [ ] Dropping an image file on an empty cell creates a Button carrying that Symbol with a blank label
- [ ] Copying an image in a web browser and pasting attaches it to the selected Button
- [ ] Dropped and pasted images go through the same downscale policy and the same upload path as the inspector picker
- [ ] A rejected image leaves the Button unchanged and reports why — no half-applied state
- [ ] Left-clicking an empty cell still creates a Button as it does today
- [ ] Dropping onto a cell inside a Snippet Inclusion rectangle follows the existing occupancy rules
