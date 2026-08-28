# 04 — Share a Board by link

**What to build:** A Manager shares a single Board rather than the whole Vocabulary. The Visitor sees that Board rendered faithfully — including any Snippets it needs to draw itself — without gaining sight of the rest of the Vocabulary. Buttons whose Open Board Action points at a Board outside the link do nothing when pressed, and never reveal what they pointed at.

**Blocked by:** 03 — Share a Vocabulary by link.

**Status:** implemented. The exposure rules are proven by unit tests; the wiring is covered by integration tests that stay red until the Share Link migration is applied

- [ ] A Manager can create and revoke a Share Link for a single Board, with the same one-live-link and permanent-revocation rules as a Vocabulary Share Link.
- [ ] A Visitor opening a Board Share Link sees that Board's Buttons, its Snippet Inclusions flattened through the full chain of Snippets they include, and the Palette Colors those Buttons bind to.
- [ ] Overlap order is preserved exactly as on the source: host Buttons over inclusion content, newest Button and newest inclusion winning, and Buttons outside the viewport still present.
- [ ] A Button whose Open Board Action targets a Board not covered by the link does nothing when pressed, shows no error, and does not disclose the target's name or existence anywhere in the response or the page.
- [ ] No Board, Snippet, Button, or Palette Color outside the link's scope is reachable through it, including by asking for one directly.
- [ ] A Board Share Link dies with its Board as well as with its Vocabulary.
- [ ] A Snippet cannot be shared directly; only a Board can.
