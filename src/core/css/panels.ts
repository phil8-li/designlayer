/**
 * Panel shells, section chrome, and the shared field/select primitives.
 *
 * ## The rank ladder every surface in the chrome is written against
 *
 * Four ranks, and INK carries them. Weight marks only the top rank and the
 * chosen one. Size marks nothing, because it cannot: the type scale's three
 * rungs are 11 / 10 / 9px and the two below `body` are under the 12px floor,
 * so there is exactly one usable size in the whole shell.
 *
 *   1 heading    `text` (a sub-heading: `textMuted`)  + `weightSection`
 *   2 value      `text`                               + `weightBody`,
 *                                                       `weightValue` when it
 *                                                       is the chosen one
 *   3 control    `textMuted`                          + `weightBody`
 *   4 secondary  `textDim`                            + `weightBody`
 *
 * One carve-out, and it is the one the layer tree already argued for: a
 * GLYPH-ONLY control rests at rank 4 and steps to `text` on hover. A column of
 * row actions is texture until you reach for it; a column of rank-3 glyphs is a
 * second list competing with the names beside them.
 *
 * On the mid-slate ground the ladder did not have to be stated, because the
 * ground was light enough that a rung either side of the right one still read.
 * On near-black the distances compress at the dim end — `textDim` and a faded
 * `textDim` are three points of lightness apart — so the ranks have to be
 * assigned rather than felt.
 *
 * ## And the hover rule, since hover is a rank too
 *
 * Hover lifts ONE rung from the element's own resting ground: a row on `bg`
 * goes to `bgHoverQuiet`, a row on `bgRaised` (a popover) goes to `bgHover`, a
 * field in its `bgSunken` well goes to `bgHoverQuiet`. The exception is size —
 * anything 24px or under takes `bgHover` whatever it rests on, because the
 * same value step over 18 square pixels is not the same signal as over a
 * 232px band.
 */

import { tokens as t } from "../tokens"

/**
 * THE CONTROL RADIUS, and the one number this file changed most widely.
 *
 * Measured off Figma's own right panel at 2x (see `.harness/figma-spec.md`):
 * every control in it — field, track, chip, alignment pad, action cell — draws
 * a corner whose arc spans about seven device pixels, so 3.5px, and `radius.sm`
 * is the step on our ramp that lands there. The chrome was drawing `radius.md`
 * on all of them, twice as round, which is the single difference that most made
 * a column of our controls read as a different product beside a column of
 * Figma's.
 *
 * Named rather than written out at each rule because it is now asserted in
 * three places at once: the field, the segmented track, and the segment riding
 * inside it have to agree, or the chip stops being parallel to the rail it sits
 * in.
 *
 * The segmented control no longer declares a `nest()`. Figma's track carries NO
 * padding — the selected chip runs flush to the rail's own edge, sharing its
 * curve exactly (measured: the chip's border begins at the same device column
 * the track does). Two curves with nothing between them are concentric at an
 * inset of zero, which is not a nest; it is the same corner drawn twice. The
 * old 4px rail is what forced the segments down to `radius.sm` inside a
 * `radius.md` track, and with both now at `sm` there is no offset left to
 * compute.
 */
/**
 * The corner every INPUT-SHAPED control in the chrome draws.
 *
 * Exported because four controls outside this file were drawing `radius.md`
 * instead — the token field, the layers filter, the Controls filter and the
 * library field — so a filter box and the field two inches below it in the same
 * panel had visibly different corners. Each was independently reasonable and
 * the set was not a system.
 *
 * Cards and popovers keep `radius.lg` / `radius.xl`; this is the control rung
 * alone, and importing the constant rather than re-typing `t.radius.sm` is what
 * makes the next move of the rung reach all ten call sites.
 */
export const CONTROL_RADIUS = t.radius.sm

/**
 * THE CURSOR RULE, stated once because it was being decided per file.
 *
 * Every ENABLED interactive control in this chrome takes `cursor: pointer`.
 * `cursor: default` is for a disabled state and for surfaces that are not
 * controls at all. There is no third category.
 *
 * It needed saying because the split had grown to 40 rules against 15 with no
 * principle between them, and the disagreements were between neighbours rather
 * than between surfaces: `.de-token-field` is a button that opens a popover and
 * said `default` while `.de-select` — the same job, the same row in
 * `.de-paint-row` — said `pointer`. A layer row said `default` while the eye
 * button inside it said `pointer`. A reader cannot learn a vocabulary whose
 * two halves contradict each other an inch apart.
 *
 * Pointer won on the count and on the argument. `better-layout` asks that a
 * control read as a control, and a chrome that withholds the one free
 * affordance the platform offers — on some controls, unpredictably — is paying
 * that cost for nothing. The Figma-style no-pointer chrome is a defensible
 * alternative, but it is a decision about ALL of them, and it was never taken;
 * what existed was an accident with 40 votes on one side.
 */
export const panelsCss = `/* ---------- panels ---------- */
/*
 * The row the two panels and the canvas between them are laid out in.
 *
 * The panels used to be two independently \`position: fixed\` slabs pinned to
 * opposite edges, which is the simplest thing that draws the right picture and
 * the one thing a resize cannot be built on: neither slab had a parent in
 * common with the other, so there was no seam between them for a drag to be
 * ABOUT. \`motion-panels\` decides which edge a panel owns by looking at its
 * siblings for the one marked as filling, so the panels are now flex children
 * of this rail — left panel, seam, fill, seam, right panel — and the rail is
 * \`inset: 0\`, which makes a stretched flex child the exact rectangle the fixed
 * positioning produced. Nothing about either panel moved.
 *
 * \`overflow: clip\` is for the hidden state only: a parked panel translates its
 * own width past the viewport edge, and clipping what is already off-screen
 * costs nothing while keeping the rail from ever growing a scroll range.
 */
.de-rail {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: row;
  overflow: clip;
  pointer-events: none;
}
.de-rail > * { pointer-events: auto; }
/*
 * The canvas, as far as the resizing is concerned: an empty box the width of
 * whatever the panels have left.
 *
 * It paints nothing and it must never take a click — the app is underneath it,
 * and the editor's own canvas chrome is a separate layer in front. It exists
 * because it is what the library MEASURES: how far a drag can go is how much
 * room is in here, so the bound a panel stops at is the real gap on screen
 * rather than a number somebody guessed.
 */
.de-rail-fill { flex: 1 1 auto; min-width: 0; pointer-events: none; }

/*
 * Docked to the viewport edge, not floating in front of it.
 *
 * These used to be inset cards: 12px of app showing down the outside of each
 * one, rounded, with a shadow all the way round. That reads as a window lying
 * on top of the page — which is what it was, and the strip of live product
 * running down the far edge was the tell. It is dead space you cannot click
 * through to, it puts a second vertical edge beside the one the panel already
 * draws, and at the top and bottom it cuts the list short of the screen for no
 * gain in legibility.
 *
 * Docking spends that space on the panel instead, and ONE hairline on the inner
 * edge is the whole separation. No shadow in either direction.
 *
 * A directional cast across the canvas was the first thing tried here, on the
 * reasoning that a panel in front of the app should say so. It should not: the
 * panel is not in front of the app, it is beside it. Nothing overlaps, nothing
 * is occluded, and the two surfaces are already told apart by a hard value step
 * — dark chrome against a light product — which is a louder boundary than any
 * gradient. What the cast actually did was fog the first 20px of the app with a
 * dark gradient nobody asked for, so the edge of the canvas read as dirty
 * rather than as adjacent. The other three sides never had one; they meet the
 * viewport, where a shadow has nothing to fall on.
 */
.de-panel {
  /*
   * \`flex: none\` because the width is not the layout's to decide. It is a
   * MotionValue the resize lane writes as an inline style on every frame of a
   * drag; letting flex grow or shrink the panel as well would put two authors
   * on one number, and the loser is whichever ran last.
   */
  flex: none;
  align-self: stretch;
  position: relative;
  display: flex;
  flex-direction: column;
  background: ${t.color.bg};
  border: none;
  border-radius: 0;
  box-shadow: none;
  overflow: hidden;
}
/*
 * The inner edge is the one hairline in the chrome drawn against a colour we
 * do not control, so it is the STRONG rung and not the divider one.
 *
 * Every other rule in this file separates two surfaces we painted. This one
 * separates the editor from the product, and since the ground went near-black
 * it can no longer lean on a value step to do that: a dark-mode app sits within
 * a point or two of \`bg\` — \`#1a1a1a\` is squarely in the range other people's
 * dark themes pick from — and at \`border\` the boundary was the faintest line on
 * the screen, thinner-looking than the divider between two rows of the same
 * panel, for the one edge that has to say where the tool stops. Against a light
 * app the step is enormous either way, so the heavier rung costs nothing there.
 */
/*
 * The widths here are the ones the panel MOUNTS with, and after that the resize
 * lane overwrites them inline from the panel's own MotionValue. They are left
 * in the stylesheet rather than moved into script because they are also the
 * fallback: if \`shell/resize.ts\` ever fails to mount, the chrome still lays out
 * at the two widths it has always had instead of collapsing to nothing.
 */
.de-panel--left {
  width: ${t.size.panelWidth}px;
  border-right: 1px solid ${t.color.borderStrong};
}
.de-panel--right {
  width: ${t.size.inspectorWidth}px;
  border-left: 1px solid ${t.color.borderStrong};
}
/* An author \`display\` beats the UA [hidden] rule, so restate it. */
.de-panel[hidden] { display: none; }

/*
 * The seam: a real target, and nothing to look at.
 *
 * A resizable panel usually announces itself with a rail — a visible gutter, a
 * grip, a dotted handle. This one must not: the hairline between the chrome and
 * the product is the single most deliberate line in the editor (see the note on
 * \`borderStrong\` above), and putting a second edge beside it to drag would undo
 * the docking argument the panels are built on.
 *
 * So the separator is ${t.size.separatorHit}px wide and pulled back by half of that on each
 * side. It contributes exactly zero to the flex line — the panel's edge does not
 * move by a pixel — while still being a genuine box straddling the hairline,
 * half over the panel and half over the app, so the target is the same size
 * whichever side you reach from.
 *
 * Negative margins rather than a zero-width element with an overflowing
 * \`::after\`, which is the other way to get a target out of nothing and is worse
 * in two places that matter: an element with no box is reported as invisible by
 * anything measuring one, and a focus state has nothing to sit on.
 *
 * \`z-index\` puts it over both neighbours. The right seam comes BEFORE its panel
 * in the DOM, so without it the panel would paint over the half that overlaps
 * it and only the canvas side would be grabbable.
 */
.de-separator {
  flex: none;
  width: ${t.size.separatorHit}px;
  margin-inline: -${t.size.separatorHit / 2}px;
  align-self: stretch;
  position: relative;
  z-index: 1;
  cursor: col-resize;
  /* The library drives the drag from pointer events, so the browser must not
     also read the gesture as a scroll or a pinch on a touch screen. */
  touch-action: none;
  /*
   * Here rather than only in the library's own body lock, and the difference is
   * visible.
   *
   * \`motion-panels\` sets \`user-select: none\` on the body when a drag starts —
   * but a drag starts three pixels after the press, and by then the browser has
   * already begun a native text selection from wherever the pointer went down.
   * Turning selection off mid-gesture does not cancel one that is already
   * running, so it kept extending across the panel: a thin highlight band
   * tracking the pointer the whole width of the drag. Declaring it on the seam
   * means the press never starts a selection in the first place.
   */
  user-select: none; -webkit-user-select: none;
}
.de-separator[hidden] { display: none; }
/*
 * The tell: the panel's own hairline, repainted in the accent.
 *
 * Not a line BESIDE the border and not a wider line over it — the same pixel,
 * recoloured, so the edge lights up where it already is instead of thickening.
 * That is the whole hover state, and it is why the resting design is unchanged:
 * there is no new geometry on screen at any point, only a colour on one pixel
 * that was already being drawn.
 *
 * Which pixel depends on the side, because each panel draws its hairline as the
 * border on its own inner edge: the left panel's is the pixel immediately
 * before this item, the right panel's the pixel immediately after.
 *
 * \`data-resizing\` is set by the library for the length of a drag, so the line
 * stays lit once the pointer has left the strip — which it does immediately,
 * since the seam is travelling with it.
 */
.de-separator::before {
  content: "";
  position: absolute;
  top: 0;
  bottom: 0;
  width: ${t.size.hairline}px;
  background: transparent;
  transition: background ${t.duration.fast} ${t.ease};
}
.de-separator--left::before { right: ${t.size.separatorHit / 2}px; }
.de-separator--right::before { left: ${t.size.separatorHit / 2}px; }
.de-separator:hover::before,
.de-separator:focus-visible::before,
.de-separator[data-resizing]::before { background: ${t.color.accent}; }
/*
 * The seam is focusable — it is a real \`role="separator"\` and the arrow keys
 * resize it — so it needs a focus state, and the lit hairline above IS that
 * state. A ring cannot be: the element is zero-width, so an outline would draw
 * a 2px box around a line and be the one piece of geometry this whole surface
 * exists to avoid.
 */
.de-separator:focus-visible { outline: none; }

/*
 * Standing down: each panel leaves by the edge it is docked to.
 *
 * Purpose is spatial, not decorative — the panel does not dissolve, it goes
 * somewhere, and the same path in reverse is what makes the launcher read as
 * where it went. \`transform\` and \`visibility\` only: a width or an inset here
 * would relayout the app on every frame of the slide, and the app is the thing
 * the user is hiding the editor to look at.
 *
 * Exactly 100%, with nothing added. The panels used to park 24px further out
 * to get their shadow off the screen too; with no shadow to clear, the panel's
 * own width is the whole distance, and the extra travel would only be time
 * spent moving something already out of sight.
 *
 * \`visibility\` is what makes the parked panel inert — untabbable, unclickable
 * — and it is delayed by the full duration so it flips only once the panel has
 * finished leaving. Coming back it flips at 0s, so the panel is real for the
 * whole of its entrance.
 */
.de-panel {
  transition:
    transform ${t.duration.drawer} ${t.ease},
    visibility 0s;
}
html.designlayer-chrome-hidden .de-panel {
  visibility: hidden;
  /*
   * 60ms behind the toolbar on the way out, level with it on the way back —
   * the delay lives on this rule, so it applies to the exit only. The
   * visibility flip is the sum: 60 of waiting plus the slide itself.
   */
  transition:
    transform ${t.duration.drawer} ${t.ease} 60ms,
    visibility 0s linear 300ms;
}
html.designlayer-chrome-hidden .de-panel--left { transform: translateX(-100%); }
html.designlayer-chrome-hidden .de-panel--right { transform: translateX(100%); }

.de-panel-body { flex: 1; overflow-y: auto; overscroll-behavior: contain; }
.de-panel-body::-webkit-scrollbar { width: 8px; }
.de-panel-body::-webkit-scrollbar-thumb {
  background: transparent; border-radius: ${t.radius.md};
  border: 2px solid transparent; background-clip: content-box;
}
.de-panel-body:hover::-webkit-scrollbar-thumb { background: ${t.color.borderStrong}; background-clip: content-box; }

.de-section { border-bottom: 1px solid ${t.color.border}; }
/*
 * A grid, and the actions column is reserved whether or not the header has an
 * action in it.
 *
 * With \`space-between\` the title of a section that owns a \`+\` sat at the same
 * left edge as one that does not — but the \`+\` itself was the only thing
 * holding the right edge, so Fill's add button and Effects' add button landed
 * wherever their titles left room, and scrolling the panel walked them left
 * and right. A fixed trailing track means every add sits on one line down the
 * panel, and a header without one leaves that line empty rather than closing
 * it up. \`auto\` as the max so a header that grows a second action still fits.
 */
.de-section-header {
  height: ${t.size.sectionHeader}px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(${t.size.miniSize}px, auto);
  align-items: center;
  /* The collapsible variant hangs its fold layer off this. */
  position: relative;
  /* Was \`0 8px 0 10px\`. The 10 was the only thing in the panel that started a
     column of its own: the body below pads to 8, so every section title sat two
     pixels right of the rows it heads and the left edge of the panel read as
     bent. One step, both sides. */
  padding: 0 ${t.space.md}px;
  color: ${t.color.text};
  font-size: ${t.type.body}; font-weight: ${t.type.weightSection};
}
/*
 * A third column, for the identity header when the selection holds more than
 * one element.
 *
 * The grid above is two columns wide, so the count would otherwise be laid out
 * on an implicit second row inside a bar with a fixed height — present in the
 * DOM, invisible on screen, which is the worst way for a panel to tell you it
 * is describing four elements you cannot see. The name keeps the \`1fr\` so it
 * still pushes the pair to the right edge, where the tag already sat.
 */
.de-section-header--counted {
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: ${t.space.sm}px;
}
.de-selection-count { white-space: nowrap; }
/* The bottom step is the heavier one on purpose: the header carries the air
   above the first row, and the 12 below the last one is the whole rest between
   this section's rows and the next section's hairline. */
.de-section-body {
  padding: ${t.space.sm}px ${t.space.md}px ${t.space.lg}px;
  display: flex; flex-direction: column; gap: ${t.space.md}px;
}
/* An author \`display\` beats the UA [hidden] rule, so restate it. This is the
   fold for a body that has NO \`.de-section-fold\` around it — the identity
   header's source line is one — and the wrapped case overrides it below. */
.de-section-body[hidden] { display: none; }

/*
 * THE FOLD, AND IT USED TO BE A \`display\` SWAP.
 *
 * Pressing a section header turned the chevron over 120ms and replaced the
 * body between two frames. The mark said a section was closing and the section
 * said it had always been shut; everything below it jumped by the height of
 * whatever had just ceased to exist, and the eye had nothing to follow to work
 * out what moved where. A disclosure is the canonical case for a height
 * transition and this was half of one.
 *
 * ## Why a grid row and not \`revealGroup\`
 *
 * \`core/leave.ts\` measures a height in JavaScript, and its own header says
 * what that is for: a group REBUILT on every render, where the collapsed state
 * has to be written inline at build time because the node is new. A section is
 * rebuilt too — but the fold is not pressed during a rebuild, it is pressed
 * against a node that has been sitting on screen, and the three things
 * \`.de-lib-drawer\` lists apply here word for word:
 *
 *  - it shuts as well as it opens, where \`revealGroup\` only opens;
 *  - a section body CHANGES while it is open (a scrub commit rewrites rows, a
 *    \`+\` adds one), and \`1fr\` re-resolves to whatever the section is now,
 *    where a measured pixel height would have to be measured again;
 *  - no JavaScript runs on the fold, so there is no timer to keep in step with
 *    the reduced-motion clamp in \`css/base.ts\`.
 *
 * A rebuild does not animate, and that matters as much as the press does: a
 * transition does not run on a node's FIRST style, so a section rebuilt shut
 * is simply shut and one rebuilt open is simply open. Only the attribute flip
 * on a node already in the document plays.
 *
 * ## Why this is a wrapper and not the body itself
 *
 * The body is padded, and a border box squeezed to zero still paints its
 * padding — 20px of section left behind after the fold has finished closing.
 * The clip layer has to be a box with no padding of its own, which is this
 * one. Same arrangement as \`.de-lib-drawer\` around \`.de-lib-panel\`.
 *
 * \`minmax(0, 0fr)\` rather than \`0fr\`: a bare \`0fr\` is \`minmax(auto, 0fr)\`,
 * and that automatic minimum is the item's own minimum contribution, which for
 * a padded flex column is its padding plus the tallest thing it holds. Naming
 * a floor of zero is what lets the track actually close; the body's
 * \`min-height: 0\` below is the other half and is just as load-bearing.
 *
 * \`base\` and not \`drawer\`: 240ms is a whole panel crossing the screen edge,
 * and this is a disclosure opening inside one — the same rung \`.de-entering\`
 * and the libraries drawer take for the same statement.
 *
 * The column needs the same floor. With no \`grid-template-columns\` the one
 * implicit track is \`auto\`, which grows to the body's min-content width — and
 * a body holding a nowrap URL or code path has a min-content of 500px or more.
 * The track then ran past the panel edge, \`overflow: hidden\` cut it off, and
 * every row inside laid out against the wide track: ellipses never fired and
 * the right-hand controls sat outside the visible column. \`minmax(0, 1fr)\`
 * pins the track to the panel, and the body's \`min-width: 0\` below lets it
 * shrink into it.
 */
.de-section-fold {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: minmax(0, 1fr);
  overflow: hidden;
  transition: grid-template-rows ${t.duration.base} ${t.ease};
}
/*
 * Driven by the body's own \`hidden\`, not by the toggle's \`aria-expanded\`.
 *
 * Both are written in the same statement so either would work today. This one
 * ties the drawing to the fold's STATE: \`hidden\` is what the body IS, while
 * \`aria-expanded\` is what the button CLAIMS about it, and if the two ever
 * drift the box should follow the one that decides whether the controls inside
 * can be reached.
 */
.de-section-fold:has(> .de-section-body[hidden]) { grid-template-rows: minmax(0, 0fr); }
/*
 * THE BODY IS CLIPPED, NOT SQUASHED, and \`align-self\` is the whole of it.
 *
 * A grid item stretches to its row by default, so at \`0.4fr\` the body was 40%
 * of its own height — and a body is a flex COLUMN, whose children shrink along
 * the main axis, which here is the vertical one. Every row inside it therefore
 * re-laid-out on every frame of the fold: labels closed up on their fields,
 * the swatch grid lost its rows, and what the eye saw was the section being
 * crushed rather than rolled away. Measured at 90ms into a close, the fields
 * had already collapsed into each other while the box still had 45px to go.
 *
 * \`start\` takes the item out of the stretch, so it keeps its natural height
 * throughout and the shrinking row simply reveals less of it. Nothing inside
 * moves relative to anything else inside — the only thing that changes is how
 * much of the body there is to see, which is what a disclosure IS.
 *
 * And no fade rides along. One was tried: content dimming ahead of the box
 * left an empty dark band closing on its own for the back half of the gesture,
 * which is a worse artefact than the hard edge it was meant to soften. A clip
 * that travels this far over 180ms does not need help reading as a clip.
 *
 * \`min-height: 0\`: see \`.de-section-fold\`. A grid item's automatic minimum is
 * its content, and without a floor of zero on the item as well as on the track
 * the fold never shuts.
 */
.de-section-fold > .de-section-body {
  align-self: start;
  min-height: 0;
  min-width: 0;
}
/*
 * Inside the fold the body is never \`display: none\` — a box that is not laid
 * out has no height for the row above it to animate away from.
 *
 * \`visibility\` does the part of \`hidden\`'s job that still has to be done: it
 * takes a shut section's fields out of the tab order and off the accessibility
 * tree. Delayed by the length of the close, so the content is still there to
 * be seen going; immediate on the way back, or the section would open onto
 * nothing for 180ms.
 */
.de-section-fold > .de-section-body[hidden] {
  display: flex;
  visibility: hidden;
  transition: visibility 0s linear ${t.duration.base};
}

/*
 * Hover is one rung up from the element's OWN resting ground, and a full-bleed
 * band takes the quiet rung.
 *
 * This said \`bgRaised\`, which is the same pixel value as \`bgHoverQuiet\` and the
 * wrong name for it: \`bgRaised\` is the surface a popover is BUILT from, not a
 * state a panel row enters. Naming the state means the two can be re-cut apart
 * later without a header silently following a popover.
 */
.de-section-header--collapsible:hover { background: ${t.color.bgHoverQuiet}; }
/*
 * Three tracks: the title, then the add button, then the chevron on the
 * trailing edge.
 *
 * The add button no longer needs a reserved track to sit still in. It used to,
 * because it was the last thing in the bar and so the only thing holding the
 * right edge; now the chevron holds that edge on EVERY section, the adds are
 * measured off it, and the three that have one line up whatever their titles
 * do. A section without one leaves an empty track that costs nothing.
 */
.de-section-header--collapsible {
  grid-template-columns: minmax(0, 1fr) auto auto;
  column-gap: ${t.space.md}px;
  /* On the bar rather than on the button: the whole bar folds, and the hand has
     to follow the pointer over the chevron and the empty middle too, neither of
     which is the button. */
  cursor: pointer;
}
/*
 * The fold target is a layer under the bar, not a box around its contents.
 *
 * With the title and the chevron on opposite ends of the header, one button
 * wrapping both would also have to wrap the add button between them, and a
 * button inside a button is invalid — so this one holds nothing and covers
 * everything. Being absolutely positioned it also paints above its in-flow
 * siblings, which is what makes a click anywhere along the bar fold the
 * section; the title and chevron underneath show through because it has no
 * background of its own.
 */
.de-section-toggle {
  position: absolute; inset: 0;
  padding: 0;
  border: none; background: transparent;
  cursor: pointer;
}
.de-section-toggle:focus-visible { outline: 2px solid ${t.color.accent}; outline-offset: -2px; }
/* A title longer than the panel wrapped to a second line inside a 32px header
   and got sliced through the x-height. Now that the title is a span of its own
   it can end in an ellipsis rather than a hard cut. */
.de-section-title {
  grid-column: 1;
  min-width: 0;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.de-section-actions {
  grid-column: 2;
  /*
   * \`space.md\`, matching the layers row's action strip, and it was
   * \`space.xs\`. These are 18px \`miniSize\` plates whose \`::after\` pads them
   * out to a 24px target; at a 2px gap two adjacent targets are 20px apart and
   * their pads overlap, so the pointer lands on whichever the cascade happens
   * to put on top. The chrome has four of these strips and had solved the
   * spacing on two of them.
   */
  display: inline-flex; align-items: center; justify-content: flex-end; gap: ${t.space.md}px;
  /* The one thing in the bar that takes its clicks back off the fold layer: a
     press on \`+\` must add a fill, not collapse the section it would land in. */
  position: relative; z-index: 1;
}
/*
 * The chevron is drawn, not pressed — and it does not sit on the fold layer
 * either way.
 *
 * The rotation below makes it a stacking context, so it paints in the same pass
 * as the absolutely positioned button and, being later in the DOM, lands on top
 * of it; \`pointer-events\` hands those clicks back down. That is belt and
 * braces rather than the mechanism: inspecting mode forces \`pointer-events: all\`
 * onto every \`<svg>\` in the document, which wins inside here, so what actually
 * makes a press on the glyph fold the section is the listener one level up on
 * the header (see \`section()\`).
 */
.de-section-header--collapsible > .de-chevron { grid-column: 3; pointer-events: none; }
.de-chevron {
  flex: none;
  display: inline-flex; align-items: center; justify-content: center;
  color: ${t.color.textDim};
  transform: rotate(90deg);
  /*
   * The quarter turn, on the same clock as the thing it describes.
   *
   * This was \`fast\` while the body it discloses was a \`display\` swap, and the
   * comment here said so: the chevron carried the whole statement because
   * nothing else could. The body animates now (\`.de-section-fold\` above), so
   * the two are one gesture and have to take one duration — at 120 against 180
   * the mark finished its turn while the section was still two thirds open,
   * which reads as the chevron being a separate little control that happens to
   * sit in the bar.
   *
   * \`base\` is the fold's rung, and it is still well clear of \`snap\`: 90
   * degrees is a larger visual move than a tint, and at 70ms the turn reads as
   * a substitution rather than a rotation.
   *
   * One rule reaches every collapsible section in the chrome, and the blanket in
   * \`css/base.ts\` already clamps it for reduced motion.
   */
  transition: transform ${t.duration.base} ${t.ease};
}
/* The fold state lives on the header now, not on the button: the chevron is no
   longer a child of the button that turns it. */
.de-section-header--collapsed .de-chevron { transform: rotate(0deg); }

/* Vertical rhythm inside a section body — one rule instead of an inline style. */
.de-stack { display: flex; flex-direction: column; gap: ${t.space.md}px; }
.de-layout-group { display: flex; flex-direction: column; gap: ${t.space.md}px; }
/* The step above the rule is the tight one and the step below it the group one:
   this is a boundary between two runs of controls, so it has to out-measure the
   gap inside either run or the rule is doing the separating on its own. */
/*
 * The space does it, so the line came out.
 *
 * This drew 4px of margin AND 12px of padding AND a hairline — 16px of air
 * between two runs whose internal gap is 8, which is already the 2x the rule
 * above asks for. The comment two lines up says exactly that ("it has to
 * out-measure the gap inside either run"), and then the rule hedged by adding a
 * border on top of a separation that had already worked.
 *
 * Space first, lines last and only where space alone cannot carry it: with 16
 * against 8 it plainly can. \`.de-section\`'s own \`border-bottom\` stays, because
 * a twelve-section settings column IS the dense case the exemption is for; two
 * runs of controls inside one section is not.
 */
.de-layout-group + .de-layout-group {
  margin-top: ${t.space.sm}px;
  padding-top: ${t.space.lg}px;
}
/*
 * ─────────────────────────────────────────────────────────────────────────
 * THE FOUR LABEL RANKS, and every label in the panel is exactly one of them.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Measured off Figma's own panel at 2x (\`.harness/figma-spec.md\`), which uses
 * four and only four:
 *
 *   rank      Figma            here                      example
 *   section   11px 600 #1A1A1A body / weightSection / text      "Position"
 *   caption   10px 400 #7F7F7F caption / weightBody / textDim   "Alignment"
 *   label     11px 400 #7A7A7A body / weightBody / textMuted    the "W" in a field
 *   value     11px 400 #191919 body / weightBody / text         the "708" beside it
 *
 * Our sizes sit one rung higher than Figma's throughout — 12/11 against their
 * 11/10 — and that is deliberate rather than drift. What has to match is the
 * RELATION: a caption one step under the body size, a section header at body
 * size carrying the weight, and the label/value pair separated by ink alone at
 * the same size and weight. All three hold. Matching Figma's absolute pixels
 * would put our caption on 10px, which is \`micro\`, documented in tokens.ts as
 * the floor for a MARK rather than for words you read.
 *
 * The audit that produced this block found three collisions, all invisible in
 * review and all obvious in a table:
 *
 *   - \`.de-layout-group-title\` was 12/600/textMuted while \`.de-section-title\`
 *     was 12/600/text. Same size, same weight, two different inks, for two
 *     things that look like the same rank because they ARE: "Auto layout" is a
 *     section header in Figma, sitting at the same weight as "Position". A
 *     reader cannot learn a hierarchy whose third rung differs from its first
 *     only by a shade of grey.
 *   - \`.de-hint\` and \`.de-group-caption\` were both textDim, at two sizes. They
 *     are different things — one names the control below it, the other explains
 *     what a write will do — so the caption keeps the smaller rung and the hint
 *     stays on body, where a sentence belongs.
 *   - \`.de-field-suffix\` sat at textDim beside a textMuted label, so a unit
 *     printed on a field outranked nothing and read as disabled. It is the same
 *     rank as the label it shares a box with.
 *
 * Nothing here sets a size or weight that is not one of the four rows above. A
 * fifth rung is how the first three stop meaning anything.
 */
/*
 * A heading BINDS DOWN to the block it names, and it did not.
 *
 * \`.de-group-caption\` a few hundred lines below already argues this exact
 * asymmetry one rung lower: a caption sits \`space.sm\` above the control it
 * names and \`space.md\` from the next group, so it reads as belonging to what
 * follows rather than floating between two things. The rule was never applied
 * to the rung above it.
 *
 * So a sub-heading was the bare first child of a \`space.md\` stack — 8px above,
 * 8px below, a ratio of 1.0 where the grouping rule wants at least 2. On the
 * Responsive section that put a title, three lines of prose and a field all at
 * the same 8px, and the NEXT block's title at 8px too: five things in one
 * column with nothing in the spacing saying which of them belong together.
 *
 * A negative bottom margin rather than restructuring the sections, because the
 * stack that owns the gap is shared by six call sites and three of them have no
 * heading at all. This closes the gap under the heading to \`space.sm\` and
 * leaves the \`space.md\` between blocks standing, which is the 2x the rule
 * asks for, without any of those call sites changing.
 */
.de-layout-group-title {
  color: ${t.color.text};
  font-size: ${t.type.body};
  font-weight: ${t.type.weightSection};
  margin-bottom: -${t.space.sm}px;
}
/* A sentence, not a name — so it keeps the body size a caption gives up, and
   the quietest ink, because it is the one thing in a section you can finish
   reading and never look at again. */
.de-hint { color: ${t.color.textDim}; font-size: ${t.type.body}; line-height: ${t.type.leadingRow}; }

/* Selection identity: what you picked, and where it lives in the source. */
.de-tagname { color: ${t.color.textDim}; font-weight: ${t.type.weightBody}; }
.de-source { font-size: ${t.type.body}; color: ${t.color.textDim}; word-break: break-all; }

.de-row { display: flex; align-items: center; gap: ${t.space.md}px; }
/*
 * TWO GAPS, NOT ONE, and the shorthand was quietly saying the wrong thing.
 *
 * \`gap: \${t.space.md}px\` sets the row gap AND the column gap to 8. Eight is
 * also what \`.de-section-body\` and \`.de-stack\` put BETWEEN groups. So in the
 * Position section the gutter between the X and Y fields — two items inside one
 * captioned group — was 8px, and the distance from the whole Position group to
 * the whole Size group was also 8px. Nothing in the rhythm said which pair
 * belonged together; the grouping rule wants twice as much between groups as
 * within one, and this measured 1.0.
 *
 * The column gap drops to \`space.sm\`, which makes it 8/4 = 2.0 and is not a new
 * number: 4px between two adjacent wells is what \`.de-paint-row\` already uses a
 * few rules down. It also hands 4px of width back to a 260px column, where
 * every pixel is spoken for.
 *
 * The ROW gap stays at 8. These grids wrap to a second line in the Size and
 * Position sections, and a wrapped row is a new pair of items rather than a
 * tighter version of the one above — halving it there would merge two rows into
 * one block.
 *
 * Honest caveat, recorded because the audit that found this made it: the
 * comparison is cross-axis — horizontal within a row against vertical between
 * groups — and the rule is usually read as same-axis. Every same-axis ratio in
 * this panel already clears 2.0. The change is made anyway because the reader's
 * eye does not know which axis it is crossing; it only sees which things are
 * nearer each other.
 */
.de-row--split {
  display: grid; grid-template-columns: 1fr 1fr;
  gap: ${t.space.md}px ${t.space.sm}px;
}
.de-row--quad {
  display: grid; grid-template-columns: repeat(2, 1fr);
  gap: ${t.space.md}px ${t.space.sm}px;
}

/*
 * Every field rests in a well.
 *
 * These were transparent until hovered, on the theory that a quiet panel is a
 * calm one. It is not: a section of eight numbers with nothing behind them
 * reads as eight pieces of loose text, and you have to sweep the pointer along
 * the column to find out which of them you are allowed to touch. Giving each
 * one a resting surface is what turns the column into a form — the affordance
 * is visible before the pointer arrives, and the row edges align the values
 * for free. Hover lifts the same well rather than drawing a border, so nothing
 * shifts by a pixel on the way in; the border is spent on focus instead, where
 * it is the one state worth an accent.
 *
 * Horizontal padding lives on the *parts*, not here, so the leading label can
 * be a full-height strip you can grab anywhere rather than a word with dead
 * space above and below it.
 *
 * The well sinks BELOW the panel, and that is what the near-black ground
 * changed. \`field\` is a 10% lift, which on the old mid-slate was a quiet plate
 * and on this ground is ten points of lightness above everything around it —
 * so a column of eight of them read as eight raised chips laid on the panel,
 * with as much weight each as a selected row in the layer tree. Sinking is the
 * reading a field wants and the one the ground now affords: there is a rung
 * below \`bg\` where there was none before, and it is the same rung the code
 * view is already drawn on, so every recess in the chrome is one surface.
 *
 * Hover crosses back over the panel ground on the way up, which is the point —
 * the well fills in. Nothing between \`bgSunken\` and \`lift(6)\` exists to make
 * that step smaller, and \`bg\` itself cannot be it: a field at exactly the
 * panel's value has no edge, so it would vanish under the pointer that is
 * looking for it.
 */
.de-field {
  display: flex; align-items: center;
  height: ${t.size.rowHeight}px;
  border-radius: ${CONTROL_RADIUS};
  background: ${t.color.bgSunken};
  border: 1px solid transparent;
  overflow: hidden;
  transition: border-color ${t.duration.fast} ${t.ease}, background ${t.duration.fast} ${t.ease};
}
.de-field:hover { background: ${t.color.bgHoverQuiet}; }
.de-field:focus-within { background: ${t.color.bgHoverQuiet}; border-color: ${t.color.accent}; }
/*
 * The label is a CONTROL, not metadata, so it takes the label ink and not the
 * secondary one.
 *
 * It was \`textDim\` — the same ink as the unit suffix two boxes to its right —
 * and the two are not the same kind of thing: you can grab this one and scrub
 * the value with it, and \`px\` is a word printed on the field. On the near-black
 * ground that collapse was the visible one in a row of eight fields, where the
 * only ranked things are the label, the number and the unit and two of the
 * three were identical. \`textMuted\` on the well measures 10.7:1 against the
 * old 6.8:1, and now sits a clear step above the suffix that kept \`textDim\`.
 */
.de-field-label {
  flex: none; align-self: stretch;
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 12px;
  /* The tight step, where the gaps AROUND the field take the workhorse one.
     Two fields share a 240px panel on a split row, leaving about 108px each for
     a label strip, a number and a unit; at ${t.space.md} a side the strip alone
     eats 28 of them and a four-digit value starts clipping. Inside a control
     this dense, the difference between 4 and 8 is a digit. */
  padding: 0 ${t.space.sm}px;
  color: ${t.color.textMuted};
  font-size: ${t.type.body};
  user-select: none;
  cursor: ew-resize;
  transition: background ${t.duration.snap} ${t.ease}, color ${t.duration.snap} ${t.ease};
}
/*
 * THE SCRUB SAYS SO WHILE IT IS HAPPENING.
 *
 * \`cursor: ew-resize\` is the only thing that ever admitted this label is a
 * control, and a cursor is an offer, not an acknowledgement: press and drag and
 * the number counts, but nothing on the control confirms that the gesture — not
 * the pointer drifting over a panel — is what is driving it. On a 24px row with
 * eight neighbours that ambiguity is the whole reason the most powerful
 * interaction in the inspector is also the least discovered.
 *
 * The lit state is the same pair a pressed \`.de-mini\` takes, so "this control
 * is engaged" is one appearance in the panel rather than two. \`snap\`, because
 * it has to land inside the first few pixels of the drag or it is describing a
 * gesture that already started; and because the reverse — letting go — must not
 * still be fading while the value sits finished.
 *
 * The class is written by \`field.ts\` on pointerdown and cleared on pointerup,
 * so it also survives the pointer leaving the label mid-drag, which capture
 * makes common and \`:active\` alone would not cover.
 */
/*
 * The ink is \`text\`, not \`accent\`, and the tint alone carries the accent.
 *
 * This was accent-on-\`accentSoft\`, which is 3.76:1 in dark and 3.77:1 in
 * light. A tinted plate under a MARK owes 3:1 and would have been fine; this
 * plate is under a WORD — the field's label, "W" or "Opacity" — and a word owes
 * 4.5:1. The one thing the reader needs while dragging is which field is moving,
 * and it was the least legible text in the panel for exactly as long as the
 * drag lasted.
 *
 * Found by the contrast sweep in \`tools/contrast.ts\`, not by eye, and it is
 * the kind of pair that is hard to see: accent-on-accent-wash looks deliberate,
 * reads as a system, and is a ratio nobody checks because both halves came out
 * of the palette. \`text\` is 7.1:1 dark and 15.51:1 light; the wash still says
 * "accent", so nothing about the treatment's meaning moved.
 */
.de-field-label--scrubbing {
  background: ${t.color.accentSoft};
  color: ${t.color.text};
}
.de-field--scrubbing { border-color: ${t.color.accent}; }
.de-field input {
  flex: 1; min-width: 0; width: 100%;
  padding: 0 ${t.space.sm}px 0 0;
  border: none; background: transparent; outline: none;
  color: ${t.color.text}; font-family: inherit; font-size: ${t.type.body};
}
.de-field input::-webkit-outer-spin-button,
.de-field input::-webkit-inner-spin-button { appearance: none; margin: 0; }
.de-field input[disabled] { color: ${t.color.textDim}; cursor: default; }
.de-field input::placeholder { color: ${t.color.textDim}; }
/*
 * Pushed to the far edge by the flexed input, the way Figma parks a unit.
 *
 * The LABEL rank, not the dim one. A unit and the letter at the other end of
 * the same box are the same kind of thing — printed on the field, naming what
 * the number means — and they were two ranks apart, which put \`%\` at the ink
 * this panel uses for a disabled control. See the ranks table above.
 */
.de-field-suffix {
  flex: none;
  padding-right: ${t.space.sm}px;
  color: ${t.color.textMuted}; font-size: ${t.type.body};
}
/*
 * A measured value in a field's clothes — read-only, so it never takes a caret.
 *
 * SELECTABLE, which it was not, and neither was the \`px\` above it.
 *
 * Both carried \`user-select: none\`, copied down the row from \`.de-field-label\`,
 * where it is correct: that label is a scrub handle, a press on it starts a
 * drag, and a drag that highlights text as it travels is a drag fighting the
 * browser. Neither of these two is draggable. They are the row's OUTPUT — the
 * computed width, the resolved gap, the unit it is in — which is the content a
 * designer is most likely to want out of this panel and into a message, and the
 * suppression meant a selection swept across the row came back as a number with
 * no unit on it, or as nothing at all.
 *
 * \`better-typography\` is direct about the shape: suppression "belongs on a
 * draggable or gesture-driven surface where accidental selection interferes.
 * Never across the interface". The handle keeps it; the readout does not.
 */
.de-field-value {
  flex: 1; min-width: 0;
  padding-right: ${t.space.sm}px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  color: ${t.color.text}; font-size: ${t.type.body};
}

/* ---------- paint rows (fill / stroke / effects) ---------- */
/*
 * THE COLOUR WELL, WHICH USED TO ANSWER NOTHING.
 *
 * Every other control in this panel tells you the pointer has found it. This
 * one had eight inline declarations, no class, and therefore no state at all —
 * the single most clickable-looking thing in the inspector, and the only one
 * that stayed completely still under the cursor.
 *
 * The hover mark is a RING rather than a tint, and that is forced rather than
 * chosen: the well's whole surface is the colour it holds, so tinting it would
 * misreport the value. A ring sits outside the paint and cannot. It is drawn as
 * two stacked shadows — a \`bg\` spacer then the ring proper — so it reads
 * against both a light fill and a dark one without knowing which it is on.
 *
 * The press is the \`0.92\` every other pressed control in the chrome uses, and
 * the focus ring is the panel's standard so a keyboard reaches it the same way
 * it reaches everything else.
 *
 * \`data-de-unparsed\` is the honest case: a colour this editor cannot convert
 * shows as black because \`<input type=color>\` can hold nothing else, so the
 * well says so with a dashed edge instead of asserting a black the element does
 * not have. See the note in \`inspector/color.ts\`.
 */
.de-color-well {
  cursor: pointer;
  background: transparent;
  border: 1px solid ${t.color.border};
  border-radius: ${t.radius.sm};
  transition: box-shadow ${t.duration.fast} ${t.ease}, transform ${t.duration.snap} ${t.ease};
}
.de-color-well:hover {
  box-shadow: 0 0 0 2px ${t.color.bg}, 0 0 0 3px ${t.color.borderInteractive};
}
.de-color-well:active { transform: scale(0.96); }
.de-color-well:focus-visible { outline: 2px solid ${t.color.accent}; outline-offset: 1px; }
.de-color-well[data-de-unparsed] { border-style: dashed; border-color: ${t.color.borderInteractive}; }

/*
 * A CLASS CHIP LEAVES SIDEWAYS.
 *
 * Chips wrap inside one row, so what closes over a removed chip is the gap
 * beside it rather than the space under it — which is why this is not
 * \`.de-leaving\`, whose whole job is collapsing a height. Everything that takes
 * horizontal space goes with it, or the row keeps a few pixels of nothing where
 * the chip was.
 *
 * \`inspector/section-classes.ts\` pins the measured width first, for the reason
 * \`core/leave.ts\` pins a height: a chip's width is its content's, so there is
 * no value for CSS to animate from. The global blanket in \`css/base.ts\` clamps
 * the duration under reduced motion and the module drops its timer to match.
 */
.de-class-chip {
  overflow: hidden;
  transition:
    max-width ${t.duration.base} ${t.ease},
    opacity ${t.duration.fast} ${t.ease},
    padding ${t.duration.base} ${t.ease},
    margin ${t.duration.base} ${t.ease};
}
.de-chip--leaving {
  max-width: 0 !important;
  opacity: 0;
  padding-left: 0 !important;
  padding-right: 0 !important;
  margin-right: calc(-1 * ${t.space.sm}px) !important;
  pointer-events: none;
}

.de-paint-row { display: flex; align-items: center; gap: ${t.space.sm}px; }
.de-paint-row .de-field { flex: 1; min-width: 0; }
.de-paint-row .de-select { flex: 1; min-width: 0; }
/* The third cell that can hold the row's value, and the newest. A paint row now
   shows its token binding where the plain hex used to sit \u2014 the swatch, then
   either \`Ink/Primary\` or \`#1b2e5d\` \u2014 so the field has to size like the two
   above it. It does not inherit their rule: \`.de-token-field\` is a button and
   carries \`width: 100%\`, which as a flex basis claims the whole row and pushes
   the opacity field and the eye off the end. */
.de-paint-row .de-token-field { flex: 1; min-width: 0; }
/* The row's payload, so it takes the value ink the way \`.de-field-value\` does.
   Two read-only values in the same panel at two different ranks is not a
   hierarchy, it is an accident of which file each was written in. */
.de-paint-value {
  flex: 1; min-width: 0;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  color: ${t.color.text};
  font-family: ${t.font.mono}; font-size: ${t.type.body};
}
/* Not a nest, and the guard in \`test/concentric-cases.mjs\` records why: the
   card's first child is a ROW, and the 20px swatch at its left end is centred
   in a 24px band, so it sits 4px in horizontally and 6px down. Nothing here
   reaches a corner, so there is no curve for anything to be parallel to. */
/* Every other card in the chrome pairs a hairline with a fill — \`.de-lib-card\`
   on \`bgRaised\`, \`.de-lint-ignored-row\` on \`bgSunken\`. This one was a border
   alone on the panel ground, so at a glance it read as a rule someone had drawn
   around four fields rather than as a thing containing them. \`bgSunken\` matches
   the other "grouped box inside a section body". */
.de-paint-card {
  display: flex; flex-direction: column; gap: ${t.space.sm}px;
  padding: ${t.space.sm}px;
  background: ${t.color.bgSunken};
  border: 1px solid ${t.color.border}; border-radius: ${t.radius.md};
}

/*
 * Ghost buttons: no surface of their own, a surface on hover, an accent
 * OUTLINE when they are holding a state on.
 *
 * The border is transparent at rest rather than absent, so turning one on adds
 * a colour and never a box — a pressed \`+\` used to grow a ring the same frame
 * it changed meaning, and the row under it stepped down a pixel. Outline
 * rather than fill for the on state because these sit inside a section header
 * or a row that already carries a well behind it; a second filled surface at
 * this size reads as a badge, not a toggle.
 */
.de-mini {
  position: relative;
  width: ${t.size.miniSize}px; height: ${t.size.miniSize}px; flex: none;
  display: inline-flex; align-items: center; justify-content: center;
  border: 1px solid transparent; border-radius: ${t.radius.sm};
  background: transparent; color: ${t.color.textDim};
  font-family: inherit; font-size: ${t.type.body}; line-height: ${t.type.leadingFlush};
  cursor: pointer;
  transition: background ${t.duration.fast} ${t.ease}, color ${t.duration.fast} ${t.ease},
    border-color ${t.duration.fast} ${t.ease}, transform ${t.duration.snap} ${t.ease};
}
/*
 * The press, at the depth \`.de-tool\` and \`.de-button\` use. These are the
 * smallest pressable things in the chrome and several of them are destructive —
 * the row bin, the swatch clear — so the press landing is precisely the frame
 * that matters. \`:not([disabled])\` for the reason the shared button gives.
 */
.de-mini:active:not([disabled]) { transform: scale(0.96); }
/*
 * The drawing is 18px; the target is the full row height.
 *
 * \`miniSize\` is the size the button LOOKS, and it is three pixels short of the
 * 24px a pointer is entitled to — but growing the box would grow the plate a
 * hover paints, and a row of 24px plates in a 32px section header reads as a
 * toolbar. A hit pad is the way to have both. Vertical only: these sit two and
 * three to a row on a 2px gap, so three pixels of horizontal reach each would
 * overlap, and a click landing on the neighbour of a destructive button is a
 * worse defect than the one being fixed. 18x24 until \`miniSize\` itself moves.
 *
 * 4 and not 3, unlike the identical pads on \`.de-layer-action\` and
 * \`.de-option-delete\`: an absolutely positioned child is laid out against its
 * ancestor's PADDING box, and this button carries a 1px transparent border for
 * its pressed state. Insetting by 3 off a 16px padding box gives a 22px target,
 * two short, and it measured that way before it was measured.
 *
 * So this stays a literal while every other inset in this file moved onto
 * \`space\`. The number is not rhythm, it is what is left of the row once the
 * plate and its border are taken out — write \`space.sm\` here and the next edit
 * to \`miniSize\` or to the scale silently resizes a hit target instead of
 * respacing a gap.
 */
.de-mini::after {
  content: ""; position: absolute; inset: -4px 0;
}
.de-mini:hover { background: ${t.color.bgHover}; color: ${t.color.text}; }
/* The same tinted plate a standalone \`.de-tool\` takes, for the same reason —
   this is an on/off with no group around it. Smaller, so the tint does more of
   the work and the ring is dropped entirely: an 18px box with both reads as a
   badge. */
.de-mini[aria-pressed="true"] { background: ${t.color.accentSoft}; color: ${t.color.accent}; }
/*
 * Dark ink on the fill, never white. \`danger\` is a LIGHT coral on this chrome
 * and white on it measures 2.31:1, so the glyph disappears at exactly the
 * moment the button becomes destructive.
 *
 * \`onSemantic\`, where this used to say \`onAccent\`. That was the same fix,
 * written against a role that then moved underneath it: \`onAccent\` was
 * near-black in dark until the accent became a Figma blue, at which point it
 * went white in both themes — right for the blues, and a silent regression
 * here and at four other semantic fills, every one of which carried a comment
 * like this one claiming the bug was already closed. It measured 2.31:1 again,
 * to the hundredth.
 *
 * \`onSemantic\` is the flipping ink this rule always wanted, split back out of
 * \`onAccent\` and owning nothing else. 7.52:1 here; the full table is in its
 * note in \`tokens.ts\`.
 */
.de-mini--danger:hover { background: ${t.color.danger}; color: ${t.color.onSemantic}; }
/*
 * Disabled is quieter, not gone.
 *
 * At \`opacity: 0.35\` the glyph was \`textDim\` faded to an effective 20% white,
 * which on the near-black ground measures 1.9:1 — the section header's second
 * \`+\` was not a dim button, it was an empty square, and this is the state the
 * "labels the same colour as the button" report was pointing at. WCAG exempts
 * disabled controls from contrast, which is exactly how it got here; a control
 * you cannot see is still a control you cannot find, and the user has to know
 * the affordance exists before "it is off right now" means anything.
 *
 * It said \`opacity: 0.6\` for that reason and measured 3.2:1, which cleared the
 * floor by a tenth. It is the \`textDisabled\` role now, at 3.8:1 — the same
 * decision with margin, and stated as a colour rather than as a fraction of
 * one. The fraction was the fragile part: it is computed against whatever the
 * button is sitting on, so the ratio moved when the row under it did, and
 * nothing recomputed the number in this comment when that happened.
 */
.de-mini[disabled] { color: ${t.color.textDisabled}; cursor: default; background: transparent; }
.de-mini:focus-visible { outline: 2px solid ${t.color.accent}; outline-offset: 1px; }

/*
 * The toolbar's icon button, borrowed by inspector sections (align, direction).
 *
 * It is sized for the toolbar, where it is the pointer's first target; in a
 * panel row it has to line up with the 24px fields beside it. Scoped to
 * \`.de-panel\` so the toolbar keeps its own.
 *
 * THE PRESSED STATE IS A TINT NOW, NOT AN OUTLINE, and the reason is that the
 * outline was the third dialect of one sentence.
 *
 * A panel tool said "on" with an accent ring and accent ink; a segment said it
 * with a neutral fill; a mini said it with an accent ring at a different size
 * and radius. All three sit inside the same section, within 8px of one another,
 * and all three mean exactly "this one is chosen". Figma has two treatments and
 * assigns them by what KIND of choice it is: one-of-several takes the raised
 * chip (\`.de-segment\`, \`.de-iseg\`, \`.de-agroup\` above), and a standalone
 * on/off takes a tinted plate with accent ink — measured as \`#E5F4FF\` under a
 * blue glyph on the padding split toggle.
 *
 * This rule is that second one, and it is the right one for a bare \`.de-tool\`
 * precisely because a bare tool is the case with no rail around it: there is no
 * group for a chip to be one-of, so the button has to carry the whole signal
 * itself. \`accentSoft\` is the tint in both themes and \`accent\` the ink, which
 * keeps the pairing a token decision rather than a per-theme literal.
 *
 * A tool INSIDE \`.de-agroup\` or \`.de-iseg\` is overridden back to the chip by
 * those rules, which are more specific. That is the whole taxonomy: tinted when
 * alone, chipped when in a group.
 */
.de-panel .de-tool {
  width: ${t.size.rowHeight}px; height: ${t.size.rowHeight}px;
  border: 1px solid transparent;
  border-radius: ${CONTROL_RADIUS};
  color: ${t.color.textDim};
  transition: background ${t.duration.fast} ${t.ease}, color ${t.duration.fast} ${t.ease},
    border-color ${t.duration.fast} ${t.ease};
}
.de-panel .de-tool:hover { background: ${t.color.bgHover}; color: ${t.color.text}; }
.de-panel .de-tool[aria-pressed="true"] {
  background: ${t.color.accentSoft};
  border-color: transparent;
  color: ${t.color.accent};
}
/* Disabled outranks pressed: an arrange arrow at the end of its list is still
   drawn in whatever state it was holding, and a tinted plate under dead ink
   reads as a control that is both on and unavailable. */
.de-panel .de-tool[disabled] {
  background: transparent;
  border-color: transparent;
  color: ${t.color.textDisabled};
  cursor: default;
}

/* ---------- segmented control ---------- */
/*
 * An inset track carrying one lifted pill.
 *
 * The rail is a field well, because that is what the control is: one field
 * whose value happens to be a word from a short list, and it has to sit in a
 * row beside real fields without looking like a different species. The
 * selection was a filled accent, which at this size — three of them stacked in
 * Auto layout — turned the section into a wall of indigo and shouted about
 * defaults nobody chose. A step UP off the rail says "this one" quietly, and
 * the ink going from dim to full carries the rest of the message.
 *
 * Three rungs, evenly spaced, and they had to be re-cut for the dark ground:
 * the rail on the same sunken step every other well uses, hover at the panel's
 * own value, selection one lift above that. The old set put the rail and the
 * hover within two points of lightness of each other — pointing at a segment
 * you had not chosen yet did visibly nothing — while the rail itself matched
 * the fields above it exactly, so the track stopped reading as a track.
 *
 * Then the rungs were measured rather than reasoned about, and "evenly spaced"
 * turned out not to be true of the values chosen: sunken-to-\`bg\` is 1.10:1, the
 * smallest step anywhere in the chrome, spent on the state a pointer is sitting
 * on. Shifting both up one — hover to \`bgHoverQuiet\`, selection to \`bgHover\` —
 * gives 1.31 then 1.21, which is the even ladder the paragraph above describes.
 * Selection stays the lightest rung, which is the constraint that orders them:
 * a hover that out-lifts the chosen segment makes the control lie about its
 * value for as long as the pointer is in it.
 */
/*
 * THE RAIL LOST ITS PADDING, and that is the whole shape change.
 *
 * It was 4px, for the arithmetic reason recorded in the \`nest()\` note this
 * replaces: at 2px the segment could not land on the radius ramp, so the rail
 * was widened a step to make the nesting come out. That reasoning was sound and
 * it was answering the wrong question, because Figma's track has no rail at
 * all. Measured at 2x, the chosen chip's border begins on the same device
 * column the track's own edge does — the chip IS the cell, edge to edge, and
 * the two curves coincide rather than nest.
 *
 * Losing the rail gives the segment back the 4px of height it was paying for
 * the nest, so a segment is now the full \`rowHeight\` like every other control
 * in the panel instead of 16px inside a 24px box.
 *
 * WHAT MARKS THE CHOSEN ONE: a step UP to \`bgRaised\` plus a hairline. On the
 * light theme that resolves to white on the sunken rail, which is exactly what
 * Figma draws; on the dark theme it is the lift above the panel's own ground,
 * which is the same RELATION — the chip is the lightest thing in the control
 * and the only part of it wearing an edge. The hairline is what the old
 * treatment was missing: \`bgHover\` alone is a 1.21:1 step, and at segment size
 * that is a chip you have to hunt for. An edge is legible at any contrast.
 *
 * Still neutral rather than accent-filled, for the reason the previous note
 * gives and this one keeps: three of these stack in Auto layout, and an indigo
 * slab on each would shout about defaults nobody chose.
 */
.de-segmented {
  display: flex; align-items: stretch;
  height: ${t.size.rowHeight}px;
  border-radius: ${CONTROL_RADIUS};
  background: ${t.color.bgSunken};
  /* The containing block for the chip below. */
  position: relative;
}
/*
 * THE CHOSEN CHIP IS ONE OBJECT THAT MOVES.
 *
 * It used to be the segment's own background, which makes the selection two
 * boxes taking turns: the old chip vanishes and a new one appears, and the eye
 * is given nothing to follow between two words 60px apart. A segmented
 * control's whole affordance is that the choice is a thing you can watch move
 * along the rail.
 *
 * Exactly the values the segment drew — \`bgRaised\` and a hairline — so the
 * control is identical at rest and differs only in transit. The hairline is an
 * inset shadow rather than a border because this box is written from a
 * measurement, and a real border would make it one pixel wider than the segment
 * it is covering at every position.
 *
 * \`fast\`, not \`snap\`: the travel is a whole segment where the tab pill's is a
 * label's width, and at 70ms this outruns the eye instead of leading it.
 *
 * Behind the words — \`.de-segment\` takes an index below — and
 * \`pointer-events: none\`, so the chip can never take a click meant for the
 * segment it is sitting on.
 *
 * Guarded on \`[data-de-thumb]\`, which \`inspector/field.ts\` sets only once it
 * holds a real measurement. Unmeasured — JSDOM, or a panel that has not painted
 * — the segment keeps the tint it always drew and nothing is lost.
 */
.de-segment-thumb {
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: var(--de-thumb-w, 0px);
  transform: translateX(var(--de-thumb-x, 0px));
  border-radius: ${CONTROL_RADIUS};
  background: ${t.color.bgRaised};
  box-shadow: inset 0 0 0 1px ${t.color.border};
  opacity: 0;
  pointer-events: none;
  transition:
    transform ${t.duration.fast} ${t.ease},
    width ${t.duration.fast} ${t.ease},
    opacity ${t.duration.fast} ${t.ease};
}
.de-segmented[data-de-thumb] .de-segment-thumb { opacity: 1; }
/* Once the chip is real it owns the surface and the segment stops drawing one:
   two grounds at the same value, one of them travelling, reads as a smear. */
.de-segmented[data-de-thumb] .de-segment[aria-pressed="true"] {
  background: transparent;
  border-color: transparent;
}
.de-segment {
  flex: 1; min-width: 0;
  /* Above the chip, which is an earlier sibling and would otherwise paint over
     the word it is meant to sit behind. */
  position: relative;
  z-index: 1;
  /* A transparent hairline at rest, so taking the state adds a COLOUR and never
     a box — the same rule \`.de-mini\` follows. Without it the chosen segment
     grows 2px and shoves its neighbours along the rail. */
  border: 1px solid transparent; border-radius: ${CONTROL_RADIUS};
  background: transparent; color: ${t.color.textMuted};
  font-family: inherit; font-size: ${t.type.body}; line-height: ${t.type.leadingFlush};
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  cursor: pointer;
  transition: background ${t.duration.fast} ${t.ease}, color ${t.duration.fast} ${t.ease},
    border-color ${t.duration.fast} ${t.ease};
}
.de-segment:hover { background: ${t.color.bgHoverQuiet}; color: ${t.color.text}; }
.de-segment[aria-pressed="true"] {
  background: ${t.color.bgRaised};
  border-color: ${t.color.border};
  color: ${t.color.text};
  font-weight: ${t.type.weightValue};
}
.de-segment:focus-visible { outline: 2px solid ${t.color.accent}; outline-offset: -1px; }

/* ---------- captioned control groups ---------- */
/*
 * The label above a control, which this panel did not have and Figma's has
 * everywhere: \`Alignment\`, \`Position\`, \`Rotation\`, \`Flow\`, \`Dimensions\`,
 * \`Gap\`, \`Padding\`. Seven captions in two sections.
 *
 * Without them a section is a stack of controls you identify by recognising the
 * glyphs in it, which works for the six align marks and fails for everything
 * that is a number in a box: a 24px field holding \`0\` says nothing about
 * whether it is a gap, a rotation or a padding. The section header cannot carry
 * that — it names the whole group, and the whole group is the thing that has
 * five different answers in it.
 *
 * \`caption\` rather than \`micro\`: Figma's measures about 10px and ours would be
 * legible at that rung, but \`micro\` is documented as the floor for a MARK — an
 * eyebrow, a numeral in a chip — and these are words you read. One rung up costs
 * a pixel of density and keeps the scale's own rule intact.
 *
 * The gap under a caption is \`space.sm\` against \`space.md\` between groups, so a
 * caption binds DOWN to the control it names rather than floating between two.
 * That asymmetry is the whole job: at an equal gap the caption reads as
 * belonging to the control above it, which is the one it is not about.
 */
.de-group { display: flex; flex-direction: column; gap: ${t.space.sm}px; }
/* Selectable, like every other word in the chrome. It carried
   \`user-select: none\` and nothing here drags: the caption sits ABOVE the row of
   fields, and the only gesture surface in the group is \`.de-field-label\` two
   elements down, which keeps its suppression for the reason written there. */
.de-group-caption {
  color: ${t.color.textDim};
  font-size: ${t.type.caption};
  font-weight: ${t.type.weightBody};
  line-height: ${t.type.leadingFlush};
}

/* ---------- joined action group ---------- */
/*
 * Three or four momentary buttons drawn as one block — Figma's align triples,
 * and its flip triple under Rotation.
 *
 * The distinction this class exists to draw is between a group of ACTIONS and a
 * group of STATES, and the chrome had no way to say it: both were bare
 * \`.de-tool\` buttons in a flex row with a 2px gap, so a strip of six align
 * marks looked exactly like a strip of four direction toggles, and the only
 * thing separating the horizontal triple from the vertical one was an empty
 * div with \`flex: 1\` on it.
 *
 * Here the cells share one surface and are cut apart by a hairline GAP rather
 * than a rule — \`space.xs\` of panel ground showing through, which is what
 * Figma does (measured: two device columns of the panel's own white between
 * cells, full height). A gap rather than a border because a border would need a
 * colour, and any colour is a third value competing with the cell and the
 * ground; the ground itself is free.
 *
 * Only the OUTER corners round. \`:first-child\`/\`:last-child\` square off the
 * inside edges so the triple reads as one object with three pressable thirds,
 * which is the read a row of six equally-rounded pills cannot produce.
 */
.de-agroup {
  display: flex; align-items: stretch;
  gap: ${t.space.xs}px;
  min-width: 0;
}
.de-agroup > .de-tool {
  flex: 1; min-width: 0;
  width: auto;
  background: ${t.color.bgSunken};
  border-radius: 0;
}
.de-agroup > .de-tool:first-child {
  border-top-left-radius: ${CONTROL_RADIUS};
  border-bottom-left-radius: ${CONTROL_RADIUS};
}
.de-agroup > .de-tool:last-child {
  border-top-right-radius: ${CONTROL_RADIUS};
  border-bottom-right-radius: ${CONTROL_RADIUS};
}
.de-agroup > .de-tool:hover { background: ${t.color.bgHoverQuiet}; }
/*
 * A cell that is HOLDING a state takes the segmented control's chip, not the
 * toolbar's accent ring.
 *
 * Figma's align buttons carry no state at all — they are one-shot geometry, so
 * there is nothing to show. Ours are not: they write \`justify-content\` and
 * \`align-items\` on the parent, which is a setting that stays set, and a control
 * that silently holds a value it will not show is worse than either. So the
 * state is kept and only its VOICE changes, to the one Figma uses for every
 * other chosen-one-of-several in the panel.
 *
 * That collapse is the point. The panel had three pressed languages within
 * 8px of each other — an accent outline on \`.de-tool\`, a neutral fill on
 * \`.de-segment\`, an accent outline at a different size on \`.de-mini\` — for
 * what is, every time, the same claim.
 */
.de-agroup > .de-tool[aria-pressed="true"] {
  background: ${t.color.bgRaised};
  border-color: ${t.color.border};
  color: ${t.color.text};
}
.de-agroup > .de-tool[disabled] { background: ${t.color.bgSunken}; }

/* ---------- icon segmented control ---------- */
/*
 * The same rail as \`.de-segmented\`, carrying glyphs instead of words: Auto
 * layout's flow strip, the text block's two alignment triples, the sizing modes
 * on a text node.
 *
 * A separate class from \`.de-agroup\` above even though they are a pixel apart,
 * because they mean opposite things and the difference has to survive someone
 * reading only the call site. This one is a VALUE — exactly one cell is always
 * chosen, and the rail behind them says the choice is among these. The action
 * group has no such invariant: none of its cells need be on, and pressing one
 * does something rather than selecting something.
 *
 * No gaps between cells, unlike the action group, and that is the same
 * distinction drawn in geometry: a continuous rail is one control, three
 * separated pills are three buttons that happen to be adjacent. Measured off
 * Figma, which draws its text-align track as unbroken grey and its Position
 * align triple with the ground showing through.
 */
.de-iseg {
  display: flex; align-items: stretch;
  min-width: 0;
  height: ${t.size.rowHeight}px;
  border-radius: ${CONTROL_RADIUS};
  background: ${t.color.bgSunken};
  /* Containing block for the chip below. */
  position: relative;
}
/*
 * THE ICON TWIN GETS THE TRAVELLING CHIP TOO.
 *
 * \`field.ts\` calls this "the icon twin of \`segmented\`", and for a while that
 * stopped being true: the word version was given a chip that slides between
 * choices and the glyph version was left teleporting its tint. The two sit
 * inches apart in the same panel — Distribution above, flow direction below —
 * so the product was answering one gesture two ways on one screen.
 *
 * Identical mechanism, identical rung, same helper in
 * \`core/travelling-surface.ts\`: one node measured against the pressed cell,
 * behind the glyphs, \`pointer-events: none\` so it cannot take a click, and
 * hidden until a real measurement exists so an unmeasured group keeps exactly
 * the per-cell tint it always had.
 */
.de-iseg-thumb {
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: var(--de-thumb-w, 0px);
  transform: translateX(var(--de-thumb-x, 0px));
  border-radius: ${CONTROL_RADIUS};
  background: ${t.color.bgRaised};
  box-shadow: inset 0 0 0 1px ${t.color.border};
  opacity: 0;
  pointer-events: none;
  transition:
    transform ${t.duration.fast} ${t.ease},
    width ${t.duration.fast} ${t.ease},
    opacity ${t.duration.fast} ${t.ease};
}
.de-iseg[data-de-thumb] .de-iseg-thumb { opacity: 1; }
.de-iseg > .de-tool {
  flex: 1; min-width: 0;
  width: auto;
  border-radius: ${CONTROL_RADIUS};
  background: transparent;
  /* Above the chip, which is an earlier sibling. */
  position: relative;
  z-index: 1;
}
.de-iseg > .de-tool:hover { background: ${t.color.bgHoverQuiet}; }
.de-iseg > .de-tool[aria-pressed="true"] {
  background: ${t.color.bgRaised};
  border-color: ${t.color.border};
  color: ${t.color.text};
}
/* Once the chip is real it owns the plate, for the reason \`.de-segment\` gives:
   two grounds at one value, one of them moving, reads as a smear. */
.de-iseg[data-de-thumb] > .de-tool[aria-pressed="true"] {
  background: transparent;
  border-color: transparent;
}

/* ---------- alignment pad ---------- */
/*
 * Nine cells in one filled block — where the parent's children sit inside it.
 *
 * It was nine bare 20x18 buttons each drawing a 10px \`Circle\` outline, on a
 * 2px grid gap with no surface behind them. Three things were wrong with that
 * and only one was cosmetic: the cells were off the 24px rhythm every other
 * control in the panel keeps, the mark was a ring at the \`mark\` rung where
 * Figma draws a 2px dot, and — the one that actually cost the user something —
 * with no container the nine buttons did not read as ONE control with nine
 * positions, they read as nine small buttons.
 *
 * So the block takes the field's own well and the cells go transparent inside
 * it. 88x56 in Figma; here it is the column width by three rows of \`space.4xl\`,
 * which keeps it proportional at whatever width the panel is dragged to.
 *
 * The chosen cell is the ACCENT, and this is the one place in the panel that
 * gets it. Everywhere else "chosen" is the neutral chip, because everywhere
 * else the control is a row of alternatives you read left to right. This is a
 * two-dimensional field where the answer is a POSITION, and a neutral chip in a
 * 3x3 grid of neutral dots is a chip you have to look for. Figma reaches for
 * its blue here too, and for the same reason.
 */
.de-pad {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(3, 1fr);
  height: ${t.space["5xl"] * 2 + t.space.md}px;
  border-radius: ${CONTROL_RADIUS};
  background: ${t.color.bgSunken};
}
.de-pad-cell {
  display: flex; align-items: center; justify-content: center;
  /* Containing block for the mark, which is stacked over the dot rather than
     replacing it — see the crossfade below. */
  position: relative;
  padding: 0;
  border: none; border-radius: ${CONTROL_RADIUS};
  background: transparent;
  color: ${t.color.textDim};
  cursor: pointer;
  transition: background ${t.duration.fast} ${t.ease}, color ${t.duration.fast} ${t.ease};
}
/* The dot is drawn here rather than asked of the icon set, because it is not an
   icon: it is the absence of a mark, sized so nine of them read as a grid of
   rests. 2px is what Figma draws and it is below the icon ramp's floor. */
.de-pad-cell::before {
  content: "";
  width: ${t.space.xs}px; height: ${t.space.xs}px;
  border-radius: 50%;
  background: currentColor;
}
.de-pad-cell:hover { background: ${t.color.bgHoverQuiet}; color: ${t.color.textMuted}; }
.de-pad-cell[aria-pressed="true"] { color: ${t.color.accent}; }
/*
 * Chosen, the dot gives way to a drawn mark — the same swap Figma makes, and
 * the reason the cell can carry a glyph child at all.
 *
 * THE SWAP IS A CROSSFADE NOW, and it took a markup change to become one. It
 * was \`display: none\` on the dot and a glyph that was only appended to the
 * cell WHILE pressed, so there were never two states for the browser to
 * interpolate between — the mark did not appear quickly, it appeared with no
 * intermediate state to have.
 *
 * \`field.ts\` mounts the glyph on every cell now and lets this rule decide
 * which of the two is showing. The dot shrinks into the mark's place rather
 * than vanishing from under it, which is what makes the nine cells read as one
 * control choosing rather than nine independently blinking.
 *
 * Both are \`scale\` and \`opacity\` only, on a 24px box that never reflows.
 */
/*
 * The \`svg\` half needs \`[data-designlayer]\` and \`[data-de-glyph]\` on it, for
 * the reason \`css/annotations.ts\` spells out on \`.de-swap > svg\`: the
 * stroke-weight rule in \`css/icons.ts\` is (0,2,1) and \`transition\` is a
 * shorthand, so at (0,1,1) this list was being replaced rather than extended
 * and the mark appeared at full size instead of arriving. The \`::before\` half
 * is untouched by that rule and keeps the plain selector.
 */
.de-pad-cell::before {
  transition: opacity ${t.duration.fast} ${t.ease}, transform ${t.duration.fast} ${t.ease};
}
[data-designlayer] .de-pad-cell > svg[data-de-glyph] {
  transition: opacity ${t.duration.fast} ${t.ease}, transform ${t.duration.fast} ${t.ease},
    stroke-width ${t.duration.fast} ${t.ease};
}
.de-pad-cell > svg { position: absolute; opacity: 0; transform: scale(0.6); }
.de-pad-cell[aria-pressed="true"]::before { opacity: 0; transform: scale(0.4); }
.de-pad-cell[aria-pressed="true"] > svg { opacity: 1; transform: scale(1); }
.de-pad-cell:focus-visible { outline: 2px solid ${t.color.accent}; outline-offset: -2px; }

/* ---------- field trailing slot ---------- */
/*
 * The dropdown that lives INSIDE a number field, which is how Figma spells
 * Fixed/Hug/Fill: \`W 708 ⌄\`, not a segmented control stacked underneath.
 *
 * Ours was the stacked one, and the cost was structural rather than visual —
 * two rows of controls for one property, so the Size group was four controls
 * tall for two numbers, and the mode was 24px away from the value it governs
 * with a second field's worth of panel between them.
 *
 * The slot is a button rather than a \`<select>\` so it can show a WORD when the
 * mode is interesting (\`Fill\`, \`Hug\`) and a chevron when it is not — which is
 * again what Figma does, and what a native select cannot be made to do without
 * drawing it twice.
 */
.de-field-trailing {
  flex: none; align-self: stretch;
  display: inline-flex; align-items: center; justify-content: center; gap: ${t.space.xs}px;
  padding: 0 ${t.space.sm}px;
  border: none; background: transparent;
  color: ${t.color.textDim};
  font-family: inherit; font-size: ${t.type.body}; line-height: ${t.type.leadingFlush};
  white-space: nowrap;
  cursor: pointer;
  transition: color ${t.duration.fast} ${t.ease}, background ${t.duration.fast} ${t.ease};
}
.de-field-trailing:hover { color: ${t.color.text}; background: ${t.color.bgHover}; }
.de-field-trailing:focus-visible { outline: 2px solid ${t.color.accent}; outline-offset: -2px; }
/* The field owns the caret's colour so a disabled axis reads as one dead
   control rather than a dead number beside a live menu. */
.de-field input[disabled] ~ .de-field-trailing { color: ${t.color.textDisabled}; }

/* The same well as \`.de-field\`, since a select is a field you pick from — and
   the same three rungs, for the reason spelled out there. */
.de-select {
  height: ${t.size.rowHeight}px;
  width: 100%;
  padding: 0 ${t.space.sm}px;
  border: 1px solid transparent; border-radius: ${CONTROL_RADIUS};
  background: ${t.color.bgSunken}; color: ${t.color.text};
  font-family: inherit; font-size: ${t.type.body};
  appearance: none; cursor: pointer;
  transition: border-color ${t.duration.fast} ${t.ease}, background ${t.duration.fast} ${t.ease};
}
.de-select:hover { background: ${t.color.bgHoverQuiet}; }
/*
 * \`outline: none\` WITH A REPLACEMENT, which is the half this rule was missing.
 *
 * It used to remove the platform's focus ring and offer a border hue as the
 * substitute. A 1px border going from \`transparent\` to \`accent\` is not a focus
 * indicator: it is thinner than the 2px the rest of this chrome draws, it is
 * the same channel the control already uses for hover and validity, and it is
 * the only thing a keyboard user gets to tell them where they are — on a
 * control that \`appearance: none\` has already stripped of every other native
 * affordance.
 *
 * The start screen met this exact bug on its own \`<select>\` and fixed it there,
 * with the argument left in \`runtime/start-screen-style.mjs\`. The inspector's
 * dropdowns never got the same pass. This is that pass: the ring is the 2px
 * \`accent\` outline every other focusable thing in the chrome wears
 * (\`.de-lint-select\`, \`.de-token-row\`, the tab strip), so focus looks the same
 * wherever it lands.
 *
 * Split across two selectors rather than one: the background and border lift
 * belong on \`:focus\`, because a select opened with the pointer should still
 * look engaged, while the RING belongs on \`:focus-visible\`, because a ring
 * painted after a mouse click is noise. That split is the cheat sheet's rule
 * and it is also what the platform does on its own.
 */
.de-select:focus { outline: none; background: ${t.color.bgHoverQuiet}; border-color: ${t.color.accent}; }
.de-select:focus-visible { outline: 2px solid ${t.color.accent}; outline-offset: 1px; }
.de-select option { background: ${t.color.bgRaised}; color: ${t.color.text}; }

/*
 * THE DISCLOSURE MARK, and the specificity note that makes it clickable.
 *
 * \`.de-select\` sets \`appearance: none\` so it can wear this panel's well rather
 * than the operating system's, which also removes the platform's own chevron.
 * Nothing replaced it, so every dropdown in the inspector was drawn as a text
 * field that happens to open a menu — indistinguishable from the read-only
 * readouts beside it until pressed.
 *
 * The caret is laid OVER the control because a \`<select>\` is a replaced element
 * and does not reliably draw its own pseudo-elements. That puts a glyph on top
 * of the thing it decorates, and in inspecting mode \`css/base.ts\` forces
 * \`pointer-events: all\` onto every \`<svg>\` in the document — so a plain
 * \`pointer-events: none\` on the wrapper is not enough, the glyph itself becomes
 * the hit target and eats the click that would open the menu. The second rule
 * names \`.de-select-caret svg\` so it outranks \`html.designlayer-inspecting
 * svg\` on specificity (0,2,1 against 0,1,1) instead of relying on which
 * stylesheet happens to be concatenated last.
 */
.de-select-shell { position: relative; display: block; min-width: 0; }
/* Room for the mark, so a long option never runs under it. */
.de-select-shell > .de-select { padding-right: ${t.space["4xl"]}px; }
.de-select-caret {
  position: absolute; top: 50%; right: ${t.space.sm}px;
  transform: translateY(-50%);
  display: inline-flex;
  color: ${t.color.textDim};
  pointer-events: none;
}
[data-designlayer] .de-select-caret svg { pointer-events: none; }
.de-select-shell:hover > .de-select-caret { color: ${t.color.textMuted}; }

/*
 * \`.de-inspector-footer\` was here: a padded column at the foot of the Design
 * tab holding Save as option / Update / Revert.
 *
 * The reason it existed was real. The saved list is absent until something is
 * saved, and Save is the only way anything ever gets saved — so the verbs could
 * not live inside a box that might not be there. The answer was to put them
 * outside it, at the bottom of the panel.
 *
 * The box is unconditional now (\`options/panel.ts\`) and the verbs are its first
 * row, so the panel has no last-row concept left to style.
 *
 * If a future section wants a footer, note what this one got wrong as well as
 * what it got right. No border of its own was correct: every section above
 * closes with a bottom hairline, and a border-top here would have landed
 * against it and read as a 2px rule. Parking the verbs nine sections below the
 * list they act on was not — that is not one group with space around it, it is
 * two groups, and a reader who found the list had no reason to look that far
 * down for the things to do with it.
 */

/*
 * \`balance\` and not the root's \`pretty\`, and centring is the whole reason.
 *
 * \`pretty\` fixes the last line and leaves the ones above it wherever they fell,
 * which is invisible in a left-aligned column and glaring in a centred one: a
 * 40/40/8-character stack reads as a shape rather than as a sentence, because
 * the eye is following two ragged edges instead of one. \`balance\` evens every
 * line, which is what a centred block of two or three lines wants and what the
 * skill reserves it for.
 *
 * Safe here for the reason it is not safe generally: browsers stop balancing
 * past a handful of lines, and an empty state that ran longer than that would
 * already be the wrong copy for an empty state.
 */
.de-empty {
  padding: ${t.space["5xl"]}px ${t.space["2xl"]}px;
  /* Centred, so the cap needs \`margin-inline: auto\` to stay centred with it.
     An empty state is the longest prose in the panel and the one a wide window
     stretches furthest. */
  max-width: ${t.type.measure}; margin-inline: auto;
  color: ${t.color.textDim};
  text-align: center;
  font-size: ${t.type.body};
  line-height: ${t.type.leadingBody};
  text-wrap: balance;
}

`
