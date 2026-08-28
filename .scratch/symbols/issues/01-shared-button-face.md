# 01 — Extract a shared Button face

**What to build:** No behaviour change. The visible face of a Button is currently drawn in three near-identical places in the manager — the Board canvas host layer, the Snippet Inclusion layer, and the Suggested Change Set preview — each with its own duplicated background-hex resolution. Extract one shared Button face used by all three, so that adding a reserved label strip and a Symbol later happens once instead of three times.

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] One shared Button face renders a Button's background color, contrasting text color, and label
- [ ] The Board canvas host layer uses it and looks identical to before
- [ ] The Snippet Inclusion layer uses it, keeping its de-emphasized treatment
- [ ] The Suggested Change Set preview uses it and looks identical to before
- [ ] Background-hex resolution (Palette Color binding, custom hex, unset) lives in one place rather than duplicated per call site
- [ ] Existing manager tests stay green; no new behaviour is introduced
