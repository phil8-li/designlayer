/**
 * The selected element's saved styles, in the right panel.
 *
 * ## One concept, not three
 *
 * "Option" used to cover three unrelated things, and this file showed two of
 * them: the app's own leva controls that happened to be BOUND to the selected
 * element, and the style snapshots saved against it. They are not peers. A
 * control edits the running app and its verbs take no selection at all; a saved
 * style is an `ElementOption` this editor owns outright, and every verb on
 * `optionsStore` — apply, save, update, remove, revert — takes a `Selection`.
 * So the two split by scope: the controls are a left-panel tab now
 * (`panels/controls.ts`), where browsing lives, and this file keeps the one
 * concept the selection is required for.
 *
 * That split is what let the inline "Relevant controls" fold be deleted rather
 * than fixed. Relevance counted a control whose selector matched anything
 * INSIDE the element, so selecting a container bound most of the app's
 * inventory — 177 controls at ~188px each, which once pushed Appearance some
 * 33,000px down a panel that is supposed to describe one box. The fold was
 * capped at 260px to contain the damage. The cap treated the symptom; moving
 * the population out removes the cause, and nothing here is capped any more.
 *
 * The word is "saved style" throughout, because "option" was the collision and
 * retiring it is cheaper than disambiguating it.
 *
 * ## Why the verbs are inside the section now
 *
 * They were a separate `optionsActionsSection`, drawn last in the inspector's
 * stack, and the reason given was sound as far as it went: the list is absent
 * when the element has nothing saved, and Save is the only way anything ever
 * gets saved, so Save could not live inside a box that might not exist. The
 * cost was that the three verbs sat nine sections below the list they act on —
 * past responsive, position, layout, appearance, fill, stroke, effects,
 * typography and classes — which is not a group with space between it, it is
 * two groups. And "Save as option" is the hardest control in the panel to find
 * while being the only path to a first saved style.
 *
 * The premise is what was wrong. The section is unconditional now, so the box
 * always exists, so the verbs can be its first row and the objection dissolves.
 */

import { el } from "../core/dom"
import { icon } from "../core/icons"
import { section } from "../panels/inspector/field"
import { isControlRelevantToElement, readInventory } from "./inventory"
import type { LevaControl, LevaFolder } from "./inventory"
import { optionsStore, visibleOptions } from "./store"
import type { InspectorSection, SectionContext } from "../panels/inspector/index"
import type { ElementOption, ElementOptionSet } from "../core/types"
import { tokens } from "../core/tokens"

function controlsIn(folders: readonly LevaFolder[]): LevaControl[] {
  const controls: LevaControl[] = []
  const visit = (folder: LevaFolder) => {
    controls.push(...folder.controls)
    folder.folders.forEach(visit)
  }
  folders.forEach(visit)
  return controls
}

/** Swaps the name for an input in place; Enter commits, Escape reverts. */
function startRename(
  name: HTMLElement,
  option: ElementOption,
  commit: (value: string) => void
): void {
  const input = el("input", {
    type: "text",
    value: option.name,
    "aria-label": "Style name",
  }) as HTMLInputElement
  /*
   * The rename field keeps `.de-field`'s own height, and it used to override it
   * to 18px.
   *
   * A row is `size.rowHeight` (24) and every other field in the chrome is too,
   * so the input that REPLACES a row's name was six pixels shorter than the
   * thing it stood in for — the row visibly shrank the moment you started
   * typing in it, and the field itself sat under the 24px a pointer is owed.
   * There is nothing left to set but the flex.
   */
  const field = el("div", { class: "de-field", style: "flex:1" }, [input])
  // The row itself applies the style on click; renaming must not trigger that.
  field.addEventListener("click", (event) => event.stopPropagation())
  field.addEventListener("dblclick", (event) => event.stopPropagation())

  name.replaceWith(field)
  input.focus()
  input.select()

  let settled = false
  const finish = (keep: boolean) => {
    if (settled) return
    settled = true
    const value = input.value.trim()
    field.replaceWith(name)
    if (keep && value && value !== option.name) commit(value)
  }

  input.addEventListener("blur", () => finish(true))
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault()
      finish(true)
    }
    if (event.key === "Escape") {
      event.preventDefault()
      finish(false)
    }
  })
}

function optionRow(context: SectionContext, option: ElementOption, active: boolean): HTMLElement {
  const store = optionsStore(context.editor)
  const { selection, writer } = context

  // `.de-option-name` ellipsises inside a 240px row it shares with a rename
  // control and a delete, and `option.name` is the one string on this surface
  // the user typed themselves. Cutting a machine-generated token name costs
  // little; cutting somebody's own label with no way back to it loses the only
  // copy. Its two siblings in this panel, `.de-opt-label` and
  // `.de-opt-folder-name`, already carry exactly this.
  const name = el("span", { class: "de-option-name", title: option.name }, [option.name])

  const apply = () => store.apply(selection, writer, option)

  // The radio is the choice itself. The delete button used to be nested inside
  // it, which is invalid ARIA (a `radio` may not own a control) and made the
  // whole row ambiguous to a keyboard user.
  const choice = el(
    "div",
    {
      class: "de-option",
      role: "radio",
      tabindex: "0",
      "aria-checked": String(active),
      onclick: apply,
      onkeydown: (event: Event) => {
        const key = (event as KeyboardEvent).key
        if (key !== "Enter" && key !== " ") return
        event.preventDefault()
        apply()
      },
    },
    [name]
  )

  const remove = el(
    "button",
    {
      class: "de-option-delete",
      type: "button",
      // "Saved style", the one name this concept has anywhere in the product
      // now. It read "saved variant" on this button while the list above it
      // said "saved options" and the button that creates them said "Save as
      // option" — three words for one `ElementOption`, one of which the editor
      // also used for a host control's named choices.
      title: "Delete this saved style",
      "aria-label": `Delete ${option.name}`,
      onclick: () => store.remove(selection, writer, option.id),
    },
    [icon("X", tokens.icon.row)]
  )

  const beginRename = () =>
    startRename(name, option, (value) => store.rename(selection.key, option.id, value))

  /*
   * A REAL CONTROL, because the double-click was the only way in and a
   * double-click is not a key.
   *
   * The dialog this panel replaced carried a `<button aria-label="Rename …">`
   * in its Saved-variants tab. Deleting the dialog took the button with it and
   * left `dblclick` on a `<span>` — no `tabindex`, so nothing focuses it, and
   * the row's own `onkeydown` above answers Enter and Space by APPLYING the
   * style. There was no key anywhere that reached `startRename`, which makes
   * renaming pointer-only: a path reachable by pointer and not by keyboard,
   * which is the escalation trigger, and a capability this panel regressed
   * rather than inherited.
   *
   * It sits beside Delete in the same strip so the two verbs a saved style has
   * are found together, and it is drawn at rest for the same reason that one
   * is: an action that only appears on hover is an action a keyboard never
   * finds. The double-click stays as a shortcut for the hand already on the
   * name — it costs nothing now that it is not the only way.
   */
  const rename = el(
    "button",
    {
      class: "de-option-rename",
      type: "button",
      title: "Rename this saved style",
      "aria-label": `Rename ${option.name}`,
      onclick: beginRename,
    },
    [icon("Pencil", tokens.icon.row)]
  )

  name.addEventListener("dblclick", (event) => {
    event.stopPropagation()
    beginRename()
  })

  return el("div", { class: "de-option-row" }, [choice, rename, remove])
}

/**
 * What this element has, asked once.
 *
 * `saved` decides what the list draws and what the verbs can act on; `relevant`
 * decides only whether the way out to the Controls tab is worth offering, and
 * how many it promises. They are read together because both come off one
 * render and a second derivation is the first place they could disagree.
 */
interface DesignOptions {
  set: ElementOptionSet | null
  saved: ElementOption[]
  relevant: LevaControl[]
}

function designOptionsFor(context: SectionContext): DesignOptions {
  const store = optionsStore(context.editor)
  void store.ready()
  const set = store.get(context.selection.key)
  const inventory = readInventory()
  return {
    set,
    saved: visibleOptions(set),
    relevant: inventory.available
      ? controlsIn(inventory.sections).filter((control) =>
          isControlRelevantToElement(control, context.selection.element)
        )
      : [],
  }
}

/**
 * A verb that is unavailable, kept in the tab order and told to say so.
 *
 * Never native `disabled`. A disabled button leaves the tab order AND stops
 * receiving pointer events, so neither the browser's own `title` tip nor this
 * chrome's delegated tooltip can ever open on it — which made the reason a
 * button was greyed readable only in the state where the button was not greyed.
 * `aria-disabled` keeps it reachable and announced; the handler returns early;
 * and the actual reason goes in visible text under the row, where it costs no
 * hover and no guess. Setting both attributes would undo all of that, so this
 * helper is the only place either is written.
 */
function verb(label: string, title: string, unavailable: boolean, run: () => void): HTMLElement {
  return el(
    "button",
    {
      class: "de-button",
      type: "button",
      title,
      "aria-disabled": String(unavailable),
      onclick: () => {
        if (unavailable) return
        run()
      },
    },
    [label]
  )
}

export const optionsSection: InspectorSection = (context) => {
  const store = optionsStore(context.editor)
  const { set, saved: options, relevant } = designOptionsFor(context)

  const noActive = !set?.activeOptionId
  const noBaseline = !store.hasBaseline(context.selection.key)

  /*
   * `.de-opt-actions` and not `.de-row`, and the difference is wrapping.
   *
   * `.de-row` is a non-wrapping flex line, which was fine for "Save as option /
   * Update / Revert" in a footer and is not fine here: the labels say what they
   * act on now, and three of them do not fit across 260px — and the seam drags
   * to 200. A non-wrapping row would shrink each `.de-button` below its text
   * and wrap the words inside a 24px box, which clips. Wrapping the CLUSTER
   * costs a second line and keeps every label whole.
   */
  const actions = el("div", { class: "de-opt-actions" }, [
    verb("Save current style", "Save this element’s current state as a named style", false, () =>
      store.saveCurrent(context.selection, context.writer)
    ),
    verb(
      "Update saved style",
      "Overwrite the active saved style with the element’s current state",
      noActive,
      () => store.updateActive(context.selection)
    ),
    verb(
      "Revert to original",
      "Restore this element’s state from before its first saved style",
      noBaseline,
      () => store.revert(context.selection, context.writer)
    ),
  ])

  /*
   * One line, and only when something above it cannot be pressed.
   *
   * Two sentences would be two near-duplicates in the common case — an element
   * with nothing saved has no active style AND no revert point, and "apply a
   * saved style" is the answer to both. So the active-style reason wins when it
   * applies, and the baseline one is left for the narrow case where a style is
   * active but the pre-style snapshot never landed.
   */
  const reason = noActive
    ? "Apply a saved style to update or revert it."
    : noBaseline
      ? "Save a style first to get a revert point."
      : null

  const list = el(
    "div",
    {
      role: "radiogroup",
      "aria-label": "Saved styles",
      style: "display:flex;flex-direction:column",
    },
    options.length
      ? options.map((option) => optionRow(context, option, option.id === set?.activeOptionId))
      : [
          el("div", { class: "de-empty", style: "padding:2px 6px 6px;text-align:left" }, [
            "No saved styles yet. Restyle this element, then save the result so you can " +
              "switch back to it.",
          ]),
        ]
  )

  /*
   * The way out to the app-scoped controls, and it is a BUTTON with a count.
   *
   * It replaces a `.de-opt-link` reading "All design options" — underlined dim
   * text that opened a 460px floating window at the opposite corner of the
   * screen from the click, while a `.de-button` two states away said "Browse
   * all design options" for the same destination. One place, two names, two
   * treatments and a consequence the treatment understated.
   *
   * It carries the count because that is the whole of what this section can
   * honestly say about controls: how many of them touch this element. Showing
   * the controls themselves is what put 177 rows in a selection panel. Absent
   * at zero, because a button promising a list of nothing is worse than no
   * button — and the empty case is common, since bindings are opt-in.
   *
   * One `setState`, carrying the tab AND the scope: two writes would paint the
   * unscoped list for a frame, and the panel subscription runs per notification.
   */
  const browse = relevant.length
    ? el(
        "button",
        {
          class: "de-button",
          type: "button",
          onclick: () =>
            context.editor.setState({
              layersOpen: true,
              leftTab: "controls",
              controlsScope: "selection",
            }),
        },
        [
          // A verb and its object, not a sentence. This is a button that goes
          // somewhere, and the place it goes is already called "Browse app
          // controls" by the inspector's empty state — one destination should
          // not have two names. The count stays, because it is the reason to
          // press: it says there is something there.
          relevant.length === 1 ? "Browse 1 app control" : `Browse ${relevant.length} app controls`,
        ]
      )
    : null

  /*
   * Unconditional, and the count is dropped when there is nothing to count.
   *
   * The section used to return `null` when the element had neither a saved
   * style nor a bound control, on the grounds that a heading over an empty box
   * is a question asked instead of answered. With the verbs inside, the box is
   * never empty: what is under this heading on a fresh element is the one
   * button that creates a first saved style. "(0)" is dropped because a count
   * is a promise about a list, and there is no list yet — the empty state below
   * says so in words.
   */
  return section(
    options.length ? `Saved styles (${options.length})` : "Saved styles",
    el("div", { style: `display:flex;flex-direction:column;gap:${tokens.space.md}px` }, [
      actions,
      reason ? el("p", { class: "de-opt-reason" }, [reason]) : null,
      list,
      browse,
    ])
  )
}
