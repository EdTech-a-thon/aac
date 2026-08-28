# 06 — Unresolved Copy Actions warn Managers about cleared Actions

**What to build:** When a cross-Vocabulary copy clears an Open Board Action, the Button that lost it carries an **Unresolved Copy Action** — a durable, Manager-only warning naming the Board that could not be copied — until a Manager repairs the Button.

Ticket 05 clears those Actions silently, which is safe for a Communicator and terrible for a Manager: a Board copied out of a large Vocabulary can arrive with a dozen dead navigation Buttons that look completely normal. The Manager finds out when someone using the Vocabulary taps one and nothing happens.

ADR 0009 records why the warning is durable and cannot be dismissed. A toast, or a banner with an X, lets a Manager acknowledge damage they have not repaired and then permanently lose track of which Buttons were affected — and the Vocabulary is used by someone who may have no way to report that a Button stopped working. So the warning is a property of the Button's unrepaired state, not a notification: it ends when the Button is repaired, and only then. Repairing means giving the Button a valid Action or deleting it. Naming the Board that was lost is what makes repair possible, since the Action itself is gone.

It is not an Action, so it never reaches the AAC app: a Communicator sees an ordinary Button that does nothing.

Domain language: `CONTEXT.md` (**Unresolved Copy Action**, **Button**, **Board**, **Action**, **Manager**, **Communicator**). Why cleared and durable: ADR 0009.

**Blocked by:** 05 — A Manager can copy a Board into another Vocabulary

**Status:** ready-for-agent

- [ ] A Button whose Open Board Action was cleared by a cross-Vocabulary copy carries an Unresolved Copy Action
- [ ] The Button is visibly marked on the manager canvas, distinguishably from selection, so a Manager can find every affected Button by looking at the Board
- [ ] Selecting the Button explains what happened and names the Board that could not be copied, using its Untitled placeholder when that Board's name was blank
- [ ] The warning survives reload, and survives the Manager leaving and reopening the Vocabulary
- [ ] There is no way to dismiss, snooze or acknowledge the warning while the Button is unrepaired
- [ ] Giving the Button a valid Action clears its warning, and only that Button's warning
- [ ] Deleting the Button clears its warning
- [ ] Editing the Button's label, background or Symbol does not clear the warning
- [ ] A Button copied with a valid or remapped Action never carries a warning, and neither does a Button that had no Action
- [ ] Copying within one Vocabulary never produces a warning
- [ ] Warnings belong to the destination Vocabulary — a second copy elsewhere does not disturb the first set
- [ ] Only Managers of that Vocabulary can see its warnings; a Communicator cannot read them at all
- [ ] In the AAC app the Button appears normally, has no Action, and shows no trace of the warning
