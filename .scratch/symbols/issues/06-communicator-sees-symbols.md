# 06 — A Communicator sees Symbols

**What to build:** A Communicator opening a Vocabulary sees pictures on the Buttons, including Buttons that arrive through a Snippet Inclusion. The Board's images appear together rather than popping in one at a time, and a Board revisited mid-sentence loads instantly.

**Blocked by:** 03 — A Manager can put a Symbol on a Button

**Status:** ready-for-agent

- [ ] The live Vocabulary carries each Button's Symbol
- [ ] A visible cell exposes its Button's Symbol, including through a Snippet Inclusion and through nested inclusions
- [ ] The AAC app draws the Symbol below a reserved label strip, scaled to fit without cropping, with the Button's background color behind it
- [ ] Every distinct Symbol on a Board is prefetched when the snapshot loads, so the grid does not rearrange as images arrive
- [ ] Symbols are cached by digest and reload instantly on return, which is safe because bytes behind a digest never change
- [ ] Tapping a Button with a Symbol performs its Action exactly as before
- [ ] Boards with no Symbols render exactly as they do today
- [ ] No new row-level security policy is needed — the Symbol is a column on a table Communicators already read
