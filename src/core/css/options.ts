/**
 * Two surfaces that used to be one, and are styled together because the rows
 * still are.
 *
 * `.de-option*` and `.de-style-*` are the saved styles inside the right
 * panel's Typography, Fill, Stroke, Effects, Appearance and Layout sections —
 * this editor's own per-element snapshots, beside the selection every one of
 * their verbs needs.
 * `.de-opt-*` is the left panel's Controls pane: the app's own tunables, the
 * folders they sit in, and the filter and scope switch over them.
 *
 * They share a stylesheet rather than splitting into two because the second set
 * was, until recently, rendered in three places at three widths, and keeping
 * one copy of the row is what stopped them drifting. That is one place now, but
 * splitting the file today would be a rename with no reader on the other end of
 * it.
 */

import { tokens as t, accentFillText } from "../tokens"
import { CONTROL_RADIUS } from "./panels"

export const optionsCss = `/* ---------- options / variants ---------- */
/* \`space.md\` between the name and the two action plates, so their four-sided
   24px pads do not overlap. At \`space.xs\` the rename and delete targets were
   20px apart and 24px wide, so the gap between them armed one of the two. */
.de-option-row { display: flex; align-items: center; gap: ${t.space.md}px; }
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
 * Rename, drawn like Delete because it is the other half of the same strip.
 *
 * It had no control at all until now: renaming was \`dblclick\` on the name span,
 * which no key can reach, so the verb was pointer-only. The button the deleted
 * options dialog carried is what this restores.
 *
 * Every declaration is shared with \`.de-option-delete\` below except the hover,
 * which is the quiet plate rather than the destructive fill — a rename is not a
 * thing to warn anybody about.
 */
.de-option-rename,
.de-option-delete {
  position: relative;
  width: ${t.size.miniSize}px; height: ${t.size.miniSize}px; flex: none;
  border: none; border-radius: ${t.radius.sm};
  background: transparent; color: ${t.color.textDim}; cursor: pointer;
  transition: background ${t.duration.fast} ${t.ease}, color ${t.duration.fast} ${t.ease};
}
/*
 * The pad grows on all FOUR sides, and it grew on two.
 *
 * \`inset: -3px 0\` took the 18px plate to 24px tall and left it 18px wide, so
 * these cleared the pointer floor in one axis only. The layers strip already
 * pads four-sided and the two are the same control; the horizontal half is
 * affordable now that the strip's own gap is \`space.md\` rather than \`xs\`,
 * which is what used to make a four-sided pad overlap its neighbour.
 */
.de-option-rename::after,
.de-option-delete::after {
  content: ""; position: absolute;
  inset: -${(t.size.rowHeight - t.size.miniSize) / 2}px;
}
.de-option-rename:hover { background: ${t.color.bgHover}; color: ${t.color.text}; }
.de-option-rename:focus-visible { outline: 2px solid ${t.color.accent}; outline-offset: 1px; }
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
 * for the whole of the hover.
 *
 * The ink is \`onSemantic\`, where this line used to say \`onAccent\`. Same fix,
 * and it came undone without anyone touching this file: \`onAccent\` was the
 * flipping ink until the accent moved to Figma's blues, which are dark fills in
 * both themes, so it correctly became white in both — and every semantic fill
 * borrowing it went straight back to the ratio its own comment named as the
 * bug. This one measured 2.31:1 again, to the hundredth.
 *
 * \`onSemantic\` is that flipping ink, split into a role of its own so the next
 * accent decision cannot reach it. 7.52:1 on this coral.
 *
 * Focus taking the destructive fill was its own defect: tabbing THROUGH a list
 * of saved options armed each delete in turn, which is a promise the key press
 * does not keep. An accent ring says "focused" and leaves "about to destroy
 * this" to the pointer that is actually on it.
 */
.de-option-delete:hover { background: ${t.color.danger}; color: ${t.color.onSemantic}; }
.de-option-delete:focus-visible { outline: 2px solid ${t.color.accent}; outline-offset: 1px; }

/* ---------- scoped styles, inside a design section ---------- */
/* The header strip when a section carries both the styles toggle and a \`+\`:
   \`section()\` takes one actions element, so the pair shares this wrapper. Same
   gap as \`.de-section-actions\` so the two 24px hit pads do not overlap. */
.de-style-actions { display: inline-flex; align-items: center; gap: ${t.space.md}px; }
/* The toggle is accent-inked while the element matches a style, so a closed
   section still says a style is in play from its header. */
.de-style-toggle--applied { color: ${t.color.accent}; }
.de-style-toggle[aria-expanded="true"] { background: ${t.color.bgHover}; color: ${t.color.text}; }
.de-style-block { display: flex; flex-direction: column; gap: ${t.space.sm}px; }
.de-style-block[hidden],
.de-style-panel[hidden],
.de-style-applied[hidden] { display: none; }
/* The applied style, always visible while the panel is shut: the glyph and the
   name, with the kind trailing in the secondary ink. */
.de-style-applied {
  display: flex; align-items: center; gap: ${t.space.md}px;
  height: ${t.size.rowHeight}px; padding: 0 ${t.space.sm}px;
  border-radius: ${t.radius.md};
  background: ${t.color.bgSunken}; color: ${t.color.text};
}
.de-style-applied > svg,
.de-option > svg { flex: none; color: ${t.color.textDim}; }
.de-style-applied-kind { flex: none; color: ${t.color.textDim}; font-size: ${t.type.body}; }
.de-style-panel {
  display: flex; flex-direction: column; gap: ${t.space.sm}px;
  padding-bottom: ${t.space.md}px;
  border-bottom: 1px solid ${t.color.border};
}
.de-style-list { display: flex; flex-direction: column; }
.de-style-empty {
  margin: 0; color: ${t.color.textDim};
  font-size: ${t.type.body}; line-height: ${t.type.leadingRow};
}
/* Update is \`aria-disabled\` while the style already matches: reachable and
   announced, drawn as unavailable, with no hover promising a press. */
.de-option-rename[aria-disabled="true"],
.de-option-rename[aria-disabled="true"]:hover {
  background: transparent; color: ${t.color.textDisabled}; cursor: default;
}

/* ---------- the left panel's Controls pane ---------- */
/*
 * What used to be here was a 460px \`position: fixed\` window — a root, a
 * shell, a header, a title, a close button and a two-button pseudo-tab strip,
 * some seventy lines — pinned to the bottom-left of the canvas with a
 * \`z-index\` in the two-billions. All of it is gone, and none of it was
 * replaced: a pane inside \`.de-tabpanel\` is docked, so it has no position to
 * compute, no shadow to lift it off a page it should never have been over, no
 * corner to be dismissed from, and no strip of its own because the panel it
 * lives in already has one.
 *
 * The pane fills the tabpanel and scrolls as a whole, like the Layers tree
 * beside it. It carried \`.de-opt-scroll\` — flex, min-height, its own
 * \`overflow-y\` and its own scrollbar skin — which was the window's way of
 * keeping a fixed header over a scrolling list. \`.de-tabpanel\` already does
 * every part of that, so the rule was a second answer to a solved question and
 * a second scrollbar to keep looking like the first.
 */
.de-controls { display: flex; flex-direction: column; }

/*
 * The scope switch, under the filter and above the tree.
 *
 * It reuses \`.de-opt-chips\` and \`.de-opt-chip\` rather than growing a
 * treatment of its own: the choice chips inside a select control's row are the
 * same gesture — pick exactly one of these — and two drawings for one gesture
 * inside one pane is two things for the reader to learn. The side padding
 * matches \`.de-opt-filter\`'s margin so the chips start on the column the
 * field above them starts on.
 */
.de-opt-scope {
  flex: none;
  display: flex; flex-direction: column; gap: ${t.space.sm}px;
  padding: 0 ${t.space.md}px ${t.space.md}px;
}
/*
 * The unavailable chip is \`aria-disabled\`, never \`disabled\`, so it keeps its
 * place in the tab order and its reason stays reachable — see the comment in
 * \`panels/controls.ts\`. It therefore has to LOOK unavailable without the UA
 * styling that comes free with the attribute nobody may use here.
 *
 * \`textDisabled\` is the rung the token set ships for exactly this, and the
 * cursor is the default arrow rather than \`not-allowed\`: the chip is still
 * focusable and still announced, so a slashed circle would overstate how dead
 * it is. Hover does nothing, because nothing is going to happen.
 */
.de-opt-chip[aria-disabled="true"] {
  color: ${t.color.textDisabled};
  border-color: ${t.color.border};
  cursor: default;
}
.de-opt-chip[aria-disabled="true"]:hover {
  background: ${t.color.bgRaised};
  color: ${t.color.textDisabled};
}
/* The reason a control is unavailable, in visible text beside it rather than in
   a tooltip that control can never open. Shared by the scope chip here and by
   the Saved styles verbs in the right panel, because it is one answer to one
   problem: \`aria-disabled\` keeps a button reachable and says nothing about
   why. \`textDim\` is the secondary rung — it is an explanation
   of a control, not a control. */
.de-opt-reason {
  margin: 0;
  color: ${t.color.textDim};
  font-size: ${t.type.body}; line-height: ${t.type.leadingRow};
}
.de-opt-reason[hidden] { display: none; }

/* The headline of an empty state, above its sentence. \`.de-empty\` is centred
   dim prose; this is the one line in it that has to read as a statement of what
   is going on, so it takes the text rung and the section weight. */
.de-empty-title {
  margin-bottom: ${t.space.sm}px;
  color: ${t.color.text};
  font-weight: ${t.type.weightSection};
}

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
  border: 1px solid ${t.color.borderInteractive}; border-radius: ${CONTROL_RADIUS};
  background: ${t.color.bgSunken}; color: ${t.color.text};
  font-family: inherit; font-size: ${t.type.body};
  outline: none;
}
.de-opt-filter:focus { border-color: ${t.color.accent}; }
/*
 * The clear button is the user agent's drawing, and it is now TOLD which theme
 * it is in rather than being inverted after the fact.
 *
 * \`filter: invert(1)\` was unconditional: it turned Chrome's dark ✕ white, which
 * is right on the dark chrome and wrong on paper, where it produced a white
 * glyph on a white field. \`css/base.ts\` declares \`color-scheme\` per theme on
 * \`[data-designlayer]\` now, so the agent draws the correct ✕ for the theme
 * that is actually up and this correction has nothing left to correct. Only the
 * opacity stays — that is a decision about prominence, not about colour.
 */
.de-opt-filter::-webkit-search-cancel-button { opacity: 0.5; }

/* The trailing gutter is a rung above the sides on purpose — it was 10 against
   8 — so rounding it down to match them would close the only air under the last
   row of a scroller. */
.de-opt-body { display: flex; flex-direction: column; padding: 0 ${t.space.md}px ${t.space.lg}px; }
.de-opt-note {
  margin: 0 0 ${t.space.md}px; padding: ${t.space.md}px;
  max-width: ${t.type.measure};
  border-left: 2px solid ${t.color.borderStrong}; border-radius: ${t.radius.sm};
  background: ${t.color.bgSunken};
  color: ${t.color.textMuted}; font-size: ${t.type.body}; line-height: ${t.type.leadingBody};
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
/*
 * THE FOLDER OPENS, where its caret used to open alone.
 *
 * The fourth of four disclosures in this chrome built the same way: a mark that
 * animates over a body that does not. A native \`<details>\` is the hardest of
 * the four because the element does its own showing — the body is simply not
 * rendered while the parent is shut, so there is nothing to transition from.
 *
 * WHAT THIS ACHIEVES AND WHAT IT DOES NOT — measured, because the honest answer
 * is "most of the way".
 *
 * The same \`0fr -> 1fr\` the other three folds use, read off the native
 * attribute rather than tracked in parallel. Shut, the body measures 0. Opened,
 * Chrome renders it and resolves the new row in ONE recalculation, so there is
 * no clean starting value for the \`fr\` to interpolate from: the first frame
 * lands at 77.6 of an eventual 110.4px and the remaining 30% eases over ~150ms.
 *
 * That is a real improvement on the hard cut it replaces and it is not the full
 * fold the other three get. Closing it properly means driving the height from
 * JS on a frame boundary, the way \`core/leave.ts\`'s \`revealGroup\` does — which
 * needs a hand in the TypeScript that owns this element, and that file is not
 * this sheet's to edit. Left here deliberately, with the number, so the next
 * person can see the gap rather than assume it was never looked at.
 *
 * \`minmax(0, Xfr)\` for the reason the "Why?" fold gives: a bare \`0fr\` is
 * \`minmax(auto, 0fr)\`, whose automatic minimum is the padded box, so a shut
 * folder would keep a band of itself and animate from that band.
 */
.de-opt-folder > /*
 * The gap BETWEEN rows is larger than the gap inside one, and it was smaller.
 *
 * This stacked at \`space.xs\` (2) rows whose own children sit at \`space.sm\`
 * (4) — a ratio of 0.5 where the grouping rule wants at least 2. Read literally
 * that says a control's label is further from its own field than it is from the
 * next control entirely, and a reader scanning the fold has nothing to bind a
 * label to but proximity. \`space.md\` (8) against the row's 4 is exactly 2x.
 */
.de-opt-folder-body {
  display: grid;
  grid-template-rows: minmax(0, 0fr);
  transition: grid-template-rows ${t.duration.base} ${t.ease};
}
.de-opt-folder[open] > .de-opt-folder-body {
  grid-template-rows: minmax(0, 1fr);
}
.de-opt-folder-body {
  padding: 0 0 ${t.space.md}px ${t.space["2xl"]}px;
  display: flex; flex-direction: column; gap: ${t.space.md}px;
}
/* The inner track is what actually clips while the row closes. */
.de-opt-folder > .de-opt-folder-body > * { min-height: 0; }
/*
 * There is no inline copy of this tree any more, so there is no cap on one.
 *
 * \`.de-opt-folder--inline\` capped a folder body at 260px with its own
 * scrollbar, and it existed for one reason: the inspector used to render this
 * same row inline, and relevance counts a control whose selector matches
 * anything INSIDE the selected element — so picking a container bound most of
 * the app's inventory and pushed Appearance thousands of pixels down a panel
 * scoped to one element. The cap treated the symptom. Moving the app-scoped
 * tree to a pane of its own removed the cause, and a nested scroller inside a
 * scrolling pane was never a thing anyone wanted to operate.
 */

/*
 * Vertical on the workhorse step, horizontal on the tight one, where it used to
 * be 6/6/7 — three numbers for one box, the odd 7 explained by nothing.
 *
 * The sides are the tight step, and the reason has survived the move that
 * killed the window it was written for. This row used to be rendered twice —
 * once at 460px, once inline in the 260px inspector — and the inline copy is
 * what forced the narrow side padding. It now lives only in the left panel,
 * which mounts at 240px and drags down to 180: NARROWER than the inspector copy
 * ever was, inside a folder body already indented 16px. Eight a side comes
 * straight off the mono \`.de-opt-path\`, which breaks mid-word to fit as it is.
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
/* The chip rests on \`bgRaised\`, so it lifts to \`bgRaisedHover\`. \`bgHover\` is
   a rung BELOW the card here, which made pointing at a chip darken it — the
   fifth instance of the bug class that token was added to close. */
.de-opt-chip:hover { background: ${t.color.bgRaisedHover}; color: ${t.color.text}; }
/*
 * Two attributes, one treatment, and they are not interchangeable upstream.
 *
 * A choice chip inside a control row is \`aria-pressed\` — it is a toggle that
 * writes a value. The scope chips are \`role="radio"\` with \`aria-checked\`,
 * because picking one of two mutually exclusive views is the radio pattern and
 * a pair of independent toggles would let a reader press both. The DRAWING is
 * the same on purpose: both answer "which one of these is taken", and a reader
 * should not have to learn that this product tints a chosen chip two ways.
 */
.de-opt-chip[aria-pressed="true"],
.de-opt-chip[aria-checked="true"] {
  ${accentFillText} border-color: ${t.color.accent};
}
.de-opt-chip:focus-visible { outline: 2px solid ${t.color.accent}; outline-offset: 1px; }

.de-opt-actions { display: flex; flex-wrap: wrap; gap: ${t.space.sm}px; padding-top: ${t.space.xs}px; }
/*
 * A verb that cannot run, drawn as one, without the attribute that would hide
 * its own explanation.
 *
 * \`aria-disabled\` says it to the accessibility tree and nothing at all to the
 * eye, so a sighted reader would see three identical live buttons and press one
 * that silently declined. This is \`.de-button[disabled]\`'s treatment, restated
 * for the attribute that leaves the control reachable: ink to \`textDisabled\`,
 * fill unchanged, no \`opacity\` — for the reason \`toolbar.ts\` gives, that
 * fading both together is what let the pair drift under the floor to begin
 * with, and it would fade the focus ring off a control that can still be
 * focused. Hover is cancelled too, because a lift is a promise of a press.
 */
.de-opt-actions .de-button[aria-disabled="true"],
.de-opt-actions .de-button[aria-disabled="true"]:hover {
  cursor: default;
  background: ${t.color.bgRaised};
  color: ${t.color.textDisabled};
}
/* \`.de-opt-row--variant\` was here: a bordered card around one saved style in
   the deleted window's second tab. Saved styles are \`.de-option-row\` in the
   right panel and have been for as long as the two lists disagreed about which
   verbs they offered; the modifier only ever dressed the duplicate. */

/*
 * THE "WHY?" DISCLOSURE OPENS, WHERE IT USED TO APPEAR.
 *
 * One of four folds in this chrome built the same way: a control that animates
 * and a body switched with \`display: none\`, so the mark moves and the thing it
 * discloses arrives between two frames.
 *
 * Done entirely from the stylesheet, with \`:has()\` reading the state off the
 * body's own \`hidden\` attribute, because the element that owns it lives in a
 * file this sheet does not get to edit. That is a better fit here than the
 * \`revealGroup\` helper anyway: this wrapper is persistent — it is not rebuilt
 * when the fold is toggled — so a declarative rule gets the CLOSE as well, which
 * the imperative helper cannot.
 *
 * \`minmax(0, Xfr)\` rather than a bare \`0fr\`: a bare one resolves to
 * \`minmax(auto, 0fr)\`, whose automatic minimum is the padded box, so a shut
 * fold keeps a band of its own background and animates from that band rather
 * than from nothing.
 */
.de-opt-whywrap {
  display: grid;
  grid-template-rows: min-content minmax(0, 0fr);
  gap: ${t.space.sm}px;
  transition: grid-template-rows ${t.duration.base} ${t.ease};
}
.de-opt-whywrap:has(.de-opt-why:not([hidden])) {
  grid-template-rows: min-content minmax(0, 1fr);
}
.de-opt-link {
  align-self: flex-start;
  padding: 0; border: none; background: transparent;
  color: ${t.color.textDim};
  font-family: inherit; font-size: ${t.type.body};
  /*
   * The chrome's only underline, so this is the only place the two properties
   * that make one readable can be said.
   *
   * \`from-font\` takes the line's position and thickness from the metrics the
   * face ships rather than from the browser's own guess, and \`skip-ink: auto\`
   * opens a gap where the line would otherwise run through the tail of a g, a
   * y or a p. The existing \`text-underline-offset: 2px\` was solving half of the
   * same problem by pushing the line away from the whole baseline; it stays,
   * because the two are not alternatives — the offset sets the distance and
   * \`from-font\` sets where the distance is measured from.
   */
  text-decoration: underline;
  text-underline-position: from-font;
  text-decoration-skip-ink: auto;
  text-underline-offset: 2px; cursor: pointer;
}
.de-opt-link:hover { color: ${t.color.text}; }
.de-opt-link:focus-visible { outline: 2px solid ${t.color.accent}; outline-offset: 2px; }
.de-opt-why {
  margin: 0; padding: ${t.space.md}px;
  max-width: ${t.type.measure};
  border-radius: ${t.radius.sm};
  background: ${t.color.bgSunken}; color: ${t.color.textMuted};
  font-size: ${t.type.body}; line-height: ${t.type.leadingBody};
  /* The grid row above is what closes; this keeps the prose from spilling out
     of it while it does. */
  overflow: hidden;
}
/*
 * \`display\` stays, but as \`block\` rather than \`none\`: the row above is doing
 * the hiding, and a shut fold that is \`display: none\` has no box for the grid
 * to animate. \`visibility\` delayed out and immediate back is what keeps a shut
 * fold genuinely out of the tab order rather than merely invisible — the same
 * pairing \`css/base.ts\` uses on the panels.
 */
.de-opt-why[hidden] {
  display: block;
  visibility: hidden;
  transition: visibility 0s linear ${t.duration.base};
}

`
