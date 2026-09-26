# Design foundations glyphs

Copied verbatim from the design foundations kit (`icons/svg`), so the editor
chrome draws the kit's pictures for every role the kit has a glyph for.
`tools/build-icons.mjs` reads the path data from these files and vendors it
into `src/core/icons.ts`; nothing here ships at runtime.

`plus` is a Lucide icon, and several of the other drawings began from Lucide
geometry; both are covered by `LICENSE-lucide.txt` (ISC). Everything else is
first-party (© Haoyang Li) and MIT licensed with this repository; see
`THIRD_PARTY_NOTICES.md` at the root.

To add one: copy the SVG in unchanged, map an editor name to it with `kit()`
in `tools/build-icons.mjs`, and re-run the generator.
