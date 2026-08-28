# 04 — Client-side downscale before upload

**What to build:** A Manager can use a photo straight off their phone instead of watching it bounce off the size cap. Large images are shrunk in the browser before upload; small ones are sent untouched so that standard symbol sets stay byte-identical and store only once.

**Blocked by:** 03 — A Manager can put a Symbol on a Button

**Status:** ready-for-agent

- [ ] A pure policy decides between three outcomes: pass the bytes through untouched, re-encode at a named format and maximum edge, or reject with a reason
- [ ] An image at most 1 MB with a longest edge at most 1024 px passes through untouched — this is what protects deduplication and must be tested directly
- [ ] A larger or wider image re-encodes with its longest edge capped at 1024 px
- [ ] An image with an alpha channel re-encodes to PNG, preserving transparency
- [ ] An image without an alpha channel re-encodes to JPEG, with quality stepped down until the result is under 1 MB
- [ ] SVG, unknown types, and undecodable files are rejected with a reason
- [ ] A large photo that previously exceeded the cap now uploads successfully
- [ ] The canvas work is a thin wrapper around the policy, so the policy is testable without a DOM
