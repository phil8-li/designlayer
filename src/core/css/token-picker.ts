/**
 * The design-system token picker: field, popover, search, and grouped rows.
 *
 * Its own module so the picker's surface is owned in one place, the way every
 * other lane owns the stylesheet for the surface it draws.
 */

import { tokens as t, accentFillText } from "../tokens"
import { CONTROL_RADIUS } from "./panels"

export const tokenPickerCss = `/* ---------- token field ---------- */
/*
 * The whole row is the target. The old control was a native select whose option
 * text had to spell the token, its source and its value on one line; a button
 * that opens a real list owes the closed state nothing but the name.
 */
/*
 * \`borderInteractive\`, because this hairline is the control's whole boundary.
 *
 * The field has no fill of its own at rest, so \`border\` at 1.55:1 against the
 * near-black panel was the only thing distinguishing a button you can open from
 * a token name printed on the surface — under the 3:1 WCAG 1.4.11 asks of a
 * control boundary, and the reason a row of these read as a list rather than as
 * a column of pickers. 2.90:1 is the strongest rung the set has; it is
 * documented as 3.2:1, which was true on the slate it was measured against.
 *
 * Hover takes \`bgHover\` and not \`bgHoverQuiet\` for the size reason in the
 * hover rule in panels.ts: 24px tall is a small patch, and 1.19:1 over one is
 * not the same signal as 1.19:1 over a panel-wide band. 1.44:1 here.
 *
 * The gap is the run from the chip to the name and takes the workhorse step;
 * the side padding takes the tight one, because a 24px field in a 260px panel
 * pays for both sides out of the token name, and the name is the only thing the
 * closed state has to say.
 */
.de-token-field {
  display: flex; align-items: center; gap: ${t.space.md}px;
  width: 100%; height: ${t.size.rowHeight}px;
  padding: 0 ${t.space.sm}px;
  border: 1px solid ${t.color.borderInteractive}; border-radius: ${CONTROL_RADIUS};
  background: transparent; color: ${t.color.text};
  font: inherit; font-size: ${t.type.body}; text-align: left;
  cursor: pointer;
  transition: background ${t.duration.fast} ${t.ease};
}
.de-token-field:hover { background: ${t.color.bgHover}; }
.de-token-field:focus-visible { outline: 2px solid ${t.color.accent}; outline-offset: 1px; }
.de-token-field-name {
  flex: 1; min-width: 0;
  overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
  font-weight: ${t.type.weightBody};
}
/* Nothing is bound, so this is the element's own value rather than a name. */
.de-token-field-name--plain { color: ${t.color.textMuted}; }

/* ---------- the leading glyph slot ---------- */
/* \`icon.control\`, which is the 16 it already was — written as the ramp rung so
   the chip tracks the glyph it shares a row with if the ramp ever moves. */
.de-token-swatch {
  flex: none;
  display: flex; align-items: center; justify-content: center;
  width: ${t.icon.control}px; height: ${t.icon.control}px;
  border-radius: ${t.radius.sm};
}
/*
 * Inset rather than a border: a border would grow the chip and shift the name,
 * and the ring exists so a near-white token still reads as a chip on the dark
 * chrome instead of dissolving into the surface behind it.
 */
.de-token-swatch--color { box-shadow: inset 0 0 0 1px ${t.color.border}; }
.de-token-swatch--radius { box-shadow: inset 0 0 0 1px ${t.color.borderInteractive}; }
.de-token-swatch--text { font-weight: ${t.type.weightValue}; line-height: ${t.type.leadingFlush}; }
/* The mark carries its own weight; the slot only has to not crop it. */
.de-token-swatch--glyph { color: ${t.color.text}; }
.de-token-swatch--glyph svg { display: block; }

/* ---------- picker popover ---------- */
.de-token-popover {
  position: fixed;
  z-index: 2147483200;
  width: 264px;
  display: flex; flex-direction: column;
  background: ${t.color.bgRaised};
  border: 1px solid ${t.color.border}; border-radius: ${t.radius.lg};
  box-shadow: ${t.shadow.popover};
  overflow: hidden;
}
/* Every horizontal gutter in the popover — header, search, group label, row,
   footer, empty state — is one step, so the title, the group names and the row
   names all start on the same edge. It was 10 in five rules and 6 in the sixth,
   which put the header's trailing control 4px off the list it heads. */
.de-token-popover-header {
  display: flex; align-items: center; gap: ${t.space.md}px;
  height: ${t.size.sectionHeader}px; padding: 0 ${t.space.md}px;
  border-bottom: 1px solid ${t.color.border};
}
.de-token-popover-title {
  flex: 1; min-width: 0;
  overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
  font-size: ${t.type.body}; font-weight: ${t.type.weightSection};
}
.de-token-search {
  display: flex; align-items: center; gap: ${t.space.md}px;
  padding: 0 ${t.space.md}px; height: ${t.size.sectionHeader}px;
  border-bottom: 1px solid ${t.color.border};
  color: ${t.color.textDim};
}
.de-token-search-input {
  flex: 1; min-width: 0;
  border: none; background: transparent;
  color: ${t.color.text};
  font: inherit; font-size: ${t.type.body};
}
/*
 * Removed WITH a replacement, which is the half these two inputs were missing.
 *
 * Both sit in a bordered shell that draws the field, so a UA outline around the
 * input alone would paint a second box inside the first — that is why it was
 * taken off. But focus arrives here by SCRIPT: the popover opens and moves the
 * caret into the search box, so a keyboard user's first frame in this surface
 * is one where nothing says where they are. \`outline-offset: -2px\` draws the
 * ring just inside the input's own edge, which is the shell's inner line rather
 * than a box beside it.
 */
.de-token-search-input:focus { outline: none; }
.de-token-search-input:focus-visible { outline: 2px solid ${t.color.accent}; outline-offset: -2px; }
.de-token-search-input::placeholder { color: ${t.color.textDim}; }

.de-token-list { max-height: 320px; overflow-y: auto; padding-bottom: ${t.space.sm}px; }
/*
 * Sticky because the leaf names only make sense under their group: scroll the
 * header away and \`Primary\` stops saying which family it belongs to.
 */
/*
 * A heading outranks the rows under it. This one did not.
 *
 * \`textDim\` put the group label at 5.82:1 while every leaf below it sat at
 * 14.16:1 — the label naming a family was the faintest thing in the list it
 * named, which is the hierarchy collapse in its purest form. \`textMuted\` at
 * 8.64:1 is a clear step under the rows and a clear step over anything dim,
 * which is where a sub-heading belongs.
 *
 * The 28px box survives the type going from 10 to 11px because the line box is
 * fixed at 16px in base.ts: 8 + 16 + 4. It has to survive — \`.de-token-row\`
 * clears exactly this number with \`scroll-margin-top\`, and picker-cases.mjs
 * asserts the two agree.
 */
.de-token-group {
  position: sticky; top: 0; z-index: 1;
  height: 28px;
  padding: ${t.space.md}px ${t.space.md}px ${t.space.sm}px;
  background: ${t.color.bgRaised};
  color: ${t.color.textMuted};
  font-size: ${t.type.body}; font-weight: ${t.type.weightSection};
}
/*
 * scroll-margin-top clears the sticky header. Opening the picker scrolls the
 * current token into view, and \`block: "nearest"\` parks the row flush with the
 * list's top edge — which is UNDERNEATH the header, so the first row of a group
 * was sliced in half by the label naming it.
 *
 * It clears a box rather than setting a rhythm, so it stays a literal pinned to
 * that header's height. On the spacing scale it would round to 30 and overshoot
 * the header by two pixels every time the picker opens.
 */
.de-token-row {
  display: flex; align-items: center; gap: ${t.space.md}px;
  width: 100%; height: 28px; padding: 0 ${t.space.md}px;
  scroll-margin-top: 28px;
  border: none; background: transparent;
  color: ${t.color.text};
  font: inherit; font-size: ${t.type.body}; text-align: left;
  cursor: pointer;
}
.de-token-row-name {
  flex: 1; min-width: 0;
  overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
}
.de-token-row-detail { flex: none; color: ${t.color.textDim}; }
.de-token-row-check { flex: none; display: flex; align-items: center; }
/* \`bgRaisedHover\`, not \`bgHover\`: this popover is \`bgRaised\`, and \`bgHover\` is
   a rung BELOW it — pointing at a row used to darken it. The field that opens
   this list keeps \`bgHover\` and is right to: it sits on the panel ground,
   where that value is a genuine lift. Same rule, two grounds. */
.de-token-row:hover { background: ${t.color.bgRaisedHover}; }
/*
 * The keyboard cursor is not the pointer cursor. Given the same wash, the two
 * are indistinguishable the moment a hand is on each — so the active row keeps
 * the wash and adds a rule to say which row Enter would actually take.
 */
.de-token-row[data-active="true"] {
  background: ${t.color.bgRaisedHover};
  box-shadow: inset 0 0 0 1px ${t.color.accent};
}
/*
 * Full-bleed accent with dark ink. The design system's accent is a LIGHT
 * indigo, so the ink flips instead of the surface darkening — white text here
 * would land at 1.7:1 and vanish.
 */
.de-token-row[aria-selected="true"] { ${accentFillText} }
.de-token-row[aria-selected="true"] .de-token-row-detail { color: ${t.color.onAccent}; }
/* An accent rule on the accent is no rule at all, so the ink draws it instead. */
.de-token-row[aria-selected="true"][data-active="true"] {
  box-shadow: inset 0 0 0 1px ${t.color.onAccent};
}
/*
 * A token that does not apply is unavailable, not erased.
 *
 * 0.4 put the name at 3.58:1 and its value at 2.11:1 — you could see that a row
 * was there and not read which token it was, so "why can I not pick this one?"
 * had no answer on screen. WCAG exempts a disabled control from contrast, which
 * is how every disabled state in this chrome drifted to the same place.
 *
 * It was raised to \`opacity: 0.7\` and that fixed the name (7.70:1) without ever
 * fixing the value (3.63:1, against the 4.5:1 text owes). That is the flaw in
 * dimming a ROW: the row has two inks at different weights, one fraction moves
 * both, and there is no single fraction that lands them both — tune it for the
 * quiet one and the loud one stops reading as disabled at all.
 *
 * So both inks are named instead, and they converge. A disabled row is the one
 * place the name/value hierarchy is worth giving up: the row is not offering a
 * choice any more, it is explaining why it cannot.
 */
.de-token-row[aria-disabled="true"] .de-token-row-name,
.de-token-row[aria-disabled="true"] .de-token-row-detail { color: ${t.color.textDisabled}; }
.de-token-empty { padding: ${t.space.md}px; color: ${t.color.textDim}; font-size: ${t.type.body}; }

/* ---------- the way out of the list ---------- */
/*
 * A footer rather than a row in the list: what a designer types here is not one
 * more choice among the system's, it is the decision to leave it. The rule above
 * says so — the same hairline the header uses, so the list reads as closed
 * before this field starts.
 *
 * Its geometry copies the search row on purpose. The two are the picker's only
 * text fields, they sit at its two ends, and giving the escape hatch a heavier
 * treatment would advertise it over the seventy-one rows it is the exception to.
 */
.de-token-custom {
  display: flex; align-items: center; gap: ${t.space.md}px;
  padding: 0 ${t.space.md}px; height: ${t.size.sectionHeader}px;
  border-top: 1px solid ${t.color.border};
  color: ${t.color.textDim};
}
.de-token-custom-label { flex: none; font-size: ${t.type.body}; }
.de-token-custom-input {
  flex: 1; min-width: 0;
  border: none; background: transparent;
  color: ${t.color.text};
  font: inherit; font-size: ${t.type.body};
  text-align: right;
}
/* Same pair, same argument, as the search input above. */
.de-token-custom-input:focus { outline: none; }
.de-token-custom-input:focus-visible { outline: 2px solid ${t.color.accent}; outline-offset: -2px; }
.de-token-custom-input::placeholder { color: ${t.color.textDim}; }

`
