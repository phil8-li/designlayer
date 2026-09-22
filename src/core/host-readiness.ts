/**
 * Waits until the host framework has claimed the DOM.
 *
 * The editor is injected outside the app, so it cannot use a host component's
 * effect as a readiness signal. Next's `afterInteractive` contract also allows
 * a script to run after only part of the page has hydrated. Each framework does
 * leave a mark on the elements it owns, and that mark is the narrow signal we
 * need before changing attributes on `<html>` or adding editor chrome to
 * `<body>`.
 *
 *   React   — a Fiber/props expando on every claimed host element.
 *   Angular — `ng-version` on the element it bootstrapped into.
 *
 * Asking the wrong question is not a harmless miss: nothing in an Angular page
 * ever grows a `__reactFiber$`, so the poll below ran to its full ten-second
 * timeout on EVERY load and the editor appeared ten seconds after the app did.
 * It worked, so it never failed a test — it was just slow enough to feel broken.
 */

import { config } from "./config"

const REACT_HOST_PREFIXES = ["__reactFiber$", "__reactProps$"]
const MAX_ELEMENTS_TO_SCAN = 128
const DEFAULT_TIMEOUT_MS = 10_000

function isEditorTree(element: Element): boolean {
  return (
    element.matches("[data-designlayer], #react-rewrite-root, nextjs-portal") ||
    Boolean(element.closest("[data-designlayer], #react-rewrite-root, nextjs-portal"))
  )
}

function hasReactHostMarker(element: Element): boolean {
  return Object.getOwnPropertyNames(element).some((name) =>
    REACT_HOST_PREFIXES.some((prefix) => name.startsWith(prefix))
  )
}

/**
 * Angular stamps `ng-version` on the element it bootstrapped into, once, at the
 * end of bootstrap — the same "this subtree is mine now" claim React's expando
 * makes, and it arrives at the same moment in the page's life.
 */
function hasAngularHostMarker(element: Element): boolean {
  return element.hasAttribute("ng-version")
}

function markerFor(framework: string): (element: Element) => boolean {
  return framework === "angular" ? hasAngularHostMarker : hasReactHostMarker
}

/** True once a host-owned element has been hydrated or client-rendered. */
export function hasHydratedReactHost(
  root: Document = document,
  framework: string = config.host.framework
): boolean {
  const claimed = markerFor(framework)
  const queue: Element[] = [root.documentElement]

  for (let index = 0; index < queue.length && index < MAX_ELEMENTS_TO_SCAN; index += 1) {
    const element = queue[index]
    if (isEditorTree(element)) continue
    if (claimed(element)) return true
    queue.push(...element.children)
  }

  return false
}

function afterTwoPaints(resolve: () => void): void {
  requestAnimationFrame(() => requestAnimationFrame(resolve))
}

/**
 * Resolves after the host framework claims its markup and two paint turns pass.
 * The bounded fallback keeps the editor available if a framework changes its
 * private marker; by then the document has long since finished loading.
 */
export function whenHostHydrated(timeoutMs = DEFAULT_TIMEOUT_MS): Promise<void> {
  return new Promise((resolve) => {
    const started = performance.now()

    const poll = () => {
      if (hasHydratedReactHost() || performance.now() - started >= timeoutMs) {
        afterTwoPaints(resolve)
        return
      }
      requestAnimationFrame(poll)
    }

    poll()
  })
}
