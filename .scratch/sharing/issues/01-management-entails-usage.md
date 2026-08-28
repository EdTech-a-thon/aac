# 01 — Management entails Usage

**What to build:** A Manager of a Vocabulary can communicate with it in the AAC app without anyone granting them a Usage relationship. Managing a Vocabulary now includes using it, so a Manager who opens the AAC app finds the Vocabularies they manage listed alongside the ones they were given.

This is a rule change, not a data change: no Usage relationships are created and nothing is migrated. Existing Managers gain access the moment the rule lands. See ADR 0012.

**Blocked by:** None — can start immediately.

**Status:** resolved

- [x] A Manager who holds no Usage relationship can list and open that Vocabulary in the AAC app, read its live Boards, Snippets, Buttons, Snippet Inclusions, and Palette, perform Actions, and use the Message Bar.
- [x] A User who is neither a Manager nor a Communicator still cannot read it, and the failure is the same as it is today.
- [x] A Manager who also holds an explicit Usage relationship is unaffected; that relationship grants nothing further.
- [x] Removing a Manager's explicit Usage relationship does not take away their access. Removing their Management relationship does.
- [x] Every communicator read path inherits the rule from one place, so no read path admits Managers while another refuses them.
- [x] The control to remove a Communicator is hidden for a User who is also a Manager of that Vocabulary, labelled as having access through managing, so no one is offered an action that does nothing.
- [x] A Vocabulary's Communicators list shows only Users holding an explicit Usage relationship — Managers do not appear there merely by managing.
- [x] Existing Manager-only and Communicator-only behaviour is unchanged: Suggested Change Sets, Applied history, and Unresolved Copy Actions remain invisible to a Communicator who is not a Manager.
