/**
 * The left panel's third view: every control the running app exposes.
 *
 * ## Why this is a docked pane and not the window it used to be
 *
 * This content spent a release inside a 460px `role="dialog"` pinned to the
 * bottom-left of the canvas, mounted on `document.body`. The header of that
 * file gave exactly one reason for the root: it had to SURVIVE DESELECTION,
 * because the inspector unmounts every section when nothing is selected and a
 * list of everything the app can be tuned with must not require picking
 * something first. That requirement is real. The dialog was not the way to meet
 * it — surviving deselection is the left panel's ordinary behavior, and has
 * been since before the window existed. The window was a hand-built
 * approximation of a surface the product already had, and it paid for the
 * approximation with a fixed position, a z-index over the app being edited, a
 * close button, a focus-return dance and a window-capture Escape listener, none
 * of which a pane in a tab strip needs.
 *
 * ## Why app-scoped controls belong on the LEFT
 *
 * `panels/left.ts` argues the strip is about SCOPE, not about editability: the
 * right panel operates on the selection, the left panel holds the subject and
 * the browsing. A leva control does not edit an element — `readInventory()`
 * takes no selection argument and a write goes to the app's own store — so it
 * edits the app, and the app is this column's subject. The app chooser directly
 * above the strip is already an editable, app-scoped control, and the most
 * consequential one in the product.
 *
 * ## The one word this file will not use
 *
 * "Option" covered three unrelated things across this subsystem: a leva
 * control, a select control's named choices, and this editor's own per-element
 * style snapshots. Those last ones live in the right panel with the verbs that
 * act on them; nothing here refers to them. What is here is a CONTROL (the
 * code's own word — `LevaControl`, `controlCount`, `controlRow`) and, on a
 * select, its CHOICES. "Variant" is retired from anything a reader sees: it was
 * simultaneously the name of a leva choice and the name of a saved style, and
 * one 460px window used to print both meanings a few hundred pixels apart.
 */

import { clear, el } from "../core/dom"
import { icon } from "../core/icons"
import type { EditorContext } from "../core/context"
import {
  controlValueAtPath,
  filterControls,
  filterTree,
  formatValue,
  highlightControlTargets,
  isControlRelevantToElement,
  readInventory,
  setControlValue,
  subscribeToLeva,
  targetsForControl,
} from "../options/inventory"
import type { LevaControl, LevaFolder } from "../options/inventory"
import type { LeftPanelTab } from "./left"
import { tokens } from "../core/tokens"
import { plural } from "../core/format"

/** Why a control cannot be deleted from here. Shown verbatim. */
const WHY_NOT = {
  control:
    "Not from here. A control is app code: its schema, default and every use change " +
    "together. You can delete its saved default.",
  choice:
    "A choice is app code, not a saved value. Removing it means editing its options, " +
    "defaults and every place that uses it.",
}

const defaultStateCache = new Map<string, boolean>()

function note(text: string): HTMLElement {
  return el("p", { class: "de-opt-note" }, [text])
}

/** A dim, always-present "why can't I…" toggle. Never hidden until hover. */
function explainer(label: string, body: string): HTMLElement {
  const text = el("p", { class: "de-opt-why", hidden: true }, [body])
  const button = el(
    "button",
    {
      class: "de-opt-link",
      type: "button",
      "aria-expanded": "false",
      onclick: () => {
        const next = text.hidden
        text.hidden = !next
        button.setAttribute("aria-expanded", String(next))
      },
    },
    [label]
  )
  return el("div", { class: "de-opt-whywrap" }, [button, text])
}

function chips(control: LevaControl, editor: EditorContext): HTMLElement {
  const names = control.variants ?? []
  const values = control.variantValues ?? []
  const buttons: HTMLElement[] = names.map((name, index) =>
    el(
      "button",
      {
        class: "de-opt-chip",
        type: "button",
        disabled: control.disabled,
        "aria-pressed": String(values[index] === control.value),
        title: `Set ${control.path} to "${name}"`,
        onclick: () => {
          if (!setControlValue(control.path, values[index])) {
            // The host's control panel has the last word on what it accepts, so
            // the recovery is a different value or the app's own panel — this
            // surface has nothing else to offer and should not imply it does.
            editor.toast(
              `${control.label} rejected “${name}”. Try another choice.`,
              "error"
            )
            return
          }
          // Repaint the pressed state in place rather than re-rendering: a
          // rebuild would drop the focus the user just put on this chip.
          for (const [other, button] of buttons.entries()) {
            button.setAttribute("aria-pressed", String(other === index))
          }
        },
      },
      [name]
    )
  )
  return el(
    "div",
    { class: "de-opt-chips", role: "group", "aria-label": `${control.label} choices` },
    buttons
  )
}

function valueEditor(control: LevaControl, editor: EditorContext): HTMLElement {
  const commit = (value: unknown) => {
    if (setControlValue(control.path, value)) return
    editor.toast(
      `${control.label} rejected that value. Check its allowed range.`,
      "error"
    )
  }

  if (control.type === "BOOLEAN") {
    const input = el("input", {
      type: "checkbox",
      "aria-label": control.label,
      disabled: control.disabled,
    }) as HTMLInputElement
    input.checked = control.value === true
    input.addEventListener("change", () => commit(input.checked))
    return el("label", { class: "de-opt-check" }, [input, control.value === true ? "on" : "off"])
  }

  if (control.type === "NUMBER" || control.type === "STRING" || control.type === "COLOR") {
    const numeric = control.type === "NUMBER"
    const input = el("input", {
      class: "de-opt-input",
      type: "text",
      inputmode: numeric ? "decimal" : undefined,
      "aria-label": `${control.label} value`,
      value: control.valueText,
      disabled: control.disabled,
    }) as HTMLInputElement
    const send = () => {
      if (!numeric) return commit(input.value)
      const parsed = Number.parseFloat(input.value)
      if (!Number.isNaN(parsed)) commit(parsed)
    }
    input.addEventListener("change", send)
    input.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return
      event.preventDefault()
      send()
      input.blur()
    })
    return input
  }

  /*
   * `valueText` is already cut at 61 characters by `formatValue`, and this was
   * the one truncation in the chrome with no copy of the full text anywhere on
   * screen — a leva value is not in a file the Code tab shows, not in a brief,
   * not in the row above. `formatValue(value, false)` is the same serializer
   * with the cut off, so the two forms cannot drift.
   */
  const full = formatValue(control.value, false)
  return el(
    "span",
    { class: "de-opt-value", ...(full === control.valueText ? {} : { title: full }) },
    [control.valueText]
  )
}

function defaultUrl(editor: EditorContext, control: LevaControl): string | null {
  if (!control.defaultGroup || !control.defaultKey) return null
  const query = new URLSearchParams({ group: control.defaultGroup, key: control.defaultKey })
  return `${editor.apiBase}/control-default?${query}`
}

function sourceDefaultActions(control: LevaControl, editor: EditorContext): HTMLElement | null {
  const url = defaultUrl(editor, control)
  if (!url || !control.canPersistDefault) return null

  const status = el("span", { class: "de-opt-tag", "aria-live": "polite" }, ["source-linked"])
  const apply = el("button", { class: "de-button", type: "button" }, ["Apply to code"])
  const remove = el(
    "button",
    { class: "de-button de-button--danger", type: "button" },
    ["Delete saved default"]
  )

  const setState = (exists: boolean) => {
    defaultStateCache.set(url, exists)
    status.textContent = exists ? "saved" : "not saved"
    apply.textContent = exists ? "Update default" : "Apply to code"
    ;(apply as HTMLButtonElement).disabled = control.disabled
    ;(remove as HTMLButtonElement).disabled = control.disabled || !exists
  }

  const refresh = async () => {
    try {
      const response = await fetch(url, { headers: { accept: "application/json" } })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const result = (await response.json()) as { exists?: boolean }
      setState(result.exists === true)
    } catch {
      status.textContent = "source unavailable"
      editor.toast(
        `Could not read the saved default for ${control.label}. Reload the page, then try again.`,
        "error"
      )
    }
  }

  apply.addEventListener("click", async () => {
    const current = controlValueAtPath(control.path)
    const value = current === undefined ? control.value : current
    try {
      const response = await fetch(url, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ value }),
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      setState(true)
      editor.toast(`Updated source default for ${control.label}`)
    } catch {
      // The live value already moved; only the durable copy did not. Saying so
      // is the difference between "try again" and "redo the whole adjustment".
      editor.toast(
        `${control.label} is set here, but its default was not saved to code. Try again.`,
        "error"
      )
    }
  })

  remove.addEventListener("click", async () => {
    try {
      const response = await fetch(url, { method: "DELETE" })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      setState(false)
      editor.toast(`Deleted the saved default for ${control.label}`)
    } catch {
      editor.toast(
        `Could not delete the saved default for ${control.label}. Try again, or delete it in the source file.`,
        "error"
      )
    }
  })

  const actions = el("div", { class: "de-opt-actions" }, [status, apply, remove])
  const cached = defaultStateCache.get(url)
  if (cached !== undefined) setState(cached)
  else {
    // A large host may expose hundreds of controls. Read this one literal only
    // when the row is approached rather than parsing the same source file once
    // per collapsed row on panel open.
    let requested = false
    const request = () => {
      if (requested) return
      requested = true
      void refresh()
    }
    actions.addEventListener("pointerenter", request, { once: true })
    actions.addEventListener("focusin", request, { once: true })
  }
  return actions
}

export function controlRow(control: LevaControl, editor: EditorContext): HTMLElement {
  const targets = targetsForControl(control)
  const highlight = control.relationship
    ? el(
        "button",
        {
          class: "de-button",
          type: "button",
          title: `Highlight elements this control ${control.relationship}`,
          onclick: () => {
            const resolved = highlightControlTargets(control)
            if (!resolved?.elements.length) {
              editor.toast(
                `Nothing on this page uses ${control.label}. Open a page that does, then try again.`,
                "error"
              )
            }
          },
        },
        [targets?.elements.length ? `Show ${targets.elements.length} affected` : "Show affected"]
      )
    : null

  return el("div", { class: "de-opt-row", "data-hidden": control.visible ? undefined : "" }, [
    el("div", { class: "de-opt-head" }, [
      el("span", { class: "de-opt-label", title: control.label }, [control.label]),
      el("span", { class: "de-opt-type" }, [control.type.toLowerCase()]),
      control.relationship ? el("span", { class: "de-opt-tag" }, [control.relationship]) : null,
      control.visible ? null : el("span", { class: "de-opt-tag" }, ["hidden now"]),
    ]),
    el("code", { class: "de-opt-path", title: "Control path" }, [control.path]),
    control.variants ? chips(control, editor) : valueEditor(control, editor),
    highlight ? el("div", { class: "de-opt-actions" }, [highlight]) : null,
    sourceDefaultActions(control, editor),
    explainer("Delete this control?", WHY_NOT.control),
  ])
}

function folderNode(
  folder: LevaFolder,
  editor: EditorContext,
  depth: number,
  expand: boolean
): HTMLElement {
  const summary = el("summary", { class: "de-opt-summary" }, [
    el("span", { class: "de-opt-twisty", "aria-hidden": "true" }, [icon("ChevronRight", tokens.icon.marker)]),
    // The whole name in `title`. `.de-opt-folder-name` is the shrinkable cell on
    // this row — see its note in `css/options.ts` — and the names it holds are
    // often source paths, which is the one shape of string an end ellipsis
    // makes useless. The sibling `.de-opt-label` already did this; the folder
    // above it did not.
    el("span", { class: "de-opt-folder-name", title: folder.name }, [folder.name]),
    el("span", { class: "de-opt-count" }, [
      plural(folder.controlCount, "control") +
        (folder.variantCount ? ` · ${plural(folder.variantCount, "choice")}` : ""),
    ]),
    folder.hasSaveDefault
      ? el("span", { class: "de-opt-tag de-opt-tag--saved", title: "Values here can be saved as defaults" }, ["default"])
      : null,
  ])

  const body = el("div", { class: "de-opt-folder-body" }, [
    ...folder.controls.map((control) => controlRow(control, editor)),
    ...folder.folders.map((child) => folderNode(child, editor, depth + 1, expand)),
  ])

  return el("details", { class: "de-opt-folder", open: expand || depth > 0 }, [summary, body])
}

/**
 * An empty state in this pane: announced, headed, and with the way out attached.
 *
 * `role="status"` because the pane is rebuilt under a filter the reader is
 * still typing into, under a scope switch, and under the host's own control
 * store — so the list going empty is a change nobody's focus moved for. A
 * sighted reader watches the rows vanish; without this a screen-reader user
 * gets nothing at all. Polite rather than an alert, because most of these are
 * the answer to a keystroke.
 *
 * The headline is separate from the sentence because these states differ in
 * KIND — "this project has no control panel" and "your filter matched nothing"
 * want different first reactions — and a reader scanning a 240px column reads
 * the heading before the prose. Where a state has no distinct kind to announce,
 * the title is null and the sentence stands alone.
 *
 * The action is passed in rather than reached for. The filter and the scope
 * chips belong to the pane and outlive the body, which is rebuilt on every
 * keystroke; a button that closed over a stale node would be a way out that
 * stopped working the second time it was offered.
 */
function emptyState(title: string | null, text: string, action: HTMLElement | null): HTMLElement {
  return el("div", { class: "de-empty", role: "status" }, [
    title ? el("div", { class: "de-empty-title" }, [title]) : null,
    el("div", {}, [text]),
    action,
  ])
}

/**
 * The pane, built once and re-rendered in place.
 *
 * The filter and the scope chips are created ONCE and live outside the part
 * that is rebuilt, which is what lets the leva store fire on every drag frame
 * without the box you are typing in disappearing under you. Only `body` is
 * cleared, so nothing a rebuild can reach is ever focused except the rows
 * themselves — and the scheduler below declines to rebuild while one of those
 * holds focus.
 */
export function controlsTab(editor: EditorContext): LeftPanelTab {
  const filter = el("input", {
    class: "de-opt-filter",
    type: "search",
    placeholder: "Filter by name, path or value",
    "aria-label": "Filter controls",
  }) as HTMLInputElement

  const body = el("div", { class: "de-opt-body" })

  /**
   * The scope switch, and why the unavailable chip is not `disabled`.
   *
   * A natively disabled button leaves the tab order and swallows pointer
   * events, so neither the browser's own tip nor this chrome's delegated
   * tooltip can ever fire on it — the reason a control is unavailable becomes
   * readable only once it is available. `aria-disabled` keeps the chip
   * reachable and announced, the handler returns early instead, and the reason
   * is in visible text beside it where it needs no hover at all. Never both
   * attributes: `disabled` would undo everything `aria-disabled` is here for.
   */
  const scopeReason = el("p", { class: "de-opt-reason" }, [
    "Select an element to scope this list.",
  ])
  const allChip = el("button", { class: "de-opt-chip", type: "button", role: "radio" }, ["All"])
  const elementChip = el("button", { class: "de-opt-chip", type: "button", role: "radio" }, [
    "This element",
  ])
  const scope = el("div", { class: "de-opt-scope" }, [
    el("div", { class: "de-opt-chips", role: "radiogroup", "aria-label": "Control scope" }, [
      allChip,
      elementChip,
    ]),
    scopeReason,
  ])

  const setScope = (next: "all" | "selection") => {
    if (next === "selection" && !editor.primarySelection()) return
    if (editor.getState().controlsScope === next) return
    editor.setState({ controlsScope: next })
  }
  allChip.addEventListener("click", () => setScope("all"))
  elementChip.addEventListener("click", () => setScope("selection"))

  /*
   * A radiogroup is ONE tab stop, and its arrows carry the choice with them.
   *
   * Both chips are native buttons, so without this they are two stops and the
   * arrows do nothing — a `role="radio"` keeping none of the promises the role
   * makes. The start screen's app list was built correctly in this same change;
   * this is deliberately the same pattern, so the two cannot drift.
   *
   * `setScope` rather than `.click()`, so a chip that is `aria-disabled`
   * refuses through the one guard that already knows why. Focus still MOVES to
   * it: the reason it is unavailable is a sentence sitting beside it, and
   * arrowing onto it is how a keyboard reader gets that sentence read out.
   */
  const chips = [allChip, elementChip]
  for (const chip of chips) {
    chip.addEventListener("keydown", (event) => {
      const key = (event as KeyboardEvent).key
      const step =
        key === "ArrowRight" || key === "ArrowDown"
          ? 1
          : key === "ArrowLeft" || key === "ArrowUp"
            ? -1
            : 0
      if (step === 0) return
      event.preventDefault()
      const next = chips[(chips.indexOf(chip) + step + chips.length) % chips.length]
      next.focus()
      setScope(next === elementChip ? "selection" : "all")
    })
  }

  const node = el("div", { class: "de-controls" }, [filter, scope, body])

  filter.addEventListener("input", () => render())

  /** Whether this pane is on screen — a hidden tabpanel is not worth painting. */
  function showing(): boolean {
    if (!node.isConnected) return false
    for (let step: HTMLElement | null = node; step; step = step.parentElement) {
      if (step.hidden) return false
    }
    return true
  }

  function render(): void {
    const query = filter.value
    const selection = editor.primarySelection()
    // With nothing selected there is nothing to scope TO, so the pane shows
    // everything rather than an empty list explaining itself. The store keeps
    // whatever the user last asked for: reselecting an element puts them back
    // where they were instead of making them ask twice.
    const scoped = Boolean(selection) && editor.getState().controlsScope === "selection"
    allChip.setAttribute("aria-checked", String(!scoped))
    elementChip.setAttribute("aria-checked", String(scoped))
    elementChip.setAttribute("aria-disabled", String(!selection))
    scopeReason.hidden = Boolean(selection)

    clear(body)
    const inventory = readInventory()
    if (!inventory.available) {
      body.append(emptyState(inventory.title, inventory.reason, null))
      return
    }

    const inScope =
      scoped && selection
        ? filterControls(inventory.sections, (control) =>
            isControlRelevantToElement(control, selection.element)
          )
        : inventory.sections

    if (scoped && inScope.length === 0) {
      body.append(
        emptyState(
          "No controls affect this element",
          "Controls still work. Map them in your config to see what each one affects.",
          el(
            "button",
            { class: "de-button", type: "button", onclick: () => setScope("all") },
            ["Show all controls"]
          )
        )
      )
      return
    }

    const sections = filterTree(inScope, query)
    body.append(
      // One note, and only the fact a reader cannot infer from the rows. This
      // used to be two blocks totalling sixty words between the filter and the
      // first row — a table of contents where the book should be — and one of
      // them told the reader to "reopen this list" after navigating, which the
      // pane has never required: it subscribes to the host's store and repaints
      // itself. An instruction describing work the product does not need is how
      // a reader learns to stop trusting the copy.
      note(
        `${plural(inventory.controlCount, "control")}, ${plural(inventory.variantCount, "choice")}. Changes apply to the running app instantly.`
      ),
      ...(sections.length
        ? sections.map((section) => folderNode(section, editor, 0, query.trim().length > 0))
        : [
            emptyState(
              null,
              `No controls match “${query}”. Try another name, path or value.`,
              el(
                "button",
                {
                  class: "de-button",
                  type: "button",
                  onclick: () => {
                    filter.value = ""
                    render()
                    // Back to the field, not to a button this call is about to
                    // delete from the document: the rows return, the empty
                    // state does not, and a keyboard user who pressed it would
                    // otherwise be dropped on the pane's body.
                    filter.focus()
                  },
                },
                ["Clear filter"]
              )
            ),
          ]),
      explainer("Why named choices cannot be deleted", WHY_NOT.choice)
    )
  }

  /**
   * Invariant 5: never rebuild a surface out from under a focused control.
   *
   * Scoped to `body` rather than to the whole pane, which is the difference the
   * split above buys. The filter and the chips survive every rebuild, so a
   * reader typing a query no longer blocks the repaint their own typing asked
   * for; only a row control — a number field mid-edit, a chip mid-press — does.
   */
  const update = (): void => {
    if (body.contains(document.activeElement)) return
    render()
  }

  /*
   * The host's control store fires on every drag frame, so a listener that
   * rendered straight through would rebuild a 177-row tree sixty times a
   * second. One frame's worth is coalesced and a hidden pane is skipped
   * entirely — switching to it renders it, which is the contract `left.ts`
   * keeps for every tab.
   */
  let scheduled = 0
  const schedule = () => {
    if (scheduled) return
    scheduled = requestAnimationFrame(() => {
      scheduled = 0
      if (!showing()) return
      update()
    })
  }
  subscribeToLeva(schedule)

  /*
   * The scope is written from two places — the chips here, and the right
   * panel's "N app controls affect this element" button, which sets it in the
   * same `setState` that opens this tab. So the pane cannot own the value as a
   * local: it has to read the store, and it has to hear about a write it did
   * not make. Rendered directly rather than through `schedule`, because a scope
   * change is a deliberate press and a frame of the old list is a frame of the
   * wrong answer.
   */
  editor.subscribe((next, previous) => {
    if (next.controlsScope === previous.controlsScope) return
    if (showing()) update()
  })

  return { node, update }
}
