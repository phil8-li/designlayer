/**
 * Cases for canvas-mode frames: the guard that keeps the editor from booting
 * inside a board frame, and the header relaxation that lets the frame load.
 *
 * The guard is evaluated with node:vm as a classic script, because the property
 * it must preserve — the vendor's top-level `var ReactRewrite=` still landing
 * on the global object — only exists in script (not module or function) scope.
 *
 * Usage: node designlayer/test/board-frame-cases.mjs
 */

import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import vm from "node:vm"

import { PACKAGE_DIR } from "./host.mjs"

const {
  BOARD_FRAME_ATTRIBUTE,
  BOARD_FRAME_NAME_PREFIX,
  guardBoardFrames,
  stripFrameBlockingHeaders,
  stripFrameBlockingResponseHeaders,
} = await import(path.join(PACKAGE_DIR, "runtime", "board-frame.mjs"))

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

const SOURCE = "var ReactRewrite = 1; globalThis.ran = true"

/** Runs the guarded source against a fake `window` and returns the global. */
function run(window) {
  const context = vm.createContext({})
  context.window = window
  vm.runInContext(guardBoardFrames(SOURCE), context)
  return context
}

/* ---------- the guard ---------- */

console.log("\nFrame guard")

check("the constants are the ones the board client sets", () => {
  assert.equal(BOARD_FRAME_NAME_PREFIX, "designlayer-frame:")
  assert.equal(BOARD_FRAME_ATTRIBUTE, "data-designlayer-frame")
})

check("a frame named with the prefix runs nothing and does not throw", () => {
  const context = run({ name: "designlayer-frame:/x", frameElement: null })
  assert.equal(context.ran, undefined)
  // `var` hoists out of the skipped block, so the name may exist; it is never
  // assigned, which is what keeps the vendor from booting.
  assert.equal(context.ReactRewrite, undefined)
})

check("a plain window runs the source and its top-level var becomes a global", () => {
  const context = run({ name: "", frameElement: null })
  assert.equal(context.ran, true)
  assert.equal(context.ReactRewrite, 1)
  assert.equal(Object.hasOwn(context, "ReactRewrite"), true)
  // A later classic script reads it as a bare global, which is how the vendor
  // bundle's `ReactRewrite` is reached.
  assert.equal(vm.runInContext("ReactRewrite", context), 1)
})

check("a name that merely contains the prefix is not a board frame", () => {
  assert.equal(run({ name: "x designlayer-frame:/x", frameElement: null }).ran, true)
})

check("a frame element carrying the attribute runs nothing", () => {
  const frameElement = { hasAttribute: (name) => name === "data-designlayer-frame" }
  const context = run({ name: "renamed-by-the-app", frameElement })
  assert.equal(context.ran, undefined)
})

check("an ordinary iframe without the attribute still runs", () => {
  assert.equal(run({ name: "", frameElement: { hasAttribute: () => false } }).ran, true)
})

check("a throwing frameElement getter reads as not-a-frame and runs", () => {
  const window = { name: "" }
  Object.defineProperty(window, "frameElement", {
    get() {
      throw new Error("SecurityError: cross-origin frame")
    },
  })
  assert.equal(run(window).ran, true)
})

check("a source ending in a line comment still closes the block", () => {
  const context = vm.createContext({ window: { name: "", frameElement: null } })
  vm.runInContext(guardBoardFrames("globalThis.ran = true\n//# sourceMappingURL=x.map"), context)
  assert.equal(context.ran, true)
})

check("the real vendor overlay and chrome bundle still parse once guarded", () => {
  const overlay = path.join(PACKAGE_DIR, "node_modules", "react-rewrite-cli", "dist", "overlay.js")
  const chrome = path.join(PACKAGE_DIR, "dist", "designlayer.js")
  const pieces = [overlay, chrome].filter((file) => fs.existsSync(file)).map((file) => fs.readFileSync(file, "utf8"))
  assert.ok(pieces.length > 0, "neither served bundle exists to parse")
  const source = guardBoardFrames(`window.__DESIGNLAYER_CONFIG__={};\n${pieces.join("\n;\n")}`)
  // Compiling is the whole check: a block wrapper that broke the bundle's
  // syntax would fail here, and running it needs a browser.
  new vm.Script(source)
  const context = vm.createContext({ window: { name: "designlayer-frame:/", frameElement: null } })
  vm.runInContext(source, context)
  assert.equal(context.ReactRewrite, undefined)
})

/* ---------- headers ---------- */

console.log("\nFrame headers")

const IFRAME_SAME_ORIGIN = { headers: { "sec-fetch-dest": "iframe", "sec-fetch-site": "same-origin" } }

check("a same-origin iframe request drops XFO and only frame-ancestors", () => {
  const headers = stripFrameBlockingHeaders(IFRAME_SAME_ORIGIN, {
    "content-type": "text/html",
    "x-frame-options": "DENY",
    "content-security-policy": "default-src 'self'; frame-ancestors 'none'; img-src *",
  })
  assert.deepEqual(headers, {
    "content-type": "text/html",
    "content-security-policy": "default-src 'self'; img-src *",
  })
})

check("a policy that was only frame-ancestors is dropped entirely", () => {
  const headers = stripFrameBlockingHeaders(IFRAME_SAME_ORIGIN, {
    "content-security-policy": "frame-ancestors 'self' https://a.test;",
  })
  assert.deepEqual(headers, {})
})

check("mixed-case header names are matched", () => {
  const headers = stripFrameBlockingHeaders(IFRAME_SAME_ORIGIN, {
    "X-Frame-Options": "SAMEORIGIN",
    "Content-Security-Policy": "FRAME-ANCESTORS 'none'; script-src 'self'",
  })
  assert.deepEqual(headers, { "Content-Security-Policy": "script-src 'self'" })
})

check("a cross-site iframe request is untouched", () => {
  const original = { "x-frame-options": "DENY", "content-security-policy": "frame-ancestors 'none'" }
  const request = { headers: { "sec-fetch-dest": "iframe", "sec-fetch-site": "cross-site" } }
  assert.deepEqual(stripFrameBlockingHeaders(request, { ...original }), original)
})

check("a top-level document request is untouched", () => {
  const original = { "x-frame-options": "DENY", "content-security-policy": "frame-ancestors 'none'" }
  const request = { headers: { "sec-fetch-dest": "document", "sec-fetch-site": "same-origin" } }
  assert.deepEqual(stripFrameBlockingHeaders(request, { ...original }), original)
})

check("missing request or headers pass through", () => {
  assert.equal(stripFrameBlockingHeaders(undefined, undefined), undefined)
  assert.deepEqual(stripFrameBlockingHeaders({}, { a: "1" }), { a: "1" })
})

check("headers set earlier with setHeader are relaxed for a board frame", () => {
  const stored = new Map([
    ["x-frame-options", "DENY"],
    ["content-security-policy", "frame-ancestors 'none'; default-src 'self'"],
  ])
  const response = {
    req: IFRAME_SAME_ORIGIN,
    getHeader: (name) => stored.get(name.toLowerCase()),
    removeHeader: (name) => stored.delete(name.toLowerCase()),
    setHeader: (name, value) => stored.set(name.toLowerCase(), value),
  }
  stripFrameBlockingResponseHeaders(response)
  assert.deepEqual([...stored], [["content-security-policy", "default-src 'self'"]])

  const untouched = new Map([["x-frame-options", "DENY"]])
  stripFrameBlockingResponseHeaders({
    req: { headers: {} },
    getHeader: (name) => untouched.get(name),
    removeHeader: (name) => untouched.delete(name),
    setHeader: (name, value) => untouched.set(name, value),
  })
  assert.equal(untouched.get("x-frame-options"), "DENY")
})

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
