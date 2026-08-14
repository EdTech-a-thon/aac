# Reusable embedded board regions in AAC products

**Question:** Do any AAC apps let you design a reusable rectangular region of buttons (a mini-board) once and embed it into multiple boards/pages so those boards share a live common area (e.g. a common top row of actions, a common right column)?

**Not in scope:** navigating to another page; persistent app chrome (message window, speak/clear bar); static copy/paste of buttons.

**Date:** 2026-08-13

**Conclusion:** No major AAC product documents a live, reusable *embedded grid fragment* that occupies a rectangle on otherwise independent boards. The closest matches are Proloquo2Go **live templates** (full-page layout with holes, not a region) and GoTalk NOW **Synced Buttons** (live *buttons*, not a region). “Snippet” does not collide with existing AAC product terminology. Reusing “template” would.

---

## 1. Closest features (still not the thing)

These are live/shared content, not a one-shot copy. None is “drop this 1×N or N×1 grid into many boards.”

### Proloquo2Go — **templates** / **live templates** / **template buttons** / **placeholder buttons**

Closest overall.

AssistiveWare describes templates as “a set of buttons in a fixed layout that can be used on multiple pages.” They are **live**: changing a template updates every folder that uses it. Template buttons are locked in regular Edit Mode; you edit them in Settings → Vocabulary → Edit Templates. Placeholder buttons reserve cells that each folder fills in locally (e.g. “verb 1”).

This is a **full-page layout with holes**, not a rectangular region embedded into an independently designed board. The folder *is* the template plus local fringe, not “this board plus a nested snippet in the top row.”

- Vendor support: [Edit a template](https://www.assistiveware.com/support/proloquo2go/vocabulary-grammar/edit-template)
- Vendor support: [Make a folder use a different or no template](https://www.assistiveware.com/support/proloquo2go/organize/folders/template)
- Vendor blog (uses the phrase “live templates”): [Templates](https://www.assistiveware.com/blog/templates)
- Manual (P2G 4): [Proloquo2Go 4 Manual](https://orin.com/access/docs/Proloquo2Go-4-Manual.pdf)

### GoTalk NOW — **Synced Buttons** (Synced Button Library)

Closest at *button* granularity.

Official user’s guide (v6, §12.1): a synced button “can be reused multiple times throughout a book. If you make a change to a synced button, those changes will appear on all instances of the button.” Instances show a round icon. You cannot promote an existing page button into the library; you create new library buttons.

This is a live **shared button**, not a reusable rectangular *region*. Placement of each instance is still per-page.

- Official PDF: [GoTalk NOW User’s Guide](https://www.attainmentcompany.com/mwdownloads/download/link/id/1681)

### GoTalk NOW — **Quick Buttons**

A small persistent set of message locations “available from all pages of a Communication Book” (up to four; experimental setting for eight). They are opened from a Quick Buttons control in the Player, not laid out as a row/column *inside* each page grid. That is closer to chrome/overlay than to an embedded board fragment.

Same user’s guide, §3.5 and experimental setting “Enable Eight Quick Buttons.”

---

## 2. Adjacent but different

Grouped by how they differ from a live embedded region.

### A. Live *full-page* or *chrome* consistency (not an embeddable fragment)

| Product | Their term | How it differs |
| --- | --- | --- |
| **Proloquo** (new AssistiveWare app, not Proloquo2Go) | **static top two rows** / **two rows of static core** | Built-in vocabulary chrome: those rows “remain accessible at any time.” Not a user-designed region you embed into arbitrary boards. [Organization](https://www.assistiveware.com/blog/how-is-the-vocabulary-in-proloquo-organized), [efficiency](https://www.assistiveware.com/blog/how-is-proloquo-efficient), [growth design](https://www.assistiveware.com/blog/proloquo-4-grows-with-users) |
| **TD Snap / Snap Core First** | **Toolbar** | “Remains present on every page” (except Whiteboard). App chrome for Core / Topics / QuickFires / etc., not board-content cells. [Aphasia training cards](https://downloads.tobiidynavox.com/Software/TD_Snap/TD_Snap_Aphasia/TD_Snap_Aphasia_Training_Cards_NA.pdf); [user’s manual](https://download.mytobiidynavox.com/Snap/documents/TobiiDynavox_SnapCoreFirst_UsersManual_v1-12_en-US_WEB.pdf) |
| **Avaz** | **Side Navigation Bar** | Persistent picture-mode chrome (Home, Back, Core Words, Search, …). Customizable which chrome buttons show, not a nested grid of vocabulary cells. [Customize side Navigation bar](https://avazapp.freshdesk.com/support/solutions/articles/11000116470-how-to-change-customize-the-side-navigation-bar-buttons-) |
| **Unity** (PRC) | **Activity Row** | Top row that *changes* with the last core key (fringe/nouns). Language-system behavior, not a user-authored reusable component. LAMP Words for Life **removed** the activity row to keep motor plans unique. [Unity quick reference](https://www.liberator.co.uk/product-support/downloads/unity_vocabulary_quick_reference_guides/unity_vocabulary_quick_reference_guide.pdf); [Unity vs WFL](https://www.liberator.co.uk/media/wysiwyg/Documents/Differences_Between_Unity_and_WFL.pdf) |

### B. Static page templates (copy at create time; later edits do not propagate)

This is the dominant AAC meaning of **template**.

| Product | Their term | Notes |
| --- | --- | --- |
| **TouchChat** | **Template** page type; **New Page from Template** | “The new page will be displayed with the buttons and formatting from the template”; then you edit that page. [Create a New Page from a Template](https://touchchatapp.com/support/Create-a-New-Page-from-a-Template); [Set a Page as a Template](https://touchchatapp.com/support/set-a-page-as-a-template) |
| **Grid 3** | **Copy Grid** (use existing grid as a template) | “Your new grid will be an exact copy… Any changes you make will only effect this copy, not the original.” [Jump cells](https://hub.thinksmartbox.com/knowledgebase/how-do-i-make-a-cell-that-jumps-to-another-grid-in-grid-3/) |
| **Mind Express** | **Templates**; **Use template for new pages** | Saving as a template stores the current page as a starting point. “Use template for new pages” copies that template onto each new page. Not live. [Mind Express 4 manual](https://www.jabblasoft.com/files/manuals/mindexpress4_en_A4.pdf) |
| **Boardmaker 7** | **Templates**; **New Page from Template** | “When you create a new activity or page based on a template, the template page(s) are copied into your new activity/page and then you can adjust the content.” [Editor user’s manual](https://download.mytobiidynavox.com/Boardmaker/documents/Boardmaker%207/Boardmaker7_Editor_UsersManual_v1.0.1_en-US_WEBHQ.pdf) |
| **GoTalk NOW** | **Page Templates** / Template Gallery | A template holds up to 10 pages; applying it *adds* pre-made pages to a book. Static. Same [user’s guide](https://www.attainmentcompany.com/mwdownloads/download/link/id/1681) §7 |
| **Communicator 5** | **templates** / **pagesets** | Marketing: “New templates for symbol users… great starting points that can easily be customized.” Copy-on-create, not live regions. [2016 product overview PDF](https://cdn.ymaws.com/www.summitproservices.com/resource/resmgr/2016_osha_conference/PDF_Handouts/Snap_Scene,_Compass_and_Comm.pdf) |
| **Grid 3 PODD** | **templates** (blank grid pages) | Pre-made page shells you copy, then fill. [PODD for Grid styles and templates](https://hub.thinksmartbox.com/knowledgebase/styles-and-templates/) |

### C. Static copy of *cells* onto many pages (not live)

| Product | Their term | Notes |
| --- | --- | --- |
| **Mind Express** | **Copy to pages** | Explicitly for “a cell that allows you to return” or “cells with categories.” Copies onto all pages or a chosen subset. Later edits to one copy do not update the others. Mind Express 4 manual §4.21 |
| **Grid 3** | **Copy / Paste** cells | Per-cell clipboard. [Copy and paste cells](https://hub.thinksmartbox.com/knowledgebase/how-do-i-copy-and-paste-cells-in-grid-3/) |
| **CoughDrop** | **button stash**; **make a copy** | Stash is copy/paste of buttons. “Make a copy” duplicates a board or linked board *set* into a new owned instance. Linked boards are navigation, not embeds. [Personalize / copy](https://coughdrop.zendesk.com/hc/en-us/articles/201366739-How-do-I-personalize-an-existing-board-in-CoughDrop); [Link boards](https://coughdrop.zendesk.com/hc/en-us/articles/201379529-How-do-I-link-from-one-board-to-another-in-CoughDrop); [Button stash listed in editing index](https://coughdrop.zendesk.com/hc/en-us/sections/200398515-Editing-Speech-Boards-Buttons) |

CoughDrop does **not** document a product feature named “clone.” Official term is **make a copy**. “Linked boards” means boards reachable by Open/Link actions (and optionally shared together), not a nested region.

### D. Navigation that looks like a small board (popup / jump), not an embed

| Product | Their term | Notes |
| --- | --- | --- |
| **Boardmaker 6** | **PopUp Board**; **Go To PopUp Board** | Buttons are cut from the topic board into a separate board that appears over it. Navigation overlay, not shared content on many pages. [Create a popup board](https://www.tobiidynavox.com/blogs/support-articles/how-do-i-create-a-popup-board-in-boardmaker-version-6) |
| **Boardmaker Studio** | **Pages & Popups**; **group button** / **group box** | Popups are still navigation. Group buttons/boxes are containers *on one page* (scanning groups, drag-and-drop targets), not reusable across pages. [Studio user guide](http://tdvox.web-downloads.s3.amazonaws.com/Boardmaker/documents/TobiiDynavox_BoardmakerStudio_UserGuide_en-US.pdf) |
| **Grid 3** | **Jump** / **Jump to**; **self-closing** grids | Opens another grid (optionally returning after a selection). [Jump cells](https://hub.thinksmartbox.com/knowledgebase/how-do-i-make-a-cell-that-jumps-to-another-grid-in-grid-3/) |
| **TD Snap** | **Link to page** / **Link to a copy of a page** | Page navigation or copy-then-link. Listed in [TD Snap Text resource library](https://tobiidynavox.talentlms.com/catalog/info/id:1435) |
| **CoughDrop** | **Open/Link to another board** | Navigation to a full board. |

### E. A region of cells on *one* grid, filled from a list (not shared across boards)

**Grid 3 Word list** (and other **auto-content cells**): you select a rectangle of cells on *this* grid; they populate from that grid’s word list. “Each grid has its own word list.” Commands on auto-content cells are shared *within that grid*, not across grids as a reusable component.

- [Create a word list](https://hub.thinksmartbox.com/knowledgebase/how-do-i-create-a-new-word-list-in-grid-3/)
- [Chat and writing commands](https://hub.thinksmartbox.com/knowledgebase/grid-command-library-chat-and-writing/)
- [Special cell types / auto-content](https://hub.thinksmartbox.com/knowledgebase/grid-command-library-special-cell-types/)

### F. Live *appearance* only (not content/layout)

**Grid 3 Styles**: Update Style “every cell in your grid set with that style, will automatically update.” Explicitly “only the look and feel of the cell, it does not change the commands.” [Using styles](https://hub.thinksmartbox.com/knowledgebase/using-styles-to-change-cell-appearance-and-speed-up-editing-in-grid-3/)

### G. Products that are not a match

| Product | Why |
| --- | --- |
| **LAMP Words for Life** | Fixed overlay + hide/show (**Vocabulary Builder**). No nested pages, no reusable region. [Product page](https://prc-saltillo.com/apps/lamp-wfl) |
| **Speak for Yourself** | One main screen; most buttons link one level deep then return. Hide/show vocabulary. No page templates, no embedded regions. [FAQ](https://speakforyourself.org/faqs/); [vendor comparison](https://speakforyourself.org/the-difference-between-speak-for-yourself-and/) |
| **Predictable** | Text AAC; **Grid Layout** is a phrase-bank view, not multi-board embedding. [Grid layout settings](https://www.therapybox.co.uk/predictable-features/grid-layout-settings) |
| **GoTalk NOW Hybrid Scene** | A *per-scene* row of up to four message locations on one side of a visual scene. Not shared across pages. User’s guide §4.1 |
| **Boardmaker “Device Overlays”** | Templates for *physical* communication-device overlays, not software nested boards. Boardmaker 7 editor manual, Templates chapter |

---

## 3. Academic / clinical language

Literature and clinical materials talk about the *goal* (keep core and navigation in the same place) far more than about a software primitive that implements it.

- **Consistent location / motor planning:** keep core words in the same place across pages so users do not relearn locations. Clinical advice, not a product feature name. [AbleNet: why core is on the home page](https://support.ablenetinc.com/aac-education-and-resources/why-core-vocabulary-is-on-the-aac-home-page/); [PrAACtical AAC on core and location](https://praacticalaac.org/strategy/more-on-core-words/)
- **Core vs fringe:** organizational principle (home page vs topic folders). Does not imply a shared embedded region.
- **PODD operational cells / operational commands:** GO BACK, TURN THE PAGE, GO TO CATEGORIES, OOOPS, etc., placed in a consistent column (often the right side). In software PODD page sets these are **duplicated per page** (copy), not a live nested board. [PODD design PDF](https://www.jabblasoft.com/files/podd/Printable_book_Pragmatic_Organisation_Dynamic_Display_Communication_books.pdf); Mind Express PODD construction notes describe copy/duplicate of operational cells.
- **Activity-specific displays / activity pages:** separate pages for an activity, not a shared strip on many pages.
- **Unity Activity Row:** see §2.A — dynamic fringe strip, opposite of a stable shared snippet.

No high-trust source was found that names a software construct “shared core vocabulary layout,” “template region,” “inset board,” or “nested board” as a reusable embed.

---

## 4. Recommended term

**Reuse existing AAC terminology?** Only with care.

| Candidate | Verdict |
| --- | --- |
| **template** | Do **not** use alone. In TouchChat, Grid 3, Boardmaker, Mind Express, GoTalk NOW, Communicator 5 it means *static copy of a page at creation*. Only Proloquo2Go’s **live templates** are live, and those are full-page. |
| **live template** | Accurate for P2G; would mislead if our object is a *region* rather than a whole-page layout with placeholders. |
| **overlay / popup board** | Means a board that *appears over* another (Boardmaker PopUp). Navigation, not embed. |
| **linked board / jump** | Navigation. CoughDrop “linked boards” are a graph of full boards. |
| **widget / gadget** | Boardmaker Studio **gadgets** are pre-programmed objects dropped onto a page (copy). Not established AAC vocabulary for this. |
| **activity row** | Unity-specific, and it *changes* with context. |
| **toolbar / navigation bar / Quick Buttons** | Chrome. Users will expect app chrome, not board content. |
| **synced button** | Fine for button-level identity; too small for a region. |
| **snippet** | **No collision** with vendor AAC terms in this search. Clear for “a reusable fragment of board content.” Not a clinical term either, so it will not be confused with core/fringe/PODD operational cells. |

**Recommendation:** keep **snippet** (or another invented noun such as **shared region**) rather than overloading **template**. If you want a nod to the closest product, document internally that Proloquo2Go live templates are the nearest cousin, and that the product difference is: they stamp a whole page; we embed a rectangle.

---

## 5. Source list (primary, grouped)

### AssistiveWare
- https://www.assistiveware.com/support/proloquo2go/vocabulary-grammar/edit-template
- https://www.assistiveware.com/support/proloquo2go/organize/folders/template
- https://www.assistiveware.com/blog/templates
- https://orin.com/access/docs/Proloquo2Go-4-Manual.pdf
- https://www.assistiveware.com/blog/how-is-the-vocabulary-in-proloquo-organized
- https://www.assistiveware.com/blog/how-is-proloquo-efficient
- https://www.assistiveware.com/blog/proloquo-4-grows-with-users

### Smartbox / Grid 3
- https://hub.thinksmartbox.com/knowledgebase/how-do-i-create-a-new-word-list-in-grid-3/
- https://hub.thinksmartbox.com/knowledgebase/grid-command-library-chat-and-writing/
- https://hub.thinksmartbox.com/knowledgebase/grid-command-library-special-cell-types/
- https://hub.thinksmartbox.com/knowledgebase/how-do-i-make-a-cell-that-jumps-to-another-grid-in-grid-3/
- https://hub.thinksmartbox.com/knowledgebase/how-do-i-copy-and-paste-cells-in-grid-3/
- https://hub.thinksmartbox.com/knowledgebase/using-styles-to-change-cell-appearance-and-speed-up-editing-in-grid-3/
- https://hub.thinksmartbox.com/knowledgebase/styles-and-templates/

### Tobii Dynavox
- https://download.mytobiidynavox.com/Snap/documents/TobiiDynavox_SnapCoreFirst_UsersManual_v1-12_en-US_WEB.pdf
- https://downloads.tobiidynavox.com/Software/TD_Snap/TD_Snap_Aphasia/TD_Snap_Aphasia_Training_Cards_NA.pdf
- https://www.tobiidynavox.com/blogs/support-articles/how-do-i-create-a-popup-board-in-boardmaker-version-6
- https://download.mytobiidynavox.com/Boardmaker/documents/Boardmaker%207/Boardmaker7_Editor_UsersManual_v1.0.1_en-US_WEBHQ.pdf
- http://tdvox.web-downloads.s3.amazonaws.com/Boardmaker/documents/TobiiDynavox_BoardmakerStudio_UserGuide_en-US.pdf

### Attainment / GoTalk NOW
- https://www.attainmentcompany.com/mwdownloads/download/link/id/1681

### CoughDrop
- https://coughdrop.zendesk.com/hc/en-us/articles/201379529-How-do-I-link-from-one-board-to-another-in-CoughDrop
- https://coughdrop.zendesk.com/hc/en-us/articles/201366739-How-do-I-personalize-an-existing-board-in-CoughDrop
- https://coughdrop.zendesk.com/hc/en-us/sections/200398515-Editing-Speech-Boards-Buttons

### PRC-Saltillo / TouchChat / LAMP / Unity
- https://touchchatapp.com/support/Create-a-New-Page-from-a-Template
- https://touchchatapp.com/support/set-a-page-as-a-template
- https://prc-saltillo.com/apps/lamp-wfl
- https://www.liberator.co.uk/product-support/downloads/unity_vocabulary_quick_reference_guides/unity_vocabulary_quick_reference_guide.pdf
- https://www.liberator.co.uk/media/wysiwyg/Documents/Differences_Between_Unity_and_WFL.pdf

### Jabbla / Mind Express / PODD
- https://www.jabblasoft.com/files/manuals/mindexpress4_en_A4.pdf
- https://www.jabblasoft.com/files/podd/Printable_book_Pragmatic_Organisation_Dynamic_Display_Communication_books.pdf

### Avaz / Predictable / Speak for Yourself
- https://avazapp.freshdesk.com/support/solutions/articles/11000116470-how-to-change-customize-the-side-navigation-bar-buttons-
- https://www.therapybox.co.uk/predictable-features/grid-layout-settings
- https://speakforyourself.org/faqs/

### Clinical
- https://support.ablenetinc.com/aac-education-and-resources/why-core-vocabulary-is-on-the-aac-home-page/
- https://praacticalaac.org/strategy/more-on-core-words/
