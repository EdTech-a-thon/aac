# 05 — A Manager can copy a Board into another Vocabulary

**What to build:** The copy dialog gains a destination: any Vocabulary the Manager also manages. Choosing a different Vocabulary copies the Board there, and the Manager is taken to the destination with the copy selected.

Across Vocabularies nothing can be shared, because `CONTEXT.md` binds Boards, Snippets and Palettes each to exactly one Vocabulary and says reuse is by copy. So each of the three connections the same-Vocabulary copy kept has to be resolved instead:

**Snippets are copied, with their dependency closure.** A Snippet Inclusion cannot reach across Vocabularies, so every included Snippet is copied into the destination, and every Snippet those Snippets include, transitively. The copies are ordinary Snippets in the destination and are not linked back to the source.

**Palette Color bindings freeze to custom hexes.** The destination has its own Palette, and a source Palette Color has no counterpart there. Matching by hex would silently bind a Button to a Palette Color that means something different — `CONTEXT.md` is explicit that a custom hex is never auto-bound just because the paint matches — so the Button keeps its appearance as a custom hex and a Manager can rebind deliberately.

**Open Board Actions are remapped or cleared.** An Action opening the copied Board itself follows the copy. An Action opening any other Board has no valid target in the destination and is cleared. Ticket 06 makes that loss visible; here the cleared Action simply leaves a Button with no Action, which is a safe Button rather than a broken one.

Domain language: `CONTEXT.md` (**Board Copy**, **Vocabulary**, **Board**, **Snippet**, **Snippet Inclusion**, **Palette**, **Palette Color**, **Button**, **Action**, **Symbol**). Cleared rather than persisted-invalid Actions: ADR 0009.

**Blocked by:** 04 — A Manager can copy a Board within one Vocabulary

**Status:** ready-for-agent

- [ ] The copy dialog offers the Manager's other Vocabularies as destinations, and defaults to the current one
- [ ] Copying into another Vocabulary creates the Board there through one Applied Change Set in that Vocabulary's history, and leaves the source Vocabulary's history untouched
- [ ] The Manager is taken to the destination with the copy selected
- [ ] Every Snippet the copied Board includes is copied into the destination, together with every Snippet reachable through nested inclusions
- [ ] The copied Snippets are independent — editing one in the destination does not change the source Vocabulary, and vice versa
- [ ] A Snippet included twice on the source Board is copied once and included twice in the destination
- [ ] Copied inclusions keep their origins, their layering order, and their content that falls outside the host's viewport
- [ ] A Button bound to a Palette Color becomes a Button with a custom hex equal to that Palette Color's hex, bound to nothing in the destination
- [ ] A Button that already had a custom hex, or an unset background, is unchanged
- [ ] An Open Board Action targeting the source Board itself opens the copy in the destination
- [ ] An Open Board Action targeting any other Board is cleared, leaving a Button with no Action
- [ ] Insert Phrase, Speak Immediately, Play YouTube Clip, Clear Message Bar and Backspace Actions are copied untouched
- [ ] Symbols are carried by reference into the destination, with no re-upload
- [ ] A Manager who does not manage the destination cannot copy into it, and one who no longer manages the source cannot copy from it
- [ ] A Communicator of the destination sees the new Board and its Buttons, with cleared Actions simply doing nothing
