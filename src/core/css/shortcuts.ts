/**
 * The keyboard shortcuts sheet.
 *
 * A modal card over everything, so it declares its own stacking outright rather
 * than depending on where in `css.ts` it lands — the same choice `app-chooser`
 * makes, and for the same reason: a surface that must be in front of the panels
 * cannot live inside the overlay layer, which is a stacking context pinned
 * below the rail.
 *
 * It borrows the popover vocabulary the rest of the chrome uses — `bgRaised`, a
 * hairline, `shadow.popover` — because a designer should not be able to tell
 * from the surface which lane drew a card. What it adds is the `kbd`, which
 * nothing else in this editor prints: a key is a thing you press, so it is
 * drawn as a key rather than as a code span.
 */

import { tokens as t, nest } from "../tokens"

/*
 * THERE IS NO `SHEET_Z` ANY MORE, and the deletion is worth the paragraph.
 *
 * It was 2147483400: one step above the app chooser's menu, the otherwise
 * front-most surface, so that opening the sheet over an open chooser did not
 * put a modal behind the thing it was meant to cover. A real number solving a
 * real collision — and a number somebody has to keep correct every time another
 * overlay is added to this chrome.
 *
 * `showModal()` makes the question go away. A modal dialog is promoted to the
 * TOP LAYER, which paints above every stacking context in the document at any
 * z-index: the chooser's menu, the vendor overlay's 2147483645, or whatever a
 * host app has invented. The ordering is a property of what the element IS
 * rather than of a constant that has to out-bid the field.
 */

/**
 * The card's corner and the close button's, derived from one inset.
 *
 * `radius['2xl']` over a `space['2xl']` gap: 20 − 16 lands the button on 4,
 * which is `radius.sm` and what every other small control in the chrome draws.
 * The padding is one pixel under the spacing step because the card's hairline
 * is counted as part of the gap between the two curves rather than added to it.
 */
const SHEET = nest({
  of: ".de-shortcuts",
  outer: t.radius["2xl"],
  inset: t.space["2xl"],
  hairline: 1,
})

export const shortcutsCss = `/* ---------- keyboard shortcuts sheet ---------- */
/*
 * THE SHEET IS A \`<dialog>\`, SO THE SCRIM IS \`::backdrop\` AND NOT AN ELEMENT.
 *
 * There was a \`.de-shortcuts-scrim\` div here: fixed, \`inset: 0\`, flex-centring
 * the card, carrying the dim and a click handler for "close". Every one of
 * those jobs is something the platform does for a modal dialog, and doing them
 * by hand is what left the sheet claiming a modality it did not enforce — see
 * the note in \`shell/shortcuts.ts\`.
 *
 * \`::backdrop\` is the dim. Same value it always had: dark enough to say the
 * page behind is out of play, light enough to keep reading it, because the
 * sheet is a reference held up against the thing you were doing rather than a
 * context switch away from it.
 *
 * The centring is \`margin: auto\` on the dialog itself, which is what a browser
 * already applies to a modal and what the flex parent was re-implementing. The
 * \`5xl\` gutter the scrim used as padding survives as \`max-height\`/\`max-width\`
 * arithmetic, so the card still never touches the viewport edge.
 *
 * No \`z-index\` either. A modal dialog is in the TOP LAYER, which is above every
 * stacking context in the document — including the 2147483400 this sheet used
 * to claim and the 2147483645 the vendor overlay claims. The constant is kept
 * in the module for the comment that explains the ordering it used to buy.
 */
.de-shortcuts::backdrop {
  background: rgba(0, 0, 0, 0.45);
}

.de-shortcuts {
  display: flex; flex-direction: column;
  width: min(760px, 100% - ${t.space["5xl"] * 2}px);
  max-height: calc(100% - ${t.space["5xl"] * 2}px);
  margin: auto;
  padding: ${SHEET.padding};
  border: 1px solid ${t.color.border};
  border-radius: ${SHEET.outer};
  background: ${t.color.bgRaised};
  box-shadow: ${t.shadow.popover};
  color: ${t.color.text};
  font-family: inherit;
  font-size: ${t.type.body};
}
/*
 * A \`<dialog>\` is focused on open — \`showModal\` puts focus on the card itself
 * when nothing inside it is autofocused, which is what this sheet wants, since
 * it is a document to read rather than a form to fill. The ring is suppressed
 * because that focus is a side effect of opening rather than a place the reader
 * navigated to; every control INSIDE the card keeps its own \`:focus-visible\`.
 */
.de-shortcuts:focus { outline: none; }
/* Not shown is not displayed. Without this a closed dialog still lays out. */
.de-shortcuts:not([open]) { display: none; }

.de-shortcut-head {
  position: relative;
  flex: none;
  padding: 0 ${t.size.toolSize + t.space.md}px ${t.space.lg}px 0;
  border-bottom: 1px solid ${t.color.border};
}
.de-shortcut-title {
  margin: 0;
  font-size: ${t.type.body};
  font-weight: ${t.type.weightSection};
  color: ${t.color.text};
}
/*
 * The one rule that is not Figma's, printed where the key is about to be
 * pressed. \`textMuted\` rather than \`textDim\`: it is the only sentence in this
 * card that is not restating something the reader can already see, so it has to
 * survive a skim.
 */
.de-shortcut-note {
  margin: ${t.space.sm}px 0 0;
  /* The measure this chrome picked by hand first, now the token everything
     else reads. See \`type.measure\`. */
  max-width: ${t.type.measure};
  font-size: ${t.type.caption};
  line-height: ${t.type.leadingBody};
  color: ${t.color.textMuted};
}
.de-shortcut-close {
  position: absolute; top: 0; right: 0;
  display: inline-flex; align-items: center; justify-content: center;
  width: ${t.size.toolSize}px; height: ${t.size.toolSize}px;
  padding: 0;
  border: none;
  border-radius: ${SHEET.radius};
  background: transparent;
  color: ${t.color.textMuted};
  cursor: pointer;
}
/* The sheet is \`bgRaised\`, so its close button lifts to \`bgRaisedHover\`.
   \`bgHover\` is darker than the surface it sits on, so the one control that
   dismisses this overlay receded under the pointer. */
.de-shortcut-close:hover { background: ${t.color.bgRaisedHover}; color: ${t.color.text}; }

/*
 * Two columns where they fit, one below that.
 *
 * The list runs to about thirty rows; in a single column that is a scroll with
 * no shape to it, and the groups are exactly what makes it skimmable.
 * \`break-inside: avoid\` is the load-bearing line — without it a group's heading
 * lands at the foot of one column and its rows at the head of the next.
 */
.de-shortcut-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  margin-top: ${t.space.lg}px;
  columns: 2;
  column-gap: ${t.space["5xl"]}px;
}
@media (max-width: 720px) { .de-shortcut-body { columns: 1; } }

.de-shortcut-group {
  break-inside: avoid;
  margin: 0 0 ${t.space["4xl"]}px;
}
.de-shortcut-heading {
  margin: 0 0 ${t.space.md}px;
  font-size: ${t.type.micro};
  font-weight: ${t.type.weightSection};
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: ${t.color.textDim};
}

/*
 * Keys first, in a fixed gutter, so the column of keycaps reads as a column. A
 * shortcut sheet is scanned by key at least as often as by name — "what does ⌥2
 * do" — and a ragged key column makes that the slow direction.
 */
.de-shortcut-row {
  display: grid;
  grid-template-columns: 92px 1fr;
  gap: ${t.space.md}px;
  align-items: baseline;
  padding: ${t.space.sm}px 0;
}
.de-shortcut-keys { display: flex; flex-wrap: wrap; gap: ${t.space.xs}px; }

.de-kbd {
  display: inline-block;
  min-width: ${t.space["3xl"]}px;
  padding: ${t.space.xs}px ${t.space.sm}px;
  border: 1px solid ${t.color.border};
  border-bottom-width: 2px;
  border-radius: ${t.radius.sm};
  background: ${t.color.bgSunken};
  color: ${t.color.text};
  /* The token, not a retyped stack. The literal here was \`font.mono\` with
     \`"SF Mono"\` dropped, so a key cap rendered in a different face from every
     other mono run in the chrome on any Mac without SFMono-Regular installed. */
  font-family: ${t.font.mono};
  font-size: ${t.type.caption};
  line-height: ${t.type.leadingBody};
  text-align: center;
  white-space: nowrap;
}

.de-shortcut-text { display: flex; flex-direction: column; gap: ${t.space.xs}px; min-width: 0; }
.de-shortcut-label { color: ${t.color.text}; line-height: ${t.type.leadingRow}; }
/*
 * The Figma lineage, and it is deliberately quiet.
 *
 * It is there so a designer can check a key against what they already know, and
 * so a divergence from Figma is visible on the surface rather than buried in a
 * source comment. It is not what you read the row for, so it takes \`textDim\`
 * at \`micro\` — present on a second pass, invisible on the first.
 */
.de-shortcut-figma {
  font-size: ${t.type.micro};
  line-height: ${t.type.leadingRow};
  color: ${t.color.textDim};
}
`
