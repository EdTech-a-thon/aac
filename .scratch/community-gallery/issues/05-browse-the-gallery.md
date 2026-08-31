# 05 — Browse and search the Gallery

**What to build:** A public index of everything published — the Gallery — that anyone can browse without an account, from which they can open any Publication's page.

Each listing shows its title, description, and attribution, plus figures that let someone judge size without opening it: number of Boards, number of Buttons, and the range of Board grid sizes, shown as glyphs rather than prose. Those figures come from the Publication Version, already computed at publish; the Gallery never reads live Vocabulary tables. Snippet count is deliberately not shown.

Ordering is newest first, with substring search over titles and descriptions. Most-endorsed ordering arrives with Endorsements in ticket 07 and becomes the default then.

Withdrawn Publications do not appear and their listings are not reachable. No views are recorded — browsing the Gallery is not logged, per ADR 0014.

**Blocked by:** 03 — Publish a Vocabulary to the Gallery.

**Status:** resolved

- [x] A signed-out person can browse the Gallery and open any listing.
- [x] Each listing shows title, description, attribution, board count, button count, and grid size range, the range collapsing to one value when every Board is the same size.
- [x] Snippet count is not shown.
- [x] Listings are ordered newest first.
- [x] Substring search matches titles and descriptions and is case-insensitive.
- [x] A search matching nothing says so rather than showing an empty page.
- [x] Withdrawn Publications appear nowhere in the Gallery and their pages are not reachable.
- [x] The Gallery reads only published version data — no query touches live Vocabulary tables.
- [x] Nothing is recorded when a listing is viewed.
