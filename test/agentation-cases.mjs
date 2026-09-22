/**
 * The annotation toolbar's contract with the editor around it.
 *
 * Everything this suite guards is something that fails SILENTLY in a browser:
 * the toolbar still renders, the console stays clean, and the designer simply
 * cannot use it. That is how both of the real defects behind this integration
 * presented — a bar painted under the inspector, and a bar whose toggle could
 * not be clicked — so the assertions below are deliberately about geometry and
 * cascade rather than about anything that throws.
 *
 * No browser and no host app. The three things worth pinning are all readable
 * without one: what the server tells the page, what the page makes of it, and
 * what the two stylesheets say about each other.
 */

import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

import { browserPrelude, resolveConfig } from "../config.mjs"
import { PACKAGE_DIR } from "./host.mjs"

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

const read = (relative) => fs.readFileSync(path.join(PACKAGE_DIR, relative), "utf8")

function preludePayload(raw = {}) {
  const config = resolveConfig(raw, { cwd: PACKAGE_DIR })
  const text = browserPrelude(config, { proxyPort: 4567 })
  return JSON.parse(text.slice(text.indexOf("=") + 1, text.lastIndexOf(";")))
}

/**
 * The browser half of the config, as a page behind the proxy really loads it.
 *
 * `src/core/config.ts` reads `window.__DESIGNLAYER_CONFIG__` once at module
 * scope, so a second payload needs a second module instance — hence the unique
 * `__marker` export, which is what makes each data: URL a distinct module
 * rather than a cache hit. Borrowed from `host-agnostic-cases.mjs`, where the
 * same constraint is documented at length.
 */
let marker = 0
async function readConfigIn(payload) {
  globalThis.__DESIGNLAYER_CONFIG__ = payload
  const { build } = await import("esbuild")
  const bundled = await build({
    stdin: {
      contents: `
        export const __marker = ${JSON.stringify(`agentation-${(marker += 1)}`)}
        export { config } from "./src/core/config"
      `,
      resolveDir: PACKAGE_DIR,
      loader: "ts",
    },
    bundle: true,
    format: "esm",
    write: false,
    logLevel: "silent",
  })
  const mod = await import(
    `data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`
  )
  return mod.config
}

console.log("\nagentation")

// ---------------------------------------------------------------------------
// What the server says

check("prelude carries the toolbar's two settings", () => {
  const payload = preludePayload()
  assert.deepEqual(payload.agentation, {
    enabled: true,
    endpoint: "http://127.0.0.1:4747",
  })
})

check("a host that turns it off says so in the payload", () => {
  const payload = preludePayload({ agentation: { enabled: false } })
  assert.equal(payload.agentation.enabled, false)
})

check("an endpoint of null travels as null rather than as the default", () => {
  const payload = preludePayload({ agentation: { endpoint: null } })
  assert.equal(payload.agentation.enabled, true)
  assert.equal(payload.agentation.endpoint, null)
})

// ---------------------------------------------------------------------------
// What the page makes of it

await checkAsync("the browser reads the endpoint back without a trailing slash", async () => {
  const config = await readConfigIn(preludePayload())
  // `URL.href` canonicalises a bare origin WITH a slash, and Agentation builds
  // its requests as `${endpoint}/sessions`. One slash here is a 404 there.
  assert.equal(config.agentation.endpoint, "http://127.0.0.1:4747")
})

await checkAsync("a remote endpoint is refused, and the toolbar stays local", async () => {
  const payload = preludePayload()
  payload.agentation.endpoint = "http://annotations.example.com"
  const config = await readConfigIn(payload)
  assert.equal(config.agentation.enabled, true)
  assert.equal(config.agentation.endpoint, null)
})

await checkAsync("a prelude that predates the setting mounts nothing", async () => {
  const payload = preludePayload()
  delete payload.agentation
  const config = await readConfigIn(payload)
  assert.equal(config.agentation.enabled, false)
})

// ---------------------------------------------------------------------------
// What the two stylesheets say about each other

check("the toolbar clears the editor's own bottom pill", () => {
  const source = read("src/core/css/agentation.ts")
  const pill = Number(/const PILL_HEIGHT = (\d+)/.exec(source)?.[1])
  const row = /const ROW = t\.size\.panelInset \+ PILL_HEIGHT \+ t\.size\.panelInset/.test(source)
  assert.ok(Number.isFinite(pill), "PILL_HEIGHT is no longer a literal this test can read")
  assert.ok(row, "ROW no longer stacks the toolbar a whole pill above the bottom inset")

  const inset = Number(/panelInset: (\d+)/.exec(read("src/core/tokens.ts"))?.[1])
  assert.ok(Number.isFinite(inset), "tokens.size.panelInset is no longer a literal")
  // The editor's pill occupies `inset` to `inset + pill` from the bottom edge.
  // Anything less than that and the two bars are drawn on top of each other.
  assert.ok(
    inset + pill + inset >= inset + pill,
    `the toolbar row (${inset + pill + inset}px) lands on the editor's pill`
  )
})

check("every layer is above the panels and below everything the editor raises", () => {
  const source = read("src/core/css/agentation.ts")
  const layer = Number(/const LAYER = (\d+)/.exec(source)?.[1])
  const bar = Number(/const BAR = LAYER \+ (\d+)/.exec(source)?.[1]) + layer
  const root = Number(/\.de-root \{[^}]*z-index: (\d+)/s.exec(read("src/core/css/base.ts"))?.[1])
  assert.ok(Number.isFinite(layer) && Number.isFinite(bar) && Number.isFinite(root))
  // Above the panels, or the whole point is lost: neither a bar for annotating
  // the editor nor the pins it drops can be painted behind the editor.
  assert.ok(layer > root, `the layer band at ${layer} is not above .de-root at ${root}`)
  assert.ok(bar > layer, `the bar at ${bar} is not at the top of its own stack`)
  // Below the transients. The token picker is the lowest of them.
  const picker = Number(/z-index: (21474832\d\d)/.exec(read("src/core/css/token-picker.ts"))?.[1])
  if (Number.isFinite(picker)) {
    assert.ok(bar < picker, `agentation at ${bar} would cover the token picker at ${picker}`)
  }
})

/*
 * The rule that makes a pin on the inspector visible at all.
 *
 * Lifting only `[data-agentation-toolbar]` is the version of this integration
 * that looks finished and is not: the bar comes forward, and the hover
 * highlight and the numbered pins stay behind the panel they are marking up.
 * The band has to be raised by something every layer carries.
 */
check("the lift reaches every layer, not just the bar", () => {
  const source = read("src/core/css/agentation.ts")
  assert.match(
    source,
    /\[data-agentation-root\] > \[data-feedback-toolbar\] \{ z-index: \$\{LAYER\} !important; \}/,
    "only the bar is lifted — pins and the hover highlight would paint under the panels"
  )
  // The child combinator is load-bearing: `data-feedback-toolbar` is on nested
  // nodes too, and re-declaring z-index inside an already-raised layer floats
  // a control out of its own bar.
  assert.doesNotMatch(
    source,
    /\[data-agentation-root\] \[data-feedback-toolbar\]/,
    "the lift lost its child combinator and now reaches nested nodes"
  )
})

/*
 * The comment box, which is the layer that cost the most to find.
 *
 * Agentation writes an inline `z-index: 99999` onto the overlay holding the
 * popup the moment an annotation is pending. An inline style outranks any
 * un-forced rule, so without `!important` the hover highlight sat above the
 * panels and the box you actually type into did not — which reads as the popup
 * failing to open rather than as a stacking bug.
 *
 * The positional declarations must stay unforced in the same rule, or a dragged
 * bar snaps back to this corner. Both halves are asserted because the fix and
 * its limit live one line apart.
 */
check("the z-index is forced, and the bar's position is not", () => {
  const source = read("src/core/css/agentation.ts")
  assert.match(
    source,
    /z-index: \$\{BAR\} !important;/,
    "the bar's z-index is not forced — an inline z-index would sink it under the panels"
  )
  for (const property of ["right", "bottom"]) {
    assert.doesNotMatch(
      source,
      new RegExp(`${property}: [^;\\n]*!important`),
      `${property} is forced — a dragged bar would snap back to this corner`
    )
  }
})

/*
 * The shortcut this file is not allowed to take.
 *
 * One stacking context on the root would preserve Agentation's internal band
 * exactly and be shorter than the rule above. It also moves every
 * document-anchored pin, because the root is `display: contents` and giving it
 * a box makes it the containing block for the absolutely-positioned marker
 * layer — measured at 901px of drift on :3464. Whoever tries it next should
 * find this test rather than the drift.
 */
check("the root is never given a box", () => {
  const source = read("src/core/css/agentation.ts")
  assert.doesNotMatch(
    source,
    /\[data-agentation-root\]\s*\{/,
    "a rule on the root itself re-anchors the absolute marker layer — see the pin-drift note"
  )
})

check("inspecting mode's svg override is still the rule being outranked", () => {
  // If `css/base.ts` ever drops this, the counter-rule in `css/agentation.ts`
  // becomes dead weight that nobody would think to delete — and if base.ts
  // instead RAISES its specificity, the toolbar silently stops being clickable.
  // Either way this is the line that has to be looked at.
  assert.match(
    read("src/core/css/base.ts"),
    /html\.designlayer-inspecting svg \{\s*pointer-events: all;/,
    "base.ts no longer forces pointer-events on svg — re-check css/agentation.ts"
  )
  assert.match(
    read("src/core/css/agentation.ts"),
    /html\.designlayer-inspecting \[data-agentation-root\] svg \{ pointer-events: none; \}/,
    "the counter-rule no longer names the mode, so it no longer outranks base.ts"
  )
})

// ---------------------------------------------------------------------------
// What the editor does with the toolbar's DOM

check("the canvas treats the toolbar as chrome, not as the app", () => {
  assert.match(
    read("src/core/dom.ts"),
    /const CHROME_SELECTOR = \[(?:.(?!\.join))*?AGENTATION_ROOT_ATTR/s,
    "the hit-test would offer Agentation's own UI to the layer tree"
  )
})

check("the shell drives input into the toolbar", () => {
  // Without this the vendor's document-capture guard swallows every click on
  // the bar and the picker cannot be armed at all — the exact defect measured
  // on :3464 before `AGENTATION_ROOT_ATTR` was added to the declaw test.
  assert.match(
    read("src/shell/shell.ts"),
    /closest\(`\[\$\{CHROME_ATTR\}\],\[\$\{AGENTATION_ROOT_ATTR\}\]`\)/,
    "declaw no longer counts the annotation toolbar as ours"
  )
})

check("the toolbar mounts outside boot, so a failed boot still leaves it", () => {
  const source = read("src/index.ts")
  const mount = source.indexOf("installAgentation()")
  const boot = source.indexOf("async function boot()")
  assert.ok(mount > 0, "installAgentation is not called")
  assert.ok(mount < boot, "installAgentation moved inside boot — a bridge timeout would lose it")
})

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
