/** How heavily a glyph is drawn, decided by the control that holds it. */

import { tokens as t } from "../tokens"

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
/*
 * \`fast\` IS 120ms and \`ease\` is this chrome's curve. This was the last
 * unargued literal duration in the stylesheet — the same number spelled a
 * second way, next to the keyword curve rather than the kit's — so it was the
 * one that would silently stop agreeing the day the rung moved.
 *
 * ## AND THIS SELECTOR OUTRANKS EVERY OTHER GLYPH TRANSITION IN THE CHROME
 *
 * \`[data-designlayer] svg[data-de-glyph]\` is (0,2,1). \`.de-swap > svg\` and
 * \`.de-pad-cell > svg\` are (0,1,1). \`transition\` is a shorthand, so this rule
 * does not add \`stroke-width\` to their lists — it REPLACES them, resetting
 * \`transition-property\` to \`stroke-width\` alone. Both of those surfaces have
 * therefore never animated: the copy glyph jumped to a tick and the padding
 * cell's mark appeared at full size, in a chrome whose stylesheet carefully
 * describes both crossfades.
 *
 * It is not fixable from here. Widening this list would put an opacity and a
 * transform transition on all 54 glyph call sites, which is the blanket the
 * file's own opening argument rejects; narrowing the selector would let it
 * reach the host's own artwork, which is what the attribute is for. So the two
 * surfaces that want their own motion restate this one property inside their
 * own rule and take a specificity that beats this — see \`.de-swap > svg\` in
 * \`css/annotations.ts\`, which is the pattern to copy.
 */
[data-designlayer] svg[data-de-glyph] {
  transition: stroke-width ${t.duration.fast} ${t.ease};
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

/*
 * OPTICAL CENTRING, FOR THE ONE GLYPH IN THE SET THAT NEEDS IT.
 *
 * Everything in this chrome centres a glyph geometrically — \`align-items\` and
 * \`justify-content\` on the box, which centres the 24-unit viewBox. That is
 * right when a mark's ink is spread evenly inside it, and the arrow is the one
 * mark in the set where it is not: a cursor is a solid head at one end and two
 * thin tails at the other, so its MASS sits up and to the left of the middle of
 * its own box while its bounding box stays square.
 *
 * Measured rather than eyeballed, by rasterising each glyph at 120px and taking
 * the alpha-weighted centroid of the ink:
 *
 *   Cursor   centroid off centre by 6.3% of the box — 1.27px at the launcher
 *   Plus     0.4%    Search  0.9%    Check  0.5%
 *
 * So this is not a systemic failure with one visible instance; it is one glyph
 * five times further off than anything else in the set, and that is why it gets
 * a rule instead of the whole set getting a pipeline. A per-glyph centroid
 * emitted from \`tools/build-icons.mjs\` would move two hundred marks by
 * fractions of a pixel nobody can see, to fix one they can.
 *
 * A PERCENTAGE, so it holds at every rung. \`translate\` resolves a percentage
 * against the element's own size, so 6.3% is 1.27px on the launcher's 20px mark
 * and 1.0px on the toolbar's 16px one, with no per-size table to keep correct.
 *
 * Keyed on the name, which is why \`icon()\` stamps one. Scoped to
 * \`[data-designlayer]\` like every other rule here, so it cannot reach a host
 * glyph that happens to be called the same thing.
 */
[data-designlayer] svg[data-de-glyph="Cursor"] {
  transform: translate(6.3%, 6.3%);
}

`
