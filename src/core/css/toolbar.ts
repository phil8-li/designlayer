/** Floating bottom toolbar, drawn as one pill, plus its controls and tooltips. */

import { tokens as t, accentFill, accentFillHover, accentFillText, accentFillTextHover, nest } from "../tokens"

/*
 * The strip's geometry, written here rather than added to the token file.
 *
 * It used to be declared from the outside in: `tokens.size.toolbarHeight` fixed
 * the bar at 36 and `tokens.size.toolSize` its buttons at 28, so the space
 * between them was whatever was left over. Move either number and the row
 * silently re-centres inside a height nobody re-derived — which is how the bar
 * ended up 36 tall around 34 of content. The pill is built from the inside out
 * instead: a square, the padding wrapped around the row of them, and a height
 * that is simply the sum. There is no third number to keep in agreement.
 *
 * These sit in this file and not in `tokens.ts` because they are not shared
 * vocabulary. Nothing else in the chrome draws a 32px square or nests at this
 * padding, and the token file is read by every surface that does.
 */
const TOOL = 32
/*
 * The gap between two squares in a cluster, named off the scale rather than
 * written as a digit.
 *
 * It was a bare `2` — on the scale by coincidence, and nothing said so. The row
 * was measurably tight at that step: ten glyphs 2px apart read as one continuous
 * strip of ink rather than as ten targets, and the cluster breaks had to do all
 * the parting on their own. `space.sm` is one rung up and the same rung the
 * pill's own inset sits on, so the air around a square now matches the air
 * between two of them.
 */
const GAP = t.space.sm

/**
 * The pill's hairline, named because the nest below has to count it.
 *
 * `border-radius` is measured on the outer edge, so this 1px sits between the
 * pill's curve and the squares' — see `nest` in tokens.ts, which was written
 * after this bar spent its whole life one pixel out of true.
 *
 * Its COLOUR is `tokens.color.border`, and the retune left it alone on purpose.
 * The obvious worry was that a hairline tuned against a near-black ground would
 * disappear against `#2c2c2c`, and it does not: `border` is `rule(14)`, a mix
 * with the ground rather than a fixed grey, so the step is re-cut whenever the
 * ground moves. Measured 1.54:1 against the old `#1c1d21` and 1.56:1 against
 * the new ground — the same line. What actually improved is the thing the line
 * is there to help with: this pill floats over an app of unknown colour, and
 * against a dark page its ground went from 1.01:1 (invisible) to 1.19:1. The
 * 3:1 of WCAG 1.4.11 is not the floor here — the pill is a container, its
 * controls are the components, and what identifies it is an opaque ground plus
 * `shadow.float`, not this rule.
 *
 * (Both app-page numbers are against `#1e1e1e`, which is the ground a dark app
 * is most likely to be sitting at; against pure black it is 1.25:1 then and
 * 1.50:1 now. The retune made the pill easier to find over a dark page and
 * slightly harder over a white one — 16.84:1 to 13.97:1, which is nowhere near
 * anything that matters.)
 */
const HAIRLINE = 1

/**
 * The pill, its padding, and the radius every square inside it wears — one
 * decision, because they are not separable.
 *
 * `radius.xl` outside and a `space.sm` gap to the squares leaves `radius.lg`
 * inside: a step on the ramp, and the radius the squares already wore. What
 * moved is the PADDING. It now reads one pixel under the spacing step because
 * the border takes that pixel, so the distance between the two CURVES is the 4
 * the scale asked for rather than the 5 the box model was quietly using.
 */
const BAR = nest({ of: ".de-toolbar", outer: t.radius.xl, inset: t.space.sm, hairline: HAIRLINE })

/** The lift, which is most of what makes this read as floating. */
const LIFT = t.shadow.float

/**
 * How long the bar takes to stand down, and it is only a fade.
 *
 * ${t.duration.fast}. The editor collapses by getting out of the way, not by going anywhere:
 * the bar fades out where it stands, the panels slide off their own edges, and
 * the disc appears in its corner. Nothing travels and nothing changes shape, so
 * there is nothing for a longer duration to describe — at this length the eye
 * reads "it went" rather than "it is going", which is the correct report for a
 * control pressed many times a session.
 *
 * This was briefly a 240ms morph: the pill contracting to a 44px disc and
 * carrying itself to wherever the launcher was parked. It read as one
 * continuous object, and it cost the two surfaces their independence — they had
 * to share a position for the morph to have somewhere to land, so dragging
 * either moved both. Two surfaces you can park separately is worth more than a
 * quarter-second of continuity on a control this ordinary.
 */
const DEPART = t.duration.fast

export const toolbarCss = `/* ---------- toolbar ---------- */
/*
 * No height declaration, on purpose: ${HAIRLINE} + ${BAR.padding} + ${TOOL} + ${BAR.padding} + ${HAIRLINE} is the
 * height, and the source of that sum is the constants above this template.
 *
 * The radii nest rather than compete — ${BAR.outer} on the pill, ${BAR.radius} on every
 * child — and the offset between the two curves is the ${BAR.inset}px \`BAR\` declares,
 * not the padding you can read off the rule below. Those differ by the border.
 */
/*
 * Centred on the WINDOW, and it STAYS PUT when a panel is toggled.
 *
 * It was centred on the canvas — the strip between the two insets — which is
 * the better arrangement in any single screenshot and the wrong one in use.
 * The canvas is ${t.size.panelWidth}px narrower with the layers panel up and ${t.size.inspectorWidth}px narrower with
 * the inspector up, so its middle moves by half of whichever panel was
 * toggled: pressing either button slid the whole bar ~130px sideways, and the
 * button that did it slid out from under the pointer along with it. A designer
 * toggling a panel is looking at the panel, not at the toolbar, so a row of
 * controls that relocates itself while they are reading somewhere else is a row
 * they have to find again — including the toggle they just pressed, if they
 * meant to press it twice.
 *
 * The bar is not in either panel's layout. It floats over all of it, and the
 * window is the one frame of reference that does not move when the panels do.
 *
 * What canvas-centring was PROTECTING is real and is now held by the clamp
 * instead: a window-centred bar on a narrow viewport with both panels out can
 * reach under one of them. \`anchor\` in \`shell/toolbar.ts\` restates the two
 * numbers below so \`installDrag\` can test exactly that, and nudges the bar
 * clear only when it would genuinely be covered — leaving it alone, and
 * bottom-anchored by this rule, every other time. The two must agree.
 *
 * \`max-width\` still reads \`--de-bar-*\`, and still should: a bar wider than the
 * canvas cannot be clamped anywhere good, so it gives up width before it gives
 * up its place. That pair rather than \`--de-left\`/\`--de-right\` because it does
 * NOT collapse while the chrome is hidden, so the pill does not re-flow in the
 * frame its fade begins. See \`syncInsets\`.
 */
/*
 * The ground between the controls is a HANDLE, and says so before it is used.
 *
 * \`grab\` is the only part of a drag affordance that exists before the drag —
 * nothing about a dark pill suggests it can be moved, and a feature nobody
 * discovers is a feature that was not built. The squares inside keep their own
 * \`pointer\` (see \`.de-tool\`), so the cursor also draws the line the gesture
 * draws: over a control it is a control, over the ground it is the bar.
 *
 * \`user-select: none\` because a press on this ground is the start of a drag and
 * never the start of a selection: the browser anchors a caret at whatever the
 * pointer maps to and paints a highlight across the page while the bar moves —
 * two gestures from one press, one of which the user did not ask for. The
 * chooser link's word is what made that visible, and the word has gone to the
 * left panel; the guard stays, because what it prevents belongs to the gesture
 * rather than to whatever happens to be under it. \`touch-action: none\` for the
 * same reason the disc has it: without it a touch drag scrolls the app instead
 * of moving the bar.
 *
 * Inline \`left\`/\`top\` from \`shell/toolbar.ts\` override the two below once the
 * bar has been dragged, or for as long as a panel would otherwise cover it;
 * \`bottom\` is switched off at the same time, since the pill cannot be anchored
 * to both edges at once. Absent both of those the rule below is the whole of
 * the bar's position, which is the common case and the reason it is worth
 * keeping CSS in charge of it.
 */
.de-toolbar {
  position: fixed;
  bottom: ${t.size.panelInset}px;
  left: 50vw;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  max-width: calc(100vw - var(--de-bar-left) - var(--de-bar-right) - 24px);
  padding: ${BAR.padding};
  background: ${t.color.bg};
  border: ${HAIRLINE}px solid ${t.color.border};
  border-radius: ${BAR.outer};
  box-shadow: ${LIFT};
  white-space: nowrap;
  cursor: grab;
  user-select: none;
  touch-action: none;
}
/*
 * While it is moving, the whole pill is one object and nothing inside it is.
 *
 * The cursor stays closed the entire time, including over the squares, because
 * the hand is holding the bar and not whatever happens to be under it. The
 * children stop hit-testing for the same reason: dragging across nine buttons
 * would otherwise light each one's hover tint and arm each one's tooltip in
 * turn, so a bar being moved would flash its way across the screen.
 *
 * Nothing here transitions. The position is written from the pointer every
 * frame, and a transition on top of that makes the bar lag the cursor by its
 * own duration — which reads as the drag being broken rather than as smoothing.
 */
.de-toolbar--dragging { cursor: grabbing; }
.de-toolbar--dragging > * { pointer-events: none; }
/*
 * Standing down: the bar fades out where it stands.
 *
 * The editor gets out of the way in three separate motions that happen at once
 * — this fade, the panels sliding off their own edges, and the disc appearing
 * in its corner — and they are deliberately not pretending to be one. Nothing
 * here travels and nothing changes shape.
 *
 * Two richer versions of this have been tried and both were given up, for the
 * same reason each time:
 *
 *  - A \`translateY\` through the bottom edge, alongside the panels leaving by
 *    theirs. Three surfaces exiting by three different edges is one motion too
 *    many for a toggle pressed this often.
 *  - A morph: the pill contracting to a 44px disc and carrying itself to
 *    wherever the launcher was parked, over ${t.duration.drawer}. It genuinely read as one
 *    continuous object, and the price was that the bar and the disc had to
 *    SHARE a position for the morph to have somewhere to land — so dragging
 *    either moved both, and neither could be parked on its own. Two surfaces
 *    you can put where you want beats a quarter-second of continuity.
 *
 * What survives from both attempts is the one rule that outlived them:
 * \`transform\` must never be in this transition list. The centring
 * \`translateX(-50%)\` lives on that property, so transitioning it animates the
 * centring offset itself — the bar sliding sideways as the canvas widens under
 * it. Opacity is the only thing that moves here, and that is the point.
 *
 * Coming back is the same ${DEPART} with no delay. The disc is already leaving on
 * its own, and a bar that waited would read as having been fetched from
 * somewhere rather than as having been there the whole time.
 */
.de-toolbar {
  transition:
    opacity ${DEPART} ${t.ease},
    visibility 0s;
}
html.designlayer-chrome-hidden .de-toolbar {
  visibility: hidden;
  opacity: 0;
  /*
   * Inert from the first frame, not from the last.
   *
   * \`visibility\` is what makes the parked bar untabbable, and it can only flip
   * at the END of the fade — otherwise the transition plays to nobody. So for
   * ${DEPART} there is a fading pill over the app that still hit-tests. This is the
   * line that stops a click aimed at the app landing on chrome nobody can see.
   */
  pointer-events: none;
  transition:
    opacity ${DEPART} ${t.ease},
    visibility 0s linear ${DEPART};
}
.de-toolbar-group {
  display: flex;
  align-items: center;
  gap: ${GAP}px;
}
/*
 * There is nothing between the groups, because there is one group.
 *
 * Two treatments have now been spent parting clusters in this bar and both were
 * withdrawn for the same reason. First a hairline, on the condition that a break
 * marked a change in STAKES — screen on one side, disk on the other — which
 * stopped being true when the last control that wrote to a file left. Then air
 * alone, ${GAP}px inside a cluster against ${t.space.lg} between, which parts squares from
 * squares but cannot say which of the breaks means more than the others.
 *
 * Every control here is a 32px square and there are eight of them. A run that
 * short is read straight through, so the partition was buying a grouping the
 * reader was not using and charging two stray gaps for it. The order the
 * buttons are appended in carries what the clusters carried; see the derivation
 * at the \`append\` call.
 *
 * The \`+\` rule is deleted rather than left to match nothing, on the same terms
 * the \`--seam\` modifier was: a second group has to re-argue its break rather
 * than inherit spacing that is already sitting here waiting for it.
 */

/*
 * The generic icon button. It is NOT only the bar's — the inspector's align
 * strip and every other \`iconButton\` wear it too, inside a 240px panel where
 * ${t.size.toolSize} is already the largest square that fits a row. So this rule stays as
 * the panels need it and the bar's own version is the override below.
 */
.de-tool {
  width: ${t.size.toolSize}px; height: ${t.size.toolSize}px;
  display: inline-flex; align-items: center; justify-content: center;
  border: none; border-radius: ${t.radius.md};
  background: transparent; color: ${t.color.textMuted};
  cursor: pointer;
}
/* The quiet rung, and it survived the ground moving. \`bgHoverQuiet\` is a mix
   WITH the ground, so the step is cut fresh whenever the ground is: it measured
   1.30:1 against the old near-black and measures 1.33:1 against \`#2c2c2c\` — the
   same tint, not a tint that faded. Figma's own hover is \`#444444\`, one rung up
   at \`bgHover\` (1.46:1); moving to it would have to move the pressed-toggle
   hover below in the same breath, since a toggle that hovers differently from
   its neighbours reads as a different kind of control, and that pair is shared
   with every \`iconButton\` in the panels. */
.de-tool:hover { background: ${t.color.bgHoverQuiet}; color: ${t.color.text}; }
/*
 * ON for a square in neither the bar nor a panel — the fallback both of those
 * override, and the last rule here still drawing with the canvas's paint.
 *
 * It was \`selectionSurface\`: an 18% wash of the accent whose documented job is
 * the overlay drawn ON TOP of a selected element, where the page under review
 * has to show through. Nothing shows through a button, and a wash resolves to a
 * different colour on every ground it lands on — the exact failure \`accentSoft\`
 * was made opaque to end. Over the bar's ground the wash comes out \`#3a4751\`
 * against \`accentSoft\`'s \`#4a5878\`: a desaturated teal-grey beside Figma's
 * violet-grey selection tint, near enough to read as a mistake and far enough
 * to read as a second colour.
 *
 * So the fallback now says what the two rules that actually get reached say.
 * \`.de-panel .de-tool[aria-pressed="true"]\` is already this pairing — a tinted
 * plate under accent ink, Figma's treatment for a standalone on/off — and the
 * bar's own override below is the solid fill, which a ${TOOL}px square in a row of
 * eight has the room to carry. The mark measures 3.76:1 on the plate in dark
 * and 3.77:1 in light, against the 3:1 a glyph is owed — the two themes land on
 * the same ratio because both pairings are now Figma's own published
 * \`icon-brand\` on its own \`bg-selected\`.
 */
.de-tool[aria-pressed="true"] { background: ${t.color.accentSoft}; color: ${t.color.accent}; }
.de-tool:focus-visible { outline: 2px solid ${t.color.accent}; outline-offset: 1px; }
/* Ink, not opacity — see \`textDisabled\`. A fade takes the glyph and the square
   under it down together, so what survives depends on whatever is behind the
   button; naming the ink leaves the fill where the theme put it. Remeasured on
   the retuned ground, because the number that stood here was read off the old
   near-black one: 6.35:1 on the bar's \`#2c2c2c\` and 4.88:1 on paper. That
   clears both floors the one role has to serve — 3:1 for a mark, and the 4.5:1
   owed to the disabled LABEL it also draws on \`.de-button\` below. */
.de-tool[disabled] { color: ${t.color.textDisabled}; cursor: default; }

/*
 * The same button in the bar, where it has room and no row to line up with.
 *
 * Three ink tiers, and no two of them step in the same currency: resting is
 * muted ink on the bar's own ground, hover adds a surface AND takes the ink to
 * full, and ON is the accent as a fill. A state told apart from its neighbour by
 * hue alone would be no state at all at a glance, so every step changes
 * something that does not require holding two swatches side by side.
 *
 * ON used to be the canvas's 18% wash, which is a tint built to let the page
 * show THROUGH a selected element. Nothing shows through a ${TOOL}px button, so the
 * wash was paying for a transparency nobody needed and reading as a hover that
 * had got stuck.
 *
 * WHAT THE FILL IS, AND WHY IT IS NOT PALE ANY MORE
 *
 * \`accentSurface\` is \`#0c8ce9\`, Figma's published \`bg-brand\` — the fill under
 * its own selected tool — under a WHITE mark. Both halves of that pair moved together and
 * both had to: the fill was the design system's light indigo \`#a1bbff\` beneath
 * near-black ink, which is a pale plate with a dark glyph on it — the washed-out
 * chip this bar was reported for, and the reason \`onAccent\` is now white in
 * both themes rather than flipping with the theme the way this note used to say.
 *
 * Measured: the plate stands 3.95:1 clear of the bar's ground in dark and
 * 4.23:1 clear of paper, past the 3:1 WCAG 1.4.11 asks of a state you have to
 * be able to see. The mark on it is 3.53:1 dark and 4.23:1 light — past the 3:1
 * a glyph is owed, and deliberately short of the 4.5:1 a WORD is owed, which is
 * why a fill carrying a label takes \`accentFillText\` instead and this one never
 * gets a label put on it.
 *
 * Still emitted as a pair. A rule that sets one half is a rule that can leave
 * the other behind — see \`accentFill\` and the \`onAccent\` row in tokens.ts, and
 * the disabled pill further down, which is what that failure looks like.
 */
/* The radius is READ off the pill's nest, never picked to match it. It happens
   to equal \`radius.lg\` today; if the pill or its padding moves, this moves with
   them instead of staying behind as a number that used to agree. */
.de-toolbar .de-tool {
  width: ${TOOL}px; height: ${TOOL}px;
  border-radius: ${BAR.radius};
  transition:
    background ${t.duration.fast} ${t.ease},
    color ${t.duration.fast} ${t.ease},
    transform ${t.duration.snap} ${t.ease};
}
.de-toolbar .de-tool[aria-pressed="true"] { ${accentFill} }
.de-toolbar .de-tool[aria-pressed="true"]:hover { ${accentFillHover} }
/*
 * The two panel toggles opt OUT of the chip, and report themselves in the mark.
 *
 * The chip is worth its ink on a MODE. A mode is a claim about what the next
 * click will do, there is nothing on screen to check it against until you make
 * one, and the accent is the loudest thing this bar can say. A panel toggle is
 * the opposite: press it and a whole side of the screen appears. Lighting the
 * square as well is the third report of one fact — the panel, the filled glyph,
 * and then a colour — and it costs something real, because two accent squares
 * in one row stop the eye sorting "what a click does" from "what is on screen".
 *
 * So the fill in the glyph carries it alone (\`quiet\` in \`shell/toolbar.ts\`),
 * and the square keeps the hover it has at rest — pressed or not, a toggle that
 * stops answering the pointer reads as disabled.
 *
 * THE INK DOES NOT MOVE EITHER, and that is the part that changed. Pressed used
 * to take the glyph to full \`text\` while rest left it at \`textMuted\`, so the
 * pair was reporting itself twice over — a solid mark AND a brighter one. Two
 * signals for one bit is not redundancy here, it is a mismatch: the brightness
 * step is the same step every OTHER square in the row spends on hover, so a
 * pressed toggle sat permanently at the ink its neighbours only reach under the
 * pointer, and the row read as though two buttons were being hovered at once.
 *
 * Solid-or-hollow needs no reference and no second colour. The ink is the
 * rung's own \`textMuted\` in both states, and hover still takes it to \`text\` in
 * both — so the one thing colour says here is "the pointer is on me", which is
 * the only thing it says anywhere else in the bar.
 *
 * After the two rules above, not before: same specificity, so this wins only by
 * sitting later in the sheet.
 */
.de-toolbar .de-tool--quiet[aria-pressed="true"] {
  background: transparent;
  color: ${t.color.textMuted};
}
.de-toolbar .de-tool--quiet[aria-pressed="true"]:hover {
  background: ${t.color.bgHoverQuiet};
  color: ${t.color.text};
}
/*
 * The press, which every control in this bar now needs and none of them had.
 *
 * A row of nine glyphs answers hover with a tint, and a tint is also what a
 * pressed toggle wears — so on the toggles the only feedback for the press
 * ITSELF was the state arriving, which lands a frame or two later and is
 * indistinguishable from a click that missed. 6% at ${TOOL}px is about 2px of
 * travel: below that the press cannot be felt, above it the glyph starts to
 * look like it is being pushed through the bar.
 *
 * Not on a disabled control. A button that cannot act must not answer a press
 * as though it did — that is the one case where the feedback would be a lie.
 */
.de-toolbar .de-tool:active:not([disabled]) { transform: scale(0.94); }

/*
 * The commit, armed: accent as INK, never as a fill.
 *
 * The fill is taken. A pressed panel toggle wears it, and two accent-filled
 * squares four glyphs apart would say the same thing about two controls that do
 * not resemble each other at all — one reports a panel is open, the other is
 * the only button here that writes a file. This is the argument that kept the
 * old mode pill off \`.de-button--primary\`, made again now that both controls
 * are the same square.
 *
 * So the difference is carried in the ink, and the thing it reports is not a
 * state but a READINESS: \`textDisabled\` while there is nothing to write,
 * \`accent\` the moment a change is waiting. The pair used to be two opacities —
 * 35% against 75% — which is the technique \`textDisabled\` exists to replace,
 * and the ratios once quoted here were read off the old near-black ground.
 * Remeasured on \`#2c2c2c\`: 6.35:1 for the dead state, 7.41:1 for the armed one.
 *
 * Both of those are comfortably readable and they are close in LUMINANCE, so
 * the thing separating them is hue — a grey mark against a blue one. That is
 * weaker than the rest of this bar's steps by design here (the fill is taken,
 * see above), and it is the one place in the toolbar where a reader who cannot
 * sort blue from grey gets no second cue. Nothing renders this rule today: the
 * committer moved to the Changes tab, and \`toolbar-cases.mjs\` keeps the rule
 * pinned so the argument above is not re-litigated by accident.
 */
.de-toolbar .de-tool--commit:not([disabled]) { color: ${t.color.accent}; }

.de-button {
  height: 24px;
  padding: 0 ${t.space.md}px;
  display: inline-flex; align-items: center; gap: ${t.space.md}px;
  border: none; border-radius: ${t.radius.md};
  background: ${t.color.bgRaised}; color: ${t.color.text};
  font-family: inherit; font-size: ${t.type.body}; font-weight: ${t.type.weightValue};
  cursor: pointer;
}
/*
 * A hover has to move AWAY from the surface it lifts off, and in dark this one
 * used to move toward it.
 *
 * The retune put \`bgRaised\` at \`lift(14)\` = \`#4a4a4a\` — a popover sits a clear
 * step above the control layer, which is right — while \`bgHover\` stayed at
 * \`lift(12)\` = \`#454545\`, BELOW it. So a plain pill in the dark chrome got very
 * slightly darker when you pointed at it: 1.08:1, in the wrong direction. Light
 * was unaffected, because paper recesses and \`#ffffff\` to \`#eaeaea\` is already
 * the right way.
 *
 * \`bgRaisedHover\` is the role that was missing — the relationship \`fieldHover\`
 * has to \`field\`, applied one rung up. Borrowing \`fieldHover\` itself would have
 * been two surfaces answering to one name.
 */
.de-button:hover { background: ${t.color.bgRaisedHover}; }
/*
 * A filled button takes its ink from the fill's own pair rather than inheriting
 * the shell's, and it takes the DARKER of the two accent fills because it is
 * carrying a word.
 *
 * \`accentFillText\` is \`#0a6dc2\` dark and \`#0768cf\` light — Figma's published
 * \`bg-brand-hover\` and \`bg-brand-secondary\`, one rung down each theme's brand
 * ramp. Under white they measure 5.28:1 and 5.40:1, clearing the 4.5:1 a 12px
 * label is owed. The fill the squares above wear is 3.53:1 dark and 4.23:1
 * light: right for a glyph, not for a word. Two roles rather than one
 * compromise blue; see \`RAIL_FILL_TEXT\`.
 *
 * This note used to say the dark pair was a light indigo under near-black ink
 * at 1.9:1. That was true of the palette before the retune and is not true of
 * anything now: both themes put WHITE on a saturated blue.
 *
 * The hover defect this note used to report is fixed. \`accentFillHover\` is
 * derived from the GLYPH fill and is therefore lighter, so using it here walked
 * the label toward the white ink sitting on it and under the floor;
 * \`accentFillTextHover\` takes the same \`color-mix(in srgb, INK 14%, …)\` step
 * from the darker fill instead, and the label ends at 6.35:1 dark and 6.45:1
 * light — further clear of the floor hovered than at rest.
 */
.de-button--primary { ${accentFillText} }
.de-button--primary:hover { ${accentFillTextHover} }
.de-button--danger:hover { background: ${t.color.danger}; }
/*
 * No pressed treatment for the text pill any more.
 *
 * There was one — the accent as ink and as a hairline over a wash of itself,
 * written so a pressed MODE could not be mistaken for the primary ACTION's
 * filled pill. The mode switch was its only user and is a square now, and a
 * vocabulary kept for nobody is a vocabulary the next person matches something
 * against by accident. The argument it existed to make survives on the squares:
 * see \`.de-tool--commit\` above.
 */
/*
 * Disabled owns BOTH halves of the pair, because owning one is what broke it.
 *
 * This rule used to swap the fill to \`bgRaised\` and dim the whole button to
 * \`opacity: 0.4\`. On the plain pill that was merely faint. On the PRIMARY pill
 * it was invisible: back then \`.de-button--primary\` set a near-black ink to sit
 * on a light-indigo accent, this rule took the accent away and left the ink,
 * and "Send to agent" went out as near-black text on a near-black plate.
 * Measured in the running editor at 1.06:1 — a contrast ratio of 1 is two
 * identical colours.
 *
 * So the lesson is not "pick a better opacity", it is that a state which
 * replaces a variant's fill has to replace that variant's ink in the same
 * breath. Fill and ink are one decision; every rule that touches one of them
 * alone is a rule that can put unreadable text on screen.
 *
 * \`textDisabled\` on \`bgRaised\` — the role this rule actually names, where the
 * note here used to say \`textDim\` and quote ratios read off the old near-black
 * ground. Remeasured: 4.58:1 in dark and 4.88:1 in light, against the enabled
 * pill's 8.86:1 and 17.40:1. So it still reads as switched off, and it still
 * reads. Dark is the tight one, four hundredths over the floor, and it is tight
 * because \`bgRaised\` climbed to \`#4a4a4a\` in the retune; if that rung moves up
 * again this pairing is the first thing that fails. WCAG would let the whole
 * question go — 1.4.3 exempts an inactive control from contrast entirely — and
 * the chrome does not take the exemption, here or anywhere: a disabled Send is
 * the state a designer stares at while working out what the button still wants
 * from them, and "you cannot press this" is not the same message as "you cannot
 * read this".
 *
 * No \`opacity\`: it dims the fill and the ink by the same factor, which is what
 * let the two drift together in the first place, and it would fade the focus
 * ring of a control that is still focusable.
 */
.de-button[disabled] {
  cursor: default;
  background: ${t.color.bgRaised};
  color: ${t.color.textDisabled};
}
.de-button:focus-visible { outline: 2px solid ${t.color.accent}; outline-offset: 1px; }

/*
 * Nothing in the bar wears \`.de-button\` any more, and three rules went with the
 * one control that did.
 *
 * All three were the chooser link's. \`.de-button\` stands 24 tall, which is a
 * panel row's height; dropped into this ${TOOL}px strip it floated with ${(TOOL - 24) / 2}px of
 * air above and below and the bar read as two courses of furniture rather than
 * one row, so it was given the square's height and radius. Its press took less
 * travel than the squares get, because the same 2px across a pill three times
 * as wide reads as a wobble. And an anchor had to be told twice that it is not
 * a link, since the underline and the user agent's own link colour made the one
 * control in the strip that left the page look like a stray piece of the app
 * that had got into the chrome.
 *
 * The link is a control at the top of the left panel now — not in a row of
 * squares, and not an anchor — so all three arguments belong to that surface
 * and none of them is answered here. Anything that puts a word back in this bar
 * has to make them again rather than find them waiting.
 */

/*
 * \`.de-button--mode\` used to be styled here — a pill that pulled its leading
 * padding in by the optical margin its arrow carried. The mode switch is a
 * square now and the class survives only as the name two suites and the
 * launcher-parity check address it by, so there is nothing left for it to
 * declare. The square it wears comes from \`.de-tool\` like everything else.
 */

/*
 * TOOLTIPS ARE NOT DRAWN HERE ANY MORE.
 *
 * There was a \`.de-toolbar [data-de-tip]::after\` block: a CSS-only card pinned
 * above the control, 400ms in and instant out. It has moved to
 * \`css/tooltip.ts\`, and with it the two sibling implementations in
 * \`css/annotations.ts\` — three hand-rolled tips with three geometries for one
 * idea.
 *
 * The reason it had to leave is the one thing a pseudo-element cannot do:
 * measure the viewport. This card was \`left: 50%; translateX(-50%)\`, so on the
 * bar's outermost tool it ran off the side of the screen, and there is no
 * expression in CSS that notices. The shared one positions from
 * \`getBoundingClientRect()\` and flips or shifts to stay inside.
 *
 * What this surface needed and still gets: the tip opens UPWARD here. The
 * shared primitive prefers below and flips when there is no room, and this bar
 * floats 12px off the bottom of the viewport — so it flips on geometry alone,
 * with no per-surface override to keep in sync.
 */
`
