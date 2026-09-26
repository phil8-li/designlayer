/**
 * Cases for page discovery: the source-tree strategies canvas mode reads the
 * host app's routes from, their limits, and the loopback route that serves them.
 *
 * Every fixture is built in a temp directory at runtime rather than checked in:
 * a tree named `app/` or `pages/` under test/fixtures would itself look like a
 * Next project to any tool that walks this repo.
 *
 * Usage: node designlayer/test/pages-cases.mjs
 */

import assert from "node:assert/strict"
import fs from "node:fs"
import http from "node:http"
import os from "node:os"
import path from "node:path"

import { PACKAGE_DIR } from "./host.mjs"

const { createPageCatalog, MAX_ROUTES, MAX_WALKED_ENTRIES } = await import(
  path.join(PACKAGE_DIR, "server", "pages.mjs")
)
const { resolveConfig } = await import(path.join(PACKAGE_DIR, "config.mjs"))
const { createDesignLayerRoutes } = await import(path.join(PACKAGE_DIR, "server", "routes.mjs"))

let passed = 0
let failed = 0

function check(name, fn) {
  try {
    fn()
    passed += 1
    console.log(`  ok   ${name}`)
  } catch (error) {
    failed += 1
    console.log(`  FAIL ${name}\n       ${error.message}`)
  }
}

async function checkAsync(name, fn) {
  try {
    await fn()
    passed += 1
    console.log(`  ok   ${name}`)
  } catch (error) {
    failed += 1
    console.log(`  FAIL ${name}\n       ${error.message}`)
  }
}

const TEMP_ROOTS = []

/** A project tree from `{ "relative/path": "contents" }`. */
function project(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "designlayer-pages-"))
  TEMP_ROOTS.push(root)
  for (const [relative, contents] of Object.entries(files)) {
    const full = path.join(root, relative)
    fs.mkdirSync(path.dirname(full), { recursive: true })
    fs.writeFileSync(full, contents)
  }
  return root
}

function read(root) {
  return createPageCatalog({ projectRoot: root }).read()
}

function paths(result) {
  return result.routes.map((route) => route.path)
}

const NEXT_PACKAGE = JSON.stringify({ dependencies: { next: "15.0.0", react: "19.0.0" } })
const PAGE = "export default function Page() { return null }\n"

/* ---------- Next.js App Router ---------- */

console.log("\nNext App Router")

const appRoot = project({
  "package.json": NEXT_PACKAGE,
  "app/page.tsx": PAGE,
  "app/layout.tsx": PAGE,
  "app/about/page.tsx": PAGE,
  "app/(marketing)/pricing/page.tsx": PAGE,
  "app/(marketing)/page.mdx": PAGE,
  "app/blog/[slug]/page.tsx": PAGE,
  "app/docs/[...slug]/page.js": PAGE,
  "app/shop/[[...slug]]/page.jsx": PAGE,
  "app/@modal/login/page.tsx": PAGE,
  "app/feed/(.)photo/[id]/page.tsx": PAGE,
  "app/feed/(..)settings/page.tsx": PAGE,
  "app/feed/(...)root/page.tsx": PAGE,
  "app/feed/page.tsx": PAGE,
  "app/_components/page.tsx": PAGE,
  "app/api/users/route.ts": "export function GET() {}\n",
  "app/dashboard/components/card.tsx": PAGE,
  "node_modules/pkg/app/page.tsx": PAGE,
})

check("app router: groups stripped, private/parallel/intercepting skipped, dynamic marked", () => {
  const result = read(appRoot)
  assert.equal(result.framework, "next-app")
  assert.equal(result.truncated, false)
  assert.deepEqual(paths(result), [
    "/",
    "/about",
    "/feed",
    "/pricing",
    "/blog/[slug]",
    "/docs/[...slug]",
    "/shop/[[...slug]]",
  ])
  const blog = result.routes.find((route) => route.path === "/blog/[slug]")
  assert.deepEqual(blog, { path: "/blog/[slug]", file: "app/blog/[slug]/page.tsx", dynamic: true })
  assert.equal(result.routes[0].dynamic, false)
})

check("app router: the root page wins the dedupe over a group's root page", () => {
  const result = read(appRoot)
  assert.equal(result.routes.filter((route) => route.path === "/").length, 1)
  assert.equal(result.routes[0].file, "app/page.tsx")
})

check("src/app is read the same way", () => {
  const root = project({
    "package.json": NEXT_PACKAGE,
    "src/app/page.tsx": PAGE,
    "src/app/settings/profile/page.ts": PAGE,
  })
  const result = read(root)
  assert.equal(result.framework, "next-app")
  assert.deepEqual(result.routes, [
    { path: "/", file: "src/app/page.tsx", dynamic: false },
    { path: "/settings/profile", file: "src/app/settings/profile/page.ts", dynamic: false },
  ])
})

check("next.config.* alone counts as a Next project", () => {
  const root = project({ "next.config.mjs": "export default {}\n", "app/page.tsx": PAGE })
  assert.deepEqual(paths(read(root)), ["/"])
})

check("an app/ folder without Next is not read as a router", () => {
  const root = project({
    "package.json": JSON.stringify({ dependencies: { vite: "5" } }),
    "src/pages/Home.tsx": PAGE,
    "app/page.tsx": PAGE,
  })
  const result = read(root)
  assert.equal(result.framework, "unknown")
  assert.deepEqual(result.routes, [])
})

/* ---------- Next.js Pages Router ---------- */

console.log("\nNext Pages Router")

check("pages router: index maps to its folder; hooks, api, and error pages skipped", () => {
  const root = project({
    "package.json": NEXT_PACKAGE,
    "pages/index.tsx": PAGE,
    "pages/about.tsx": PAGE,
    "pages/blog/index.jsx": PAGE,
    "pages/blog/[slug].tsx": PAGE,
    "pages/docs/[...all].js": PAGE,
    "pages/guide.mdx": PAGE,
    "pages/_app.tsx": PAGE,
    "pages/_document.tsx": PAGE,
    "pages/_error.tsx": PAGE,
    "pages/404.tsx": PAGE,
    "pages/500.tsx": PAGE,
    "pages/api/hello.ts": "export default function handler() {}\n",
    "pages/types.d.ts": "export {}\n",
    "pages/styles.css": "body{}\n",
  })
  const result = read(root)
  assert.equal(result.framework, "next-pages")
  assert.deepEqual(paths(result), ["/", "/about", "/blog", "/guide", "/blog/[slug]", "/docs/[...all]"])
  assert.equal(result.routes.find((route) => route.path === "/blog").file, "pages/blog/index.jsx")
  assert.equal(result.routes.find((route) => route.path === "/docs/[...all]").dynamic, true)
})

check("src/pages is read, and app router wins a tie with pages router", () => {
  const root = project({
    "package.json": NEXT_PACKAGE,
    "src/pages/legacy.tsx": PAGE,
    "src/app/modern/page.tsx": PAGE,
  })
  const result = read(root)
  assert.equal(result.framework, "next-app")
  assert.deepEqual(paths(result), ["/legacy", "/modern"])
})

/* ---------- React Router / TanStack ---------- */

console.log("\nReact Router")

check("react-router: absolute path literals in router files, params dynamic", () => {
  const root = project({
    "package.json": JSON.stringify({ dependencies: { "react-router-dom": "6" } }),
    "src/main.tsx": `
      import { createBrowserRouter } from "react-router-dom"
      export const router = createBrowserRouter([
        { path: "/", element: null },
        { path: "/settings/", element: null },
        { path: "/users/:id", element: null },
        { path: "relative-child", element: null },
        { path: "/files/*", element: null },
        { path: "*", element: null },
      ])
    `,
    "src/Routes.jsx": `
      import { Route } from 'react-router'
      export const r = <><Route path="/about" /><Route path={'/team'} /></>
    `,
    "src/tanstack.ts": `
      import { createFileRoute } from "@tanstack/react-router"
      export const Route = createFileRoute('/posts/$postId')({})
    `,
    "src/not-a-router.ts": `export const config = { path: "/ignored" }\n`,
  })
  const result = read(root)
  assert.equal(result.framework, "react-router")
  assert.deepEqual(paths(result), ["/", "/about", "/settings", "/team", "/posts/$postId", "/users/:id"])
  assert.equal(result.routes.find((route) => route.path === "/users/:id").file, "src/main.tsx")
})

/* ---------- Angular ---------- */

console.log("\nAngular")

check("angular: route-file entries prefixed, empty is root, ** skipped", () => {
  const root = project({
    "angular.json": "{}",
    "src/app/app.routes.ts": `
      import { Routes } from '@angular/router'
      export const routes: Routes = [
        { path: '', component: Home },
        { path: 'dashboard', component: Dashboard },
        { path: 'items/:id', component: Item },
        { path: '**', redirectTo: '' },
      ]
    `,
    "src/app/admin/admin-routing.module.ts": `const routes = [{ path: "admin", component: Admin }]`,
    "src/app/app.component.ts": `const notARoute = { path: 'nope' }`,
  })
  const result = read(root)
  assert.equal(result.framework, "angular")
  assert.deepEqual(paths(result), ["/", "/admin", "/dashboard", "/items/:id"])
  assert.equal(result.routes[0].file, "src/app/app.routes.ts")
})

/* ---------- empty, hostile, and oversized trees ---------- */

console.log("\nLimits")

check("an empty project answers unknown with no routes", () => {
  assert.deepEqual(read(project({})), { framework: "unknown", routes: [], truncated: false })
})

check("a missing project root degrades, never throws", () => {
  assert.deepEqual(read(path.join(os.tmpdir(), "designlayer-pages-does-not-exist")), {
    framework: "unknown",
    routes: [],
    truncated: false,
  })
})

check("routes are capped and the cap is reported", () => {
  const files = { "package.json": NEXT_PACKAGE }
  for (let index = 0; index < MAX_ROUTES + 20; index += 1) {
    files[`app/r${String(index).padStart(3, "0")}/page.tsx`] = PAGE
  }
  const result = read(project(files))
  assert.equal(result.routes.length, MAX_ROUTES)
  assert.equal(result.truncated, true)
})

check("the walk stops at its entry budget and says so", () => {
  const files = { "package.json": NEXT_PACKAGE, "app/page.tsx": PAGE }
  for (let index = 0; index < MAX_WALKED_ENTRIES + 50; index += 1) {
    files[`app/filler/f${index}.txt`] = ""
  }
  const result = read(project(files))
  assert.equal(result.truncated, true)
  assert.ok(result.routes.length <= 1)
})

check("an unreadable folder is skipped, not fatal", () => {
  const root = project({
    "package.json": NEXT_PACKAGE,
    "app/page.tsx": PAGE,
    "app/locked/page.tsx": PAGE,
  })
  const locked = path.join(root, "app", "locked")
  fs.chmodSync(locked, 0o000)
  try {
    const result = read(root)
    assert.ok(paths(result).includes("/"))
    // Root can read anything, so only the non-root run proves the skip.
    if (process.getuid?.() !== 0) assert.deepEqual(paths(result), ["/"])
  } finally {
    fs.chmodSync(locked, 0o755)
  }
})

/* ---------- the route ---------- */

console.log("\nPages route")

await checkAsync("GET /pages serves the catalog over loopback and refuses a foreign Origin", async () => {
  const config = resolveConfig({ projectRoot: appRoot }, { cwd: appRoot })
  const routes = createDesignLayerRoutes(config)
  const server = http.createServer((request, response) => {
    if (routes.handle(request, response)) return
    response.writeHead(404).end()
  })
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
  const { port } = server.address()
  const url = `http://127.0.0.1:${port}${config.apiPrefix}/pages`
  try {
    const ok = await fetch(url)
    assert.equal(ok.status, 200)
    assert.match(ok.headers.get("content-type"), /application\/json/)
    const payload = await ok.json()
    assert.equal(payload.framework, "next-app")
    assert.equal(payload.truncated, false)
    assert.equal(payload.routes[0].path, "/")
    assert.ok(payload.routes.some((route) => route.path === "/blog/[slug]" && route.dynamic))

    const foreign = await fetch(url, { headers: { origin: "http://evil.test" } })
    assert.equal(foreign.status, 403)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})

for (const root of TEMP_ROOTS) fs.rmSync(root, { recursive: true, force: true })

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
