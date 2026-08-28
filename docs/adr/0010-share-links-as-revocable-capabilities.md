# Public sharing is a revocable capability checked in the API

A Vocabulary or a Board is shared by minting a Share Link: an unguessable token that grants anonymous read of exactly what it names, following ADR 0008's Symbol digest, where holding the identifier is the permission. Enforcement lives in the API, which validates the token and reads with the service role, rather than granting the `anon` role table access behind RLS policies. A Board Share Link's scope is a graph closure — the Board, the Snippet dependency closure needed to render it, and the Palette Colors its Buttons bind to — and it must not reveal the Boards its Open Board Actions target; expressing that as a predicate repeated across every table's policies means one wrong policy is a silent full-database read, whereas the API gives a single auditable place where "what does this link expose" is decided and keeps `revoke all ... from anon` intact everywhere.

Any Manager may create or revoke a link, at most one live link per Vocabulary and per Board, and revoking mints nothing — a later re-share produces a fresh token that leaves the old link dead. A link that is revoked, deleted, or never existed is indistinguishable to the caller, so tokens cannot be probed for existence. No viewer analytics are recorded: anonymous access that quietly logs who opened it is a surveillance surface the feature does not need.

## Consequences

Inherited from ADR 0008 and accepted: whoever holds a link can forward it, and a Vocabulary may contain personal photographs and family names. Distribution is the Manager's to control, which is why revocation is immediate for new access and why the public view offers no share control of its own.
