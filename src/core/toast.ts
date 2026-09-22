/**
 * The editor's toast. One surface, one owner, bottom-right.
 *
 * ---------------------------------------------------------------------------
 * WHY THERE IS A REACT ROOT IN A CODEBASE THAT SAYS THERE ISN'T
 *
 * `core/dom.ts` opens by stating that the overlay is plain DOM on purpose,
 * because a second React tree would fight the app's own reconciler and its
 * Motion layout animations. That reason is about rendering CHROME INTO THE
 * APP'S DOCUMENT TREE, where two reconcilers end up arguing over the same
 * nodes. It does not reach this file:
 *
 *   - This root is mounted on a shadow root hung off `<body>`, outside every
 *     element the app renders. React roots are independent of one another;
 *     nothing here ever touches a node the app's reconciler owns.
 *   - It renders one component that renders a list of strings. There is no
 *     shared element, no layout animation, and no hand-off.
 *
 * The rest of the chrome stays plain DOM, and a second component arriving here
 * would be the signal that this exception has stopped being one.
 *
 * ---------------------------------------------------------------------------
 * WHY EVERY TOAST IN THE SYSTEM COMES THROUGH HERE
 *
 * Before this file there were two toasts and they did not look alike. Ours went
 * `context.toast` -> `bridge.toast` -> the vendor's `V`, which sets the text on
 * one fixed `div` at bottom-left, ignores the `kind` argument outright, and
 * clears it after two seconds — so the 40-odd `"…", "error"` call sites in this
 * package rendered exactly like the success ones. The vendor also calls `V`
 * from inside its own bundle, for socket failures we never see the source of.
 *
 * Both are funnelled here:
 *
 *   - Ours, by `core/bridge.ts` replacing `toast` on the bridge it hands out.
 *     Every `context.toast` and every `bridge.toast` in the package lands on
 *     `notify` without a single call site changing, and `kind` survives.
 *   - The vendor's, by `mirrorVendorToasts` below, which watches the node `V`
 *     writes into and re-emits what it says. The node itself is suppressed with
 *     the rest of the vendor chrome (`css/base.ts`), so it is observed rather
 *     than seen.
 *
 * Nothing double-fires: with the bridge wrapped, our calls never reach `V`, so
 * the mirror only ever sees messages the vendor raised on its own.
 */

import { createElement, Fragment, useEffect, type CSSProperties } from "react"
import { createRoot, type Root } from "react-dom/client"
import { Toaster, toast as sonner } from "sonner"

import { toasterCss } from "./css/toast"
import { CHROME_ATTR } from "./dom"
import { tokens as t } from "./tokens"

export type ToastKind = "info" | "error"

const HOST_ID = "designlayer-toaster"

/**
 * Four seconds for news, six for a failure.
 *
 * The vendor used two for everything, which is too short for the longest thing
 * the editor says — "Applied 3 changes — width, height is preview only" is 48
 * characters past the point where two seconds is a glimpse. Errors get longer
 * still because they are the ones that name something the reader has to act on,
 * and `css/lint.ts` already documents the standing rule that anything needing
 * to OUTLIVE the glance belongs on a surface rather than in a toast.
 */
const DURATION: Record<ToastKind, number> = { info: 4000, error: 6000 }

/** Stacked beyond this and the newest is behind two cards nobody can read. */
const VISIBLE_TOASTS = 3

interface Mounted {
  host: HTMLElement
  shadow: ShadowRoot
  root: Root
}

let mounted: Mounted | null = null
let ready = false
/** Raised before the Toaster's subscription exists. Drained once, in order. */
const pending: Array<[string, ToastKind]> = []

function emit(message: string, kind: ToastKind): void {
  // `sonner.error` rather than an option, because the type is what selects the
  // glyph and the rich colouring — see the `--error-*` block in `css/toast.ts`.
  if (kind === "error") sonner.error(message, { duration: DURATION.error })
  else sonner(message, { duration: DURATION.info })
}

/**
 * Says when Sonner is listening, from inside React's own effect ordering.
 *
 * Sonner subscribes to its store from a `useEffect`, which React runs after
 * paint — so a message raised in the same tick as the mount has nobody
 * listening and is dropped without a trace. Something has to mark the moment
 * that subscription exists.
 *
 * The obvious probe is to poll the DOM for `[data-sonner-toaster]`, and it is
 * WRONG in a way worth recording, because it looks like it works: that element
 * is the `<ol>`, and Sonner returns `null` for it while there are no toasts
 * (`index.mjs`, `if (!filteredToasts.length) return null`). So the list exists
 * only once a toast is showing, a toast can only show once we believe we are
 * ready, and the probe never fires. Measured exactly that way — the queue held
 * every message forever and the corner stayed empty.
 *
 * Rendered as the Toaster's NEXT SIBLING instead. React flushes passive effects
 * in tree order, so everything inside `<Toaster>` — its store subscription
 * included — has run by the time this one does. That is a guarantee about
 * ordering rather than about timing, which is what makes it exact where a
 * frame budget was only ever a guess.
 */
function ReadyGate(): null {
  useEffect(() => {
    ready = true
    for (const [message, kind] of pending.splice(0)) emit(message, kind)
  }, [])
  return null
}

/**
 * Mounts the toaster. Idempotent, and cheap enough to call from `notify`.
 *
 * Called from `index.ts` at boot so the subscription is long settled before the
 * first message, and defensively from `notify` so that a toast raised by a lane
 * that somehow ran first is queued rather than lost.
 */
export function installToaster(): () => void {
  if (mounted) return destroy

  const host = document.createElement("div")
  host.id = HOST_ID
  // The chrome marker, and it is load-bearing rather than decorative: the
  // vendor guards `document` against gestures that are not its own, and
  // `shell.ts` only declaws that guard for elements under this attribute. It
  // is what lets a toast be swiped away and an action button be clicked.
  host.setAttribute(CHROME_ATTR, "")

  const shadow = host.attachShadow({ mode: "open" })
  const style = document.createElement("style")
  style.textContent = toasterCss
  const mountPoint = document.createElement("div")
  shadow.append(style, mountPoint)
  document.body.append(host)

  const root = createRoot(mountPoint)
  root.render(
    createElement(Fragment, null, [
      createElement(Toaster, {
        key: "toaster",
        /*
         * Bottom-LEFT, and the corner is the whole reason to say so.
         *
         * Bottom-right is the launcher's — `css/launcher.ts` pins the disc
         * there at a 32px inset, and it is the one control that must stay
         * findable, because it is the only way back once the chrome is hidden.
         * A stack of up to three cards landing on top of it would cover the
         * exit. Bottom-left is clear: the toolbar is centred in the canvas and
         * floats above this line, and both panels are docked to the edges
         * rather than the corners.
         */
        position: "bottom-left",
        // The same inset the panels are docked with, so the toast lines up with
        // the chrome rather than floating at some arbitrary margin.
        offset: t.size.panelInset,
        gap: t.space.md,
        visibleToasts: VISIBLE_TOASTS,
        // Off, deliberately. A toast this short is read in one glance and gone
        // before a close button could be aimed at; swipe and click still dismiss.
        closeButton: false,
        // Typed toasts get their signal colour from the tokens rather than from
        // Sonner's built-in palettes. Untyped ones — every `kind: "info"` call —
        // are unaffected and stay the plain chrome card.
        richColors: true,
        /*
         * Narrower than Sonner's 356px default: this is tool chrome standing
         * beside a 260px inspector, and a card wider than the panel it reports
         * on reads as the app talking rather than the editor.
         *
         * Set here rather than in the stylesheet because Sonner writes
         * `--width` INLINE on the section, where nothing in a stylesheet can
         * reach it — the prop spread puts `style` last, so this is the one
         * place the value wins. The cast is the standard one for a custom
         * property in `CSSProperties`.
         */
        style: { "--width": "300px" } as CSSProperties,
      }),
      // After the Toaster, and the order is the mechanism — see `ReadyGate`.
      createElement(ReadyGate, { key: "ready" }),
    ])
  )

  mounted = { host, shadow, root }
  return destroy
}

function destroy(): void {
  if (!mounted) return
  const { host, root } = mounted
  mounted = null
  ready = false
  pending.length = 0
  // Unmounting synchronously from inside a React lifecycle throws; nothing here
  // runs from one, but the deferral costs nothing and removes the question.
  setTimeout(() => root.unmount())
  host.remove()
}

/**
 * Say something. The one entry point — see the header for who reaches it.
 */
export function notify(message: string, kind: ToastKind = "info"): void {
  const text = message.trim()
  if (!text) return
  installToaster()
  if (ready) {
    emit(text, kind)
    return
  }
  pending.push([text, kind])
}

/*
 * ---------------------------------------------------------------------------
 * The vendor's own toasts
 * ---------------------------------------------------------------------------
 */

/** The class the vendor puts on the single `div` its `V` writes into. */
const VENDOR_TOAST = ".toast"
/** The class `V` adds to show it, and removes on its own two-second timer. */
const VENDOR_VISIBLE = "visible"

/**
 * Re-emits the vendor's toasts through ours, from the node it writes into.
 *
 * There is no seam to hook: `V` is a minified function inside a pinned bundle,
 * called from the vendor's own code paths, and the bridge patch exposes it
 * rather than wrapping it. The DOM it writes is the only thing both sides can
 * see, so that is what is watched.
 *
 * Three mutations matter and they do not arrive together. `V` sets
 * `textContent` and then adds the visible class — which, for a toast raised
 * while an earlier one is still up, is a no-op that queues NO record at all,
 * because `DOMTokenList.add` does not touch an attribute whose token set is
 * unchanged. So the trigger cannot be the class alone: it is any mutation that
 * leaves the node visible with text that is new, or visible again after having
 * been hidden.
 */
export function mirrorVendorToasts(root: ShadowRoot): () => void {
  let lastText = ""
  let lastVisible = false

  const read = (): void => {
    const node = root.querySelector(VENDOR_TOAST)
    if (!node) return
    const text = (node.textContent ?? "").trim()
    const visible = node.classList.contains(VENDOR_VISIBLE)
    if (visible && text && (text !== lastText || !lastVisible)) notify(text)
    lastText = text
    lastVisible = visible
  }

  const observer = new MutationObserver(read)
  observer.observe(root, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["class"],
  })
  // The node is created by the vendor's own mount, which may be ahead of this
  // call or behind it; observing the ROOT rather than the node is what makes
  // both orders work, and this covers a toast already up when we arrived.
  read()

  return () => observer.disconnect()
}
