/**
 * DOM helpers for the overlay chrome.
 *
 * The overlay is plain DOM on purpose: it renders inside the same document as
 * the app, and mounting a second React tree there would fight the app's own
 * reconciler and Motion layout animations.
 */

import { config } from "./config"

export const CHROME_ATTR = "data-designlayer"

/**
 * The attribute Agentation marks its portal root with.
 *
 * Named here, beside our own mark, because two separate surfaces have to agree
 * on it and neither of them is the agentation lane: the hit-test below, which
 * must not offer the toolbar to the canvas, and `shell/shell.ts`, which must
 * drive input INTO it. A string literal in both places would be one rename away
 * from a toolbar that is half-trusted.
 *
 * It is a fact about somebody else's DOM, so it is stated once and not derived
 * from `config.agentation`: the attribute is on the page or it is not, and that
 * is a better question than whether a setting said it should be.
 */
export const AGENTATION_ROOT_ATTR = "data-agentation-root"

/**
 * The mark on a layer the user has deleted but the framework has not.
 *
 * A deleted element STAYS IN THE DOM until the source write lands and the app
 * re-renders without it. That is not a shortcut, it is the only thing that
 * works: detaching a node React rendered leaves its fibre pointing at a parent
 * that no longer owns it, and the next commit dies in `removeChild` with
 * `NotFoundError` and unmounts the tree. Measured exactly that way against a
 * live Vite app — the delete looked perfect, and the page went blank the moment
 * the file on disk changed and Fast Refresh ran.
 *
 * So the preview is `display: none` plus this mark, and the mark is what every
 * surface reads to treat the element as gone. It lives here, beside the chrome
 * marker, because it is the same kind of fact — a DOM-level statement about
 * what the editor's own machinery must ignore — and because putting it in
 * `core/writer` would make `core/resolve` import the writer just to ask.
 */
export const DELETED_ATTRIBUTE = "data-de-deleted"

/**
 * Our own shell, the vendor root and the annotation toolbar are structural —
 * they exist in every host this editor is loaded into — so they stay literal.
 * Everything else the host wants excluded (its dev GUI, its debug bars) arrives
 * from `chrome.trustedSelectors` in the config.
 *
 * `[data-agentation-root]` is listed unconditionally, though the toolbar is a
 * setting that can be off. A selector matching nothing costs nothing, and
 * deriving the list from `config.agentation.enabled` would make the hit-test
 * consult a setting to answer a question that is really about the DOM: if that
 * attribute is on the page, whatever is under it is not the app.
 *
 * An empty host list is legal and documented, so the parts are filtered before
 * joining: a trailing comma is not a valid selector, and `closest()` would then
 * throw on every hit-test rather than once at startup.
 */
const CHROME_SELECTOR = [
  `[${CHROME_ATTR}]`,
  "#react-rewrite-root",
  `[${AGENTATION_ROOT_ATTR}]`,
  config.chrome.trustedSelector,
]
  .filter((part) => part.length > 0)
  .join(",")

type Props = Record<string, string | number | boolean | EventListener | undefined>

/** Creates a chrome element. Handlers are any `on*` prop; the rest are attrs. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Props = {},
  children: Array<Node | string | null | undefined> = []
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  node.setAttribute(CHROME_ATTR, "")

  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === false) continue
    if (key.startsWith("on") && typeof value === "function") {
      node.addEventListener(key.slice(2).toLowerCase(), value as EventListener)
      continue
    }
    if (key === "class") {
      node.className = String(value)
      continue
    }
    if (key === "style") {
      node.setAttribute("style", String(value))
      continue
    }
    node.setAttribute(key, value === true ? "" : String(value))
  }

  for (const child of children) {
    if (child === null || child === undefined) continue
    node.append(typeof child === "string" ? document.createTextNode(child) : child)
  }

  return node
}

/** True when the node belongs to our chrome, the host's dev GUI, or the vendor. */
export function isChrome(node: EventTarget | null): boolean {
  if (!(node instanceof Element)) return false
  return Boolean(node.closest(CHROME_SELECTOR))
}

/**
 * True when the element is part of the app under edit (not chrome).
 *
 * `Element`, not `HTMLElement`: every lucide icon is an `SVGElement`, and under
 * a component-boundary model each one is an instance root. Narrowing here used
 * to make a click on an icon *clear* the selection and let the app navigate.
 * Read classes off these with `getAttribute("class")` — `SVGElement.className`
 * is an `SVGAnimatedString`, not a string.
 */
export function isCanvasElement(node: EventTarget | null): node is Element {
  if (!(node instanceof Element)) return false
  if (isChrome(node)) return false
  return node !== document.documentElement && node !== document.body
}

export function clear(node: Element): void {
  while (node.firstChild) node.removeChild(node.firstChild)
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** Rounds to at most `places` decimals and drops trailing zeroes. */
export function round(value: number, places = 2): number {
  const factor = 10 ** places
  return Math.round(value * factor) / factor
}
