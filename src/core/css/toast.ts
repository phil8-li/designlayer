/**
 * Sonner, wearing the editor's design system.
 *
 * Two stylesheets concatenated, in this order and no other:
 *
 *   1. Sonner's own `styles.css`, verbatim, via the generated `sonner-css.ts`
 *      beside this file. It is the library's layout, stacking, swipe and
 *      enter/exit behaviour, and none of it is ours to re-derive — the moment
 *      it is retyped by hand, a version bump silently stops applying. It is
 *      copied into a `.ts` module rather than imported as a `.css` file
 *      because every jsdom suite in `test/` bundles its lane with esbuild and
 *      no output path, where a CSS import is a hard error; the long version is
 *      in `tools/build-sonner-css.mjs`.
 *   2. The overrides below, which replace every colour, radius, shadow and
 *      type size the library hard-codes with the token that already answers
 *      for it everywhere else in this chrome.
 *
 * ORDER IS THE MECHANISM, not specificity. Sonner declares its palette at
 * `[data-sonner-toaster][data-sonner-theme='light']` — two attribute
 * selectors, (0,2,0). The override block matches the same element at the same
 * weight with `[data-sonner-toaster][data-sonner-theme]`, so nothing here wins
 * by out-specifying the library; it wins by coming second. Every rule below is
 * therefore written to the weight of the rule it replaces, deliberately, and a
 * selector copied from `styles.css` should be left spelled the way that file
 * spells it.
 *
 * Both halves go into the toaster's SHADOW ROOT (see `core/toast.ts`), never
 * into the document. Sonner's selectors are unprefixed and global — a rule
 * like `[data-sonner-toast][data-styled='true'] { padding: 16px }` in the
 * document would restyle the toasts of any host app that also uses Sonner, and
 * this editor is pointed at apps it did not write. A shadow boundary is the
 * only containment that does not depend on rewriting someone else's selectors.
 */

import { tokens as t } from "../tokens"
import { sonnerCss } from "./sonner-css"

/**
 * Above `.de-root`, which sits at 2147483000.
 *
 * Sonner ships `z-index: 999999999`, which loses to the editor's own chrome by
 * three orders of magnitude — a toast reporting a failed write would be painted
 * UNDER the inspector that triggered it. Left below the vendor's own maximum
 * (2147483647) so that nothing here can cover a surface the vendor considers
 * more urgent than ours.
 */
const LAYER = 2147483646

/**
 * A signal colour tinted into the card's own ground — OPAQUE, and that is the
 * whole point of the helper.
 *
 * The first version mixed into `transparent`, which is how the rest of this
 * chrome tints a surface, and it is wrong HERE for a reason that does not apply
 * anywhere else in the package: every other tinted surface sits on a panel this
 * editor painted, and a toast sits on whatever app is underneath it. A
 * translucent error card is therefore legible or not depending on the page
 * being edited — measured at 4.6:1 over the dark chrome and collapsing to
 * roughly 1.5:1 over a white app, for the same declaration.
 *
 * Mixed into `bgRaised`, the ground the plain card already uses, the error text
 * measures 4.62:1 in the dark theme and 4.62:1 in the light one, because the
 * token flips with the theme and the ground flips with it. Same number both
 * ways, and it no longer depends on the host.
 */
const tint = (color: string, percent: number) =>
  `color-mix(in srgb, ${color} ${percent}%, ${t.color.bgRaised})`

const overrides = `
/*
 * The host is an anchor, not a box. Everything Sonner renders is
 * \`position: fixed\`, so the element holding the shadow root should occupy no
 * space and start no stacking context of its own — \`display: contents\` is the
 * only value that promises both.
 */
:host { display: contents; }

/*
 * The squircle every other corner in this chrome is cut with.
 *
 * \`corner-shape\` does not inherit, and a shadow boundary blocks the document's
 * copy of this rule, so it is restated rather than borrowed. Same \`:where()\`
 * for the same reason as in \`css/base.ts\`: a rule that reaches every element
 * must be the thing everything else beats.
 */
:where([data-sonner-toaster], [data-sonner-toaster] *) {
  corner-shape: ${t.cornerShape};
}

/*
 * \`--width\` and \`--gap\` are deliberately NOT here. Sonner writes both inline on
 * the section from its own props, and an inline declaration beats a stylesheet
 * at any specificity — so the width lives with the other Toaster props in
 * \`core/toast.ts\`, where it is actually obeyed. Setting it here as well would
 * be a value that looks authoritative and does nothing.
 */
/*
 * The toast's action button, and the figures it does not inherit.
 *
 * The rest of the card gets the chrome's typographic root for free: the shadow
 * host carries \`CHROME_ATTR\`, \`baseCss\` matches it in the outer document, and
 * inherited properties cross a shadow boundary — so \`font-variant-numeric\`,
 * \`text-wrap\` and the smoothing pair all reach in. What does not reach in is
 * the companion rule beside them, \`[data-designlayer] :where(input, …)\`,
 * because a descendant combinator stops at the boundary. Sonner's action
 * button is inside it and carries the UA's \`font\` shorthand, which resets
 * \`font-variant\` — so \`Undo 12\` would be the one string on the card with
 * proportional digits. Restated here rather than made to pierce, because a
 * shadow root's stylesheet is where a shadow root's exceptions belong.
 */
:where(button, input, select, textarea) { font-variant-numeric: tabular-nums; }

[data-sonner-toaster] {
  z-index: ${LAYER};
  font-family: ${t.font.ui};
  --border-radius: ${t.radius.md};
  /* The stack's own reflow, when a second card pushes the first back. Sonner
     runs this at 400ms; see the note on the card below for why that is the one
     number in the vendor sheet this file cannot leave alone. */
  transition: transform ${t.duration.drawer} ${t.ease};
}

/*
 * THE TOAST ON THE HOUSE CLOCK.
 *
 * This file overrides every colour, radius, shadow and type size Sonner ships
 * and, until now, not one duration or curve — so the most frequent notification
 * in the product entered over 400ms on a bare \`ease\` while the panel beside it
 * left over 240 on \`tokens.ease\`. 400 is 1.7x the longest rung this chrome has,
 * and \`drawer\` is documented as the rung for "a whole surface crossing the
 * screen edge", which is exactly what a toast sliding up from the corner is.
 *
 * Restated as the full shorthand rather than a \`transition-duration\`, because
 * the vendor's declaration (\`sonner-css.ts:102\`) names four properties with
 * three timings and a partial override would leave the rest on the old clock —
 * the same trap \`css/app-chooser.ts\` fell into by naming \`background\` and
 * changing \`color\`. \`height\` is in the list because Sonner animates the card's
 * measured height when the stack expands; \`box-shadow\` keeps the shorter rung
 * it already had, since a cast is not a surface arriving.
 *
 * The exit is left to the vendor. It has three variants keyed off swipe
 * direction and front-of-stack state, all of them keyframes rather than
 * transitions, and pinning those from here means restating machinery this file
 * does not own — where the enter is one declaration that the whole stack obeys.
 */
[data-sonner-toast] {
  transition:
    transform ${t.duration.drawer} ${t.ease},
    opacity ${t.duration.drawer} ${t.ease},
    height ${t.duration.drawer} ${t.ease},
    box-shadow ${t.duration.fast} ${t.ease};
}
/* Sonner fades the card's contents in as the stack expands, on its own 400ms.
   Same argument, same rung. */
[data-sonner-toast] > * { transition: opacity ${t.duration.drawer} ${t.ease}; }

/*
 * The palette, in place of both of Sonner's built-in themes.
 *
 * \`[data-sonner-theme]\` with no value matches whichever one the library picked,
 * so the editor's two themes are handled by the tokens themselves — every value
 * here is a \`var(--de-*)\` that \`css/base.ts\` re-declares on \`:root\` when
 * \`data-de-theme\` flips, and custom properties inherit THROUGH a shadow
 * boundary. Nothing in this file has to know which theme is up.
 */
[data-sonner-toaster][data-sonner-theme] {
  --normal-bg: ${t.color.bgRaised};
  --normal-bg-hover: ${t.color.bgHover};
  --normal-border: ${t.color.border};
  --normal-border-hover: ${t.color.borderStrong};
  --normal-text: ${t.color.text};

  --error-bg: ${tint(t.color.danger, 16)};
  --error-border: ${tint(t.color.danger, 38)};
  --error-text: ${t.color.danger};

  --success-bg: ${tint(t.color.success, 16)};
  --success-border: ${tint(t.color.success, 38)};
  --success-text: ${t.color.success};

  --info-bg: ${tint(t.color.accent, 16)};
  --info-border: ${tint(t.color.accent, 38)};
  --info-text: ${t.color.accent};

  --warning-bg: ${tint(t.color.lintWarning, 16)};
  --warning-border: ${tint(t.color.lintWarning, 38)};
  --warning-text: ${t.color.lintWarning};
}

/*
 * The card itself. Sonner's own numbers are a product surface's — 16px of
 * padding, 13px type, a 10% black cast — and this is chrome: it has to match
 * the inspector rows it appears beside, not the marketing site it was designed
 * on.
 *
 * A rich-coloured toast keeps the tinted background the block above gives it;
 * the cast and the geometry are shared, which is why they are set here once
 * rather than per type.
 *
 * THE LEADING IS A ROLE NOW, AND THE DESCRIPTION'S WAS UNDER THE FLOOR.
 *
 * These three rules carried \`16px\`, \`16px\` and \`15px\` — numbers picked to
 * match a root that was also a flat \`16px\`, which is how a leading gets copied
 * rather than chosen. On the description the copy was the damaging one: 15px on
 * the 11px \`caption\` rung is 1.36, and a toast description is the one run of
 * prose in this component. \`better-typography\` puts the floor at 1.4 for
 * anything wrapping to three lines "even in a height-constrained row", and a
 * toast is exactly that row — \`Wrote 3 changes, skipped 1 — the file moved.
 * Queued in Changes.\` is three lines at this width, set at 1.36.
 *
 * So the card and its title take \`leadingRow\` (the chrome's own) and the
 * description takes \`leadingBody\`, because it is the only part of a toast a
 * reader reads as a sentence rather than as a label.
 */
[data-sonner-toast][data-styled='true'] {
  padding: ${t.space.md}px ${t.space.lg}px;
  gap: ${t.space.md}px;
  font-size: ${t.type.body};
  line-height: ${t.type.leadingRow};
  box-shadow: ${t.shadow.popover};
}

[data-sonner-toast][data-styled='true'] [data-title] {
  font-weight: ${t.type.weightValue};
  line-height: ${t.type.leadingRow};
  /* A title is a phrase that must not be left with one word alone on line two.
     \`pretty\` is the declaration for that and costs nothing where it does not
     apply — a one-line title is unaffected. */
  text-wrap: pretty;
}

/*
 * Sonner hard-codes \`#3f3f3f\` here — a light-theme grey that is unreadable on
 * the dark chrome and wrong on the light one. It is spelled at (0,3,0) there,
 * so it is spelled at (0,3,0) here.
 */
[data-sonner-toast][data-styled='true'] [data-description] {
  color: ${t.color.textMuted};
  font-size: ${t.type.caption};
  line-height: ${t.type.leadingBody};
  text-wrap: pretty;
}

/*
 * The WORDS go back to the chrome's own ink; the GLYPH keeps the signal.
 *
 * \`richColors\` paints the whole card in the signal colour — background, border
 * and text together. On the tinted ground above, that text measures 4.62:1:
 * legible, and only just, for the one message in the editor a reader actually
 * has to act on. The chrome's own ink on the same ground measures 10.7:1 in the
 * dark theme and 14.8:1 in the light one.
 *
 * So the tint and the border carry the severity — which is what makes the card
 * readable as an error at a glance, before any word is — and the glyph carries
 * it at full strength, where a 14px mark has no contrast threshold to meet in
 * the first place because it is not text. Nothing is given up by this except
 * coloured prose.
 *
 * Spelled to beat \`[data-rich-colors='true'][data-sonner-toast][data-type=…]\`
 * (0,3,0) in Sonner's sheet, which the type selector here matches at (0,3,0)
 * and wins on order, exactly as the header describes.
 */
[data-sonner-toast][data-styled='true'][data-type] {
  color: ${t.color.text};
}

[data-sonner-toast][data-styled='true'] [data-icon] {
  height: 14px;
  width: 14px;
}
[data-sonner-toast][data-type='error'] [data-icon] { color: ${t.color.danger}; }
[data-sonner-toast][data-type='success'] [data-icon] { color: ${t.color.success}; }
[data-sonner-toast][data-type='warning'] [data-icon] { color: ${t.color.lintWarning}; }
[data-sonner-toast][data-type='info'] [data-icon] { color: ${t.color.accent}; }
[data-sonner-toast][data-styled='true'] [data-icon] > svg {
  height: 14px;
  width: 14px;
}

/*
 * The action and cancel buttons, which the editor does not use yet but which
 * \`toast()\` can be handed at any call site. Left looking like the chrome's own
 * small buttons so that the first one added does not arrive wearing Sonner's
 * black pill.
 */
[data-sonner-toast][data-styled='true'] [data-button] {
  height: ${t.size.rowHeight}px;
  padding: 0 ${t.space.md}px;
  border-radius: ${t.radius.sm};
  font-size: ${t.type.caption};
  font-weight: ${t.type.weightValue};
  /* The TEXT rung of the accent fill. This button carries a word, and the glyph
     rung is 3.53:1 under one — the split \`tokens.ts\` documents above
     \`RAIL_FILL\`. \`accentSurfaceText\` is 5.28:1, and the hover follows it
     rather than stepping back onto the glyph ramp. */
  background: ${t.color.accentSurfaceText};
  color: ${t.color.onAccent};
}
[data-sonner-toast][data-styled='true'] [data-button]:hover {
  background: ${t.color.accentSurfaceTextHover};
}
[data-sonner-toast][data-styled='true'] [data-cancel] {
  background: ${t.color.field};
  color: ${t.color.text};
}
[data-sonner-toast][data-styled='true'] [data-cancel]:hover {
  background: ${t.color.fieldHover};
}

/*
 * The focus ring the rest of the chrome wears, in place of Sonner's
 * \`rgba(0,0,0,0.2)\` halo — which is invisible on a dark ground, and this is the
 * ring a keyboard user lands on when they reach a toast with alt+T.
 *
 * \`accent\`, not \`focusHalo\`, and the difference matters on paper. \`focusHalo\`
 * is the LIGHT HALF of the note pin's two-tone ring — fixed white in both
 * themes on a stated argument (\`tokens.ts\`: the pin is drawn over the app, so
 * the editor's theme says nothing about what is behind it). A toast is not
 * drawn over the app; it is chrome on \`bgRaised\`, which on paper is \`#ffffff\`.
 * A white ring on a white card is 1:1 — the indicator was invisible in exactly
 * one of the two themes, and it was invisible for the same reason the vendor's
 * black one is invisible in the other. \`accent\` is the ring every other
 * focusable thing in this chrome wears, and it is legible on both grounds.
 */
[data-sonner-toast]:focus-visible {
  box-shadow: ${t.shadow.popover}, 0 0 0 2px ${t.color.accent};
}

/*
 * THE THREE INTERACTION STATES THIS FILE USED TO STOP SHORT OF.
 *
 * Everything above re-inks the toast at REST: the card, the four rich-colour
 * triples, the action buttons, the card's own focus ring. Sonner also styles
 * what happens when you point at the close button and when you tab onto either
 * button, and those three rules were left wearing the vendor's own primitives —
 * a light-theme palette hardcoded in the bundled sheet, which is the one thing
 * overriding \`--normal-*\` cannot reach.
 *
 * \`rgba(0,0,0,0.2)\` and \`rgba(0,0,0,0.4)\` are black halos, and the card under
 * them is \`bgRaised\` — \`#4a4a4a\` in dark, \`#ffffff\` on paper. Composited
 * against the card they come to well under the 3:1 WCAG 1.4.11 asks of a focus
 * indicator, and unlike a colour that is merely off-brand a focus ring nobody
 * can see is the difference between a keyboard user knowing where they are and
 * not. \`accent\` is the ring every other focusable thing in this chrome wears,
 * including — three rules up — the toast card itself, so a keyboard user now
 * meets ONE focus design whether they are on the card, its action, or its
 * dismiss.
 *
 * ## AND THE CLOSE BUTTON'S HOVER IS DELIBERATELY NOT TOUCHED
 *
 * It looked like the same bug and it is not, which is worth a paragraph so that
 * the next audit does not re-find it. \`[data-close-button]:hover\` does take
 * Sonner's \`--gray2\` — \`hsl(0, 0%, 97.3%)\`, a near-white the vendor declares
 * in BOTH themes — and the ✕ on it does take \`--normal-text\`, which this file
 * points at \`color.text\`. White ink on a near-white plate is 1.06:1, so on
 * paper it reads as a defect and in dark it reads as a disaster.
 *
 * Neither happens, because the two halves cannot take those values at the same
 * time. \`--normal-text\` is white only in the DARK theme, and in the dark theme
 * Sonner ships a second rule —
 * \`[data-sonner-toaster][data-sonner-theme='dark'] … [data-close-button]:hover\`
 * — that re-points the plate at \`--normal-bg-hover\`, which this file already
 * themes. On paper \`--normal-text\` is \`#1a1a1a\` and near-white is the correct
 * ground for it. Measured on the rendered card: **20.97:1** in dark and
 * **16.39:1** in light.
 *
 * An override here would have replaced both with the chrome's own hover step
 * and measured 7.82:1 and 15.44:1 — still far past the floor, still a change in
 * the wrong direction, and bought with a rule that has to be kept in agreement
 * with a vendor file forever. So: not a finding.
 */
[data-sonner-toast][data-styled='true'] [data-close-button]:focus-visible,
[data-sonner-toast][data-styled='true'] [data-button]:focus-visible {
  box-shadow: 0 0 0 2px ${t.color.accent};
}
`

/** Sonner's stylesheet, then ours. The order is the mechanism — see above. */
export const toasterCss = `${sonnerCss}\n${overrides}
/*
 * REDUCED MOTION, AND THE SELECTOR SONNER'S OWN QUERY MISSES.
 *
 * The vendor ships a reduced-motion block, and it names \`[data-sonner-toast]\`,
 * its children and the loading bar — not \`[data-sonner-toaster]\`, the list. That
 * was harmless while this file overrode no timings. It is not harmless now: the
 * stack's reflow transition above hangs off exactly the selector the vendor's
 * query omits, so a reader who asked for no motion would have got the one piece
 * of toast movement this file added and none of the rest.
 *
 * It cannot be fixed from \`css/base.ts\` either — all of this lives inside a
 * shadow root, and a document stylesheet does not cross that boundary. The
 * blanket has to be restated on this side of it, which is the same reason every
 * colour in this file is restated rather than inherited.
 *
 * \`transition: none\` rather than the chrome's 0.01ms clamp, to match the
 * convention already in force three rules above it in the same shadow root.
 * Two answers inside one stylesheet would be worse than the wrong one.
 */
@media (prefers-reduced-motion: reduce) {
  [data-sonner-toaster],
  [data-sonner-toast],
  [data-sonner-toast] > * {
    transition: none !important;
    animation: none !important;
  }
}
`
