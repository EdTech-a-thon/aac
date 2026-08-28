# 01 — Creation order is preserved within one Change Set

**What to build:** Prefactor. When several Boards, Snippets, Buttons or Snippet Inclusions are created by a single Change Set, they end up ordered by the order they were submitted in, rather than tying and falling back to identifier comparison.

Today every row a Change Set creates is stamped with the same creation time, because that time is taken once for the whole transaction. `CONTEXT.md` breaks both of its remaining ties by identifier — overlapping Buttons resolve to "the one with the higher identifier", the Home Board to "the one with the lower identifier" — and freshly minted identifiers carry no order, so the outcome is arbitrary.

Nothing a Manager does today creates enough rows at once for this to show. Every copying ticket below creates an entire Board or an entire Vocabulary in one Change Set, so without this, a Board Copy cannot promise to preserve overlap order and a duplicated Vocabulary cannot promise to keep its Home Board. Land it first so those promises are achievable rather than approximated.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Two Buttons created by one Change Set at the same coordinates draw and hit in submission order — the later-submitted Button wins — in the manager canvas and in the AAC app
- [ ] Several Boards created by one Change Set are ordered by submission order, and the first one submitted is the Vocabulary's Home Board
- [ ] Several Snippet Inclusions created by one Change Set layer in submission order, so the later-submitted inclusion wins where their flattened content collides
- [ ] Ordering still holds when the same Change Set creates Boards, Buttons and Snippet Inclusions together
- [ ] Rows created by separate Change Sets keep ordering by when each Change Set was applied
- [ ] Applying a Suggested Change Set orders its rows the same way as submitting the same mutations as Applied
- [ ] The existing Change Set, Snippet, Palette and Symbol suites stay green
