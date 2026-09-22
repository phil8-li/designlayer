/** Saved option rows, the design-options browser, and the AI prompt panel. */

import { tokens as t, accentFill } from "../tokens"

export const optionsCss = `/* ---------- options / variants ---------- */
.de-option-row { display: flex; align-items: center; gap: ${t.space.xs}px; }
/*
 * Two jobs, two rungs. The gap is the run between the mark and the name, so it
 * takes the workhorse step; the side padding sits inside a 24px row in a 260px
 * panel, where the same step would spend on air the width the name needs to
 * finish before its ellipsis. It was 6 leading and 4 trailing, an asymmetry
 * nothing in the row justified.
 */
.de-option {
  flex: 1; min-width: 0;
  display: flex; align-items: center; gap: ${t.space.md}px;
  height: ${t.size.rowHeight}px; padding: 0 ${t.space.sm}px;
  border-radius: ${t.radius.md};
  cursor: pointer;
}
/*
 * Hover is the quiet rung, and it has to be: checked is an \`accentSoft\` wash
 * at 1.40:1 off the panel, and \`bgHover\` is 1.44:1. Pointing at an unchosen
 * option lit it brighter than the chosen one — the control told you the wrong
 * answer for exactly as long as your hand was on it. \`bgHoverQuiet\` at 1.19:1
 * leaves selection on top, which is the ordering the states have to keep.
 */
.de-option:hover { background: ${t.color.bgHoverQuiet}; }
.de-option[aria-checked="true"] { background: ${t.color.accentSoft}; box-shadow: inset 0 0 0 1px ${t.color.accent}; }
/* It is \`tabindex="0"\` and a \`role="radio"\`, and it had no focus state at all —
   arrowing through saved options moved a cursor nothing on screen drew. */
.de-option:focus-visible { outline: 2px solid ${t.color.accent}; outline-offset: -2px; }
.de-option-name { flex: 1; overflow: hidden; text-overflow: ellipsis; }
/*
 * Visible at rest. It used to be \`opacity: 0\` until hover, which meant the one
 * verb this panel actually supports was invisible to anyone reading the screen.
 *
 * The hit pad is the same one \`.de-mini\` and \`.de-layer-action\` carry: an 18px
 * plate in a 24px row, with the target taking the row's full height and none of
 * its neighbour's width.
 *
 * The bleed is derived from those two sizes rather than written as 3px or
 * rounded onto the spacing scale. It is not rhythm — it is half of what the row
 * has over the plate — and the nearest step, 4, would hang a 26px target in a
 * 24px row, so pointing at the gap between two rows would arm one of them.
 */
.de-option-delete {
  position: relative;
  width: ${t.size.miniSize}px; height: ${t.size.miniSize}px; flex: none;
  border: none; border-radius: ${t.radius.sm};
  background: transparent; color: ${t.color.textDim}; cursor: pointer;
  transition: background ${t.duration.fast} ${t.ease}, color ${t.duration.fast} ${t.ease};
}
.de-option-delete::after {
  content: ""; position: absolute;
  inset: -${(t.size.rowHeight - t.size.miniSize) / 2}px 0;
}
/*
 * Dark ink on the coral, never white — and focus is a ring, not the fill.
 *
 * This was the live case of the pairing trap \`accentFill\` exists to close, and
 * the one the report about labels the same colour as their button was pointing
 * at: \`danger\` is a LIGHT coral on this chrome, so the white X measured 2.31:1
 * and the button you press to destroy a saved option was an empty coral square
 * for the whole of the hover. \`onAccent\` on the same fill is 8.25:1. The mini
 * danger button in panels.ts and the layer tree's bin already flipped; this was
 * the third of the three and the only one still white.
 *
 * Focus taking the destructive fill was its own defect: tabbing THROUGH a list
 * of saved options armed each delete in turn, which is a promise the key press
 * does not keep. An accent ring says "focused" and leaves "about to destroy
 * this" to the pointer that is actually on it.
 */
.de-option-delete:hover { background: ${t.color.danger}; color: ${t.color.onAccent}; }
.de-option-delete:focus-visible { outline: 2px solid ${t.color.accent}; outline-offset: 1px; }

/* ---------- design options browser ---------- */
/* The 10s are where this window SITS — a viewport inset off the left panel and
   off the bottom edge — not rhythm inside it, so they stay literals while the
   spacing in the window moves onto the scale. The 20 below is the two of them
   added up, and has to keep tracking them. */
[data-designlayer].de-options-root {
  position: fixed;
  left: calc(var(--de-left) + 10px);
  bottom: 10px;
  z-index: 2147483100;
  display: flex; flex-direction: column; align-items: flex-start; gap: ${t.space.md}px;
  pointer-events: none;
}
.de-options-root > * { pointer-events: auto; }

.de-options-root .de-opt-window {
  width: 460px;
  max-width: calc(100vw - var(--de-left) - var(--de-right) - 20px);
  max-height: min(72vh, 720px);
  display: flex; flex-direction: column;
  border: 1px solid ${t.color.border}; border-radius: ${t.radius.lg};
  background: ${t.color.bg};
  box-shadow: ${t.shadow.popover};
  overflow: hidden;
}
.de-options-root .de-opt-window[hidden] { display: none; }

/* \`sectionHeader\`, which is what this is, rather than the 34px it had: that is
   \`tabBar\`, borrowed by eye from the inspector strip, and it left the two
   popover headers in the chrome two pixels apart for no reason either could
   name. The token picker's header was already on this rung. */
.de-opt-header {
  display: flex; align-items: center; justify-content: space-between;
  height: ${t.size.sectionHeader}px; padding: 0 ${t.space.md}px 0 ${t.space.lg}px;
  border-bottom: 1px solid ${t.color.border};
}
.de-opt-title { font-size: ${t.type.body}; font-weight: ${t.type.weightSection}; }
/* 24px, not 22: a square two pixels under the floor, and two pixels off the
   row height every other control in this window now shares. */
.de-opt-close {
  width: ${t.size.rowHeight}px; height: ${t.size.rowHeight}px;
  border: none; border-radius: ${t.radius.sm};
  background: transparent; color: ${t.color.textDim};
  display: inline-flex; align-items: center; justify-content: center;
  line-height: 1; cursor: pointer;
}
.de-opt-close:hover { background: ${t.color.bgHover}; color: ${t.color.text}; }
.de-opt-close:focus-visible { outline: 2px solid ${t.color.accent}; outline-offset: -2px; }

.de-opt-tabs { display: flex; gap: ${t.space.xs}px; padding: ${t.space.md}px ${t.space.md}px 0; }
.de-opt-tab {
  height: ${t.size.rowHeight}px; padding: 0 ${t.space.md}px;
  border: none; border-radius: ${t.radius.md};
  background: transparent; color: ${t.color.textMuted};
  font-family: inherit; font-size: ${t.type.body}; font-weight: ${t.type.weightValue}; cursor: pointer;
}
.de-opt-tab:hover { background: ${t.color.bgHover}; color: ${t.color.text}; }
.de-opt-tab[aria-pressed="true"] { ${accentFill} }
.de-opt-tab:focus-visible { outline: 2px solid ${t.color.accent}; outline-offset: 1px; }

/*
 * \`borderInteractive\`, which is the rung tokens.ts ships for the boundary of a
 * control you can act on, and not \`border\`, which is the rung it ships for a
 * divider between two things you cannot.
 *
 * On the mid-slate the difference was academic. Here \`border\` measures 1.55:1
 * against the window behind it — under the 3:1 WCAG 1.4.11 asks of a control's
 * own boundary, and visibly so: the filter, the number input and the token
 * field all read as text floating on the surface rather than as places to type.
 * \`borderInteractive\` is 2.90:1 on this ground, which is the best the rung set
 * has; it is documented as 3.2:1, measured on the slate it was cut against, and
 * the token owner should either re-cut it or re-word the comment.
 */
.de-opt-filter {
  margin: ${t.space.md}px; padding: 0 ${t.space.md}px;
  height: ${t.size.rowHeight}px;
  border: 1px solid ${t.color.borderInteractive}; border-radius: ${t.radius.md};
  background: ${t.color.bgSunken}; color: ${t.color.text};
  font-family: inherit; font-size: ${t.type.body};
  outline: none;
}
.de-opt-filter:focus { border-color: ${t.color.accent}; }
.de-opt-filter::-webkit-search-cancel-button { filter: invert(1); opacity: 0.5; }

.de-opt-scroll { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; }
.de-opt-scroll::-webkit-scrollbar { width: 8px; }
.de-opt-scroll::-webkit-scrollbar-thumb {
  background: transparent; border-radius: ${t.radius.md};
  border: 2px solid transparent; background-clip: content-box;
}
.de-opt-scroll:hover::-webkit-scrollbar-thumb { background: ${t.color.borderStrong}; background-clip: content-box; }

/* The trailing gutter is a rung above the sides on purpose — it was 10 against
   8 — so rounding it down to match them would close the only air under the last
   row of a scroller. */
.de-opt-body { display: flex; flex-direction: column; padding: 0 ${t.space.md}px ${t.space.lg}px; }
.de-opt-note {
  margin: 0 0 ${t.space.md}px; padding: ${t.space.md}px;
  border-left: 2px solid ${t.color.borderStrong}; border-radius: ${t.radius.sm};
  background: ${t.color.bgSunken};
  color: ${t.color.textMuted}; font-size: ${t.type.body}; line-height: 1.5;
}

.de-opt-folder { border-top: 1px solid ${t.color.border}; }
/* \`sectionHeader\`: a fold target, and the token exists because a fold target
   wants to be taller than the rows it folds. 28 was neither that nor a row. */
.de-opt-summary {
  display: flex; align-items: center; gap: ${t.space.md}px;
  height: ${t.size.sectionHeader}px; padding: 0 ${t.space.sm}px;
  cursor: pointer; list-style: none;
  font-size: ${t.type.body}; font-weight: ${t.type.weightSection};
}
.de-opt-summary:focus-visible { outline: 2px solid ${t.color.accent}; outline-offset: -2px; }
.de-opt-summary::-webkit-details-marker { display: none; }
/* A real glyph from the vendored set rather than a \`content\` character, so the
   disclosure marks in this panel, the inspector and the layer tree are one
   drawing at one weight instead of three fonts' idea of a triangle. */
.de-opt-twisty {
  flex: none;
  display: inline-flex; align-items: center; justify-content: center;
  color: ${t.color.textDim};
  transition: transform ${t.duration.fast} ${t.ease};
}
.de-opt-folder[open] > .de-opt-summary > .de-opt-twisty { transform: rotate(90deg); }
/* A full-bleed band, so the quiet rung — see the hover rule in panels.ts. */
.de-opt-summary:hover { background: ${t.color.bgHoverQuiet}; }
/* Shrinkable, with an ellipsis. \`flex: none\` let a folder named after a long
   source path push the count off the end of the row and out of the window. */
.de-opt-folder-name {
  flex: 0 1 auto; min-width: 0;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.de-opt-count { flex: 1; color: ${t.color.textDim}; font-size: ${t.type.body}; font-weight: ${t.type.weightBody}; }
/* 16 rather than 14: one indent step, the same one the layer tree uses, and on
   the step set. 14 was a number that happened to look about right. */
.de-opt-folder-body {
  padding: 0 0 ${t.space.md}px ${t.space["2xl"]}px;
  display: flex; flex-direction: column; gap: ${t.space.xs}px;
}
/* Only the inspector's inline copy scrolls. The options browser is a full-height
   list of its own and must keep growing. */
.de-opt-folder--inline > .de-opt-folder-body { max-height: 260px; overflow-y: auto; }

/*
 * Vertical on the workhorse step, horizontal on the tight one, where it used to
 * be 6/6/7 — three numbers for one box, the odd 7 explained by nothing.
 *
 * The sides are the tight step because this row is not only a row in a 460px
 * window: \`optionsSection\` renders the same node inline in the 260px inspector,
 * inside a folder body already indented 16px. Eight a side there comes off the
 * mono \`.de-opt-path\`, which breaks mid-word to fit as it is.
 */
.de-opt-row {
  display: flex; flex-direction: column; gap: ${t.space.sm}px;
  padding: ${t.space.md}px ${t.space.sm}px;
  border-radius: ${t.radius.md};
}
/*
 * Hover goes UP, not down. This lifted the row to \`bgSunken\` — a 1.10:1 step
 * in the wrong direction, the faintest state change in the chrome, and the only
 * hover anywhere that made a surface darker than the thing it sits on.
 */
.de-opt-row:hover { background: ${t.color.bgHoverQuiet}; }
/*
 * A hidden row is dimmed ONCE. At 0.55 the fade compounded with ink that was
 * already \`textDim\` — the type, the path and the count landed at 2.89:1, so a
 * row you had hidden lost the very labels that say what it was. 0.7 holds the
 * secondary ink at 3.86:1 and the label at 8.78:1, and the row is still plainly
 * the quiet one beside a live neighbour at 16.8:1.
 */
.de-opt-row[data-hidden] { opacity: 0.7; }
.de-opt-head { display: flex; align-items: baseline; gap: ${t.space.md}px; }
.de-opt-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/*
 * The eyebrow and the two tags were the last \`micro\` call sites in the chrome:
 * 9px, which is three quarters of the 12px floor and the size at which an
 * uppercase word stops being read and starts being recognised by shape. They
 * are on \`body\` now and keep their rank the way everything else does — the
 * eyebrow by ink and case, the tag by its plate.
 */
.de-opt-type { color: ${t.color.textDim}; font-size: ${t.type.body}; text-transform: uppercase; letter-spacing: 0.04em; }
.de-opt-tag {
  padding: 0 ${t.space.sm}px;
  border-radius: ${t.radius.sm};
  background: ${t.color.bgHover}; color: ${t.color.textMuted};
  font-size: ${t.type.body}; font-weight: ${t.type.weightValue};
}
.de-opt-tag--saved { background: ${t.color.accentSoft}; color: ${t.color.text}; }
.de-opt-path {
  font-family: ${t.font.mono}; font-size: ${t.type.body};
  color: ${t.color.textDim}; word-break: break-all;
}
.de-opt-value { color: ${t.color.text}; font-family: ${t.font.mono}; font-size: ${t.type.body}; }
.de-opt-check { display: inline-flex; align-items: center; gap: ${t.space.md}px; color: ${t.color.textMuted}; cursor: pointer; }
/* Row height and the interactive boundary, so it lines up with the filter above
   it instead of sitting 4px shorter in the same column of controls. */
.de-opt-input {
  height: ${t.size.rowHeight}px; padding: 0 ${t.space.sm}px;
  border: 1px solid ${t.color.borderInteractive}; border-radius: ${t.radius.sm};
  background: ${t.color.bgSunken}; color: ${t.color.text};
  font-family: ${t.font.mono}; font-size: ${t.type.body};
  outline: none;
}
.de-opt-input:focus { border-color: ${t.color.accent}; }

/* The variant list is the answer to "what options do we have?" — always shown. */
.de-opt-chips { display: flex; flex-wrap: wrap; gap: ${t.space.sm}px; }
/*
 * \`borderInteractive\`, for the reason \`.de-opt-filter\` gives, and here it is
 * the whole edge: the chip's \`bgRaised\` fill is 1.19:1 off the panel, so a
 * 1.55:1 hairline was the only thing saying where the button stopped. Padding
 * is \`xs\`/\`md\` rather than the 1/7 it was, the two nearest steps on the set.
 */
.de-opt-chip {
  padding: ${t.space.xs}px ${t.space.md}px;
  border: 1px solid ${t.color.borderInteractive}; border-radius: ${t.radius.xl};
  background: ${t.color.bgRaised}; color: ${t.color.textMuted};
  font-family: inherit; font-size: ${t.type.body}; cursor: pointer;
  transition: background ${t.duration.fast} ${t.ease}, color ${t.duration.fast} ${t.ease};
}
.de-opt-chip:hover { background: ${t.color.bgHover}; color: ${t.color.text}; }
.de-opt-chip[aria-pressed="true"] {
  ${accentFill} border-color: ${t.color.accent};
}
.de-opt-chip:focus-visible { outline: 2px solid ${t.color.accent}; outline-offset: 1px; }

.de-opt-actions { display: flex; flex-wrap: wrap; gap: ${t.space.sm}px; padding-top: ${t.space.xs}px; }
.de-opt-row--variant { border: 1px solid ${t.color.border}; }

.de-opt-whywrap { display: flex; flex-direction: column; gap: ${t.space.sm}px; }
.de-opt-link {
  align-self: flex-start;
  padding: 0; border: none; background: transparent;
  color: ${t.color.textDim};
  font-family: inherit; font-size: ${t.type.body}; text-decoration: underline;
  text-underline-offset: 2px; cursor: pointer;
}
.de-opt-link:hover { color: ${t.color.text}; }
.de-opt-link:focus-visible { outline: 2px solid ${t.color.accent}; outline-offset: 2px; }
.de-opt-why {
  margin: 0; padding: ${t.space.md}px;
  border-radius: ${t.radius.sm};
  background: ${t.color.bgSunken}; color: ${t.color.textMuted};
  font-size: ${t.type.body}; line-height: 1.5;
}
.de-opt-why[hidden] { display: none; }

`
