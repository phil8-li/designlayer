/**
 * What the editor knows about a place, and the brief it hands to an agent.
 *
 * Two jobs, and they are one file because they are one contract: the capture
 * side decides which facts survive the page reloading, and the serialize side
 * is the only reader of them. Splitting the two put the cap on `text` in one
 * file and the code that printed a 4KB paragraph in another.
 *
 * CAPTURE runs inside the click that creates a note, so everything here is
 * synchronous. That rules out `resolveElementSource`, which is a sourcemap
 * fetch and sometimes a grep — holding the marker until it lands would mean a
 * pointer gesture that visibly waits. What it does instead is ask the editor
 * store whether the answer is already known (see `sourceOf`), and otherwise
 * report no file rather than a guess.
 *
 * SERIALIZE is `buildChangePrompt`'s sibling and deliberately reads like it: a
 * statement of what is true, where, and what to do about it, with no chat
 * around it. The one thing this says that the change prompt never has to is
 * WHICH KIND of thing each line is. A brief that mixes "the designer already
 * did this" with "the designer wants this" is how an agent ends up reverting
 * work that is already in the file it just opened, so the two never share a
 * heading.
 */

import { owningComponentName } from "../core/angular"
import {
  isProjectSourcePath,
  normalizeSourcePath,
  type RewriteElementInfo,
  type RewriteStack,
} from "../core/bridge"
import { sanitizeChangePrompt } from "../core/change-prompt"
import { config } from "../core/config"
import { nthOfType } from "../core/element-target"
import { getState } from "../core/store"
import { edits, isEditQueued } from "./journal"
import { annotations, annotationSettings } from "./store"
import type {
  AnnotationRecord,
  AnnotationTarget,
  EditRecord,
  OutboxItem,
  OutputDetail,
} from "./types"

/** A text node longer than this is an article, not a label — `element-code.ts`'s cap. */
const MAX_TEXT = 120
/** Deep enough to name the feature, short enough that a note is not a stack trace. */
const MAX_COMPONENTS = 5
const MAX_ANCESTRY = 5
const MAX_PATH_DEPTH = 5
/**
 * A Tailwind element carries twenty utilities. A selector spelling all of them
 * is wider than the panel, and stops matching the moment one utility changes —
 * two classes is enough to pick the element out of its siblings and cheap to
 * re-read when it does not.
 */
const MAX_PATH_CLASSES = 2

/**
 * The properties a designer would name, out of the three hundred
 * `getComputedStyle` resolves.
 *
 * Chosen to answer the questions a note actually raises — how is it laid out,
 * how big is it, what colour is it, how much room is around it. Everything
 * else is noise that pushes the note itself off the top of the agent's
 * context.
 */
const INTERESTING_STYLES = [
  "display",
  "position",
  "color",
  "background-color",
  "font-size",
  "font-weight",
  "line-height",
  "margin",
  "padding",
  "width",
  "height",
  "border-radius",
  "border",
  "opacity",
  "z-index",
] as const

/* -------------------------------------------------------------------------
 * Capture
 * ---------------------------------------------------------------------- */

/**
 * The vendor bridge as the global holds it, NOT as `whenBridgeReady` hands it
 * over.
 *
 * `whenBridgeReady` wraps `elementInfo` so an Angular host gets an answer from
 * `owningComponentName`, and this module is one of the things that wrapper
 * exists for — but capture is synchronous and the wrapper is behind a promise.
 * So the framework branch is made here, explicitly, and the raw global is only
 * ever asked the React question.
 */
function reactInfo(element: Element): RewriteElementInfo | null {
  const bridge = window.__DESIGNLAYER_BRIDGE__
  if (!bridge) return null
  try {
    return bridge.elementInfo(element)
  } catch {
    // The fiber lookup throws on a node React never rendered — an SVG the host
    // injected, or anything inside a third-party widget.
    return null
  }
}

/**
 * Bundlers prefix a renamed class with `_`, so an Angular component arrives as
 * `_ShellComponent`. `bridge.ts` tidies it for the layers tree for the same
 * reason it is tidied here: the server owns the real mapping, and a brief that
 * tells an agent to open `_ShellComponent` names a symbol that is in no file.
 */
function displayName(raw: string | null | undefined): string | null {
  const name = (raw ?? "").replace(/^_+/, "").trim()
  return name || null
}

/** The component whose template authored this element, on either host. */
function componentNameOf(element: Element): string | null {
  if (config.host.framework === "angular") return displayName(owningComponentName(element))
  return displayName(reactInfo(element)?.componentName)
}

/**
 * The component stack, INNERMOST FIRST.
 *
 * One order had to be picked and this is the one both hosts produce naturally:
 * React's owner stack already reads that way, and Angular's is built by
 * climbing out of the element. It is also the useful order — the first name is
 * the component whose file the agent opens, and everything after it is
 * context for finding that file. Reversing it would put the least actionable
 * name where the eye lands first.
 */
function componentStack(element: Element): string[] {
  return config.host.framework === "angular" ? angularStack(element) : reactStack(element)
}

/**
 * Angular has no stack to read, so one is walked.
 *
 * `ng.getOwningComponent` answers for one node, and every element inside a
 * single template answers with the same component — so the walk climbs and
 * keeps only the changes. `owningComponentName` is reused rather than
 * reimplemented because it already handles the two cases that make a naive
 * call return null: a projected `<ng-content>` child, and Angular throwing on
 * a node outside any component tree.
 */
function angularStack(element: Element): string[] {
  const names: string[] = []
  for (
    let node: Element | null = element;
    node && names.length < MAX_COMPONENTS;
    node = node.parentElement
  ) {
    const name = displayName(owningComponentName(node))
    // Consecutive only: a component that renders itself recursively is a real
    // repeat in the stack and collapsing it would hide the nesting.
    if (name && name !== names[names.length - 1]) names.push(name)
  }
  return names
}

function reactStack(element: Element): string[] {
  const info = reactInfo(element)
  if (!info) return []
  const frames = Array.isArray(info.stack) ? info.stack : []
  const names: string[] = []
  for (const candidate of [info.componentName, ...frames.map((frame) => frame.componentName)]) {
    const name = displayName(candidate)
    if (name && name !== names[names.length - 1]) names.push(name)
    if (names.length === MAX_COMPONENTS) break
  }
  return names
}

/**
 * Where this element is written, as far as anything can say without waiting.
 *
 * The store is asked FIRST and it is the only route that works on an Angular
 * host: `context.ts` primes the resolver on selection and patches the answer
 * into the stored `Selection`, so by the time someone annotates the element
 * they have selected, the round trip has usually already happened. Nothing
 * else here may re-derive it — `bridge.ts` is explicit that source resolution
 * has one owner, and this is a read of that owner's result, not a second
 * attempt at it.
 *
 * The fallback walks the frames the synchronous fiber lookup offers, filtered
 * by `isProjectSourcePath` for the reason measured in `bridge.ts`: about half
 * of them symbolicate into a turbopack chunk, and a brief naming
 * `src_components_0w_i7fl._.js:953` sends an agent to open a file that is not
 * source.
 */
function sourceOf(element: Element): { filePath: string | null; lineNumber: number | null } {
  const known = getState().selection.find((entry) => entry.element === element)?.source
  if (known?.filePath) return { filePath: known.filePath, lineNumber: known.lineNumber || null }

  const info = reactInfo(element)
  if (!info) return { filePath: null, lineNumber: null }
  const frames: Array<RewriteElementInfo | RewriteStack> = [
    info,
    ...(Array.isArray(info.stack) ? info.stack : []),
  ]
  for (const frame of frames) {
    const filePath = normalizeSourcePath(frame.filePath)
    if (!isProjectSourcePath(filePath)) continue
    return { filePath, lineNumber: frame.lineNumber || null }
  }
  return { filePath: null, lineNumber: null }
}

/**
 * Computed styles, or nothing at all.
 *
 * Both ways this can fail are ordinary. A node removed from the tree still
 * answers, with every property resolving to the empty string, which is why
 * empties are dropped rather than reported as facts. A node from a document
 * with no browsing context — anything a `DOMParser` built — has no
 * `defaultView` to ask, and asking anyway is a `TypeError` that would take the
 * whole capture down and lose the note with it.
 *
 * `border` is dropped by the same empty test whenever the four sides differ,
 * because that is the one shorthand `getComputedStyle` refuses to serialize.
 */
function computedStyles(element: Element): Record<string, string> {
  const styles: Record<string, string> = {}
  let declaration: CSSStyleDeclaration | null = null
  try {
    declaration = element.ownerDocument?.defaultView?.getComputedStyle(element) ?? null
  } catch {
    declaration = null
  }
  if (!declaration) return styles
  for (const property of INTERESTING_STYLES) {
    const value = declaration.getPropertyValue(property).trim()
    if (value) styles[property] = value
  }
  return styles
}

/**
 * `getAttribute("class")`, never `.className`: on an `<svg>` the property is an
 * `SVGAnimatedString` and stringifying it yields `[object SVGAnimatedString]`.
 * Every lucide icon in a host app is one of those, and an icon is a perfectly
 * ordinary thing to annotate.
 */
function classAttribute(element: Element): string {
  return element.getAttribute("class") ?? ""
}

function truncate(text: string): string {
  return text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT - 1)}…` : text
}

/**
 * The element's text, collapsed and capped.
 *
 * The cap is not cosmetic. A note pinned to a `<section>` reads `textContent`
 * for the whole feature, and without this the brief opened with two thousand
 * characters of page copy before the sentence the designer actually wrote.
 */
function visibleText(element: Element): string {
  return truncate((element.textContent ?? "").replace(/\s+/g, " ").trim())
}

function ancestryOf(element: Element): AnnotationTarget["ancestry"] {
  const ancestry: AnnotationTarget["ancestry"] = []
  for (
    let node = element.parentElement;
    node && ancestry.length < MAX_ANCESTRY;
    node = node.parentElement
  ) {
    if (node === document.body || node === document.documentElement) break
    ancestry.push({
      tagName: node.tagName.toLowerCase(),
      className: classAttribute(node),
      componentName: componentNameOf(node),
    })
  }
  return ancestry
}

/**
 * Everything worth remembering about the element a note points at.
 *
 * Read once, here, and never re-read: the page under the editor is a dev
 * server that hot-reloads, and a description that changed under the note would
 * be a note about something nobody said. Nothing in this function may throw —
 * the element can already be detached by the time a note is filed against it,
 * and losing the note to that would be strictly worse than a description with
 * empty fields in it.
 *
 * The component stack is gathered unconditionally. It used to be behind a
 * settings switch, which asked the designer to answer a question the editor
 * had already answered for itself — `componentStack` branches on the detected
 * host and comes back empty on a page neither framework rendered, which is the
 * only honest "off" there ever was. What the brief SAYS about the stack is
 * still `outputDetail`'s call, in `renderTarget`.
 */
export function describeElement(element: Element): AnnotationTarget {
  const { filePath, lineNumber } = sourceOf(element)
  return {
    tagName: element.tagName.toLowerCase(),
    componentName: componentNameOf(element),
    className: classAttribute(element),
    id: element.getAttribute("id"),
    selector: cssPath(element),
    text: visibleText(element),
    filePath,
    lineNumber,
    ancestry: ancestryOf(element),
    computed: computedStyles(element),
    components: componentStack(element),
  }
}

/* -------------------------------------------------------------------------
 * The selector
 * ---------------------------------------------------------------------- */

/**
 * `CSS.escape` is the only correct answer for a Tailwind class — `hover:bg-red-500/50`
 * has three characters that end a selector early. The fallback exists because
 * this module is also loaded in unit tests, where `CSS` is not defined.
 */
function escapeIdent(value: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") return CSS.escape(value)
  return value.replace(/([^\w-])/g, "\\$1")
}

/**
 * `#id` only when it resolves to THIS element.
 *
 * `getElementById` returns the first node with the id, which is exactly what
 * devtools does with `#id` — so agreeing with it is the test. An id that is
 * duplicated later in the document still anchors the path for the first one
 * and correctly refuses to for the rest.
 */
function uniqueIdSelector(element: Element): string | null {
  const id = element.getAttribute("id")
  if (!id) return null
  return element.ownerDocument?.getElementById(id) === element ? `#${escapeIdent(id)}` : null
}

/**
 * Whether a sibling answers to the same segment.
 *
 * Asked of the finished segment rather than of the tag, which is the whole
 * point. Two Tailwind buttons that share `px-4` and differ in everything else
 * both match `button.px-4`, so a segment that stopped at the class list
 * silently selected the first of them — and a note pinned to Cancel read in
 * devtools as a note about Save. Classes only disambiguate when they actually
 * do, and this is the test.
 */
function ambiguousAmongSiblings(element: Element, selector: string): boolean {
  const parent = element.parentElement
  if (!parent) return false
  for (const child of Array.from(parent.children)) {
    if (child === element) continue
    try {
      if (child.matches(selector)) return true
    } catch {
      // A class `escapeIdent` could not turn into a legal selector. Unprovable
      // is treated as ambiguous: a position suffix on a selector that did not
      // need one still finds the element, and omitting one that was needed
      // does not.
      return true
    }
  }
  return false
}

/**
 * Classes that will still be there next time.
 *
 * Angular adds and removes `ng-star-inserted` and `ng-tns-c*` as the view
 * changes, so a selector built on one matches now and matches nothing after
 * the next change detection — which reads to whoever pasted it as the element
 * having been deleted.
 */
function isStableClass(name: string): boolean {
  return Boolean(name) && !name.startsWith("ng-")
}

function segmentFor(element: Element): string {
  const tag = element.tagName.toLowerCase()
  const classes = Array.from(element.classList)
    .filter(isStableClass)
    .slice(0, MAX_PATH_CLASSES)
    .map((name) => `.${escapeIdent(name)}`)
    .join("")
  const candidate = `${tag}${classes}`
  if (!ambiguousAmongSiblings(element, candidate)) return candidate
  // Position is the tie-breaker of last resort. `nthOfType` is reused from
  // `element-target` so the index in a pasted selector and the index the
  // source-side writer matches on can never drift apart; CSS counts from one
  // and that function counts from zero.
  return `${candidate}:nth-of-type(${nthOfType(element) + 1})`
}

/**
 * A selector a human can paste into devtools.
 *
 * Capped at five segments, and anchored early on any ancestor with a unique
 * id. A full path from `html` on a modern app is forty segments of `div`, which
 * nobody reads and which breaks on the first layout change; five is short
 * enough to scan and specific enough to land. The cost of the cap is honest —
 * an uncapped path is rooted and a capped one is not, so a five-segment path
 * can match more than one element. It is a way to FIND the thing, not an
 * identity for it, which is what `ancestry` and the component stack are for.
 */
export function cssPath(element: Element): string {
  const segments: string[] = []
  for (
    let node: Element | null = element;
    node && segments.length < MAX_PATH_DEPTH;
    node = node.parentElement
  ) {
    const anchor = uniqueIdSelector(node)
    if (anchor) {
      segments.unshift(anchor)
      break
    }
    if (node === document.body || node === document.documentElement) {
      segments.unshift(node.tagName.toLowerCase())
      break
    }
    segments.unshift(segmentFor(node))
  }
  return segments.join(" > ")
}

/* -------------------------------------------------------------------------
 * The outbox
 * ---------------------------------------------------------------------- */

/**
 * An unparseable timestamp sorts to the front rather than to `NaN`, which
 * `Array.sort` would scatter the whole list around. `sort` is stable, so
 * anything that ties keeps the order the two stores were read in.
 */
function timeOf(iso: string): number {
  const at = Date.parse(iso)
  return Number.isFinite(at) ? at : 0
}

/**
 * Notes and edits as one list, oldest first.
 *
 * The merge happens here and nowhere earlier. The two stores are filled by
 * unrelated machinery — one by a pointer gesture, one by every write the editor
 * makes — and joining them at the source would put the writer's hot path
 * through the annotation store for the sake of a list only the panel and the
 * brief ever read.
 *
 * Chronological because that is the only order in which the two kinds make
 * sense together: "I moved this" followed by "and it still looks wrong" is a
 * different report from the same two items the other way round.
 */
export function outboxItems(): OutboxItem[] {
  const items: OutboxItem[] = [
    ...annotations().map(
      (note): OutboxItem => ({ type: "note", at: timeOf(note.createdAt), note })
    ),
    ...edits().map(
      (edit: EditRecord): OutboxItem => ({ type: "edit", at: timeOf(edit.createdAt), edit })
    ),
  ]
  return items.sort((a, b) => a.at - b.at)
}

/**
 * How many rows still want something from the designer.
 *
 * Every row the Changes tab does NOT badge "In your files": the notes, the
 * edits no commit can write, and — the one that is easy to miss — the edits
 * that are merely queued. It lives here, beside `outboxItems`, because two
 * surfaces ask the question and they must not answer it differently: the count
 * on the inspector's tab and the count on the toolbar's pending indicator are
 * the same promise about the same list, and a bar reading "3" over a list
 * showing four things is worse than a bar with no number at all.
 *
 * `written` cannot answer it alone. The writer sets that flag the moment it
 * knows it CAN spell a change, long before any commit runs, so counting
 * `!written` silently omits every Ready row. `isEditQueued` is the other half.
 */
export function owedCount(): number {
  return outboxItems().filter(
    (item) => item.type === "note" || !item.edit.written || isEditQueued(item.edit.id)
  ).length
}

/* -------------------------------------------------------------------------
 * The brief
 * ---------------------------------------------------------------------- */

/**
 * Whose components these are.
 *
 * Resolved from the host rather than hard-coded, because the label is the only
 * part of the line an agent acts on: told to look for a React component in an
 * Angular project it will search for a file that was never going to exist, and
 * conclude the brief is describing a different application. Saying nothing
 * would be better than saying the wrong framework, so this never guesses.
 */
function componentsLabel(): string {
  return config.host.framework === "angular" ? "Angular components" : "React components"
}

/**
 * The path as it is safe to show.
 *
 * `sanitizeBrief` shortens an absolute path to its `src/` tail, but only when
 * there IS an `src/` in it — a monorepo package laid out as `packages/ui/lib`
 * comes through absolute. The last two segments are what the Design tab shows
 * for the same case, and they carry no home directory.
 */
function sourceLabel(filePath: string, lineNumber: number | null): string {
  const shortened = sanitizeChangePrompt(filePath)
  const path = shortened.startsWith("/") ? shortened.split("/").slice(-2).join("/") : shortened
  return lineNumber ? `${path}:${lineNumber}` : path
}

/** `<button class="...">`, the same way the change prompt spells an element. */
function elementLabel(target: AnnotationTarget | null): string {
  // Not "the page". An edit with no target is an edit whose element the journal
  // could not describe, and saying "the page" would send an agent looking for a
  // layout-level change that nobody made.
  if (!target) return "an element the editor could not describe"
  return target.className
    ? `\`<${target.tagName} class="${target.className}">\``
    : `\`<${target.tagName}>\``
}

/** The short form: what the reader needs to picture the thing being talked about. */
function targetHeadline(note: AnnotationRecord): string {
  if (note.kind === "text") {
    const quoted = truncate((note.selectedText ?? "").replace(/\s+/g, " ").trim())
    return quoted ? `the text “${quoted}”` : "a text selection"
  }
  if (!note.target) {
    // A region over empty space is the one note with nothing to name, and its
    // size is the only thing that distinguishes "this gap" from "this column".
    return `an empty region, ${Math.round(note.rect.width)}×${Math.round(note.rect.height)}`
  }
  const { target } = note
  const name = target.componentName ? `${target.componentName} (\`${target.tagName}\`)` : `\`${target.tagName}\``
  return target.text ? `${name} — “${target.text}”` : name
}

/**
 * The vocabulary is `change-prompt.ts`'s, deliberately.
 *
 * `class`, `icon`, `text` and `remove` are sentinels rather than CSS
 * properties, and an agent handed "set `remove` to ``" has no idea what was
 * wanted. Two spellings of "what changed" in one codebase is how the Prompts
 * tab and this brief come to describe the same edit differently.
 */
function editPhrase(edit: EditRecord): string {
  if (edit.property === "remove") {
    return "delete this element, and any import or handler left unused by its removal"
  }
  if (edit.property === "icon") {
    return `swap the icon to \`${edit.to}\` (was \`${edit.from || "unknown"}\`)`
  }
  if (edit.property === "class") {
    return `the class attribute becomes \`${edit.to}\` (was \`${edit.from || "none"}\`)`
  }
  if (edit.property === "text") {
    return `the text becomes “${truncate(edit.to)}” (was “${truncate(edit.from)}”)`
  }
  return `set \`${edit.property}\` to \`${edit.to}\`${edit.from ? ` (was \`${edit.from}\`)` : ""}`
}

/**
 * The context bullets under an item, which is where the four levels differ.
 *
 * Compact never reaches here at all — it prints one line per item and stops.
 * Standard says where the thing is; detailed says what it looks like and what
 * it sits inside; forensic adds the box. Each level is a superset of the one
 * before, so a reader who asked for more never loses a line they had.
 */
function targetBullets(target: AnnotationTarget | null, detail: OutputDetail): string[] {
  if (!target || detail === "compact") return []
  const lines: string[] = [`- Selector: \`${target.selector}\``]

  if (target.filePath) {
    // NOT spelled `**Source:**`. `sanitizeBrief` deletes a line that starts
    // that way — it is how the app's own copy path drops the resolver's
    // half-right attribution — and this line is one we stand behind, because
    // `isProjectSourcePath` already threw out the chunk filenames.
    lines.push(`- Source: \`${sourceLabel(target.filePath, target.lineNumber)}\``)
  }
  if (target.components.length) {
    lines.push(`- ${componentsLabel()}: ${target.components.map((name) => `\`${name}\``).join(" in ")}`)
  }

  if (detail === "detailed" || detail === "forensic") {
    const computed = Object.entries(target.computed)
    if (computed.length) {
      lines.push(`- Computed: ${computed.map(([key, value]) => `\`${key}: ${value}\``).join(", ")}`)
    }
    if (target.ancestry.length) {
      const chain = target.ancestry.map((step) => {
        const classes = step.className.split(/\s+/).filter(Boolean).slice(0, MAX_PATH_CLASSES)
        return `\`${step.tagName}${classes.map((name) => `.${name}`).join("")}\``
      })
      lines.push(`- Inside: ${chain.join(" in ")}`)
    }
  }

  return lines
}

/**
 * Viewport, URL, agent, clock.
 *
 * Forensic only, and once per brief rather than once per note, because every
 * note in a brief was made in the same tab at the same size. This is the block
 * that answers "it looks fine on my machine": a 1440-wide capture at 2× on
 * Safari is a different page from the one the agent is about to open.
 */
function environmentBlock(): string[] {
  return [
    "## Environment",
    "",
    `- URL: ${window.location.href}`,
    `- Viewport: ${window.innerWidth}×${window.innerHeight} CSS px at ${window.devicePixelRatio}× device pixel ratio`,
    `- User agent: ${navigator.userAgent}`,
    `- Captured: ${new Date().toISOString()}`,
  ]
}

function noteSection(notes: AnnotationRecord[], detail: OutputDetail): string[] {
  const lines: string[] = [
    "## Notes — what the designer is asking for",
    "",
    `${notes.length} ${notes.length === 1 ? "note was" : "notes were"} pinned to the running page. Nothing in this section has been changed; each one is a place that needs work.`,
    "",
  ]

  notes.forEach((note, index) => {
    const comment = note.comment.trim() || "(no comment)"
    if (detail === "compact") {
      lines.push(`${index + 1}. **${targetHeadline(note)}** — ${comment}`)
      return
    }

    lines.push(`### ${index + 1}. ${targetHeadline(note)}`, "", comment, "")
    const bullets = targetBullets(note.target, detail)
    if (detail === "forensic") {
      bullets.push(
        `- Box: ${Math.round(note.rect.width)}×${Math.round(note.rect.height)} at (${Math.round(note.rect.x)}, ${Math.round(note.rect.y)}) in page coordinates`,
        // "Noted", not "written": in this brief "written" means "already in the
        // source file", and using it for a timestamp would blur the one
        // distinction the whole document is built around.
        `- Noted: ${note.createdAt}`
      )
    }
    if (bullets.length) lines.push(...bullets, "")
  })

  if (detail === "compact") lines.push("")
  return lines
}

function editSection(
  entries: EditRecord[],
  heading: string,
  preamble: string,
  detail: OutputDetail
): string[] {
  const lines: string[] = [heading, "", preamble, ""]
  for (const edit of entries) {
    lines.push(`- ${elementLabel(edit.target)} — ${editPhrase(edit)}`)
    const bullets = targetBullets(edit.target, detail)
    // Indented under the edit rather than flattened beside it: an edit's
    // selector belongs to that edit, and at four edits a flat list of twelve
    // bullets is unreadable.
    for (const bullet of bullets) lines.push(`  ${bullet}`)
  }
  lines.push("")
  return lines
}

/**
 * The whole session as markdown an agent can act on.
 *
 * Three sections, in the order the reader needs them: what is wanted, what is
 * already done, and what is done but not yet real. The middle one is the
 * section that exists to prevent a specific failure — an agent that reads the
 * notes, opens the file, sees the padding change already applied, and applies
 * it a second time because nothing told it the designer had got there first.
 */
export function buildAnnotationBrief(items: OutboxItem[] = outboxItems()): string {
  const detail = annotationSettings().outputDetail

  // Every note goes. There is no resolved state to filter out any more — the
  // only way to take a note off this list is to delete it, which removes it
  // from the store, so anything still here is by definition still wanted.
  const notes = items
    .filter((item): item is Extract<OutboxItem, { type: "note" }> => item.type === "note")
    .map((item) => item.note)
  const changes = items
    .filter((item): item is Extract<OutboxItem, { type: "edit" }> => item.type === "edit")
    .map((item) => item.edit)
  const written = changes.filter((edit) => edit.written)
  const pending = changes.filter((edit) => !edit.written)

  if (!notes.length && !changes.length) {
    return "Nothing to hand over yet. Pin a note on the page, or make a change, and it lands here."
  }

  const counts = [
    notes.length ? `${notes.length} ${notes.length === 1 ? "note" : "notes"}` : "",
    changes.length ? `${changes.length} ${changes.length === 1 ? "change" : "changes"}` : "",
  ].filter(Boolean)

  const lines: string[] = [
    "# Design review from the browser",
    "",
    `${counts.join(" and ")} from a session on \`${window.location.pathname}\`, oldest first.`,
  ]

  if (detail === "forensic") lines.push("", ...environmentBlock())

  if (notes.length) lines.push("", ...noteSection(notes, detail))

  if (written.length) {
    lines.push(
      "",
      ...editSection(
        written,
        "## Already written to source — do not apply these again",
        `${written.length} ${written.length === 1 ? "change is" : "changes are"} already in the files below. They are done. Applying them a second time is a conflict, not a fix.`,
        detail
      )
    )
  }

  if (pending.length) {
    lines.push(
      "",
      ...editSection(
        pending,
        "## Showing in the browser only — these still need writing",
        `${pending.length} ${pending.length === 1 ? "change exists" : "changes exist"} as a live preview and in no file. This is the work: the next reload eats ${pending.length === 1 ? "it" : "them"}.`,
        detail
      )
    )
  }

  // Collapse the blank lines the sections leave where they join.
  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n").trim()}\n`
}

/**
 * What is safe to put on someone's clipboard.
 *
 * `sanitizeChangePrompt` is imported rather than copied. Both rules it applies
 * are exactly the rules a brief needs — drop the resolver's half-right
 * `**Source:**` attribution, and shorten an absolute path to its `src/` tail so
 * a screen-shared brief does not carry the user's home directory and their name
 * — and duplicating two regexes here would mean the next fix to either one
 * lands in one of the two copies. The brief's own source line is spelled
 * `- Source:` precisely so it survives the first rule.
 */
export function sanitizeBrief(text: string): string {
  return sanitizeChangePrompt(text)
}
