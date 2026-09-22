/**
 * Mounts the editor chrome: a floating toolbar, a layers rail on the left, an
 * inspector on the right, and a transparent overlay layer for canvas chrome.
 *
 * The app is inset with padding on a border-box <html> rather than a transform,
 * because a transformed ancestor would break the app's own `layoutId`
 * shared-element morphs (see docs/agent-rules/card-reader-morph.md).
 */

import { config } from "../core/config"
import { shellCss } from "../core/css"
import { AGENTATION_ROOT_ATTR, CHROME_ATTR, el } from "../core/dom"
import { focusControl, installFocusModality } from "../core/focus"
import type { EditorSlots } from "../core/context"
import { editorOwnsInput, getState, setState, subscribe } from "../core/store"
import { createLauncher } from "./launcher"
import { mountPanelResize } from "./resize"

const STYLE_ID = "designlayer-shell-style"

export interface Shell {
  slots: EditorSlots
  root: HTMLElement
  destroy(): void
}

/**
 * Gives our own controls their focus back.
 *
 * The vendor guards the document against the app stealing a gesture: one of its
 * `mousedown` listeners on `document` (capture) calls `preventDefault()` for
 * anything that is not its own shadow chrome. Focus is a *default action* of
 * mousedown, so the caret never lands in our inspector — every field reads as
 * decorative, and typing goes nowhere. Its guard cannot be reordered: it is
 * registered when the vendor boots, which is before our bundle is even parsed.
 *
 * `window` capture runs before `document` capture, so focusing here happens
 * while the event is still untouched. `preventDefault()` afterwards suppresses
 * the default focus move, not a focus already applied by script.
 */
function restoreChromeFocus(): () => void {
  /**
   * Declaw the guard for our own gestures.
   *
   * `window` capture is the first stop in the propagation path, so by the time
   * the vendor's `document`-capture listener calls these, they do nothing: the
   * event keeps descending to our controls and its default action survives.
   * While the editor owns input, only events aimed at our chrome are touched,
   * so the vendor keeps its guard everywhere it actually means it — over the
   * app being edited. Interactive mode widens that to the app; see below.
   */
  const declaw = (event: Event) => {
    const target = event.target
    /*
     * The annotation toolbar counts as ours, and has to.
     *
     * It is not `[data-designlayer]` — it is a third-party component with its
     * own portal — but it is a surface this package mounted and expects the
     * designer to operate. Left out of this test it was simply dead: the vendor
     * guard swallowed every click on it, so the picker could not be armed at
     * all. Measured that way on a live page before this line existed.
     *
     * Narrower than `isChrome()` on purpose. That selector also covers the
     * host's own dev GUI through `chrome.trustedSelectors`, and widening the
     * declaw to a panel this package neither mounted nor understands is a
     * different decision from this one.
     */
    const ours =
      target instanceof Element &&
      target.closest(`[${CHROME_ATTR}],[${AGENTATION_ROOT_ATTR}]`) !== null
    /*
     * Interactive mode has to be honoured by the VENDOR too, not just by us.
     *
     * Gating our own handlers on `editorOwnsInput()` is only half the mode: the
     * vendor's guard is still on `document` (capture) and still stops every
     * gesture aimed at the app, so with the mode ON the app stayed exactly as
     * dead as with it off — an app button received neither pointerdown nor
     * click. Declawing over the app is therefore the mode's second half, and
     * the one that actually makes the claim true.
     */
    if (!ours && editorOwnsInput()) return
    event.stopPropagation = () => {}
    event.stopImmediatePropagation = () => {}
    event.preventDefault = () => {}

    // Focus is forced only for our own fields. Over the app the native default
    // action is enough, now that nothing is suppressing it.
    if (event.type !== "pointerdown" || !ours) return
    // Belt and braces for focus, which is the one default action that has to
    // survive even if a guard we have not seen yet calls the native methods
    // off a retained reference.
    const focusable = target.closest<HTMLElement>("input, textarea, select, button, [tabindex]")
    // `preventScroll`: the panel is a scroll container, and letting the browser
    // scroll a just-focused field into view would jump the list under the cursor.
    //
    // `focusControl` rather than `focus`, and this is the call that made the
    // helper necessary: forcing focus here is what put a keyboard ring on every
    // control the user CLICKED, because an engine reads a script focus as one
    // it cannot account for and keeps the ring to be safe. See `core/focus`.
    focusControl(focusable, { preventScroll: true })
  }

  const types = ["pointerdown", "mousedown", "click", "pointerup", "mouseup", "dblclick"]
  for (const type of types) window.addEventListener(type, declaw, true)
  return () => {
    for (const type of types) window.removeEventListener(type, declaw, true)
  }
}

/**
 * Who wants to know when the app area changes width.
 *
 * The two panel flags are store state and anything can subscribe to them, but
 * the WIDTHS deliberately are not: a seam drag moves them on every frame and
 * routing that through the store would wake every lane in the editor on every
 * pointermove (see the note on the subscription in `mountShell`). So the one
 * fact a floating surface actually needs — "the edges moved, re-check yourself"
 * — is published here instead, already filtered by `resize.ts` down to the
 * frames where the reported inset really changed.
 *
 * Module-level rather than on `Shell`, because the lanes that care install
 * after `mountShell` returns and would otherwise each have to be handed it.
 */
const insetListeners = new Set<() => void>()

export function onInsetsChange(fn: () => void): () => void {
  insetListeners.add(fn)
  return () => insetListeners.delete(fn)
}

export function mountShell(): Shell {
  if (!document.getElementById(STYLE_ID)) {
    const style = el("style", { id: STYLE_ID })
    style.textContent = shellCss
    document.head.append(style)
  }

  const overlay = el("div", { class: "de-overlay-layer" })
  const toolbar = el("div", { class: "de-toolbar", role: "toolbar", "aria-label": "DesignLayer" })

  const left = el("div", { class: "de-panel-body" })
  const leftPanel = el("aside", { class: "de-panel de-panel--left", "aria-label": "Layers" }, [left])

  const right = el("div", { class: "de-panel-body" })
  const rightPanel = el(
    "aside",
    { class: "de-panel de-panel--right", "aria-label": "Inspector" },
    [right]
  )

  /*
   * The way back, mounted with everything else rather than on demand.
   *
   * It has to exist before it is needed: its entrance is a CSS transition off
   * the state class, and an element created in the same frame the class lands
   * has no previous value to transition FROM — it would simply appear. Parked
   * at the end of its own exit (see `css/launcher.ts`) it is inert and
   * untabbable until the editor actually stands down.
   */
  const launcher = createLauncher(() => setState({ chromeHidden: false, hovered: null }))

  /*
   * The panels stop being two independent slabs and become a row.
   *
   * `mountPanelResize` takes the two elements built above, puts them either
   * side of an empty canvas box in a flex rail, and hangs a draggable seam on
   * each inner edge. Nothing about how either panel LOOKS is decided there —
   * the widths it writes are the same two numbers the stylesheet already had,
   * until the user moves one. See `resize.ts` for why the library's core is
   * wired by hand rather than through its React adapter.
   */
  const resize = mountPanelResize({
    left: leftPanel,
    right: rightPanel,
    onResize: () => syncInsets(),
    onClose: (side) =>
      setState(side === "left" ? { layersOpen: false } : { inspectorOpen: false }),
  })

  const root = el("div", { class: "de-root" }, [
    overlay,
    toolbar,
    resize.rail,
    launcher.element,
  ])
  document.body.append(root)
  document.documentElement.classList.add("designlayer-active")
  // Before the focus guard, not after: the guard forces focus from its own
  // window-capture listener, and it has to read a modality that is already this
  // gesture's rather than the last one's.
  const releaseFocusModality = installFocusModality()
  const releaseChromeFocus = restoreChromeFocus()

  /**
   * Which panels exist right now. Separate from the insets below, because a
   * panel opening or closing changes how much room the OTHER one may take —
   * so this has to settle before anything reads a width back out.
   */
  const syncPanels = () => {
    const { layersOpen, inspectorOpen } = getState()
    resize.setOpen("left", layersOpen)
    resize.setOpen("right", inspectorOpen)
  }

  /*
   * The app's inset changes in ONE step, at the moment of the click, while the
   * panels are still covering the ground they are about to leave.
   *
   * The alternative is animating the inset, and it is the wrong one. The inset
   * is padding on `<html>`; transitioning it relayouts the entire app on every
   * frame of a 240ms slide, and the app is precisely what the user asked to
   * see. So the layout moves once and the motion is carried by transforms,
   * which is the trade the whole feature is built around: the panels slide
   * over an app that has already finished resizing.
   *
   * A DRAG is the one exception, and it is `resize.ts` that draws the line
   * rather than this function: while the user is holding a seam, `inset()`
   * reports the live width and the app reflows with it, because a panel you can
   * pull whose page does not follow is not a resize — it is a preview that
   * commits on release. Every other frame still reports the destination, so
   * folds and window resizes keep the one-step behaviour above.
   */
  const syncInsets = () => {
    const { chromeHidden } = getState()
    const style = document.documentElement.style
    // The panels are docked, so the inset is the panel and nothing else. It
    // used to add a gutter on both sides of each one, which is what left a
    // strip of live app showing down the outside edge of a floating card.
    // A closed panel reports zero, so "is it open" is already in these two.
    const left = chromeHidden ? 0 : resize.inset("left")
    const right = chromeHidden ? 0 : resize.inset("right")
    style.setProperty("--de-left", `${left}px`)
    style.setProperty("--de-right", `${right}px`)
    style.setProperty("--de-top", "0px")

    /*
     * The toolbar centres on a second pair that IGNORES hiding.
     *
     * The bar is centred in the canvas — the strip between the two insets —
     * and the insets go to zero the instant the chrome is hidden. Sharing one
     * pair meant the bar re-centred on the viewport in the same frame the hide
     * began: a 10px sideways jump at full opacity, before the fade had started.
     * Invisible while the bar was also dropping off the bottom, obvious the
     * moment the drop was replaced by a fade.
     *
     * Holding the panel-open values through the hide keeps the bar where it
     * was while it fades out, and means it fades back in already in place —
     * there is nothing to re-centre, because it never moved. Where an unseen
     * bar "is" does not otherwise matter.
     */
    style.setProperty("--de-bar-left", `${resize.inset("left")}px`)
    style.setProperty("--de-bar-right", `${resize.inset("right")}px`)
    // The host's docked panel (Leva here) sits against the right edge; keep it
    // clear of the inspector. The property name is the host's to choose.
    style.setProperty(config.chrome.dockedPanel.offsetVar, right ? `-${right}px` : "0px")
    /*
     * Announced AFTER the properties are written, so a listener that clamps
     * itself against them reads this frame's edges rather than the last one's.
     *
     * The bar's clamp reads these two inline values directly (see `edge` in
     * `shell/launcher.ts`), which is only exact because of this ordering.
     */
    for (const listener of insetListeners) listener()
  }

  // The mode as a class, because one thing about it is CSS's to answer: whether
  // the app's `pointer-events: none` glyphs are hit-testable (see base.ts).
  // Hidden chrome answers the same as interactive mode here — it is the same
  // claim, that the editor is not standing between the pointer and the app.
  const syncMode = () => {
    document.documentElement.classList.toggle("designlayer-inspecting", editorOwnsInput())
  }

  /*
   * The whole hide/show transition is a class, and this is the line that
   * flips it.
   *
   * Every surface reads it from CSS — the panels slide off their own edges,
   * the toolbar fades out where it stands, the disc shows up in its corner.
   * Nothing here schedules or sequences any of that: a timer driving three
   * surfaces is a timer that can be interrupted halfway by a second click, and
   * transitions retarget from wherever they are, which is the behaviour a
   * toggle needs.
   */
  const syncChrome = () => {
    document.documentElement.classList.toggle(
      "designlayer-chrome-hidden",
      getState().chromeHidden
    )
  }


  syncPanels()
  /*
   * After `syncInsets` exists, not at the point the rail is appended.
   *
   * `ready` fits the stored widths to the real window, and fitting can move a
   * width — which calls back into `onResize`, which is `syncInsets`. Calling it
   * up at the `append` would reach that binding inside its own temporal dead
   * zone, and the throw takes the rest of `mountShell` with it: the vendor
   * chrome suppression, the focus restoration and the store subscription all
   * sit below it. Measured exactly that way — the editor mounted with no insets
   * and the vendor's own panels showing through.
   */
  resize.ready()
  syncInsets()
  syncMode()
  syncChrome()
  // Only the panel toggles and the hide switch move the insets, and only the
  // mode switch and the hide switch move the mode. `hovered` changes on every
  // pointermove, so an unguarded subscription would write inline custom
  // properties — and force a style recalc of the whole app — on mouse motion.
  //
  // A drag does not come through here at all: the widths it moves are not
  // editor state, and routing them through the store would wake every lane
  // subscribed to it on every frame of a gesture. The resize lane calls
  // `syncInsets` directly instead.
  const unsubscribe = subscribe((next, previous) => {
    const hiddenChanged = next.chromeHidden !== previous.chromeHidden
    if (next.interactive !== previous.interactive || hiddenChanged) syncMode()
    if (hiddenChanged) syncChrome()
    if (
      !hiddenChanged &&
      next.layersOpen === previous.layersOpen &&
      next.inspectorOpen === previous.inspectorOpen
    ) {
      return
    }
    syncPanels()
    syncInsets()
  })

  return {
    slots: { overlay, toolbar, left, right },
    root,
    destroy() {
      unsubscribe()
      releaseChromeFocus()
      releaseFocusModality()
      resize.destroy()
      launcher.destroy()
      root.remove()
      document.documentElement.classList.remove("designlayer-active")
      document.documentElement.classList.remove("designlayer-inspecting")
      document.documentElement.classList.remove("designlayer-chrome-hidden")
      document.documentElement.style.removeProperty("--de-left")
      document.documentElement.style.removeProperty("--de-right")
      document.documentElement.style.removeProperty("--de-top")
      document.documentElement.style.removeProperty("--de-bar-left")
      document.documentElement.style.removeProperty("--de-bar-right")
      document.documentElement.style.removeProperty(config.chrome.dockedPanel.offsetVar)
      document.getElementById(STYLE_ID)?.remove()
    },
  }
}
