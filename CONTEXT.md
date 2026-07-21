# AAC

Augmentative and alternative communication product where people manage vocabularies and use them to communicate. The same person may do both.

## Language

**User**:
A person with an Auth account (email/password). Not split into separate account types.
_Avoid_: Manager account, AAC User account, role-as-account-type

**Vocabulary**:
A curated collection of Boards that Users can manage and/or use, via separate relationships. Has a name, which may be blank (shown as an Untitled placeholder in the UI). Board order and which Board is entered first are unspecified for now. Deleting a Vocabulary removes its Boards, Buttons, and Management/Usage relationships with it.
_Avoid_: Page set, word list

**Board**:
A grid that belongs to exactly one Vocabulary, with a width and height (columns and rows) describing its visible viewport. Width and height are integers ≥ 1. Has a name, which may be blank (shown as an Untitled placeholder in the UI). Boards are not shared across Vocabularies; reuse is by copy. Ordering among Boards in a Vocabulary is unspecified for now. Viewport coordinates are 0-based: in-viewport columns are `0 .. width-1`, rows `0 .. height-1`. A Board cannot outlive its Vocabulary; deleting a Board removes its Buttons.
_Avoid_: Page, screen, grid (as the name of this concept)

**Button**:
An occupant on a Board, identified by 0-based row and column indices, with a label that may be blank. Empty cells in the viewport are the absence of a Button in that cell, not a blank Button. Multiple Buttons may share the same coordinates; Buttons may sit outside the Board's width/height viewport and remain part of the Board. Draw/hit order when Buttons overlap is unspecified. Press behavior is out of scope for now.
_Avoid_: Cell, tile, key

**Management relationship**:
A many-to-many link between a User and a Vocabulary granting permission to configure that vocabulary (what the manager app shows). Creating a Vocabulary creates a Management relationship for the creator. Additional Managers can be added by an existing Manager supplying another User's email; if no User has that email, the add fails. Managers can remove Management relationships, but a Vocabulary must always retain at least one Manager.
_Avoid_: Ownership (for this relationship), editor, vocabulary editor, pending invite (for now)

**Usage relationship**:
A many-to-many link between a User and a Vocabulary granting permission to communicate with that vocabulary (what the app shows). Independent of Management; creating a Vocabulary does not create a Usage relationship.
_Avoid_: Assignment, subscription

**Manager** (role via relationship):
A User acting through a Management relationship to a Vocabulary — not a separate kind of account. Managing a Vocabulary means managing all of its Boards.
_Avoid_: Caregiver, clinician, admin (as account types), editor, board editor, board manager, vocabulary editor
