/** The floating button the editor collapses into, and how it arrives. */

import { tokens as t } from "../tokens"

/**
 * 44 across, pinned 32 off the corner.
 *
 * The size is Agentation's, to the pixel. The inset is not — theirs is 20, and
 * this sat at 20 to match until the disc was looked at against a real app. A
 * 44px circle 20px off two edges reads as crowding the corner it is in; 32
 * gives it the air to read as floating OVER the product rather than stuck to
 * it, and it clears the scrollbars and corner affordances that live in exactly
 * that corner on the pages this editor is pointed at.
 *
 * Kept in agreement with `EDGE` in `shell/launcher.ts`, which is the margin a
 * DRAGGED disc clamps to — a dragged surface has to be able to land exactly
 * where an undragged one sits, or the resting position is somewhere the user
 * cannot choose.
 */
const SIZE = 44
const INSET = 32

/**
 * The disc's half of standing down — the other half is in \`css/toolbar.ts\`.
 *
 * ${t.duration.base} against the bar's ${t.duration.fast}, and the order is the point: the thing the
 * system takes away goes faster than the thing it hands you back, so the bar is
 * gone before the disc has finished settling rather than the two dissolving
 * through each other in the middle.
 *
 * The ${ARRIVE_DELAY} wait is half the bar's exit. Start at 0 and there are two things
 * at full opacity in two different places, which reads as a swap; wait for the
 * bar to finish and it reads as a slideshow. Halfway is where a handover is —
 * the bar is faint and still going as the disc starts to show up.
 */
const ARRIVE = t.duration.base
const ARRIVE_DELAY = "60ms"

/**
 * Where the disc starts, and it is not zero.
 *
 * Nothing in the physical world appears from nothing, so a scale that starts
 * near zero reads as a thing being CREATED rather than as a thing arriving.
 * 0.9 is small enough to be a settle rather than a pop, and it is on the same
 * curve as everything else in the chrome — the bar does not overshoot, and one
 * half of a pair bouncing while the other does not is two motions however well
 * timed.
 */
const ARRIVE_SCALE = 0.9

export const launcherCss = `/* ---------- launcher ---------- */
/*
 * The editor, collapsed to one object.
 *
 * A disc rather than a rounded square, and dark rather than accented: it sits
 * over someone else's product for as long as they want the editor out of the
 * way, so it has to read as a returning affordance and not as a badge the app
 * has grown. The lift is \`shadow.float\` — the token for a surface hanging over
 * the product rather than docked to an edge, which is exactly what this is and
 * what the panels no longer are.
 *
 * \`left\`/\`top\` are left unset on purpose. Until it is dragged, the corner
 * anchor below IS the position, so a resized window keeps it in the corner
 * with no script running; the drag writes the other pair and switches these
 * two off (see \`launcher.ts\`).
 */
.de-launcher {
  position: fixed;
  right: ${INSET}px;
  bottom: ${INSET}px;
  width: ${SIZE}px; height: ${SIZE}px;
  display: inline-flex; align-items: center; justify-content: center;
  padding: 0;
  border: 1px solid ${t.color.border};
  border-radius: 50%;
  background: ${t.color.bg};
  color: ${t.color.text};
  box-shadow: ${t.shadow.float};
  cursor: pointer;
  user-select: none;
  /* The drag is pointer-driven; without this, a touch drag scrolls the app. */
  touch-action: none;
}
.de-launcher:hover { background: ${t.color.bgHover}; }
.de-launcher:focus-visible { outline: 2px solid ${t.color.accent}; outline-offset: 2px; }
/*
 * \`pointer\` at rest, not \`grab\`, and this is the one place the two floating
 * surfaces deliberately disagree.
 *
 * The bar's ground wears \`grab\` because pressing it does nothing else — moving
 * the bar is the only thing that ground is for, and without the cursor nobody
 * would ever find out. Press this disc and the editor comes back. That is its
 * job, the drag is the secondary gesture (which is why it holds ten pixels of
 * slack before it believes one), and a cursor that advertised the secondary
 * gesture would be pointing at the wrong one of the two.
 *
 * Closed while it moves, though: by then the hand really is holding the object,
 * and the same hand closes on the bar for the same reason.
 */
.de-launcher--dragging { cursor: grabbing; }

/*
 * It is not in the DOM only while the editor is up — it is in the DOM the whole
 * time, parked at the end of its own exit.
 *
 * \`display: none\` cannot be transitioned, and \`opacity\` alone would leave a
 * 44px hole in the corner swallowing clicks meant for the app. \`visibility\`
 * does both: it is inert and untabbable while hidden, and it is one of the few
 * properties that transitions DISCRETELY — it flips at the end of the delay,
 * which is what lets the disc finish shrinking before it stops existing.
 */
.de-launcher {
  visibility: hidden;
  opacity: 0;
  transform: scale(${ARRIVE_SCALE});
  transition:
    opacity ${t.duration.fast} ${t.ease},
    transform ${t.duration.fast} ${t.ease},
    background ${t.duration.fast} ${t.ease},
    visibility 0s linear ${t.duration.fast};
}
/*
 * Showing up, in the corner, as the bar finishes leaving.
 *
 * On \`${t.ease}\`, the curve the bar fades on and the panels slide on,
 * because three surfaces moving at once on three curves is three events. That
 * curve is \`tokens.ease\` rather than a cubic-bezier written out here: it is
 * already a strong ease-out that arrives flat, which is the shape a thing
 * landing in a corner wants, and a second near-identical curve invented for
 * this one case would be a number to keep in agreement with no way to notice
 * when it had stopped being.
 */
html.designlayer-chrome-hidden .de-launcher {
  visibility: visible;
  opacity: 1;
  transform: scale(1);
  /*
   * The visibility flip waits out the same ${ARRIVE_DELAY} as the fade.
   *
   * Flipping it at 0s would leave a fully transparent 44px disc over the corner
   * of the app for the whole of the morph, swallowing any click that landed
   * there. Nothing that cannot be seen should be clickable.
   */
  transition:
    opacity ${ARRIVE} ${t.ease} ${ARRIVE_DELAY},
    transform ${ARRIVE} ${t.ease} ${ARRIVE_DELAY},
    background ${t.duration.fast} ${t.ease},
    visibility 0s linear ${ARRIVE_DELAY};
}
/* Press feedback has to beat the state rule that owns \`transform\` above. */
html.designlayer-chrome-hidden .de-launcher:active {
  transform: scale(0.95);
  transition: transform ${t.duration.fast} ${t.ease};
}
/*
 * Nothing eases while you are dragging it.
 *
 * The position is written from the pointer every frame; a transition on top of
 * that would make the disc lag the cursor by its own duration, which reads as
 * the drag being broken rather than as smoothing. Scoped through the state
 * class because that is the only rule it has to beat — it is the one that owns
 * \`transition\` whenever the button is on screen at all.
 */
html.designlayer-chrome-hidden .de-launcher--dragging { transition: none; }

/*
 * Reduced motion, and the one thing \`base.ts\` cannot reach.
 *
 * That file does nearly all of it: every duration in the chrome is clamped, the
 * panels and the disc are forced to \`transform: none\`, and all three surfaces
 * are left with a plain opacity fade — fewer and gentler, which is what the
 * preference asks for rather than nothing at all.
 *
 * What it cannot reach is a standalone \`scale\` or \`translate\`, because neither
 * is \`transform\`. Nothing in the collapse uses either of them today — the bar
 * fades and holds still — but both have been in it twice, and a reduced-motion
 * hole that reopens silently is worse than a line that costs nothing. So they
 * are neutralised by name.
 *
 * It lives beside the disc rather than in \`css/toolbar.ts\` because that file
 * must not carry a reduced-motion block at all — the obvious one there would
 * zero \`transition-property\` on the tooltips and take their 400ms delay with
 * it, flashing a label at every glyph the pointer crosses.
 */
@media (prefers-reduced-motion: reduce) {
  .de-toolbar { scale: none !important; translate: none !important; }
}

`
