# Live Vocabulary = Initial Snapshot + Applied Change Sets

Blank Vocabularies need a Fitzgerald-default Palette at creation, and we will later create Vocabularies from templates or by duplication — so creation must record a full Boards/Buttons/Palette baseline, not an empty history. We store an immutable Initial Snapshot at creation and treat Applied Change Sets as the only mutations after that; live Boards, Buttons, and Palette reconstruct from snapshot + Applied history in order. Seeding the default Palette as a synthetic first Applied Change Set was rejected because it conflates authorship/history with genesis and does not generalize to template/duplicate creation. Direct Palette CRUD outside Change Sets was rejected because Palette edits must be Suggestable and part of Vocabulary history like Boards/Buttons.

This revises ADR 0001’s claim that Applied history alone reconstructs the live Vocabulary; Change Sets remain the only post-creation mutation path.
