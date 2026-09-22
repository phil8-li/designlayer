/**
 * Agentation's annotation toolbar, mounted beside the editor's own chrome.
 *
 * ---------------------------------------------------------------------------
 * WHY A SECOND ANNOTATION SURFACE
 *
 * `src/annotations/` already pins notes to elements, and it is the better one
 * for the thing it does: its notes know the source file behind the element,
 * because they are pinned through the same resolver the inspector uses, and
 * `/agent` folds them into a handoff brief this package writes itself.
 *
 * This one answers a different question. Its notes leave the browser over HTTP
 * to an `agentation-mcp` server, where a coding agent reads them as structured
 * records and writes back — acknowledged, resolved, replied-to — while the tab
 * stays open. That round trip is the feature: the editor's own notes are a
 * document you hand over once, and these are a conversation.
 *
 * So both exist, and neither is being migrated into the other. What they may
 * not do is both be armed at once, which is what the rest of this file is for.
 *
 * ---------------------------------------------------------------------------
 * WHY IT MAY ANNOTATE THE EDITOR ITSELF
 *
 * Every other surface in this package treats `[data-de-chrome]` as off-limits;
 * `core/dom.ts` exists largely to make that airtight. This toolbar is the
 * exception on purpose. The editor is a piece of UI somebody has to design
 * too, and "the inspector's tab strip is 2px out" is a note that has nowhere
 * else to go — the editor cannot be pointed at itself. Agentation excludes only
 * its own root from its picker, so the panels, the toolbar and the canvas
 * chrome are all annotatable, and that is the point rather than a leak.
 *
 * The exclusion runs the other way instead: `[data-agentation-root]` is in
 * `CHROME_SELECTOR`, so the editor will not try to select or rewrite the
 * toolbar that is looking at it.
 */

import { createElement, type FunctionComponent } from "react"
import { createRoot } from "react-dom/client"
import { Agentation, type AgentationProps } from "agentation"

import { config } from "../core/config"
import { agentationCss } from "../core/css/agentation"
import { CHROME_ATTR, el } from "../core/dom"
import { editorMode, setMode, type EditorMode } from "../core/store"

const HOST_ID = "designlayer-agentation"
const STYLE_ID = "designlayer-agentation-style"

/**
 * The stylesheet Agentation appends to `<head>` while its picker is armed, and
 * removes when it is not — a `<style id="feedback-cursor-styles">` carrying the
 * crosshair rules, written from an effect keyed on its `isActive` state.
 *
 * It is the only public trace that state leaves. The component takes no
 * `onActivate` callback and exposes no ref, so the choice was this or nothing:
 * two pickers armed at once, both painting hover outlines, on a page where one
 * click both selects an element and opens an annotation box.
 *
 * Reading somebody else's id is a real cost and worth naming. It is survivable
 * because of how it fails: an Agentation release that renames this element
 * leaves `active` permanently false, which restores exactly the conflict this
 * avoided — bad, visible immediately on the first click, and not a crash.
 */
const ACTIVE_STYLE_ID = "feedback-cursor-styles"

let installed = false

export function installAgentation(): void {
  if (installed) return
  if (!config.agentation.enabled) return
  installed = true

  // Before the root, so the toolbar is in the lane the editor keeps clear on
  // its first paint rather than after one.
  if (!document.getElementById(STYLE_ID)) {
    const style = el("style", { id: STYLE_ID })
    style.textContent = agentationCss
    document.head.append(style)
  }

  const host = document.createElement("div")
  host.id = HOST_ID
  // The component renders through a portal of its own, so this node stays
  // empty and nothing the designer sees is inside it. It is marked as chrome
  // regardless: an empty div in `<body>` that the editor would happily offer
  // to resize is still a thing in the layer tree that nobody put there.
  host.setAttribute(CHROME_ATTR, "")
  document.body.append(host)

  // Agentation's whole prop bag is optional, and it declares it as ONE optional
  // parameter — `({ … }?: AgentationProps)`. `createElement` reads that as a
  // component taking no props at all and rejects every key, so the component is
  // re-stated as the `FunctionComponent<AgentationProps>` it already is. No
  // property is being widened: the props below are checked against Agentation's
  // own exported type.
  const Toolbar = Agentation as FunctionComponent<AgentationProps>

  createRoot(host).render(
    createElement(Toolbar, {
      // `undefined` rather than null: absent means "keep the notes in this
      // tab", which is Agentation's own local-first default, and is what a
      // session with no MCP server running should get.
      endpoint: config.agentation.endpoint ?? undefined,
      // Printed rather than stored. The id is what somebody types into an
      // agent to ask about this page's notes, and the console is where they
      // are already looking when they want it — anywhere else in the chrome
      // would be a permanent slot for a string that is read about twice.
      onSessionCreated: (sessionId: string) => {
        console.info(`[designlayer] agentation session ${sessionId}`)
      },
    })
  )

  linkEditorMode()
}

/**
 * Stands the editor down for as long as the picker is armed, then puts it back.
 *
 * `interactive` is the existing name for "the pointer is not the editor's", and
 * every canvas handler already asks `editorOwnsInput()` before doing anything —
 * so borrowing that mode is airtight in a way a new flag next to it would not
 * be. It also has to be a mode rather than a `stopPropagation`: the canvas lane
 * listens at WINDOW capture and Agentation at DOCUMENT capture, and window
 * capture runs first, so by the time Agentation could swallow a click the
 * editor has already selected whatever was under it.
 *
 * The previous mode is restored only if the editor is still where this left it.
 * Agentation swallows clicks while armed, so in practice nothing else can have
 * moved the mode — but "nothing else can" is an assumption about a dependency's
 * event handling, and the check costs one comparison.
 */
function linkEditorMode(): void {
  let borrowedFrom: EditorMode | null = null

  const reconcile = (): void => {
    const armed = document.getElementById(ACTIVE_STYLE_ID) !== null

    if (armed && borrowedFrom === null) {
      borrowedFrom = editorMode()
      if (borrowedFrom !== "interactive") setMode("interactive")
      return
    }

    if (!armed && borrowedFrom !== null) {
      const previous = borrowedFrom
      borrowedFrom = null
      if (previous !== "interactive" && editorMode() === "interactive") setMode(previous)
    }
  }

  // `childList` on `<head>` alone: the element is appended there directly, and
  // a subtree observer would wake on every rule a hot-reloading host rewrites
  // inside its own stylesheets. The callback is a `getElementById`, so the
  // false wakeups this still gets — the host adding a `<style>` of its own —
  // cost a hash lookup.
  new MutationObserver(reconcile).observe(document.head, { childList: true })
  reconcile()
}
