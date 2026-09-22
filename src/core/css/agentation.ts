/**
 * Where Agentation's surfaces sit once there is an editor on the page too.
 *
 * Agentation is written for an app with nothing else floating over it, so it
 * paints its whole stack in a band from 99996 to 100020 and parks the bar
 * bottom-right. Both halves of that are wrong here, and neither is Agentation's
 * fault: `.de-root` is at 2147483000, so every one of those layers is painted
 * UNDER the editor, and bottom-right is where the inspector is.
 *
 * Lifting the BAR alone was the first version of this file and it was not
 * enough. The bar came forward and everything it draws stayed behind: hovering
 * a panel computed a highlight of exactly the right size and put it under the
 * panel, and a pin dropped on the inspector was filed on the server and never
 * seen. The editor is the thing being annotated here, so the layers that mark
 * it up have to clear it too — measured on :3464, where the highlight over both
 * panels was real and invisible.
 *
 * Nothing else about the component is restyled. This file must never grow into
 * a theme for somebody else's UI.
 *
 * Owned by the agentation lane rather than folded into `shellCss`: that sheet
 * is mounted by `mountShell()`, which runs inside `boot()`, and the toolbar is
 * mounted at module scope so it survives a boot that never completes. Injecting
 * it from `installAgentation` is what places the toolbar on its FIRST paint
 * rather than moving it a few hundred milliseconds later.
 */

import { tokens as t } from "../tokens"

/**
 * Just above `.de-root` (2147483000), and deliberately at the bottom of the
 * ladder above it.
 *
 * Clearing the panels is the whole requirement — a toolbar for annotating the
 * editor, and pins that mark it up, cannot be behind the editor. Everything the
 * editor raises ON TOP of its panels is a transient the designer opened on
 * purpose: the token picker (2147483200), the app chooser menu (2147483250),
 * the assets dialog (2147483300), the toast (2147483646). A permanently-visible
 * third-party layer covering any of those would be this integration making
 * itself the most important thing on screen, which it is not.
 *
 * `BAR` is five above `LAYER` rather than equal to it so the bar keeps its own
 * place at the top of Agentation's stack, which is where its author put it.
 */
const LAYER = 2147483050
const BAR = LAYER + 5

/**
 * The editor's own pill is centred in the same lane and anchored
 * `panelInset` from the bottom, so this sits one row above it: the pill's
 * height plus a gap of the same inset. That height is a literal because the
 * pill measures itself from its content — there is no token to read it from —
 * and it is checked by `test/agentation-cases.mjs`, which fails if the two
 * rows would overlap.
 *
 * Horizontally it is pinned to the right edge of the same lane.
 * `--de-bar-left`/`--de-bar-right` are what the shell already keeps the docked
 * panel widths in, so a panel the designer drags wider takes the toolbar with
 * it. Both carry a `0px` fallback, because this sheet is mounted before the
 * shell's and an undefined custom property would invalidate the whole
 * declaration rather than fall back to the component's own rule.
 */
const PILL_HEIGHT = 40
const ROW = t.size.panelInset + PILL_HEIGHT + t.size.panelInset

/**
 * Inspecting mode's `svg` override, held back at the toolbar's edge.
 *
 * `css/base.ts` forces `html.designlayer-inspecting svg { pointer-events:
 * all }` onto EVERY `<svg>` in the document, so that an outline icon in the app
 * can be aimed at and selected through its hollow centre. It is the right rule
 * for the app; it is wrong inside a toolbar that collapses its control row by
 * setting `pointer-events: none` on the buttons and letting the icons inherit.
 *
 * The result was a toolbar that looked perfectly normal and could not be
 * opened. Agentation lays its hidden row across the visible toggle, and with
 * every icon in it hit-testing again, each click landed on the glyph of a
 * button that is deliberately dead. Measured on :3464: the picker could not be
 * armed at all until this rule existed.
 *
 * Specificity rather than `!important`, and specificity aimed exactly at the
 * rule it has to outrank — (0,2,2) against that rule's (0,1,2). This is how
 * `css/panels.ts` already resolves the same collision for `.de-select-caret
 * svg`, and the reason is the same: the sheets are injected by different lanes
 * at different times, so source order is not something either can rely on.
 *
 * Naming the mode in the selector also keeps the scope honest. Outside
 * inspecting mode there is nothing to undo — Agentation's own rule is already
 * in force — so this says nothing at all about the toolbar the rest of the
 * time. It is the only declaration in this file that touches the component's
 * insides, and it cannot change what any control does: an icon is never the
 * thing a click is aimed at, and a click on one still reaches the button.
 */
const SVG_HIT_TEST = `
html.designlayer-inspecting [data-agentation-root] svg { pointer-events: none; }
`

/**
 * The whole stack, lifted by the mark every one of its layers already carries.
 *
 * `[data-feedback-toolbar]` is on all five of Agentation's top-level layers —
 * the bar, the draw canvas, the two marker layers and the hover overlay — so
 * one rule raises the set, and a layer a future release adds is raised with it
 * rather than being left behind in the old band. The child combinator keeps it
 * to those five: the attribute appears on nested nodes too, and re-declaring
 * `z-index` on a descendant of an already-raised layer is how you get a control
 * that floats out of its own bar.
 *
 * WHY NOT ONE STACKING CONTEXT ON THE ROOT, which would have preserved the
 * band exactly and been three lines shorter: the root is `display: contents`,
 * so it holds no context until it is given a box, and giving it a box makes it
 * the containing block for the `position: absolute` marker layer. Measured, not
 * reasoned: a pin sitting at (688, 388) moved to (698, 1289) the moment the
 * root became `position: relative`, because document-anchored pins resolve
 * against the initial containing block and the root's box is at the bottom of
 * `<body>`. Raising the layers where they stand changes no containing block and
 * moves no pin.
 *
 * The four non-bar layers land on one z-index and fall back to DOM order, which
 * is the one thing this rule does not reproduce exactly: it puts the hover
 * overlay above the markers rather than below them. Checked rather than
 * assumed — an existing pin still opens on click with the overlay in front of
 * it, because the overlay does not take the hit. If that ever changes, the
 * symptom is a pin that cannot be reopened, and the fix is to give the marker
 * layers a rule of their own here.
 *
 * `!important` ON THE Z-INDEX, because a stylesheet cannot outrank an inline
 * style any other way. The overlay layer is the one that holds the comment box,
 * and Agentation writes `style="z-index: 99999"` onto it the moment an
 * annotation is pending — so the rule above won the hover case, lost the case
 * that matters, and the box you type into was painted under the panel you were
 * annotating. It reads as the popup not opening at all.
 *
 * Nothing is lost by forcing it: z-index is the one property this file has any
 * business deciding, and Agentation's inline value is a number chosen for a
 * page with no editor on it. The declarations that must NOT be forced are the
 * positional ones below.
 */
const LIFT = `
[data-agentation-root] > [data-feedback-toolbar] { z-index: ${LAYER} !important; }
`

/**
 * Forced on the z-index, never on `right`/`bottom`, and no `left`/`top` at all.
 *
 * The split is the whole point of this rule. The bar's LAYER has to be forced
 * for the reason `LIFT` explains, and it has to beat `LIFT` itself now that
 * both carry `!important` — between two important declarations specificity
 * decides, and this one is (0,2,0) against (0,1,1), so the bar keeps the top of
 * Agentation's stack whichever order the two are written in.
 *
 * Its POSITION is the opposite case. The component writes a dragged position as
 * an inline `left`/`top` with `right`/`bottom` set to `auto`, so forcing either
 * of those would pin the bar to this corner forever and make it look broken
 * under the cursor. Two attribute selectors already beat Agentation's single
 * class, which is all the weight a starting position needs.
 */
export const agentationCss = `
${LIFT}
[data-agentation-root] > [data-agentation-toolbar] {
  z-index: ${BAR} !important;
  right: calc(var(--de-bar-right, 0px) + ${t.size.panelInset}px);
  bottom: ${ROW}px;
}
${SVG_HIT_TEST}`
