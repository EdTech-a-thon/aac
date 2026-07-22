# 04 — Button color: None, Palette binding, or custom hex

**What to build:** A Button’s background is unset (UI: None; renders white), a binding to a Palette Color, or a custom hex. New Buttons default to None. The color picker offers None, the Vocabulary’s Palette Colors (as bindings), custom hex, and a link to vocabulary settings. Editing a bound Palette Color’s hex updates all bound Buttons. Matching paint never auto-binds.

**Blocked by:** 02 — Initial Snapshot with Fitzgerald-default Palette on Vocabulary create; 03 — Edit Palette via Change Sets on vocabulary settings.

**Status:** resolved

## Notes

Button color is unset | `palette_color_id` binding | custom `background_color`. New Buttons default to unset (None). Picker offers None, Vocabulary Palette Colors, custom hex, and a link to settings. Bound Buttons resolve display hex from the live Palette.


- [ ] New Buttons have unset background (None); they render white
- [ ] Managers can set None, bind to a Palette Color, or set a custom hex; clearing back to None is supported (None shown as a circled/slashed swatch)
- [ ] Binding a Button to a Palette Color means later Palette hex edits change that Button’s displayed color
- [ ] Custom hex equal to a Palette Color’s hex does not create a binding unless the Manager picks that Palette Color
- [ ] Color picker includes a link to `/vocabularies/[id]/settings`
