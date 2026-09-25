/**
 * The left panel: three views over the app you are editing.
 *
 * **Layers** is the tree this panel has always been — the shared layer graph,
 * mounted by `installLayersPanel`, which appends straight into whatever slot it
 * is handed. **Code** is the selected element as source, the same view the right
 * inspector used to carry as its third tab. **Controls** is every tunable the
 * running app exposes through its own control panel.
 *
 * ## Why Code is here and not in the inspector
 *
 * Both of those tabs answer "what IS this", and they answer it at the two scales
 * a person actually asks it: the tree says where the element sits in the page,
 * and the code view says what it is written as. Reading one and then the other
 * is one question asked twice, so they belong in one strip — and putting them
 * both on this side leaves the inspector free to be what its name says, a panel
 * of controls you change things with. The old split had the opposite property:
 * two of the right panel's three tabs were editable and the third was
 * pointedly read-only, so every visit to Code was a trip out of the working
 * surface and back.
 *
 * It also fixes an asymmetry nobody could see a reason for. The code view is
 * `white-space: pre` and the inspector is the narrow column of the two by
 * design — the fields in it are built to a fixed width, while a line of JSX is
 * as long as it is. The tree has the same shape of content and the same need
 * for room, which is why this panel was already the one people drag wider.
 *
 * ## Why Controls is here, when it is the one tab you EDIT things in
 *
 * For a while the argument above read as "the left rail is the read-only side",
 * and a third tab full of live inputs would break it. That reading was wrong,
 * and the app chooser sitting directly above this strip has always been the
 * counterexample: it is an editable control, and the most consequential one in
 * the product, since picking a different app ends the session.
 *
 * The rule the two tabs above actually draw is about SCOPE. The right panel
 * operates on the selection; this column holds the subject and the browsing. A
 * leva-style control does not edit an element — `readInventory()` takes no
 * selection argument, and writing one goes to the app's own store — so what it
 * edits is the app, and the app is this column's subject. Substitute nouns into
 * the Assets argument below and the placement writes itself: a control is worth
 * showing in the inspector when it is bound to the thing you selected, and
 * worth browsing here when you are scrolling past a hundred and seventy of them.
 *
 * It also retires a floating `role="dialog"` that existed for one reason: to
 * survive deselection. That is this panel's ordinary behavior — it does not
 * unmount when the selection clears, it merely repaints Code — so the window
 * was a hand-built approximation of a surface the product already had.
 *
 * ## What left with Assets, and where it went
 *
 * This strip used to carry a third and fourth view: an Assets browser — groups,
 * cards, thumbnails, a component you drag onto the page — and the design-system
 * audit. Both moved to the right panel's **Design system** tab, and the browser
 * lost its catalogue on the way: it lists the libraries a project has and what
 * each one contains, and nothing about individual components. The components did
 * not go anywhere. They feed the Design tab's instance properties and every
 * token picker in the inspector, which is a better home for them than a grid —
 * a component is worth showing when you have selected one, not when you are
 * scrolling past four hundred of them.
 *
 * ## The strip is a deliberate duplicate of the inspector's
 *
 * `panels/inspector/index.ts` builds an identical tab host, and this one is not
 * shared with it. It could not be without a rewrite of that file: its strip is
 * fused into `installInspector` alongside the focus memory, the section loop and
 * the ledger's out-of-band repaint, all of which close over the same locals, so
 * lifting the eight lines of DOM out means editing a file three other surfaces
 * currently depend on for the sake of removing a duplicate that is smaller than
 * the diff. So the ARIA contract is restated here instead, and the two are kept
 * honest by a test each rather than by a shared function.
 *
 * What is NOT duplicated is the stylesheet: both strips are `.de-tabs` /
 * `.de-tab` / `.de-tabpanel`, so they cannot drift apart visually, and
 * `css/left-tabs.ts` carries only the two rules that are about this panel's
 * body. Two tab strips in one piece of chrome are one control the user learns
 * once.
 *
 * ## Why the app chooser sits above the strip rather than inside a tab
 *
 * It names the thing every other surface in the editor is a view OF. The tree
 * lists that app's elements, the code view prints one of them, the audit across
 * the window reports on it, and the inspector describes one element of it — so
 * the app's name is not a peer of those views, it is the subject they all take.
 * A subject printed inside one of its own views would be a heading that
 * disappears when you switch tabs.
 *
 * It is also the only control in this panel that ENDS the session: picking a
 * different app kills this editor and starts another. That is one level up from
 * everything under it, the same reason the "Choose app" link it replaces sat
 * ahead of the toolbar's clusters rather than in one of them — and above the
 * strip is the only position in this column that says so.
 */

import { el } from "../core/dom"
import { smoothScroll } from "../core/motion"
import { installTabPill } from "../core/travelling-surface"
import { registerCommand } from "../core/commands"
import { codeTab } from "./inspector/tab-code"
import { controlsTab } from "./controls"
import { installAppChooser } from "./app-chooser"
import { installLayersPanel } from "./layers"
import type { EditorContext } from "../core/context"

/**
 * What a pane hands back, and it is the inspector's `InspectorTab` shape by
 * structural coincidence rather than by import.
 *
 * Kept as a local declaration even though the Code tab now genuinely is an
 * `InspectorTab`, because the coincidence is the point: this panel accepts any
 * `{node, update}` and naming the type after the other panel would say the left
 * strip takes its tabs from the right one. It does not — it borrowed one view,
 * and the view happens to be built to a shape general enough to lend.
 */
export interface LeftPanelTab {
  node: HTMLElement
  /** Re-read the world. Called on activation and on every invalidation. */
  update(): void
}

interface TabDefinition {
  id: string
  label: string
  /** The `role="tabpanel"` box. Its content is mounted before the strip is wired. */
  pane: HTMLElement
  update(): void
}

/** Ids are prefixed so the two strips can never collide in one document. */
const tabId = (id: string) => `de-left-tab-${id}`
const paneId = (id: string) => `de-left-tabpanel-${id}`

export function installLeftPanel(context: EditorContext): void {
  const pane = (id: string): HTMLElement =>
    el("div", {
      class: "de-tabpanel",
      role: "tabpanel",
      id: paneId(id),
      "aria-labelledby": tabId(id),
    })

  const layersPane = pane("layers")
  const codePane = pane("code")
  const controlsPane = pane("controls")

  const strip = el("div", {
    class: "de-tabs",
    role: "tablist",
    "aria-label": "Left panel views",
  })
  const pill = installTabPill(strip)

  /*
   * The panes are in the document BEFORE either view is mounted into them.
   *
   * Neither needs it as urgently as the assets grid once did — that surface
   * scaled a cloned component to fit a thumbnail, which is a measurement of its
   * own box, and a box with no layout measures zero. The ordering is kept
   * anyway: it costs one extra reflow at boot and it removes the whole class of
   * "it only breaks on the first paint" from anything mounted below, which is a
   * guarantee worth having for whatever the next view here turns out to be.
   */
  /*
   * The chooser leads, and it is built against the REAL context.
   *
   * Its menu is a floating card in `document.body` rather than anything inside
   * this column — see `app-chooser.ts` for why neither the panel nor the
   * overlay can hold it — so it reads `bridge` and `toast` off the context and
   * nothing at all off `slots`. Handing it the adapted context the tree gets
   * would therefore change nothing, which is precisely why it is not done:
   * a substitution that has no effect is a substitution the next reader has to
   * work out the purpose of.
   *
   * `destroy` is deliberately dropped. `installLeftPanel` returns void and has
   * no teardown path — the panel is mounted once per page by `shell.ts` and
   * lives until the document does, and every other surface here is mounted the
   * same way without one. Inventing a lifecycle for one child would mean either
   * a teardown this panel cannot honestly promise or a `destroy` that is never
   * called; the control's own cleanup stays correct and simply goes unused
   * until this panel grows a real one.
   */
  const chooser = installAppChooser(context)
  context.slots.left.append(chooser.node, strip, layersPane, codePane, controlsPane)

  /*
   * The tree mounts into its pane by being handed a context that says the pane
   * IS the left slot.
   *
   * `installLayersPanel` appends its header, its filter and its tree into
   * `context.slots.left` and reads nothing else off the slots, so a shallow
   * copy with one substitution is the whole adapter. It is a copy and not a
   * mutation of the real context because every other lane holds the original
   * and expects `slots.left` to be the panel body: pointing the shared object
   * at a pane would silently reparent anything mounted after this.
   */
  installLayersPanel({ ...context, slots: { ...context.slots, left: layersPane } })

  /*
   * The code view takes the REAL context and appends itself, which is the other
   * of the two mounting styles in this file.
   *
   * `codeTab` builds its DOM and hands it back rather than writing into a slot,
   * so there is nothing to adapt — and it must not be given the adapted context
   * either. It reads `primarySelection()` and the clipboard and touches no slot
   * at all, so an adapter would be a substitution with no effect, which is the
   * same thing the chooser's comment above refuses to do.
   */
  const code = codeTab(context)
  codePane.append(code.node)

  /*
   * And the controls pane, mounted exactly the way the code view is.
   *
   * `controlsTab` hands its DOM back rather than writing into a slot, for the
   * same reason: it is a view, not a panel, and the only thing it needs from
   * the context is the store and the toast. It gets the REAL context, not the
   * adapted one the tree takes — it touches no slot, so the substitution would
   * be one with no effect, which the chooser's comment above refuses to make.
   */
  const controls = controlsTab(context)
  controlsPane.append(controls.node)

  const tabs: TabDefinition[] = [
    /*
     * Layers first, and it is the tab you land on.
     *
     * Not a coin toss between two peers: the tree is the answer to "what is on
     * this page", which is the question every session opens with, and it is the
     * surface the canvas keeps in sync — a click on the page scrolls a row into
     * view whether or not anybody is looking at it. Landing on Code would put a
     * read-only view of one element in front of a user who has not yet seen the
     * page it came out of, and on a cold load there is no selection, so the
     * pane they landed on would be empty.
     *
     * `update` is a no-op, and that is a real property of the tree rather than
     * a gap. `installLayersPanel` subscribes to the store and to `onRefresh`
     * itself and has done since long before this panel existed; it repaints on
     * its own schedule, diffing rows in place. Calling anything from here would
     * be a second author on one render.
     */
    { id: "layers", label: "Layers", pane: layersPane, update: () => {} },
    {
      id: "code",
      label: "Code",
      pane: codePane,
      update: () => code.update(),
    },
    /*
     * Controls last, and it is the only tab here that is not about the
     * selection at all.
     *
     * That is also why it is last rather than second. Layers and Code are read
     * at the rhythm of picking things — you select, you glance at the tree, you
     * glance at the source — and a tab wedged between them would sit in the
     * path of a gesture people make dozens of times a session to show something
     * that did not change when the selection did. Browsing the app's controls
     * is a thing you go and do; it deserves a slot, not the middle of somebody
     * else's loop.
     *
     * `update` is a real call, unlike Layers'. The pane reads the host's
     * control store and the primary selection, and while it subscribes to the
     * store itself for the live-drag case, the selection arrives through this
     * panel's own subscription — which is what keeps the scope chip honest
     * about whether there is anything to scope to.
     */
    {
      id: "controls",
      label: "Controls",
      pane: controlsPane,
      update: () => controls.update(),
    },
  ]

  let activeId = tabs[0].id
  const buttons = new Map<string, HTMLElement>()

  for (const definition of tabs) {
    const button = el(
      "button",
      {
        class: "de-tab",
        type: "button",
        role: "tab",
        id: tabId(definition.id),
        "aria-controls": paneId(definition.id),
        "aria-selected": String(definition.id === activeId),
        onclick: () => activate(definition.id),
      },
      [definition.label]
    )
    buttons.set(definition.id, button)
    strip.append(button)
    definition.pane.hidden = definition.id !== activeId
  }

  /*
   * Place the pill under the tab that mounted selected.
   *
   * A frame late, because the strip is in the document by now but has not been
   * laid out — the buttons measure zero until the browser has painted once, and
   * `installTabPill` refuses a zero measurement rather than publishing a pill
   * of no width parked at the origin. This is also the write that trips the
   * helper's first-placement guard, so the initial position is a jump and every
   * one after it is a move.
   */
  requestAnimationFrame(() => pill.track(buttons.get(activeId)))

  /**
   * Switching tabs updates the tab you switch TO, and only that one.
   *
   * The hidden pane keeps its DOM: the code view holds a chosen view mode and a
   * scroll offset, and losing both every time you glance at the tree would make
   * the pair unusable. It is `hidden` rather than detached so it also cannot be
   * tabbed into, and so the pane that is not being looked at is not re-read on
   * every selection change — which is what keeps a marquee off the code
   * generator's hot path.
   */
  function activate(id: string): void {
    activeId = id
    /*
     * Published, so the keyboard can ask for a tab without reaching into this
     * closure — the same contract `panels/inspector/index.ts` keeps for its own
     * strip, and the shortcut layer is the caller.
     *
     * Written on every switch and not only on a user click, because the store
     * is the record of WHICH TAB IS SHOWING; a switch this function made for
     * any other reason is still a switch. Guarded on inequality so the write
     * that comes back through the subscription below cannot loop.
     */
    if (context.getState().leftTab !== id) context.setState({ leftTab: id })
    for (const definition of tabs) {
      const selected = definition.id === id
      buttons.get(definition.id)?.setAttribute("aria-selected", String(selected))
      definition.pane.hidden = !selected
    }
    /*
     * Three tabs, and the strip is a scroller now rather than insurance.
     *
     * Two short words fit this panel at every width the seam allows. "Layers ·
     * Code · Controls" does not: the panel drags down to `panelMinWidth`, which
     * is 180px, and three pills with `space.sm` padding a side clear that
     * before the labels are even measured. So the chosen tab has to bring
     * itself into view, exactly as the inspector's does — the strip draws no
     * scrollbar, and without this there would be no way to reach a tab that had
     * fallen off the end.
     *
     * Guarded twice over: JSDOM does not implement `scrollIntoView`, and the
     * tab suites drive this function directly.
     */
    buttons.get(id)?.scrollIntoView?.({ block: "nearest", inline: "nearest", behavior: smoothScroll() })
    // After the scroll, not before: `scrollIntoView` can move the strip under
    // the pill, and the offsets the pill reads are content-relative, so a
    // measurement taken first would be correct about a layout that no longer
    // holds. Nothing here is async — the scroll is synchronous and `nearest`
    // usually does nothing at all — so this is still one frame.
    pill.track(buttons.get(id))
    tabs.find((definition) => definition.id === id)?.update()
  }

  let scheduled = 0
  const invalidate = () => {
    if (scheduled) return
    scheduled = requestAnimationFrame(() => {
      scheduled = 0
      tabs.find((definition) => definition.id === activeId)?.update()
    })
  }

  context.onRefresh(invalidate)

  /*
   * A selection subscription, which this panel did not need until Code arrived.
   *
   * Every view that used to live here was downstream of something other than
   * the selection — the tree drives its own repaint, the assets grid was about
   * the catalogue, the audit was about the source — so the panel deliberately
   * never watched it. The code view is the opposite: it is a rendering of the
   * primary selection and nothing else, and without this it would sit showing
   * the element you selected before last.
   *
   * Controls needs the same notification for a smaller reason: its content is
   * app-scoped, but its scope CHIP is not. Whether "This element" can be picked
   * at all, and what it prunes to when it is, both move with the selection, so
   * a pane that never heard about one would offer a scope over an element that
   * is no longer chosen.
   *
   * Narrowed to the one field on purpose. `hovered` is written on every
   * pointermove, and repainting a syntax-highlighted block for each of those
   * would put a full re-render of the pane on the hot path of simply moving the
   * mouse across the page. `invalidate` then throttles to a frame and updates
   * only the visible tab, so the cost while Layers is showing is a comparison.
   */
  context.subscribe((next, previous) => {
    if (next.selection !== previous.selection) invalidate()
  })

  /*
   * The other direction: something else asked for a tab.
   *
   * Only the keyboard does today, and the guard is the same one the inspector's
   * strip uses — act on the value only when it names a tab we are not already
   * showing, so `activate`'s own write cannot come back round and re-enter.
   * An unknown id is ignored rather than blanking the panel; the store's type
   * is `string` precisely because this panel owns the list.
   */
  context.subscribe((next, previous) => {
    if (next.leftTab === previous.leftTab || next.leftTab === activeId) return
    if (tabs.some((definition) => definition.id === next.leftTab)) activate(next.leftTab)
  })

  /*
   * ⌥1 / ⌥2 / ⌥3, registered BY SLOT rather than by name.
   *
   * Figma's three left-panel keys are positional and so are these, which is
   * also what keeps them working through a change to this array: the first key
   * selects whatever the first tab has become. Naming them after the tabs is
   * what the first version did, and it broke the afternoon Assets was retired
   * and Code moved over from the inspector — three keys went silently dead,
   * because a command nobody registers is a no-op.
   *
   * Only the slots that exist are registered, and this array is the reason
   * that clause is written the way it is: the panel carried two tabs for a
   * release, ⌥3 fell through to the page, and adding Controls claimed the key
   * with no edit here at all. `runCommand` reporting whether it found anything
   * is what makes an unclaimed slot a no-op rather than a swallowed keystroke —
   * and `shell/shortcuts.ts` reads tab names off the live strip, so the sheet
   * names the new tab without being told about it either.
   *
   * Opening the panel is part of the command, not a separate concern: a key
   * that switched a tab inside a closed panel would look like a key that did
   * nothing. One `setState`, because the subscription above runs per
   * notification and two writes would paint the old tab for a frame.
   */
  tabs.slice(0, 3).forEach((definition, index) => {
    registerCommand(`panel.left.tab${index + 1}`, () =>
      context.setState({ layersOpen: true, leftTab: definition.id })
    )
  })

  // Every pane once at boot, so the tab you switch to before the first write is
  // not empty. After this only the visible one is kept current.
  for (const definition of tabs) definition.update()
}
