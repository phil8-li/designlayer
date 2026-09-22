/**
 * The Figma keymap: what each key means, and the one rule that is not Figma's.
 *
 * Three things are asserted here and each of them is a way this feature breaks
 * silently rather than loudly:
 *
 *  1. THE TABLE IS COHERENT. No two rows claim the same chord, every row points
 *     at a command some lane registers, and the chords that a modifier rewrites
 *     on a Mac are matched on `event.code` rather than on `event.key`. That
 *     last one is the bug this suite exists for: ⌥8 reports `"•"` and ⇧2
 *     reports `"@"`, so a row written against `key` works on the machine it was
 *     written on and on no other layout.
 *  2. THE COLLAPSE RULE HOLDS. Bare letters are a loan from the page underneath
 *     and the editor gives them back the moment it stands down to the disc.
 *     ⌘. is the single exception, because it is the way back. A regression here
 *     is invisible in the editor and breaks somebody else's prototype.
 *  3. THE KEYS ACTUALLY DRIVE THE EDITOR. Matching is pure and easy to get
 *     right; the wire from a key press to a mode change runs through a registry
 *     and a capture listener, and that is the half that rots.
 *
 * Usage: node designlayer/test/shortcut-cases.mjs
 */

import assert from "node:assert/strict"
import fs from "node:fs"
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

const dom = new JSDOM(
  '<!doctype html><html><body><main id="app"><button id="cta">Go</button>' +
    '<input id="field" /></main></body></html>',
  { pretendToBeVisual: true, url: "http://localhost/" }
)
const { window } = dom
// The product runs on a Mac and the interesting half of the matcher is the Mac
// half — ⌘ against ⌃, and the characters ⌥ and ⇧ rewrite. One case flips this.
const platform = (value) =>
  Object.defineProperty(window.navigator, "platform", { value, configurable: true })
platform("MacIntel")
window.document.elementsFromPoint = () => []
window.Element.prototype.getBoundingClientRect = function box() {
  return { x: 0, y: 0, left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100 }
}
window.Element.prototype.scrollIntoView = function noop() {}
globalThis.DOMMatrixReadOnly = class {
  constructor() {
    this.m41 = 0
    this.m42 = 0
  }
}
for (const key of [
  "window",
  "document",
  "navigator",
  "Node",
  "Element",
  "HTMLElement",
  "SVGElement",
  "SVGSVGElement",
  "Event",
  "CustomEvent",
  "MouseEvent",
  "KeyboardEvent",
  "PointerEvent",
  "requestAnimationFrame",
  "cancelAnimationFrame",
  "getComputedStyle",
  "localStorage",
]) {
  Object.defineProperty(globalThis, key, { value: window[key], configurable: true, writable: true })
}

/** One bundle: the command registry is module state every lane has to share. */
const { build } = await import("esbuild")
const bundled = await build({
  stdin: {
    contents: `
      export { createContext } from "./src/core/context"
      export { installToolbar } from "./src/shell/toolbar"
      export { installShortcuts } from "./src/shell/shortcuts"
      export { installCanvas } from "./src/canvas/index"
      export * as keymap from "./src/core/keymap"
      export * as commands from "./src/core/commands"
      export * as store from "./src/core/store"
    `,
    resolveDir: PACKAGE_DIR,
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  write: false,
  logLevel: "silent",
})
const editor = await import(
  `data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`
)
const { keymap, commands, store } = editor
const { SHORTCUTS, chordLabel, matchShortcut, shortcutFor } = keymap

/** A chord, spelled as the event a browser would dispatch for it. */
function press(chord, target = window.document.getElementById("cta")) {
  const mac = /Mac/.test(window.navigator.platform)
  const event = new window.KeyboardEvent("keydown", {
    key: chord.key ?? keyForCode(chord),
    code: chord.code ?? "",
    metaKey: mac ? Boolean(chord.mod) : false,
    ctrlKey: mac ? Boolean(chord.ctrl) : Boolean(chord.mod) || Boolean(chord.ctrl),
    shiftKey: Boolean(chord.shift),
    altKey: Boolean(chord.alt),
    bubbles: true,
    cancelable: true,
  })
  Object.defineProperty(event, "target", { value: target, configurable: true })
  return event
}

/**
 * What macOS actually puts in `event.key` for the code chords in the table.
 *
 * Not a guess: these are the characters a US layout produces, and they are the
 * whole reason those rows match on `code`. A test that sent the unshifted digit
 * would pass against a `key` matcher too, and prove nothing.
 */
const MAC_KEY_FOR_CODE = {
  "Digit1:alt": "¡",
  "Digit2:alt": "™",
  "Digit2:shift": "@",
  "Digit3:alt": "£",
  "Digit8:alt": "•",
  "Digit9:alt": "ª",
  "Digit0:alt": "º",
  "BracketLeft:mod": "[",
  "BracketRight:mod": "]",
  "BracketLeft:mod:alt": "“",
  "BracketRight:mod:alt": "‘",
  "Backslash:mod:shift": "|",
  "Slash:ctrl:shift": "?",
  // ⌥C on a US Mac layout is a cedilla, which is the whole reason it matches on code.
  "KeyC:mod:alt": "ç",
}
function keyForCode(chord) {
  const flags = ["ctrl", "mod", "alt", "shift"].filter((flag) => chord[flag])
  return MAC_KEY_FOR_CODE[[chord.code, ...flags].join(":")] ?? chord.code ?? ""
}

// ── The table ──────────────────────────────────────────────────────────────

console.log("\nThe table")

check("no two rows claim the same chord", () => {
  const seen = new Map()
  for (const shortcut of SHORTCUTS) {
    for (const chord of [shortcut.chord, ...(shortcut.aliases ?? [])]) {
      const spelling = JSON.stringify([
        chord.key ?? null,
        chord.code ?? null,
        Boolean(chord.mod),
        Boolean(chord.ctrl),
        Boolean(chord.shift),
        Boolean(chord.alt),
      ])
      const owner = seen.get(spelling)
      assert.equal(
        owner,
        undefined,
        `${chordLabel(chord)} is claimed by both ${owner} and ${shortcut.command}`
      )
      seen.set(spelling, shortcut.command)
    }
  }
})

check("every row names a Figma command it came from", () => {
  for (const shortcut of SHORTCUTS) {
    assert.ok(shortcut.figma, `${shortcut.command} has no Figma lineage recorded`)
    assert.ok(shortcut.label, `${shortcut.command} has no label`)
  }
})

check("a chord a modifier rewrites is matched on the physical key", () => {
  /*
   * The bug this file exists for. On a Mac ⌥8 is "•" and ⇧2 is "@", so a row
   * written against `event.key` matches nothing a real keyboard sends.
   */
  for (const shortcut of SHORTCUTS) {
    for (const chord of [shortcut.chord, ...(shortcut.aliases ?? [])]) {
      if (!chord.key) continue
      const rewritten = (chord.alt || chord.shift) && /^[a-z0-9\\[\]/.]$/.test(chord.key)
      // Letters are exempt: ⇧V is still "v" with shiftKey set, and a letter is
      // deliberately matched where the user believes it is on their layout.
      const isLetter = /^[a-z]$/.test(chord.key)
      assert.ok(
        !rewritten || isLetter,
        `${shortcut.command} matches "${chord.key}" under a modifier that rewrites it — use code`
      )
    }
  }
})

check("⌥8 is recognised from the character macOS actually sends", () => {
  const hit = matchShortcut(press({ code: "Digit8", alt: true }))
  assert.equal(hit?.command, "panel.inspector.tab1")
})

check("⇧2 is recognised, and is not ⌥2", () => {
  assert.equal(matchShortcut(press({ code: "Digit2", shift: true }))?.command, "select.reveal")
  assert.equal(matchShortcut(press({ code: "Digit2", alt: true }))?.command, "panel.left.tab2")
})

check("modifiers are exact, so ⌘] and ⌥⌘] are two commands", () => {
  assert.equal(matchShortcut(press({ code: "BracketRight", mod: true }))?.command, "arrange.forward")
  assert.equal(
    matchShortcut(press({ code: "BracketRight", mod: true, alt: true }))?.command,
    "arrange.front"
  )
})

check("a modifier nobody asked for makes it somebody else's key", () => {
  // ⌃⌘Z on a Mac is not undo. It has to fall through rather than be eaten.
  assert.equal(matchShortcut(press({ key: "z", mod: true, ctrl: true })), null)
  assert.equal(matchShortcut(press({ key: "v", mod: true })), null)
})

check("the three modes are V, C and H, and A is a second V", () => {
  assert.equal(matchShortcut(press({ key: "v" }))?.command, "mode.inspect")
  assert.equal(matchShortcut(press({ key: "a" }))?.command, "mode.inspect")
  assert.equal(matchShortcut(press({ key: "c" }))?.command, "mode.notes")
  assert.equal(matchShortcut(press({ key: "h" }))?.command, "mode.interactive")
})

check("a chord prints the way a designer writes it down", () => {
  assert.equal(chordLabel({ key: "v" }, true), "V")
  assert.equal(chordLabel({ code: "Digit1", alt: true }, true), "⌥1")
  assert.equal(chordLabel({ code: "Digit1", alt: true }, false), "Alt+1")
  assert.equal(chordLabel({ key: "z", mod: true, shift: true }, true), "⇧⌘Z")
  assert.equal(chordLabel({ key: "z", mod: true, shift: true }, false), "Ctrl+Shift+Z")
  assert.equal(chordLabel({ code: "BracketRight", mod: true, alt: true }, true), "⌥⌘]")
  assert.equal(chordLabel({ code: "Slash", ctrl: true, shift: true }, true), "⌃⇧?")
  // The unshifted character, because that is the key you are told to press.
  assert.equal(chordLabel({ code: "Digit2", shift: true }, true), "⇧2")
})

// ── The rule that is not Figma's ───────────────────────────────────────────

console.log("\nA collapsed editor gives the keyboard back")

check("every bare key goes quiet while the chrome is hidden", () => {
  for (const shortcut of SHORTCUTS) {
    if (shortcut.owner === "canvas") continue
    const live = shortcutFor(press(shortcut.chord), true)
    if (shortcut.whileHidden) {
      assert.equal(live?.command, shortcut.command, `${shortcut.command} must survive a collapse`)
    } else {
      assert.equal(live, null, `${shortcut.command} still fires with the editor collapsed`)
    }
  }
})

check("exactly one shortcut survives the collapse, and it is the way back", () => {
  const survivors = SHORTCUTS.filter((shortcut) => shortcut.whileHidden)
  assert.deepEqual(
    survivors.map((shortcut) => shortcut.command),
    ["chrome.toggle"],
    "a second key that works while the editor is invisible is a key stolen from the prototype"
  )
})

check("every key is live again once the chrome is back", () => {
  assert.equal(shortcutFor(press({ key: "c" }), false)?.command, "mode.notes")
  assert.equal(shortcutFor(press({ key: "c" }), true), null)
})

check("typing in a field is typing, hidden or not", () => {
  const field = window.document.getElementById("field")
  assert.equal(shortcutFor(press({ key: "v" }, field), false), null)
  assert.equal(shortcutFor(press({ key: "c" }, field), false), null)
  assert.equal(shortcutFor(press({ key: ".", mod: true }, field), false), null)
})

check("the canvas keeps its own five, so they are documented and not dispatched", () => {
  const owned = SHORTCUTS.filter((shortcut) => shortcut.owner === "canvas")
  assert.ok(owned.length >= 5, "the navigation keys should be listed here")
  for (const shortcut of owned) {
    assert.equal(
      shortcutFor(press(shortcut.chord), false),
      null,
      `${shortcut.command} is the canvas lane's and must not be dispatched twice`
    )
  }
})

// ── The wire from a key press to the editor ────────────────────────────────

console.log("\nThe keys drive the editor")

const bridge = {
  elementInfo: () => null,
  send() {},
  toast() {},
  subscribe: () => () => {},
  store: {
    setActiveTool() {},
    hasChanges: () => false,
    buildBatchOperations: () => [],
    onStateChange() {},
    getCanvasTransform: () => ({ x: 0, y: 0, scale: 1 }),
    viewportToPage: (x, y) => ({ x, y }),
    pageToViewport: (x, y) => ({ x, y }),
    addPendingPropertyOperation() {},
  },
}

const slot = () => {
  const node = window.document.createElement("div")
  node.setAttribute("data-designlayer", "")
  window.document.body.append(node)
  return node
}
const toolbarSlot = slot()
const context = editor.createContext(bridge, {
  overlay: slot(),
  toolbar: toolbarSlot,
  left: slot(),
  right: slot(),
})
editor.installToolbar(context)
editor.installShortcuts(context)
/*
 * The canvas lane is mounted too, and only Escape needs it.
 *
 * Escape's escalation is a handshake between two lanes — the canvas cancels the
 * event when it clears a selection, and the shell collapses only on a press
 * nobody cancelled. Stubbing either half would assert the stub. With both real,
 * a canvas that stops cancelling, or a shell that stops checking, fails here.
 */
editor.installCanvas(context)

/** A real dispatch, so the capture listener and its guards are in the path. */
const type = (chord, target) => window.dispatchEvent(press(chord, target))

/**
 * The same press, from a focused element rather than from `window`.
 *
 * Escape's last step listens on the BUBBLE phase, and a dispatch aimed at
 * `window` has no phases — every listener on it runs AT_TARGET, in registration
 * order. Sending from a node in the page is what puts capture genuinely before
 * bubble, which is the whole mechanism under test.
 */
const from = (target, chord = { key: "Escape" }) => {
  const event = press(chord, target)
  target.dispatchEvent(event)
  return event
}

check("V, C and H move between the three modes", () => {
  type({ key: "c" })
  assert.equal(store.editorMode(), "annotating")
  type({ key: "h" })
  assert.equal(store.editorMode(), "interactive")
  type({ key: "v" })
  assert.equal(store.editorMode(), "inspecting")
  type({ key: "a" })
  assert.equal(store.editorMode(), "inspecting", "A is a second key for Inspect")
})

check("pressing the mode you are in is a no-op, not a toggle", () => {
  context.setMode("annotating")
  type({ key: "c" })
  assert.equal(store.editorMode(), "annotating", "Figma's tool keys are safe to mash")
  context.setMode("inspecting")
})

/*
 * The tab keys are positional, and the PANELS register them — see the note in
 * `core/keymap.ts` for why the names moved out of the table. This suite owns
 * the wire from a key to a command, so it stands in for the panels with spies:
 * whether `panels/left.ts` really registers `panel.left.tab2` is asserted
 * separately below, against the source of truth rather than against a mock.
 */
const fired = []
let drop3 = () => {}
for (const slot of [1, 2, 3]) {
  const off = commands.registerCommand(`panel.left.tab${slot}`, () => fired.push(`left${slot}`))
  if (slot === 3) drop3 = off
  commands.registerCommand(`panel.inspector.tab${slot}`, () => fired.push(`right${slot}`))
}

check("⌥1 / ⌥2 / ⌥3 reach the left panel's first three views", () => {
  fired.length = 0
  type({ code: "Digit1", alt: true })
  type({ code: "Digit2", alt: true })
  type({ code: "Digit3", alt: true })
  assert.deepEqual(fired, ["left1", "left2", "left3"])
})

check("⌥8 / ⌥9 / ⌥0 reach the inspector's first three views", () => {
  fired.length = 0
  type({ code: "Digit8", alt: true })
  type({ code: "Digit9", alt: true })
  type({ code: "Digit0", alt: true })
  assert.deepEqual(fired, ["right1", "right2", "right3"])
})

check("a panel names its own tabs, so a tab key survives the set changing", () => {
  /*
   * The regression that produced the positional design. Both panels register by
   * SLOT, so read that out of their source rather than trusting a mock — a
   * panel that goes back to registering `panel.left.assets` passes every case
   * above and still leaves ⌥2 dead the next time a tab is renamed.
   */
  const read = (file) =>
    fs.readFileSync(path.join(PACKAGE_DIR, file), "utf8").replace(/\/\*[\s\S]*?\*\//g, "")
  assert.match(
    read("src/panels/left.ts"),
    /registerCommand\(`panel\.left\.tab\$\{index \+ 1\}`/,
    "the left panel must register its tab keys by slot"
  )
  assert.match(
    read("src/panels/inspector/index.ts"),
    /registerCommand\(`panel\.inspector\.tab\$\{index \+ 1\}`/,
    "the inspector must register its tab keys by slot"
  )
  for (const file of ["src/shell/shortcuts.ts", "src/core/keymap.ts"]) {
    assert.doesNotMatch(
      read(file),
      /"panel\.(left|inspector)\.(layers|assets|system|design|changes|code)"/,
      `${file} names a tab by id again — the panel owns which tabs exist`
    )
  }
})

check("⌘. hides the editor and brings it back", () => {
  assert.equal(context.getState().chromeHidden, false)
  type({ key: ".", mod: true })
  assert.equal(context.getState().chromeHidden, true)
  type({ key: ".", mod: true })
  assert.equal(context.getState().chromeHidden, false)
})

check("\\ hides the editor, and does nothing once it is hidden", () => {
  type({ key: "\\" })
  assert.equal(context.getState().chromeHidden, true)
  type({ key: "\\" })
  assert.equal(context.getState().chromeHidden, true, "a bare key must not work while collapsed")
  type({ key: ".", mod: true })
  assert.equal(context.getState().chromeHidden, false)
})

check("a bare letter reaches the prototype again once the editor is collapsed", () => {
  context.setMode("inspecting")
  context.setChromeHidden(true)
  const event = press({ key: "c" })
  window.dispatchEvent(event)
  assert.equal(store.editorMode(), "inspecting", "the mode must not have changed")
  assert.equal(event.defaultPrevented, false, "the key must be left for the page")
  context.setChromeHidden(false)
})

check("a key the editor answers is taken off the page", () => {
  const event = press({ key: "c" })
  window.dispatchEvent(event)
  assert.equal(event.defaultPrevented, true)
  context.setMode("inspecting")
})

check("⇧⌘\\ toggles the left panel", () => {
  const before = context.getState().layersOpen
  type({ code: "Backslash", mod: true, shift: true })
  assert.equal(context.getState().layersOpen, !before)
  type({ code: "Backslash", mod: true, shift: true })
  assert.equal(context.getState().layersOpen, before)
})

check("⌃⇧? opens the shortcuts sheet and Escape closes it", () => {
  const sheet = () => window.document.querySelector(".de-shortcuts")
  assert.equal(sheet(), null)
  type({ code: "Slash", ctrl: true, shift: true })
  assert.ok(sheet(), "the sheet did not open")
  window.dispatchEvent(press({ key: "Escape" }))
  assert.equal(sheet(), null, "Escape did not close it")
})

check("the sheet is generated from the table, not written out by hand", () => {
  type({ code: "Slash", ctrl: true, shift: true })
  const text = window.document.querySelector(".de-shortcuts").textContent
  for (const shortcut of SHORTCUTS) {
    if (shortcut.owner !== "canvas" && !commands.hasCommand(shortcut.command)) continue
    assert.ok(text.includes(shortcut.label), `the sheet omits ${shortcut.command}`)
  }
  assert.ok(text.includes("⌥1"), "the sheet omits a key it should print")
  window.dispatchEvent(press({ key: "Escape" }))
})

check("a key with nothing behind it is left out of the sheet", () => {
  /*
   * A two-tab panel leaves ⌥3 unregistered and the key falls through to the
   * page, so the row must not be printed — a sheet that advertises a dead key
   * is worse than one that is short.
   */
  const label = SHORTCUTS.find((s) => s.command === "panel.left.tab3").label
  type({ code: "Slash", ctrl: true, shift: true })
  assert.ok(
    window.document.querySelector(".de-shortcuts").textContent.includes(label),
    "a registered slot should be listed"
  )
  window.dispatchEvent(press({ key: "Escape" }))

  drop3()
  type({ code: "Slash", ctrl: true, shift: true })
  assert.equal(
    window.document.querySelector(".de-shortcuts").textContent.includes(label),
    false,
    "an unregistered slot is still advertised in the sheet"
  )
  window.dispatchEvent(press({ key: "Escape" }))
})

check("a chord whose lane is not mounted leaves the key to the page", () => {
  /*
   * The conditional swallow. `select.all` is registered, so take one that is
   * not: the registry answers false and the event must come out uncancelled.
   */
  assert.equal(commands.hasCommand("nothing.here"), false)
  assert.equal(commands.runCommand("nothing.here"), false)
})

// ── Escape, and the order it means things in ───────────────────────────────

/*
 * One key, three meanings, and the ORDER is the feature. A press that collapsed
 * the editor while a sheet was up, or while something was selected, would take
 * away the two things Escape is for. Each case below is one step of the ladder,
 * and the last one is the rung a designer asked for: with nothing left to
 * dismiss, Escape stands the editor down to the disc.
 */
console.log("\nEscape escalates: close, deselect, collapse")

const cta = () => window.document.getElementById("cta")

check("with nothing left to dismiss, Escape collapses the editor", () => {
  context.setChromeHidden(false)
  store.setState({ selection: [], scope: null })
  const event = from(cta())
  assert.equal(context.getState().chromeHidden, true, "Escape did not stand the editor down")
  assert.equal(event.defaultPrevented, true, "the press must be marked as spent")
  context.setChromeHidden(false)
})

check("Escape deselects first, and the editor stays up", () => {
  context.setChromeHidden(false)
  store.setState({ selection: [{ element: cta() }], scope: null })
  from(cta())
  assert.deepEqual(context.getState().selection, [], "the canvas did not clear the selection")
  assert.equal(
    context.getState().chromeHidden,
    false,
    "one press deselected AND collapsed — the ladder has no rungs"
  )
  // And the next one, with nothing left, does collapse.
  from(cta())
  assert.equal(context.getState().chromeHidden, true)
  context.setChromeHidden(false)
})

check("a scope with no selection is still something to clear", () => {
  store.setState({ selection: [], scope: window.document.getElementById("app") })
  from(cta())
  assert.equal(context.getState().scope, null)
  assert.equal(context.getState().chromeHidden, false, "drilling out is not collapsing")
})

check("a surface that took the key keeps it", () => {
  const sheet = () => window.document.querySelector(".de-shortcuts")
  type({ code: "Slash", ctrl: true, shift: true })
  assert.ok(sheet(), "the sheet did not open")
  from(cta())
  assert.equal(sheet(), null, "Escape did not close the sheet")
  assert.equal(
    context.getState().chromeHidden,
    false,
    "closing the sheet also collapsed the editor"
  )
})

check("Escape in a field is the field's", () => {
  const event = from(window.document.getElementById("field"))
  assert.equal(context.getState().chromeHidden, false)
  assert.equal(event.defaultPrevented, false, "the key must be left to the input")
})

check("a collapsed editor gives Escape back to the page", () => {
  context.setChromeHidden(true)
  const event = from(cta())
  assert.equal(event.defaultPrevented, false, "Escape is the prototype's while we are a disc")
  assert.equal(context.getState().chromeHidden, true)
  context.setChromeHidden(false)
})

check("the way back is still ⌘., and Escape is not a second one", () => {
  const survivors = SHORTCUTS.filter((shortcut) => shortcut.whileHidden)
  assert.deepEqual(survivors.map((shortcut) => shortcut.command), ["chrome.toggle"])
  assert.equal(keymap.isCollapseFallback(press({ key: "Escape" }), true), false)
  assert.equal(keymap.isCollapseFallback(press({ key: "Escape" }), false), true)
})

// ── The platform ───────────────────────────────────────────────────────────

console.log("\nThe other platform")

check("Windows reads the accelerator as Ctrl", () => {
  platform("Win32")
  try {
    const event = new window.KeyboardEvent("keydown", { key: "z", ctrlKey: true })
    assert.equal(keymap.historyAction(event), "undo")
    const mac = new window.KeyboardEvent("keydown", { key: "z", metaKey: true })
    assert.equal(keymap.historyAction(mac), null, "⌘Z is not a Windows shortcut")
    assert.equal(chordLabel({ key: "." , mod: true }), "Ctrl+.")
  } finally {
    platform("MacIntel")
  }
})

console.log(`\n${passed} passed, ${failed} failed`)
if (failed) process.exitCode = 1
