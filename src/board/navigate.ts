/**
 * Moving the LIVE document to another page, without a reload when the app can
 * do it.
 *
 * By the time this runs the board is showing that page's frame at exactly the
 * canvas rect, so whatever the live document does underneath is hidden until
 * the board fades. A client-side route change is worth reaching for, because a
 * full reload throws away the app's state and the editor with it — and costs a
 * second or more of boot on the way back.
 *
 * In order:
 *
 *  1. Next's router, when the page exposes one (`window.next.router`, the Pages
 *     Router). Seen to work when the pathname arrives.
 *  2. `history.pushState` plus a `popstate`, which is how React Router, Angular
 *     and hand-rolled routers hear about a URL they did not change themselves.
 *     The URL moves either way, so this attempt is only believed when the PAGE
 *     changes — the app's text differs from what it was a moment ago.
 *  3. `location.assign`, where paint holding keeps the full-size frame on
 *     screen until the new document paints.
 *
 * Clicking one of the app's own links is NOT on the list, though every client
 * router intercepts its anchors. While the board is up the editor is not
 * intercepting the page, and in that state the shell's `restoreChromeFocus`
 * declaws every event aimed at the app so the vendor's guard cannot swallow it
 * — which also takes `preventDefault` away from the app's own click handler.
 * The router would route AND the browser would follow the href: a reload with
 * extra steps.
 *
 * The window, the clock and the frame scheduler are injected so the order can
 * be pinned without a browser.
 */

import { CHROME_ATTR } from "../core/dom"
import { normalizePath } from "./pages"

export type NavigateStrategy = "router" | "popstate" | "assign"

export interface NavigateWindow {
  next?: { router?: { push?: (path: string) => unknown } }
  location: { pathname: string; origin: string; assign(url: string): void }
  history?: { pushState(data: unknown, unused: string, url?: string): void }
  document: Document
  scrollTo(x: number, y: number): void
  dispatchEvent?(event: Event): boolean
  PopStateEvent?: typeof PopStateEvent
}

export interface NavigateEnv {
  window: NavigateWindow
  /** Resolves on the next frame. */
  frame?: () => Promise<void>
  now?: () => number
  /** How long the router may take to change the pathname. */
  timeoutMs?: number
  /** How long a `popstate` may take to change the page. */
  popstateTimeoutMs?: number
}

export const NAVIGATE_TIMEOUT_MS = 2500
export const POPSTATE_TIMEOUT_MS = 1200

const nextFrame = (): Promise<void> =>
  new Promise((resolve) => requestAnimationFrame(() => resolve()))

/**
 * What the app is showing, as text: every top-level node that is not ours.
 *
 * The test for "the router took the popstate". A route change nearly always
 * changes what the page says; a router that ignored the event leaves every word
 * where it was. Capped, because it is read once before and then once per frame.
 */
export function appText(doc: Document): string {
  let text = ""
  for (const node of Array.from(doc.body?.children ?? [])) {
    if (node.matches(`[${CHROME_ATTR}], script, style, template, noscript, iframe`)) continue
    const element = node as HTMLElement
    text += typeof element.innerText === "string" ? element.innerText : element.textContent ?? ""
    if (text.length > 20000) break
  }
  return text
}

async function arrived(env: Required<NavigateEnv>, path: string): Promise<boolean> {
  const want = normalizePath(path)
  const start = env.now()
  while (env.now() - start < env.timeoutMs) {
    if (normalizePath(env.window.location.pathname) === want) return true
    await env.frame()
  }
  return normalizePath(env.window.location.pathname) === want
}

async function pageChanged(env: Required<NavigateEnv>, before: string): Promise<boolean> {
  const start = env.now()
  while (env.now() - start < env.popstateTimeoutMs) {
    await env.frame()
    if (appText(env.window.document) !== before) return true
  }
  return false
}

/**
 * Takes the live document to `path`, and reports how. Resolves after the new
 * route has rendered for two frames, scrolled to the top — or right after
 * `location.assign`, when the document is about to go away anyway.
 */
export async function navigateLive(path: string, input: NavigateEnv): Promise<NavigateStrategy> {
  const env: Required<NavigateEnv> = {
    frame: nextFrame,
    now: () => performance.now(),
    timeoutMs: NAVIGATE_TIMEOUT_MS,
    popstateTimeoutMs: POPSTATE_TIMEOUT_MS,
    ...input,
  }
  const win = env.window

  const push = win.next?.router?.push
  if (typeof push === "function") {
    try {
      const result = push.call(win.next!.router, path)
      if (result && typeof (result as Promise<unknown>).catch === "function") {
        ;(result as Promise<unknown>).catch((error) => console.warn("[designlayer]", error))
      }
      if (await arrived(env, path)) return settle(env, "router")
    } catch (error) {
      console.warn("[designlayer]", error)
    }
    // A router that did not arrive is not given a popstate on top: two routers'
    // worth of navigation racing is worse than one reload.
    win.location.assign(path)
    return "assign"
  }

  const Popstate = win.PopStateEvent ?? (typeof PopStateEvent === "function" ? PopStateEvent : undefined)
  if (win.history && typeof win.dispatchEvent === "function" && Popstate) {
    try {
      const before = appText(win.document)
      win.history.pushState(null, "", path)
      win.dispatchEvent(new Popstate("popstate", { state: null }))
      if (await pageChanged(env, before)) return settle(env, "popstate")
    } catch (error) {
      console.warn("[designlayer]", error)
    }
  }

  // Nothing routed: the URL may already say `path` while the page does not, so
  // load it for real.
  win.location.assign(path)
  return "assign"
}

async function settle(env: Required<NavigateEnv>, strategy: NavigateStrategy): Promise<NavigateStrategy> {
  try {
    env.window.scrollTo(0, 0)
  } catch {
    // A page that forbids scrolling still navigated.
  }
  await env.frame()
  await env.frame()
  return strategy
}
