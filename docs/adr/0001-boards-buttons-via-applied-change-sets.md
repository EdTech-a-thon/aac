# Boards, Buttons, and Palette mutate only via Applied Change Sets

We need Managers to stage many board/button/palette edits locally, submit them as one unit, and keep a reconstructable history for later time-travel/undo — without building share modes yet. After creation, Boards, Buttons, and Palette change only by applying a Change Set: submit-as-Applied appends to an ordered permanent history for that Vocabulary; Suggested Change Sets are the same concept left unapplied until a Manager applies or deletes them. Direct per-field CRUD on Boards/Buttons/Palette is rejected because it cannot reconstruct history or prepare for confirmable Suggestions.

Live reconstructability is Initial Snapshot + Applied Change Sets (see ADR 0003), not Applied history alone.
