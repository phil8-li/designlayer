/**
 * THE tooltip. One element, one geometry, one set of colours.
 *
 * This replaces three hand-rolled CSS-only tips that agreed on nothing:
 *
 *   `.de-toolbar [data-de-tip]::after`        always above, nowrap, 400ms in
 *   `.de-ann-help[data-de-tip]::after`        always above, stretched across
 *                                             the whole row, wrapped, 400ms in
 *   `.de-ann-item-actions [data-de-tip]::after`  always below, right-aligned,
 *                                             wrapped to 180px, no delay
 *
 * Each of those was right about its own surface and wrong as a rule, and each
 * one paid the same price for being a pseudo-element: `content: attr()` cannot
 * measure anything, so a tip that would run off the screen runs off the screen.
 * The two that tried to dodge that did it with geometry — pin the card to the
 * ROW so it cannot reach the panel edge, hang it off the RIGHT so it cannot
 * reach the left one — which works until the surface moves and is invisible as
 * a constraint to whoever moves it.
 *
 * So the card is drawn here and placed by `core/tooltip.ts` from real numbers.
 * This file owns everything that does not depend on where the pointer is; that
 * module owns everything that does.
 *
 * ---------------------------------------------------------------------------
 * WHY THE ELEMENT LIVES ON `<body>` AND NOT IN `.de-root`
 *
 * `.de-root` is a stacking context at 2147483000, and four surfaces in this
 * chrome deliberately sit ABOVE it on `<body>`: the annotation layer and the
 * options window at 2147483100, the app chooser's menu at 2147483250, the
 * shortcuts sheet at 2147483400. A tooltip parented into the root could not
 * reach any of them — the one element whose entire job is to be on top would be
 * the one element that is not. `Z` clears all four.
 *
 * The cost is one rule, at the bottom of this file. `css/base.ts` clamps the
 * chrome's durations under `prefers-reduced-motion` with a selector that reads
 * `[data-designlayer] *` — DESCENDANTS of a chrome element. The card carries
 * the chrome attribute itself but its parent is `<body>`, so it is a chrome
 * ROOT and the blanket rule does not reach it. The clamp is restated there
 * rather than worked around, at the same 0.01ms, so the two cannot disagree
 * about what reduced motion means.
 */

import { tokens as t } from "../tokens"

/**
 * Above the shortcuts sheet (2147483400), which is the highest surface this
 * chrome draws. Nothing is allowed over a tooltip: an occluded tip is a tip the
 * person hovering has no way to know they asked for.
 */
const Z = 2147483500

/**
 * How wide a wrapped tip gets before it takes another line.
 *
 * The three sheets this replaces said 180px (row actions), the panel's own
 * width (the help dot) and "as long as it likes" (the toolbar). 260 is the
 * inspector's width — the widest surface a tip is likely to be explaining —
 * and it holds roughly eight words of the 12px body, which is the length past
 * which a hint has stopped being a label and should be somewhere a reader can
 * keep it on screen.
 *
 * Exported because `core/tooltip.ts` decides WHEN to wrap and this file decides
 * HOW WIDE, and those are the same number: a cap the runtime does not know
 * about is a line it never switches, and a line it switches at some other width
 * is a card that wraps early or overflows. One constant, two readers.
 */
export const TIP_WRAP_WIDTH = 260

export const tooltipCss = `/* ---------- tooltip ---------- */
/*
 * Placed with \`left\`/\`top\` written by \`core/tooltip.ts\`, the way every other
 * floating surface in this chrome is placed — not by a transform. The card only
 * ever moves while it is invisible or while the pointer is already walking a
 * row, so there is no animation for a compositor to save, and inline pixels are
 * what a test can read back.
 *
 * \`bgRaised\`, where all three of the tips it replaces said \`bgSunken\` — and
 * that is a correction, not a preference. Those rules were written when
 * \`bgSunken\` was \`#121316\`, a near-black plate BELOW a near-black ground. The
 * palette retune inverted it: in dark it is now \`#383838\`, a step UP, because
 * that is where Figma puts a control surface. Left alone, the tip explaining a
 * field would have been drawn at the same value as the field, floating over the
 * row it belongs to with only a shadow to say which was which. \`bgRaised\` is
 * the role for "a surface IN FRONT of the control layer — a popover", which is
 * exactly what this is.
 */
.de-tip {
  position: fixed;
  left: 0;
  top: 0;
  z-index: ${Z};
  padding: ${t.space.sm}px ${t.space.md}px;
  border-radius: ${t.radius.md};
  background: ${t.color.bgRaised};
  color: ${t.color.text};
  box-shadow: ${t.shadow.popover};
  font-family: ${t.font.ui};
  font-size: ${t.type.body};
  font-weight: ${t.type.weightBody};
  line-height: 1.4;
  text-align: left;
  white-space: nowrap;
  opacity: 0;
  /*
   * Never hit-testable, in either state. A tooltip that takes the pointer takes
   * it away from the control underneath, and the card is placed 8px off that
   * control — close enough that a diagonal mouse path crosses it.
   */
  pointer-events: none;
  /*
   * The fade, and ONLY the fade. There is no \`transition-delay\` here on
   * purpose: the 400ms wait belongs to a timer in \`core/tooltip.ts\`.
   *
   * \`css/toolbar.ts\` records why that matters and had to solve it the other way
   * round. Its delay was a \`transition-delay\`, so the obvious reduced-motion
   * override — \`transition: none\` — would have zeroed the wait along with the
   * fade and flashed six labels at the reader least able to take it; it had to
   * leave the query alone and rely on the blanket duration clamp. With the wait
   * held in JavaScript the two are genuinely separate properties of the
   * primitive, and reduced motion can take the fade without touching the wait.
   */
  transition: opacity ${t.duration.fast} ${t.ease};
}
/*
 * Open is an attribute rather than a class so the runtime writes state in one
 * vocabulary — every other thing it reads is \`data-de-tip*\` too.
 */
.de-tip[data-de-tip-open] { opacity: 1; }
/*
 * Wrapped, for a tip that is a sentence rather than a label.
 *
 * Set from the call site (\`data-de-tip-wrap\`) for the hints that are always
 * prose, and set automatically by the runtime for any tip whose single line
 * would be wider than \`TIP_WRAP_WIDTH\` or than the window — which is the case
 * the CSS-only versions could not detect and therefore clipped.
 *
 * The cap lives HERE and not on \`.de-tip\` above, because a \`max-width\` under
 * \`white-space: nowrap\` does not wrap anything: it pins the box at 260 and lets
 * the text run out of it, so a long label would paint across the screen with
 * its background stopping a third of the way along. A width limit only means
 * anything once the line is allowed to break.
 */
.de-tip[data-de-tip-wrap] { white-space: normal; max-width: ${TIP_WRAP_WIDTH}px; }

@media (prefers-reduced-motion: reduce) {
  /*
   * The blanket clamp in \`css/base.ts\`, restated for a chrome root.
   *
   * Same value, same shape, deliberately not \`transition: none\` — see the note
   * on \`.de-tip\` above, and the longer one in \`css/toolbar.ts\`. Reduced motion
   * takes the crossfade away; the wait that keeps a label from firing while the
   * pointer is merely crossing a strip is not motion and stays.
   */
  .de-tip { transition-duration: 0.01ms !important; }
}
`
