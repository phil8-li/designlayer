/**
 * The right panel's tab strip and its panes.
 *
 * The inspector stopped being one scroll of sections when it grew a Code view
 * and a Change-prompts view: those two are not sections you scroll past, they
 * are other things to be looking at. So the panel body becomes a fixed strip
 * plus one scrolling pane, rather than a single scroll with a sticky header —
 * a sticky header would put the code view's own footer at the bottom of a
 * scroll it does not control.
 *
 * Only the RIGHT panel is re-laid out here. The left panel is still one list
 * and still scrolls as a whole.
 */

import { accentFillText, tokens as t } from "../tokens"

export const inspectorCss = `/* ---------- inspector tabs ---------- */
.de-panel--right .de-panel-body {
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/*
 * A SEGMENTED STRIP OF PILLS, NOT AN UNDERLINED RAIL — the treatment Figma's
 * own right panel uses, and the reason the icons are gone.
 *
 * The strip was four icon+label tabs under an accent underline. Both halves of
 * that were paying for a problem this panel no longer has. The underline is a
 * mark that needs an edge to sit on, so it forced the strip's border up to
 * \`borderStrong\` — a heavier rule than any of the section dividers below it,
 * which made the top of the panel the loudest thing in it. And the icons were
 * load-bearing only while the labels were competing for a 260px row: three
 * words this short are already scannable, and a glyph in front of each one is
 * three more drawings in a panel whose job is to show someone else's.
 *
 * What replaces it is the selected tab carrying a quiet neutral surface of its
 * own. That reads as "one of these is taken" without an edge to hang off, so
 * the strip's border drops to \`border\` and lines up with every section
 * divider under it — the panel now has one hairline weight, not two.
 *
 * NEUTRAL, not \`accentFill\`, which is what the sibling control in
 * \`options.ts\` gives its pressed tab. That control is a dialog's own two-way
 * switch and can afford to shout; this one is the permanent header of the
 * inspector, and an accent slab sitting there all session competes with the
 * accent that actually means something — the selection on the canvas.
 */
.de-tabs {
  flex: none;
  /*
   * 4px between pills. Two adjacent backgrounds that touch read as one wider
   * container with a seam in it, which is the wrong object, and at 2px the
   * labels ran together as one phrase.
   */
  display: flex; align-items: center; gap: ${t.space.sm}px;
  height: ${t.size.tabBar}px;
  /*
   * The \`lg\` step, so the strip has air at both ends rather than a pill
   * pressed against the panel edge. It is the same inset the app chooser
   * above gives its name, so the selected pill's edge and the app name share
   * one left line; the label sits 8px further in, inside the pill.
   */
  padding: 0 ${t.space.lg}px;
  border-bottom: 1px solid ${t.color.border};
  /*
   * THE STRIP STILL SCROLLS RATHER THAN SHRINKS, though it now has room.
   *
   * It is kept because the constraint that forced it never went away: the
   * panels are resizable down to \`inspectorMinWidth\` (200px), so the width
   * three tabs have is whatever the user last dragged the seam to, not the
   * width they mounted at. Dropping the icons bought roughly 48px of headroom
   * and bought nothing at all at the narrow end.
   *
   * The other three answers are still worse: letting the tabs shrink truncates
   * the labels of the tabs you are not on, wrapping to a second row doubles
   * the height of a landmark, and clipping silently leaves a tab unreachable.
   *
   * The scrollbar is hidden in both engines — it is 15px of furniture across a
   * 34px landmark, and the thing it would report is already reported by a tab
   * half-cut at the edge. Reachability comes from \`activate()\` instead, which
   * scrolls the selected tab into view, so the keyboard path never depends on
   * the pointer finding a bar that is not drawn.
   */
  overflow-x: auto;
  overscroll-behavior-x: contain;
  scrollbar-width: none;
  /* The containing block for the pill below. An absolutely positioned child of
     a scroll container scrolls WITH its content, which is the whole reason the
     pill can be one node instead of a background on each tab. */
  position: relative;
}
.de-tabs::-webkit-scrollbar { display: none; }
/*
 * ONE PILL, WHICH MOVES.
 *
 * The selected tab used to paint its own \`bgHover\` surface, which meant the
 * selection was two boxes taking turns: the old tab's ground vanished and the
 * new tab's appeared, with nothing in between for the eye to follow. On a
 * landmark you switch dozens of times a session that is the difference between
 * a strip you read and a strip you re-read.
 *
 * A single node travelling says the same thing and says it as one object, which
 * is also what makes it cheap: \`transform\` and \`width\` on one absolutely
 * positioned element, no layout on the tabs, nothing per-tab to keep in sync.
 *
 * \`snap\` is the rung. The travel is 60-80px, but this is a control pressed
 * constantly and the token set is explicit that at this length "the eye reads
 * 'it went' rather than 'it is going'" — which is the correct sentence for a
 * tab strip. \`fast\` here felt like the pill was being dragged.
 *
 * Behind the labels, never over them: \`.de-tab\` takes a stacking index below,
 * and the pill is \`pointer-events: none\` so it cannot eat a click meant for the
 * tab it is sitting under.
 *
 * Guarded on \`[data-de-pill]\` throughout, and \`core/tab-pill.ts\` only sets that
 * attribute once it has measured a non-zero width. So a strip that never gets
 * measured — JSDOM, or a tab activated before first paint — keeps the original
 * per-tab background and loses nothing.
 */
.de-tab-pill {
  position: absolute;
  left: 0; top: 50%;
  width: var(--de-pill-w, 0px);
  height: ${t.size.rowHeight}px;
  transform: translate(var(--de-pill-x, 0px), -50%);
  border-radius: ${t.radius.md};
  background: ${t.color.bgHover};
  opacity: 0;
  pointer-events: none;
  transition:
    transform ${t.duration.snap} ${t.ease},
    width ${t.duration.snap} ${t.ease},
    opacity ${t.duration.snap} ${t.ease};
}
.de-tabs[data-de-pill] .de-tab-pill { opacity: 1; }
/*
 * An unselected tab is a CONTROL, so it takes the control ink (rank 3 in the
 * ladder at the top of panels.ts), not the secondary one. At \`textDim\` the
 * unselected tabs sat at the same rank as the hint text inside the pane they
 * switch to — the landmark reading quieter than the body it leads.
 * \`textMuted\` puts them at 9.95:1, a step under the selected tab's white.
 *
 * ONE WEIGHT FOR EVERY TAB, and it is the value rung rather than the section
 * one the selected tab used to take. A weight that changes with selection
 * changes the label's WIDTH with it, so every switch shoved the tabs beside it
 * sideways — on a strip that is also a scroller, that is a landmark that moves
 * when you use it. The pill and the white ink say which one is taken; they do
 * not need a third voice that costs layout.
 *
 * The box is a \`rowHeight\` box on the \`md\` corner with the workhorse step
 * inside it. Being shorter than the 34px strip is the point — a pill that
 * filled the strip would be a filled header, not a control sitting in one.
 *
 * This used to be justified by matching \`.de-opt-tab\`, the two-button
 * pseudo-tab strip inside the floating options window, which was the chrome's
 * other tab-pill — and the justification was always a little thin, since that
 * strip also filled itself with \`accentFill\` where both real strips use a
 * travelling neutral pill. The window is gone, the pseudo-strip with it, and
 * there is one tab treatment in this product now, shared by the two real
 * strips. Its nearest surviving relative is \`.de-opt-chip\` in the Controls
 * pane, and that one is deliberately NOT this box: a chip is a value you pick,
 * not a view you switch to, so it keeps the pill corner and its own padding.
 *
 * \`flex: none\` and \`nowrap\` because the failure this pair prevents is the one
 * the scroller cannot: flex items shrink before their container overflows, so
 * without them the tabs would squeeze to fit and truncate their own labels,
 * and the strip would never scroll at all.
 */
.de-tab {
  flex: none;
  display: inline-flex; align-items: center;
  height: ${t.size.rowHeight}px;
  padding: 0 ${t.space.md}px;
  border: none; border-radius: ${t.radius.md};
  background: transparent;
  color: ${t.color.textMuted};
  font-family: inherit; font-size: ${t.type.body}; font-weight: ${t.type.weightValue};
  white-space: nowrap;
  cursor: pointer;
  /* Above the pill, which is a sibling earlier in the DOM and would otherwise
     paint over the label it is meant to sit behind. */
  position: relative;
  z-index: 1;
  /* The ink crossfades with the pill it is handing over to. Colour only — a
     background here would be the second answer to "which one am I on" that the
     hover note below spends five paragraphs refusing. */
  transition: color ${t.duration.snap} ${t.ease};
}
/*
 * HOVER BRIGHTENS THE INK AND DRAWS NO SURFACE, so the pill means one thing.
 *
 * The obvious build gives hover \`bgHoverQuiet\` and selection \`bgHover\`, and
 * it was tried: on the dark ground those are \`lift(6)\` and \`lift(12)\`, two
 * greys six percent apart, and the hovered tab also takes the white ink the
 * selected one has. Screenshotted, a hovered neighbour and the selected tab
 * were a pair of pills you had to compare to tell apart — for as long as the
 * pointer rested there, the strip had two answers to "which one am I on".
 *
 * A mark that means "selected" cannot also mean "the mouse is here". So the
 * surface is reserved for selection outright and hover does what this strip
 * did before it had pills at all: it lifts the label from \`textMuted\` to
 * full ink, which is unmistakably a different KIND of change from growing a
 * background, and therefore never mistaken for one.
 */
.de-tab:hover { color: ${t.color.text}; }
.de-tab[aria-selected="true"] {
  background: ${t.color.bgHover};
  color: ${t.color.text};
}
/* Once the pill is real, it owns the surface and the tab stops drawing one —
   two grounds at the same value, one of them travelling, would read as a
   smear. Scoped to the measured state so an unmeasured strip is unchanged. */
.de-tabs[data-de-pill] .de-tab[aria-selected="true"] { background: transparent; }
/* Outside the pill, not inset into it. At the \`-3px\` the underlined tab used,
   the ring landed inside the surface and read as a second border on the pill
   rather than as a ring around it. */
.de-tab:focus-visible { outline: 2px solid ${t.color.accent}; outline-offset: 1px; }

/*
 * HOW MUCH IS OWED, ON THE CHANGES TAB.
 *
 * A number, not a dot: "there is something here" is the one thing a designer
 * can already infer from opening the panel, and the useful question — one
 * stray tweak, or a session's worth — is exactly what a dot refuses to answer.
 *
 * It is the MUTED ink, not the accent. The accent in this chrome means "this
 * is selected" and is already spent on the pill behind the label; a second
 * accent inside the same pill would be two claims on one colour. The count is
 * not an alert either — it is a fact about a list — and muted keeps a
 * five-item session from reading as an error state.
 *
 * Empty until there is something to say, and \`:empty\` collapses the margin
 * with it, so a tab owing nothing measures exactly what it did before the
 * count existed and the strip's overflow point does not move.
 */
/*
 * A BADGE, not a loose numeral beside a word.
 *
 * It was \`content: attr(data-de-count)\` with a 2px margin and nothing else, so
 * the tab read "Changes 5" — a number set in running text at the same rank as
 * the label, which the eye takes as part of the name. Two digits made it
 * plainer: "Changes 12" reads as a version number.
 *
 * A count is a different KIND of thing from a label and has to be drawn as one.
 * The pill is the smallest treatment that says so — its own surface, its own
 * ink, and a shape the label cannot have.
 *
 * Sized from the scale rather than from a fixed box: \`min-width\` equal to the
 * height makes a single digit a circle and lets a three-digit count grow into a
 * stadium instead of clipping, and a badge that truncates its own number is
 * worse than no badge. The tab's width must not twitch as the count crosses 9
 * either, because the strip is a scroller and its overflow point is a function
 * of that width — which is what tabular figures buy. This rule used to ask for
 * them itself; they are on the chrome root now, once, and \`css/base.ts\` argues
 * why a per-badge declaration was the wrong shape for that property.
 *
 * \`corner-shape: round\`, for the reason the switch track opts out in
 * \`css/base.ts\`: at a radius past half the height the corner box is the whole
 * side, so the chrome's superellipse would square the cap off into a rounded
 * rectangle instead of leaving it a pill.
 *
 * The attribute is still deleted rather than set to "0" by
 * \`installChangeCount\`, so a session owing nothing wears no badge and the tab
 * measures exactly what it did before the count existed.
 */
.de-tab[data-de-count]::after {
  content: attr(data-de-count);
  display: inline-flex; align-items: center; justify-content: center;
  margin-left: ${t.space.sm}px;
  min-width: ${t.space["2xl"]}px; height: ${t.space["2xl"]}px;
  padding: 0 ${t.space.sm}px;
  border-radius: ${t.space["2xl"]}px;
  corner-shape: round;
  background: ${t.color.bgHover};
  color: ${t.color.textMuted};
  font-size: ${t.type.micro};
  font-weight: ${t.type.weightValue};
  line-height: ${t.type.leadingFlush};
  /*
   * It arrives, rather than simply being there.
   *
   * The badge appears the moment the first edit lands, at full size, and the
   * strip is a flex row — so the tab it belongs to gets wider and everything to
   * its right is shoved along, in one frame, while the user is looking at the
   * canvas. Scaling in from the middle does not remove the reflow (the width is
   * layout, and layout is not animatable here without measuring), but it does
   * separate the two events: the strip makes room, and a beat later something
   * lands in it.
   *
   * \`easeSpring\` on a \`snap\` is the smallest arrival in the chrome, and a count
   * chip is the smallest object in it. It is only ever seen once per change, so
   * it can afford a curve the rest of the strip cannot.
   */
  animation: de-tab-count-in ${t.duration.snap} ${t.easeSpring};
}
@keyframes de-tab-count-in { from { transform: scale(0.4); opacity: 0; } }
/*
 * Chosen, the badge takes the accent.
 *
 * The selected tab already wears a neutral surface, so a neutral chip on top of
 * it is a plate on a plate — about 1.2:1 apart, which loses the count at
 * exactly the moment the user is looking at the list it counts. \`accentFill\`
 * rather than a bare background because this chrome's accent is light in one
 * theme and dark in the other, and the ink has to flip with it.
 */
.de-tab[aria-selected="true"][data-de-count]::after { ${accentFillText} }

.de-tabpanel {
  flex: 1; min-height: 0;
  display: flex; flex-direction: column;
  overflow-y: auto; overscroll-behavior: contain;
}
/* An author \`display\` beats the UA [hidden] rule, so restate it. */
.de-tabpanel[hidden] { display: none; }
.de-tabpanel::-webkit-scrollbar { width: 8px; }
.de-tabpanel::-webkit-scrollbar-thumb {
  background: transparent; border-radius: ${t.radius.md};
  border: 2px solid transparent; background-clip: content-box;
}
.de-tabpanel:hover::-webkit-scrollbar-thumb {
  background: ${t.color.borderStrong}; background-clip: content-box;
}
`
