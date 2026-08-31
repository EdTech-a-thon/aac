# 03 — Publish a Vocabulary to the Gallery and view it at its own URL

**What to build:** A Manager can submit a Vocabulary to the Gallery, and anyone — signed in or not — can then open it at a public, stable URL and read it.

Publishing captures a **Publication Version**: an immutable snapshot of the Vocabulary's Boards, Snippets, Buttons, Snippet Inclusions, and Palette, together with its name and description at that moment, an optional attribution string naming the publisher as they wish to be credited, and figures derived once at publish — board count, button count, and the range of Board grid sizes. Editing the Vocabulary afterwards changes nothing at that URL (ADR 0013). The snapshot is the same shape the Initial Snapshot already uses, so the existing snapshot machinery does the work.

Before publishing, the Manager is shown every distinct Symbol the Vocabulary uses as a contact sheet, then makes three separate confirmations: that they hold the right to share this, that it will be free for anyone to copy and use, and that it contains no identifying content about a person who has not agreed. All three are required, and each is recorded individually alongside who confirmed, when, and the exact wording shown — wordings being immutable records of their own (ADR 0015). Most infringing or personal images are recognisable on sight and invisible in a list of board names, which is why the contact sheet sits immediately above the confirmations.

Publishing requires a non-blank name, a non-blank description, and at least one Board. Unresolved Copy Actions do not block publishing but are warned about, since publishing a Vocabulary with dead navigation buttons is a bad first impression.

The public URL is a stable, human-readable slug derived from the Vocabulary's name at first publish, which never changes afterwards even if the name does, so links that escaped keep working. Anonymous reads are authorised in the API and served with the service role, following ADR 0010 — `anon` gains no table access.

This is the heaviest ticket in the set. If it will not fit one context, split the Symbol contact sheet out rather than the attestation, and land the contact sheet immediately after.

**Blocked by:** 01 — Give a Vocabulary a description.

**Status:** resolved

- [x] A Manager can publish a Vocabulary and is given its public URL.
- [x] Publishing is refused, with a reason, when the name is blank, the description is blank, or the Vocabulary has no Boards.
- [x] A Vocabulary with Unresolved Copy Actions can still be published, and the Manager is warned before confirming.
- [x] The publish flow shows every distinct Symbol used in the Vocabulary, and shows it above the confirmations.
- [x] Publishing is refused unless all three confirmations are made, and each is stored separately with the confirming User, the time, and the identifier of the exact wording shown.
- [x] Consent wordings are stored as immutable records, so the wording a past Attestation refers to can always be recovered.
- [x] The captured version reproduces the Vocabulary's visible state at publish: Boards, Snippets, Buttons, Snippet Inclusions, and Palette, with Buttons keeping their Palette Color bindings, custom hexes, Actions, and Symbols.
- [x] Board count, button count, and the range of Board grid sizes are computed once at publish and stored on the version; Snippets are excluded from the board count.
- [x] Editing the Vocabulary after publishing — including its name, description, Boards, or Palette — changes nothing at the public URL.
- [x] A signed-out person can open the public URL and read the published version.
- [x] The slug is human-readable, derived from the name at first publish, and unique across Publications.
- [x] A non-Manager cannot publish a Vocabulary, and the public route exposes no Vocabulary that has no published Publication.
- [x] Anonymous reads go through the API with the service role; `anon` receives no new table grants.
