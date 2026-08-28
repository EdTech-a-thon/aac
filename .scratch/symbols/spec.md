# Symbols on Buttons

**Status:** ready-for-agent

Managers can put a picture on a Button — a **Symbol** — so that Communicators who do not read can find words by image, and so that a Vocabulary looks like the AAC boards people actually use.

Domain language: `CONTEXT.md` (**Symbol**, **Button**, **Snippet**, **Snippet Inclusion**, **Change Set**, **Palette Color**). Why bytes bypass Change Sets: ADR 0008. Change Set durability model: ADR 0001 and ADR 0003. Communicator snapshot shape: ADR 0005 and ADR 0007.

## Problem Statement

A Button today can carry only a label and a color. That makes a Vocabulary usable by a Communicator who reads, and close to useless for one who does not — which is a large share of the people AAC exists for. Symbol-based communication is the norm in this field: a Communicator navigates a grid by recognising pictures and remembering where they sit, not by reading words. A Manager building a Vocabulary in this product currently cannot express "this Button means *drink*" in any way a pre-literate Communicator can act on. They also cannot bring in the images they already have — a photo of a family member, a picture of the actual cup used at home — which is exactly what makes a personal Vocabulary work.

## Solution

A Button gains an optional **Symbol**: an image shown on the Button, beneath its label.

A Manager attaches one by dragging an image file onto a Button, pasting an image onto a selected Button, or using a Symbol section in the Button inspector that opens a file picker. Dragging onto an empty cell creates a Button carrying that Symbol. Clearing is a **None** control, mirroring the color picker.

A Symbol is identified by a digest of its bytes, not by a record anyone owns. The same image used in two Vocabularies is the same Symbol, stored once. Copying a Board or duplicating a Vocabulary copies references, never bytes. Bytes are uploaded immediately and directly, outside the Change Set model; the Change Set carries only the Button's reference to them. Because the bytes are immutable, "change this Button's picture" is an ordinary Button update and needs no new machinery in Change Sets, in Suggested Change Set review, or in the Projected Vocabulary.

On a Button, the label keeps a reserved strip at the top — present even when the label is blank — and the Symbol fills the rest, scaled to fit entirely without cropping, with the Button's background color showing behind it. A Symbol with transparency therefore takes the color of its Button, so a transparent line drawing on a Palette Color still carries its grammatical meaning.

## User Stories

1. As a Manager, I want to put an image on a Button, so that a Communicator who cannot read can recognise what the Button means.
2. As a Manager, I want to drag an image file from my file manager onto a Button, so that I can add a Symbol without hunting through menus.
3. As a Manager, I want to drag an image file onto an empty cell, so that a Button is created carrying that Symbol and I can build a picture board quickly.
4. As a Manager, I want a Button created by dropping an image to start with a blank label, so that I can type the word afterwards or leave it wordless.
5. As a Manager, I want to copy an image in my web browser and paste it onto a selected Button, so that I can use pictures I found online without saving files to disk first.
6. As a Manager, I want a Symbol section in the Button inspector for the selected Button, so that I can add or change a Symbol on any existing Button without dragging.
7. As a Manager, I want the inspector's Symbol section to open a file picker, so that I can browse for an image when dragging is awkward.
8. As a Manager, I want to replace a Button's Symbol by attaching a different image, so that I can correct a bad picture without deleting the Button.
9. As a Manager, I want a **None** control to clear a Button's Symbol, so that removal works the way clearing a background color already does.
10. As a Manager, I want a Button to keep its label when I add a Symbol, so that the word and the picture reinforce each other.
11. As a Manager, I want to leave a Button's label blank while it has a Symbol, so that I can build a wordless board.
12. As a Manager, I want to give a Button a label with no Symbol, so that existing text-only Vocabularies keep working exactly as before.
13. As a Manager, I want the Symbol drawn below the label, so that the layout matches how I decided this Vocabulary should read.
14. As a Manager, I want the label's space reserved even when the label is blank, so that Symbols line up across a row and a Communicator can navigate by position.
15. As a Manager, I want adding a word to a wordless Button not to move its Symbol, so that motor-planning learned on that grid is not disturbed.
16. As a Manager, I want a Symbol scaled to fit inside the Button without cropping, so that a picture is never silently cut in half and changed in meaning.
17. As a Manager, I want the Button's background color to show behind a Symbol, so that a transparent line drawing still carries its Palette Color's grammatical meaning.
18. As a Manager, I want a Symbol to work with a Palette Color binding, a custom hex, and an unset background alike, so that Symbols and color are independent choices.
19. As a Manager, I want to put Symbols on Buttons that live on a Snippet, so that a shared strip can be pictorial like any other part of the Vocabulary.
20. As a Manager, I want Symbols on a Snippet's Buttons to appear in every Snippet Inclusion of it, so that editing the Snippet once updates every host.
21. As a Manager, I want a host Button with a Symbol to still cover inclusion content beneath it, so that the existing layering rules are unchanged.
22. As a Manager, I want Symbols rendered inside the de-emphasized inclusion layers on my canvas, so that I can see what a host Board will actually look like.
23. As a Manager, I want attaching a Symbol to become part of my pending changes, so that it is submitted as a Change Set like every other edit.
24. As a Manager, I want the unsaved-changes indicator to notice a Symbol change, so that I do not lose the work by navigating away.
25. As a Manager, I want to submit a Symbol change as a Suggested Change Set, so that another Manager can review it before it goes live.
26. As a Manager reviewing a Suggested Change Set, I want to see that it sets or removes a Symbol on a named Button, so that I know what I am approving.
27. As a Manager reviewing a Suggested Change Set, I want the preview of the affected Board to render the proposed Symbol, so that I can judge the picture rather than a description of it.
28. As a Manager, I want a Suggested Change Set's Symbol to render before the Change Set is applied, so that review does not depend on the change going live first.
29. As a Manager, I want to discard my pending changes and see Symbols revert, so that discard behaves consistently across every kind of edit.
30. As a Manager, I want a large photo to be shrunk automatically before upload, so that I can use a picture straight from my phone without it failing.
31. As a Manager, I want a small image to be uploaded untouched, so that a standard symbol set stays pixel-identical and is stored only once.
32. As a Manager, I want a clear message when an image is rejected, so that I know to try a different file rather than wondering what broke.
33. As a Manager, I want a rejected upload to leave the Button unchanged, so that a failure never half-applies.
34. As a Manager, I want uploading the same image twice to be harmless, so that I do not worry about creating duplicates.
35. As a Manager, I want a Symbol I used in one Vocabulary to be usable in another, so that moving between Vocabularies does not mean re-uploading everything.
36. As a Manager, I want images with transparency to keep their transparency, so that story 17 actually holds.
37. As a Communicator, I want to see Symbols on the Buttons of a Board, so that I can find the word I want without reading.
38. As a Communicator, I want a Button's Symbol and label to appear together, so that a communication partner can read what I am selecting.
39. As a Communicator, I want Symbols on Buttons that came from a Snippet Inclusion, so that shared strips look the same as the rest of the Board.
40. As a Communicator, I want a Board's Symbols to appear all at once rather than popping in one by one, so that the grid I navigate by shape does not rearrange itself under me.
41. As a Communicator, I want a Symbol I have already seen to load instantly when I return to that Board, so that moving between Boards mid-sentence is not slow.
42. As a Communicator, I want tapping a Button with a Symbol to perform its Action exactly as before, so that pictures change how the Board looks and nothing else.
43. As a Communicator, I want Boards with no Symbols to look and behave exactly as they do today, so that nothing regresses for text Vocabularies.
44. As a Manager, I want a Symbol to survive deleting and recreating Buttons elsewhere, so that reorganising a Board never destroys images.
45. As a Manager, I want deleting a Vocabulary not to break Symbols used by another Vocabulary, so that cleanup is never destructive beyond its own scope.
46. As a Manager, I want a Vocabulary created blank to keep working with no Symbols anywhere, so that the Initial Snapshot model is unaffected.

## Implementation Decisions

**Domain and storage split.** A Symbol is a reference carried on a Button, not an entity. There is no Symbol table, no per-Vocabulary image library, no binding lifecycle, and no deletion-resolution rule of the kind Palette Color needs. Palette Color needs binding because editing one propagates to every bound Button; a Symbol is never edited in place, only replaced, so the propagation motive is absent. Recorded as ADR 0008.

**Schema.** The buttons table gains one nullable text column holding the digest, constrained to a 64-character lowercase hex string. Null means the Button has no Symbol. The Initial Snapshot's stored button shape gains the same optional field, so a Vocabulary created from a snapshot round-trips Symbols without a separate mechanism.

**Change Set mutations.** `create_button` and `update_button` gain an optional digest field, handled by the same mutation-applying database function that already handles label, background color, palette binding, and action. No new mutation operation is added: there is no `create_symbol` or `delete_symbol`. The button diff key used to detect pending changes must include the digest, or Symbol edits will silently fail to diff into a Change Set.

**Upload endpoint.** A new API route accepts raw image bytes, validates them, computes the digest, writes the object into a public Supabase Storage bucket keyed by that digest, and returns the digest. It is available to any authenticated User and takes no Vocabulary identifier, because bytes are not Vocabulary data — the Management check that matters happens later, when a Change Set referencing the digest is submitted. Uploading bytes that already exist returns the same digest without rewriting the object, so the endpoint is idempotent by construction.

**Server-side validation.** Content type is determined by sniffing magic bytes, not by trusting the declared type. PNG, JPEG, WebP and GIF are accepted. SVG is rejected outright: served from a public bucket as its own content type, an SVG is a document that can execute script on a top-level navigation, and sanitising it properly is a separate project. Anything else is rejected. A hard size cap of 2 MB applies, giving headroom above the client's 1 MB target so that near-limit files pass through rather than bouncing. Client-side limits are advisory only — the endpoint is directly reachable.

**No server-side re-encoding, ever.** The digest must be a pure function of the bytes stored. If the server re-encoded, the digest would depend on the encoder version, so upgrading an image library would change the digest of an identical source file, break deduplication, and orphan blobs. The server digests exactly what it receives and enforces limits by rejecting, never by shrinking.

**Client-side upload policy.** A pure decision function, given a candidate image's byte length, pixel dimensions, whether it has an alpha channel, and its sniffed type, returns one of exactly three outcomes: pass the bytes through untouched; re-encode to a named format at a named maximum edge length; or reject with a reason. The rules are: pass through when the file is at most 1 MB and its longest edge is at most 1024 pixels; otherwise re-encode, to PNG when the image has an alpha channel and to JPEG when it does not, capping the longest edge at 1024 pixels and stepping JPEG quality down from roughly 0.85 until the result is under 1 MB; reject SVG, unknown types, and undecodable files. The canvas work stays a thin wrapper around this function.

Pass-through-when-small is load-bearing rather than an optimisation. Browser canvas encoders differ between engines, so anything re-encoded produces browser-dependent bytes that will not deduplicate across users. Passing small files through untouched means standard symbol sets and shared board icons deduplicate perfectly, and only large photographs — which are unique anyway — get browser-variable bytes.

**Format choice.** Alpha-bearing images re-encode to PNG and others to JPEG. WebP is deliberately not an output format: the AAC app renders through React Native's built-in image component, where WebP support on iOS is not dependable. Preserving alpha is required for the background-color-behind-Symbol rendering decision.

**Access model.** The digest is the read capability. The bucket is public-read and service-role-write, so clients cannot write objects directly and validation cannot be bypassed. There is no per-Vocabulary authorization on bytes: anyone holding a digest can fetch the image, in the manner of an unlisted video. Because the digest derives from the bytes, someone who already holds an identical file can confirm it exists in the store; this is a confirmation oracle, not a content leak. Objects are immutable, so they are served with long-lived cache headers.

**No garbage collection.** Bytes are never deleted. A digest may still be referenced by a live Button, by a Suggested Change Set, by an Initial Snapshot, or by any Applied Change Set in a Vocabulary's permanent history — and blobs are shared across Vocabularies, making "unreferenced" a global question with a race window. Deleting bytes a historical Change Set still points at is the one unrecoverable failure in this design, so it is not attempted.

**Communicator read path.** The live snapshot's button shape gains the digest, returned by the existing live endpoint. No new row-level security policy is needed: the digest is a column on a table Communicators can already read, and the bytes are fetched from the public bucket without an authorization step. The AAC app prefetches every distinct digest on a Board when the snapshot loads and caches by digest indefinitely, which is correct with no invalidation logic because the bytes behind a digest can never change.

**Manager editor.** The Button inspector gains a Symbol section alongside label and color, offering set, replace, and clear-as-**None**. Buttons and empty cells accept image file drops; a drop on an empty cell creates a Button the way a left-click already does. Paste attaches to the currently selected Button. The change-description module gains phrasing for setting and removing a Symbol on a named Button, and the Suggested Change Set preview renders the proposed image.

**Rendering.** Both the manager canvas and the AAC grid draw a reserved label strip at the top of the Button and fit the Symbol into the remaining area without cropping, with the Button's resolved background color painted behind it. Snippet Inclusion flattening is untouched — the digest travels on the Button, so included Buttons render their Symbols by the existing rules, including in the manager's de-emphasized inclusion layers.

## Testing Decisions

A good test here asserts externally observable behavior: what an endpoint returns, what mutations a diff produces, what a session exposes to the renderer. It does not assert how a digest is computed, how many times a helper is called, or the internal shape of editor state. Tests should read as statements about the product — "uploading the same bytes twice yields the same digest", "a Symbol change diffs into an update_button mutation" — not about the implementation.

Seven existing seams are reused and one new seam is added. No component-rendering test infrastructure is introduced: both vitest configurations run in a node environment, the manager's config collects only TypeScript test files, and no DOM testing library is present. Rendering, drag-and-drop wiring, and paste handling are covered by manual verification, consistent with how every prior feature in this repo has been tested.

**API HTTP integration** — the highest seam available, and where upload behavior belongs rather than in unit tests of digesting or validation. Covers: a valid image uploads and returns a digest; the same bytes uploaded twice return the same digest and create no duplicate; each accepted format is accepted; SVG is rejected; a file over the cap is rejected; a file whose declared type disagrees with its magic bytes is judged by the bytes; an unauthenticated request is refused; a Change Set carrying a digest applies and the digest appears on the Button; the live endpoint returns the digest for a Communicator. Prior art: the change-set, palette-delete-freeze, and communicator-live-read integration tests, which drive the real app against a real Supabase instance with file parallelism disabled.

**Change Set mutation diffing** — setting a Symbol on a new Button produces a create mutation carrying the digest; changing one on an existing Button produces an update mutation; clearing produces an update carrying null; changing only the Symbol still produces a mutation, which is the regression guarding against the digest being omitted from the diff key. Prior art: the existing Action and palette diffing tests.

**Change description** — a set and a removal each produce readable text naming the Button. Prior art: the existing description tests.

**Projected Vocabulary** — applying a mutation that sets or clears a Symbol yields a projection whose Button carries the expected digest, so Suggested Change Set previews show the right image. Prior art: the existing projection tests.

**Editor session** — a Symbol edit appears in pending mutations, marks the session dirty, survives a rebase onto new live server state, and is reverted by discard. Prior art: the existing editor session tests.

**Communicator session** — a visible cell exposes its Button's digest, including when the Button arrives through a Snippet Inclusion and including through nested inclusions, and a Board with no Symbols yields cells with no digest. Prior art: the existing communicator session tests.

**Suggested-change grouping** — regression only; existing behavior stays green.

**Upload policy (new seam)** — the only new seam, justified because canvas is unavailable in a node environment, so the plumbing is untestable while the policy is both testable and correctness-critical. Covers: a small in-bounds file passes through untouched, which is the test that protects deduplication; an oversized file re-encodes; an over-wide file re-encodes; an alpha-bearing image re-encodes to PNG; a non-alpha image re-encodes to JPEG; SVG and unknown types reject. Written as a pure unit test in the style of the existing cell-reference and cycle-detection tests.

## Out of Scope

- A built-in symbol library (ARASAAC, OpenSymbols, Mulberry) with search and attribution. This is the highest-value follow-on and the reference model deliberately does not block it — chosen symbols would upload through the same path.
- Dragging an image out of a browser tab. That yields a URL rather than bytes and would require the API to fetch arbitrary user-supplied URLs, with the SSRF hardening that implies. Clipboard paste covers the same need without a server-side fetcher.
- Storing external image URLs on a Button.
- SVG support of any kind.
- Garbage collection or reference counting of stored bytes.
- Per-Vocabulary access control on stored bytes; the digest remains the capability.
- Any image editing — cropping, rotation, background removal, recolouring.
- Per-Button layout options such as image-only mode, image above label, or background-fill.
- Vocabulary icons and Board or Snippet background images. Buttons are the only thing that can carry a Symbol.
- Alt text or any Symbol metadata; the label is the Button's accessible name and there is no library needing filenames.
- Offline availability of Symbols beyond the in-session cache. The AAC app has no offline mode today and this does not add one.
- Component-level rendering tests and the DOM test infrastructure they would require.
- Guaranteed animated GIF playback. GIF is an accepted upload format; whether frames animate is left to each platform's image component.

## Further Notes

**Licensing.** Clipboard paste makes it trivial to put third-party copyrighted images into a Vocabulary, and images pasted from web search results are usually copyrighted. That is acceptable for a hackathon and is not acceptable in a product used by schools. It is the strongest practical argument for the symbol-library follow-on, where licensing is settled at the source.

**Deduplication is best-effort by design.** Two Managers re-encoding the same large photograph in different browsers will produce different bytes and therefore two stored objects. This is accepted: the deduplication that matters is of small, unmodified symbol files, which pass through untouched and dedupe exactly.

**Privacy posture is a deliberate choice.** AAC boards carry personal photographs — family members, homes, schools. The capability model means a removed Manager retains working image URLs for any digest they noted. This was weighed against per-Vocabulary authorization and chosen for the same reasons an unlisted video is chosen over a private one: it keeps copying and sharing Boards frictionless, which is the workflow this product expects.

**The reserved label strip is an accessibility decision, not a cosmetic one.** AAC users navigate a grid by shape and position, and motor planning depends on a Symbol landing in the same place every time. Collapsing the strip for wordless Buttons would give slightly larger pictures at the cost of ragged alignment across a row, and would shift a Symbol whenever a Manager later added a word.
