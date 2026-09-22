/**
 * Optional bridge onto a host-configured Leva dev-time store.
 *
 * Nothing here imports Leva or guesses relationships from path names. The host
 * opts in with a store-global name and explicit path-pattern bindings; without
 * that contract this module is inert.
 */

import { round } from "../core/dom"

/** The slice of leva's `Store` we read. Structural on purpose — see above. */
interface LevaInputData {
  type?: unknown
  value?: unknown
  label?: unknown
  settings?: unknown
  disabled?: unknown
}

interface LevaStoreLike {
  getData(): Record<string, LevaInputData>
  getVisiblePaths(): string[]
  setValueAtPath(path: string, value: unknown, fromPanel: boolean): void
  useStore?: { subscribe(listener: () => void): () => void }
}

export interface LevaControlBinding {
  pathPattern: string
  selectors: string[]
  relationship: string
  defaultGroup: string | null
  defaultKey: string | null
}

interface ClientLevaConfig {
  storeGlobal: string
  sourceDefaults: boolean
  bindings: LevaControlBinding[]
}

/** One tunable leaf: concept (a) in the options taxonomy. */
export interface LevaControl {
  /** Dot path leva keys on, e.g. `Overview.Hover.hoverPreset`. */
  path: string
  key: string
  label: string
  type: string
  value: unknown
  valueText: string
  /**
   * Named variants — concept (f), and the thing a designer means by "the
   * options we built". Present only on SELECT controls.
   */
  variants: string[] | null
  variantValues: unknown[] | null
  bounds: { min: number | null; max: number | null; step: number | null } | null
  disabled: boolean
  /** Leva `render` predicates hide about a third of the panel at any moment. */
  visible: boolean
  /** Explicit host relationship; absent means the editor makes no relevance claim. */
  selectors: string[]
  relationship: string | null
  /** Source-default address, supplied by the matching host binding. */
  defaultGroup: string | null
  defaultKey: string | null
  canPersistDefault: boolean
}

/** A leva folder — concept (b). Sections are the depth-0 folders. */
export interface LevaFolder {
  name: string
  path: string
  folders: LevaFolder[]
  controls: LevaControl[]
  /** Carries a `save as default` button, i.e. it can hold concept (c)/(d). */
  hasSaveDefault: boolean
  controlCount: number
  variantCount: number
}

export interface LevaTree {
  sections: LevaFolder[]
  controlCount: number
  variantCount: number
  selectCount: number
}

export type LevaInventory = ({ available: true } & LevaTree) | { available: false; reason: string }

function levaConfig(): ClientLevaConfig | null {
  const raw = (globalThis as { __DESIGNLAYER_CONFIG__?: unknown }).__DESIGNLAYER_CONFIG__
  if (!raw || typeof raw !== "object") return null
  const controls = (raw as { controls?: unknown }).controls
  if (!controls || typeof controls !== "object") return null
  const leva = (controls as { leva?: unknown }).leva
  if (!leva || typeof leva !== "object") return null
  const shape = leva as Partial<ClientLevaConfig>
  if (typeof shape.storeGlobal !== "string" || !shape.storeGlobal) return null
  return {
    storeGlobal: shape.storeGlobal,
    sourceDefaults: shape.sourceDefaults === true,
    bindings: Array.isArray(shape.bindings) ? shape.bindings : [],
  }
}

function globPattern(pattern: string): RegExp {
  let source = "^"
  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index]
    if (char === "*" && pattern[index + 1] === "*") {
      source += ".*"
      index += 1
    } else if (char === "*") {
      source += "[^.]*"
    } else {
      source += char.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    }
  }
  return new RegExp(`${source}$`)
}

/** First explicit binding wins; path names never imply an element relationship. */
export function bindingForPath(
  path: string,
  bindings: readonly LevaControlBinding[] = levaConfig()?.bindings ?? []
): LevaControlBinding | null {
  for (const binding of bindings) {
    try {
      if (globPattern(binding.pathPattern).test(path)) return binding
    } catch {
      // A malformed host pattern disables that one binding, not the inventory.
    }
  }
  return null
}

/**
 * Paths come from the page. A `__proto__` segment written onto a plain object
 * reassigns the prototype instead of adding a folder, so every keyed lookup in
 * this module uses a null-prototype record — the same rule the server store
 * follows for element keys.
 */
export function nullIndex<T>(): Record<string, T> {
  return Object.create(null) as Record<string, T>
}

/**
 * `project-shell.tsx` needs ten distinct `save as default` labels inside one
 * schema and disambiguates them with trailing zero-width spaces, so the label
 * has to be normalised before it can be recognised or shown.
 */
export function plainLabel(value: unknown): string {
  return typeof value === "string" ? value.replace(/[\u200B-\u200D\uFEFF]/g, "").trim() : ""
}

function isSaveDefaultButton(type: string, label: string): boolean {
  return type === "BUTTON" && /^save as default$/i.test(label)
}

function readVariants(settings: unknown): { keys: string[]; values: unknown[] } | null {
  if (!settings || typeof settings !== "object") return null
  const shape = settings as { keys?: unknown; values?: unknown }
  if (!Array.isArray(shape.keys) || !Array.isArray(shape.values)) return null
  if (shape.keys.length === 0 || shape.keys.length !== shape.values.length) return null
  return { keys: shape.keys.map((key) => String(key)), values: shape.values }
}

function readBounds(settings: unknown): LevaControl["bounds"] {
  if (!settings || typeof settings !== "object") return null
  const shape = settings as { min?: unknown; max?: unknown; step?: unknown }
  const num = (raw: unknown) => (typeof raw === "number" && Number.isFinite(raw) ? raw : null)
  const bounds = { min: num(shape.min), max: num(shape.max), step: num(shape.step) }
  return bounds.min === null && bounds.max === null && bounds.step === null ? null : bounds
}

export function formatValue(value: unknown): string {
  if (typeof value === "number") return String(round(value, 3))
  if (typeof value === "string") return value === "" ? '""' : value
  if (typeof value === "boolean") return value ? "on" : "off"
  if (value === null || value === undefined) return "—"
  try {
    const text = JSON.stringify(value) ?? "—"
    return text.length > 64 ? `${text.slice(0, 61)}…` : text
  } catch {
    return "—"
  }
}

function emptyFolder(name: string, path: string): LevaFolder {
  return {
    name,
    path,
    folders: [],
    controls: [],
    hasSaveDefault: false,
    controlCount: 0,
    variantCount: 0,
  }
}

function rollUp(folder: LevaFolder): void {
  let controls = folder.controls.length
  let variants = 0
  for (const control of folder.controls) variants += control.variants?.length ?? 0
  for (const child of folder.folders) {
    rollUp(child)
    controls += child.controlCount
    variants += child.variantCount
  }
  folder.controlCount = controls
  folder.variantCount = variants
}

/**
 * Projects leva's flat `path -> input` map into the section/folder/control tree
 * the panel renders. Split out from `readInventory` so it can be exercised
 * against a stubbed store with no browser.
 */
export function buildTree(
  data: Record<string, LevaInputData>,
  visiblePaths: readonly string[] = [],
  bindings: readonly LevaControlBinding[] = levaConfig()?.bindings ?? []
): LevaTree {
  const sections: LevaFolder[] = []
  const byPath = nullIndex<LevaFolder>()
  const visible = new Set(visiblePaths)
  let selectCount = 0

  const folderAt = (segments: string[]): LevaFolder | null => {
    let siblings = sections
    let prefix = ""
    let node: LevaFolder | null = null
    for (const segment of segments) {
      prefix = prefix ? `${prefix}.${segment}` : segment
      let existing = byPath[prefix]
      if (!existing) {
        existing = emptyFolder(segment, prefix)
        byPath[prefix] = existing
        siblings.push(existing)
      }
      node = existing
      siblings = existing.folders
    }
    return node
  }

  // Visible paths carry leva's own render order; the rest are appended so a
  // control hidden behind a `render` predicate is still discoverable.
  const ordered = [...visiblePaths, ...Object.keys(data).filter((path) => !visible.has(path))]
  const seen = new Set<string>()

  for (const path of ordered) {
    if (seen.has(path)) continue
    seen.add(path)
    // `Object.hasOwn` rather than a truthiness test: a `__proto__` entry in
    // `visiblePaths` would otherwise resolve to `Object.prototype` and be
    // listed as a control.
    if (!Object.hasOwn(data, path)) continue
    const input = data[path]
    if (!input || typeof input !== "object") continue

    const segments = path.split(".")
    const key = segments.pop() ?? path
    const parent = folderAt(segments.length ? segments : ["(root)"])
    if (!parent) continue

    const type = typeof input.type === "string" ? input.type : "UNKNOWN"
    const label = plainLabel(input.label) || key

    if (isSaveDefaultButton(type, label)) {
      parent.hasSaveDefault = true
      continue
    }

    const variants = readVariants(input.settings)
    if (variants) selectCount += 1
    const binding = bindingForPath(path, bindings)
    const defaultGroup = binding?.defaultGroup ?? null
    const defaultKey = defaultGroup
      ? (binding?.defaultKey?.replaceAll("$key", key) ?? key)
      : null

    parent.controls.push({
      path,
      key,
      label,
      type,
      value: input.value,
      valueText: formatValue(input.value),
      variants: variants?.keys ?? null,
      variantValues: variants?.values ?? null,
      bounds: readBounds(input.settings),
      disabled: input.disabled === true,
      visible: visible.has(path),
      selectors: binding?.selectors ?? [],
      relationship: binding?.relationship ?? null,
      defaultGroup,
      defaultKey,
      canPersistDefault: Boolean(levaConfig()?.sourceDefaults && defaultGroup && defaultKey),
    })
  }

  let controlCount = 0
  let variantCount = 0
  for (const section of sections) {
    rollUp(section)
    controlCount += section.controlCount
    variantCount += section.variantCount
  }

  return { sections, controlCount, variantCount, selectCount }
}

/** Returns the leva store only when it behaves like one, never on name alone. */
export function levaStore(): LevaStoreLike | null {
  const configured = levaConfig()
  if (!configured) return null
  const candidate = (window as unknown as Record<string, unknown>)[configured.storeGlobal]
  if (!candidate || typeof candidate !== "object") return null
  const store = candidate as Partial<LevaStoreLike>
  if (typeof store.getData !== "function") return null
  if (typeof store.getVisiblePaths !== "function") return null
  if (typeof store.setValueAtPath !== "function") return null
  return store as LevaStoreLike
}

export function readInventory(): LevaInventory {
  const store = levaStore()
  if (!store) {
    return {
      available: false,
      reason: levaConfig()
        ? "The configured Leva store is not available on this page."
        : "This host has not configured a Leva control integration.",
    }
  }
  try {
    const data = store.getData()
    if (!data || typeof data !== "object") throw new Error("getData() returned no map")
    const tree = buildTree(data, store.getVisiblePaths())
    if (tree.controlCount === 0) {
      return {
        available: false,
        reason:
          "Leva is loaded but has not registered any controls yet. Open the app surface " +
          "that owns the controls, then reopen this list.",
      }
    }
    return { available: true, ...tree }
  } catch (error) {
    return { available: false, reason: `Could not read Leva's store: ${String(error)}` }
  }
}

/** Writes a value exactly as moving the control in Leva's own panel would. */
export function setControlValue(path: string, value: unknown): boolean {
  const store = levaStore()
  if (!store) return false
  try {
    store.setValueAtPath(path, value, true)
    return true
  } catch (error) {
    console.warn("[designlayer] leva rejected a value", path, error)
    return false
  }
}

export function controlValueAtPath(path: string): unknown {
  try {
    return levaStore()?.getData()?.[path]?.value
  } catch {
    return undefined
  }
}

/** Notifies on any leva store write. No-op when the store is absent. */
export function subscribeToLeva(listener: () => void): () => void {
  const store = levaStore()
  const subscribe = store?.useStore?.subscribe
  if (!store?.useStore || typeof subscribe !== "function") return () => {}
  try {
    return store.useStore.subscribe(listener)
  } catch {
    return () => {}
  }
}

export interface ContextualControlTargets {
  path: string
  relationship: string
  selectors: string[]
  elements: Element[]
}

/** Resolves only selectors the host explicitly attached to this control. */
export function targetsForControl(control: LevaControl): ContextualControlTargets | null {
  if (!control.relationship || control.selectors.length === 0) return null
  const elements: Element[] = []
  const seen = new Set<Element>()
  for (const selector of control.selectors) {
    let matches: Element[] = []
    try {
      matches = Array.from(document.querySelectorAll(selector))
    } catch {
      continue
    }
    for (const element of matches) {
      if (seen.has(element)) continue
      seen.add(element)
      elements.push(element)
    }
  }
  return { path: control.path, relationship: control.relationship, selectors: control.selectors, elements }
}

/** Captain hook: the canvas may render these targets without coupling options to canvas state. */
export function highlightControlTargets(control: LevaControl): ContextualControlTargets | null {
  const targets = targetsForControl(control)
  if (!targets) return null
  window.dispatchEvent(
    new CustomEvent("designlayer:highlight-elements", {
      detail: targets,
    })
  )
  return targets
}

export function isControlRelevantToElement(control: LevaControl, element: Element): boolean {
  for (const selector of control.selectors) {
    try {
      if (element.matches(selector) || element.closest(selector) || element.querySelector(selector)) {
        return true
      }
    } catch {
      // Invalid host selector: it binds nothing.
    }
  }
  return false
}

function matches(control: LevaControl, query: string): boolean {
  if (control.path.toLowerCase().includes(query)) return true
  if (control.label.toLowerCase().includes(query)) return true
  if (control.valueText.toLowerCase().includes(query)) return true
  return Boolean(control.variants?.some((name) => name.toLowerCase().includes(query)))
}

/**
 * Prunes the tree to folders that still have a hit. A folder whose own name
 * matches keeps all of its contents, so searching "Hover" shows what is in it
 * rather than an empty heading.
 */
export function filterTree(sections: readonly LevaFolder[], rawQuery: string): LevaFolder[] {
  const query = rawQuery.trim().toLowerCase()
  if (!query) return sections as LevaFolder[]

  const prune = (folder: LevaFolder): LevaFolder | null => {
    if (folder.path.toLowerCase().includes(query)) return folder
    const controls = folder.controls.filter((control) => matches(control, query))
    const folders = folder.folders.map(prune).filter((child): child is LevaFolder => child !== null)
    if (controls.length === 0 && folders.length === 0) return null
    const pruned: LevaFolder = { ...folder, controls, folders }
    rollUp(pruned)
    return pruned
  }

  return sections.map(prune).filter((section): section is LevaFolder => section !== null)
}
