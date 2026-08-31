# 06 — Copy a published Vocabulary into your account

**What to build:** Someone previewing a published Vocabulary can keep it. Signing in turns what they are looking at into a new, independent Vocabulary of their own, of which they are the sole Manager — the same duplication that saving from a Share Link already performs.

The copy is independent in content and unaffected by anything that later happens to the Publication. It differs from a Share Link save in two ways. First, it records a **Copy**: one row per resulting Vocabulary, written when the copy completes rather than when it is requested, naming the Publication, the version taken, the copying User, and the time. Repeat copies by the same person each count — a clinician making one per client is the signal, not noise in it. Second, the new Vocabulary durably records the Publication Version it came from: a dead reference shown only to its own Managers, which never updates it and simply stops resolving if the Publication is withdrawn or its source Vocabulary deleted.

The copy count is shown to the Publication's own Managers as an aggregate and to nobody else. It is never public and is not a ranking signal (ADR 0014). Who copied is never shown to the publisher.

A Visitor who has made local edits before signing in keeps what they see, exactly as the Share Link save does.

**Blocked by:** 04 — Preview a published Vocabulary as a Visitor.

**Status:** ready-for-agent

- [ ] Someone previewing a Publication can sign in and keep it as a new Vocabulary they solely manage.
- [ ] Local edits made before signing in are carried into the copy.
- [ ] The copy is independent: later versions of the Publication, its withdrawal, or deletion of the source Vocabulary leave it untouched.
- [ ] Exactly one Copy is recorded per resulting Vocabulary, on completion, naming the Publication, the version, the User, and the time.
- [ ] A failed copy records no Copy.
- [ ] The same User copying twice produces two Vocabularies and two Copy records.
- [ ] The copy records the Publication Version it came from, shown only to its own Managers.
- [ ] That origin never updates the copy, and resolves to nothing once the Publication is withdrawn or its source Vocabulary deleted, leaving the copy intact.
- [ ] A Publication's Managers see their aggregate copy count; nobody sees who copied, including them.
- [ ] The copy count appears nowhere public and does not affect Gallery ordering.
