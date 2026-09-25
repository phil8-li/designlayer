/**
 * The one way a session leaves the editor: copied, or sent.
 *
 * There were three copies and two sends. The Changes tab and the toolbar's
 * `notes.copy` chord each built the brief and wrote the clipboard with their
 * own counting — one said "2 edits", the other "2 changes" — and the tab split
 * finishing a session across "Apply to code" and "Send to agent", which made the
 * designer route their own change by guessing whether the writer could spell
 * it. Every surface now calls these two functions, so a copy from the chord and
 * a copy from the panel are the same act with the same words.
 *
 * `handOver` is the send flow, and it is ONE flow in two stages, not two
 * buttons: everything the writer can spell is written first, and only what is
 * left — notes, and edits no commit can write — goes to the agent, with the
 * written half in the brief as context. A session that only moved some padding
 * finishes at the first stage and never waits on an agent round trip, which
 * was the one good reason the two buttons were ever split.
 */

import { isProjectSourcePath } from "../core/bridge"
import type { Committer } from "../core/apply"
import { requestAgent } from "../ai/transport"
import { clearEdits } from "./journal"
import { buildAnnotationBrief, outboxItems } from "./output"
import { annotationSettings, clearAnnotations } from "./store"
import type { OutboxItem } from "./types"

type Toast = (message: string, kind?: "info" | "error") => void

/** "3 notes and 2 edits", with whichever half is zero left out. */
export function outboxSummary(items: OutboxItem[]): string {
  const notes = items.filter((item) => item.type === "note").length
  const edits = items.length - notes
  return [
    notes ? `${notes} note${notes === 1 ? "" : "s"}` : null,
    edits ? `${edits} edit${edits === 1 ? "" : "s"}` : null,
  ]
    .filter((part): part is string => part !== null)
    .join(" and ")
}

/**
 * The files the agent should open first, filtered through `isProjectSourcePath`
 * so a compiled chunk never reaches it as a path to go and edit.
 */
export function filesInOutbox(items: OutboxItem[]): string[] {
  const files = new Set<string>()
  for (const item of items) {
    const path = item.type === "note" ? item.note.target?.filePath : item.edit.target?.filePath
    if (path && isProjectSourcePath(path)) files.add(path)
  }
  return [...files]
}

/**
 * Empty the outbox when the setting says a handover is the end of it. Called
 * only once a copy has RESOLVED or a send came back ok, so a refused clipboard
 * can never cost the list.
 */
export function clearIfAsked(): void {
  if (!annotationSettings().clearOnCopy) return
  clearAnnotations()
  clearEdits()
}

/**
 * Copy the whole session as one brief.
 *
 * The clipboard is written synchronously inside the caller's click or key
 * task, before anything awaits: the Clipboard API only works under the
 * transient activation the gesture carries. Returns false when nothing was put
 * on the clipboard — an empty outbox, or a browser that refused on the spot —
 * so a caller can take back a tick it raised optimistically; a LATE refusal
 * arrives through `onRefused`.
 */
export function copyHandover(toast: Toast, onRefused?: () => void): boolean {
  const items = outboxItems()
  if (!items.length) {
    toast("Nothing to copy")
    return false
  }
  const refuse = (): void => {
    onRefused?.()
    toast("Could not copy — clipboard access was blocked", "error")
  }
  try {
    void navigator.clipboard.writeText(buildAnnotationBrief(items)).then(clearIfAsked).catch(refuse)
  } catch {
    // A browser with no Clipboard API throws here rather than rejecting.
    refuse()
    return false
  }
  toast(`Copied ${outboxSummary(items)}`)
  return true
}

/** Does anything in the outbox still need a person or an agent after a write? */
export function needsAgent(items: OutboxItem[] = outboxItems()): boolean {
  return items.some((item) => item.type === "note" || !item.edit.written)
}

export interface HandoverResult {
  /** The writer ran and wrote something. */
  wrote: boolean
  /** The brief went to the agent route. */
  sent: boolean
  ok: boolean
}

/**
 * Finish the session: write what can be written, then send what is left.
 *
 * The write goes FIRST so the brief that follows describes a source tree that
 * already contains the writable half — an agent handed "set padding to 24px"
 * for an edit that landed a moment ago re-applies it. `applyAll` awaits, so by
 * the time the brief is built those rows read as written and the brief marks
 * them "do not apply again".
 */
export async function handOver(options: {
  apiBase: string
  committer: Committer
  toast: Toast
}): Promise<HandoverResult> {
  const { apiBase, committer, toast } = options
  let wrote = false
  if (committer.hasPendingChanges()) {
    await committer.applyAll()
    wrote = true
  }

  const items = outboxItems()
  if (!needsAgent(items)) {
    // Everything was the writer's. There is nothing for an agent to do, and
    // sending it the written rows would only ask it to confirm a diff.
    if (!wrote) toast("Nothing to send")
    return { wrote, sent: false, ok: true }
  }

  const response = await requestAgent(apiBase, {
    // The outbox IS the request; this line is the subject, not the ask.
    prompt: `${outboxSummary(items)} from DesignLayer`,
    brief: buildAnnotationBrief(items),
    origin: "prompts",
    files: filesInOutbox(items),
    selection: null,
    ancestry: [],
    url: window.location.href,
  })
  // The server's own words, whatever they are. A manufactured "Sent!" over a
  // route that answered with a refusal is the one thing this must never do.
  toast(response.message, response.ok ? "info" : "error")
  if (response.ok) clearIfAsked()
  return { wrote, sent: true, ok: response.ok }
}
