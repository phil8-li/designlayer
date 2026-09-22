/** How heavily a glyph is drawn, decided by the control that holds it. */

export const iconsCss = `/* ---------- glyph weight ---------- */
/*
 * On means heavier. Off means the rung's own weight. One rule, not 54 call sites.
 *
 * This replaces a swap between two DRAWINGS. The old set shipped every glyph
 * twice — an outline and a fill, each in a \`<g data-weight>\` — and this rule
 * picked. Lucide is a stroke family and ships no filled counterparts, and
 * synthesising them by flooding each path with \`currentColor\` is legible only
 * for a closed silhouette: it turns \`Info\` into a blank disc, \`Eye\` into a
 * blot, and does nothing whatever to a chevron. Worse, it would split groups
 * that have to read as one — the inspector's three tabs are a slider stack, a
 * speech bubble and a \`< >\`, and only the bubble can be filled, so a filled
 * selected state would make that strip two families.
 *
 * Stroke weight says the same thing for every glyph in the set. The mark does
 * not change, it thickens.
 *
 * The reasoning that put a rule here at all is unchanged. The alternative was
 * for each control to redraw its own icon whenever its state changed, which is
 * the arrangement that lets a button's mark and its \`aria-pressed\` drift apart:
 * the drift is invisible in review, because both halves are individually
 * correct. Reading the state off the DOM instead means the two cannot disagree.
 * A control that already reports itself to assistive tech — and every toggle in
 * this chrome does, because it must — gets the right weight for free, and so
 * does the next one somebody adds.
 *
 * \`aria-selected\` as well as \`aria-pressed\`: a tab strip and a token list say
 * "chosen" with the first and a toggle says it with the second, and the glyph
 * does not care which word the control had to use.
 *
 * Half a unit, not a whole one. The bump lands on top of the accent colour and
 * border a pressed control already wears, so it is the third signal rather than
 * the only one — and a full unit at the \`mark\` rung would close a glyph's
 * counters up instead of emphasising it.
 *
 * \`--de-icon-stroke\` is written inline by \`drawIcon\`, per rung, which is what
 * lets one rule serve six sizes: a 10px glyph strokes at 2.75 and a 32px one at
 * 1.75, and each gets its own +0.5 rather than a shared absolute that would be
 * heavy on one and invisible on the other. The \`2\` fallback is Lucide's native
 * width, and only ever applies to a glyph drawn outside \`drawIcon\`.
 *
 * Scoped twice over — under the chrome attribute, and to \`[data-de-glyph]\` — so
 * it reaches neither an \`<svg>\` belonging to the app being edited nor a HOST
 * icon rendered in the inspector's variant list. Those are somebody else's
 * drawings, and the editor does not get to re-weight them because a row is
 * selected.
 */
[data-designlayer] svg[data-de-glyph] {
  transition: stroke-width 120ms ease;
}

[data-designlayer][aria-pressed="true"] svg[data-de-glyph],
[data-designlayer][aria-selected="true"] svg[data-de-glyph],
[data-designlayer] [aria-pressed="true"] svg[data-de-glyph],
[data-designlayer] [aria-selected="true"] svg[data-de-glyph] {
  stroke-width: calc(var(--de-icon-stroke, 2) + 0.5);
}

@media (prefers-reduced-motion: reduce) {
  [data-designlayer] svg[data-de-glyph] { transition: none; }
}

`
