# 03 — A Manager can put a Symbol on a Button

**What to build:** The core slice. A Manager selects a Button, picks an image file from a Symbol section in the inspector, and the picture appears on that Button — on the canvas, in Snippet Inclusion layers, and after the Change Set is applied. The Symbol sits below a reserved label strip, scaled to fit without cropping, with the Button's background color showing behind it so a transparent image takes the color of its Button.

**Blocked by:** 01 — Extract a shared Button face; 02 — Symbol upload endpoint and public bucket

**Status:** ready-for-agent

- [ ] A Button carries an optional Symbol reference; absent means no Symbol
- [ ] The Symbol section in the Button inspector can set, replace, and clear a Symbol, with clear labelled **None** like the color picker
- [ ] Attaching or clearing a Symbol becomes a pending change and marks the editor dirty
- [ ] Discarding pending changes reverts the Symbol
- [ ] Submitting produces a Change Set that carries the Symbol on button create and update mutations — no new mutation kind is introduced
- [ ] Changing only the Symbol still produces a mutation (the button diff key must include it, or the edit silently fails to diff)
- [ ] Applying the Change Set persists the Symbol and it survives a reload
- [ ] The Initial Snapshot round-trips a Symbol, so a Vocabulary created from a snapshot keeps its images
- [ ] The Button draws a reserved label strip on top and the Symbol below it, scaled to fit entirely without cropping
- [ ] The label strip is reserved even when the label is blank, so Symbols stay aligned across a row
- [ ] The Button's background color shows behind the Symbol, so a transparent image takes its Button's color
- [ ] A Symbol works with a Palette Color binding, a custom hex, and an unset background alike
- [ ] Buttons on a Snippet can carry Symbols, and they appear in every Snippet Inclusion of that Snippet
- [ ] Boards with no Symbols look and behave exactly as before
