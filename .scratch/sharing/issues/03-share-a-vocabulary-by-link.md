# 03 — Share a Vocabulary by link

**What to build:** A Manager creates a Share Link for a Vocabulary and sends it to someone. That person opens it in a browser, with no account and no relationship to the Vocabulary, and sees the Vocabulary's Boards as a Manager would see them. Any Manager can revoke the link, after which it stops working for everyone.

The Share Link is a capability: holding it is the permission. It shows the live Vocabulary, so Change Sets applied after sharing are visible through it. Read-only in this ticket — editing arrives in 05. See ADR 0010.

**Blocked by:** 02 — The board canvas takes its data from an injected source.

**Status:** ready-for-agent

- [ ] A Manager can create a Share Link for a Vocabulary they manage, and copy it.
- [ ] There is at most one live Share Link per Vocabulary; asking again yields the same one rather than a second.
- [ ] Any Manager of that Vocabulary can revoke it. Revoking makes that link dead permanently — a later Share Link for the same Vocabulary is a different one, and the old link never works again.
- [ ] A Visitor opening a live link sees the Vocabulary's Boards, Snippets, Buttons, Snippet Inclusions, and Palette as currently applied, without signing in.
- [ ] What the Visitor sees tracks the source: a Change Set applied after the link was sent is visible on the next load.
- [ ] A link that was revoked, whose Vocabulary was deleted, or that never existed all produce the same unavailable page, disclosing nothing about whether it ever existed or what it held.
- [ ] Share Links are not Vocabulary data: they are not created by Change Sets, are not carried by duplication or Board Copy, and are destroyed with their Vocabulary.
- [ ] A Visitor cannot reach Suggested Change Sets, Applied history, Unresolved Copy Actions, the Managers list, or the Communicators list through the link.
- [ ] A Visitor cannot submit a Change Set or otherwise alter the source Vocabulary through the link.
- [ ] A signed-in User following the link gets the same public view. When they already hold a relationship to that Vocabulary — including being one of its Managers — a banner says so and points them at their own copy.
- [ ] Anonymous access is authorised in one place by the link itself; the database's anonymous role gains no table access.
- [ ] Nothing is recorded about who opened a link or how often.
