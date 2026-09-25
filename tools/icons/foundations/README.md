# Design foundations glyphs

Copied verbatim from the design foundations kit (`icons/svg`), so the editor
chrome draws the kit's pictures for every role the kit has a glyph for.
`tools/build-icons.mjs` reads the path data from these files and vendors it
into `src/core/icons.ts`; nothing here ships at runtime.

`plus` is a Lucide icon, and several of the other drawings began from Lucide
geometry; both are covered by `LICENSE-lucide.txt` (ISC). The kit states that
everything else is first-party to it.

To add one: copy the SVG in unchanged, map an editor name to it with `kit()`
in `tools/build-icons.mjs`, and re-run the generator.
