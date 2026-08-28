# 02 — A Manager can duplicate a Vocabulary

**What to build:** A Manager picks **Duplicate vocabulary** from a Vocabulary's menu in the manager dashboard, names the copy, and lands in a new Vocabulary that is a full independent replica of the source and shares nothing with it.

Everything the source holds is recreated under new identifiers: Boards, Snippets, Buttons, Snippet Inclusions, and the Palette. References follow the copies rather than the originals — an Open Board Action points at the copied Board, a Snippet Inclusion includes the copied Snippet, and a Button bound to a Palette Color is bound to the copied Palette Color. Symbols are carried by reference, not re-uploaded, per ADR 0008.

Access starts fresh, which is the point of the feature: the duplicating User is the copy's sole Manager and the copy has no Communicators, so duplicating a Vocabulary shared with a Communicator never leaks it. The copy's Initial Snapshot is the source's state at duplication and its Applied history starts empty, so the copy satisfies ADR 0003 on its own terms without inheriting the source's history.

Domain language: `CONTEXT.md` (**Vocabulary**, **Initial Snapshot**, **Palette**, **Palette Color**, **Board**, **Home Board**, **Snippet**, **Snippet Inclusion**, **Button**, **Symbol**, **Action**, **Change Set**, **Management relationship**, **Usage relationship**). Durability model: ADR 0001 and ADR 0003. Symbols by reference: ADR 0008.

**Blocked by:** 01 — Creation order is preserved within one Change Set

**Status:** ready-for-agent

- [ ] A Manager can start a duplicate from a Vocabulary's menu, give the copy a name, and is taken into the copy when it is created
- [ ] The copy is a new Vocabulary — every Board, Snippet, Button, Snippet Inclusion and Palette Color exists under a new identifier, and none of the source's rows are shared or moved
- [ ] An Open Board Action in the copy opens the copied Board, never the source's Board
- [ ] A Snippet Inclusion in the copy includes the copied Snippet, and nested inclusions resolve entirely within the copy
- [ ] A Button bound to a Palette Color in the source is bound to the corresponding copied Palette Color, and Palette order is preserved
- [ ] A Button with a custom hex, and a Button with an unset background, each survive duplication unchanged
- [ ] A Button's Symbol survives as a reference — no bytes are re-uploaded and the same Symbol serves both Vocabularies
- [ ] Buttons sitting outside a Board's viewport are copied and stay outside it, and overlap order among Buttons is preserved
- [ ] The copy's Home Board is the copy of the source's Home Board
- [ ] The copy's Initial Snapshot describes the state it was created with, and the live Vocabulary is reconstructable from it
- [ ] The copy's Applied Change Set history is empty and it has no Suggested Change Sets, whatever the source's history held
- [ ] The duplicating User is the copy's only Manager, and the copy has no Communicators even when the source had several
- [ ] The source Vocabulary is untouched — same Boards, same Palette, same history, same Managers and Communicators
- [ ] A User who is not a Manager of the source cannot duplicate it
- [ ] Duplicating an empty Vocabulary produces an empty Vocabulary with the source's Palette
