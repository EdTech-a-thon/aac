# 04 — A Manager can copy a Board within one Vocabulary

**What to build:** A Manager chooses **Copy board** on a Board, names the copy, and a new Board appears in the same Vocabulary immediately, holding everything the source Board shows.

This is the **Board Copy** of `CONTEXT.md`: a new independent Board created immediately through one Applied Change Set. Immediately is deliberate — a Manager copying a Board expects a Board, not a proposal — so the copy applies on its own rather than joining the Manager's pending edits. Their pending edits survive that and stay unapplied, which is what "without applying pending source edits" means: the copy is taken from the visible state, including staged edits, but staging it does not push the Manager's other work live.

Within one Vocabulary the copy stays connected to what the source was connected to. A Snippet Inclusion on the copy includes the same live Snippet, so editing that Snippet still updates both hosts — copying a Board must not fork the Snippets it shows. Palette Color bindings are kept, because the Palette is the same one. Open Board Actions are kept and still point where they pointed, because the target Boards are all still in this Vocabulary.

Snippets themselves are not copyable here; **Board Copy** is defined for Boards.

Domain language: `CONTEXT.md` (**Board Copy**, **Board**, **Snippet**, **Snippet Inclusion**, **Button**, **Palette Color**, **Action**, **Change Set**). Durability model: ADR 0001 and ADR 0003. Snippets as flagged Boards: ADR 0006.

**Blocked by:** 02 — A Manager can duplicate a Vocabulary

**Status:** ready-for-agent

- [ ] A Manager can start a copy from a Board's menu, name it, and the copy appears in the Vocabulary right away and becomes the selected Board
- [ ] The copy is created through one Applied Change Set that lands in the Vocabulary's history, described well enough that a Manager reading the history knows a Board was copied
- [ ] Every Button on the source Board is copied, with its label, background — Palette Color binding or custom hex or unset — Action, and Symbol
- [ ] Palette Color bindings are retained rather than frozen, so later editing that Palette Color changes the copied Buttons too
- [ ] An Open Board Action on a copied Button still opens the Board it opened before, including when that Board is the source Board itself
- [ ] Every Snippet Inclusion on the source Board is copied and includes the same live Snippet — no Snippet is duplicated
- [ ] Editing that Snippet afterwards changes what both the source Board and the copy show
- [ ] Buttons outside the source Board's viewport are copied and remain outside the copy's viewport
- [ ] Overlapping Buttons keep their relative draw and hit order on the copy
- [ ] A Board carrying staged edits copies what the Manager sees, staged edits included
- [ ] After the copy, the Manager's pending edits are still pending, still unapplied, and still flagged as unsaved
- [ ] Copying does not disturb the source Board
- [ ] The Copy board control is not offered for a Snippet
- [ ] A Manager whose editor is open on the Vocabulary sees the copy without losing their place or their pending work
