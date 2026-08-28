# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

This repo is **single-context**: one `CONTEXT.md` at the root, one `docs/adr/` directory. The three packages under `apps/` (api, app, manager) are deployables over one shared domain, not separate contexts.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root — the AAC glossary: Vocabulary, Initial Snapshot, Palette, Palette Color, Board, Home Board, Snippet, Snippet Inclusion, Button, Symbol, Message Bar, Action, Change Set, Projected Vocabulary, and the Manager/Communicator roles.
- **`docs/adr/`** — read the ADRs that touch the area you're about to work in. This repo currently has `0001` through `0008`.

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The `/domain-modeling` skill (reached via `/grill-with-docs` and `/improve-codebase-architecture`) creates them lazily when terms or decisions actually get resolved.

## File structure

```
/
├── CONTEXT.md
├── docs/adr/
│   ├── 0001-boards-buttons-via-applied-change-sets.md
│   └── …
└── apps/
```

If a `CONTEXT-MAP.md` ever appears at the root, this repo has moved to multiple contexts: read it to find each context's own `CONTEXT.md`, and also check `<context>/docs/adr/` for context-scoped decisions. That is not the case today.

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids — each entry carries an `_Avoid_` line, and those are binding. Say Button, not tile or cell. Say Symbol, not icon or image.

If the concept you need isn't in the glossary yet, that's a signal — either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0007 (live snapshot includes Snippets) — but worth reopening because…_
