# 07 — Keep a shared Board, into a new or existing Vocabulary

**What to build:** A Visitor looking at a shared Board signs in and keeps it, choosing either a brand-new Vocabulary or one they already manage. Into a new Vocabulary the Board arrives with its Palette Colors intact, so editing a colour still recolours the Buttons bound to it. Into an existing Vocabulary it arrives as an ordinary Board Copy across Vocabularies.

**Blocked by:** 04 — Share a Board by link; 06 — Sign in and keep a shared Vocabulary.

**Status:** ready-for-agent

- [ ] A Visitor can choose between creating a new Vocabulary for the Board and adding it to one they already manage, and is shown the Vocabularies available to them.
- [ ] Saved into a new Vocabulary: the Board and the Snippets it needs arrive, the Palette Colors its Buttons bind to arrive as real Palette Colors with those bindings intact, and editing one recolours every Button bound to it.
- [ ] Saved into a new Vocabulary: the saver is its sole Manager, can communicate with it, and the Board is that Vocabulary's Home Board.
- [ ] Saved into an existing Vocabulary: this is Board Copy across Vocabularies — the included Snippets and their dependency closure are copied, Palette Color bindings freeze to custom hexes, self-opening Actions remap to the new Board, and Actions targeting Boards outside the copy are cleared.
- [ ] Every Button whose Action was cleared raises an Unresolved Copy Action in the destination, resolvable only by giving that Button a valid Action or deleting it.
- [ ] The destination Vocabulary's existing Boards, Palette, and Change Set history are otherwise untouched, and the copy arrives through one Applied Change Set.
- [ ] A Visitor's own edits to the shared Board are carried into whichever destination they choose.
- [ ] The Visitor cannot save into a Vocabulary they do not manage.
- [ ] The source Vocabulary is unchanged in either case.
