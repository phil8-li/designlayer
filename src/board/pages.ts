/**
 * Which pages go on the board.
 *
 * Two sources, because neither is enough alone. The server reads the app's
 * router (`GET <apiBase>/pages`) and knows every route, including the ones no
 * link on this page points at — but it cannot turn `/posts/[id]` into a page
 * anybody can look at. The live document's links are concrete URLs the app
 * itself renders, so they fill in exactly the dynamic routes the server has to
 * leave blank. A route that is only a pattern, with no link to make it real,
 * is dropped rather than guessed at.
 *
 * The endpoint may not exist (an older runtime, a host with no router we can
 * read), so any failure there is "no routes" and the links carry the board.
 */

import { CHROME_ATTR } from "../core/dom"

export interface RouteInfo {
  path: string
  file?: string
  dynamic?: boolean
}

export interface PageEntry {
  path: string
  /** The source file the route resolves to, when the server knew it. */
  file?: string
}

/** The board shows at most this many pages; past it a grid stops being a map. */
export const MAX_PAGES = 16

/** Links to these are downloads, not pages. */
const FILE_EXTENSION =
  /\.(pdf|png|jpe?g|gif|webp|avif|svg|ico|zip|gz|tgz|rar|7z|dmg|exe|mp3|mp4|mov|webm|wav|csv|xlsx?|docx?|pptx?|txt|json|xml|woff2?|ttf|js|css|map)$/i

/** `[id]`, `[...slug]`, `:id`, `$id` — Next, React Router / Angular, Remix / TanStack. */
const DYNAMIC_SEGMENT = /^(\[.+\]|:.+|\$.*)$/

/** Drops hash and query, and a trailing slash anywhere but the root. */
export function normalizePath(pathname: string): string {
  let path = pathname.split("#")[0].split("?")[0] || "/"
  if (!path.startsWith("/")) path = `/${path}`
  path = path.replace(/\/{2,}/g, "/")
  if (path.length > 1 && path.endsWith("/")) path = path.replace(/\/+$/, "") || "/"
  return path
}

export function isDynamicPattern(path: string): boolean {
  return path.split("/").some((segment) => DYNAMIC_SEGMENT.test(segment))
}

/** A dynamic route as a matcher for concrete paths. */
function patternMatcher(pattern: string): RegExp {
  const parts = normalizePath(pattern)
    .split("/")
    .map((segment) => {
      if (/^\[\[?\.\.\..+\]?\]$/.test(segment)) return ".+"
      if (DYNAMIC_SEGMENT.test(segment)) return "[^/]+"
      return segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    })
  return new RegExp(`^${parts.join("/")}$`)
}

/**
 * Same-origin page links in the live document, normalized, in document order.
 * The editor's own chrome is skipped: its anchors are about the editor.
 */
export function collectLinkPaths(doc: Document, origin: string): string[] {
  const paths: string[] = []
  for (const anchor of Array.from(doc.querySelectorAll<HTMLAnchorElement>("a[href]"))) {
    if (anchor.closest(`[${CHROME_ATTR}]`)) continue
    if (anchor.target === "_blank" || anchor.hasAttribute("download")) continue
    let url: URL
    try {
      url = new URL(anchor.getAttribute("href") ?? "", doc.baseURI || origin)
    } catch {
      continue
    }
    if (url.origin !== origin) continue
    if (FILE_EXTENSION.test(url.pathname)) continue
    paths.push(normalizePath(url.pathname))
  }
  return paths
}

/** The server's route table, or none. Never throws. */
export async function fetchRoutes(
  apiBase: string,
  fetchImpl: typeof fetch | undefined = globalThis.fetch
): Promise<RouteInfo[]> {
  if (typeof fetchImpl !== "function") return []
  try {
    const response = await fetchImpl(`${apiBase}/pages`, { headers: { accept: "application/json" } })
    if (!response.ok) return []
    const body = (await response.json()) as { routes?: unknown }
    if (!Array.isArray(body?.routes)) return []
    return body.routes
      .filter((route): route is RouteInfo => typeof route?.path === "string")
      .map((route) => ({
        path: route.path,
        file: typeof route.file === "string" ? route.file : undefined,
        dynamic: Boolean(route.dynamic),
      }))
  } catch {
    return []
  }
}

/**
 * One ordered list: the current page first, then the router's static routes,
 * then links the router did not list. Dynamic routes appear only through a
 * concrete link, which inherits the route's file.
 */
export function mergePages(options: {
  routes: readonly RouteInfo[]
  links: readonly string[]
  current: string
  cap?: number
}): PageEntry[] {
  const cap = options.cap ?? MAX_PAGES
  const current = normalizePath(options.current)
  const statics = new Map<string, string | undefined>()
  const dynamics: Array<{ match: RegExp; file?: string }> = []
  for (const route of options.routes) {
    if (route.dynamic || isDynamicPattern(route.path)) {
      dynamics.push({ match: patternMatcher(route.path), file: route.file })
    } else {
      const path = normalizePath(route.path)
      if (!statics.has(path)) statics.set(path, route.file)
    }
  }
  const fileFor = (path: string): string | undefined => {
    if (statics.has(path)) return statics.get(path)
    return dynamics.find((entry) => entry.match.test(path))?.file
  }

  const seen = new Set<string>()
  const pages: PageEntry[] = []
  const add = (path: string) => {
    if (seen.has(path) || pages.length >= cap) return
    // A link can itself be a pattern when an app renders its route table
    // literally; that is no more viewable than the route was.
    if (isDynamicPattern(path)) return
    seen.add(path)
    const file = fileFor(path)
    pages.push(file ? { path, file } : { path })
  }
  add(current)
  for (const path of statics.keys()) add(path)
  for (const link of options.links) add(normalizePath(link))
  return pages
}

/** Everything above, against the live page. Never throws. */
export async function loadPages(options: {
  apiBase: string
  doc?: Document
  location?: Pick<Location, "origin" | "pathname">
  fetch?: typeof fetch
  cap?: number
}): Promise<PageEntry[]> {
  const doc = options.doc ?? document
  const location = options.location ?? window.location
  const routes = await fetchRoutes(options.apiBase, options.fetch)
  let links: string[] = []
  try {
    links = collectLinkPaths(doc, location.origin)
  } catch (error) {
    console.warn("[designlayer]", error)
  }
  return mergePages({ routes, links, current: location.pathname, cap: options.cap })
}
