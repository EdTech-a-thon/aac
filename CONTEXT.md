# AAC

Augmentative and alternative communication product where people manage vocabularies and use them to communicate. The same person may do both.

## Language

**User**:
A person with an Auth account (email/password). Not split into separate account types.
_Avoid_: Manager account, AAC User account, role-as-account-type

**Vocabulary**:
A curated collection of Boards that Users can manage and/or use, via separate relationships. It appears in the manager app only for its Managers, and in the AAC app only for its Communicators. Has a name, which may be blank (shown as an Untitled placeholder in the UI). Has exactly one Palette. Created with an Initial Snapshot of its Boards, Buttons, and Palette. Board order and which Board is entered first are unspecified for now. Deleting a Vocabulary removes its Boards, Buttons, Palette, Initial Snapshot, Change Sets, and Management/Usage relationships with it.
_Avoid_: Page set, word list

**Initial Snapshot**:
The full Boards, Buttons, and Palette state recorded when a Vocabulary is created. For a blank Vocabulary, that means no Boards/Buttons and a Fitzgerald-default Palette. Later, creation from a template or by duplicating a Vocabulary will also produce an Initial Snapshot. Immutable after creation. The live Vocabulary's Boards, Buttons, and Palette are always reconstructable from its Initial Snapshot plus its Applied Change Sets in order.
_Avoid_: Baseline, seed, genesis, starting state (as a separate noun), template (as this concept)

**Palette**:
The Vocabulary's ordered set of Palette Colors available for Buttons. Order is meaningful (picker and settings present Palette Colors in that order) and may be changed through Change Sets. May be empty. A blank Vocabulary's Initial Snapshot includes a Fitzgerald-default Palette whose Palette Colors use grammatical-category names, short “when to choose this” descriptions, and the corresponding hexes. Editing a Palette Color's hex changes the displayed color of every Button bound to that Palette Color. After creation, Palette changes are made through Change Sets (Applied or Suggested), not by editing the Initial Snapshot.
_Avoid_: Theme, color scheme, Fitzgerald key (as the name of this concept)

**Palette Color**:
An entry in a Palette: a CSS hex (`#RRGGBB`), an optional short name (e.g. noun, verb), and an optional longer description of when to use it. Distinct from a Button's custom hex, which is not a Palette Color. Within one Palette, hexes may repeat and names may repeat (including multiple blank names). Deleting a Palette Color that no Button is bound to simply removes it. Deleting one that Buttons are bound to requires a resolution in the same Change Set: reassign those Buttons to another background color (another Palette Color, a custom hex, or unset/None), or convert each to a custom hex equal to the deleted Palette Color's last hex (freeze appearance). If a Suggested Change Set deletes a Palette Color that was unused when suggested, and Buttons are bound to it by the time the Change Set is Applied, those Buttons convert to that custom-hex freeze (no further prompt).
_Avoid_: Swatch, color token, named color (as a separate noun from Palette Color)

**Board**:
A grid that belongs to exactly one Vocabulary, with a width and height (columns and rows) describing its visible viewport. Width and height are integers ≥ 1. Has a name, which may be blank (shown as an Untitled placeholder in the UI). Boards are not shared across Vocabularies; reuse is by copy. Ordering among Boards in a Vocabulary is unspecified for now. Viewport coordinates are 0-based: in-viewport columns are `0 .. width-1`, rows `0 .. height-1`. A Board cannot outlive its Vocabulary; deleting a Board removes its Buttons.
_Avoid_: Page, screen, grid (as the name of this concept)

**Button**:
An occupant on a Board, identified by 0-based row and column indices, with a label that may be blank and a background color that is unset, a binding to one Palette Color in its Vocabulary's Palette, or a custom CSS hex (`#RRGGBB`) not stored as a Palette Color. Unset is the default for new Buttons and can be chosen again later; when unset, the Button is rendered as white. In Manager UI, the unset option is labeled **None**. A custom hex is never auto-bound to a Palette Color just because the paint matches; binding only happens when a Manager chooses that Palette Color. Empty cells in the viewport are the absence of a Button in that cell, not a blank Button. Multiple Buttons may share the same coordinates; Buttons may sit outside the Board's width/height viewport and remain part of the Board. Draw/hit order when Buttons overlap is unspecified. A Button may have zero or one Action.
_Avoid_: Cell, tile, key

**Message Bar**:
The composition strip in the AAC app where the user builds a message while using a Vocabulary. Phrases can be appended to it; it can be cleared or backspaced. It is runtime UI state in the AAC app only — not part of durable Vocabulary/Board/Button data, and not present in the manager app.
_Avoid_: Sentence bar, speech bar, utterance bar, compose bar

**Action**:
What happens when a Button is pressed in the AAC app. Configuring an Action (in the manager app) is separate from performing it. A Button may have no Action; when present, it is a single value discriminated by kind. Kinds: **Insert Phrase** (adds a configured non-empty phrase to the Message Bar; phrase is separate from the Button's label), **Speak Immediately** (speaks a configured non-empty phrase without changing the Message Bar; phrase is separate from the Button's label), **Open Board** (navigates to a specified Board in the same Vocabulary; if that Board is deleted, the Button's Action is cleared), **Play YouTube Clip** (plays a YouTube video segment identified by video id plus start and end times in seconds, which may be fractional, with start before end), **Clear Message Bar** (empties the Message Bar), and **Backspace** (removes from the end of the Message Bar; removal unit unspecified until Actions are performed). Incomplete Actions are not persisted — required payload fields must be present and valid, or the Button has no Action.
_Avoid_: Click action, press behavior, on-click, button behavior, Speak Phrase, Navigate to Board, Go to Board, Play video, Clear, Delete

**Management relationship**:
A many-to-many link between a User and a Vocabulary granting permission to configure that vocabulary (what the manager app shows). Creating a Vocabulary creates a Management relationship for the creator. Additional Managers can be added by an existing Manager supplying another User's email; if no User has that email, the add fails. Managers can remove Management relationships, but a Vocabulary must always retain at least one Manager.
_Avoid_: Ownership (for this relationship), editor, vocabulary editor, pending invite (for now)

**Usage relationship**:
A many-to-many link between a User and a Vocabulary granting permission to communicate with that vocabulary (what the app shows): read the live Vocabulary (Boards, Buttons, Palette as reconstructed from Initial Snapshot plus Applied Change Sets), perform Actions, and use the Message Bar. Not Suggested Change Sets, Applied history, or any durable writes. Independent of Management: a User may hold both relationships to the same Vocabulary; creating a Vocabulary does not create a Usage relationship. Communicators can be added by an existing Manager supplying another User's email; if no User has that email, the add fails. Communicators cannot add Usage relationships. Managers can remove Usage relationships, including the last one; Communicators cannot, including their own. A Vocabulary may have zero Communicators. Managers of a Vocabulary can see its Communicators. A Communicator can see their own Usage relationship, not other Communicators or the Managers.
_Avoid_: Assignment, subscription

**Manager** (role via relationship):
A User acting through a Management relationship to a Vocabulary — not a separate kind of account. Managing a Vocabulary means managing all of its Boards.
_Avoid_: Caregiver, clinician, admin (as account types), editor, board editor, board manager, vocabulary editor

**Communicator** (role via relationship):
A User acting through a Usage relationship to a Vocabulary — not a separate kind of account. Communicating with a Vocabulary means using the live Vocabulary in the AAC app.
_Avoid_: AAC User (as a role name), client, speaker, end user

**Change Set**:
A submitted collection of mutations to a Vocabulary's Boards, Buttons, and/or Palette. Belongs to exactly one Vocabulary; it does not outlive that Vocabulary. Has an author: the User who submitted it. Only a Manager of that Vocabulary may submit a Change Set, as Applied or as Suggested — non-Managers cannot submit Change Sets. Does not include Vocabulary name changes, Management/Usage relationship changes, or changes to the Initial Snapshot — those stay outside Change Sets (the Initial Snapshot is fixed at creation). Each Change Set has a status: **Applied** (its mutations are part of the live Vocabulary) or **Suggested** (saved, not yet applied). Applying a Change Set is the only durable way Boards, Buttons, or Palette Colors are created, updated, or deleted after creation. Submitting as Applied applies immediately and appends that Change Set to the Vocabulary's Applied history. Applying a Suggested Change Set flips that same Change Set to Applied and appends it as the new tip of the Applied history; any Manager of that Vocabulary may apply it. Any Manager may delete a Suggested Change Set without applying it. Applied Change Sets for a Vocabulary form an ordered, permanent history (for the life of the Vocabulary); the live Boards, Buttons, and Palette are always reconstructable from the Initial Snapshot plus that sequence. Suggested Change Sets are not part of that permanent history — they may be updated or deleted when an Applied Change Set lands and they are no longer meaningful (including deletion when nothing in them would do anything anymore). The exact update rules for Suggested Change Sets are unspecified for now. Suggested Change Sets are not tied to a specific point in the Applied history. “Suggestion” means a Change Set with Suggested status — not a separate concept.
_Avoid_: Draft, draft vocabulary, batch, pending edits, working copy, autosave buffer, Suggestion (as a separate noun)
