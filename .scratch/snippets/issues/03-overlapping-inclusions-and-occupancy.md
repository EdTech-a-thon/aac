# 03 — Overlapping inclusions and occupancy

**What to build:** A host may have several Snippet Inclusions, including the same Snippet twice and overlapping rectangles. The Communicator flattens with newest-inclusion Buttons winning and empty cells punching through. The Manager still selects by newest rectangle. Resizing a Snippet changes every inclusion’s occupied rectangle; origins stay put.

**Blocked by:** 02 — Live Snippet Inclusion on a Board

**Status:** resolved

- [x] A host may include any number of Snippets, including the same Snippet more than once
- [x] Overlapping inclusions are allowed (e.g. top row and right column sharing a corner)
- [x] Communicator: when two inclusions both map a Button to the same cell, the newest inclusion wins (tie: higher identifier)
- [x] Communicator: empty cells in an inclusion are transparent; older inclusions may show through
- [x] Manager: click still selects the newest inclusion whose rectangle contains the point, even if flattened content at that point comes from an older inclusion
- [x] Host Buttons still beat all inclusion content
- [x] Changing a Snippet’s width or height updates every inclusion’s occupied rectangle; origins do not move
- [x] Tests at Projected Vocabulary and Communicator session
