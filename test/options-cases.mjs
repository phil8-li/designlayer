/**
 * Cases for the options subsystem: the Leva inventory bridge, the
 * null-prototype guard on page-supplied keys, and baseline persistence.
 *
 * No browser and no servers. The inventory bridge is exercised against a
 * stubbed `window.__STORE` inside jsdom, and baseline persistence is checked
 * against the *real* server normaliser rather than a copy of it, because the
 * failure this guards against is precisely the normaliser silently dropping a
 * field the client added.
 *
 * Usage: node designlayer/test/options-cases.mjs
 */

import assert from "node:assert/strict"
import fs from "node:fs/promises"
import http from "node:http"
import os from "node:os"
import path from "node:path"
import { JSDOM } from "jsdom"

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

/**
 * Does this sentence hand the reader something to DO?
 *
 * Deliberately not a match on the copy. Every empty and error state in this
 * subsystem is expected to keep getting better written, and an assertion that
 * pins the words is one that has to be edited each time it does — which teaches
 * the next person to change the test rather than read it. What must NOT change
 * is that the sentence names an action, so that is the whole of what is
 * checked: an imperative verb opening a clause.
 */
const RECOVERY =
  /(?:^|[.;\u2014]\s+)(Open|Reload|Select|Press|Start|Check|Navigate|Install|Add|Style|Pick|Try|Clear|Interact|Paste|Type|Run|Set|Restyle|Reselect|Apply|Save)\b/

/** A sentence with a stack trace or an HTTP status in it is addressed to nobody. */
const RAW_DIAGNOSTIC = /TypeError|ReferenceError|\bError:|\bHTTP \d|\[object /

/** Loads a TypeScript module through the bundler this package already uses. */
async function load(relativePath) {
  const { build } = await import("esbuild")
  const bundled = await build({
    entryPoints: [path.join(PACKAGE_DIR, relativePath)],
    bundle: true,
    format: "esm",
    write: false,
    logLevel: "silent",
  })
  const source = Buffer.from(bundled.outputFiles[0].text).toString("base64")
  return import(`data:text/javascript;base64,${source}`)
}

/** The shape leva's `Store.getData()` returns, reduced to what we read. */
function stubStore(data, visiblePaths) {
  const writes = []
  return {
    writes,
    getData: () => data,
    getVisiblePaths: () => visiblePaths,
    setValueAtPath(pathName, value) {
      if (pathName === "Broken.control") throw new Error("Selected value doesn't match")
      writes.push([pathName, value])
    },
  }
}

const SAMPLE = {
  "Overview.Hover.hoverPreset": {
    type: "SELECT",
    label: "preset",
    value: "Lift",
    settings: { keys: ["None", "Lift", "Tilt 3D"], values: ["None", "Lift", "Tilt 3D"] },
  },
  "Overview.Hover.hoverScale": {
    type: "NUMBER",
    label: "scale",
    value: 1.02,
    settings: { min: 1, max: 1.2, step: 0.01 },
  },
  // Ten of these share one schema in project-shell and are disambiguated with
  // trailing zero-width spaces, so the label needs normalising to be matched.
  "Overview.Hover.save": { type: "BUTTON", label: "save as default​​", value: null },
  "Overview.Analytics.chart types.barWidth": { type: "NUMBER", label: "bar width", value: 12 },
  "Sidebar.Width.collapsed": { type: "BOOLEAN", label: "collapsed", value: false },
}
const SAMPLE_VISIBLE = [
  "Overview.Hover.hoverPreset",
  "Overview.Hover.hoverScale",
  "Overview.Hover.save",
  "Sidebar.Width.collapsed",
]

async function inventoryCases() {
  console.log("\nInventory bridge")

  const dom = new JSDOM("<!doctype html><html><body></body></html>")
  globalThis.window = dom.window
  globalThis.document = dom.window.document
  globalThis.Element = dom.window.Element
  globalThis.HTMLElement = dom.window.HTMLElement
  globalThis.CustomEvent = dom.window.CustomEvent
  globalThis.__DESIGNLAYER_CONFIG__ = {
    controls: {
      leva: {
        storeGlobal: "__STORE",
        sourceDefaults: true,
        bindings: [
          {
            pathPattern: "Overview.Hover.*",
            selectors: ["[data-card]"],
            relationship: "spacing within",
            defaultGroup: "Card hover",
            defaultKey: null,
          },
        ],
      },
    },
  }
  const inventory = await load("src/options/inventory.ts")

  check("no __STORE reports an empty state instead of throwing", () => {
    delete dom.window.__STORE
    const result = inventory.readInventory()
    assert.equal(result.available, false)
    assert.match(result.reason, /not on this page/)
  })

  /*
   * These four sentences ARE the Built controls tab in every state but the
   * working one. A reader who opens the browser and finds them has no list to
   * read and no control to press, so the sentence is the entire surface — and
   * one that only says the list is empty leaves them to guess whether the tab is
   * broken, whether the app is, or whether they opened the wrong thing.
   */
  check("every reason the controls tab can give names a way forward", () => {
    const reasons = []
    const config = globalThis.__DESIGNLAYER_CONFIG__

    delete dom.window.__STORE
    reasons.push(["a configured store that is absent", inventory.readInventory().reason])

    globalThis.__DESIGNLAYER_CONFIG__ = {}
    reasons.push(["a host with no Leva at all", inventory.readInventory().reason])
    globalThis.__DESIGNLAYER_CONFIG__ = config

    dom.window.__STORE = stubStore({}, [])
    reasons.push(["a store with no controls", inventory.readInventory().reason])

    // The thrown branch is the one that used to print `String(error)` into the
    // tab. The value still has to go somewhere a maintainer can read it, so the
    // warn is expected rather than merely tolerated.
    const warn = console.warn
    const warned = []
    console.warn = (...args) => warned.push(args)
    try {
      dom.window.__STORE = {
        getData() {
          throw new TypeError("Cannot read properties of undefined")
        },
        getVisiblePaths: () => [],
        setValueAtPath: () => {},
      }
      reasons.push(["a store that threw", inventory.readInventory().reason])
    } finally {
      console.warn = warn
    }
    assert.equal(warned.length, 1, "the thrown value was swallowed instead of logged")

    for (const [state, reason] of reasons) {
      assert.match(reason, RECOVERY, `${state} tells the reader nothing to do: ${reason}`)
      assert.doesNotMatch(
        reason,
        RAW_DIAGNOSTIC,
        `${state} shows a designer a diagnostic: ${reason}`
      )
    }
  })

  check("the tab calls the thing one name in every state it can be in", () => {
    const config = globalThis.__DESIGNLAYER_CONFIG__
    delete dom.window.__STORE
    const absent = inventory.readInventory().reason
    globalThis.__DESIGNLAYER_CONFIG__ = {}
    const unwired = inventory.readInventory().reason
    globalThis.__DESIGNLAYER_CONFIG__ = config
    dom.window.__STORE = stubStore({}, [])
    const empty = inventory.readInventory().reason

    // It was "the configured Leva store" in one branch and "a Leva control
    // integration" in the other, which reads as two different subsystems being
    // missing rather than one thing described twice. The vendor's name is out
    // of all of them now — the designer reading this did not choose the library
    // and cannot see it in the product — so the check is that the one name they
    // ARE given is the same name every time.
    for (const reason of [absent, unwired, empty]) {
      assert.match(reason, /control panel/)
      assert.doesNotMatch(reason, /leva/i, `the vendor's name reaches a designer: ${reason}`)
    }
    assert.notEqual(absent, unwired, "the two states collapsed into one sentence")
  })

  /*
   * The pane draws these as an empty state, not as a status line, and an empty
   * state leads with what is going on before it explains it. A title that
   * merely repeated the first clause of the sentence under it would be the
   * heading costing a line and saying nothing.
   */
  check("every unavailable state leads with a headline the sentence does not repeat", () => {
    const config = globalThis.__DESIGNLAYER_CONFIG__
    const states = []

    delete dom.window.__STORE
    states.push(inventory.readInventory())
    globalThis.__DESIGNLAYER_CONFIG__ = {}
    states.push(inventory.readInventory())
    globalThis.__DESIGNLAYER_CONFIG__ = config
    dom.window.__STORE = stubStore({}, [])
    states.push(inventory.readInventory())

    for (const state of states) {
      assert.equal(state.available, false)
      assert.ok(state.title, "an unavailable state with no headline")
      assert.ok(state.title.length < 48, `the headline is a sentence: ${state.title}`)
      assert.doesNotMatch(state.title, /\.$/, `the headline is punctuated as prose: ${state.title}`)
      assert.notEqual(state.title, state.reason.split(".")[0])
    }
    assert.equal(new Set(states.map((state) => state.title)).size, states.length)
  })

  check("an object that is not a leva store is refused", () => {
    dom.window.__STORE = { getData: 1 }
    assert.equal(inventory.levaStore(), null)
    assert.equal(inventory.readInventory().available, false)
  })

  check("a store with no registered controls reports why, not zero rows", () => {
    dom.window.__STORE = stubStore({}, [])
    const result = inventory.readInventory()
    assert.equal(result.available, false)
    assert.match(result.reason, /registered no controls/)
    // And it no longer tells the reader to reopen the pane afterwards. The pane
    // subscribes to the host's store and repaints itself, so that instruction
    // described a step the product has never required.
    assert.doesNotMatch(result.reason, /reopen/i)
  })

  check("a stubbed store is projected into sections, folders and controls", () => {
    dom.window.__STORE = stubStore(SAMPLE, SAMPLE_VISIBLE)
    const result = inventory.readInventory()
    assert.equal(result.available, true)
    assert.deepEqual(
      result.sections.map((section) => section.name),
      ["Overview", "Sidebar"]
    )
    const overview = result.sections[0]
    assert.deepEqual(
      overview.folders.map((folder) => folder.name),
      ["Hover", "Analytics"]
    )
    // 2 in Hover + 1 in Analytics/chart types; the save button is not a control.
    assert.equal(overview.controlCount, 3)
    assert.equal(result.controlCount, 4)
  })

  check("a save-as-default button becomes a folder badge, not a row", () => {
    dom.window.__STORE = stubStore(SAMPLE, SAMPLE_VISIBLE)
    const hover = inventory.readInventory().sections[0].folders[0]
    assert.equal(hover.hasSaveDefault, true)
    assert.deepEqual(
      hover.controls.map((control) => control.key),
      ["hoverPreset", "hoverScale"]
    )
  })

  check("named variants come through as the list a designer built", () => {
    dom.window.__STORE = stubStore(SAMPLE, SAMPLE_VISIBLE)
    const result = inventory.readInventory()
    const preset = result.sections[0].folders[0].controls[0]
    assert.deepEqual(preset.variants, ["None", "Lift", "Tilt 3D"])
    assert.equal(preset.value, "Lift")
    assert.equal(result.selectCount, 1)
    assert.equal(result.variantCount, 3)
  })

  check("explicit bindings annotate relevance and the source-default address", () => {
    dom.window.__STORE = stubStore(SAMPLE, SAMPLE_VISIBLE)
    const control = inventory.readInventory().sections[0].folders[0].controls[0]
    assert.equal(control.relationship, "spacing within")
    assert.deepEqual(control.selectors, ["[data-card]"])
    assert.equal(control.defaultGroup, "Card hover")
    assert.equal(control.defaultKey, "hoverPreset")
    assert.equal(control.canPersistDefault, true)
  })

  check("unbound paths stay unbound instead of guessing from their names", () => {
    const tree = inventory.buildTree(SAMPLE, SAMPLE_VISIBLE, [])
    const control = tree.sections[0].folders[0].controls[0]
    assert.equal(control.relationship, null)
    assert.deepEqual(control.selectors, [])
    assert.equal(control.defaultGroup, null)
  })

  check("highlight dispatch carries only host-declared target elements", () => {
    const card = dom.window.document.createElement("article")
    card.setAttribute("data-card", "")
    dom.window.document.body.append(card)
    dom.window.__STORE = stubStore(SAMPLE, SAMPLE_VISIBLE)
    const control = inventory.readInventory().sections[0].folders[0].controls[0]
    let detail = null
    dom.window.addEventListener("designlayer:highlight-elements", (event) => {
      detail = event.detail
    }, { once: true })
    const resolved = inventory.highlightControlTargets(control)
    assert.deepEqual(resolved.elements, [card])
    assert.deepEqual(detail.elements, [card])
    assert.equal(detail.relationship, "spacing within")
  })

  check("a control hidden by a render predicate is listed, flagged hidden", () => {
    dom.window.__STORE = stubStore(SAMPLE, SAMPLE_VISIBLE)
    const nested = inventory.readInventory().sections[0].folders[1].folders[0].controls[0]
    assert.equal(nested.key, "barWidth")
    assert.equal(nested.visible, false)
  })

  check("number bounds survive so the editor can clamp", () => {
    dom.window.__STORE = stubStore(SAMPLE, SAMPLE_VISIBLE)
    const scale = inventory.readInventory().sections[0].folders[0].controls[1]
    assert.deepEqual(scale.bounds, { min: 1, max: 1.2, step: 0.01 })
  })

  check("setControlValue writes through, and a rejection is a false not a throw", () => {
    const store = stubStore(SAMPLE, SAMPLE_VISIBLE)
    dom.window.__STORE = store
    assert.equal(inventory.setControlValue("Overview.Hover.hoverPreset", "Tilt 3D"), true)
    assert.deepEqual(store.writes, [["Overview.Hover.hoverPreset", "Tilt 3D"]])
    // The rejection path warns on purpose; the stack would drown the results.
    const warn = console.warn
    console.warn = () => {}
    try {
      assert.equal(inventory.setControlValue("Broken.control", "x"), false)
    } finally {
      console.warn = warn
    }
  })

  check("subscribeToLeva degrades to a no-op when the store has no useStore", () => {
    dom.window.__STORE = stubStore(SAMPLE, SAMPLE_VISIBLE)
    const unsubscribe = inventory.subscribeToLeva(() => {})
    assert.equal(typeof unsubscribe, "function")
    unsubscribe()
  })

  check("filtering matches a variant name, not just the control name", () => {
    const tree = inventory.buildTree(SAMPLE, SAMPLE_VISIBLE)
    const hit = inventory.filterTree(tree.sections, "tilt 3d")
    assert.deepEqual(
      hit.map((section) => section.name),
      ["Overview"]
    )
    assert.deepEqual(
      hit[0].folders[0].controls.map((control) => control.key),
      ["hoverPreset"]
    )
  })

  check("filtering a folder name keeps everything inside it", () => {
    const tree = inventory.buildTree(SAMPLE, SAMPLE_VISIBLE)
    const hit = inventory.filterTree(tree.sections, "sidebar")
    assert.equal(hit.length, 1)
    assert.equal(hit[0].controlCount, 1)
  })

  return inventory
}

function prototypeCases(inventory) {
  console.log("\nNull-prototype guard")

  check("the index every path is keyed on has no prototype", () => {
    assert.equal(Object.getPrototypeOf(inventory.nullIndex()), null)
  })

  check("a __proto__ path builds a folder instead of reassigning the prototype", () => {
    const data = {
      "__proto__.polluted.key": { type: "STRING", label: "key", value: "x" },
      "Real.Folder.key": { type: "STRING", label: "key", value: "y" },
    }
    const tree = inventory.buildTree(data, Object.keys(data))
    assert.equal({}.polluted, undefined, "Object.prototype was polluted")
    assert.equal(Object.prototype.polluted, undefined)
    assert.ok(
      tree.sections.some((section) => section.name === "__proto__"),
      "the __proto__ segment should be listed as an ordinary folder"
    )
    assert.equal(tree.controlCount, 2)
  })

  check("a __proto__ entry in visiblePaths is not read off Object.prototype", () => {
    const tree = inventory.buildTree({}, ["__proto__", "toString"])
    assert.equal(tree.controlCount, 0)
    assert.deepEqual(tree.sections, [])
  })

  check("zero-width padding does not create ten distinct labels", () => {
    assert.equal(inventory.plainLabel("save as default​​‍"), "save as default")
    assert.equal(inventory.plainLabel(undefined), "")
  })
}

async function sourceDefaultCases() {
  console.log("\nSource-backed control defaults")
  const { parseArgs } = await import(path.join(PACKAGE_DIR, "cli.mjs"))
  const { browserPrelude, resolveConfig } = await import(path.join(PACKAGE_DIR, "config.mjs"))
  const { createControlDefaults } = await import(
    path.join(PACKAGE_DIR, "server/control-defaults.mjs")
  )
  const { createDesignLayerRoutes } = await import(
    path.join(PACKAGE_DIR, "server/routes.mjs")
  )
  const fixtureDir = path.join(PACKAGE_DIR, "test/.control-default-fixture")
  const fixture = path.join(fixtureDir, "defaults.ts")
  const source = `// unrelated header stays byte-for-byte\nexport const DEFAULTS: Record<string, Record<string, unknown>> = {\n  "Card": {\n    // keep this note\n    "gap": 8,\n    "color": "#fff",\n    "dynamic": makeDefault(),\n  },\n  "Other": { "flag": true },\n}\n\nexport const SENTINEL = "untouched"\n`

  await fs.mkdir(fixtureDir, { recursive: true })
  await fs.writeFile(fixture, source)
  const config = resolveConfig(
    {
      projectRoot: PACKAGE_DIR,
      source: { roots: [fixtureDir], extensions: [".ts"] },
      controls: {
        leva: {
          storeGlobal: "__STORE",
          sourceDefaults: { file: fixture, exportName: "DEFAULTS" },
          bindings: [],
        },
      },
    },
    { cwd: PACKAGE_DIR }
  )
  const defaults = createControlDefaults(config)

  check("generic defaults do not assume Leva, Agentation, or host chrome", () => {
    const generic = resolveConfig({}, { cwd: PACKAGE_DIR })
    assert.deepEqual(generic.chrome.trustedSelectors, [])
    assert.equal(generic.chrome.trustedSelector, "")
    assert.equal(generic.controls.leva, null)
  })

  check("CLI open flags preserve an explicit false override", () => {
    assert.equal(parseArgs([]).open, undefined)
    assert.equal(parseArgs(["--open"]).open, true)
    assert.equal(parseArgs(["--no-open"]).open, false)
  })

  check("a relative projectRoot resolves from the config file, not process cwd", () => {
    const configPath = path.join(PACKAGE_DIR, ".local", "configs", "designlayer.config.mjs")
    const resolved = resolveConfig(
      { projectRoot: "../.." },
      { configPath, cwd: path.join(PACKAGE_DIR, "unrelated-cwd") }
    )
    assert.equal(resolved.projectRoot, path.resolve(PACKAGE_DIR))
  })

  /*
   * A host writes `src/lib/…` in its config meaning its own src. Resolved
   * against `process.cwd()` that became a path inside whatever directory the
   * command was typed in — outside the project by definition, and refused as
   * such. The start screen made this the normal case: it can be answered from
   * any folder on the machine, so the whole options panel and the AI handoff
   * went dark on projects that had done nothing wrong.
   */
  check("a relative source-default file is the project's, not the caller's", () => {
    const relative = resolveConfig(
      {
        projectRoot: PACKAGE_DIR,
        source: { roots: ["test/.control-default-fixture"], extensions: [".ts"] },
        controls: {
          leva: {
            storeGlobal: "__STORE",
            sourceDefaults: { file: "test/.control-default-fixture/defaults.ts", exportName: "DEFAULTS" },
            bindings: [],
          },
        },
      },
      { cwd: PACKAGE_DIR }
    )
    const elsewhere = process.cwd()
    process.chdir(os.tmpdir())
    try {
      assert.equal(createControlDefaults(relative).configured, true)
    } finally {
      process.chdir(elsewhere)
    }
  })

  check("the browser prelude excludes source-default file and export details", () => {
    const prelude = browserPrelude(config)
    assert.match(prelude, /"storeGlobal":"__STORE"/)
    assert.match(prelude, /"sourceDefaults":true/)
    assert.doesNotMatch(prelude, /defaults\.ts/)
    assert.doesNotMatch(prelude, /DEFAULTS/)
  })

  await checkAsync("reads and replaces one literal without reformatting the file", async () => {
    assert.deepEqual(await defaults.read("Card", "gap"), {
      configured: true,
      exists: true,
      value: 8,
    })
    await defaults.write("Card", "gap", 12)
    assert.equal(await fs.readFile(fixture, "utf8"), source.replace('"gap": 8', '"gap": 12'))
  })

  await checkAsync("adds and removes one key while preserving unrelated comments/content", async () => {
    await defaults.write("Card", "radius", 20)
    let next = await fs.readFile(fixture, "utf8")
    assert.match(next, /"radius": 20/)
    assert.match(next, /\/\/ keep this note/)
    assert.match(next, /export const SENTINEL = "untouched"/)
    assert.deepEqual(await defaults.remove("Card", "color"), { configured: true, existed: true })
    next = await fs.readFile(fixture, "utf8")
    assert.doesNotMatch(next, /"color"/)
    assert.match(next, /"gap": 12/)
    assert.match(next, /"radius": 20/)
    assert.match(next, /"Other": \{ "flag": true \}/)
  })

  await checkAsync("refuses to read, update, or remove a dynamic expression", async () => {
    await assert.rejects(defaults.read("Card", "dynamic"), /dynamic/)
    await assert.rejects(defaults.write("Card", "dynamic", 1), /dynamic/)
    await assert.rejects(defaults.remove("Card", "dynamic"), /dynamic/)
  })

  await checkAsync("loopback routes expose GET, PUT, and DELETE against the configured literal", async () => {
    const routes = createDesignLayerRoutes(config)
    const server = http.createServer((request, response) => {
      if (routes.handle(request, response)) return
      response.writeHead(404).end()
    })
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
    const address = server.address()
    const base = `http://127.0.0.1:${address.port}${config.apiPrefix}/control-default`
    const url = `${base}?${new URLSearchParams({ group: "Other", key: "flag" })}`
    try {
      const initial = await (await fetch(url)).json()
      assert.deepEqual(initial, { configured: true, exists: true, value: true })
      const put = await fetch(url, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ value: false }),
      })
      assert.equal(put.status, 200)
      assert.equal((await put.json()).value, false)
      assert.match(await fs.readFile(fixture, "utf8"), /"Other": \{ "flag": false \}/)
      const drop = await fetch(url, { method: "DELETE" })
      assert.deepEqual(await drop.json(), { configured: true, existed: true })
      assert.doesNotMatch(await fs.readFile(fixture, "utf8"), /"flag"/)
    } finally {
      await new Promise((resolve) => server.close(resolve))
    }
  })

  check("refuses a configured defaults file outside editable source roots", () => {
    const unsafe = resolveConfig(
      {
        projectRoot: PACKAGE_DIR,
        source: { roots: [fixtureDir], extensions: [".ts"] },
        controls: {
          leva: {
            storeGlobal: "__STORE",
            sourceDefaults: { file: path.join(PACKAGE_DIR, "elsewhere.ts"), exportName: "DEFAULTS" },
            bindings: [],
          },
        },
      },
      { cwd: PACKAGE_DIR }
    )
    assert.throws(() => createControlDefaults(unsafe), /outside editable source roots/)
  })

  await checkAsync("refuses a source-root symlink that resolves outside the project", async () => {
    const outsideDir = await fs.mkdtemp(path.join(os.tmpdir(), "designlayer-outside-"))
    const outsideFile = path.join(outsideDir, "defaults.ts")
    const linkedFile = path.join(fixtureDir, "linked-defaults.ts")
    try {
      await fs.writeFile(outsideFile, 'export const DEFAULTS = { "Card": { "gap": 8 } }\n')
      await fs.symlink(outsideFile, linkedFile)
      const unsafe = resolveConfig(
        {
          projectRoot: PACKAGE_DIR,
          source: { roots: [fixtureDir], extensions: [".ts"] },
          controls: {
            leva: {
              storeGlobal: "__STORE",
              sourceDefaults: { file: linkedFile, exportName: "DEFAULTS" },
              bindings: [],
            },
          },
        },
        { cwd: PACKAGE_DIR }
      )
      assert.throws(() => createControlDefaults(unsafe), /outside editable source roots/)
    } finally {
      await fs.rm(linkedFile, { force: true })
      await fs.rm(outsideDir, { recursive: true, force: true })
    }
  })

  await fs.rm(fixtureDir, { recursive: true, force: true })
}

async function writerCases() {
  console.log("\nClass snapshot writer")
  const { createWriter } = await load("src/core/writer.ts")
  const parent = document.createElement("div")
  parent.className = "parent-shell"
  const element = document.createElement("button")
  element.className = "rounded px-2 text-sm"
  parent.append(element)
  document.body.append(parent)

  const pending = []
  const bridge = {
    toast() {},
    store: {
      addPendingPropertyOperation(key, operation, propertyKeys) {
        pending.push({ key, operation, propertyKeys })
      },
    },
  }
  const selection = {
    element,
    tagName: "button",
    componentName: "Button",
    key: "Button:1:button0",
    source: {
      filePath: "src/Button.tsx",
      lineNumber: 1,
      columnNumber: 1,
      componentName: "Button",
    },
  }
  const writer = createWriter(bridge)

  check("class swaps queue the removal and preserve pre-mutation identity", () => {
    writer.applyClasses(selection, { remove: ["px-2"], add: ["px-4"] }, "Swap padding")
    assert.equal(element.className, "rounded text-sm px-4")
    assert.equal(pending[0].operation.className, "rounded px-2 text-sm")
    assert.equal(pending[0].operation.parentClassName, "parent-shell")
    assert.deepEqual(pending[0].operation.updates[0], {
      tailwindPrefix: "px-2",
      tailwindToken: "px-4",
      value: "px-4",
      standalone: true,
      classPattern: "^px-2$",
    })
  })

  check("a pure removal queues an empty exact replacement instead of preview-only", () => {
    writer.applyClasses(selection, { remove: ["text-sm"], add: [] }, "Remove text size")
    assert.equal(element.classList.contains("text-sm"), false)
    assert.equal(pending[1].operation.className, "rounded text-sm px-4")
    assert.equal(pending[1].operation.updates[0].tailwindToken, "")
    assert.equal(pending[1].operation.updates[0].classPattern, "^text-sm$")
  })

  parent.remove()
}

async function baselineCases() {
  console.log("\nBaseline persistence")

  const client = await load("src/options/store.ts")
  const { normalizeOptionSet } = await import(
    path.join(PACKAGE_DIR, "server/options-store.mjs")
  )

  const KEY = "ProjectShell:412:div0/div1/div2/div3/main0/button3"
  const baseline = {
    id: client.BASELINE_OPTION_ID,
    name: "Before options",
    className: "rounded-md p-2",
    style: { opacity: "1" },
    createdAt: 1,
  }
  const saved = {
    id: "abc",
    name: "Option 1",
    className: "rounded-xl p-4",
    style: { opacity: "0.9" },
    createdAt: 2,
  }
  const set = { key: KEY, label: "ProjectShell", activeOptionId: "abc", options: [baseline, saved] }

  check("the baseline survives the server normaliser's four-field rebuild", () => {
    const stored = normalizeOptionSet(JSON.parse(JSON.stringify(set)), KEY)
    const roundTripped = client.baselineOf(stored, KEY)
    assert.deepEqual(roundTripped, {
      className: "rounded-md p-2",
      style: { opacity: "1" },
      text: undefined,
    })
  })

  check("a top-level baseline field would NOT have survived — hence the option slot", () => {
    const stored = normalizeOptionSet({ ...set, options: [saved], baseline }, KEY)
    assert.equal(stored.baseline, undefined)
    assert.equal(client.baselineOf(stored, KEY), null)
  })

  check("the baseline is never shown as one of the saved options", () => {
    const stored = normalizeOptionSet(JSON.parse(JSON.stringify(set)), KEY)
    assert.deepEqual(
      client.visibleOptions(stored).map((option) => option.id),
      ["abc"]
    )
    assert.equal(client.visibleOptions(null).length, 0)
  })

  check("the baseline can never become the active option", () => {
    const stored = normalizeOptionSet(
      { ...set, activeOptionId: client.BASELINE_OPTION_ID },
      KEY
    )
    // The server only keeps an active id that names a real option, and the
    // client filters the baseline out of every list, so nothing can select it.
    assert.equal(stored.activeOptionId, client.BASELINE_OPTION_ID)
    assert.equal(
      client.visibleOptions(stored).some((option) => option.id === stored.activeOptionId),
      false
    )
  })

  check("a set with only a baseline reads as having no options", () => {
    const stored = normalizeOptionSet({ ...set, activeOptionId: null, options: [baseline] }, KEY)
    assert.equal(client.visibleOptions(stored).length, 0)
    assert.notEqual(client.baselineOf(stored, KEY), null)
  })
}

/**
 * Everything the options subsystem now draws, in the two places it draws it.
 *
 * One bundle for both surfaces and for `core/store`, so the state these cases
 * write is the state the panels read. Loading each entry point separately would
 * give every module its own copy of the store and the writes would land
 * nowhere — which is also why the Controls pane's scope chip has to be driven
 * through the same `setState` the right panel's button calls.
 */
async function surfaceCases() {
  const { build } = await import("esbuild")
  const bundled = await build({
    stdin: {
      contents: `
        export { optionsSection } from "./src/options/panel"
        export { controlsTab } from "./src/panels/controls"
        export { getState, setState, subscribe, primarySelection } from "./src/core/store"
      `,
      resolveDir: PACKAGE_DIR,
      loader: "ts",
    },
    bundle: true,
    format: "esm",
    write: false,
    logLevel: "silent",
  })
  return import(
    `data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`
  )
}

/** The right panel's Saved styles section, with the verbs now inside it. */
function savedStylesCases(surface) {
  console.log("\nSaved styles, in the inspector")

  // No control store on this window, so nothing is bound to the element and the
  // only thing that can populate the list is a saved style.
  delete globalThis.window.__STORE
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => ({ ok: true, json: async () => ({}) })

  const element = globalThis.document.createElement("div")
  globalThis.document.body.append(element)
  const KEY = "panel-cases:1"
  const context = {
    editor: {
      apiBase: "http://127.0.0.1:0/api",
      toast() {},
      getState: surface.getState,
      setState: surface.setState,
    },
    writer: { setStyle() {}, setClassName() {} },
    selection: { key: KEY, element, componentName: "Card", tagName: "div", source: null },
    computed: globalThis.window.getComputedStyle(element),
    invalidate() {},
  }
  // The title is a span beside the fold button rather than inside it: the
  // chevron moved to the trailing edge, so the button holds no text of its own.
  const heading = (node) => node?.querySelector(".de-section-title")?.textContent.trim()
  const verbs = (node) =>
    Array.from(node.querySelectorAll(".de-opt-actions button")).map((button) => button.textContent.trim())
  const withNothingSaved = () => {
    surface.setState({ optionSets: {} })
    return surface.optionsSection(context)
  }
  const withOneSaved = () => {
    surface.setState({
      optionSets: {
        [KEY]: {
          key: KEY,
          activeOptionId: "opt-1",
          options: [{ id: "opt-1", name: "Compact", className: "p-2", style: {}, createdAt: 1 }],
        },
      },
    })
    return surface.optionsSection(context)
  }

  /*
   * The claim the whole rearrangement rests on. The section used to vanish on
   * an element with nothing saved, and the only control that can ever create a
   * first saved style lived nine sections below it as a consequence. If the box
   * can disappear again, the verbs have to leave again.
   */
  check("an element with nothing saved still gets the box its verbs live in", () => {
    const node = withNothingSaved()
    assert.ok(node, "the section vanished on the one element that most needs its Save button")
    assert.equal(verbs(node).length, 3, `the verbs are ${JSON.stringify(verbs(node))}`)
    const text = node.querySelector(".de-empty").textContent
    assert.match(text, RECOVERY, `the empty list names no action: ${text}`)
  })

  check("the three verbs sit above the list rather than nine sections below it", () => {
    const node = withOneSaved()
    const row = node.querySelector(".de-opt-actions")
    const list = node.querySelector('[role="radiogroup"]')
    assert.ok(row && list)
    // `compareDocumentPosition` rather than an index, so this keeps holding if
    // a helper line or another child lands between the two.
    assert.ok(
      row.compareDocumentPosition(list) & globalThis.window.Node.DOCUMENT_POSITION_FOLLOWING,
      "the list is drawn before the verbs that act on it"
    )
    assert.equal(node.querySelector(".de-inspector-footer"), null, "the footer is still drawn")
  })

  /*
   * A natively disabled button leaves the tab order and stops receiving pointer
   * events, so the `title` explaining why it is greyed can never open — the
   * reason becomes readable exactly when it stops being needed. Both halves are
   * asserted: that the attribute is not used, and that a reason is on screen.
   */
  check("a verb that cannot run stays reachable and says why in visible text", () => {
    const node = withNothingSaved()
    const [save, update, revert] = node.querySelectorAll(".de-opt-actions button")
    assert.equal(save.getAttribute("aria-disabled"), "false")
    assert.equal(update.getAttribute("aria-disabled"), "true")
    assert.equal(revert.getAttribute("aria-disabled"), "true")
    for (const button of [save, update, revert]) {
      assert.equal(button.disabled, false, `${button.textContent} is natively disabled`)
    }
    const reason = node.querySelector(".de-opt-reason")
    assert.ok(reason, "two greyed buttons and nothing on screen saying what would un-grey them")
    assert.match(reason.textContent, RECOVERY)
  })

  check("an unavailable verb does nothing when pressed", () => {
    const node = withNothingSaved()
    const revert = Array.from(node.querySelectorAll(".de-opt-actions button")).at(-1)
    // No throw and no state change is the whole of the guarantee: `aria-disabled`
    // does not stop the click the way `disabled` would, so the handler has to.
    revert.dispatchEvent(new globalThis.window.MouseEvent("click", { bubbles: true }))
    assert.deepEqual(surface.getState().optionSets, {})
  })

  /*
   * The heading used to add two unrelated populations — bound controls plus
   * saved styles — so a single saved style under a container read "Design
   * options (178)". A count is a promise about the list beneath it.
   */
  check("the heading counts the list under it and nothing else", () => {
    assert.equal(heading(withOneSaved()), "Saved styles (1)")
    assert.equal(heading(withNothingSaved()), "Saved styles")
  })

  check("no control touches the element, so no way out to the controls is offered", () => {
    const node = withOneSaved()
    const labels = Array.from(node.querySelectorAll("button")).map((b) => b.textContent.trim())
    assert.ok(
      labels.every((label) => !/app control/.test(label)),
      `a button promises controls that do not exist: ${JSON.stringify(labels)}`
    )
  })

  check("the row's delete control calls the thing a saved style, like the list above it", () => {
    const remove = withOneSaved().querySelector(".de-option-delete")
    const title = remove.getAttribute("title") ?? ""
    assert.match(title, /saved style/)
    // One `ElementOption` used to be a "saved option" in the list and a "saved
    // variant" on this button — and "variant" is the host's word for a control's
    // named choices, which is a different thing entirely.
    assert.doesNotMatch(title, /variant|option/i, `the delete control still says: ${title}`)
  })

  /*
   * With a control store present, the trailing button appears, counts what it
   * promises, and does the one thing it says: open the Controls tab scoped to
   * this element. Asserted on the store write rather than on a rendered pane,
   * because the pane is in the other panel and the store is how they meet.
   */
  check("the way out to the app controls counts them and scopes the pane it opens", () => {
    globalThis.window.__STORE = stubStore(SAMPLE, SAMPLE_VISIBLE)
    element.setAttribute("data-card", "")
    surface.setState({ leftTab: "layers", controlsScope: "all", layersOpen: false })
    try {
      const node = withNothingSaved()
      const browse = Array.from(node.querySelectorAll("button")).find((button) =>
        /app control/.test(button.textContent)
      )
      assert.ok(browse, "no way from a bound element to the controls that bind it")
      assert.match(browse.textContent, /^Browse \d+ app controls?$/)
      assert.match(browse.textContent, /^Browse 2 /, `the count is wrong: ${browse.textContent}`)
      browse.dispatchEvent(new globalThis.window.MouseEvent("click", { bubbles: true }))
      assert.equal(surface.getState().leftTab, "controls")
      assert.equal(surface.getState().controlsScope, "selection")
      assert.equal(surface.getState().layersOpen, true, "it opened a tab in a closed panel")
    } finally {
      element.removeAttribute("data-card")
      delete globalThis.window.__STORE
      surface.setState({ controlsScope: "all" })
    }
  })

  check("one control bound reads as one control, not as one controls", () => {
    globalThis.window.__STORE = stubStore(
      { "Overview.Hover.hoverScale": SAMPLE["Overview.Hover.hoverScale"] },
      ["Overview.Hover.hoverScale"]
    )
    element.setAttribute("data-card", "")
    try {
      const browse = Array.from(withNothingSaved().querySelectorAll("button")).find((button) =>
        /app control/.test(button.textContent)
      )
      assert.equal(browse.textContent.trim(), "Browse 1 app control")
    } finally {
      element.removeAttribute("data-card")
      delete globalThis.window.__STORE
    }
  })

  globalThis.fetch = originalFetch
  element.remove()
}

/**
 * The left panel's Controls pane — the docked replacement for the window.
 *
 * Driven through the real `controlsTab` rather than by calling its internals,
 * because most of what changed here is wiring: whether the pane needs a
 * selection to exist at all, whether the scope chips reach the store the right
 * panel's button also writes, and whether the buttons in an empty state are
 * joined up to the field or the chip that caused it.
 */
function controlsPaneCases(surface) {
  console.log("\nThe Controls pane, in the left panel")

  const { window } = globalThis
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => ({ ok: true, json: async () => ({}) })

  let selection = null
  const editor = {
    apiBase: "http://127.0.0.1:0/api",
    toast() {},
    getState: surface.getState,
    setState: surface.setState,
    subscribe: surface.subscribe,
    primarySelection: () => selection,
  }

  window.__STORE = stubStore(SAMPLE, SAMPLE_VISIBLE)
  surface.setState({ controlsScope: "all" })
  const tab = surface.controlsTab(editor)
  window.document.body.append(tab.node)
  tab.update()

  const filter = () => tab.node.querySelector(".de-opt-filter")
  const chip = (label) =>
    Array.from(tab.node.querySelectorAll('[role="radio"]')).find(
      (button) => button.textContent.trim() === label
    )
  const empty = () => tab.node.querySelector(".de-empty")
  const rows = () => tab.node.querySelectorAll(".de-opt-row")
  const press = (node) => node.dispatchEvent(new window.MouseEvent("click", { bubbles: true }))

  /*
   * The requirement the deleted window's own header gave as the reason it
   * mounted on `document.body`: a list of everything the app exposes must not
   * require picking something first. It is satisfied here by a pane in a tab
   * strip, which is what made the window redundant rather than merely ugly.
   */
  check("the list is fully readable with nothing selected", () => {
    assert.equal(editor.primarySelection(), null)
    assert.ok(rows().length > 0, "the pane needs a selection to show anything")
    assert.equal(empty(), null)
  })

  check("nothing is mounted over the app, and nothing here is a dialog", () => {
    assert.equal(window.document.querySelector(".de-opt-window"), null)
    assert.equal(window.document.querySelector(".de-options-root"), null)
    assert.equal(tab.node.querySelector('[role="dialog"]'), null)
    assert.equal(tab.node.getAttribute("role"), null)
  })

  /*
   * A native `disabled` would take the chip out of the accessibility tree's
   * reach and take the explanation with it. The chip stays, the reason is on
   * screen beside it, and pressing it changes nothing.
   */
  check("with nothing selected the element scope is refused out loud, not removed", () => {
    const element = chip("This element")
    assert.equal(element.getAttribute("aria-disabled"), "true")
    assert.equal(element.disabled, false, "the chip is natively disabled")
    const reason = tab.node.querySelector(".de-opt-reason")
    assert.equal(reason.hidden, false)
    assert.match(reason.textContent, RECOVERY)
    press(element)
    assert.equal(surface.getState().controlsScope, "all")
    assert.equal(chip("All").getAttribute("aria-checked"), "true")
  })

  check("selecting an element makes the scope available and takes the reason away", () => {
    const node = window.document.createElement("div")
    window.document.body.append(node)
    selection = { key: "k", element: node, componentName: "Card", tagName: "div", source: null }
    tab.update()
    assert.equal(chip("This element").getAttribute("aria-disabled"), "false")
    assert.equal(tab.node.querySelector(".de-opt-reason").hidden, true)
    node.remove()
  })

  /*
   * Bindings are opt-in, so "this element" finding nothing is an ordinary state
   * rather than a fault — which means it has to say what bindings are and hand
   * back the view that does have rows in it.
   */
  check("a scope that matches nothing explains itself and offers the way back", () => {
    const node = window.document.createElement("div")
    window.document.body.append(node)
    selection = { key: "k", element: node, componentName: "Card", tagName: "div", source: null }
    press(chip("This element"))
    assert.equal(surface.getState().controlsScope, "selection")
    assert.equal(rows().length, 0)
    const text = empty().textContent
    assert.match(text, /binding/i, `the empty scope does not say where bindings come from: ${text}`)
    const back = empty().querySelector("button")
    assert.ok(back, "a scope with nothing in it offers no way out of itself")
    press(back)
    assert.equal(surface.getState().controlsScope, "all")
    assert.ok(rows().length > 0, "the rows did not come back")
    node.remove()
  })

  check("scoping to a bound element keeps its controls and drops the rest", () => {
    const node = window.document.createElement("div")
    node.setAttribute("data-card", "")
    window.document.body.append(node)
    selection = { key: "k", element: node, componentName: "Card", tagName: "div", source: null }
    const all = rows().length
    press(chip("This element"))
    assert.ok(rows().length > 0, "a bound element scoped to nothing")
    assert.ok(rows().length < all, "scoping the list did not prune it")
    press(chip("All"))
    node.remove()
    selection = null
    tab.update()
  })

  check("a filter that matches nothing hands back the control that undoes it", () => {
    filter().value = "zzzz"
    filter().dispatchEvent(new window.Event("input", { bubbles: true }))
    const miss = empty()
    assert.match(miss.textContent, /zzzz/, "the miss does not name what was typed")
    assert.equal(miss.getAttribute("role"), "status")
    const clear = miss.querySelector("button")
    assert.ok(clear, "a filter that matched nothing offers no way out of itself")
    press(clear)
    assert.equal(filter().value, "", "the button in the empty state does not clear the filter")
    assert.ok(rows().length > 0, "the rows did not come back")
    // Pressing it is what removes it from the document, so focus has to land
    // somewhere deliberate or the keyboard is dropped on the pane's body.
    assert.equal(window.document.activeElement, filter())
  })

  check("a host with no control panel gets a headline, a reason and a way forward", () => {
    delete window.__STORE
    const config = globalThis.__DESIGNLAYER_CONFIG__
    globalThis.__DESIGNLAYER_CONFIG__ = {}
    try {
      tab.update()
      const state = empty()
      assert.equal(state.getAttribute("role"), "status")
      assert.ok(state.querySelector(".de-empty-title"), "no headline over the explanation")
      assert.match(state.textContent, RECOVERY)
      assert.doesNotMatch(state.textContent, RAW_DIAGNOSTIC)
    } finally {
      globalThis.__DESIGNLAYER_CONFIG__ = config
      window.__STORE = stubStore(SAMPLE, SAMPLE_VISIBLE)
    }
  })

  /*
   * Invariant 5, scoped to what a rebuild can actually reach. The filter and
   * the chips outlive every render, so typing must not block the repaint the
   * typing asked for; a control inside a row must.
   */
  check("a rebuild is declined only while a row control holds focus", () => {
    tab.update()
    const input = tab.node.querySelector(".de-opt-input")
    assert.ok(input, "no editable row to hold focus")
    input.focus()
    filter().value = "zzzz"
    tab.update()
    assert.equal(empty(), null, "the pane rebuilt out from under a focused field")
    filter().value = ""
    filter().focus()
    tab.update()
    assert.ok(rows().length > 0, "typing in the filter blocked the render it asked for")
  })

  tab.node.remove()
  delete window.__STORE
  globalThis.fetch = originalFetch
}

const inventory = await inventoryCases()
prototypeCases(inventory)
await sourceDefaultCases()
await writerCases()
await baselineCases()
const surface = await surfaceCases()
savedStylesCases(surface)
controlsPaneCases(surface)

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
