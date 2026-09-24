/**
 * Right panel, Annotations tab.
 *
 * The session's outbox, and the one door everything leaves by. A session in
 * this editor produces two kinds of intent — notes about what is wrong, and
 * edits that already fix part of it — and they used to leave separately, when
 * they left at all: notes had nowhere to go, and the change queue only ever
 * carried the subset of edits the writer could not spell in source. Handing an
 * agent one without the other is what makes it redo work that is done, or
 * guess at reasons it was never given.
 *
 * So this is one list in the order things happened, and every row says which
 * of the two it is. An edit says one thing more — whether it reached the file
 * — because an agent reads those cases completely differently: a written
 * change is already in the source it is about to open, and applying it again
 * is a conflict rather than a fix.
 *
 * The settings live here rather than behind a preferences screen for the same
 * reason the queue lives in the panel rather than the toolbar: they are
 * settings ABOUT this list — how much it says, what color its markers are,
 * whether a handover empties it — and reading them anywhere else means reading
 * them away from the thing they describe.
 *
 * The tab is TWO SECTIONS in one scrolling column, Handover then Settings, and
 * nothing is pinned to the bottom edge. Pinning settings there cost a dead gap
 * that grew with the window: a short session showed two notes, then four
 * hundred pixels of nothing, then a fold nobody was looking for. Two headings
 * and one scrollbar says the same thing without spending that space — the
 * second section starts where the first one ends, which is where a reader
 * looks for it.
 *
 * One control moved with it. Output detail used to be a row inside the fold,
 * three scrolls away from the button that copies the thing it governs; it is
 * now a tab strip directly above the list. A control and the thing it changes
 * belong next to each other, and there is exactly ONE of it — two surfaces
 * onto one setting is how a panel comes to disagree with itself.
 */

import { isProjectSourcePath } from "../../core/bridge"
import { createApply } from "../../core/apply"
import { previewOnlyChanges, type PreviewOnlyChange } from "../../core/change-prompt"
import { clear, el } from "../../core/dom"
import { holdScroll } from "../../core/scroll"
import { leaveRow } from "../../core/leave"
import { swapMark } from "../../core/swap-mark"
import { icon, type IconName } from "../../core/icons"
import { requestAgent } from "../../ai/transport"
import {
  annotationSettings,
  clearAnnotations,
  markersVisible,
  onAnnotationsChange,
  onSettingsChange,
  removeAnnotation,
  restoreAnnotation,
  updateSettings,
} from "../../annotations/store"
import { clearEdits, isEditQueued, onEditsChange } from "../../annotations/journal"
import { onComponentUsageChange, sharedComponentWarning } from "../../core/component-usage"
import { withdrawEdit } from "../../core/withdraw"
import { buildAnnotationBrief, outboxItems } from "../../annotations/output"
import {
  OUTPUT_DETAILS,
  type AnnotationRecord,
  type AnnotationTarget,
  type EditRecord,
  type OutboxItem,
  type OutputDetail,
} from "../../annotations/types"
import type { EditorContext } from "../../core/context"
import { section, selectField } from "./field"
import type { InspectorTab } from "./tab-code"
import { tokens } from "../../core/tokens"

/*
 * THE COMPONENTS SWITCH IS GONE, and nothing replaced it.
 *
 * It read "React components" or "Angular components" depending on the host,
 * which is the shape of a question the tool was already answering: the editor
 * detects its framework at startup and `output.ts` reads the stack either way
 * — fiber walk on React, `ng.getOwningComponent` on Angular. The only thing
 * the switch could do was make the brief worse, and it cost a row in a panel
 * where a row is expensive. The stack is always gathered now; how much of it
 * the brief prints is Output detail's job, which is a preference a designer
 * genuinely holds.
 */

/*
 * THE MARKER COLOUR PICKER IS GONE, and the setting it wrote is not.
 *
 * Seven swatches stood here, and before them a native `<input type="color">`.
 * What finished them off is that the choice was never one a designer came to
 * this panel to make: the pin is read by the person who dropped it, in the
 * session they dropped it in, and the shipped blue is legible on a white page
 * and a dark one alike. A row that is right by default is a row nobody opens
 * Settings for, and this block is small enough that every row in it has to
 * earn the line.
 *
 * `markerColor` survives untouched — `annotations/types.ts` still defaults it,
 * `annotations/store.ts` still migrates a stored one off the retired palette,
 * and `annotations/canvas.ts` still paints `--de-ann-color` from it. A project
 * that needs a different pin sets it there, once, rather than by hunting seven
 * circles in a fold. Nothing downstream learned that the picker went away,
 * which is the same bargain the `<input type="color">` removal made.
 */

/**
 * Two sentences, rather than shortened to "Remove".
 *
 * Dropping an edit from the outbox does not undo it: the page keeps the change,
 * and if it was written so does the file. A designer who read this as an undo
 * would empty the list expecting the page to go back to how it was. The second
 * sentence says the one thing "drop" does not.
 */
/**
 * What the bin on an edit row does — and it changed meaning, so it changed words.
 *
 * It used to read "The change stays applied", which was an accurate description
 * of a bug. Dropping a row removed it from the list and from the brief, and
 * left the queued source operation exactly where it was: press Apply afterwards
 * and the change a designer had explicitly discarded went into their files.
 *
 * It is a real withdrawal now (`core/withdraw.ts`): the queued operation is
 * taken back, the preview on the page returns to what it was, and the ledger
 * entry goes with it. So the label says the thing that is now true.
 */
const DROP_EDIT = "Take this change back. The preview reverts and nothing is written."

/**
 * The consequence, said on the button.
 *
 * This used to read "Resolve keeps the record, delete does not", because a tick
 * sat beside the bin and the two were a coin toss under near-identical 18px
 * buttons. The tick is gone, so naming it here would send a reader looking for
 * a control that is not on the row.
 *
 * What replaces it is the part that was always the point: what happens to the
 * note. The neighbouring edit row says the opposite about ITS bin — "the change
 * stays applied" — and the pair only works if each states its own consequence
 * rather than the other's name.
 *
 * It used to end "There is no undo.", which was true and is not any more: the
 * delete now raises a card offering the note back (see `erase`). Leaving the
 * sentence in place would have been the worse of the two possible errors — a
 * reader who believes a reversible action is final does not press it, so the
 * recovery would have paid for nothing.
 *
 * "Undo" rather than a fuller promise, because the label on the card says the
 * same word and the two have to match: a tooltip that offers "a chance to
 * restore it" and a button that says "Undo" are two affordances as far as the
 * reader is concerned.
 */
const DELETE_NOTE = "Delete this note. Undo is offered once it goes."

/**
 * Said as "reopen", not "edit", because the note is written somewhere else.
 *
 * Pressing this does not turn the row into a field. It sends the reader back to
 * the page, to the bubble they wrote the note in, which may be scrolled off
 * screen. A button labelled "Edit" that moves the user's attention to another
 * surface without saying so is how a designer loses track of where they are.
 */
const EDIT_NOTE = "Reopen this note on the page to rewrite it."

/**
 * The two things this panel says to the canvas, and the whole of the coupling.
 *
 * A row and a pin are two drawings of one note, and the panel has no business
 * knowing how the second one is drawn — importing the marker layer to light a
 * pin would make the inspector depend on the overlay for a highlight. An event
 * on `window` is the seam: the panel states a fact about where the pointer is,
 * the canvas decides what that looks like, and neither can break the other's
 * build.
 *
 * `null` is a value in the hover contract rather than a second event, because
 * both halves have to land in one handler on the far side. A listener that only
 * ever hears "now this one" is how a highlight gets stuck on a row the pointer
 * left minutes ago.
 */
const HOVER_EVENT = "designlayer:annotation-hover"
const EDIT_EVENT = "designlayer:annotation-edit"

/**
 * The mirror, coming back the other way: the pointer is on a PIN.
 *
 * This is the reason `.de-ann-item--hover` exists at all rather than the list
 * leaning on CSS `:hover`. A pin hovered on the page has to light its row in a
 * panel the pointer is nowhere near, and no selector can express that.
 */
const MARKER_HOVER_EVENT = "designlayer:marker-hover"

/** The row carries its record's id so the mirror can find it without a map. */
const ITEM_ID = "data-item"

function announceHover(id: string | null): void {
  window.dispatchEvent(new CustomEvent(HOVER_EVENT, { detail: { id } }))
}

/** `3 notes`, `1 note`. Spelled out because the confirm has to count aloud. */
function noteWord(count: number): string {
  return `${count} note${count === 1 ? "" : "s"}`
}

/**
 * The two things the clear-all button can say, and how long it stays asking.
 *
 * Lifted wholesale from the toolbar's chooser link, window included: the second
 * string is not a dialog in disguise, it is the same control saying what
 * pressing it now means, and it reverts on its own because an armed button that
 * stayed armed would let a click ten minutes later empty the list without a
 * word — the exact silence the arming exists to break.
 */
const CLEAR = {
  armedMs: 6000,
  label: (count: number) =>
    count ? `Delete all ${noteWord(count)}. Edits stay in the handover.` : "Delete all notes",
  // The armed state names the outcome of the NEXT click rather than asking a
  // question and answering it: "Delete all 2 notes? Click again to confirm" was
  // the same instruction twice, and the toast has to append the warning to it.
  prompt: (count: number) => `Click again to delete all ${noteWord(count)}`,
} as const

/**
 * What the row calls an edit.
 *
 * `property` is a CSS property for all but these four, which are
 * `change-prompt.ts`'s own sentinels that `EditRecord` deliberately reuses.
 * Printing `icon` or `remove` as though it were a declaration would send the
 * reader to the stylesheet looking for a property nobody ever wrote there.
 */
const EDIT_LABELS: Record<string, string> = {
  class: "class attribute",
  icon: "swap icon",
  text: "text content",
  remove: "delete element",
}

/**
 * The fifth sentinel, and the one that could not be a row in that table: a
 * component prop previewed as a DOM attribute is spelled `attribute:<name>` in
 * the ledger, so the NAME is part of the key rather than one of four known
 * words. Printed raw it reads as a namespace the designer never typed.
 */
function editLabel(property: string): string {
  const known = EDIT_LABELS[property]
  if (known) return known
  const attribute = /^attribute:(.+)$/.exec(property)
  return attribute ? `${attribute[1]} attribute` : property
}

/**
 * ONE LINE, and it is the route in rather than the fact of the emptiness.
 *
 * This was two: "Nothing to hand over yet." over "Pin a note on the page, or
 * change anything in the inspector. Both land here." The first of those said
 * only what an empty list has already said — a box with nothing in it does not
 * need a caption announcing that — and the second spent three wrapped lines of
 * a 260px panel restating the two gestures the toolbar above it offers.
 *
 * So the headline went and the detail was cut to the verbs. An empty outbox is
 * where every session starts, which makes this the copy most often read in the
 * product; the shorter it is, the fewer times a returning user re-reads a
 * sentence they already know. What the merged list is FOR — the order, the
 * agent reading intent and change as one story — was never the empty state's
 * to explain.
 */
const EMPTY_DETAIL = "Pin a note or make an edit."

/**
 * Where a row points, short enough for a 260px panel.
 *
 * Basename and line rather than the full path: the tail is the part that
 * identifies the file to someone who already knows the repo, which is the same
 * call the Code tab's source line makes. Run through `isProjectSourcePath`
 * first, so a bundler chunk the resolver guessed at is never printed as a
 * place to go and edit.
 */
function whereOf(target: AnnotationTarget | null): string {
  if (!target) return "no element"
  const name = target.componentName || `<${target.tagName}>`
  if (!target.filePath || !isProjectSourcePath(target.filePath)) return name
  const file = target.filePath.split("/").pop()
  return target.lineNumber ? `${name} · ${file}:${target.lineNumber}` : `${name} · ${file}`
}

/**
 * The second line of a note: what it is pinned to.
 *
 * A `text` note is ABOUT the exact words, and an agent told only which element
 * they were in has to guess which run of text was meant. A `region` over empty
 * space has no element at all, and "no element" on its own reads as a failure
 * to resolve one rather than as the mode working exactly as intended.
 */
function noteSubject(note: AnnotationRecord): string {
  const where = whereOf(note.target)
  if (note.kind === "text" && note.selectedText) return `“${note.selectedText}” in ${where}`
  if (note.kind === "region" && !note.target) return "A region of the page, over no element"
  return where
}

/** "3 notes and 2 edits", with whichever half is zero left out. */
function outboxSummary(items: OutboxItem[]): string {
  const notes = items.filter((item) => item.type === "note").length
  const edits = items.length - notes
  return [
    notes ? `${notes} note${notes === 1 ? "" : "s"}` : null,
    edits ? `${edits} edit${edits === 1 ? "" : "s"}` : null,
  ]
    .filter((part): part is string => part !== null)
    .join(" and ")
}

/**
 * The files the agent should open first.
 *
 * Filtered through the same `isProjectSourcePath` the rows are, so a compiled
 * chunk never reaches the agent as a path to go and edit. An item with no
 * usable file is not an omission — the brief still describes it by component
 * and selector, which is what an agent greps with.
 */
function filesInOutbox(items: OutboxItem[]): string[] {
  const files = new Set<string>()
  for (const item of items) {
    const path = item.type === "note" ? item.note.target?.filePath : item.edit.target?.filePath
    if (path && isProjectSourcePath(path)) files.add(path)
  }
  return [...files]
}

/** How long the tick stays up after a copy, matching agentation's own. */
const COPIED_FOR = 2000

/*
 * The tick-on-copy helper used to live here, and the argument for it still
 * reads best next to a copy button — but it is a general statement about glyph
 * state and three other surfaces needed it, one of which (the Code tab's copy
 * button) was doing the exact clear-and-append the note warns against. It is
 * `core/swap-mark.ts` now; the reasoning moved with it.
 */

export function annotationsTab(editor: EditorContext): InspectorTab {
  /*
   * ONE LIST PER KIND, because each kind is its own section now.
   *
   * This was a single list holding two `.de-ann-group` blocks inside a section
   * called "Handover", and the panel ended up stating the same split twice: a
   * foldable section header, and then two sub-headings under it, each with a
   * tally of its own. Two piles that are never read together do not need a
   * container saying they are one pile.
   *
   * So the groups became sections. The fold, the chevron, the title column and
   * the trailing actions track are the panel's — the same `section()` the
   * Design tab calls — and each list is simply the body under its own heading.
   */
  const editList = el("div", { class: "de-ann-list" })
  const noteList = el("div", { class: "de-ann-list" })

  const copyMark = swapMark("Copy")
  let copiedTimer = 0

  /**
   * The tick goes up in the CLICK TASK, not when the write resolves.
   *
   * A confirmation two frames behind the press reads as a dead button, and the
   * clipboard promise is not the thing being confirmed anyway — the gesture is.
   * If the browser then refuses, the rejection lands a microtask later and
   * `showCopied` is undone out loud, which is the same bargain the Code tab's
   * copy strikes.
   */
  function showCopied(): void {
    copyMark.show(true)
    if (copiedTimer) clearTimeout(copiedTimer)
    copiedTimer = setTimeout(() => {
      copiedTimer = 0
      copyMark.show(false)
    }, COPIED_FOR) as unknown as number
  }

  function undoCopied(): void {
    if (copiedTimer) clearTimeout(copiedTimer)
    copiedTimer = 0
    copyMark.show(false)
  }

  const copyButton = el(
    "button",
    {
      class: "de-button",
      type: "button",
      title: "Copy every note and edit as one brief",
      onclick: () => {
        const items = outboxItems()
        if (!items.length) {
          // "no notes, no edits" was the same statement a second time. The
          // button is disabled over an empty outbox anyway, so this line is
          // only ever read after a dispatched click.
          editor.toast("Nothing to copy")
          return
        }
        /*
         * Written synchronously inside the click task, before anything awaits:
         * the Clipboard API only works under the transient user activation the
         * click carries, and the browser revokes it the moment the handler
         * yields. Same shape as `copyChangePrompt` and the Code tab's copy.
         */
        let refused = false
        try {
          void navigator.clipboard
            .writeText(buildAnnotationBrief(items))
            .then(clearIfAsked)
            .catch(() => {
              undoCopied()
              editor.toast("The browser refused the clipboard", "error")
            })
        } catch {
          refused = true
        }
        if (refused) {
          undoCopied()
          editor.toast("The browser refused the clipboard", "error")
          return
        }
        showCopied()
        editor.toast(`Copied ${outboxSummary(items)}`)
      },
    },
    /*
     * The label does NOT become "Copied", and the glyph rung is `row`.
     *
     * Both are about the same 244px line. This button is the rightmost of four
     * controls, so a wider label shoves Send leftward and back again two
     * seconds later — a reflow announcing a copy that has already announced
     * itself in the glyph and in the toast. And at `control` the mark stood
     * 16px against a 12px label inside a 24px pill: bigger than the word it
     * qualifies, which is what made the pair read as a glyph with a caption
     * rather than a button. `row` is the rung the Code tab's copy already uses.
     */
    [copyMark.node, "Copy"]
  )

  /**
   * ONE BUTTON THAT FINISHES THE SESSION.
   *
   * This was "Send to agent", beside a separate "Apply to code" welded into the
   * toolbar, and the split between them was the worst thing in the product to
   * explain. It was not a split a designer could reason about: which of the two
   * buttons finished your change depended on whether `core/tailwind.ts` happened
   * to have a word for the CSS property you touched. Recolouring went one way,
   * dragging went the other, and nothing on screen said so.
   *
   * So there is one verb now. It writes everything the writer can spell, and
   * hands everything else to the agent, in that order, and the rows say which
   * happened to what. The designer is never asked to route their own change —
   * that was never a question they had the information to answer.
   *
   * Order matters and is not arbitrary. The write goes FIRST so the brief that
   * follows it describes a source tree that already contains the writable half:
   * an agent handed "set padding to 24px" for an edit that landed a moment ago
   * re-applies it and calls the conflict a merge. `applyAll` awaits, so by the
   * time the brief is built the journal rows have flipped to written and
   * `buildAnnotationBrief` files them under "already written — do not apply
   * these again".
   */
  let sending = false

  /*
   * ONE BUTTON PER GROUP, because the two halves finish differently.
   *
   * There was a single "Apply all" here, and it was the right first move: it
   * ended the era where a designer had to know that a padding tweak went to a
   * codemod and a drag went to an agent. But it also hid something they DO need
   * to know. The two halves have completely different costs — one is a hundred
   * milliseconds and exact, the other is a round trip to a language model that
   * may come back having done something slightly else — and one button spending
   * both made the cheap half wait on the expensive one.
   *
   * So each group owns its own verb, sitting under its own rows. A session that
   * only moved some padding presses one button and is done, and never thinks
   * about an agent at all. A session full of drags and notes presses the other.
   * The grouping is what makes this legible: you are not choosing a MECHANISM,
   * you are finishing the pile you are looking at.
   */
  const writeButton = el(
    "button",
    {
      class: "de-button de-button--primary",
      type: "button",
      title: "Write these straight into your files",
      onclick: () => {
        void writeNow()
      },
    },
    ["Apply to code"]
  )

  const sendButton = el(
    "button",
    {
      class: "de-button de-button--primary",
      type: "button",
      title: "Send these to your coding agent, with the changes already written for context",
      onclick: () => {
        void sendNow()
      },
    },
    []
  )

  /**
   * The Send label, rebuilt rather than assigned.
   *
   * `sendButton.textContent = …` was how the in-flight state was written, and
   * that assignment drops every child — which was harmless while the button was
   * a bare word and silently deletes the glyph now. One function, so the two
   * states cannot come to disagree about whether there is a mark in here.
   */
  function setSendLabel(text: string): void {
    clear(sendButton)
    sendButton.append(icon("Send", tokens.icon.row), text)
  }

  setSendLabel("Send to agent")

  /**
   * The commit, from the module the toolbar's button uses too.
   *
   * Built here rather than passed in because the tab outlives any one
   * selection and the queues are module state — there is nothing per-render to
   * close over. `onChange` is this tab's own repaint: the queues broadcast to
   * their own subscribers, but "the write finished" is the moment the rows'
   * badges change, and only the caller knows that.
   */
  const committer = createApply({
    bridge: editor.bridge,
    toast: (message: string, kind?: "info" | "error") => editor.toast(message, kind),
    onChange: () => render(),
  })

  /**
   * The writable half, and nothing else.
   *
   * Deliberately does NOT fall through to the agent when it finishes. That was
   * "Apply all"'s behaviour and it made the fast path pay for the slow one: a
   * designer who nudged a padding had to wait on an agent round trip they never
   * asked for. Here the two groups are two decisions, and this one is the cheap
   * decision taken alone.
   *
   * The rows do the explaining afterwards — Ready becomes In your files — so
   * there is no summary to write here that the list does not already show.
   */
  async function writeNow(): Promise<void> {
    if (sending) return
    if (!committer.hasPendingChanges()) {
      editor.toast("Nothing to write — these are all in your files already")
      return
    }
    sending = true
    writeButton.disabled = true
    writeButton.textContent = "Writing…"
    try {
      await committer.applyAll()
    } finally {
      sending = false
      writeButton.textContent = "Apply to code"
      render()
    }
  }

  /**
   * Everything the editor cannot write, handed over in one brief.
   *
   * It sends the WHOLE outbox, not just the agent group, and that is not a
   * mistake. A brief listing only the unwritable half would have the agent
   * reasoning about a file it cannot see the rest of the session in — and
   * `buildAnnotationBrief` already files the written rows under "already
   * written to source — do not apply these again", which is exactly the context
   * that stops it redoing finished work. The GROUPING is a fact about who acts
   * on a row; the BRIEF is a fact about what happened, and those are different
   * documents.
   */
  async function sendNow(): Promise<void> {
    if (sending) return
    const items = outboxItems()
    if (!items.length) {
      editor.toast("Nothing to send")
      return
    }

    sending = true
    sendButton.disabled = true
    setSendLabel("Sending…")
    try {
      const response = await requestAgent(editor.apiBase, {
        // The outbox IS the request; this line is the subject, not the ask.
        // Phrasing it as an instruction ("please change…") would have the agent
        // re-derive intent it has already been handed in `brief`.
        prompt: `${outboxSummary(items)} from DesignLayer`,
        brief: buildAnnotationBrief(items),
        origin: "prompts",
        files: filesInOutbox(items),
        selection: null,
        ancestry: [],
        url: window.location.href,
      })
      // The server's own words, whatever they are. A manufactured "Sent!" over
      // a route that answered with a refusal is the one thing this button must
      // never do: the list is still full and the designer would not know.
      editor.toast(response.message, response.ok ? "info" : "error")
      if (response.ok) clearIfAsked()
    } finally {
      sending = false
      setSendLabel("Send to agent")
      render()
    }
  }

  /**
   * Empty the outbox, when the setting says a handover is the end of it.
   *
   * Called only once a copy has RESOLVED or a send has come back ok. Clearing
   * in the click task instead would throw the list away on a browser that then
   * refused the clipboard — the one failure this setting must not be able to
   * cause.
   */
  function clearIfAsked(): void {
    if (!annotationSettings().clearOnCopy) return
    clearAnnotations()
    clearEdits()
  }

  /* ---------- footer actions ---------- */

  /**
   * An icon button whose glyph IS its state, repainted only when it changes.
   *
   * Redrawing the `<svg>` on every render would cut a fresh drawing on every
   * store write — the reason the layers tree remembers its mark on the node
   * rather than rebuilding it — and this tab renders on three stores.
   *
   * The label names the OUTCOME rather than the state, which is the rule that
   * tree's row actions follow too: a button announcing "Hidden" leaves a screen
   * reader user to work out for themselves what pressing it would do.
   */
  function setGlyph(button: HTMLElement, glyph: IconName, label: string): void {
    if (button.dataset.glyph !== glyph) {
      button.dataset.glyph = glyph
      button.replaceChildren(icon(glyph, tokens.icon.row))
    }
    button.setAttribute("aria-label", label)
    button.title = label
  }

  /**
   * Take the markers off the page, from where you are already standing.
   *
   * The same flag the settings row carries, deliberately twice. Settings is a
   * place you visit once a session; lifting the pins to look at the thing
   * underneath them is something you do several times an hour, and a control
   * for that cannot live behind a fold. Two surfaces onto one flag is only safe
   * because neither holds any state of its own — `syncSettings` paints both
   * from ONE read of `annotationSettings()`, so the only way for them to
   * disagree is to stop calling it.
   *
   * Eye and struck-eye are TWO DRAWINGS, not one glyph in a pressed state.
   * Hidden is a fact about the markers on the page rather than the pressed
   * state of this button, and the layers tree already draws that distinction
   * for a row the app has hidden — with the same open eye, which the glyph set
   * vends under both `Eye` and `EyeOpen`. No `aria-pressed` here for the same
   * reason: the label moves with the state, and a moving label over a pressed
   * state announces "Show markers, pressed", the opposite of what is true.
   */
  const visibility = el("button", {
    class: "de-mini",
    type: "button",
    // The function the canvas paints from, so the footer and the page cannot
    // hold different opinions about whether the markers are up.
    onclick: () => updateSettings({ hideUntilRestart: markersVisible() }),
  })

  /*
   * Delete every note, behind two clicks.
   *
   * The per-row delete needs no confirm and this one does, and the difference
   * is not squeamishness about the word: one row is one mistake and one marker
   * to re-drop, the whole list is a session's work and there is no undo
   * anywhere in this feature to get it back. So it arms, says what it would
   * cost, and stands itself down.
   *
   * It takes NOTES ONLY. The two halves of this list fail in different
   * directions: deleting a note destroys the only copy of something that was
   * never written down anywhere else, while dropping an edit does something
   * quieter and worse — the change stays live on the page, and in the file if
   * it was written, with nothing left in the editor that will ever mention it
   * to an agent. One button that did both would cause the second failure every
   * time somebody meant the first, which is why the label counts notes aloud
   * and says the edits stay.
   */
  let armed = 0
  let noteCount = 0

  const clearAll = el("button", {
    class: "de-mini de-mini--danger",
    type: "button",
    onclick: () => {
      // `disabled` stops a pointer, not a dispatched event, and nothing should
      // be able to arm a control standing over an empty list.
      if (!noteCount) return
      if (armed !== 0) {
        const going = noteCount
        disarm()
        clearAnnotations()
        editor.toast(`Deleted ${noteWord(going)}`)
        return
      }
      armed = window.setTimeout(disarm, CLEAR.armedMs)
      // Painted here rather than through `render()`: arming changes nothing in
      // any store, and a repaint of the whole list to move one glyph would
      // throw away the rows the reader is looking at mid-decision.
      paintClear()
      // The words live in the toast because the control is a glyph: a trash can
      // that has become a tick has asked "again?" and said nothing at all about
      // what is at stake.
      //
      // The DEFAULT rung, not `error`, and the difference became load-bearing
      // when `DURATION.error` went to `Infinity`. An error card stays until it
      // is dismissed, which is right for "the write failed" and wrong for this:
      // the arming window is `CLEAR.armedMs`, six seconds, after which
      // `disarm()` turns the tick back into a bin. A card that outlives the
      // window goes on saying "press again" about a control that has already
      // stood down — so pressing again re-arms rather than clearing, which is
      // the opposite of what the card promised. `info` is 4000ms, inside the
      // window, so the prompt and the state it describes end together.
      editor.toast(`${CLEAR.prompt(noteCount)}. This cannot be undone.`)
    },
  })

  function disarm(): void {
    if (armed === 0) return
    window.clearTimeout(armed)
    armed = 0
    paintClear()
  }

  function paintClear(): void {
    clearAll.disabled = noteCount === 0
    // Armed changes the drawing as well as the fill. Colour alone is the one
    // channel nothing in this tab is allowed to carry a state on — and a danger
    // tint on a button that already goes danger on hover says nothing anyway.
    setGlyph(
      clearAll,
      armed === 0 ? "Trash" : "Check",
      armed === 0 ? CLEAR.label(noteCount) : CLEAR.prompt(noteCount)
    )
    clearAll.classList.toggle("de-ann-clear--armed", armed !== 0)
  }

  /* ---------- the format strip ---------- */

  /*
   * ONE CONTROL, NOT FOUR — the levels moved into a menu.
   *
   * This was a segmented strip of four: Compact, Standard, Detailed, Forensic,
   * laid side by side above the list. Four words is about 210px of a 260px
   * panel, so the strip was a horizontal scroller in its own right — the fourth
   * segment sat half off the edge at the panel's default width and fully off it
   * once the seam was dragged in. A control you have to scroll to see the
   * options of is a menu wearing a strip's clothes.
   *
   * So it is a menu now: the group's name on the left, the chosen level and a
   * chevron on the right. That is the same shape every other one-of-several
   * setting in the inspector uses — `selectField` draws the font weight, the
   * stroke style and the effect type — and it costs one line instead of two.
   *
   * WHAT THE STRIP WAS DOING FOR FREE, and who does it now. The radiogroup
   * carried roving tabindex and arrow-key navigation, hand-written here across
   * about forty lines: `FORMAT_STEPS`, `onFormatKey`, a focus call after each
   * write. A native `<select>` is one tab stop with arrow keys, Home, End and
   * type-ahead supplied by the platform, in every locale, so all of that is
   * deleted rather than ported. The per-level hint that lived in each segment's
   * `title` moves onto the option itself.
   */
  const formatSelect = selectField({
    id: "annotations.detail",
    label: "Output detail",
    value: annotationSettings().outputDetail,
    options: OUTPUT_DETAILS.map((level) => ({ value: level.id, label: level.label })),
    onCommit: (value: string) => updateSettings({ outputDetail: value as OutputDetail }),
  })
  const formatControl = formatSelect.querySelector("select") as HTMLSelectElement
  /*
   * The hint per option, which the strip carried in each segment's `title`.
   * `<option>` is the one element whose `title` the platform menu actually
   * shows, so this is the one place the native control is the better host.
   */
  for (const [index, level] of OUTPUT_DETAILS.entries()) {
    formatControl.options[index]?.setAttribute("title", level.hint)
  }

  const formats = el("div", { class: "de-ann-detail" }, [
    el("span", { class: "de-ann-detail-label" }, ["Detail"]),
    formatSelect,
  ])

  /* ---------- settings ---------- */

  /*
   * Built once and only re-read, never rebuilt inside `render()`: every control
   * below writes through `updateSettings`, which announces, which re-renders
   * this tab. A settings block rebuilt on render would destroy the control the
   * user had just used — focus back on the document, and a keyboard user who
   * toggled a checkbox with Space with nothing to Tab on from. The fold is user
   * state for the same reason: a panel that re-collapsed itself every time a
   * marker was dropped is a panel nobody finishes reading.
   */
  /*
   * No `settingsOpen` flag and no fold button here any more: `section()` owns
   * both, and it keeps the open state in the panel-level map every other
   * section uses — which is what makes the fold survive the rebuild this tab
   * does on every store write.
   */
  const settingsBody = el("div", { class: "de-ann-settings-body", id: "de-ann-settings-body" })
  /**
   * The explanation, moved off the row and onto a dot beside the label.
   *
   * Every setting used to carry its hint as a two-to-three line paragraph
   * underneath it. Six of those turned a 260px panel into an essay and pushed
   * the marker color row below the fold on a 900px screen — the setting most
   * likely to be wrong on any given project was the one you had to scroll a
   * wall of prose to reach. Moving them in here made a row one line again —
   * and then it made the length of a hint invisible, which is how three of them
   * grew a second sentence defending the default. ONE SENTENCE each, and it has
   * to say something the label does not: a hint that restates its own label is
   * a dot the reader learns to stop pressing.
   *
   * `title` is the sighted affordance and is mouse-only, so the same sentence
   * is repeated in `aria-description`: without it, a keyboard user tabbing
   * through hits a dot that announces nothing but its own existence, which is
   * the worst of both — a stop on the tab order that carries no information.
   * `aria-description` rather than a visually hidden `aria-describedby` span
   * because the stylesheet has no hidden-text class to lend, and faking one
   * inline would be the only inline style in this file that is not a swatch's
   * own color.
   *
   * `InfoMark` and not `Info`: the dot IS the circle. `Info` is a ring with an
   * `i` in it, and drawn at 12px inside this 14px disc the two circles sat
   * 1.4px apart and the `i` between them came to a 1.25px stroke over 2px of
   * stem — which is what the dot was reported for, a ring with a smudge in it.
   * `InfoMark` is the same glyph with Lucide's ring dropped and the `i` scaled
   * to fill the disc that was already drawing one.
   */
  function helpDot(setting: string, hint: string): HTMLButtonElement {
    return el(
      "button",
      {
        class: "de-ann-help",
        type: "button",
        title: hint,
        "aria-label": `Help: ${setting}`,
        "aria-description": hint,
      },
      [icon("InfoMark", tokens.icon.row)]
    )
  }

  /** Name and dot as ONE flex child, so a control can sit opposite the pair. */
  function labelWith(text: Node | string, help: HTMLElement): HTMLElement {
    return el("span", { class: "de-ann-setting-label" }, [text, help])
  }

  /**
   * A switch. EVERY setting in this block is one now.
   *
   * There used to be two vocabularies here, and the split was defended at
   * length: a switch for a setting that changes the editor from now on, a
   * checkbox for a "one-shot preference" about some later handover. It was a
   * distinction the panel could state and the reader could not use. All five
   * rows persist, all five take effect the moment they are pressed, and none
   * of them is scoped to a single handover — "Clear on copy or send" is a
   * standing instruction about every copy, not a box you tick before one. What
   * the two drawings actually communicated was that some rows in one fold were
   * a different KIND of thing, which they are not.
   *
   * So: one control, on the right edge, for every row. The alignment is no
   * longer carrying a meaning, which means it can no longer carry a wrong one.
   *
   * The button carries no text: the row's label already names it, and a second
   * copy inside the control is one more thing to read for the same fact. That
   * is what `aria-label` is here to replace.
   *
   * `aria-checked` is the state itself rather than a mirror of some variable —
   * `syncSettings` writes it, the click handler reads it back, and the
   * stylesheet paints off it. One place to be wrong instead of three.
   */
  function switchControl(label: string, onCommit: (value: boolean) => void): HTMLButtonElement {
    const node = el("button", {
      class: "de-ann-toggle",
      type: "button",
      role: "switch",
      "aria-checked": "false",
      "aria-label": label,
    })
    node.addEventListener("click", () => onCommit(node.getAttribute("aria-checked") !== "true"))
    return node
  }

  /**
   * A whole row: the name, its dot, and the switch opposite them.
   *
   * The three rows this builds were `<input type="checkbox">` with a `<label
   * for>`, and losing the native input costs one real thing — clicking the
   * WORDS no longer toggles the setting. That is the price of the row above
   * being a `role="switch"` too, and it is paid on purpose: `.de-ann-setting`
   * is not a `<label>` and cannot become one without putting a `<button>`
   * inside label content, which is invalid and makes a press on the help dot
   * silently flip the setting behind it. Every row in the block now has one
   * target, in the same place, doing the same thing.
   *
   * The returned switch is handed back rather than looked up again, because
   * `syncSettings` writes `aria-checked` on it on every render and a
   * `querySelector` per render over a block that never rebuilds is a lookup
   * for a node we are holding.
   */
  function switchRow(
    label: string,
    hint: string,
    onCommit: (value: boolean) => void
  ): { row: HTMLElement; toggle: HTMLButtonElement } {
    const toggle = switchControl(label, onCommit)
    const row = el("div", { class: "de-ann-setting" }, [
      labelWith(label, helpDot(label, hint)),
      toggle,
    ])
    return { row, toggle }
  }

  /*
   * A SWITCH IS LABELLED WITH WHAT IS TRUE WHEN IT IS ON.
   *
   * This was "Hide until reload", which inverts the contract of the control it
   * is on: a `role="switch"` reads out as "Hide until reload, on", and what
   * that state actually produces is markers you cannot see. The reader has to
   * negate the label in their head to know what the switch is doing, and the
   * negation is exactly the part people get wrong under time pressure.
   *
   * "Show markers" is the same setting stated forward, so ON means markers are
   * on the page — and it is already the product's own word for it: the eye
   * button in the strip above says "Show markers"/"Hide markers" off the same
   * flag. Two surfaces onto one setting now agree about which direction is
   * which.
   *
   * The FLAG does not move. `hideUntilRestart` is persisted, filtered on read,
   * and reasoned about in four files (`annotations/store.ts` most of all);
   * renaming it to chase the label would be a migration in exchange for
   * nothing. The inversion lives here, at the one seam where a word becomes a
   * boolean, and at the one read in `syncSettings`.
   *
   * "Reload", not "restart", survives in the hint for its original reason:
   * restart has three referents on a dev machine — the browser, the dev server,
   * the editor — and only one of them brings the markers back. A designer who
   * reads "restart" and bounces their dev server has spent a minute on
   * something Cmd+R does, with the setting looking broken meanwhile.
   */
  const hideMarkers = switchControl("Show markers", (value) =>
    updateSettings({ hideUntilRestart: !value })
  )
  const clearOnCopy = switchRow(
    "Clear on copy or send",
    // The label already says when. The hint owes the two facts it does not:
    // that the edits go too, and that a refused clipboard keeps the list.
    "Takes the edits as well, and only once the handover has gone through.",
    (value) => updateSettings({ clearOnCopy: value })
  )
  const blockInteractions = switchRow(
    "Block page interactions",
    "Turn it off to drive the app into the state worth annotating, then turn it back on.",
    (value) => updateSettings({ blockPageInteractions: value })
  )
  /*
   * "Annotate the editor itself" STOOD HERE, and the switch is gone.
   *
   * It was the one setting in the fold that took away the gesture you would
   * undo it with: once the editor is annotatable, a click on that row files a
   * note about the row, and the only way back out is a keyboard shortcut the
   * switch itself had to teach you. A control whose own hint has to name an
   * escape hatch is a control that can strand the person who pressed it, and
   * the surface it unlocked — notes filed against the editor's own panels — is
   * one this product's designers do not need in the middle of annotating an
   * app.
   *
   * `AnnotationSettings.scope` survives, because `annotations/canvas.ts` asks
   * it one question in three places and the answer is now always `"app"`. It
   * is reachable from the console and from the tests, and no longer from here.
   * `annotations/store.ts` forces it back to `"app"` on load for the reason
   * written there: with no row to flip, a persisted `"editor"` would be
   * permanent.
   */

  /*
   * CONNECTING AN AGENT, in the one place a designer will look for it.
   *
   * The setup has always been a single fact — one URL, pasted into a coding
   * agent's config — and it was nonetheless the hardest thing in the product to
   * do, because that URL was printed once, at startup, into a terminal most
   * designers never open. Miss it and there is no way back: the port is not
   * shown anywhere in the editor, and the browser cannot probe it (`mcp.mjs`
   * refuses a non-JSON content type on purpose, so that a page cannot reach the
   * tool surface). A designer who missed one line of console output had no
   * route to the feature at all.
   *
   * So: the address, a button that copies it, and a live answer to the only
   * question that follows — did it work. Three things, no configuration, no
   * vocabulary. Nothing here can be edited, because there is nothing here a
   * designer should have to choose: the port is fixed precisely so this string
   * stays the same across restarts and can be typed into a config file once.
   */
  const mcpAddress = el("code", { class: "de-mcp-url" }, ["checking…"])
  const mcpState = el("div", { class: "de-mcp-state" }, [""])

  /*
   * The SAME Copy, because it is the same panel.
   *
   * This button and the outbox's Copy are two pills reading "Copy" in one
   * 260px column, and they used to disagree about how big a copy mark is and
   * about how a copy announces itself — one at `control` answering in a toast,
   * one at `row` answering on itself. Nobody decided that; it is what happens
   * when a second instance of a control is written at a different time. The
   * mark and the confirmation are the control's, not the call site's.
   */
  const mcpMark = swapMark("Copy")
  let mcpCopiedTimer = 0

  function showMcpCopied(): void {
    mcpMark.show(true)
    if (mcpCopiedTimer) clearTimeout(mcpCopiedTimer)
    mcpCopiedTimer = setTimeout(() => {
      mcpCopiedTimer = 0
      mcpMark.show(false)
    }, COPIED_FOR) as unknown as number
  }

  function undoMcpCopied(): void {
    if (mcpCopiedTimer) clearTimeout(mcpCopiedTimer)
    mcpCopiedTimer = 0
    mcpMark.show(false)
  }

  const mcpCopy = el(
    "button",
    {
      class: "de-button",
      type: "button",
      title: "Copy the address for your coding agent",
      onclick: () => {
        const url = mcpAddress.textContent ?? ""
        if (!url.startsWith("http")) {
          editor.toast("No address to copy — the MCP server is not running", "error")
          return
        }
        // Synchronous inside the click task, before any await: the clipboard
        // only works under the transient activation the click carries, and the
        // browser revokes it the moment the handler yields. Same shape as Copy.
        try {
          void navigator.clipboard.writeText(url).catch(() => {
            undoMcpCopied()
            editor.toast("The browser refused the clipboard", "error")
          })
          showMcpCopied()
          editor.toast("Address copied — paste it into your agent’s MCP settings")
        } catch {
          undoMcpCopied()
          editor.toast("The browser refused the clipboard", "error")
        }
      },
    },
    [mcpMark.node, "Copy"]
  )

  /**
   * Ask the server where it is and whether anybody arrived.
   *
   * Polled rather than pushed, and slowly. The fact changes at human speed — an
   * agent is attached when somebody edits a config file and restarts a tool —
   * and the panel is usually not even on screen. A socket for this would be
   * more machinery than the question deserves.
   *
   * Three states, and the middle one is why `connected` and `waiting` are both
   * reported. An agent that is attached but busy is a WORKING setup; showing it
   * as disconnected the moment it went off to do the work it was just handed is
   * how a correct configuration comes to look broken.
   */
  async function refreshMcp(): Promise<void> {
    try {
      const response = await fetch(`${editor.apiBase}/mcp/status`)
      if (!response.ok) throw new Error("status")
      const status = (await response.json()) as {
        url: string | null
        listening: boolean
        agents: number
        waiting: number
      }
      mcpAddress.textContent = status.url ?? "not running"

      /*
       * THREE FACTS, AND THEY FAIL INDEPENDENTLY.
       *
       * This block read one flag and got it wrong. `endpointListening` is set
       * by the launcher when OUR OWN port binds, so it is true from the moment
       * the editor starts — and the panel, reading it as "connected", told
       * every designer their agent was attached before they had configured one.
       * The status was decorative: it said the same thing forever.
       *
       * So the order below is the order the setup can fail in. Is our port up
       * at all? Then has anything completed a handshake? Then is it parked
       * waiting, or off doing the work it was handed? Each sentence is only
       * reachable when the one before it is true, which is what makes the line
       * worth reading rather than worth ignoring.
       */
      if (!status.url || !status.listening) {
        mcpState.textContent =
          "Not running, so no agent can connect. Another editor may hold the port."
        mcpState.dataset.deState = "off"
      } else if (status.agents < 1) {
        mcpState.textContent = "No agent connected yet. Paste this address into your agent."
        mcpState.dataset.deState = "idle"
      } else if (status.waiting > 0) {
        mcpState.textContent = "Connected, and waiting for your changes."
        mcpState.dataset.deState = "on"
      } else {
        // Attached but not parked in `wait_for_change`. A working setup, mid-turn
        // — and it must not read as a broken one, or a correct configuration
        // looks like a failure every time the agent goes off to do its job.
        mcpState.textContent = "Connected. Busy right now, which is normal."
        mcpState.dataset.deState = "on"
      }
    } catch {
      // A dead route reads the same as a refusal, the bargain `ai/transport.ts`
      // makes too: say nothing confident rather than invent a state.
      mcpState.textContent = "Could not reach the editor’s own server."
      mcpState.dataset.deState = "off"
    }
  }

  settingsBody.append(
    /*
     * FIRST, above everything about markers.
     *
     * The order of this fold is "what stops you working" before "what you might
     * prefer". Marker colour is a preference; not having an agent attached
     * means half of this tab — the whole agent group and the button under it —
     * quietly does nothing when pressed. That belongs at the top.
     */
    el("div", { class: "de-ann-setting-group de-mcp" }, [
      el("div", { class: "de-ann-setting de-ann-setting--stacked" }, [
        /*
       * "MCP", not "Your coding agent".
       *
       * The friendlier phrasing described the PERSON'S tool rather than the
       * thing on this row, and that mattered the moment something went wrong:
       * a designer told "your coding agent" is not working goes and restarts
       * their agent, when what is actually down is this editor's MCP server.
       * The field names what it is, and the help text says what to do with it —
       * which is the split that lets a designer describe the problem to
       * somebody else accurately.
       */
        labelWith(
          "MCP",
          helpDot(
            "MCP",
            "The address your coding agent connects to. Paste it into your agent’s MCP settings — it does not change between restarts."
          )
        ),
        el("div", { class: "de-mcp-row" }, [mcpAddress, mcpCopy]),
        mcpState,
      ]),
    ]),
    /*
     * Group two is everything else, and it is ONE group now.
     *
     * There were three: Show markers on its own, Marker colour on its own, and
     * the three checkboxes under a rule. The rules between them were drawing a
     * distinction the controls used to make — switch versus checkbox, right
     * edge versus left — and the controls stopped making it. Four rows that
     * look the same and behave the same, separated by two hairlines, would be
     * the block claiming three kinds of setting and showing one.
     *
     * The rule above this group stays, because MCP genuinely is another kind:
     * it is an address and a status, not a setting anybody sets.
     *
     * Settings that used to live here and are gone, for the record. Output
     * detail moved to the strip above the list, where the thing it governs is.
     * The component-stack switch was deleted outright — the editor detects
     * React or Angular itself and reads the stack either way, so the row only
     * ever offered a worse brief. Marker colour went because the shipped blue
     * is legible everywhere the pin lands and nobody came to this fold to
     * change it; see the note at the top of this file.
     */
    el("div", { class: "de-ann-setting-group" }, [
      el("div", { class: "de-ann-setting" }, [
        labelWith(
          "Show markers",
          // Stated forward to match the switch. The hint carries the half the
          // label cannot: that turning it off is scoped to this page load.
          helpDot("Show markers", "Turn this off to take every marker off the page until you reload.")
        ),
        hideMarkers,
      ]),
      clearOnCopy.row,
      blockInteractions.row,
    ])
  )

  const settings = el("div", { class: "de-ann-settings" }, [settingsBody])

  function syncSettings(): void {
    const current = annotationSettings()
    // Both surfaces onto `hideUntilRestart`, off ONE read, in one place. Either
    // of them keeping its own copy is how a switch comes to say "off" over a
    // page with no markers on it.
    // Inverted at the read for the reason given where the switch is built: the
    // stored flag says "hidden" and the label says "shown", and this is the one
    // other place the two meet.
    hideMarkers.setAttribute("aria-checked", String(!current.hideUntilRestart))
    setGlyph(
      visibility,
      current.hideUntilRestart ? "EyeOff" : "Eye",
      // Verb and object, and no "on the page": a marker has nowhere else to be.
      // This button and the settings switch now share the phrase "Show markers"
      // on purpose — they are one setting, and the button names the action
      // while the switch names the state.
      current.hideUntilRestart ? "Show markers" : "Hide markers"
    )
    // `aria-checked` rather than `.checked`, for the same reason the switch
    // above reads it back on click: the attribute IS the state now, and the
    // stylesheet paints off it. Written as a string because that is what an
    // attribute holds — `String(false)` is "false", not the empty attribute a
    // boolean property would leave behind.
    clearOnCopy.toggle.setAttribute("aria-checked", String(current.clearOnCopy))
    blockInteractions.toggle.setAttribute("aria-checked", String(current.blockPageInteractions))

    /*
     * The chosen level, painted onto the menu rather than across four segments.
     *
     * The fallback is not defensive padding: a settings blob written by a build
     * that spelled the levels differently resolves to no match at all, and a
     * `<select>` handed a value none of its options carry goes BLANK — a
     * dropdown showing nothing, over a brief that is still being written at
     * some level. Falling back to the first option means the control always
     * names a real level, and the next write repairs the stored value.
     */
    const level = OUTPUT_DETAILS.some((entry) => entry.id === current.outputDetail)
      ? current.outputDetail
      : OUTPUT_DETAILS[0].id
    if (formatControl.value !== level) formatControl.value = level
  }

  /* ---------- the two sections ---------- */

  /*
   * What you can do with the list, directly under the list.
   *
   * Split by what the doing costs: the two glyphs on the left act on the outbox
   * in place, the two labelled buttons on the right hand it over, Send leading
   * because it is the action that finishes the job. The trash sits at the
   * opposite end from them — they are the two controls in this tab that end the
   * session's work, and the one that ends it irreversibly should not share an
   * edge with the one that finishes it properly.
   *
   * Four controls and not one more. At 260px this row has 244px and these
   * measure about 205 of it; a third labelled button does not fit, and the way
   * that failure arrives is a label folding onto a second line. Anything added
   * here has to be a glyph, or something else has to leave.
   */
  const ctas = el("div", { class: "de-ann-ctas" }, [
    el("span", { class: "de-ann-tools" }, [visibility, clearAll]),
    /*
     * The two WHOLE-SESSION actions, together.
     *
     * "Apply to code" lives up in the edits section because it acts on exactly
     * those rows. These two do not: both hand over the entire session — every
     * note and every edit, in one brief — so neither can sit under a heading
     * without claiming a narrower scope than it has. Send and Copy differ in
     * one thing, where the brief goes, which is why they are peers here rather
     * than one being the other's fallback.
     */
    el("span", { class: "de-ann-actions" }, [sendButton, copyButton]),
  ])

  /*
   * THREE SECTIONS IN ONE COLUMN: Direct edits, Notes, Settings.
   *
   * There were two, and the first was called "Handover" — a container holding
   * both halves of the session, each half drawn as a small heading with its own
   * tally inside it. That container was a level of structure nobody needed. It
   * carried one fold for two lists that are read on two different errands
   * ("what have I changed" is not "where is that note I left"), it printed the
   * word Handover over a tab already called Changes, and it made the real
   * headings — Direct edits, Notes — subordinate to a word that named no pile
   * at all.
   *
   * So each half is a section in its own right, on the panel's own header: the
   * title on the left column, the reserved actions track, the chevron, and a
   * fold that now hides exactly the list it belongs to. A session of thirty
   * edits can be folded away without also folding the two notes beside it.
   *
   * NO TALLIES ANYWHERE. The section header used to carry "1 note and 1 edit"
   * and each group head carried its own "1" under it, so a session with one of
   * each stated the same arithmetic three times over a list short enough to
   * count by looking. A number earns its place when the thing it counts is off
   * screen; these are never off screen, because the rows are the section.
   *
   * ORDER IS THE SESSION. Edits first — they are the half that can be written
   * without anybody's help, and the button that writes them sits under them.
   * Notes second, holding the detail control, because the level of detail is
   * about what gets SAID rather than what gets written. Settings last, because
   * it is the only block here nobody is ever mid-thought about.
   */
  const editsSection = section(
    "Direct edits",
    el("div", { class: "de-ann-section-body" }, [
      el("div", { class: "de-ann-brief" }, [
        "Changes you made on the canvas. Each row says whether it can be written.",
      ]),
      editList,
      // The button spans the rows it acts on, so its scope is its width and its
      // position. A CTA at the bottom of the tab would act on "everything
      // above", which is a scope the reader has to reconstruct by scrolling.
      el("div", { class: "de-ann-cta" }, [writeButton]),
    ])
  )

  /*
   * THE DETAIL MENU LIVES HERE NOW, not above the whole tab.
   *
   * It governs how much the brief says, and the brief is the notes' route out —
   * the edits leave through the button one section up, which does not consult
   * it at all. Sitting above both lists it looked like a setting for the tab;
   * sitting over the notes it is a setting for the thing it actually changes.
   *
   * There is still exactly ONE of it. Two surfaces onto one setting is how a
   * panel comes to disagree with itself, which is why this is a move and not a
   * copy, and why Settings does not grow a second one.
   */
  const notesSection = section(
    "Notes",
    el("div", { class: "de-ann-section-body" }, [
      el("div", { class: "de-ann-brief" }, [
        "Pinned to the page. Your agent gets these, with the edits for context.",
      ]),
      formats,
      noteList,
    ])
  )

  /*
   * The empty state is the TAB's, not a section's.
   *
   * A session that has not started has nothing to head: two headers over two
   * empty bodies would be the panel filing nothing under two names. Both
   * sections leave the document, this says what would ever be here, and the
   * first note or edit brings the structure back with it.
   */
  const empty = emptyState()

  /*
   * Settings is the one block that is ALWAYS in the column, which makes it the
   * anchor everything above it is inserted before. Held in a variable for that
   * reason rather than for tidiness: `place` needs a connected sibling, and
   * `node.lastChild` would be whatever the last render happened to leave.
   */
  const settingsSection = section("Settings", settings, undefined, true)

  const node = el("div", { class: "de-ann" }, [
    empty,
    editsSection,
    notesSection,
    /*
     * The whole-session buttons sit OUTSIDE both sections, which is the one
     * thing that moved without being asked for and is worth saying why.
     *
     * Send and Copy hand over everything — every note and every edit, in one
     * brief — so neither can live under a heading without claiming a narrower
     * scope than it has, and neither may be foldable away: a button that
     * finishes the session must not be hidden by tidying the list above it.
     * Inside the old Handover section they were bracketed by position; out here
     * they are bracketed by being last.
     */
    ctas,
    settingsSection,
  ])

  /**
   * A row lights its pin, and a pin lights its row, through one pair of calls.
   *
   * The class and the event are set together and never apart. Leaving the row's
   * own highlight to CSS `:hover` would be a second, independent answer to "is
   * the pointer on this row" — and the day the event fails to send, the panel
   * would still light up and the page would not, which reads as the marker
   * being broken rather than the seam.
   *
   * Focus drives the same pair as the pointer, for the reason the trailing
   * actions are revealed on `:focus-within`: a keyboard user arriving at a row
   * is standing on it just as much as a pointer is, and a highlight they can
   * never trigger is a feature that does not exist for them.
   */
  function trackHover(row: HTMLElement, id: string): HTMLElement {
    row.setAttribute(ITEM_ID, id)
    const enter = (): void => {
      row.classList.add("de-ann-item--hover")
      announceHover(id)
    }
    const leave = (): void => {
      row.classList.remove("de-ann-item--hover")
      announceHover(null)
    }
    row.addEventListener("mouseenter", enter)
    row.addEventListener("mouseleave", leave)
    row.addEventListener("focusin", enter)
    row.addEventListener("focusout", (event) => {
      // `focusout` fires on every hop between this row's own buttons. Tabbing
      // from edit to delete would otherwise report the row left and re-entered,
      // and the pin would blink once per key.
      if (row.contains((event as FocusEvent).relatedTarget as Node | null)) return
      leave()
    })
    return row
  }

  /**
   * One note, as a row you can act on without acting on the rest.
   *
   * TWO ACTIONS, WHERE THERE WERE THREE. The tick is gone.
   *
   * Resolving was a toggle beside a delete, and the pair was defended on the
   * grounds that they are different — resolve keeps the note in the session's
   * history, delete takes the only copy with it. That distinction is real in
   * the data and turned out not to be real to the person using the panel: both
   * controls take a dealt-with note off the list, they sit 2px apart under
   * near-identical 18px buttons, and the difference only exists if you go
   * looking for a resolved note later, which this panel gives you no way to do.
   * One of the two was therefore a 33% wider action column and a coin toss.
   *
   * The status field went with it. For a while it survived as read-only
   * machinery — set by nothing, still filtered on in four places — and that is
   * a worse state than either having the feature or not: a reader cannot tell
   * from the code that "resolved" is unreachable. Deleting a note is now the
   * only way to take it off this list, which is what the tick's removal always
   * meant.
   */
  function noteRow(note: AnnotationRecord, index: number): HTMLElement {
    const subject = noteSubject(note)

    /*
     * A bin rather than a cross, which the edit row keeps.
     *
     * The two rows do different things under the same-shaped button: dropping
     * an edit retracts it from the handover and leaves the change standing,
     * deleting a note destroys the note. Giving the destructive one a different
     * drawing is the cheapest way to say that before the label is read — the
     * same bin the layers tree deletes with.
     *
     * No confirm, unlike the footer's clear-all: one row is one mistake, and a
     * control you use on most rows in a session cannot ask twice every time.
     * The recovery is an UNDO instead — see `erase` below.
     */
    const remove = el(
      "button",
      {
        class: "de-mini de-mini--danger",
        type: "button",
        "data-de-tip": DELETE_NOTE,
        "aria-label": DELETE_NOTE,
        /*
         * The row closes first, and the store is written once it has.
         *
         * Deleting a note is terminal, and until now the only sign it had
         * happened was that something the reader was looking at stopped
         * existing — the same appearance as a list that failed to draw. The
         * write is deferred rather than doubled up because `removeAnnotation`
         * rebuilds this whole list through its subscription; doing both at once
         * would race the rebuild against the row's own departure.
         */
        onclick: (event: Event) => {
          const row = (event.currentTarget as HTMLElement).closest(".de-ann-item")
          const closing = row instanceof HTMLElement ? leaveRow(row) : null
          // Synchronous where the row cannot close — see `leaveRow`. A delete
          // does not become async because a panel happens to be paintable.
          if (closing) void closing.then(erase)
          else erase()
        },
      },
      [icon("Trash", tokens.icon.row)]
    )

    /*
     * THE DELETE, AND THE WAY BACK FROM IT.
     *
     * This was the last irreversible single click in the editor. Everything
     * else destructive is recoverable — an element delete and a style change go
     * through `core/history.ts`, a revert restores what it reverted, clear-all
     * arms first and says what it will cost — and this one act was not, over
     * the one thing on screen the user wrote themselves. A note is not in a
     * source file to be recovered from; deleting it is the whole of its ending.
     *
     * The row keeps its single click, because the argument above is right: a
     * control used on most rows in a session cannot ask twice. Confirm and undo
     * are alternatives, and undo is the cheaper one for the reader — the common
     * case, where the press was meant, costs nothing at all.
     *
     * The card names WHICH note, not "note deleted". By the time it appears the
     * row is gone, so the sentence is the only thing left saying what was lost,
     * and with four notes on a page "deleted" is a statement the reader cannot
     * check. `noteSubject` is the same phrase the row itself used.
     *
     * Nothing is raised if the store had already dropped it — a second press
     * arriving during the row's own departure, or a clear-all landing first.
     * Offering to undo something that did not happen is worse than silence.
     */
    function erase(): void {
      const removed = removeAnnotation(note.id)
      if (!removed) return
      editor.toast(`Deleted the note on ${noteSubject(removed.note)}`, "info", {
        label: "Undo",
        onClick: () => restoreAnnotation(removed.note, removed.index),
      })
    }

    /*
     * Rewriting a note happens where the note is, not in the row.
     *
     * The composer already exists on the canvas, anchored to the thing the note
     * is about — so this asks for it back rather than growing a second editor
     * in a 260px panel that could not show the reader what they were writing
     * about. `EDIT_EVENT` is the whole of how it asks: the panel names the
     * note, the canvas decides what reopening looks like.
     *
     * A PENCIL, where this drew the text mark. `Type` was chosen because the
     * set had no pencil and it was the closest thing to "the words" available —
     * but a `T` is what every other toolbar puts on "insert text" or "text
     * style", so the button read as a formatting control for the note rather
     * than as a way back into writing it. The set has a pencil now.
     */
    const edit = el(
      "button",
      {
        class: "de-mini",
        type: "button",
        "data-de-tip": EDIT_NOTE,
        "aria-label": EDIT_NOTE,
        onclick: () =>
          window.dispatchEvent(new CustomEvent(EDIT_EVENT, { detail: { id: note.id } })),
      },
      [icon("Pencil", tokens.icon.row)]
    )
    return trackHover(
      el("div", { class: "de-ann-item de-ann-item--note" }, [
        /*
         * No "Note" chip. The row is in a list called Handover, it carries a
         * numbered disc matching a pin on the canvas, and its first line is a
         * sentence somebody typed — three things already saying what it is. The
         * chip restated the obvious in a 260px column that has none to spare.
         * A note row now carries no badge at all. It had one state to report
         * and that state is gone; an edit row still badges, because which of
         * three things is true of an edit is the fact its row exists to tell.
         */
        el("div", { class: "de-ann-item-head" }, [
          el("span", { class: "de-ann-index" }, [String(index)]),
        ]),
        /*
         * ONE LINE: what the designer wrote, and nothing under it.
         *
         * The second line was the filing note — "OverviewComponent ·
         * overview.html:24", or the quoted run of text for a text note. It is
         * the tool's own bookkeeping, and it was printed on every row of a
         * 260px column, so half the ink in the list went to strings the reader
         * did not write and cannot act on. The pin on the canvas already says
         * where a note is; the number on the row ties the two together.
         *
         * It is not deleted, it is demoted to the row's tooltip, which is where
         * the rest of this panel keeps a long form of a short line. The brief
         * still carries the selector, the component and the file — that is the
         * copy an agent reads, and it was never this line.
         */
        el("div", { class: "de-ann-item-body" }, [
          el("div", { class: "de-ann-item-line", title: `${note.comment}\n${subject}` }, [
            note.comment,
          ]),
        ]),
        el("div", { class: "de-ann-item-actions" }, [edit, remove]),
      ]),
      note.id
    )
  }

  /**
   * THREE STATES, WHERE THERE USED TO BE TWO.
   *
   * "Preview only" covered two completely different situations and a designer
   * had no way to tell them apart: a change that WILL be written the moment
   * they press the button, and a change that never can be because the writer
   * has no way to spell it. Both said "live in this page only", both looked
   * like the same problem, and only one of them was one.
   *
   * The split is the ledger. `change-prompt.ts` holds exactly the changes Apply
   * cannot write — an icon swap, a drag's `transform`, a class list whose file
   * never resolved — so an unwritten edit that appears there needs a person or
   * an agent, and an unwritten edit that does not is simply queued.
   *
   * Matched on the same `(tagName, className, property)` triple that
   * `markEditRefused` uses to demote a row when the server refuses a write. One
   * identity for "these two records are about the same edit", used in both
   * directions, is what keeps the badge and the refusal path from disagreeing.
   */
  function stateOf(edit: EditRecord): { label: string; title: string; kind: string } {
    // Asked FIRST, because a queued edit is also a written one: the writer sets
    // `written` the moment it knows it can spell the change, and only the
    // commit clears `queued`. Reading them the other way round is what had
    // every fresh padding tweak claiming to be in a file already.
    if (isEditQueued(edit.id)) {
      return {
        label: "Ready",
        title: "Queued. Apply writes this straight into the file.",
        kind: "ready",
      }
    }
    if (edit.written) {
      return {
        label: "In your files",
        title: "Already written to the file, so applying it again would be a conflict.",
        kind: "written",
      }
    }
    const unwritable = previewOnlyChanges().some(
      (change: PreviewOnlyChange) =>
        change.property === edit.property &&
        change.tagName === (edit.target?.tagName ?? "") &&
        change.className === (edit.target?.className ?? "")
    )
    // Not queued and not written. Either the ledger already knows why (an icon
    // swap, a `transform`, a file that never resolved), or a commit refused it
    // and `markEditRefused` took the claim back. Both are the agent’s.
    return unwritable
      ? {
          label: "Needs the agent",
          title:
            "Apply cannot write this one — it goes to your coding agent instead, with the rest of the list.",
          kind: "agent",
        }
      : {
          label: "Needs the agent",
          title: "Apply could not write this one — your coding agent gets it with the rest.",
          kind: "agent",
        }
  }

  /**
   * One edit the designer made, and what still has to happen to it.
   *
   * State is stated three ways on purpose — a class the stylesheet can tint, a
   * badge with words in it, and the sentence behind that badge — because it is
   * the fact that decides what happens to the row next, and a tint alone is a
   * fact nobody can read out loud.
   */
  function editRow(edit: EditRecord, index: number): HTMLElement {
    const label = editLabel(edit.property)
    // The empty side is spelled rather than dropped: a blank where a value goes
    // reads as a rendering bug, and "unset" is the actual claim.
    const change = `${label}: ${edit.from || "unset"} → ${edit.to || "unset"}`
    const where = whereOf(edit.target)
    const state = stateOf(edit)
    // Asked for every edit row; answered for the few whose component the server
    // finds in more than one place. The first call per component starts a
    // lookup and returns nothing, and the subscription below repaints when it
    // lands — a render cannot wait on a project walk.
    const shared = sharedComponentWarning(edit.target?.componentName ?? "")

    const remove = el(
      "button",
      {
        class: "de-mini de-mini--danger",
        type: "button",
        "data-de-tip": DROP_EDIT,
        "aria-label": DROP_EDIT,
        /*
         * ANY ROW, IN ANY ORDER — and this is why that is safe.
         *
         * Undo is a timeline and has to be walked backwards, because steps
         * compose. This is not undo. A row is one (element, property), and the
         * journal collapses every repeat of that pair onto the same row, so no
         * two rows can describe the same property of the same element. Rows are
         * independent by construction and the third of seven can go without
         * disturbing the other six.
         *
         * The same rule is what lets the preview revert: restoring this row's
         * "from" would be reckless if a later row could have written the same
         * property afterwards, and collapse guarantees none did.
         */
        onclick: () => {
          const result = withdrawEdit(editor.bridge, edit.id)
          /*
           * Only spoken about when it FAILED, which is the one case the list
           * cannot show on its own.
           *
           * A successful withdrawal explains itself: the row disappears and the
           * pixels go back. A withdrawal that could not reach the queue leaves
           * a page that reverted and a file that will still be written, and
           * nothing on screen says so — that is worth a sentence, and it is the
           * honest one rather than a generic failure.
           */
          if (!result.queueCleared && isEditQueued(edit.id)) {
            editor.toast(
              "Row removed, but the queued write could not be taken back — apply with care",
              "error"
            )
          }
        },
      },
      [icon("X", tokens.icon.row)]
    )

    /*
     * Delete alone, and the missing edit button is not an oversight.
     *
     * A note row's edit reopens the composer the note was written in. An edit
     * row has no composer — it is a record of something the inspector already
     * did to the page, and the way to change it is to change the element again,
     * which writes a new row. A button that opened nothing would be the panel
     * offering a door into a room that was never built.
     */
    return trackHover(
      el(
        "div",
        { class: `de-ann-item de-ann-item--edit${edit.written ? " de-ann-item--written" : ""}` },
        [
          /*
           * Same cut as the note row above: the "Edit" chip said what the mono
           * `opacity: 1 → 0.55` beneath it already said. The state chip stays,
           * because whether a change reached the file is the one fact on this
           * row an agent acts on differently and nothing else here reports it.
           */
          el("div", { class: "de-ann-item-head" }, [
            el("span", { class: "de-ann-index" }, [String(index)]),
            el("span", { class: "de-ann-badge", "data-de-state": state.kind, title: state.title }, [
              state.label,
            ]),
          ]),
          el("div", { class: "de-ann-item-body" }, [
            /*
             * The element this changed rides in the TOOLTIP, for the reason the
             * note row's second line went: one row, one line. The difference
             * here is that an edit's line is a property and two values, which
             * does not name the thing it happened to — so the tooltip is doing
             * real work rather than storing a duplicate, and the badge below
             * stays because it reports the one fact that decides what happens
             * to this row next.
             */
            el("div", { class: "de-ann-item-line", title: `${change}\n${where}` }, [change]),
            /*
             * THE BLAST RADIUS, said before the write rather than discovered
             * after it.
             *
             * Only for a component the server found in more than one place, so
             * the ordinary row stays silent — a caution on every row is
             * wallpaper, and wallpaper does not get read. This is the one fact
             * about an edit that the preview cannot show: the page in front of
             * the designer looks identical whether this button is used once or
             * forty times.
             *
             * It is a line in the row and not a dialog. The write has not
             * happened yet — the button that performs it is at the bottom of
             * this very group — so there is nothing to interrupt, only
             * something to know before pressing it.
             */
            shared ? el("div", { class: "de-ann-item-shared" }, [shared]) : null,
          ]),
          el("div", { class: "de-ann-item-actions" }, [remove]),
        ]
      ),
      // An edit has no pin, so this id matches no marker and the canvas lights
      // nothing. Sent anyway, because the alternative is a row that stays
      // silent on enter — which would leave the LAST note's pin lit while the
      // pointer sits two rows further down.
      edit.id
    )
  }

  function emptyState(): HTMLElement {
    return el("div", { class: "de-empty de-ann-empty" }, [
      el("span", { "aria-hidden": "true" }, [icon("MessageSquare", tokens.icon.display)]),
      el("div", {}, [EMPTY_DETAIL]),
    ])
  }


  /**
   * "No notes yet", for a session that has edits and nothing written about
   * them.
   *
   * Not the tab's empty state, which opens on "Nothing to hand over yet" — that
   * sentence is false over a list of edits one section up. One quiet line
   * instead, because the section is still here for a reason: it holds the
   * detail menu, and a heading with a menu under it and no other explanation
   * reads as a section that failed to load its rows.
   */
  function noNotesYet(): HTMLElement {
    return el("div", { class: "de-ann-none" }, ["No notes yet. Pin one on the page."])
  }

  function render(): void {
    /*
     * The outbox repaints on four stores, and two of them fire while the reader
     * is looking at a row halfway down it — a note deleted from its own row, an
     * edit landing from a scrub on the canvas. Both lists are emptied and
     * refilled below, and an emptied scroller is clamped to the top by the next
     * layout, so without this the list jumps to the top under the hand that was
     * working in it. `core/scroll.ts` carries the mechanism.
     *
     * Unconditional, unlike the Design tab's version of this: nothing in here
     * is a view of one element, so there is no change of subject that would
     * justify starting again from the top.
     */
    const hold = holdScroll(node)
    clear(editList)
    clear(noteList)
    const items = outboxItems()
    const filled = items.length > 0

    copyButton.disabled = !filled

    /*
     * Each verb is armed by its OWN group, not by the list.
     *
     * Write is armed by the queues rather than by the rows above it, because
     * those are different facts: a drag leaves a queued removal with no visible
     * row, and a row that has already been written leaves a row with nothing
     * queued. The queues are what the button acts on, so the queues decide
     * whether it is live.
     *
     * Send is armed by the outbox, because the brief is built from the outbox.
     *
     * Both stay disabled mid-flight, so a second click cannot post or write the
     * same work twice while the first round trip is outstanding.
     */
    writeButton.disabled = !committer.hasPendingChanges() || sending
    sendButton.disabled = !filled || sending

    // Notes only, because clear-all is notes only. A list of edits and no notes
    // has nothing for that button to take, and offering it anyway would be the
    // panel promising something the click does not do.
    noteCount = items.reduce((total, item) => total + (item.type === "note" ? 1 : 0), 0)
    // An armed bin over a list that has just emptied — the last note deleted
    // from its own row while the confirm was still up — would sit there waiting
    // to delete nothing. The arm goes with the notes it was counting.
    if (!noteCount) disarm()
    paintClear()

    syncSettings()
    refreshMcpSoon()

    /*
     * TWO KINDS, AND EACH COUNTS FROM ONE.
     *
     * The split is what you DID, not what happens next: an edit is a thing you
     * changed on the canvas, a note is a thing you wrote about the page. Those
     * are the two activities a session is made of, and they are what a designer
     * is looking for when they open this tab — "where's that note I left" is a
     * different errand from "what have I changed".
     *
     * Numbering restarts per section, and that is the point of separating them.
     * A single run of numbers across both makes the sections cosmetic: the
     * third note being called 5 tells you only that two edits happened to be
     * made before it, which is a fact about the clock rather than about the
     * note. Per-section numbers mean "the third note" and "the third edit" are
     * things a person can say out loud and point at.
     *
     * What this costs, stated because it is a real trade: the numbers no longer
     * match a single position in the brief, which is one document in one
     * chronological order. That was the argument for merged numbering and it
     * loses to this one — the brief is read by an agent, which locates a change
     * by its selector and its file, and the numbers in it were never what it
     * used. The panel is read by a person, and the numbers are all they have.
     */
    const editRows: HTMLElement[] = []
    const noteRows: HTMLElement[] = []
    for (const item of items) {
      if (item.type === "note") noteRows.push(noteRow(item.note, noteRows.length + 1))
      else editRows.push(editRow(item.edit, editRows.length + 1))
    }

    editList.append(...editRows)
    noteList.append(...(noteRows.length ? noteRows : [noNotesYet()]))

    /*
     * WHICH SECTIONS ARE ON SCREEN, and the two rules are not symmetrical.
     *
     * Edits appear when there are edit rows OR a write is still owed. The
     * second half is not tidiness: a deletion queues a source operation without
     * leaving a visible row until resolution lands, so a designer who deleted a
     * card and saw no section and no button would reasonably conclude the
     * delete had not registered.
     *
     * Notes appear whenever the session holds ANYTHING, even when no note has
     * been written. The section carries the detail menu, and that menu governs
     * the brief that hands the edits over too — hiding it because nobody has
     * pinned a note yet would take a live control off the panel in the exact
     * session that still needs it.
     *
     * Both hide together over an empty session, and the tab's own empty state
     * takes the column instead of two headings over two blank bodies.
     */
    /*
     * A block that has nothing to say LEAVES THE DOCUMENT, rather than hiding.
     *
     * `hidden` would have been cheaper and is what the fold uses, but the two
     * situations are not the same. A folded section is still there and the
     * reader put it away; a section with no rows is not there at all, and
     * leaving it behind leaves a live "Apply to code" in the document over a
     * list with nothing to apply, and an empty state claiming "nothing to hand
     * over" above a section full of edits.
     *
     * Detached, not rebuilt. The nodes are the same objects across every
     * render — the detail menu, the write button and their listeners come back
     * exactly as they left — so this costs an insert, not the focus of whoever
     * was using them.
     */
    /*
     * THE BUTTONS LEAVE TOO, and they are placed FIRST so the rest can aim at
     * them.
     *
     * They used to sit in the column unconditionally, which put a row of four
     * controls directly under "Nothing to hand over yet" — Send and Copy
     * disabled, the eye toggling the visibility of no markers, the bin armed
     * to clear an empty list. Four controls over an empty state is the panel
     * offering you its ending before you have started, and the one thing a
     * first-time reader should be looking at there is the sentence saying what
     * this tab is for.
     *
     * Same condition as Notes, not a narrower one: an edit made on the canvas
     * with no note written is still a session worth handing over, and Copy and
     * Send both carry it. The buttons come back with the first thing the
     * session holds, whichever kind it is.
     *
     * Bottom-up, because each block goes in BEFORE a sibling and the sibling
     * has to be in the column already. Settings never leaves, so it anchors
     * the buttons; the buttons, or Settings when they are gone, anchor Notes;
     * and Notes, or whatever is under it, anchors Direct edits.
     */
    const owed = committer.hasPendingChanges()
    place(ctas, filled || owed, settingsSection)
    const belowNotes = inColumn(ctas) ? ctas : settingsSection
    place(notesSection, filled || owed, belowNotes)
    place(empty, !(filled || owed), node.firstChild)
    place(editsSection, editRows.length > 0 || owed, inColumn(notesSection) ? notesSection : belowNotes)
    // Last, after the sections have been placed: the release measures the
    // rebuilt column, and a section still detached at that point would make it
    // clamp against a height the panel is about to grow past.
    hold.release()
  }

  /**
   * Is this block in the column right now — asked of THIS parent, not of the
   * document.
   *
   * `isConnected` is the obvious call and it is the wrong question. It means
   * "reachable from a Document", so it is false for every block here whenever
   * the tab itself is off the document — which is most of the tab's life in
   * the test host, and any moment the inspector is holding a pane it has not
   * mounted. Every block then reported itself absent, `place` re-inserted one
   * that was already there, and an insert of a node that already has this
   * parent is a MOVE: the column quietly reordered itself, which is how the
   * buttons ended up above the Notes section they belong under.
   *
   * The question this file actually asks is about membership of one parent, so
   * that is what it asks.
   */
  function inColumn(block: HTMLElement): boolean {
    return block.parentNode === node
  }

  /** In the column at `before`, or out of it entirely. */
  function place(block: HTMLElement, wanted: boolean, before: Node | null): void {
    if (!wanted) {
      block.remove()
      return
    }
    if (!inColumn(block)) node.insertBefore(block, before)
  }

  /*
   * Three stores, one list. Nothing unsubscribes: the inspector builds its tabs
   * once and holds them for the life of the editor, so a disposer kept here
   * would be a function with no caller. Every mutation above therefore leaves
   * the repaint to the store — calling `render()` as well would draw twice for
   * one click.
   */
  onAnnotationsChange(render)
  onEditsChange(render)
  onSettingsChange(render)
  // A usage answer arriving is the only thing that can add a warning line to a
  // row that is already on screen; nothing else in the tab knows it happened.
  onComponentUsageChange(render)

  /*
   * The agent's arrival is the one thing on this tab nothing else can notice.
   *
   * Every other row here moves because the designer did something. An agent
   * attaching happens in another process, so the panel has to go and look.
   *
   * It looks on RENDER, throttled, and not on a timer. A timer was the obvious
   * build and it was wrong twice: it keeps a jsdom test process alive forever —
   * the suite hung for four hundred seconds before this was traced back here —
   * and in the product it polls a loopback route all day on behalf of a panel
   * nobody is looking at. Render already fires on everything that brings a
   * designer near this block, and the throttle keeps a number scrub from
   * turning into a request per frame.
   */
  const MCP_POLL_MS = 5_000
  let mcpCheckedAt = 0
  function refreshMcpSoon(): void {
    const now = Date.now()
    if (now - mcpCheckedAt < MCP_POLL_MS) return
    mcpCheckedAt = now
    void refreshMcp()
  }
  refreshMcpSoon()
  /*
   * The ledger is NOT subscribed to here, and the badge still tracks it.
   *
   * A stranded write moves a row from "Ready" to "Needs the agent" without the
   * journal changing at all, so this list does have to be rebuilt when the
   * ledger moves — but the tab host already does it, gated on this being the
   * visible tab (`onPreviewOnlyChange` in `./index.ts`). Subscribing again here
   * would repaint a pane nobody is looking at on every stranded write, which is
   * the hot-path cost the tab host exists to avoid, and `inspector-tabs-cases`
   * fails on exactly that.
   */

  /*
   * The other direction: the pointer is on a PIN, so light its row.
   *
   * Read off the DOM rather than kept in a variable, because the rows are
   * rebuilt on every store write and a held reference would point at a node
   * that left the panel three repaints ago. The class is cleared from every row
   * first, so a mirror event that names a note the list no longer holds — a
   * note deleted while the pointer sat on its pin — leaves nothing lit.
   *
   * Nothing is dispatched back. Answering the canvas with `HOVER_EVENT` would
   * be the two surfaces telling each other the same fact forever.
   */
  window.addEventListener(MARKER_HOVER_EVENT, (event) => {
    const id = (event as CustomEvent<{ id?: string | null }>).detail?.id ?? null
    // Swept from the tab rather than from one list: the rows live in two now,
    // and a pin belongs to whichever section its note is filed under.
    for (const row of node.querySelectorAll(".de-ann-item")) {
      row.classList.toggle("de-ann-item--hover", id !== null && row.getAttribute(ITEM_ID) === id)
    }
  })

  return { node, update: render }
}
