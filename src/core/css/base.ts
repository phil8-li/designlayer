/** Root variables, the palette, vendor-UI suppression, the app inset, and stacking order. */

import { tokens as t, themeDeclarations } from "../tokens"

/*
 * The vendored React Rewrite overlay stays loaded — we drive it headlessly for
 * fiber -> source resolution and source writes — but its chrome is replaced by
 * ours. Its drag preview and drop indicator stay: we call into them.
 */
const VENDOR_CHROME = [
  ".prop-sidebar",
  ".toolbar",
  ".tools-panel",
  ".selection-label",
  ".changelog-panel",
  ".changelog-badge",
  ".help-btn",
  ".shortcuts-overlay",
  /*
   * The vendor's marquee, which we have our own of (`canvas/marquee.ts`).
   *
   * It was drawing on every drag anywhere on the page, ours included: a 2px
   * accent bar from the press to the pointer, which on a horizontal drag is a
   * line across the screen. Invisible as a bug for as long as the only place
   * you could drag was the canvas, where a marquee is what you asked for and
   * two of them land on top of each other. Dragging a panel seam is a drag that
   * means something else entirely, and it made the stray one obvious.
   *
   * Suppressed rather than prevented, because the press cannot be kept from the
   * vendor: its listeners are on `document`, registered when it boots, which is
   * before our bundle is parsed — and `shell.ts` deliberately declaws
   * `stopPropagation` for chrome targets so OUR controls keep their gestures.
   * Ours is the marquee that decides what gets selected; this one only ever
   * drew.
   */
  ".marquee-box",
  /*
   * The vendor's toast, replaced by Sonner (`core/toast.ts`).
   *
   * Hidden rather than left to render, because both surfaces are live at once:
   * the vendor raises its own messages from inside its bundle, and those are
   * mirrored into ours by reading THIS node. Leaving it visible would show
   * every vendor message twice, in two different designs, in two corners.
   *
   * `display: none` is what makes the mirror work rather than what breaks it —
   * a hidden node still takes text, still takes classes, and still delivers
   * both to a `MutationObserver`.
   */
  ".toast",
]

/**
 * The same list, unprefixed, for injection *inside* the vendor's shadow root.
 *
 * The vendor mounts its chrome into `#react-rewrite-root`'s open shadow root,
 * so the descendant selectors below can never match it — which is why its
 * `.prop-sidebar` kept painting over our inspector at z-index 2147483645
 * despite having been named in a suppression rule since day one. A shadow
 * boundary blocks selectors, not stacking.
 *
 * One piece of vendor chrome is NOT in this list and cannot be: its onboarding
 * bar carries no class, only inline styles, so nothing here can name it. It is
 * turned off before it is built instead — see `onboardingDismissal` in
 * config.mjs.
 */
export const vendorChromeCss = `${VENDOR_CHROME.join(",\n")} { display: none !important; }\n`

/*
 * Where the palette is DECLARED, and why it is not on the editor root alone.
 *
 * The obvious selector is `[data-designlayer]`, and it is wrong twice over.
 *
 * ONE: `el()` stamps that attribute on everything it builds — 1604 elements in
 * a live session — so declaring the palette on the bare attribute re-declares
 * it on every descendant, and a directly matching declaration beats an
 * inherited one at any specificity. Flipping the theme on the root would then
 * change the root and nothing inside it. That is the same bug the `color` split
 * below documents, with the whole palette instead of one property.
 *
 * TWO: the chrome is not one subtree. Four roots are mounted on `<body>` — the
 * editor root, the options window, the token popover, and the probe span in
 * `inspector/section-design-system.ts` — and `<html>` is the only ancestor all
 * four share. A palette declared on the editor root leaves a popover dark on a
 * light page, and popovers are precisely where the inline `var()` styles in
 * `inspector/color.ts` and `inspector/section-classes.ts` are read.
 *
 * So the values are declared on `:root`, where everything in the document can
 * inherit them, and the theme attribute is written to BOTH `<html>` and the
 * editor root by `applyTheme` in `shell/toolbar.ts`. Naming both selectors
 * means the scoped switch is real rather than decorative: the editor root
 * subtree resolves from its own attribute, and a surface parked outside it
 * falls back to the document's. One writer, so they cannot disagree.
 *
 * Dark is emitted first and unconditionally — the theme the editor has always
 * been, and the one it falls back to if the attribute is never written at all,
 * which is what a browser with storage blocked and a boot that threw would
 * leave behind.
 */
export const paletteCss = `/* ---------- palette ---------- */
:root,
[data-designlayer][data-de-theme="dark"] {
${themeDeclarations("dark")}
}
:root[data-de-theme="light"],
[data-designlayer][data-de-theme="light"] {
${themeDeclarations("light")}
}
`

export const baseCss = `${paletteCss}
:root {
  --de-left: 0px;
  --de-right: 0px;
  --de-top: 0px;
  /* The toolbar's own pair, which does not collapse when the chrome hides —
     see syncInsets in shell/shell.ts. */
  --de-bar-left: 0px;
  --de-bar-right: 0px;
}

${VENDOR_CHROME.map((selector) => `#react-rewrite-root ${selector}`).join(",\n")} {
  display: none !important;
}

/*
 * Inset the app so the chrome never covers what you are editing.
 *
 * Padding on a border-box <html> rather than margins on <body>: the app sets
 * \`html.h-full\` + \`body.min-h-full\`, so a body margin would be *added* to a
 * height that already fills the viewport and put every page into overflow.
 * Padding inside a border-box root shrinks the containing block instead.
 *
 * Not a transform — a transformed ancestor would break the app's own layoutId
 * shared-element morphs (docs/agent-rules/card-reader-morph.md). The tradeoff
 * is that the app's own \`position: fixed\` chrome is viewport-anchored and does
 * not move with the inset; that is inherent to any non-transform inset.
 */
html.designlayer-active {
  box-sizing: border-box;
  padding: var(--de-top) var(--de-right) 0 var(--de-left);
}

/*
 * A design tool hit-tests what is PAINTED. \`pointer-events\` is a statement
 * about the app's own behaviour — it is not a statement about the drawing.
 *
 * shadcn's button ships \`[&_svg]:pointer-events-none\` so that a click on a
 * glyph counts as a click on the button. 58 of the 70 icons live on this app's
 * home screen inherit it, and an element the pointer cannot see never reaches
 * \`elementsFromPoint\`, so \`toSelectable\` was never handed an \`<svg>\` and no
 * icon in the app could be selected at all — which is why the inspector's Icon
 * section never rendered. The 12 icons that happened to keep \`auto\` selected
 * correctly all along; that split is what named hit-testing, not the resolver,
 * as the defect.
 *
 * \`all\` rather than \`auto\`: \`auto\` on an \`<svg>\` answers only where the glyph
 * is actually inked, and the centre of an outline icon — the point you aim at —
 * is a hole. Scoped to inspecting mode, so interactive mode hands the app back
 * its own hit behaviour unchanged. The chrome's own glyphs are swept up too and
 * do not care: a click on one still bubbles to the button that owns it.
 */
html.designlayer-inspecting svg {
  pointer-events: all;
}

@media (prefers-reduced-motion: reduce) {
  [data-designlayer] *, [data-designlayer] *::before, [data-designlayer] *::after {
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
  }
  /*
   * Reduced motion is FEWER and GENTLER, not none.
   *
   * The blanket rule above is right for hover tints and field borders, where
   * the movement is the only thing being taken away. Standing the editor down
   * is a whole surface leaving, and cutting that to 0.01ms leaves three panels
   * teleporting — the jarring change the transition exists to prevent, handed
   * to the people least able to take it.
   *
   * So the surfaces keep a crossfade and give up the travel: no slide, no
   * quarter turn. \`visibility\` stays in the transition, delayed out and
   * immediate back, because without it the element would be gone on the first
   * frame and the fade would play to nobody. Written as the shorthand so it
   * replaces the blanket's duration outright rather than negotiating with it
   * property by property.
   *
   * The toolbar is in this list for the duration only — it fades and holds
   * still for everyone now, so reduced motion has nothing left to take off it.
   * Its \`translateX(-50%)\` is centring, not motion, and is restated here
   * because the panels' \`transform: none\` beside it must not reach the bar.
   */
  .de-panel, .de-toolbar, .de-launcher {
    transition: opacity ${t.duration.fast} linear, visibility 0s !important;
  }
  .de-panel, .de-launcher { transform: none !important; }
  .de-toolbar { transform: translateX(-50%) !important; }
  .de-launcher { opacity: 0; }
  html.designlayer-chrome-hidden .de-panel,
  html.designlayer-chrome-hidden .de-toolbar {
    opacity: 0;
    transition: opacity ${t.duration.fast} linear, visibility 0s linear ${t.duration.fast} !important;
  }
  html.designlayer-chrome-hidden .de-launcher { opacity: 1; }
}

[data-designlayer] {
  box-sizing: border-box;
  font-family: ${t.font.ui};
  font-size: ${t.type.body};
  line-height: 16px;
  -webkit-font-smoothing: antialiased;
}
/*
 * Ink is declared at the ROOTS of the chrome, not on every node of it.
 *
 * \`el()\` stamps CHROME_ATTR on everything it builds — 1604 elements in a live
 * session against 4 actual roots — so declaring \`color\` on the bare attribute
 * re-asserted white on every descendant. A directly matching declaration beats
 * an inherited value at any specificity, so this silently switched inheritance
 * off for the whole editor: a surface could flip its ink and none of its
 * children would follow. That is how the selected token row came to draw dark
 * text and a WHITE check mark on the same light-indigo fill, at 1.9:1.
 *
 * \`accentFill\` cannot own its way out of this — it emits fill and ink together
 * on the surface, and the bug was that no child could hear it. \`:where()\` keeps
 * the specificity at (0,1,0), unchanged from the rule this splits.
 */
[data-designlayer]:where(:not([data-designlayer] *)) {
  color: ${t.color.text};
}
[data-designlayer] *, [data-designlayer] *::before, [data-designlayer] *::after {
  box-sizing: border-box;
}
/*
 * Every corner in the chrome is a squircle, set in one place.
 *
 * \`corner-shape\` is not inherited, so this has to name every node rather than
 * be declared once at the root — and naming them here is the point. The
 * alternative is a \`corner-shape\` beside each of the ~70 \`border-radius\`
 * declarations in this stylesheet, which is 70 chances to forget one, and a
 * single square corner in a surface of smooth ones is exactly the kind of
 * wrongness that gets noticed without being identified.
 *
 * Harmless where there is no radius: \`corner-shape\` draws nothing on a
 * \`border-radius: 0\` box, so the universal selector costs those elements only
 * the declaration. \`box-shadow\` follows the corner shape too, so the panels'
 * casts stay on the outline rather than tracing an arc the surface no longer has.
 *
 * \`:where()\` keeps it at zero specificity — a rule that reaches every element
 * in the chrome must be the thing everything else beats, or opting one control
 * out becomes an \`!important\`.
 */
:where([data-designlayer], [data-designlayer] *),
:where([data-designlayer] *::before, [data-designlayer] *::after) {
  corner-shape: ${t.cornerShape};
}
/*
 * A circle has no corners, so it does not get the corner treatment.
 *
 * These nine are the chrome's round things — the launcher disc, the numbered
 * note pins, the swatches, the two switch knobs. At \`border-radius: 50%\` the
 * corner box is the whole side, so a superellipse does not smooth these, it
 * reshapes them: the disc becomes a rounded square. That is a different object.
 * The launcher is a disc on purpose — see \`css/launcher.ts\`, where the reason
 * is that it must read as a way back into the editor and not as a badge the
 * app has grown — and a squircled pin reads as a chip rather than a map marker.
 *
 * One rule rather than a \`corner-shape: round\` on each: the principle is
 * single ("circles opt out"), so the place that states it should be single too.
 *
 * A PILL OPTS OUT FOR THE SAME REASON, and that is the case this list missed.
 *
 * It was written for the discs, and the two switch KNOBS were added to it while
 * their TRACKS were left behind. A track is 28x16 under a 16px radius, which
 * CSS clamps to 8 — the corner box is the whole side, precisely the condition
 * the paragraph above describes. So the superellipse did not smooth the cap, it
 * squared it: a circular knob sat in a rounded RECTANGLE, tangent to the
 * straight top and bottom with a crescent of track showing past its end. Two
 * different curves 1px apart on a control 16px tall.
 *
 * It is the one shape \`nest()\` cannot catch. That guard refuses a pill outright
 * — "a radius at or past half the height is the ABSENCE of a step on the ramp"
 * — which is right, because there is no offset arithmetic to do, and it means
 * nothing was ever going to check that these two curves agreed.
 */
.de-launcher,
.de-ann-marker, .de-ann-marker::before,
.de-ann-index, .de-ann-help,
.de-ann-swatch, .de-ann-swatch::before,
.de-ann-toggle, .de-ann-toggle::after,
.de-lib-switch, .de-lib-switch::after,
.de-instance-switch, .de-instance-switch::after {
  corner-shape: round;
}
/*
 * The UA's own button padding, gone — once, here, rather than in each rule that
 * remembers.
 *
 * Chrome ships \`padding: 1px 6px\` on every \`<button>\`. Every icon button in
 * this chrome then pins an explicit square — 18, 24, 32 — and with
 * \`border-box\` those twelve horizontal pixels come out of the CONTENT box, so
 * a 32px tool is really 20px wide inside and an 18px mini is really 6px. The
 * note-row actions are what this cost: a 16px glyph in a 6px box, drawn 4x16.
 *
 * Fixing that per rule is the arrangement that produced it. Three of the ten
 * icon-button classes had remembered \`padding: 0\` and the rest had not, and
 * nothing distinguishes the two groups except which one somebody had already
 * been bitten by. Resetting here means an icon button is square by default and
 * a control that genuinely wants padding says so — which every text button in
 * the chrome already does, because the UA's 6px was never enough for one.
 *
 * Wrapped in \`:where()\` so it weighs nothing. \`[data-designlayer] button\` is
 * (0,1,1) — heavier than the (0,1,0) of every \`.de-\` class in this stylesheet
 * — so as a plain selector this would not remove the UA's padding, it would
 * overrule the deliberate padding on every text button in the chrome. A reset
 * has to be the thing everything else beats.
 */
:where([data-designlayer] button) { padding: 0; }
/* Glyphs are decorative and live inside buttons. Leaving them hit-testable
   makes \`event.target\` an <svg> on half the clicks in the chrome, and every
   handler that reads a dataset off the target then reads undefined. */
/*
 * \`flex: none\` is the guard that makes a squashed glyph impossible.
 *
 * Every icon button in this chrome is a flex container, so its \`<svg>\` is a
 * flex item, and a flex item's default \`min-width: auto\` does not protect a
 * replaced element the way it protects text — the browser will happily shrink a
 * 16px glyph to 4px to fit a content box that some other rule made too narrow.
 * That is exactly what a forgotten UA \`padding: 1px 6px\` did to the note-row
 * actions: 4x16, drawn as a smear, and nothing anywhere reported an error.
 *
 * With this, the same mistake overflows instead. An icon spilling past its
 * button is seen by the first person who looks at the screen; an icon quietly
 * rendered at a quarter width is not, because it still looks like an icon.
 */
[data-designlayer] svg { pointer-events: none; display: block; flex: none; }

.de-root {
  position: fixed;
  inset: 0;
  z-index: 2147483000;
  pointer-events: none;
}
.de-root > * { pointer-events: auto; }

/*
 * Inside .de-root's stacking context, canvas chrome sits below the panels.
 * Without an explicit order the positive-z overlay layer would paint over the
 * toolbar, and its handles would swallow toolbar clicks.
 *
 * The panels are named here by the rail that holds them rather than by
 * themselves: they are flex children of \`.de-rail\` now, so the rail is the
 * child of \`.de-root\` this ordering is about. Giving \`.de-panel\` a z-index of
 * its own as well would be worse than redundant — inside the rail it would
 * raise each panel over the zero-width seam sitting on its edge, and the half
 * of the seam's grab strip that overlaps the panel would stop being grabbable.
 */
.de-overlay-layer { z-index: 1; }
.de-toolbar, .de-rail { z-index: 2; }
/*
 * Above both, and it has to be: the launcher is the only way back once the
 * editor is hidden, and while it is animating out the panels it sits over are
 * still on screen.
 */
.de-launcher { z-index: 3; }

`
