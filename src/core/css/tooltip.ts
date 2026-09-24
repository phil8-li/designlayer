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
 * THE SHAPE, AND WHY IT IS FOUR ELEMENTS RATHER THAN ONE
 *
 * The card is a port of React Bits' `WarmTooltip`
 * (https://reactbits.dev/micro/warm-tooltip), and its motion model is what
 * decides the markup. Three things move independently and therefore cannot
 * share an element:
 *
 *   .de-tip        THE BOX ON SCREEN. Placed with a `translate()` and given an
 *                  explicit `width`/`height`, because both of those SPRING to
 *                  the next control when the pointer walks a strip of buttons.
 *   .de-tip-box    THE POP. Scale, blur and a 4px rise, all driven off one
 *                  state — open or not — so the browser owns the interpolation
 *                  and interrupting it mid-fade resumes from where it is.
 *   .de-tip-layer  THE LABEL SWAP. Two of them, alternating: while the box
 *                  travels, the old words slide out and the new words slide in
 *                  across it. One element cannot crossfade with itself.
 *   .de-tip-face   THE TEXT. Padding and typography, and the only thing whose
 *                  natural size is ever measured.
 *
 * The upstream component composes the same four out of `motion/react` and a
 * React tree. This chrome is plain DOM by policy (`core/dom.ts`: a second React
 * tree in the app's document fights the app's own reconciler), so the parts are
 * spelled out here and driven from `core/tooltip.ts`.
 *
 * ---------------------------------------------------------------------------
 * WHAT THE PORT KEPT, AND WHAT IT DELIBERATELY DID NOT
 *
 * Kept: the timings (400ms cold delay, 300ms warm window, 80ms leave grace,
 * 160ms pop, 128ms close, 140ms label swap, a 320ms travel spring), the
 * `cubic-bezier(0.23, 1, 0.32, 1)` curve, the 0.94 pop scale, the 4px pop blur
 * and rise, the 10px swap shift and its 3px blur, and the rule that the side
 * the card is on decides the transform origin.
 *
 * Dropped, because the brief was to change the behaviour and keep the look:
 *
 *   the arrow          upstream draws one by default; this chrome never has.
 *   the `<kbd>` chip   a shortcut is ` · ⌘Z` in the label here, and the three
 *                      tips this primitive replaced all spelled it that way.
 *   `#f5f5f5` ink      colour, radius, padding, shadow and type are the
 *                      chrome's tokens, unchanged from the card this replaces.
 *   the fuse           a progress hairline on the trigger during the wait.
 *                      Off by default upstream, and it would mean writing to
 *                      ~40 call sites that today only carry an attribute.
 *   the lean           a velocity-driven rotation, `lean = 0` upstream, so it
 *                      is off in the reference too.
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
 * ROOT and the blanket rule does not reach it. Its children DO match it, which
 * is why the restatement below only has to name `.de-tip`.
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

/**
 * Upstream's `EASE_OUT`, and the one curve in this file.
 *
 * Not `tokens.ease`. The chrome's shared curve is a slow-in/slow-out for a
 * surface a reader is watching arrive; this is the quintic ease-out React Bits
 * uses for the pop, and the whole character of the motion — nearly all of the
 * distance covered in the first third — is in it. Two curves on one card would
 * be the pop and the swap disagreeing about how fast the card is settling.
 */
export const TIP_EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)"
const EASE_OUT = TIP_EASE_OUT

/** Upstream `popDuration`: the pop in. */
export const TIP_POP_MS = 160
/** Upstream's close, which is `Math.round(popDuration * 0.8)`. */
export const TIP_CLOSE_MS = Math.round(TIP_POP_MS * 0.8)
/** Upstream `popScale`. */
const POP_SCALE = 0.94
/** Upstream `popBlur`, in px. */
const POP_BLUR = 4
/** Upstream `RISE`: how far the card is pushed back toward its control. */
export const TIP_RISE = 4
/** Upstream `SWAP`, in ms, and `SWAP_SHIFT`, in px. */
export const TIP_SWAP_MS = 140
export const TIP_SWAP_SHIFT = 10
/** The blur an outgoing/incoming label carries. Upstream's `blur(3px)`. */
export const TIP_SWAP_BLUR = 3

export const tooltipCss = `/* ---------- tooltip ---------- */
/*
 * The outer box: position AND size, both written inline by \`core/tooltip.ts\`.
 *
 * Positioned with a \`translate()\` rather than the \`left\`/\`top\` this card used
 * to take, and that is the port's one structural change. Travel — the card
 * sliding and resizing from one control to the next while the pointer walks a
 * strip — is a spring on four numbers a frame, and \`left\`/\`top\` put every one
 * of those frames through layout for the whole document. A transform does not.
 * The size still has to be real pixels, because the card MORPHS between two
 * labels of different lengths, but a \`width\` change on a fixed-position element
 * whose children are all absolutely positioned relayouts nothing but itself.
 *
 * \`width: max-content\` is the resting default, for the frame before the first
 * measurement lands and for anything that reads the card before it is shown.
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
  width: max-content;
  /*
   * Never hit-testable, in either state. A tooltip that takes the pointer takes
   * it away from the control underneath, and the card is placed 8px off that
   * control — close enough that a diagonal mouse path crosses it.
   */
  pointer-events: none;
  /*
   * Hidden between shows, and hidden LATE.
   *
   * \`visibility\` rather than \`display: none\` because the card has to keep its
   * box: un-hiding a \`display: none\` element and starting a transition in the
   * same task starts no transition at all, and the fix for that is a forced
   * reflow on every single hover. Transitioned with a zero duration and a DELAY
   * of the close, so the card stays paintable for exactly as long as it is
   * fading and stops being composited the instant it is done.
   */
  visibility: hidden;
  transition: visibility 0s linear var(--de-tip-pop, ${TIP_CLOSE_MS}ms);
}
/*
 * Open is an attribute rather than a class so the runtime writes state in one
 * vocabulary — every other thing it reads is \`data-de-tip*\` too.
 */
.de-tip[data-de-tip-open] {
  visibility: visible;
  transition-delay: 0s;
}

/*
 * The pop: scale, blur and rise, off one boolean.
 *
 * All three are a CSS transition and not a script-driven animation, and that is
 * the load-bearing difference from the upstream component. React Bits drives a
 * \`presence\` motion value and derives the transform from it every frame; here
 * the two endpoints are declared and the browser interpolates them on the
 * compositor. It costs no JavaScript frames at all, and interrupting it — the
 * pointer leaving 60ms into a 160ms pop — resumes from wherever the value
 * actually is, which is the one thing a hand-rolled interpolation gets wrong.
 *
 * \`--de-tip-pop\` is the duration, and the runtime sets it per transition: the
 * pop in, the shorter close, or 0ms for the opens that must not animate (a
 * second tip inside the warm window is already "up" as far as the reader is
 * concerned, and upstream jumps it too).
 *
 * \`--de-tip-rise-x\`/\`-y\` and \`--de-tip-origin\` are the side, written once per
 * show: a card above its control grows out of its own bottom edge and settles
 * upward, a card below grows out of its top and settles down.
 */
.de-tip-box {
  position: absolute;
  inset: 0;
  border-radius: ${t.radius.md};
  background: ${t.color.bgRaised};
  color: ${t.color.text};
  box-shadow: ${t.shadow.popover};
  transform-origin: var(--de-tip-origin, center top);
  opacity: 0;
  transform: translate(var(--de-tip-rise-x, 0px), var(--de-tip-rise-y, 0px)) scale(${POP_SCALE});
  filter: blur(${POP_BLUR}px);
  transition:
    opacity var(--de-tip-pop, ${TIP_POP_MS}ms) ${EASE_OUT},
    transform var(--de-tip-pop, ${TIP_POP_MS}ms) ${EASE_OUT},
    filter var(--de-tip-pop, ${TIP_POP_MS}ms) ${EASE_OUT};
}
.de-tip[data-de-tip-open] .de-tip-box {
  opacity: 1;
  transform: translate(0px, 0px) scale(1);
  filter: blur(0px);
}

/*
 * A label, centred in the box it may currently be bigger than.
 *
 * Two of these exist and they alternate. While the box springs from one
 * control's width to the next one's, the outgoing label slides one way and the
 * incoming label slides the other, both blurred — so the card reads as one
 * object being re-lettered rather than as two cards swapping places. That is
 * the effect the component is named for, and it is the reason the text is not
 * simply written into the box.
 *
 * Centred with a grid rather than with \`inset: 0\` and \`text-align\`, because
 * mid-travel the face is WIDER than the box and has to overhang both edges
 * evenly; anchored to one corner it would visibly slide out of the card.
 */
.de-tip-layer {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  /* Animated by the runtime. Declared so the resting state is unambiguous. */
  opacity: 1;
}

/*
 * The one element with a natural size, and the geometry of the card this
 * replaces, unchanged: same padding, same radius of type, same 1.4 leading.
 *
 * \`width: max-content\` because it is centred in a grid area it does not size,
 * so without it the face would take the track's width and the text would wrap
 * at whatever the PREVIOUS label happened to measure.
 */
.de-tip-face {
  padding: ${t.space.sm}px ${t.space.md}px;
  width: max-content;
  font-family: ${t.font.ui};
  font-size: ${t.type.body};
  font-weight: ${t.type.weightBody};
  line-height: ${t.type.leadingRow};
  text-align: left;
  white-space: nowrap;
}
/*
 * Wrapped, for a tip that is a sentence rather than a label.
 *
 * Set from the call site (\`data-de-tip-wrap\`) for the hints that are always
 * prose, and set automatically by the runtime for any tip whose single line
 * would be wider than \`TIP_WRAP_WIDTH\` or than the window — which is the case
 * the CSS-only versions could not detect and therefore clipped.
 *
 * The cap lives HERE and not on the card, because a \`max-width\` under
 * \`white-space: nowrap\` does not wrap anything: it pins the box at 260 and lets
 * the text run out of it, so a long label would paint across the screen with
 * its background stopping a third of the way along. A width limit only means
 * anything once the line is allowed to break.
 */
.de-tip-face[data-de-tip-wrap] { white-space: normal; max-width: ${TIP_WRAP_WIDTH}px; }

/*
 * The ruler: a face nobody ever sees, which is how the card learns its size.
 *
 * The card carries an explicit \`width\`/\`height\` at all times — it has to, the
 * travel springs them — so it can no longer be measured by looking at it. A
 * second face with the same class and therefore the same box is measured
 * instead, one \`getBoundingClientRect\` per show, and the number it returns IS
 * the card's size because the padding and the type live in one rule that both
 * of them match.
 *
 * Out of flow and \`visibility: hidden\`, so it never paints, never takes the
 * pointer and never moves anything. It is the only thing in this file that is
 * not upstream: React measures its own live \`textRef\` between render and paint,
 * which is a layout position plain DOM does not have.
 */
.de-tip-ruler {
  position: fixed;
  left: 0;
  top: 0;
  visibility: hidden;
  pointer-events: none;
  z-index: -1;
}

@media (prefers-reduced-motion: reduce) {
  /*
   * The blanket clamp in \`css/base.ts\`, restated for a chrome root.
   *
   * Only \`.de-tip\` needs restating: it is parented to \`<body>\`, so the sheet's
   * \`[data-designlayer] *\` cannot reach it, while \`.de-tip-box\` and
   * \`.de-tip-layer\` are its descendants and are already clamped there.
   *
   * Same value, same shape, deliberately not \`transition: none\`. Reduced motion
   * takes the pop, the blur and the travel away — \`core/tooltip.ts\` reads the
   * same query and stops springing — but the 400ms wait that keeps a label from
   * firing at every button the pointer merely crosses is not motion, is not a
   * transition, and stays.
   */
  .de-tip { transition-duration: 0.01ms !important; }
}
`
