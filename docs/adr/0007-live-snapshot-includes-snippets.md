# Communicator live snapshot includes Snippets

The AAC app caches the live Vocabulary, not a picture of each Board (ADR 0005). `/live` therefore includes Snippets and Snippet Inclusions; the device flattens for draw and hit. Snippets in that snapshot are not destinations. Pre-flattening each Board into Buttons-only was rejected because covering host Buttons and Snippet Buttons would become indistinguishable and the cache would no longer be the Vocabulary.
