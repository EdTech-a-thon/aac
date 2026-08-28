# Management entails Usage

A Manager of a Vocabulary can always communicate with it. Rather than granting each Manager a separate Usage relationship, `private.is_vocabulary_communicator` returns true for Managers, so every communicator read policy and route guard inherits the rule from one predicate. Granting rows instead was rejected because a granted row can later be removed, silently returning a Manager to the state where they configure a Vocabulary they cannot open in the AAC app — the drift this decision exists to end. No rows are created and nothing is migrated: existing Managers gain access the moment the predicate changes.

## Consequences

A Manager's ability to communicate cannot be revoked without removing their Management relationship. Explicit Usage relationships that some Managers already hold become redundant; they are left in place and grant nothing extra, and the control to remove one is hidden for a User who is also a Manager so nobody is offered a button that does nothing. Managers do not appear in a Vocabulary's Communicators list unless they hold an explicit Usage relationship, so that list keeps meaning "people who use this without configuring it."
