/**
 * The host app's pages, discovered from its source tree for canvas mode.
 *
 * Canvas mode lays every route out as a same-origin iframe on a board, so it
 * needs a list of URLs before any of them has been visited. The only place that
 * list exists ahead of time is the source: Next's file conventions, or the path
 * literals a React Router or Angular route table declares. Nothing here runs the
 * app or evaluates its code; every strategy is a bounded read of files.
 *
 * Every failure degrades to fewer routes, never to an error. A folder macOS
 * refuses to list, a file that vanishes mid-walk, a tree far larger than any
 * app — each shrinks the answer, and the board still opens with what was found.
 * A route that exists but was missed costs one frame; a 500 costs the board.
 */

import fs from "node:fs"
import path from "node:path"

/** Guards on a hand-written tree, not product limits. */
export const MAX_WALKED_ENTRIES = 2000
export const MAX_ROUTES = 200
const MAX_SOURCE_BYTES = 256 * 1024

const SKIPPED_DIRECTORIES = new Set(["node_modules", ".next", "dist", "build", ".git", "out", "coverage"])
const PAGE_EXTENSIONS = new Set([".tsx", ".ts", ".jsx", ".js", ".mdx"])
const SCRIPT_EXTENSIONS = new Set([".tsx", ".ts", ".jsx", ".js"])

// Tie-break order for `framework`, and the order routes are merged in, so a
// path both Next routers declare is attributed to the app router.
const FRAMEWORKS = ["next-app", "next-pages", "react-router", "angular"]

const ROUTER_IMPORT = /\bfrom\s*["'](?:react-router|react-router-dom|@tanstack\/react-router)["']|\brequire\(\s*["'](?:react-router|react-router-dom|@tanstack\/react-router)["']\s*\)/
// `path: "/x"`, `path="/x"`, `path={"/x"}` — absolute literals only, since a
// relative child path cannot be placed without resolving its parent.
const ROUTER_PATH = /\bpath\s*(?::|=\s*\{?)\s*(["'`])(\/[^"'`\n]*)\1/g
// TanStack's file routes name their own path in the call.
const TANSTACK_FILE_ROUTE = /\bcreateFileRoute\(\s*(["'`])(\/[^"'`\n]*)\1/g
const ANGULAR_PATH = /\bpath\s*:\s*(["'`])([^"'`\n]*)\1/g

/**
 * A bounded, symlink-free, error-tolerant walk. `budget` is shared across every
 * walk in one `read()`, so the whole discovery touches at most
 * `MAX_WALKED_ENTRIES` entries however many roots it probes.
 */
function walk(root, budget, visit) {
  const pending = [root]
  while (pending.length > 0) {
    const directory = pending.pop()
    let entries
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true })
    } catch {
      // Unreadable, missing, or a guarded folder: fewer routes, not an error.
      continue
    }
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    for (const entry of entries) {
      if (budget.remaining <= 0) {
        budget.exhausted = true
        return
      }
      budget.remaining -= 1
      const full = path.join(directory, entry.name)
      // Dirent types never follow symlinks, so a link cycle cannot loop here.
      if (entry.isDirectory()) {
        if (entry.name.startsWith(".") || SKIPPED_DIRECTORIES.has(entry.name)) continue
        pending.push(full)
      } else if (entry.isFile()) {
        visit(full, entry.name)
      }
    }
  }
}

function isDirectory(target) {
  try {
    return fs.statSync(target).isDirectory()
  } catch {
    return false
  }
}

function readSource(file) {
  try {
    const stats = fs.statSync(file)
    if (stats.size > MAX_SOURCE_BYTES) return ""
    return fs.readFileSync(file, "utf8")
  } catch {
    return ""
  }
}

function toPosix(value) {
  return value.split(path.sep).join("/")
}

/** Collapses doubled slashes and drops a trailing one, keeping `/` itself. */
export function normalizeRoutePath(value) {
  const collapsed = `/${value}`.replace(/\/{2,}/g, "/")
  return collapsed.length > 1 ? collapsed.replace(/\/+$/, "") : collapsed
}

/** `[id]`, `[...slug]`, `[[...slug]]`, `:id`, and `$id` all name a parameter. */
export function isDynamicPath(routePath) {
  return routePath.split("/").some((segment) => /^\[.+\]$/.test(segment) || /^[:$]/.test(segment))
}

/**
 * Next only counts as the framework when the project depends on it. A Vite app
 * with a `src/pages/` folder of screen components is common, and reading those
 * as a Pages Router would fill the board with URLs that 404.
 */
function usesNext(projectRoot) {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, "package.json"), "utf8"))
    for (const field of ["dependencies", "devDependencies", "peerDependencies"]) {
      if (pkg?.[field] && Object.hasOwn(pkg[field], "next")) return true
    }
  } catch {
    // No readable manifest: fall through to the config-file check.
  }
  return ["next.config.js", "next.config.mjs", "next.config.ts", "next.config.cjs"].some((name) =>
    fs.existsSync(path.join(projectRoot, name))
  )
}

/**
 * App Router: a `page.*` file makes its folder a route. Route groups `(x)` add
 * no URL segment; private `_x`, parallel `@slot`, and intercepting `(.)x`
 * folders are not addressable pages of their own, so their subtrees are skipped.
 */
function nextAppRoutes(projectRoot, budget, add) {
  for (const base of ["app", "src/app"]) {
    const root = path.join(projectRoot, base)
    if (!isDirectory(root)) continue
    walk(root, budget, (file, name) => {
      const extension = path.extname(name)
      if (path.basename(name, extension) !== "page" || !PAGE_EXTENSIONS.has(extension)) return
      const segments = toPosix(path.relative(root, path.dirname(file))).split("/").filter(Boolean)
      const kept = []
      for (const segment of segments) {
        if (segment.startsWith("_") || segment.startsWith("@") || /^\(\.{1,3}\)/.test(segment)) return
        if (/^\(.*\)$/.test(segment)) continue
        kept.push(segment)
      }
      add("next-app", normalizeRoutePath(kept.join("/")), file)
    })
  }
}

/**
 * Pages Router: every page file is a route and `index` names its folder. `_app`,
 * `_document`, and other `_` files are framework hooks, `api/` is server-only,
 * and `404`/`500` are error pages nobody navigates to on purpose.
 */
function nextPagesRoutes(projectRoot, budget, add) {
  for (const base of ["pages", "src/pages"]) {
    const root = path.join(projectRoot, base)
    if (!isDirectory(root)) continue
    walk(root, budget, (file, name) => {
      const extension = path.extname(name)
      if (!PAGE_EXTENSIONS.has(extension) || name.endsWith(".d.ts")) return
      const segments = toPosix(path.relative(root, file)).slice(0, -extension.length).split("/")
      if (segments[0] === "api") return
      if (segments.some((segment) => segment.startsWith("_"))) return
      const last = segments.at(-1)
      if (segments.length === 1 && (last === "404" || last === "500")) return
      if (last === "index") segments.pop()
      add("next-pages", normalizeRoutePath(segments.join("/")), file)
    })
  }
}

/**
 * React Router and TanStack Router: absolute path literals in files that import
 * the router. Relative child paths and wildcards are left out — neither is a
 * URL on its own.
 */
function reactRouterRoutes(projectRoot, budget, add) {
  const root = path.join(projectRoot, "src")
  if (!isDirectory(root)) return
  walk(root, budget, (file, name) => {
    if (!SCRIPT_EXTENSIONS.has(path.extname(name)) || name.endsWith(".d.ts")) return
    const source = readSource(file)
    if (!ROUTER_IMPORT.test(source)) return
    for (const pattern of [ROUTER_PATH, TANSTACK_FILE_ROUTE]) {
      for (const match of source.matchAll(pattern)) {
        const literal = match[2]
        if (literal.includes("*") || literal.includes("${")) continue
        add("react-router", normalizeRoutePath(literal), file)
      }
    }
  })
}

/**
 * Angular: `path: 'x'` entries in route files. Angular paths are relative and
 * nesting is not resolved without an AST, so each entry is read as top-level;
 * `**` is the not-found catch-all and is skipped.
 */
function angularRoutes(projectRoot, budget, add) {
  const root = path.join(projectRoot, "src")
  if (!isDirectory(root)) return
  walk(root, budget, (file, name) => {
    if (!/(?:\.routes|-routing\.module)\.ts$/.test(name)) return
    const source = readSource(file)
    for (const match of source.matchAll(ANGULAR_PATH)) {
      const literal = match[2]
      if (literal.includes("*")) continue
      add("angular", normalizeRoutePath(literal), file)
    }
  })
}

function compareRoutes(a, b) {
  if (a.path === "/" || b.path === "/") return a.path === "/" ? -1 : b.path === "/" ? 1 : 0
  if (a.dynamic !== b.dynamic) return a.dynamic ? 1 : -1
  return a.path < b.path ? -1 : a.path > b.path ? 1 : 0
}

export function createPageCatalog(config) {
  const projectRoot = config.projectRoot

  return {
    /** Never throws: an unreadable project answers `unknown` with no routes. */
    read() {
      const budget = { remaining: MAX_WALKED_ENTRIES, exhausted: false }
      const found = Object.fromEntries(FRAMEWORKS.map((framework) => [framework, []]))
      const add = (framework, routePath, file) => {
        found[framework].push({
          path: routePath,
          file: toPosix(path.relative(projectRoot, file)),
          dynamic: isDynamicPath(routePath),
        })
      }

      try {
        if (usesNext(projectRoot)) {
          nextAppRoutes(projectRoot, budget, add)
          nextPagesRoutes(projectRoot, budget, add)
        }
        reactRouterRoutes(projectRoot, budget, add)
        angularRoutes(projectRoot, budget, add)
      } catch {
        // Discovery is best-effort; whatever was gathered before the fault stands.
      }

      const seen = new Set()
      const routes = []
      const counts = {}
      for (const framework of FRAMEWORKS) {
        counts[framework] = 0
        for (const route of found[framework]) {
          if (seen.has(route.path)) continue
          seen.add(route.path)
          counts[framework] += 1
          routes.push(route)
        }
      }

      let framework = "unknown"
      for (const candidate of FRAMEWORKS) {
        if (counts[candidate] > (counts[framework] ?? 0)) framework = candidate
      }

      routes.sort(compareRoutes)
      return {
        framework,
        routes: routes.slice(0, MAX_ROUTES),
        truncated: budget.exhausted || routes.length > MAX_ROUTES,
      }
    },
  }
}
