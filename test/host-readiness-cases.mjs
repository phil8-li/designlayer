import assert from "node:assert/strict"
import { JSDOM } from "jsdom"

import { PACKAGE_DIR } from "./host.mjs"
const dom = new JSDOM(
  "<!doctype html><html><body><main><section id='host'></section></main></body></html>",
  { pretendToBeVisual: true }
)
const { window } = dom
for (const key of [
  "window",
  "document",
  "Element",
  "requestAnimationFrame",
  "cancelAnimationFrame",
]) {
  Object.defineProperty(globalThis, key, { value: window[key], configurable: true, writable: true })
}

const { build } = await import("esbuild")
const bundled = await build({
  stdin: {
    contents: `export * from "./src/core/host-readiness"`,
    resolveDir: PACKAGE_DIR,
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  write: false,
  logLevel: "silent",
})
const readiness = await import(
  `data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`
)

assert.equal(readiness.hasHydratedReactHost(), false)

const editorRoot = document.createElement("div")
editorRoot.setAttribute("data-designlayer", "")
Object.defineProperty(editorRoot, "__reactFiber$editor", { value: {} })
document.body.prepend(editorRoot)
assert.equal(readiness.hasHydratedReactHost(), false)

const nextPortal = document.createElement("nextjs-portal")
const portalChild = document.createElement("div")
Object.defineProperty(portalChild, "__reactProps$dev-overlay", { value: {} })
nextPortal.append(portalChild)
document.body.prepend(nextPortal)
assert.equal(readiness.hasHydratedReactHost(), false)

const pending = readiness.whenHostHydrated(1_000)
Object.defineProperty(document.getElementById("host"), "__reactFiber$fixture", { value: {} })
await pending
assert.equal(readiness.hasHydratedReactHost(), true)

/*
 * An Angular host leaves a different mark, and asking React's question of it
 * is not a harmless miss: nothing in an Angular page ever grows a
 * `__reactFiber$`, so the poll ran its full timeout on every load and the
 * editor appeared ten seconds after the app did. It worked, so nothing failed
 * — it was merely slow enough to feel broken.
 */
assert.equal(
  readiness.hasHydratedReactHost(document, "angular"),
  false,
  "a React expando was mistaken for an Angular bootstrap"
)

const angularRoot = document.createElement("app-root")
angularRoot.setAttribute("ng-version", "22.0.5")
document.body.append(angularRoot)
assert.equal(
  readiness.hasHydratedReactHost(document, "angular"),
  true,
  "ng-version did not read as a bootstrapped Angular host"
)

console.log("7 passed, 0 failed")
