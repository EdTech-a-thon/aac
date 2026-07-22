# 05 — Delete in-use Palette Color with resolution

**What to build:** Deleting a Palette Color with no bound Buttons just deletes it. If Buttons are bound, a two-step modal asks for confirmation (with up to 9 Button previews and “+N more”) then how to resolve: reassign via the full color chooser (Palette / custom / None) or freeze each as custom hex of the deleted color’s last paint. If a Suggested Change Set deletes a Palette Color that was unused when suggested, Apply later freezes any newly bound Buttons to custom hex (no modal).

**Blocked by:** 03 — Edit Palette via Change Sets on vocabulary settings; 04 — Button color: None, Palette binding, or custom hex.

**Status:** resolved

## Notes

Unused Palette Color deletes immediately. In-use deletes open the two-step modal (reassign None/Palette/custom or freeze). Apply of `delete_palette_color` freezes any remaining bindings to custom hex so Suggested deletes are safe when Buttons bind later.


- [ ] Deleting an unused Palette Color removes it without a resolution modal
- [ ] Deleting an in-use Palette Color shows the agreed two-step modal (Button wording, not “tile”); resolution mutations are part of the same Change Set as the delete
- [ ] Screen 2 offers full reassign options (Palette Color, custom hex, or None) or freeze-as-custom-hex
- [ ] Suggested delete of an unused Palette Color, Applied later when Buttons are bound, freezes those Buttons to custom hex without prompting
