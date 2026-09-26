#!/usr/bin/env node
/**
 * Regenerates `src/core/icons.ts` from three sources: the design foundations
 * kit's glyphs (`tools/icons/foundations/*.svg`), Lucide
 * (https://lucide.dev/icons, ISC) for the editor marks the kit has no picture
 * for, and the native lattice family authored below.
 *
 * The glyphs are VENDORED as path data rather than imported at runtime, for the
 * same reason they always were: the bundle is an IIFE with no imports, and the
 * editor must not add a dependency to the app it is editing. This script is how
 * that data is kept honest — the mapping below is the only place an editor name
 * is tied to a source drawing, so a glyph swap is a one-line edit and a re-run.
 *
 * THE KIT FIRST. Where the kit has a glyph for a role — close, check, search,
 * copy, comment, submit — the editor draws the kit's, so the chrome and every
 * product built on the kit share one picture per meaning (ADOPTION-GUIDE § 6,
 * "one meaning, one glyph"). The kit's SVGs are copied into the repo unchanged
 * and read here; see `kit()` and `readKitGlyph`. Lucide stays for the marks that
 * are this editor's own subject matter — flow, padding, constrain, wrap — and
 * for the half of a state PAIR whose partner the kit does not draw.
 *
 *   node tools/build-icons.mjs          # rewrite src/core/icons.ts
 *   node tools/build-icons.mjs --check  # fail if the file is out of date
 *
 * WHY A STROKE FAMILY, AND WHAT THAT CHANGED
 *
 * The previous set was Reicon: filled glyphs in two drawn weights, whose ink
 * extents ran 15.5..22.8 of the 24 grid and so had to be normalised per glyph by
 * widening each one's viewBox. That machinery is gone, and its absence is the
 * point rather than an omission.
 *
 * Lucide is a STROKE family. Three consequences follow, and each is a rule that
 * used to be the opposite here:
 *
 *   1. No re-windowing, ever. Widening a viewBox scales the drawing down inside
 *      an unchanged box — which fixes the size of a FILL and ruins a STROKE,
 *      because the stroke scales with it and arrives lighter. So every glyph
 *      ships Lucide's own `0 0 24 24` and nothing is fitted. What makes this
 *      family cohere is not one ink extent, it is one stroke weight; the
 *      extents are deliberately uneven (a chevron inks 12 of the grid, a layer
 *      stack 20) and that is Lucide's optical sizing, not drift.
 *
 *   2. One drawing, not two. Lucide ships no filled counterparts, and
 *      synthesising them by flooding each path with `currentColor` is legible
 *      only for a closed silhouette — it turns `Info` into a blank disc and
 *      `Eye` into a blot. So a control that is ON says so with a HEAVIER
 *      stroke, applied by the stylesheet (see `css/icons.ts`). That works for
 *      all of these glyphs rather than a curated third of them, and it keeps
 *      "on means heavier" a property of the design system rather than a thing
 *      each call site remembers.
 *
 *   3. Stroke weight is ONE number at every size — the kit's 2. It used to be
 *      compensated per size, and the kit's filled glyphs are why it no longer
 *      is. See `STROKE_FOR_SIZE`.
 */

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.dirname(fileURLToPath(new URL("../package.json", import.meta.url)))
const OUT = path.join(root, "src", "core", "icons.ts")
const KIT_DIR = path.join(root, "tools", "icons", "foundations")

/**
 * A MAP value that names a kit glyph rather than a Lucide one: the file
 * `tools/icons/foundations/<name>.svg`, named as the kit's `icons.json` names it.
 */
const kit = (name) => ({ kit: name })

/**
 * Editor name -> source drawing: a Lucide name, or `kit("…")`.
 *
 * The editor's own names are kept: they say what the mark MEANS here, which is
 * not always what Lucide calls it (`Square` is our generic element box,
 * `MessageSquare` is now drawn with Lucide's ROUND bubble). Keeping them also
 * means no call site churns when a glyph is swapped for a better one.
 *
 * Grouped by the feature each set serves, because that is the unit consistency
 * is judged in: the six align marks have to look like six of one thing, and so
 * do the four arrange arrows.
 */
const MAP = {
  /*
   * `Cursor` used to be Lucide's `MousePointer2` and is NATIVE now — see the
   * pointer below. The complaint that moved it is one a stroke family cannot
   * answer: the mode switch fills its mark when the editor holds the pointer,
   * and the filled weight read visibly ROUNDER than the hollow one. Both are
   * the same path; what differs is that `stroke-linejoin: round` rounds the
   * OUTSIDE of a stroke and nothing rounds the inside, so the hollow weight
   * showed a needle-sharp interior at a 34-degree tip while the solid weight
   * showed the join's 0.75px radius. Authoring the two boundaries separately is
   * the only fix, and that means authoring the glyph.
   */

  // Toolbar.
  /*
   * The two side panels, drawn as the SIDES they are rather than as their
   * contents.
   *
   * These replace `Layers` and `SlidersHorizontal` on the two panel toggles.
   * Naming the contents was the better guess while the marks had to teach what
   * each panel holds, but a toggle is pressed to change the LAYOUT of the
   * screen, and the thing a designer reaches for it wanting is the side that
   * will move. A stack of layers and a row of sliders are two unrelated
   * drawings sitting beside each other; a left panel and a right panel are one
   * drawing mirrored, which is what the pair actually is.
   *
   * Lucide's `Panel*` frames are the same subject the padding strip draws — see
   * `PadLeft` / `PadRight` below, which are NATIVE 12-unit versions authored for
   * an 88px field. These are the 18-unit Lucide originals, and the two sets
   * never appear in the same surface.
   */
  PanelLeft: "PanelLeft",
  PanelRight: "PanelRight",
  /*
   * `Layers` and `SlidersHorizontal` stood here, and are GONE rather than left
   * in the set unused — the same rule the retired `Sidebar*` pair was held to.
   * A glyph nothing draws is a glyph the next reader has to check the callers
   * of before touching, and `SlidersHorizontal` also carried a hand-authored
   * filled counterpart that would have had to be kept in agreement with an
   * outline nobody rendered.
   */
  /*
   * `RotateCcw` and `RotateCw` stood here and are GONE, not left unused. The
   * bar's two history arrows are `ToolUndo` and `ToolRedo` below, and a full
   * circular arrow was the wrong picture twice over: it reads a size larger
   * than everything beside it because a closed ring has no gap for the eye to
   * stop at, and its tail leaves the curve at a tangent no other mark in this
   * family can meet. Nothing else in the chrome drew either one.
   */
  // Collapse the whole editor to its corner disc. Four arrows drawn inward: it
  // says "this is going to get smaller and go somewhere", where a chevron would
  // say "a menu is about to open downward".
  Minimize: "Minimize",

  // Panels and rows.
  // The token picker's search FIELD, and only that now. It labelled DS Lint's
  // Audit button too, which was one mark doing two unrelated jobs — see
  // `ListChecks` below.
  Search: kit("search"),
  /*
   * Run the design-system audit — DS Lint's one starting control.
   *
   * It was `Search`, the same magnifier the token picker puts inside its search
   * field, and a magnifier means "find me the one I am thinking of". An audit
   * is the opposite errand: the user is not looking for anything, they are
   * asking to be TOLD what is wrong. One editor drawing the same mark for "type
   * here to filter" and "go and check the whole project" is a collision a
   * reader resolves by learning neither.
   *
   * `ListChecks` draws what the button produces: lines with a tick against
   * each. That is the panel underneath it, down to the checkboxes — the glyph
   * and the surface it opens are one picture.
   *
   * The alternatives were rendered at 12, 16 and 24 and each lost on something
   * specific. `ScanSearch`, `ScanEye` and `Radar` are illegible at the 12 rung
   * this button draws at — a magnifier inside a scan frame is three marks in
   * twelve pixels. `ShieldCheck` and `BadgeCheck` read as PASSED, and this
   * control is pressed before anything is known, which is the one promise this
   * panel refuses to make anywhere else. `ClipboardCheck` is the clipboard,
   * which the annotations tab has already spent on Copy.
   *
   * The kit's `list-checks` is the same subject drawn as a checklist inside a
   * frame, with the tick breaking out of its corner, and is the drawing now.
   */
  ListChecks: kit("list-checks"),
  Check: kit("check"),
  X: kit("x"),
  // The dense close: remove buttons on Design system cards. The kit's `x` inks
  // 18 of the grid and fills an 18px `.de-mini` even at the 12 rung; Lucide's
  // inks 12, so the same rung draws a 6px mark.
  XSmall: "X",
  // Lucide's disclosure chevrons, not the kit's. The kit draws its chevrons at
  // feature scale — `chevron-down` spans 20 of the grid — and at the `marker`
  // rung every section header, select and twisty carried a 10px caret beside
  // 12px text, which read as the loudest mark in the row. Lucide's span 12 of
  // the grid (a 6px caret at 12px): a status mark, sized like one.
  ChevronDown: "ChevronDown",
  ChevronRight: "ChevronRight",
  // Show more / show less, where the thing shown is a LIST that grows downward:
  // the per-side token rows, the full container-step ladder. A double chevron
  // says "there is more of this", which a single one — already spent on section
  // disclosure and on the tree twisty — cannot say without ambiguity.
  //
  // Lucide's, not the kit's: the kit's `chevrons-up-down` is a pair of opposed
  // ARROWS, which is a sort control, and it has no collapse partner.
  ChevronsUpDown: "ChevronsUpDown",
  ChevronsDownUp: "ChevronsDownUp",
  /*
   * Add and remove, as a pair. The kit's `plus` IS Lucide's (it ships it under
   * ISC), so `Plus` is the kit's drawing either way. `Minus` stays Lucide's
   * rather than taking the kit's filled `minus`, because they sit side by side
   * on every fill, stroke and effect header and the kit's minus spans 20 of the
   * grid against its own plus's 16: Lucide's is the drawn partner of that plus.
   */
  Plus: kit("plus"),
  Minus: "Minus",
  Copy: kit("copy"),
  /*
   * Handing the session to a coding agent — the annotations tab's Send button.
   *
   * Lucide's `Send` is the paper plane, which is what agentation's own send
   * control draws and what a designer has already learned means "this leaves
   * here". `Sparkles` was the other candidate and says something different:
   * it names the RECIPIENT as an AI, where the plane names the ACT. The button
   * beside it copies the same brief to a clipboard, so the distinction the
   * glyph has to draw is departure, not intelligence.
   *
   * The kit's role map settles which plane: "Send" is `paper-plane-filled`, and
   * the hollow `paper-plane` means "post into a chat". Handing the brief off is
   * the first.
   */
  Send: kit("paper-plane-filled"),
  Trash: kit("trash-2"),
  // The Code TAB. The kit's code mark is `</>` — Lucide's `Code` was `< >` —
  // and it has to read at 16 beside a speech bubble.
  Code: kit("code-2"),
  Sparkles: kit("sparkles"),
  Play: kit("play"),
  // No `Info` or `?` glyph: every explainer in the chrome now opens on hover
  // of the thing it explains, so nothing draws an info or help mark.
  /*
   * The theme switch wears the mode it will GIVE you, which is the convention
   * every OS switch uses: a moon offers night.
   *
   * Lucide's HOLLOW sun and moon, at the set's 2-unit stroke. They were native
   * SOLID marks — a filled disc with rays, a filled crescent — and beside the
   * hollow hooks, frames and bubble in the toolbar the theme button was the one
   * blot in the strip, in both themes. The kit draws its sun and moon hollow
   * too, but as fills with the weight baked in at 22 units; Lucide's are the
   * same drawings as strokes, so they fit the ink budget without going thin.
   */
  Sun: "Sun",
  Moon: "Moon",
  /*
   * Annotation: the toolbar mode toggle, the annotations tab's mark, and every
   * marker pinned on the canvas. The kit's role map names `message-square` for
   * "comment", and the kit draws it as a ROUND bubble with its tail at the
   * bottom right — the two things this mark was already asking of Lucide, where
   * it had to be `MessageCircle` MIRRORED to get the tail on the right. The
   * mirror is gone with Lucide; the scale stays — see `REDRAWN`.
   *
   * A native bubble stood here for one round and was the wrong answer. It had
   * to be a rounded rectangle, because a circle with a separately-authored tail
   * reads as a magnifying glass at 16px — the tail has to grow out of the
   * outline, which is a thing a stroke does naturally and a composed fill does
   * not. The round bubble was better than anything drawn to replace it, so what
   * it needed was the flip, not a redrawing.
   */
  MessageSquare: kit("message-square"),

  /*
   * Layer-tree row state. Eye and lock each have an explicit opposite drawing,
   * because "hidden" and "locked" are not the pressed state of a control — they
   * are facts about the layer, and a struck-through eye says so at a glance.
   *
   * A PAIR is one drawing in two states, so both halves come from one source.
   * The kit draws a lock and no open lock, so `LockOpen` is the kit's lock with
   * its shackle swung open — one arc edited, see `REDRAWN`. The kit's eye is a
   * filled half-lid with no counterpart to strike through, and deriving one is
   * redrawing it, so the eye pair stays Lucide's: a row that toggled between
   * two families on every click would be worse than one that shares neither.
   */
  Eye: "Eye",
  EyeOpen: "Eye",
  EyeOff: "EyeOff",
  Lock: kit("lock"),
  LockOpen: kit("lock"),

  // The one control in this chrome that LEAVES it: "Sign in with …" in the
  // library sign-in dialog hands the person over to their identity provider, in
  // a separate browser window. The dialog says so in words as well, and the
  // glyph is what makes it survive a skim — a button that opens something
  // somewhere else should not look like one that acts here, and an arrow out of
  // a box is the mark everybody already reads that way.
  ExternalLink: kit("external-link"),

  // What a layer IS. `Square` stays Lucide's outline: the kit's `square` is a
  // SOLID swatch, which in a layer row would read as a colour, not a box.
  Square: "Square",
  Type: "Type",
  Image: kit("image"),
  Component: "Component",

  // Align: three marks along each axis. Lucide names these six by the edge they
  // pull to, as we do, but names the two spacing marks by the axis they
  // distribute on — which is why the pairing is written out rather than derived.
  AlignStartVertical: "AlignStartVertical",
  AlignCenterVertical: "AlignCenterVertical",
  AlignEndVertical: "AlignEndVertical",
  AlignStartHorizontal: "AlignStartHorizontal",
  AlignCenterHorizontal: "AlignCenterHorizontal",
  AlignEndHorizontal: "AlignEndHorizontal",
  SpaceBetweenHorizontal: "AlignHorizontalSpaceBetween",
  SpaceBetweenVertical: "AlignVerticalSpaceBetween",

  /*
   * The shared arrows — layers tree, app chooser, layer menu, field steppers.
   * The kit draws `arrow-up` and `arrow-right` and no `arrow-down`, and up and
   * down sit together in every one of those surfaces, so `ArrowDown` is the
   * kit's `arrow-up` flipped vertically (see `REDRAWN`) rather than Lucide's,
   * which is 14 units tall against the kit's 22. The two `…ToLine` marks keep
   * Lucide's: the kit has none, and the options panel draws its one alone.
   */
  ArrowUp: kit("arrow-up"),
  ArrowDown: kit("arrow-up"),
  ArrowRight: kit("arrow-right"),
  ArrowUpToLine: "ArrowUpToLine",
  ArrowDownToLine: "ArrowDownToLine",

  /*
   * The marks that used to be TYPED rather than drawn.
   *
   * Fourteen controls in the inspector carried a Unicode character as their
   * glyph — `⊞`, `⊘`, `→`, `◧`, `•`, `−` — because when each was written there
   * was no icon in the set that said what it meant. A character is not an icon.
   * It is drawn by whatever font happens to resolve it, at the TEXT size of its
   * button rather than at a rung of the icon ramp, in a weight nothing here
   * controls, and it is missing entirely on a machine whose fonts do not cover
   * the codepoint.
   *
   * The corner-radius toggle was the visible symptom — a `⊞` arriving several
   * pixels smaller than every real glyph beside it — but the whole group was off
   * the ramp, and not all of it was small: `→` rendered oversized in the same
   * strip, from the same cause.
   *
   * These are the drawings that replace them. Each is a real glyph at a real
   * rung, which is the only arrangement under which the size is anybody's
   * decision at all.
   */
  // Text alignment. Named apart from the six object-align marks above on
  // purpose: those move a BOX within its parent, these set a paragraph's rag,
  // and the two families would otherwise be one keystroke apart at every call
  // site.
  TextAlignLeft: "AlignLeft",
  TextAlignCenter: "AlignCenter",
  TextAlignRight: "AlignRight",
  TextAlignJustify: "AlignJustify",
  /*
   * The OTHER axis of text alignment, which this set had no marks for at all.
   *
   * Figma's type block carries two triples — where the rag sits across the line
   * box, and where the lines sit inside the frame — and only the first existed
   * here. These are the second. They are arrow-to-line drawings rather than
   * more rag drawings, because that is the difference they have to carry: a rag
   * mark shows text moving WITHIN its measure, these show the whole block
   * moving against a boundary.
   *
   * `ArrowUpToLine` and `ArrowDownToLine` are already mapped above for arrange,
   * and pointing two editor names at one Lucide drawing is deliberate — the MAP
   * is a naming layer, so the call site reads as what the mark MEANS here. The
   * generator emits one shape record per editor name; the duplication is a few
   * hundred bytes and buys a call site that cannot confuse "send to back" with
   * "align text to the bottom of its box".
   */
  TextAlignTop: "ArrowUpToLine",
  TextAlignMiddle: "FoldVertical",
  TextAlignBottom: "ArrowDownToLine",
  /*
   * The four padding sides, as four drawings instead of four capital letters.
   *
   * The padding fields label themselves `T`, `R`, `B`, `L` today, which is a
   * word standing in for a picture in a control that is 88px wide and already
   * spends most of that on a number. Lucide's `Panel*` set is a box with one
   * edge weighted, which is the thing itself — and it reads at 16px, where a
   * letter at this size competes with the value beside it.
   */
  PadTop: "PanelTop",
  PadRight: "PanelRight",
  PadBottom: "PanelBottom",
  PadLeft: "PanelLeft",
  /*
   * Lock the ratio while one side is dragged. Sits in the trailing action
   * column beside the W/H pair, which is where Figma puts it.
   */
  Constrain: "Scaling",
  // Auto layout's direction strip. The row is four mutually exclusive states, so
  // "off" needs a mark of its own rather than an empty square; the two arrows
  // say which way children flow; `WrapText` is the one of the four that is a
  // picture rather than a direction, because it is the one that is not a
  // direction.
  Ban: "Ban",
  WrapText: "WrapText",
  /*
   * Rewriting a note, on the row that lists it.
   *
   * That button used to draw `Type` — the text mark — on the grounds that the
   * set had no pencil and that of what it did have, this was the only glyph
   * that said "the words". It read as a formatting control instead: a `T` is
   * what every other toolbar puts on "insert text" or "text style", and this
   * button does neither. A pencil is the mark for "change what is written", so
   * the fix was to add one rather than keep picking the least wrong glyph
   * already in the set.
   */
  Pencil: kit("pencil"),
  // Split one value into four, and collapse four back into one — the corner
  // radii, and the padding sides. Four cells against one box, which is the whole
  // of what that toggle does.
  Grid2x2: "Grid2x2",
  // The 3x3 alignment pad's cells. Nine of these inside an 18px grid, so the
  // mark has to survive being the smallest thing in the chrome: a ring still
  // reads at the `marker` rung, where a solid dot closes up.
  Circle: "Circle",
}

/**
 * The ramp a glyph may be drawn at — the kit's six icon roles, marker 12 to
 * feature 24 — and the stroke it wears at each rung.
 *
 * FLAT AT THE KIT'S 2, where it used to be compensated per size (2.75 at 10
 * down to 1.75 at 32). Two things changed, and either would have been enough.
 *
 * The kit's glyphs are half STROKES and half FILLS, and a fill is a stroke
 * already expanded: `chevron-down`, `x`, `copy` and `arrow-up` are outlines
 * whose 2-unit weight is baked into the path, and no attribute can make them
 * heavier at 12px. Compensating the strokes would put a `chevron-right` a
 * quarter heavier than the `chevron-down` it swaps with in the same row, which
 * is the kit's own named bug ("a lone quiet stroke among 2-stroke peers")
 * turned the other way. One number is the only weight both halves can share.
 *
 * And the rung that needed rescuing is gone. Compensation existed because 2
 * units at 10px is 0.83px, under the point where a stroke antialiases into a
 * grey smear. The kit's ramp stops at 12, where 2 units is exactly 1 CSS pixel:
 * two whole device pixels on a 2x screen, one whole pixel at 1x. That is the
 * thinnest line this chrome draws anywhere, hairlines included, and it reads.
 * Rendered thickness now rises 1.0 → 2.0px across the ramp, a 2x spread that is
 * the same mark enlarged rather than two weights.
 *
 * TUNING. The kit exposes this as `--icon-stroke-width`. The chrome does not
 * read that name, because it inherits from the HOST page and a host set to the
 * kit's quiet 1.75 would re-weight the editor. The editor's equivalent is
 * `--de-icon-stroke`, written per glyph by `drawIcon` from this table.
 *
 * The ceiling is not free: half of a stroke lies outside the path it is centred
 * on, so a width of `w` needs `w / 2` units of clearance inside the grid — plus
 * the selected-state bump (see `SELECTED_STROKE_BUMP`). `assertFits` measures
 * every glyph's real clearance and fails the build if any stroked shape would
 * push its ink past the viewBox.
 */
const STROKE_FOR_SIZE = {
  12: 2,
  14: 2,
  16: 2,
  18: 2,
  20: 2,
  24: 2,
}

/**
 * How much heavier `css/icons.ts` draws a glyph in a selected row or pressed
 * control (`calc(var(--de-icon-stroke) + 0.5)`). Mirrored here only so the
 * clearance check measures the heaviest stroke that actually renders.
 */
const SELECTED_STROKE_BUMP = 0.5

/** The kit's and Lucide's grid. Never re-windowed — see the header. */
const GRID = 24

/* ── The native family, and the measurement that forced it ──────────────────
 *
 * Thirty-nine glyphs below are drawn HERE rather than taken from Lucide, and
 * the reason is a rendering fact rather than a preference.
 *
 * Lucide is a stroke family on a 24 grid. Drawn at the `control` rung, 16px, a
 * stroke of 2.25 grid units renders `2.25 * 16 / 24` = 1.5 CSS pixels, which on
 * a 2x display is THREE device pixels — an odd count, so the stroke cannot sit
 * on a pixel boundary and is split across two rows at partial coverage. Every
 * coordinate has the same problem: Lucide's grid is thirds of a pixel at this
 * size. The result is a mark that measures exactly 16px and looks soft, which
 * is precisely the "rough, not polished" complaint this set was built to answer.
 *
 * Figma's own panel was captured at a confirmed 2x and measured pixel by pixel
 * (`.harness/figma-spec.md`). Its control glyphs are not strokes at all: they
 * are FILLED bars — a 1px rule and two 2px bars for the align marks, three 1px
 * bars for the text marks — with hard edges and no antialiasing anywhere along
 * an axis-aligned run.
 *
 * So the family below is filled, and it is authored on a SIXTEEN grid where
 * every coordinate is a whole number. `u()` multiplies by 1.5 on the way out,
 * which lands the drawing in the same 24 viewBox as everything else — no
 * re-windowing, the rule the header states and the test suite pins — while
 * guaranteeing that at 16px every edge falls on a whole CSS pixel, and at 2x on
 * a whole device pixel. A fill has no half-stroke hanging outside it either, so
 * the edge is exactly where the number says.
 *
 * WHY NOT COPY FIGMA'S SVGs. They are proprietary artwork and this package is
 * MIT-licensed and public; shipping them would be relicensing someone else's
 * drawings. What is copied is the GEOMETRY that was measured — a rule and two
 * bars of 9 and 5 units — which is the same idiom Sketch, Penpot, Framer and
 * Lucide itself all draw, and not anyone's expression to own. Every path below
 * was authored from the measurements.
 *
 * These stay in one `ICONS` table with the Lucide glyphs on purpose: one name
 * space, one `icon()` call, one `--check`. A caller should not have to know
 * which family a mark came from, and nothing outside this file does.
 */

/**
 * 16-grid unit -> 24-grid unit.
 *
 * WHICH RUNGS THIS FAMILY MAY BE DRAWN AT, and it is not all of them.
 *
 * A native glyph is authored on a 16 lattice and emitted into the 24 viewBox,
 * so one authored unit renders at `size / 16` CSS pixels — `size / 8` device
 * pixels on a 2x display. That is a whole number only when the size is a
 * multiple of 8: **16 and 24 are crisp; 12, 14, 18 and 20 are not.**
 *
 * Measured, because it is not a small difference. The align mark at 16px
 * resolves to two ink levels in the rendered panel — the ink and one edge
 * sample. The same construction at 12px resolves to four to six, which is
 * exactly the soft, half-covered edge this family was built to get rid of.
 *
 * So a native glyph in a field's leading strip is drawn at `icon.action`
 * (16), not at `icon.marker` (12) as a 12px-tall control would suggest. The strip
 * grows from 20px to 24px to hold it, which is what Figma's is anyway.
 *
 * `test/icon-cases.mjs` enforces this against the source, because the failure
 * is invisible in review: `tokens.icon.marker` is the locally reasonable thing to
 * reach for beside 12px text, and the glyph it produces looks fine until it is
 * next to one drawn at 16.
 */
const u = (n) => n * 1.5

/** A filled bar: the family's only primitive for an axis-aligned run. */
const bar = (x, y, w, h) => [
  "rect",
  { x: u(x), y: u(y), width: u(w), height: u(h), fill: "currentColor", stroke: "none" },
]

/** A rounded rectangle's outline, as one closed subpath. */
const roundRect = (x, y, w, h, r) => {
  if (!r) return `M${u(x)} ${u(y)}h${u(w)}v${u(h)}h${-u(w)}z`
  const [X, Y, W, H, R] = [u(x), u(y), u(w), u(h), u(r)]
  return (
    `M${X + R} ${Y}h${W - 2 * R}a${R} ${R} 0 0 1 ${R} ${R}` +
    `v${H - 2 * R}a${R} ${R} 0 0 1 ${-R} ${R}` +
    `h${-(W - 2 * R)}a${R} ${R} 0 0 1 ${-R} ${-R}` +
    `v${-(H - 2 * R)}a${R} ${R} 0 0 1 ${R} ${-R}z`
  )
}

/**
 * One shape with a hole in it: several closed subpaths wound into one
 * `evenodd` path.
 *
 * Every outline in this family is a hole rather than a stroke, because a stroke
 * would put half its width outside the path it is centred on and re-introduce
 * the half-pixel edge the whole family exists to avoid. So the outlines are
 * composed here — two rounded rects for a frame, a rounded rect inside a
 * rounded rect for a panel — and every edge lands exactly
 * where the number says.
 */
const punched = (...subpaths) => [
  "path",
  {
    d: subpaths.join(""),
    "fill-rule": "evenodd",
    fill: "currentColor",
    stroke: "none",
  },
]

/**
 * A 1-unit outline, drawn as a filled ring rather than a stroked rect.
 *
 * The corner radius is not decoration: Figma's flow boxes are rounded and its
 * padding box is not, and that difference is what tells "an object being laid
 * out" apart from "the frame you are measuring". The inner radius is the outer
 * one less the border, which is the same offset rule `nest()` applies to the
 * chrome's own nested corners — a constant inner radius would leave the two
 * curves non-parallel at 16px, which is visible even on a 5-unit box.
 */
const ring = (x, y, w, h, t = 1, r = 0) =>
  punched(roundRect(x, y, w, h, r), roundRect(x + t, y + t, w - 2 * t, h - 2 * t, Math.max(r - t, 0)))


/**
 * Half a ring, as the hook an undo arrow turns through.
 *
 * Both ends of a half ring are cut on the VERTICAL diameter, where the arc's
 * tangent is horizontal — which is the whole reason the undo mark is built from
 * one of these rather than from a three-quarter arc. A run that leaves the
 * curve at a tangent that is not axis-aligned has to be met by a bar drawn at
 * the same angle, and this family has no such bar; a horizontal tangent lets
 * the shaft and the tail be `bar()`s whose edges land on the lattice.
 *
 * `side` names the half that is DRAWN — "right" keeps the east semicircle, so
 * the gap opens to the west.
 */
const halfRing = (cx, cy, radius, thickness, side) => {
  const CX = u(cx)
  const outer = u(radius)
  const inner = u(radius - thickness)
  const [north, south] = [u(cy) - outer, u(cy) + outer]
  const [innerNorth, innerSouth] = [u(cy) - inner, u(cy) + inner]
  return [
    "path",
    {
      d:
        side === "right"
          ? `M${CX} ${north}A${outer} ${outer} 0 0 1 ${CX} ${south}` +
            `L${CX} ${innerSouth}A${inner} ${inner} 0 0 0 ${CX} ${innerNorth}z`
          : `M${CX} ${south}A${outer} ${outer} 0 0 1 ${CX} ${north}` +
            `L${CX} ${innerNorth}A${inner} ${inner} 0 0 0 ${CX} ${innerSouth}z`,
      fill: "currentColor",
      stroke: "none",
    },
  ]
}

/**
 * A bar at 45 degrees — the family's primitive for a run that cannot be
 * axis-aligned, and the only one it has.
 *
 * `thickness` is measured VERTICALLY and the ends are cut vertically too, which
 * is the same convention `chevron` uses and for the same reason: a
 * perpendicular cut would need the arms of an X to know about each other. At
 * 45 degrees the perpendicular width is `thickness / sqrt(2)`, so 1.4 lands on
 * very close to the 1 unit every rule in this family is drawn at.
 *
 * Antialiasing here is unavoidable and accepted — see `chevron`. What the
 * lattice still buys is the WEIGHT: a diagonal drawn as a fill is 1 unit thick
 * at every rung, where Lucide's `X` at 16px is 1.5 CSS pixels and reads a step
 * bolder than the bars beside it.
 */
const diagonal = (x1, y1, x2, y2, thickness = 1.4) => {
  const half = thickness / 2
  return [
    "path",
    {
      d:
        `M${u(x1)} ${u(y1 - half)}L${u(x2)} ${u(y2 - half)}` +
        `L${u(x2)} ${u(y2 + half)}L${u(x1)} ${u(y1 + half)}z`,
      fill: "currentColor",
      stroke: "none",
    },
  ]
}

/**
 * The filled column inside a panel frame: rounded where it meets the frame's
 * corner, square where it meets the divider.
 *
 * `roundRect` cannot draw this and must not be bent into it. A column with four
 * square corners pushes ink past the frame's inner arc — the defect the Lucide
 * counterparts called out and drew around by hand — and a column rounded on all
 * four would leave a notch against the divider, which is a straight line.
 */
const sidePanel = (x, y, w, h, r, side) => {
  const [X, Y, W, H, R] = [u(x), u(y), u(w), u(h), u(r)]
  return [
    "path",
    {
      d:
        side === "left"
          ? `M${X + R} ${Y}h${W - R}v${H}h${-(W - R)}a${R} ${R} 0 0 1 ${-R} ${-R}` +
            `v${-(H - 2 * R)}a${R} ${R} 0 0 1 ${R} ${-R}z`
          : `M${X} ${Y}h${W - R}a${R} ${R} 0 0 1 ${R} ${R}v${H - 2 * R}` +
            `a${R} ${R} 0 0 1 ${-R} ${R}h${-(W - R)}z`,
      fill: "currentColor",
      stroke: "none",
    },
  ]
}

/* ── Polygons with rounded corners, and the outline of one ─────────────────
 *
 * Everything above draws a mark out of rectangles, arcs and one 45-degree bar,
 * which covers every glyph in this family except the pointer. A pointer is a
 * four-sided polygon with one CONCAVE vertex and no axis-aligned edge at all,
 * and it needs two things nothing above can give it: corners with a stated
 * radius, and a hollow weight whose INNER boundary is rounded too.
 *
 * That second half is the whole reason these exist. A stroked outline gets its
 * outer corners rounded for free by `stroke-linejoin: round` and its inner ones
 * not at all, so at a 34-degree tip the hollow weight came to a needle while
 * the filled weight — the same path, flooded — showed a soft 0.75px corner. The
 * two weights of one mark looked like two different drawings. Offsetting the
 * polygon and rounding both rings separately is what lets the pair agree.
 */

const sub = ([ax, ay], [bx, by]) => [ax - bx, ay - by]
const add = ([ax, ay], [bx, by]) => [ax + bx, ay + by]
const scale = ([x, y], k) => [x * k, y * k]
const length = ([x, y]) => Math.hypot(x, y)
const unit = (v) => scale(v, 1 / length(v))
const dot = ([ax, ay], [bx, by]) => ax * bx + ay * by

/**
 * Where two infinite lines cross, each given as two points on it.
 *
 * Returns the shared endpoint when they are parallel, which is the right answer
 * for the only case that produces it here: two collinear edges of a polygon,
 * whose offsets are collinear too and meet everywhere.
 */
const meet = ([[x1, y1], [x2, y2]], [[x3, y3], [x4, y4]]) => {
  const d = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4)
  if (Math.abs(d) < 1e-9) return [x2, y2]
  const a = x1 * y2 - y1 * x2
  const b = x3 * y4 - y3 * x4
  return [(a * (x3 - x4) - (x1 - x2) * b) / d, (a * (y3 - y4) - (y1 - y2) * b) / d]
}

/**
 * A closed polygon's vertices, moved `d` units toward its interior.
 *
 * Per-EDGE rather than per-vertex: each edge is slid along its own inward
 * normal and the new vertices are where consecutive slid edges cross. That is
 * what keeps the wall an even `d` thick all the way round, including at the
 * concave vertex, where a naive "push the point along its bisector" moves the
 * corner the wrong way and pinches the wall shut.
 *
 * Which side is inward is read from the winding rather than assumed. SVG's y
 * grows downward, so a positive shoelace sum is a ring that runs CLOCKWISE on
 * screen, and the interior of one of those is to the left of each edge.
 */
const insetPolygon = (points, d) => {
  const n = points.length
  const twiceArea = points.reduce((sum, [x1, y1], i) => {
    const [x2, y2] = points[(i + 1) % n]
    return sum + (x1 * y2 - x2 * y1)
  }, 0)
  const sign = twiceArea > 0 ? 1 : -1
  const slid = points.map((from, i) => {
    const to = points[(i + 1) % n]
    const [dx, dy] = unit(sub(to, from))
    const normal = [sign * -dy * d, sign * dx * d]
    return [add(from, normal), add(to, normal)]
  })
  return points.map((_, i) => meet(slid[(i - 1 + n) % n], slid[i]))
}

/**
 * One closed subpath: a polygon whose corners are arcs of the given radii.
 *
 * `radii` is per-vertex, because the corners of a pointer are not one corner
 * repeated — the tip wants a visible blunting, the wings want barely any, and
 * the concave shoulder wants more than either since a hollow weight's inner
 * boundary curves the other way there.
 *
 * Each radius is clamped to what the two edges it sits between can afford, so
 * a value too large for a short edge rounds as far as it can instead of
 * emitting a path that doubles back on itself.
 */
const roundedPolygon = (points, radii) => {
  const n = points.length
  const corners = points.map((B, i) => {
    const A = points[(i - 1 + n) % n]
    const C = points[(i + 1) % n]
    const toA = unit(sub(A, B))
    const toC = unit(sub(C, B))
    const interior = Math.acos(Math.max(-1, Math.min(1, dot(toA, toC))))
    const wanted = Array.isArray(radii) ? radii[i] : radii
    // `tan(interior / 2)` is how far along each edge a radius eats. Halving the
    // edge lengths is what stops two corners on one edge from overrunning.
    const reach = Math.min(
      wanted / Math.tan(interior / 2),
      length(sub(A, B)) / 2,
      length(sub(C, B)) / 2
    )
    const radius = reach * Math.tan(interior / 2)
    // Which way the arc turns is the sign of the turn the polygon makes here,
    // and it flips at the concave vertex — which is exactly what a hollow
    // pointer's shoulder needs and what a single hardcoded flag would get wrong.
    const turn = (B[0] - A[0]) * (C[1] - B[1]) - (B[1] - A[1]) * (C[0] - B[0])
    return { enter: add(B, scale(toA, reach)), exit: add(B, scale(toC, reach)), radius, sweep: turn > 0 ? 1 : 0 }
  })
  const point = ([x, y]) => `${u(x)} ${u(y)}`
  let d = `M${point(corners[0].enter)}`
  for (let i = 0; i < n; i++) {
    const { exit, radius, sweep } = corners[i]
    const R = u(radius)
    d += radius > 1e-6 ? `A${R} ${R} 0 0 ${sweep} ${point(exit)}` : `L${point(exit)}`
    d += `L${point(corners[(i + 1) % n].enter)}`
  }
  return `${d}z`
}

/** One filled shape from a path string, stating both paints. */
const solid = (d) => ["path", { d, "fill-rule": "evenodd", fill: "currentColor", stroke: "none" }]

/**
 * A bar between two points, at any angle, with semicircular ends.
 *
 * `diagonal` draws the family's other slanted run and cuts its ends
 * VERTICALLY, which is right for a sun's ray — it meets nothing, and the cut is
 * invisible under a cap that short — and wrong for a cross. A vertical cut
 * makes a 45-degree bar `thickness` taller than it is wide, so an X built from
 * two of them inked a box 1.4 units off square and hung low in a row of marks
 * that are all square. This cuts perpendicular and rounds what is left, which
 * is square, still a true 45 degrees, and the shape a close cross has anywhere
 * it is drawn well.
 */
const capsule = (x1, y1, x2, y2, width) => {
  const half = width / 2
  const [ax, ay] = unit([x2 - x1, y2 - y1])
  const [nx, ny] = [-ay * half, ax * half]
  return roundedPolygon(
    [
      [x1 + nx, y1 + ny],
      [x2 + nx, y2 + ny],
      [x2 - nx, y2 - ny],
      [x1 - nx, y1 - ny],
    ],
    half
  )
}

/**
 * An arrowhead, as an OPEN chevron rather than a solid triangle.
 *
 * The first cut of this family drew filled triangles, and side by side with
 * Figma they were the one thing that still read as a different set: a solid
 * wedge carries far more ink than the 1-unit rules and bars around it, so every
 * arrow in the panel looked a weight heavier than every align mark. Figma draws
 * two thin strokes meeting at a point, which is the same weight as everything
 * else it draws.
 *
 * Built as a POLYGON tracing both sides of the chevron rather than as a stroked
 * polyline, because a per-shape `stroke-width` is the one override this set
 * forbids — the whole family is filled, and one stroked exception would put a
 * glyph back on the rendered-thickness ramp the family exists to leave.
 *
 * `thickness` is measured VERTICALLY, so at 45° the perpendicular width is
 * `thickness / sqrt(2)`; 1.4 gives very close to the 1 unit the rules use. This
 * is the one place antialiasing is unavoidable and also harmless — a diagonal
 * has no pixel boundary to land on at any size.
 */
const chevron = (apexX, apexY, span, reach, direction = "up", thickness = 1.4) => {
  /*
   * `spread` runs along the arms, `back` runs from the apex away from where it
   * points — both always positive, so a call site never has to reason about
   * which sign means "up" in SVG's inverted y. Getting that wrong is not a
   * subtle bug: the first cut of this helper took a signed `rise` and sent
   * FlowHorizontal's arrowhead 2.75 units outside the grid, which `assertFits`
   * caught as a clip rather than shipping a half-drawn arrow.
   */
  const place = {
    up: (spread, back) => [apexX + spread, apexY + back],
    down: (spread, back) => [apexX + spread, apexY - back],
    right: (spread, back) => [apexX - back, apexY + spread],
    left: (spread, back) => [apexX + back, apexY + spread],
  }[direction]
  const points = [
    place(-span, reach),
    place(0, 0),
    place(span, reach),
    place(span, reach + thickness),
    place(0, thickness),
    place(-span, reach + thickness),
  ]
  return [
    "path",
    {
      d: `M${points.map(([x, y]) => `${u(x)} ${u(y)}`).join("L")}z`,
      fill: "currentColor",
      stroke: "none",
    },
  ]
}

/*
 * The align marks: a rule for the edge being aligned to, and two bars standing
 * for the objects moving to it.
 *
 * Bars of 9 and 5 rather than two of the same length, because two equal bars
 * read as a list and the point is that differently sized objects share ONE
 * edge — which is the whole meaning of the control, and is invisible if the
 * bars agree. Measured off Figma as 10 and 6 inside a 13-unit ink; scaled to 9
 * and 5 inside a 12-unit ink so that every offset is a whole number instead of
 * the 1.5 its 13 would force.
 *
 * The centred variants are laid out about 7.5 rather than 8, with odd-width
 * bars, so the rule's two edges and both bars' edges are all integers. Centring
 * on 8 with a 1-unit rule would put that rule on 7.5..8.5 and undo the exercise.
 */
/* ── The toolbar's rule weight ──────────────────────────────────────────────
 *
 * ONE number, and every mark in the bottom bar is drawn to it: the frame of a
 * panel, the wall of a bubble, the hook of an undo arrow, the arm of a cross,
 * the wall of the hollow pointer, a ray of the sun.
 *
 * 1.5 units, which renders 1.5 CSS pixels at the `control` rung — Lucide's own
 * rendered thickness at 16px, to the pixel. That is not a coincidence, it is
 * the point. The bar used to be four Lucide glyphs and four native ones, and
 * when the last four went native at a 1-unit rule the whole strip lost a third
 * of its weight in one change and read as a row of hairlines. The two hooks
 * showed it worst, which is the other half of this number: a CURVE at 1px is
 * antialiased along its entire length and lands near 70% coverage, where a
 * straight rule at 1px is one solid row of pixels — so two marks at the same
 * STATED weight read a step apart. Both complaints have the same fix.
 *
 * WHY THE INSPECTOR'S NATIVE MARKS STAY AT 1. They are not this construction at
 * another size. They are 12-unit drawings assembled from 5-unit boxes, and
 * `FlowNone` alone is three rings whose holes are 3 units across; a 1.5 wall
 * closes those to nothing. Nothing in the bar is smaller than a 12-unit box,
 * which is what makes the heavier rule affordable here and not there — and the
 * bar is one strip of eight glyphs compared against each other and nothing else.
 *
 * HALF UNITS, NEVER QUARTERS. At 16px an authored unit is one CSS pixel, so 1.5
 * lands on a half pixel: three whole device pixels at 2x, one soft edge at 1x,
 * which is the trade Lucide already makes everywhere in this chrome. A bar 1.5
 * wide must therefore START on a half unit as well, and that is why the sun
 * below is laid out about 7.75 rather than 7.5 — a ray centred on 7.5 would
 * begin at 6.75, and a quarter unit is not whole at any scale.
 */
const RULE = 1.5

/**
 * The same rule set at 45 degrees.
 *
 * `diagonal` measures its thickness VERTICALLY and cuts its ends the same way,
 * so a bar of width `w` on the slant is `w / sqrt(2)` across the run. This is
 * the number that makes a diagonal ray the same weight as an axis-aligned one
 * rather than 30% lighter, which is how the old sun came to have four heavy
 * arms and four faint ones.
 */
const DIAGONAL_RULE = RULE * Math.SQRT2

/**
 * The pointer's silhouette, shared by both of its weights.
 *
 * Four vertices, mirrored about the 45-degree line through the tip: the tip,
 * one wing, the shoulder where the two wings meet on the axis, the other wing.
 * The shoulder is the CONCAVE one — it is what makes the mark a cursor rather
 * than a triangle, and what forces `roundedPolygon` to read the turn direction
 * per corner instead of assuming one.
 *
 * Proportions are Lucide's `MousePointer2` measured and re-laid on this
 * lattice: a 47-degree tip, and the shoulder 72% of the way from the tip to the
 * wings. The SIZE is not Lucide's. A native glyph inks no stroke outside its
 * path, where a Lucide one is painted 0.75 lattice units wider on every side by
 * the stroke it is drawn with, so the silhouette is authored that much larger
 * to land on the same rendered extent — which is the correction the whole bar
 * needed when four of its eight marks were still stroked.
 */
const POINTER = [
  [1.3, 1.3],
  [15, 6.65],
  [8.8, 8.8],
  [6.65, 15],
]

/**
 * Tip, wing, shoulder, wing.
 *
 * These are why the polygon above runs past the grid's usable edge and is still
 * a legal glyph: a corner radius EATS the vertex. At the tip's 47-degree angle
 * a radius of `r` pulls the point back `r / sin(23.6°) - r`, which is 1.2 units
 * for the 0.8 here — so the painted mark inks 1.85..14.15 where its vertices
 * sit at 1 and 15.3, and `inkBox` measures the arc rather than the corner it
 * replaced. Authoring to the vertices instead cost the first cut of this glyph
 * 2.3 units of extent and made the pointer the smallest thing in the bar.
 */
const POINTER_RADII = [0.8, 0.6, 1.5, 0.6]

/*
 * The inner ring's corners, and they are NOT the outer ones less the wall.
 *
 * That subtraction is the rule everywhere else a wall turns a corner, and at a
 * 47-degree tip it yields a radius of 0.2 — a sharp inner point inside a
 * rounded outer one, which is the exact defect this glyph was redrawn to fix.
 * So the tip keeps a radius the wall cannot pay for and thickens a fraction
 * there. The shoulder goes the other way: it is concave, so its inner radius is
 * the outer one PLUS the wall, and stating that is cheaper than deriving it.
 */
const POINTER_INNER_RADII = [0.45, 0.3, 2.5, 0.3]

const NATIVE = {
  AlignStartVertical: [bar(2, 2, 1, 12), bar(5, 5, 9, 2), bar(5, 9, 5, 2)],
  AlignCenterVertical: [bar(7, 2, 1, 12), bar(2, 5, 11, 2), bar(4, 9, 7, 2)],
  AlignEndVertical: [bar(13, 2, 1, 12), bar(2, 5, 9, 2), bar(6, 9, 5, 2)],
  AlignStartHorizontal: [bar(2, 2, 12, 1), bar(5, 5, 2, 9), bar(9, 5, 2, 5)],
  AlignCenterHorizontal: [bar(2, 7, 12, 1), bar(5, 2, 2, 11), bar(9, 4, 2, 7)],
  AlignEndHorizontal: [bar(2, 13, 12, 1), bar(5, 2, 2, 9), bar(9, 6, 2, 5)],

  /*
   * The rag: three lines of a paragraph, 1 unit thick on a 4-unit pitch.
   *
   * Widths 12 / 8 / 10 in every variant, so the four marks differ only in where
   * the short lines sit. A set that also changed the lengths would be four
   * different paragraphs, and the eye would read the length difference before
   * the alignment difference.
   */
  TextAlignLeft: [bar(2, 3, 12, 1), bar(2, 7, 8, 1), bar(2, 11, 10, 1)],
  TextAlignCenter: [bar(2, 3, 12, 1), bar(4, 7, 8, 1), bar(3, 11, 10, 1)],
  TextAlignRight: [bar(2, 3, 12, 1), bar(6, 7, 8, 1), bar(4, 11, 10, 1)],
  TextAlignJustify: [bar(2, 3, 12, 1), bar(2, 7, 12, 1), bar(2, 11, 12, 1)],

  /*
   * The other axis: an arrow travelling to the edge it aligns against.
   *
   * Deliberately NOT three more rag drawings. Horizontal alignment moves text
   * within its measure and vertical alignment moves the whole block against its
   * box, and if both triples were paragraphs the two controls would be one
   * six-cell strip wearing two meanings.
   */
  TextAlignTop: [bar(2, 2, 12, 1), bar(7, 4, 1, 10), chevron(7.5, 4, 3, 3, "up")],
  TextAlignMiddle: [
    bar(2, 7, 12, 1),
    bar(7, 2, 1, 4),
    chevron(7.5, 6, 3, 3, "down"),
    bar(7, 10, 1, 4),
    chevron(7.5, 9, 3, 3, "up"),
  ],
  TextAlignBottom: [bar(2, 13, 12, 1), bar(7, 2, 1, 10), chevron(7.5, 12, 3, 3, "down")],

  /*
   * Auto layout's flow, as objects rather than as arrows.
   *
   * The strip used to be `Ban`, `ArrowRight`, `ArrowDown` and `WrapText` — four
   * marks from four different ideas, one of which was a picture of text. Figma
   * draws all four as the SAME two boxes in four arrangements, which is the
   * honest drawing: the control does not change direction, it changes where the
   * children end up.
   */
  FlowNone: [ring(2, 2, 5, 5, 1, 1.5), ring(9, 6, 5, 5, 1, 1.5), ring(2, 9, 5, 5, 1, 1.5)],
  FlowHorizontal: [
    ring(2, 2, 5, 5, 1, 1.5),
    ring(9, 2, 5, 5, 1, 1.5),
    bar(2, 11, 11, 1),
    chevron(14, 11.5, 2.5, 2.5, "right"),
  ],
  FlowVertical: [
    ring(2, 2, 5, 5, 1, 1.5),
    ring(2, 9, 5, 5, 1, 1.5),
    bar(11, 2, 1, 11),
    chevron(11.5, 14, 2.5, 2.5, "down"),
  ],
  FlowWrap: [
    ring(2, 2, 5, 5, 1, 1.5),
    ring(9, 2, 5, 5, 1, 1.5),
    ring(2, 9, 5, 5, 1, 1.5),
    ring(9, 9, 5, 5, 1, 1.5),
  ],

  /*
   * Padding: the box, and the edge being measured. One outline with one side
   * doubled, so the four read as one control with four positions rather than as
   * four arrows that happen to be near each other.
   */
  PadTop: [ring(2, 2, 12, 12), bar(2, 2, 12, 2)],
  PadRight: [ring(2, 2, 12, 12), bar(12, 2, 2, 12)],
  PadBottom: [ring(2, 2, 12, 12), bar(2, 12, 12, 2)],
  PadLeft: [ring(2, 2, 12, 12), bar(2, 2, 2, 12)],

  /** Two objects pushed to the ends, with the freed space between them. */
  SpaceBetweenHorizontal: [bar(2, 2, 2, 12), bar(12, 2, 2, 12), bar(6, 7, 4, 2)],
  SpaceBetweenVertical: [bar(2, 2, 12, 2), bar(2, 12, 12, 2), bar(7, 6, 2, 4)],

  /*
   * The four marks that replace a WORD printed inside a field.
   *
   * A field's leading strip is about 20px wide inside an 88px control, so a
   * label like `Opacity` either crowds the number or gets clipped — and the
   * panel had both spellings at once, `Opacity 100` beside `W 168`, which is
   * the inconsistency this pass is about. Figma's answer is a glyph in the
   * strip and the word in the caption above the group, and these are the four
   * glyphs that requires.
   *
   * `GapColumn` and `GapRow` are two objects with the measured space between
   * them, on the axis each one governs; the bars are the same 2-unit objects
   * the align marks use, so a gap reads as the same subject as an alignment.
   * `Opacity` is a checkerboard, the universal mark for what is behind a
   * partly transparent thing. `CornerRadius` is one corner of a box with the
   * curve called out and the two straight edges dropped, which is the part of
   * the box the number actually changes.
   */
  GapColumn: [bar(2, 3, 2, 10), bar(12, 3, 2, 10), bar(6, 7, 1, 2), bar(9, 7, 1, 2)],
  GapRow: [bar(3, 2, 10, 2), bar(3, 12, 10, 2), bar(7, 6, 2, 1), bar(7, 9, 2, 1)],
  Opacity: [
    ring(2, 2, 12, 12),
    bar(3, 3, 5, 5),
    bar(8, 8, 5, 5),
  ],
  CornerRadius: [
    // The curve itself, as a quarter ring: outer arc at radius 8 from the
    // bottom-right of the mark, inner arc one unit inside it.
    [
      "path",
      {
        d:
          `M${u(3)} ${u(14)}v${-u(4)}a${u(7)} ${u(7)} 0 0 1 ${u(7)} ${-u(7)}h${u(4)}` +
          `v${u(1)}h${-u(4)}a${u(6)} ${u(6)} 0 0 0 ${-u(6)} ${u(6)}v${u(4)}z`,
        "fill-rule": "evenodd",
        fill: "currentColor",
        stroke: "none",
      },
    ],
    // The two handles that say which corner is being measured.
    bar(2, 2, 2, 2),
    bar(12, 12, 2, 2),
  ],

  /*
   * Arrange, as two pairs: a bare arrow steps one place, an arrow against a
   * rule goes all the way. Figma has no arrange control, so there is nothing to
   * measure here — what these owe is consistency with the twenty-seven glyphs
   * above, since they sit in the same track.
   */
  ArrangeFront: [bar(2, 2, 12, 1), bar(7, 4.5, 1, 9.5), chevron(7.5, 4.5, 3, 3, "up")],
  ArrangeForward: [bar(7, 3, 1, 11), chevron(7.5, 3, 3, 3, "up")],
  ArrangeBackward: [bar(7, 2, 1, 11), chevron(7.5, 13, 3, 3, "down")],
  ArrangeBack: [bar(2, 13, 12, 1), bar(7, 2, 1, 9.5), chevron(7.5, 11.5, 3, 3, "down")],

  /* ── The bottom toolbar ──────────────────────────────────────────────────
   *
   * The strip along the bottom of the screen was the last surface still drawn
   * entirely in Lucide, and it is the one surface where that is most visible:
   * eight glyphs in a row, all at 16px, with nothing else on the plate to look
   * at. A 2.25-unit stroke there renders 1.5 CSS pixels — three device pixels
   * at 2x, so no edge can sit on a boundary — and the whole row reads soft
   * against an inspector whose marks are now hard-edged fills.
   *
   * Two of these take a name the Lucide map already had, and four are new. The
   * rule deciding which is the one stated at the collision check below: a name
   * drawn from ONE surface may have its artwork replaced in place, because that
   * changes the drawing everywhere it appears and churns no call site.
   * `PanelLeft` and `PanelRight` are each called from exactly one control in
   * this bar. `X`, `RotateCcw` and `RotateCw` are not — `X` closes
   * seven other things at `icon.marker`, which is 12px and a rung this family may
   * not be drawn at — so the toolbar's cross and its two history arrows are
   * NEW marks under names that say what the button does rather than what the
   * picture is.
   *
   * What is deliberately NOT here is the pointer. `Cursor` is the one Lucide
   * glyph with a genuine filled weight, and the mode switch spends it: filled
   * while the editor holds the pointer, hollow once the app has it back. A
   * native pointer would be a filled polygon in both weights and the mode would
   * stop reporting itself — and it would buy nothing in exchange, because an
   * arrow is all diagonals and a diagonal antialiases at every size on any
   * lattice.
   *
   * The pointer is native anyway now, for a reason that has nothing to do with
   * size: its two weights have to be rounded as two separate boundaries, and a
   * stroke only rounds one of them. The note bubble went the other way and came
   * back to Lucide — see `MessageSquare` in the map.
   */

  /*
   * THE POINTER, and the two boundaries a hollow one has.
   *
   * `Cursor` is the mode switch's mark and the launcher's, and it is the only
   * glyph in the chrome whose two weights are two different SILHOUETTES rather
   * than one silhouette painted twice — see `FILLED`. Everything else that
   * fills is a closed shape the root flood can ink.
   *
   * The outline is an annulus: the pointer, and the same pointer inset a unit,
   * wound `evenodd`. That is what buys the corners. A stroked outline gets
   * `stroke-linejoin: round` on the OUTSIDE of the stroke and nothing on the
   * inside, so at this tip angle the hollow weight came to a needle where the
   * filled weight showed a soft corner, and the mode switch appeared to redraw
   * itself on press. Here both rings are rounded, and the tip is rounded HARDER
   * than a constant wall would allow: the outer tip carries 1.2 units of radius
   * against the inner tip's 0.45, so the wall thickens slightly at the point
   * instead of closing to a blade.
   *
   * The silhouette is Lucide's proportions on this lattice — a 47-degree tip,
   * the shoulder 72% of the way down the axis — mirrored about the 45-degree
   * line through the tip, which is what makes the two wings one drawing and not
   * two. `POINTER` is shared by both weights so they cannot drift in size.
   */
  Cursor: [
    punched(
      roundedPolygon(POINTER, POINTER_RADII),
      roundedPolygon(insetPolygon(POINTER, RULE), POINTER_INNER_RADII)
    ),
  ],

  /*
   * Undo and redo, as Lucide's `Undo2` rather than its `RotateCcw`.
   *
   * A full circular arrow is the wrong drawing for this family and not for
   * aesthetic reasons: a 300-degree arc leaves its tail at a tangent that is
   * not axis-aligned, so the arrowhead has to be drawn at that angle and the
   * mark becomes all antialiased diagonal. A hook is half a ring, which leaves
   * the curve pointing due west at the top and due west at the bottom — so the
   * shaft and the tail are `bar()`s on the lattice and only the curve itself is
   * soft. It also says the plainer thing: undo goes BACK, and an arrow pointing
   * left says that without the reader having to work out which way a circle is
   * turning.
   *
   * The hook's radii are whole numbers about a whole-numbered centre, which is
   * what lands the two ends of the arc — the only places it is axis-aligned —
   * on the lattice, so the joint with the shaft is invisible rather than a
   * half-unit step.
   */
  ToolUndo: [
    chevron(2.5, 4.75, 2.75, 2.75, "left", DIAGONAL_RULE),
    bar(3, 4, 6, RULE),
    halfRing(9, 9, 5, RULE, "right"),
    bar(6, 12.5, 3, RULE),
  ],
  ToolRedo: [
    chevron(13.5, 4.75, 2.75, 2.75, "right", DIAGONAL_RULE),
    bar(7, 4, 6, RULE),
    halfRing(7, 9, 5, RULE, "left"),
    bar(7, 12.5, 3, RULE),
  ],

  /*
   * The close cross, at the family's weight.
   *
   * This is the one glyph here that the lattice cannot make crisper — two
   * diagonals antialias at every size, which is why Lucide's `X` was never the
   * problem it looked like. What it fixes is WEIGHT: Lucide draws it 1.5 CSS
   * pixels thick at 16px, and set in a row where every other mark is now a
   * 1-unit fill, the cross reads a step bolder than the bar it closes.
   *
   * Drawn at 10 of the 16 lattice rather than the 12 the axis-aligned marks
   * use, because a diagonal reaches further into the eye at the same box size.
   * That is Lucide's own optical sizing — its `X` inks 12 of the 24 grid where
   * its `Plus` inks 14 — and `test/icon-cases.mjs` asserts the ratio survives.
   */
  ToolClose: [solid(capsule(3.2, 3.2, 12.8, 12.8, RULE)), solid(capsule(3.2, 12.8, 12.8, 3.2, RULE))],

  /*
   * The two panel toggles, as the SIDES they are — the same subject Lucide's
   * `Panel*` frames drew, on the lattice and with the whole column inked rather
   * than one edge weighted.
   *
   * These keep their names, because the pair is called from nowhere but this
   * bar, and keeping them is what lets the toggle keep its second weight: only
   * a name in `FILLED` may carry an authored counterpart, and only a counterpart
   * can say "the panel is open" on a button that has given up its accent chip.
   * The outline is the frame with the divider the panel hangs off; the fill is
   * that same frame with the column solid. See `FILLED` below.
   *
   * `PadLeft` and `PadRight` draw a frame with one EDGE doubled, which is a
   * different claim — a measurement against a boundary, not a region of the
   * screen — and the two sets never appear in the same surface.
   *
   * THE PANEL IS FOUR UNITS WIDE, not three. It read as a margin rather than as
   * a region: three of the frame's ten inner units, at the `control` rung, is a
   * 3px strip against a 7px canvas, and next to a bubble and a pointer that
   * each ink half their box the pair looked like the two smallest marks in the
   * bar even though their frame is the widest thing in it. Four against six is
   * still plainly a side panel and not a split, and it is the change that makes
   * the toggles hold their own beside the marks either side of them.
   *
   * The divider is the column's inner unit, which is what keeps the hollow
   * weight and the solid one describing the same region: the rule at 6..7 is
   * the last unit of a panel that runs 3..7.
   */
  PanelLeft: [ring(2, 2, 12, 12, RULE, 2.5), bar(6, 3.5, RULE, 9)],
  PanelRight: [ring(2, 2, 12, 12, RULE, 2.5), bar(8.5, 3.5, RULE, 9)],

}

/* ── The filled counterparts, and why there are only a few ──────────────────
 *
 * A TOGGLE in this chrome fills when it is on. That is a change from "on means
 * a heavier stroke", and the reason is that the stroke bump is a signal you
 * have to compare against something to read: half a unit at 16px is legible
 * beside the same glyph in its off state, and invisible when the off state is
 * not on screen to compare with. A designer looking at one button cannot tell
 * whether notes are armed. A fill is absolute — solid or hollow, decided
 * without a reference — which is what a mode indicator has to be.
 *
 * The bump stays for `aria-selected` rows and tabs, where the neighbours ARE on
 * screen and a comparison is available. The fill is for the toolbar's toggles.
 *
 * Most of the marks that fill need nothing here. Flooding a closed silhouette
 * with `currentColor` IS its filled counterpart: `Cursor` becomes a solid
 * pointer and `MessageSquare` a solid bubble. That is the arrangement the set
 * has always preferred, because one drawing painted two ways cannot drift in
 * size or in shape.
 *
 * What is below are the glyphs where a flood draws the WRONG mark. Two ways
 * that happens, and the set has hit both: a drawing made only of open runs has
 * no area to flood at all (the retired `SlidersHorizontal` came out identical
 * in both states, and the inspector toggle silently stopped reporting itself),
 * and a closed frame with meaning drawn INSIDE it floods over that meaning —
 * see the pair below. A drawing is authored for those, and it is held to the
 * same rules: the same ink extent as its outline (`test/icon-cases.mjs`
 * measures the pair), the same subject, and the same 24 grid with nothing
 * re-windowed.
 */
const FILLED = {
  /*
   * The frame, unchanged, with the PANEL inside it inked solid.
   *
   * Flooding these would draw a solid rounded square and nothing else: the
   * divider that says which side the panel is on is a bar across a closed
   * frame, so a flood swallows the one line carrying the meaning and the two
   * marks become the same blot. Left and right would then be indistinguishable
   * in exactly the state — panel open — where the toggle is doing its only job.
   *
   * So the fill goes where the panel is. The frame is the same ring the outline
   * draws, which keeps the two weights one drawing at one extent
   * (`test/icon-cases.mjs` measures the pair), and the difference between the
   * states is the thing the control changes: a column of the screen that is
   * either there or is not.
   *
   * The column is drawn with its OUTER corners rounded to the frame's inner
   * radius and its inner edge square — see `sidePanel`. A square corner inside
   * a 2-unit round pushes ink past the arc; a round one against the divider
   * leaves a notch.
   *
   * EVERY shape here states its own fill, including the ones that have none.
   * `drawIcon` puts `fill="currentColor"` on the root for the filled weight,
   * because that root flood IS the counterpart for the glyphs not listed here —
   * and a shape in this list that says nothing inherits it. That is what these
   * two did when the pair was Lucide's: the frame flooded to a solid rounded
   * square, the authored column was painted the same colour on top of it and
   * disappeared, and both toggles drew the blot this list exists to prevent.
   * The bug is silent in every assertion, because the authored drawing is
   * present and correct in the DOM; it is only wrong once painted. The native
   * ring cannot flood — it is an `evenodd` annulus rather than a rect — but
   * every shape still says what it fills, because the next counterpart written
   * here may not have that property.
   */
  PanelLeft: [ring(2, 2, 12, 12, RULE, 2.5), sidePanel(3.5, 3.5, 4, 9, 1, "left")],
  PanelRight: [ring(2, 2, 12, 12, RULE, 2.5), sidePanel(8.5, 3.5, 4, 9, 1, "right")],

  /*
   * The canvas toggle's grid, ON: four solid cells in the outline's footprint.
   *
   * A flood would draw the frame solid and swallow the two dividers, so the
   * toggle would show a blank rounded square in exactly the state where it is
   * doing its job. Four cells with the dividers left as gaps is the same
   * picture read the other way round, at the outline's painted size (3..21).
   */
  Grid2x2: [
    [
      "path",
      {
        d: [2, 26 / 3].flatMap((x) => [2, 26 / 3].map((y) => roundRect(x, y, 16 / 3, 16 / 3, 1))).join(""),
        fill: "currentColor",
        stroke: "none",
      },
    ],
  ],

  /*
   * The pointer, solid — the same silhouette the outline's OUTER ring traces.
   *
   * It is on this list for a reason the other two are not. A flood cannot draw
   * it: the outline is an `evenodd` annulus that states its own fill, so the
   * root flood passes straight over it and the mode switch would draw the same
   * hollow arrow whether or not the editor held the pointer.
   *
   * `POINTER` and `POINTER_RADII` are shared with the outline rather than
   * repeated, which is what makes "the two weights are the same size" a
   * property of the drawing instead of a thing the build checks afterwards. It
   * checks anyway — the old fill family shipped a pointer that inked 17.5
   * hollow and 16.0 solid, and the glyph jumped a few per cent at the exact
   * moment the eye was on it.
   */
  Cursor: [solid(roundedPolygon(POINTER, POINTER_RADII))],

  /*
   * The bubble needs NO counterpart, and that is a property of the drawing
   * rather than an omission.
   *
   * It is Lucide's — one closed stroked silhouette — so the root flood fills it
   * into a solid bubble and the Notes toggle reports itself for free. The
   * native bubble that briefly stood here did need one, because a native
   * outline is an `evenodd` annulus that states its own fill and a flood passes
   * straight over it. Coming back to Lucide's took the requirement away with it.
   */
}

const lucide = await import("lucide")

/* ── Redrawing a vendored glyph in place ────────────────────────────────────
 *
 * Four edits are allowed to a vendored path, and they reach three glyphs: the
 * note bubble, the down arrow and the open lock.
 * Everything else arrives exactly as the kit or Lucide drew it.
 *
 * REFLECTING, because the kit draws `arrow-up` and no `arrow-down`. Done to the
 * path DATA rather than with a `transform` attribute, which is the tempting
 * one-liner and quietly breaks the build's own eyesight: `inkBox` reads
 * coordinates, not transforms, so a flipped-by-attribute glyph would be
 * measured in its old position and `assertFits` would be checking a drawing
 * nobody renders. (The note bubble was MIRRORED here while it was Lucide's
 * `MessageCircle`, whose tail hung off the left; the kit's already hangs right.)
 *
 * SCALING, because the bubble is a circle of radius 10 on a 24 grid — the
 * largest mark in the toolbar, and 24% wider than anything else in it once the
 * other seven marks were authored to one system. Note this is NOT re-windowing,
 * which the header forbids and `test/icon-cases.mjs` pins. Re-windowing widens
 * the viewBox, which shrinks the drawing AND its stroke together and lands the
 * mark under weight. Scaling the path leaves `stroke-width` alone, so the
 * bubble gets smaller at exactly the weight everything around it is drawn at.
 *
 * DROPPING A SHAPE, for a glyph whose outer ring is redundant on the surface
 * that draws it. No glyph uses it today (the ringless info mark it was built
 * for is gone); it stays because the recipe format is shared.
 *
 * EDITING ONE SEGMENT, by exact text, for the open lock: the kit's shackle arc
 * ends back on the body, and the open state ends it early, swung up and away.
 * An exact-text replace rather than new geometry so the body and the start of
 * the shackle stay the kit's to the digit, and the build fails if the kit's
 * path ever changes under it.
 */

/** Every point in a path, moved by `move`, with arc flags kept honest. */
function transformPath(d, move, { flips = false, scale = 1 } = {}) {
  const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi) ?? []
  const out = []
  let [x, y] = [0, 0]
  let [startX, startY] = [0, 0]
  let index = 0
  let command = ""
  const number = () => Number(tokens[index++])
  const emit = (letter, ...points) => {
    out.push(letter + points.map(([px, py]) => `${round(px)} ${round(py)}`).join(" "))
  }
  const round = (n) => Number(n.toFixed(4))
  const at = (px, py) => move(px, py)
  while (index < tokens.length) {
    if (/[a-zA-Z]/.test(tokens[index])) command = tokens[index++]
    // A repeated coordinate run continues the previous command, and an implicit
    // `M` run continues as `L` — the one rule in the grammar that is not the
    // letter it was written with.
    else if (command === "M") command = "L"
    else if (command === "m") command = "l"
    const relative = command === command.toLowerCase()
    const kind = command.toUpperCase()
    const absolute = (dx, dy) => (relative ? [x + dx, y + dy] : [dx, dy])
    if (kind === "Z") {
      out.push("z")
      ;[x, y] = [startX, startY]
      continue
    }
    if (kind === "M" || kind === "L" || kind === "T") {
      ;[x, y] = absolute(number(), number())
      if (kind === "M") [startX, startY] = [x, y]
      emit(kind, at(x, y))
    } else if (kind === "H") {
      x = relative ? x + number() : number()
      emit("L", at(x, y))
    } else if (kind === "V") {
      y = relative ? y + number() : number()
      emit("L", at(x, y))
    } else if (kind === "C") {
      const c1 = absolute(number(), number())
      const c2 = absolute(number(), number())
      ;[x, y] = absolute(number(), number())
      emit("C", at(...c1), at(...c2), at(x, y))
    } else if (kind === "S" || kind === "Q") {
      const c = absolute(number(), number())
      ;[x, y] = absolute(number(), number())
      emit(kind, at(...c), at(x, y))
    } else if (kind === "A") {
      const [rx, ry] = [number() * scale, number() * scale]
      const rotation = number() * (flips ? -1 : 1)
      const largeArc = number()
      // A mirror reverses which side of the chord the centre falls on, so the
      // sweep flag has to flip with it or the arc bulges the wrong way — the
      // failure looks like a bubble whose tail curls back into itself.
      const sweep = flips ? 1 - number() : number()
      ;[x, y] = absolute(number(), number())
      const [ax, ay] = at(x, y)
      out.push(`A${round(rx)} ${round(ry)} ${round(rotation)} ${largeArc} ${sweep} ${round(ax)} ${round(ay)}`)
    } else {
      throw new Error(`transformPath: unknown command "${command}"`)
    }
  }
  return out.join("")
}

/**
 * Per-glyph edits to a vendored drawing: reflected, scaled about the grid
 * centre, a shape dropped, a segment replaced. All identity by default, so a
 * glyph with no entry is untouched.
 */
const REDRAWN = {
  // The note bubble, pulled in to the size the seven native marks beside it in
  // the toolbar are drawn at. See the block above.
  MessageSquare: { scale: 0.78 },
  // Lucide's sun reaches the grid's edge with its rays (22 of 24); pulled in to
  // the set's 20-unit budget so the theme button is not the largest mark in
  // the toolbar. The moon already inks 20.
  Sun: { scale: 0.9 },
  // Lucide's square FRAMES ink 20, but a closed frame is the heaviest shape a
  // glyph can be (Grid2x2 carries the most ink in the set) and reads larger
  // than an open mark of the same box. Pulled in to the 18 the native frames
  // (padding, panels) are authored at, so a section header's grid toggle no
  // longer outweighs the plus and chevron beside it.
  Grid2x2: { scale: 0.9 },
  Square: { scale: 0.9 },
  Constrain: { scale: 0.9 },
  // The kit's `arrow-up`, pointing down. See the note on the arrows in `MAP`.
  ArrowDown: { flip: true },
  /*
   * The kit's lock with the shackle open: the arc stops 11.5 degrees above the
   * horizontal on the right instead of dropping back into the body — the angle
   * Lucide's `LockOpen` opens to — so the pair differs by that gap and nothing
   * else, and the mark cannot change size on toggle.
   */
  LockOpen: { edit: [["a4.222 4.222 0 0 1 8.444 0v3.333", "a4.222 4.222 0 0 1 8.359-.844"]] },
}

function redraw(name, shapes) {
  const recipe = REDRAWN[name]
  if (!recipe) return shapes
  const { mirror = false, flip = false, scale = 1, drop, keepRadius = false, edit = [] } = recipe
  return transformShapes(applyEdits(name, shapes, drop, edit), { mirror, flip, scale, keepRadius })
}

function applyEdits(name, shapes, drop, edit) {
  if (drop) {
    shapes = shapes.filter((shape) => !drop(shape))
    if (!shapes.length) throw new Error(`redraw: ${name} dropped every shape it had`)
  }
  for (const [from, to] of edit) {
    const hits = shapes.filter(([tag, attrs]) => tag === "path" && attrs.d.includes(from))
    if (hits.length !== 1) throw new Error(`redraw: ${name} expected one path containing "${from}"`)
    shapes = shapes.map(([tag, attrs]) =>
      tag === "path" && attrs.d.includes(from) ? [tag, { ...attrs, d: attrs.d.replace(from, to) }] : [tag, attrs]
    )
  }
  return shapes
}

/** Reflect and/or scale a glyph about the grid centre, by rewriting its geometry. */
function transformShapes(shapes, { mirror = false, flip = false, scale = 1, keepRadius = false } = {}) {
  const mid = GRID / 2
  const move = (x, y) => [
    mid + (mirror ? -1 : 1) * (x - mid) * scale,
    mid + (flip ? -1 : 1) * (y - mid) * scale,
  ]
  // One reflection reverses every arc's sweep; two cancel out.
  const flips = mirror !== flip
  if (!mirror && !flip && scale === 1) return shapes
  return shapes.map(([tag, attrs]) => {
    if (tag === "path") return [tag, { ...attrs, d: transformPath(attrs.d, move, { flips, scale }) }]
    if (tag === "circle") {
      const [cx, cy] = move(Number(attrs.cx), Number(attrs.cy))
      return [tag, { ...attrs, cx, cy, r: keepRadius ? Number(attrs.r) : Number(attrs.r) * scale }]
    }
    if (tag === "rect") {
      const [x0, y0] = move(Number(attrs.x), Number(attrs.y))
      const [x1, y1] = move(Number(attrs.x) + Number(attrs.width), Number(attrs.y) + Number(attrs.height))
      const radii = {}
      for (const key of ["rx", "ry"]) if (key in attrs) radii[key] = Number(attrs[key]) * scale
      return [tag, { ...attrs, ...radii, x: Math.min(x0, x1), y: Math.min(y0, y1), width: Math.abs(x1 - x0), height: Math.abs(y1 - y0) }]
    }
    throw new Error(`redraw: cannot transform <${tag}>`)
  })
}

/*
 * ONE INK BUDGET FOR THE WHOLE SET (the kit's optical check, ADOPTION-GUIDE § 6:
 * "a family that reads uneven gets one ink budget, not per-site sizes").
 *
 * The set is drawn from three hands, and each fills the grid to its own
 * budget: the native lattice family inks 18 of 24 and Lucide about 20 (its
 * circles overshoot to 22, as round marks must), but the kit draws to 22 — its
 * frames fill 22 exactly. Side by side at one rung that made every kit glyph
 * about 10% larger than its neighbours: a trash can and a lock towering over
 * the eye and the grid in the same row.
 *
 * So the kit's drawings are scaled as a FAMILY, by the one factor that maps
 * the kit's 22-unit budget onto this set's 20. Uniformly, not per glyph: a
 * per-glyph ceiling would flatten the kit's own optical sizing — its cross is
 * drawn smaller than its frames on purpose, and `test/icon-cases.mjs` holds
 * that ratio. By rewriting geometry, as `REDRAWN` does, never by re-windowing:
 * a stroked shape keeps its 2-unit stroke; a kit fill, whose weight is baked
 * into its outline, gives up the same 9% of weight it gives up in size, which
 * keeps its mass in line with its smaller neighbours.
 *
 * Not scaled: glyphs the kit ships from Lucide (`plus` — it sits beside
 * Lucide's `Minus` as its drawn partner), hand-tuned `REDRAWN` scales, and the
 * Lucide and native families, which are already drawn to this budget.
 */
const INK_BUDGET = 20
const KIT_BUDGET = 22
const KIT_FROM_LUCIDE = new Set(["plus", "square-plus", "brain-circuit"])

function fitToBudget(name, shapes) {
  const source = MAP[name]
  if (typeof source === "string" || KIT_FROM_LUCIDE.has(source.kit) || REDRAWN[name]?.scale) {
    return { shapes, scale: 1 }
  }
  const scale = INK_BUDGET / KIT_BUDGET
  return { shapes: transformShapes(shapes, { scale }), scale }
}

/**
 * The rules every vendored shape is held to, whichever set it came from.
 *
 * Only `path`, `circle` and `rect`, and nothing passed through unrecognised.
 * Not fussiness: `assertFits` has to measure every shape to know whether its
 * stroke clears the viewBox, and a tag it cannot measure would be silently
 * excluded from that check — a glyph clipping at the `marker` rung with nothing
 * to say so. React spelling and unresolved custom properties are both SILENT in
 * the DOM: `setAttribute` accepts any name, and a `var()` in an attribute value
 * never resolves. Both have shipped from a vendored set before.
 */
function checkShape(label, tag, attrs) {
  if (!["path", "circle", "rect"].includes(tag)) {
    throw new Error(`${label}: <${tag}> is not a shape this renderer draws`)
  }
  for (const [key, value] of Object.entries(attrs)) {
    if (/[A-Z]/.test(key)) throw new Error(`${label}: attribute "${key}" is camelCase`)
    if (String(value).includes("var(--")) {
      throw new Error(`${label}: attribute "${key}" carries an unresolved custom property`)
    }
  }
  return [tag, attrs]
}

function readLucideGlyph(lucideName) {
  const shapes = lucide[lucideName]
  if (!Array.isArray(shapes)) throw new Error(`lucide has no icon named ${lucideName}`)
  return shapes.map(([tag, attrs]) => checkShape(`lucide/${lucideName}`, tag, attrs))
}

/** The attributes of a kit shape that are GEOMETRY, and so survive vendoring. */
const KIT_GEOMETRY = ["d", "cx", "cy", "r", "x", "y", "width", "height", "rx", "ry"]
/** Paint the kit states per shape, which is resolved rather than copied. */
const KIT_PAINT = ["fill", "stroke", "fill-rule", "clip-rule"]
/** Stroke styling the root decides for every glyph, so a shape's copy is dropped. */
const KIT_STROKE_STYLE = ["stroke-width", "stroke-linecap", "stroke-linejoin", "stroke-miterlimit"]

/**
 * One kit glyph, read from its SVG file into the renderer's shape records.
 *
 * The kit's SVGs are two kinds of drawing in one set, and each is mapped onto
 * how `drawIcon` paints:
 *
 *   - A STROKED shape keeps only its geometry and inherits the root's paint —
 *     `stroke="currentColor"` at the rung's width, `fill="none"` on the outline
 *     weight and `currentColor` on the filled one. That inheritance is what
 *     lets a toggle flood the kit's bubble, and it is why the shape's own
 *     `stroke-width="var(--icon-stroke-width, 2)"` is dropped rather than kept:
 *     one weight per glyph is the root's to set (see `STROKE_FOR_SIZE`).
 *
 *   - A FILLED shape states `fill="currentColor" stroke="none"`, the same
 *     convention the native family uses: its weight is the outline it traces,
 *     and a root stroke on top would draw it a unit heavier on every side.
 *
 * Anything else — a shape both filled and stroked, a stroke that is not the
 * kit's 2, a transform, an opacity — throws, because each would be a drawing
 * this renderer silently gets wrong.
 */
function readKitGlyph(kitName) {
  const label = `foundations/${kitName}`
  const file = path.join(KIT_DIR, `${kitName}.svg`)
  if (!fs.existsSync(file)) throw new Error(`${label}: no ${path.relative(root, file)}`)
  const text = fs.readFileSync(file, "utf8")
  const attrsOf = (source) => Object.fromEntries([...source.matchAll(/([\w:-]+)="([^"]*)"/g)].map((m) => [m[1], m[2]]))
  const inherited = [{}]
  const shapes = []
  for (const [, close, tag, source, selfClosing] of text.matchAll(/<(\/?)([a-z][\w-]*)([^>]*?)(\/?)>/gi)) {
    if (close) {
      if (tag === "g" || tag === "svg") inherited.pop()
      continue
    }
    const attrs = attrsOf(source)
    const paint = { ...inherited.at(-1) }
    for (const key of [...KIT_PAINT, ...KIT_STROKE_STYLE]) if (key in attrs) paint[key] = attrs[key]
    if (tag === "svg") {
      if (attrs.viewBox !== `0 0 ${GRID} ${GRID}`) throw new Error(`${label}: viewBox is ${attrs.viewBox}`)
      inherited.push(paint)
      continue
    }
    if (tag === "g") {
      for (const key of Object.keys(attrs)) {
        if (![...KIT_PAINT, ...KIT_STROKE_STYLE].includes(key)) throw new Error(`${label}: <g ${key}> is not supported`)
      }
      if (!selfClosing) inherited.push(paint)
      continue
    }
    for (const key of Object.keys(attrs)) {
      if (![...KIT_GEOMETRY, ...KIT_PAINT, ...KIT_STROKE_STYLE].includes(key)) {
        throw new Error(`${label}: <${tag} ${key}> is not supported`)
      }
    }
    const stroked = paint.stroke !== undefined && paint.stroke !== "none"
    const filled = paint.fill !== undefined && paint.fill !== "none"
    if (stroked === filled) throw new Error(`${label}: a <${tag}> is ${stroked ? "both filled and stroked" : "unpainted"}`)
    if (stroked) {
      const width = String(paint["stroke-width"] ?? "2").match(/^(?:var\(--icon-stroke-width,\s*)?([\d.]+)\)?$/)
      if (!width || Number(width[1]) !== 2) {
        throw new Error(`${label}: stroke-width ${paint["stroke-width"]} is not the kit's 2`)
      }
    }
    const geometry = Object.fromEntries(KIT_GEOMETRY.filter((key) => key in attrs).map((key) => [key, attrs[key]]))
    shapes.push(
      checkShape(
        label,
        tag,
        stroked
          ? geometry
          : {
              ...geometry,
              ...(paint["fill-rule"] ? { "fill-rule": paint["fill-rule"] } : {}),
              fill: "currentColor",
              stroke: "none",
            }
      )
    )
  }
  if (!shapes.length) throw new Error(`${label}: draws nothing`)
  return shapes
}

/** One glyph's shapes from whichever source its MAP entry names. */
const readGlyph = (source) => (typeof source === "string" ? readLucideGlyph(source) : readKitGlyph(source.kit))
const originOf = (source) => (typeof source === "string" ? `lucide/${source}` : `foundations/${source.kit}`)

/** Where a cubic turns around — the roots of its derivative, solved not sampled. */
function derivativeRoots(p0, p1, p2, p3) {
  const a = -p0 + 3 * p1 - 3 * p2 + p3
  const b = 2 * (p0 - 2 * p1 + p2)
  const c = p1 - p0
  const roots = []
  if (Math.abs(a) < 1e-12) {
    if (Math.abs(b) > 1e-12) roots.push(-c / b)
  } else {
    const discriminant = b * b - 4 * a * c
    if (discriminant >= 0) {
      const r = Math.sqrt(discriminant)
      roots.push((-b + r) / (2 * a), (-b - r) / (2 * a))
    }
  }
  return roots.filter((t) => t > 0 && t < 1)
}

/** An elliptical arc's points, via the SVG 1.1 F.6.5 endpoint parameterisation. */
function arcPoints(x1, y1, rx, ry, largeArc, sweep, x2, y2, push) {
  rx = Math.abs(rx)
  ry = Math.abs(ry)
  if (!rx || !ry) {
    push(x2, y2)
    return
  }
  const dx2 = (x1 - x2) / 2
  const dy2 = (y1 - y2) / 2
  const lambda = (dx2 * dx2) / (rx * rx) + (dy2 * dy2) / (ry * ry)
  if (lambda > 1) {
    const scale = Math.sqrt(lambda)
    rx *= scale
    ry *= scale
  }
  const numerator = rx * rx * ry * ry - rx * rx * dy2 * dy2 - ry * ry * dx2 * dx2
  const denominator = rx * rx * dy2 * dy2 + ry * ry * dx2 * dx2
  const coefficient = (largeArc === sweep ? -1 : 1) * Math.sqrt(Math.max(0, numerator / denominator))
  const cxp = (coefficient * rx * dy2) / ry
  const cyp = (-coefficient * ry * dx2) / rx
  const cx = cxp + (x1 + x2) / 2
  const cy = cyp + (y1 + y2) / 2
  const angle = (ux, uy, vx, vy) => {
    const dot = ux * vx + uy * vy
    const length = Math.hypot(ux, uy) * Math.hypot(vx, vy)
    const sign = ux * vy - uy * vx < 0 ? -1 : 1
    return sign * Math.acos(Math.min(1, Math.max(-1, dot / length)))
  }
  const ux = (dx2 - cxp) / rx
  const uy = (dy2 - cyp) / ry
  const vx = (-dx2 - cxp) / rx
  const vy = (-dy2 - cyp) / ry
  const start = angle(1, 0, ux, uy)
  let swept = angle(ux, uy, vx, vy)
  if (!sweep && swept > 0) swept -= 2 * Math.PI
  if (sweep && swept < 0) swept += 2 * Math.PI
  // Sampled rather than solved for the four axis extrema: an arc's box depends
  // on which quadrant boundaries it crosses, and a tenth of a degree is far
  // inside the tolerance `assertFits` works to.
  const steps = Math.max(64, Math.ceil(Math.abs(swept) / (Math.PI / 1800)))
  for (let step = 0; step <= steps; step += 1) {
    const t = start + (swept * step) / steps
    push(cx + rx * Math.cos(t), cy + ry * Math.sin(t))
  }
}

/** Every point a `d` attribute reaches, curve extrema included. */
function walkPath(d, push, label) {
  const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) ?? []
  let i = 0
  let command = ""
  let x = 0
  let y = 0
  let startX = 0
  let startY = 0
  let controlX = 0
  let controlY = 0
  const num = () => Number.parseFloat(tokens[i++])
  const cubic = (x1, y1, x2, y2, x3, y3) => {
    const at = (p0, p1, p2, p3, t) => {
      const u = 1 - t
      return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3
    }
    for (const t of [...derivativeRoots(x, x1, x2, x3), ...derivativeRoots(y, y1, y2, y3)]) {
      push(at(x, x1, x2, x3, t), at(y, y1, y2, y3, t))
    }
    push(x3, y3)
    controlX = x2
    controlY = y2
    x = x3
    y = y3
  }

  while (i < tokens.length) {
    if (/[a-zA-Z]/.test(tokens[i])) command = tokens[i++]
    const relative = command === command.toLowerCase()
    const kind = command.toUpperCase()
    const rx = (v) => (relative ? x + v : v)
    const ry = (v) => (relative ? y + v : v)
    // Reset the smooth-curve reflection on anything that is not itself a curve,
    // per the grammar — otherwise an `s` after a line mirrors a control point
    // from three commands ago.
    if (!"CSQT".includes(kind)) {
      controlX = x
      controlY = y
    }
    if (kind === "M") {
      x = rx(num())
      y = ry(num())
      startX = x
      startY = y
      push(x, y)
      // An implicit run after a moveto is a lineto, per the grammar.
      command = relative ? "l" : "L"
    } else if (kind === "L") {
      x = rx(num())
      y = ry(num())
      push(x, y)
    } else if (kind === "H") {
      x = rx(num())
      push(x, y)
    } else if (kind === "V") {
      y = ry(num())
      push(x, y)
    } else if (kind === "C") {
      cubic(rx(num()), ry(num()), rx(num()), ry(num()), rx(num()), ry(num()))
    } else if (kind === "S") {
      cubic(2 * x - controlX, 2 * y - controlY, rx(num()), ry(num()), rx(num()), ry(num()))
    } else if (kind === "Q" || kind === "T") {
      const qx = kind === "T" ? 2 * x - controlX : rx(num())
      const qy = kind === "T" ? 2 * y - controlY : ry(num())
      const endX = rx(num())
      const endY = ry(num())
      // Degree-elevated to a cubic, so one solver answers for both.
      cubic(
        x + (2 / 3) * (qx - x),
        y + (2 / 3) * (qy - y),
        endX + (2 / 3) * (qx - endX),
        endY + (2 / 3) * (qy - endY),
        endX,
        endY
      )
      controlX = qx
      controlY = qy
    } else if (kind === "A") {
      const arcRx = num()
      const arcRy = num()
      num() // x-axis-rotation; zero throughout Lucide and the kit
      const largeArc = num()
      const sweep = num()
      // Minified SVG may pack flags against the next number ("0 011.5"), which
      // this tokenizer would read as one. A flag that is not 0 or 1 is that.
      if ((largeArc !== 0 && largeArc !== 1) || (sweep !== 0 && sweep !== 1)) {
        throw new Error(`${label}: packed arc flags this tokenizer cannot read`)
      }
      const endX = rx(num())
      const endY = ry(num())
      arcPoints(x, y, arcRx, arcRy, largeArc, sweep, endX, endY, push)
      x = endX
      y = endY
    } else if (kind === "Z") {
      x = startX
      y = startY
      push(x, y)
    } else {
      // Loudly, not silently: an unmeasured command reports a box that is too
      // small, and `assertFits` would then wave through a glyph that clips.
      throw new Error(`${label}: unknown path command "${command}"`)
    }
  }
}

/** The box a glyph's geometry occupies on the grid, before any stroke. */
function inkBox(shapes, label) {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  const push = (x, y) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`${label}: non-finite point`)
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  }
  for (const [tag, attrs] of shapes) {
    const value = (key) => Number(attrs[key])
    if (tag === "path") walkPath(attrs.d, push, label)
    else if (tag === "rect") {
      push(value("x"), value("y"))
      push(value("x") + value("width"), value("y") + value("height"))
    } else if (tag === "circle") {
      push(value("cx") - value("r"), value("cy") - value("r"))
      push(value("cx") + value("r"), value("cy") + value("r"))
    }
  }
  if (!Number.isFinite(minX)) throw new Error(`${label}: inks nothing`)
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY }
}

/**
 * The box a glyph actually INKS — geometry plus the half-stroke outside it.
 *
 * `inkBox` deliberately stops at the geometry, because `assertFits` adds the
 * half-stroke of the rung it is checking. Comparing an OUTLINE against a FILLED
 * counterpart needs the other number: the outline's whole signal is a stroke
 * centred on its path, so measuring the path alone reports a tick as 4 units
 * tall when it reads as 6, and a counterpart authored to match what the eye
 * sees would be rejected for matching it.
 *
 * A shape that declares `stroke: none` is fill-only and contributes its
 * geometry unexpanded, which is how an authored handle sitting on a stroked
 * rail is measured correctly rather than as if it were outlined too.
 */
function paintedBox(shapes, label) {
  const half = STROKE_FOR_SIZE[GRID] / 2
  const boxes = shapes.map(([tag, attrs]) => {
    const box = inkBox([[tag, attrs]], label)
    const pad = attrs.stroke === "none" ? 0 : half
    return { minX: box.minX - pad, minY: box.minY - pad, maxX: box.maxX + pad, maxY: box.maxY + pad }
  })
  const minX = Math.min(...boxes.map((box) => box.minX))
  const minY = Math.min(...boxes.map((box) => box.minY))
  const maxX = Math.max(...boxes.map((box) => box.maxX))
  const maxY = Math.max(...boxes.map((box) => box.maxY))
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY }
}

/**
 * No stroke may push a glyph's ink outside the grid it is drawn in.
 *
 * Half a stroke lies outside the path it is centred on, so a STROKED shape
 * needs half the heaviest stroke that renders — the widest rung plus the
 * selected-state bump — of clearance on every side. A FILLED shape
 * (`stroke: none`) inks exactly its geometry and needs only to stay inside the
 * grid; the kit draws its fills out to 1 unit from the edge, which is fine for
 * a fill and would clip a stroke. So clearance is measured per shape, against
 * what that shape actually paints.
 *
 * Lucide and the kit both draw to a padding guideline, but "in practice" is a
 * measurement, not a promise, and a glyph swapped into the map later may be
 * drawn tighter. This makes that a build failure rather than a clipped corner
 * somebody eventually notices in a screenshot. Returns the smallest spare
 * margin, for the report the script prints.
 */
function assertFits(shapes, label) {
  const heaviest = (Math.max(...Object.values(STROKE_FOR_SIZE)) + SELECTED_STROKE_BUMP) / 2
  let spare = Infinity
  for (const shape of shapes) {
    const box = inkBox([shape], label)
    const clearance = Math.min(box.minX, box.minY, GRID - box.maxX, GRID - box.maxY)
    const needs = shape[1].stroke === "none" ? 0 : heaviest
    if (clearance < needs) {
      throw new Error(
        `${label}: a <${shape[0]}> has only ${clearance.toFixed(3)} units of clearance inside the ` +
          `${GRID} grid, but ${needs ? `its heaviest stroke needs ${needs}` : "a fill needs 0"} — it would clip`
      )
    }
    spare = Math.min(spare, clearance - needs)
  }
  return spare
}

/*
 * A name may be drawn HERE or vendored, never both.
 *
 * Twenty-one of the native glyphs deliberately reuse a name the map already
 * had — the six aligns, the seven text marks, the four padding sides, the two
 * distributes, and then the toolbar's two panel toggles —
 * because each of those names is called from ONE surface, so replacing the
 * artwork under it changes the drawing everywhere it appears and churns no call
 * site. `ArrowUp`, `ArrowDown` and `ArrowRight` are NOT among them: those are
 * drawn in the layers tree, the app chooser and the layer menu too, and
 * swapping a shared mark to suit one panel is how a set stops being a set. The
 * arrange strip gets its own four names instead, and so do the toolbar's cross,
 * its two history arrows and its note bubble — `X` alone is drawn seven other
 * places, most of them at `icon.marker`, which is a rung this family may not be
 * drawn at.
 *
 * The collision check is the guard on that reasoning: a native glyph that does
 * NOT displace a mapped one is either a new name or a typo, and the two look
 * identical in a diff.
 */
const names = [...new Set([...Object.keys(MAP), ...Object.keys(NATIVE)])].sort()

/*
 * A counterpart has to belong to a glyph that exists.
 *
 * `FILLED` is keyed by editor name like everything else, and a typo there does
 * not fail anything on its own — it emits a second drawing nobody reads, and
 * the toggle it was written for keeps drawing its outline in both states. That
 * is the failure this change exists to remove, so it is refused at build time.
 */
for (const name of Object.keys(FILLED)) {
  if (!names.includes(name)) throw new Error(`FILLED has ${name}, which is not a glyph in the set`)
}

const entries = names.map((name) => {
  const vendored = NATIVE[name] ? null : fitToBudget(name, redraw(name, readGlyph(MAP[name])))
  const shapes = NATIVE[name] ?? vendored.shapes
  const origin = NATIVE[name]
    ? "native"
    : `${originOf(MAP[name])}${vendored.scale < 1 ? `, fitted ×${vendored.scale.toFixed(3)}` : ""}`
  const box = inkBox(shapes, `${name} (${origin})`)
  const clearance = assertFits(shapes, `${name} (${origin})`)
  /*
   * An authored counterpart is measured by the same two rules as the outline,
   * and then against the outline itself.
   *
   * The pair has to be the same SIZE, because the two are drawn in the same
   * square a frame apart: a counterpart even a unit larger makes the glyph jump
   * at the exact moment the eye is on it, which is the failure the old
   * two-weight family shipped. `test/icon-cases.mjs` asserts this from the DOM
   * as well — here so a bad counterpart never reaches the file at all.
   */
  const filled = FILLED[name]
  if (!filled) return { name, origin, shapes, box, clearance }
  const filledBox = inkBox(filled, `${name} (filled)`)
  assertFits(filled, `${name} (filled)`)
  const painted = paintedBox(shapes, `${name} (${origin})`)
  const filledPainted = paintedBox(filled, `${name} (filled)`)
  const spread = Math.max(
    Math.abs(painted.width - filledPainted.width),
    Math.abs(painted.height - filledPainted.height)
  )
  if (spread > 1) {
    throw new Error(
      `${name}: the filled counterpart inks ` +
        `${filledPainted.width.toFixed(1)}x${filledPainted.height.toFixed(1)} against the ` +
        `outline's ${painted.width.toFixed(1)}x${painted.height.toFixed(1)} — ` +
        `the mark would resize on press`
    )
  }
  return { name, origin, shapes, box, clearance, filled, filledBox }
})

const version = JSON.parse(
  fs.readFileSync(path.join(root, "node_modules", "lucide", "package.json"), "utf8")
).version
const kitCount = new Set(Object.values(MAP).filter((source) => typeof source !== "string").map((source) => source.kit)).size

const serialiseShapes = (shapes) =>
  shapes
    .map(([tag, attrs]) => {
      const pairs = Object.entries(attrs)
        .map(([key, value]) => `        ${JSON.stringify(key)}: ${JSON.stringify(value)},`)
        .join("\n")
      return `    [\n      ${JSON.stringify(tag)},\n      {\n${pairs}\n      },\n    ],`
    })
    .join("\n")

const body = entries
  .map(
    ({ name, origin, shapes, box, filled, filledBox }) => `  ${JSON.stringify(name)}: {
    // ${origin} — inks ${box.width.toFixed(1)}x${box.height.toFixed(1)} of ${GRID}
    shapes: [
${serialiseShapes(shapes)}
    ],${
      filled
        ? `
    // filled counterpart — inks ${filledBox.width.toFixed(1)}x${filledBox.height.toFixed(1)} of ${GRID}
    filled: [
${serialiseShapes(filled)}
    ],`
        : ""
    }
  },`
  )
  .join("\n")

const strokeTable = Object.entries(STROKE_FOR_SIZE)
  .map(([size, width]) => `  ${size}: ${width},`)
  .join("\n")

const file = `/**
 * The editor chrome's glyph set.
 *
 * GENERATED by \`tools/build-icons.mjs\` — do not hand-edit. To swap a glyph,
 * change the mapping in that script and re-run it. Sources, in order of
 * preference: the design foundations kit (\`tools/icons/foundations\`, ${kitCount}
 * drawings) for every role the kit has a glyph for; Lucide ${version}
 * (https://lucide.dev/icons, ISC) for the editor's own subjects; and a native
 * lattice family authored in the script.
 *
 * Every glyph sits on one ${GRID}x${GRID} grid, and four things follow, each of which
 * used to be the opposite here:
 *
 *   - ONE drawing per glyph, with a fill painted over it rather than a second
 *     drawing. Lucide ships no filled counterparts, and flooding an outline
 *     with \`currentColor\` reads only for a closed silhouette — but every mark a
 *     TOGGLE in this chrome draws is closed, so the pointer, the bubble and the
 *     layer stack all fill correctly from their own paths and cannot drift in
 *     size from the outline they replace. A row or a tab that reports itself
 *     \`aria-selected\` still gets the heavier stroke from the stylesheet (see
 *     \`css/icons.ts\`), because a list has its neighbours on screen to be
 *     compared against and a lone toolbar button does not.
 *
 *   - A \`filled\` array, on the few glyphs a flood cannot serve. A mark made
 *     only of open runs has no area to flood — \`SlidersHorizontal\` came out
 *     identical in both states — so those carry an authored counterpart, held
 *     by the generator to the same ink extent as their outline.
 *
 *   - NO per-glyph window. Nothing is re-fitted by widening its viewBox: that
 *     scales a stroke along with the drawing and lands it under weight, trading
 *     a size error for a weight error. The extents are deliberately uneven — a
 *     chevron inks 12 of the grid and a layer stack 20 — because that is
 *     each source's own optical sizing.
 *
 *   - ONE stroke width, the kit's 2, at every size. The kit's filled glyphs
 *     carry that weight baked into their outlines, so a stroke compensated per
 *     size would split the family at the small rungs. See \`STROKE_FOR_SIZE\`.
 */

export type IconNode = [
  tag: string,
  attrs: Record<string, string | number>,
  children?: IconNode[],
]

/**
 * One glyph: its shapes, on the shared 24 grid. A shape with \`stroke: none\` is
 * a fill whose weight is its outline; every other shape strokes at the root's
 * width.
 *
 * \`filled\` is the counterpart drawn for the marks a flood cannot express — see
 * the header. Absent, which is the usual case, the filled weight paints the
 * same shapes with \`currentColor\`, so the two states cannot be different marks.
 */
export interface IconData {
  shapes: IconNode[]
  filled?: IconNode[]
}

/**
 * Which weight a glyph is asked for.
 *
 * \`auto\` is the outline, and lets the stylesheet add the extra stroke when the
 * control reports itself selected in a list of its peers — which is how "on
 * means heavier" stays one rule rather than ${entries.length} call sites.
 *
 * \`filled\` is what a TOGGLE asks for while it is on. A stroke half a unit
 * heavier is a relative signal: legible beside the same glyph in its off state,
 * and unreadable on a button sitting on its own, which is exactly the case a
 * mode indicator has to answer. Solid or hollow needs nothing to compare
 * against.
 */
export type IconWeight = "outline" | "filled" | "auto"

/**
 * The only sizes a glyph may be drawn at: the kit's six icon roles in
 * \`tokens.icon\` — marker 12, inline 14, action 16, chrome 18, header 20,
 * feature 24.
 *
 * A union rather than \`number\`, so a size off the ramp fails to compile instead
 * of shipping. The set drifted to seven sizes once — 10, 12, 13, 14, 16, 18 and
 * 20, each added at one call site by someone reaching for the value that looked
 * right next to the text beside it. Nothing caught it, because every one of
 * those calls was locally reasonable.
 *
 * Call sites should pass \`tokens.icon.action\` and friends rather than the number,
 * which is what makes the ramp readable at the point of use; this type is the
 * backstop for the ones that do not.
 */
export type IconSize = ${Object.keys(STROKE_FOR_SIZE).join(" | ")}

/**
 * The stroke each rung wears, in grid units: the kit's 2 at every rung.
 *
 * It used to be compensated per size, heavier on the small rungs. Two things
 * retired that. The kit's filled glyphs — chevron-down, x, copy, arrow-up —
 * carry a 2-unit weight baked into their outlines that no attribute can
 * thicken, so compensating the stroked half would split the set at exactly
 * the rungs where the two halves sit side by side. And the rung that needed
 * rescuing is gone: at the kit's floor of 12px, 2 units is exactly 1 CSS pixel,
 * two whole device pixels at 2x. Rendered thickness rises 1.0 to 2.0px across
 * the ramp — the same mark enlarged.
 *
 * \`tools/build-icons.mjs\` measures every stroked shape's clearance inside the
 * grid and fails the build if the heaviest stroke that renders would clip one.
 */
const STROKE_FOR_SIZE: Record<IconSize, number> = {
${strokeTable}
}

/**
 * The stroke width, published as a custom property the stylesheet can build on.
 *
 * Written ALONGSIDE the \`stroke-width\` attribute rather than instead of it. The
 * attribute is the value that is always right, including with no stylesheet at
 * all; the property is what lets one CSS rule say "pressed is half a unit
 * heavier" without knowing which rung the glyph was drawn at.
 */
export const ICON_STROKE_VARIABLE = "--de-icon-stroke"

/**
 * What marks an \`<svg>\` as one of OURS.
 *
 * The state rule in \`css/icons.ts\` leans on the custom property above, and
 * without this it would also reach two kinds of \`<svg>\` it has no business
 * restyling: the host's own icons, which \`drawHostIcon\` renders inside the
 * inspector exactly as their author drew them, and any \`<svg>\` the app being
 * edited happens to place inside a selected row. Both would pick up the
 * property's fallback and get re-weighted on selection — the editor quietly
 * redrawing someone else's artwork.
 */
export const ICON_MARKER_ATTRIBUTE = "data-de-glyph"

const ICONS = {
${body}
} as const satisfies Record<string, IconData>

export type IconName = keyof typeof ICONS

export const ICON_NAMES = Object.keys(ICONS) as IconName[]

/**
 * The glyphs authored on the native 16 lattice rather than taken from Lucide.
 *
 * Exported so the rung rule can be CHECKED rather than just written down: these
 * land on whole device pixels only at a size that is a multiple of 8, so they
 * may be drawn at \`icon.action\` (16) or \`icon.feature\` (24), never at marker
 * 12, inline 14, chrome 18 or header 20. \`test/icon-cases.mjs\` reads this list
 * and greps the source for a call that breaks it.
 *
 * A comment could not carry this. The mistake it prevents — reaching for
 * \`tokens.icon.marker\` because the text beside the glyph is 12px — is locally
 * reasonable every single time, and the result looks fine until it is set
 * beside a glyph drawn at 16.
 */
export const NATIVE_ICON_NAMES = ${JSON.stringify(Object.keys(NATIVE).sort())} as const satisfies readonly IconName[]

/** The rungs a native glyph renders crisply at — every multiple of 8 on the ramp. */
export const NATIVE_ICON_SIZES = [16, 24] as const satisfies readonly IconSize[]

const SVG_NS = "http://www.w3.org/2000/svg"

function build(node: IconNode): SVGElement {
  const [tag, attrs, children] = node
  const element = document.createElementNS(SVG_NS, tag)
  for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, String(value))
  for (const child of children ?? []) element.append(build(child))
  return element
}

/**
 * Draw one glyph from its data.
 *
 * Exported so the host's own icon set — served by the loopback \`/icons\` route
 * and offered as variants in the inspector — is drawn by the same rules as
 * these. Two renderers would be two answers to "how big is a glyph", and only
 * one of them would be right.
 */
export function drawIcon(data: IconData, size: IconSize = 16, weight: IconWeight = "auto"): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg")
  svg.setAttribute("width", String(size))
  svg.setAttribute("height", String(size))
  svg.setAttribute("viewBox", "0 0 ${GRID} ${GRID}")
  // The fill is opt-in and the outline is what \`auto\` means: a flood reads only
  // on a closed silhouette, so a caller asks for it knowing which mark it holds.
  svg.setAttribute("fill", weight === "filled" ? "currentColor" : "none")
  svg.setAttribute("stroke", "currentColor")
  const stroke = STROKE_FOR_SIZE[size]
  svg.setAttribute("stroke-width", String(stroke))
  svg.style.setProperty(ICON_STROKE_VARIABLE, String(stroke))
  svg.setAttribute("stroke-linecap", "round")
  svg.setAttribute("stroke-linejoin", "round")
  svg.setAttribute(ICON_MARKER_ATTRIBUTE, "")
  svg.setAttribute("aria-hidden", "true")
  // The counterpart when the glyph has one, its own shapes otherwise. A mark
  // whose runs are all open floods to nothing, and a toggle drawing it would
  // report the same picture in both states.
  const shapes = weight === "filled" && data.filled ? data.filled : data.shapes
  for (const node of shapes) svg.append(build(node))
  return svg
}

/**
 * One glyph, sized and decorative.
 *
 * Colour comes from \`currentColor\`, never a token: the same mark is drawn on a
 * rest row, a hovered row and a filled selected row, and only the caller knows
 * which.
 */
export function icon(name: IconName, size: IconSize = 16, weight: IconWeight = "auto"): SVGSVGElement {
  const svg = drawIcon(ICONS[name], size, weight)
  /*
   * THE MARKER CARRIES THE NAME NOW, where it used to carry an empty string.
   *
   * Every rule that reads it is written \`svg[data-de-glyph]\`, which matches on
   * presence and is unaffected. What the value adds is the ability to say
   * something about ONE mark — and there is exactly one thing worth saying,
   * which is the optical correction for \`Cursor\` in \`css/icons.ts\`.
   *
   * Set here and not in \`drawIcon\`, because \`drawIcon\` also renders the HOST
   * app's own icons, whose names belong to a set this package did not author. A
   * rule written against one of ours must not be able to reach one of theirs.
   */
  svg.setAttribute(ICON_MARKER_ATTRIBUTE, name)
  return svg
}

/**
 * A glyph from the HOST's own icon set, which is a different set of rules.
 *
 * The app being edited ships its own icons, served by the loopback \`/icons\`
 * route so the inspector can offer one in place of another. Those are drawn the
 * way their author drew them: one weight, whatever grid and stroke they use,
 * nothing normalised. They must not be squeezed into the chrome's shape — this
 * editor does not get to decide that someone else's icon is a stroke family, or
 * to re-window a glyph it is about to write into their source. A second, smaller
 * renderer is the honest way to say that.
 */
export interface HostIconData {
  nodes: IconNode[]
  rootFill: string
  rootStroke?: string
}

export function drawHostIcon(data: HostIconData, size: IconSize = 16): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg")
  svg.setAttribute("width", String(size))
  svg.setAttribute("height", String(size))
  svg.setAttribute("viewBox", "0 0 ${GRID} ${GRID}")
  svg.setAttribute("fill", data.rootFill === "none" ? "none" : "currentColor")
  if (data.rootStroke) {
    svg.setAttribute("stroke", "currentColor")
    svg.setAttribute("stroke-width", "2")
    svg.setAttribute("stroke-linecap", "round")
    svg.setAttribute("stroke-linejoin", "round")
  }
  svg.setAttribute("aria-hidden", "true")
  for (const node of data.nodes) svg.append(build(node))
  return svg
}
`

if (process.argv.includes("--check")) {
  const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf8") : ""
  if (current !== file) {
    console.error("STALE src/core/icons.ts — run `node tools/build-icons.mjs`")
    process.exit(1)
  }
  console.log(`PASS src/core/icons.ts matches the kit + lucide ${version} (${names.length} glyphs)`)
  process.exit(0)
}

fs.writeFileSync(OUT, file)
const tightest = entries.reduce((a, b) => (a.clearance < b.clearance ? a : b))
console.log(
  `Wrote ${path.relative(root, OUT)} — ${names.length} glyphs ` +
    `(${entries.filter((entry) => entry.origin.startsWith("foundations/")).length} from the kit, ` +
    `${entries.filter((entry) => entry.origin.startsWith("lucide/")).length} from lucide ${version}, ` +
    `${entries.filter((entry) => entry.origin === "native").length} native)\n` +
    `  least spare clearance: ${tightest.name} at ${tightest.clearance.toFixed(3)} units`
)
