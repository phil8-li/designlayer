/**
 * The app chooser: the name of the thing being edited, and the menu that
 * changes it.
 *
 * Every other surface in this editor is a view of ONE app — the tree lists its
 * elements, the inspector describes one of them, the audit reports on all of
 * them. Until this control existed, the name of that app appeared nowhere, and
 * the only way to point the editor at a different one was the toolbar's "Choose
 * app" anchor, which navigated away to the start screen and left you to pick
 * again from scratch. That is a strange shape for the most consequential
 * control in the chrome: the one thing that decides what everything else is
 * about was also the one thing you could only change by leaving.
 *
 * So it is a button that names the app and a menu that lists the alternatives,
 * and the menu IS the chooser — the rows are the running prototypes and
 * switching happens on click, with no intermediate screen. The start screen is
 * still what actually performs the swap, because it owns the supervisor that
 * can kill this editor and spawn the next one; the difference is that the
 * designer never sees it as a place they have to visit.
 *
 * ## Why the menu is not a child of the panel
 *
 * `.de-panel` is `overflow: hidden` and the trigger sits at the very top of a
 * 240px column, so a menu mounted beside it would be clipped by its own
 * container on both axes — the rows past the fold would simply not exist.
 *
 * `context.slots.overlay` is the obvious escape hatch and is the WRONG one
 * here, which is the single place this file departs from what it was asked for.
 * `css/base.ts` orders the shell's layers inside `.de-root`: the overlay is
 * `z-index: 1` and the rail holding both panels is `z-index: 2`. A positioned
 * element with a z-index establishes a stacking context, so nothing appended to
 * the overlay can paint above the rail no matter what z-index it asks for — and
 * `.de-panel` has an opaque `background`. The menu would have been perfectly
 * unclipped and perfectly invisible, hidden behind the panel it drops out of.
 *
 * `document.body` with a z-index above `.de-root` is what the other popover
 * launched from this panel already does — see `.de-asset-details` in
 * `css/assets.ts`, which escapes the same clip for the same reason. Reusing its
 * answer keeps one pattern for "a panel control opened a floating card" rather
 * than two, and it is the only mount point in this document from which the card
 * can be both unclipped and on top.
 *
 * ## Why a network failure on the switch is a SUCCESS
 *
 * The POST asks the start screen to start another app, and the first thing the
 * supervisor does once it accepts is SIGTERM this editor — which is the process
 * serving the proxy this page is loaded from and the route the POST is in
 * flight to. So the happy path frequently ends with a dropped connection and no
 * response at all. Treating that as an error would show a failure message on
 * every successful switch, and the only thing that can drop that connection is
 * the server we just asked to go away doing exactly what we asked. A JSON error
 * body is a different animal entirely: the server is alive and declining, so
 * that one is reported and nothing navigates.
 */

import { readScoped, writeScoped } from "../core/app-scope"
import { config } from "../core/config"
import { el } from "../core/dom"
import { focusControl } from "../core/focus"
import { icon } from "../core/icons"
import { tokens } from "../core/tokens"
import type { EditorContext } from "../core/context"

/**
 * One row of the chooser, and there are two kinds of them.
 *
 * `editor` is an app that already has an editor of its own running on this
 * machine, discovered through the registry in `runtime/editor-registry.mjs`.
 * `target` is that editor's proxy, and switching to it is a NAVIGATION — the
 * editor is already up, so there is nothing to start and nothing to kill, and
 * whatever is queued in this tab is not at risk because this tab is not the one
 * being replaced.
 *
 * `app` is a running dev server with no editor pointed at it. Only the start
 * screen can find those and only a supervisor can act on one, so `target` is
 * null and switching means the slower path: ask the screen, let it replace this
 * editor, wait out the handover.
 */
interface RunningApp {
  kind?: "editor" | "app"
  port: number
  url: string
  title: string
  projectRoot: string | null
  packageName: string | null
  /** Another editor's proxy, for a row that is reached by going there. */
  target?: string | null
}

/**
 * The whole answer, including the two ways it can decline to list anything.
 *
 * `chooser: false` and `error` are both 200s in the contract, because "there is
 * nothing to choose" is an answer rather than a fault, and a menu that renders
 * an answer is worth more than one that renders a failed request.
 */
interface AppsResponse {
  chooser?: boolean
  apps?: RunningApp[]
  error?: string
}

const CHOOSER = {
  empty: "Choose an app",
  looking: "Looking for running apps\u2026",
} as const

/** Clear of the viewport edge, and the gap under the trigger. Both from the menu's own vocabulary. */
const EDGE = 8
const GAP = 4

/**
 * An id no other element in this document already has.
 *
 * A plain counter was not enough, and the way it failed is worth writing down
 * because nothing about it is visible. A counter is per MODULE, and a module
 * can be instantiated more than once in one document — two bundles built
 * against two different configs, which is exactly how the suites compare a
 * session that knows its app against one that does not. Both counters start at
 * zero, both controls claim `de-app-menu-1`, and `getElementById` hands the
 * second trigger the FIRST trigger's menu. Everything then works except that
 * one control opens a menu nobody can see while the other holds rows nobody
 * asked for, and no assertion about either of them reads as wrong.
 *
 * Asking the document is the only check that cannot be fooled by that, because
 * the document is the thing the id has to be unique in.
 */
let sequence = 0

function freeMenuId(): string {
  let candidate = `de-app-menu-${++sequence}`
  while (document.getElementById(candidate)) candidate = `de-app-menu-${++sequence}`
  return candidate
}


/**
 * The project folder a running app was started from, as a word rather than a
 * path.
 *
 * Split on both separators because the editor's browser half has no `path`
 * module and no idea which platform the server is on — a Windows host answers
 * `C:\work\shop` and the same code has to name the same folder. Trailing
 * separators are dropped by the filter so `/work/shop/` is still `shop`.
 */
function folderName(path: string): string {
  const parts = path.split(/[/\\]+/).filter((part) => part.length > 0)
  return parts[parts.length - 1] ?? path
}

/** Enough of a check that a cache written by an older build cannot draw a broken menu. */
function isRecordLike(value: unknown): value is AppsResponse {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/** What a row calls an app: its package, then its title, then the url it answers on. */
function appLabel(app: RunningApp): string {
  return app.packageName || app.title || app.url
}

/**
 * Whether a listed app is the one this editor is already pointed at, compared
 * by PORT rather than by string.
 *
 * The two answers are built by different machines and spell loopback
 * differently. The prelude names the app `http://127.0.0.1:<port>`, because
 * that is the address the proxy was aimed at; the scanner names it whichever of
 * `127.0.0.1` and `[::1]` answered first, and on an IPv6-first machine a `vite`
 * or `ng serve` binding the NAME `localhost` answers only on the second. So a
 * string compare marks nothing as current on exactly the machines where the
 * scanner had to work hardest to find the app at all.
 *
 * The port is the part that cannot be spelled two ways. Both sides are loopback
 * by construction — the config reader and the start screen each refuse anything
 * else — so two loopback urls sharing a port are the same server, and there is
 * nothing left for the host to disambiguate.
 */
function isCurrentApp(app: RunningApp, currentUrl: string | null): boolean {
  if (!currentUrl) return false
  if (app.url === currentUrl) return true
  try {
    const listed = new URL(app.url)
    const current = new URL(currentUrl)
    return listed.protocol === current.protocol && listed.port === current.port
  } catch {
    return false
  }
}

export function installAppChooser(context: EditorContext): {
  node: HTMLElement
  destroy(): void
} {
  const menuId = freeMenuId()
  const current = config.app
  const named = typeof current.name === "string" && current.name.length > 0

  /*
   * The name and the ghost instruction are the same span in the same shape.
   *
   * A control that is a button when it has a value and a line of hint text when
   * it does not is two controls, and the second one is the state a new session
   * opens in — so the chevron is drawn in both, and the empty state differs by
   * one modifier class that only changes the ink. Nothing about the box moves.
   */
  const nameNode = el("span", { class: "de-app-chooser-name" }, [
    named ? (current.name as string) : CHOOSER.empty,
  ])

  const trigger = el(
    "button",
    {
      class: `de-app-chooser${named ? "" : " de-app-chooser--empty"}`,
      type: "button",
      "aria-haspopup": "menu",
      "aria-expanded": "false",
      "aria-controls": menuId,
      // Names the app AND what pressing does. "Choose app" alone would leave a
      // screen reader user with no way to hear which app they are editing, and
      // the name alone would read as a heading rather than as a control.
      "aria-label": named
        ? `Editing ${current.name}. Choose a different app`
        : CHOOSER.empty,
    },
    [nameNode, icon("ChevronDown", tokens.icon.row)]
  )

  const menu = el("div", {
    class: "de-app-menu",
    id: menuId,
    role: "menu",
    "aria-label": "Running apps",
    style: "display:none",
  })
  document.body.append(menu)

  let isOpen = false
  /** Set while a menu is opened from the keyboard and its rows have not arrived yet. */
  let focusFirstOnLoad = false
  /** True from the first accepted click until the page is replaced. Rows go dead. */
  let switching = false
  /** The navigation is one-way and must not be attempted twice. */
  let leaving = false
  /** Torn down. The handover wait reads it, because it outlives the element. */
  let destroyed = false
  /**
   * The last answer this machine gave, seeded from storage so that the FIRST
   * open of a session is warm too — including the open right after an app
   * switch, which is a reload, and which is exactly when someone who has just
   * used this menu is most likely to use it again.
   */
  let cached: AppsResponse | null = null
  /**
   * Which `GET /apps` the menu is currently showing. A menu closed and reopened
   * before the first request settles would otherwise paint the stale answer
   * over the fresh "looking" line.
   */
  let request = 0

  const rows = (): HTMLButtonElement[] =>
    Array.from(menu.querySelectorAll<HTMLButtonElement>(".de-app-menu-row"))

  /**
   * Moves focus between rows, wrapping, and skipping any that a switch in
   * flight has already killed.
   *
   * A roving tabindex rather than a focusable list: one tab stop for the whole
   * menu means Tab LEAVES it instead of walking it, which is what `role="menu"`
   * promises a keyboard user and the arrow keys then deliver.
   */
  const focusRow = (index: number): void => {
    const live = rows().filter((row) => !row.disabled)
    if (live.length === 0) return
    const target = live[(index + live.length) % live.length]
    for (const row of live) row.tabIndex = row === target ? 0 : -1
    focusControl(target)
  }

  /**
   * A sentence where the rows would be.
   *
   * `role="menuitem"` with `aria-disabled`, rather than the bare `<div>` this
   * started as. Four of the menu's five states are a note and nothing else —
   * looking, nothing running, no chooser, the request failed — and a `<div>`
   * is not a permitted child of `role="menu"`: a screen reader walking the
   * menu's children is entitled to drop it, which would announce four of those
   * states as an empty menu. The disabled menu item is the standard way to say
   * "there is one thing here and it is not actionable", and it stays out of the
   * arrow keys' way for free, because `focusRow` walks `.de-app-menu-row` and
   * this is not one.
   */
  const note = (text: string): HTMLElement =>
    el(
      "div",
      { class: "de-app-menu-note", role: "menuitem", "aria-disabled": "true", tabindex: "-1" },
      [text]
    )

  /** The menu's whole content, replaced wholesale — it is never partially right. */
  const showNote = (text: string): void => {
    menu.replaceChildren(note(text))
  }

  /**
   * Measured after mount, because the row count decides the height.
   *
   * Clamped on both axes for the reason the layer stack is: a menu that opens
   * past the viewport edge is a menu with entries nobody can reach. The flip to
   * above the trigger is the one thing the layer stack does not need — it opens
   * at the pointer, which is never pinned to the top of a panel, while this one
   * always is and would drop off the bottom of a short window every time.
   *
   * `getBoundingClientRect` is called through `?.` for the same reason
   * `scrollIntoView` is everywhere else in this codebase: the suites drive this
   * file under jsdom, where a layout is a polite fiction.
   */
  const position = (): void => {
    const anchor = trigger.getBoundingClientRect?.()
    const box = menu.getBoundingClientRect?.()
    if (!anchor || !box) return
    const left = Math.max(
      EDGE,
      Math.min(anchor.left, window.innerWidth - box.width - EDGE)
    )
    const below = anchor.bottom + GAP
    const top =
      below + box.height > window.innerHeight - EDGE
        ? Math.max(EDGE, anchor.top - box.height - GAP)
        : below
    menu.style.left = `${left}px`
    menu.style.top = `${top}px`
  }

  const close = (restoreFocus = false): void => {
    if (!isOpen) return
    /*
     * A handover in progress pins the menu open.
     *
     * It is holding the only sentence on screen that explains why the app is
     * about to stop responding, and every ordinary way of dismissing it —
     * Escape, a click on the page, the window losing focus while the other
     * process starts — is something a person does reflexively in the seconds
     * this takes. Letting any of them through would leave a page that freezes
     * and then reloads with nothing having said what happened.
     */
    if (leaving) return
    isOpen = false
    focusFirstOnLoad = false
    menu.style.display = "none"
    menu.replaceChildren()
    shownSignature = null
    trigger.setAttribute("aria-expanded", "false")
    if (restoreFocus && trigger.isConnected) focusControl(trigger)
  }

  /**
   * A row that is the app you are already editing does nothing but close.
   *
   * Not disabled, because it is the one row that answers the question the menu
   * was opened to ask — "which one am I on" — and a disabled control is a
   * control you are told not to read. Switching to it would be a real switch:
   * the supervisor would kill this editor, spawn another on the same app, and
   * the session's unapplied work would be gone in exchange for nothing.
   */
  const rowFor = (app: RunningApp): HTMLButtonElement => {
    const isCurrent = isCurrentApp(app, config.app.url)
    const label = appLabel(app)
    /*
     * An app the scanner found but could not place on disk.
     *
     * `scanLocalApps` reads the project folder out of the paths a dev server
     * writes into its own page, and falls back to asking `lsof` which directory
     * the process was started in. Both can come up empty — a server that names
     * no paths, run from a machine where `lsof` is refused — and the row is
     * still worth drawing, because the app is genuinely there and its absence
     * from the list would be the stranger answer.
     *
     * What it must not do is offer to switch. The editor rewrites source files,
     * so without a folder there is nothing for it to edit, and the request is
     * refused by `server/apps.mjs` with a 400 the moment it arrives. Left live,
     * the row would take the click, tear down the menu's whole list and replace
     * it with a complaint about a folder there is no way to supply from here. It
     * is disabled up front instead, and the reason is on the row rather than in
     * the failure it would otherwise become.
     */
    /*
     * A row backed by a live editor is always switchable, whatever else is
     * missing from it: the destination is a URL that is already serving, so the
     * folder question the check below exists for cannot arise.
     */
    const target = typeof app.target === "string" && app.target.length > 0 ? app.target : null
    const placed = target !== null || (typeof app.projectRoot === "string" && app.projectRoot.length > 0)
    const folder =
      typeof app.projectRoot === "string" && app.projectRoot.length > 0
        ? folderName(app.projectRoot)
        : null
    const where = !placed
      ? `${app.url} \u00b7 source folder not found`
      : folder
        ? `${app.url} \u00b7 ${folder}`
        : app.url
    const ariaLabel = isCurrent
      ? `${label}, the app you are editing`
      : placed
        ? `Switch to ${label}`
        : `${label} — the editor could not find its project folder, so it cannot be opened from here`

    const nameLine = el("span", { class: "de-app-menu-name" }, [label])
    const row = el(
      "button",
      {
        class: `de-app-menu-row${isCurrent ? " de-app-menu-row--current" : ""}${
          placed || isCurrent ? "" : " de-app-menu-row--unplaced"
        }`,
        type: "button",
        role: "menuitem",
        tabindex: "-1",
        "aria-current": isCurrent ? "true" : undefined,
        "aria-label": ariaLabel,
      },
      [nameLine, el("span", { class: "de-app-menu-where" }, [where])]
    )
    // `disabled` and not merely a guard in the handler, so the row is dead to
    // the pointer, to the arrow keys (`focusRow` skips disabled rows) and to
    // assistive technology at once, rather than looking pressable and refusing.
    if (!placed && !isCurrent) row.disabled = true

    row.addEventListener("click", () => {
      if (switching) return
      if (isCurrent) {
        close(true)
        return
      }
      if (!placed) return
      /*
       * An editor of its own is already running, so this is a link.
       *
       * No POST, no waiting for a process to die and another to bind, no
       * handover note — the page simply goes there, the way clicking any link
       * goes anywhere. It is also the one switch that cannot cost this tab
       * anything, because nothing here is being torn down.
       */
      if (target) {
        if (leaving) return
        leaving = true
        close()
        window.location.assign(target)
        return
      }
      /*
       * One click, and it switches.
       *
       * This used to arm on the first press and go on the second, carrying a
       * warning naming the unsaved work a switch would cost. That was the right
       * control while the warning was TRUE, and the honest fix was not a better
       * warning: it was to stop the switch costing anything. The notes pinned to
       * a page and the ledger of changes the writer could not express are both
       * filed per app now (see `core/app-scope.ts`), so switching away puts them
       * under that app and switching back brings them out again.
       *
       * What a confirmation step cost, meanwhile, was the thing the menu is for.
       * Picking an app from a list is a navigation — the same gesture as
       * clicking a layer or a tab — and a navigation that answers the first
       * click with a question is one that has to be performed twice every time,
       * including the overwhelming majority of times when there was nothing to
       * lose at all.
       */
      void switchTo(app, label)
    })

    return row
  }

  /**
   * Every row goes dead the moment one of them is accepted; a second choice
   * cannot be queued.
   *
   * Re-enabling skips the rows that were never switchable in the first place.
   * A refused switch puts the menu back the way it was, and "the way it was"
   * included an app with no project folder sitting there disabled — waking it
   * on the way back would turn a failed switch into a row that now offers a
   * switch guaranteed to fail.
   */
  const setRowsDisabled = (disabled: boolean): void => {
    for (const row of rows()) {
      if (!disabled && row.classList.contains("de-app-menu-row--unplaced")) continue
      row.disabled = disabled
    }
  }

  const switchTo = async (app: RunningApp, label: string): Promise<void> => {
    switching = true
    setRowsDisabled(true)

    let failure: string | null = null
    try {
      const response = await fetch(`${context.apiBase}/apps/switch`, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        // `devScript: null` explicitly: the server picks the script it started
        // the app with, and an absent key would leave it guessing whether the
        // browser meant "use the default" or "the browser is an old build".
        body: JSON.stringify({ url: app.url, projectRoot: app.projectRoot, devScript: null }),
      })
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { message?: string } | null
        failure =
          typeof body?.message === "string" && body.message.length > 0
            ? body.message
            : `Could not switch apps (${response.status})`
      }
    } catch {
      // See the header: the connection dropping is the supervisor killing this
      // process, which is the successful outcome and not a fault to report.
      failure = null
    }

    if (failure) {
      switching = false
      setRowsDisabled(false)
      // Both, and not one or the other. The toast is what a designer looking at
      // the canvas will see; the note is what is still there a second later,
      // under the row they pressed, when they look back at the menu.
      showNote(failure)
      context.toast(failure, "error")
      return
    }

    leave(label)
  }

  /**
   * One request against this page's own origin, answered as a plain boolean.
   *
   * `no-store` because the whole question is whether a server is on the other
   * end right now, and a cached 200 from the editor being replaced is the one
   * answer that would be wrong. Any response at all counts as alive — a proxy
   * that is up but still compiling the app answers 500, and it is still up.
   */
  const proxyAlive = async (): Promise<boolean> => {
    try {
      await fetch(`${context.apiBase}/apps`, { cache: "no-store", headers: { accept: "application/json" } })
      return true
    } catch {
      return false
    }
  }

  const wait = (ms: number): Promise<void> =>
    new Promise((resolve) => {
      window.setTimeout(resolve, ms)
    })

  /**
   * Waits out the handover and reloads in place, rather than sending the
   * designer back to the screen they came here to stop needing.
   *
   * The old behaviour was one line — navigate to the start screen and let it
   * forward — and it worked, because that page polls and redirects. What it
   * cost was the point of the whole control: picking an app from a menu inside
   * the editor put a full-page interstitial on screen anyway, so switching
   * still read as leaving and coming back rather than as changing what you are
   * looking at.
   *
   * TWO phases, and the first is what makes the second trustworthy. The
   * supervisor gives this editor a SIGTERM and then binds the next one to the
   * same proxy port — 3456 both times is the normal case — so a single "is it
   * up" poll would be satisfied immediately by the process that is about to
   * die, reload into it, and land on whatever it serves in its last moment.
   * Waiting for the port to go quiet FIRST is the only way this page can tell
   * the two apart from the outside.
   *
   * Every way out of the wait ends somewhere real. The port never dying means
   * the switch did not take; the port never coming back means the next editor
   * failed to start, and the start screen is the page that knows why, because
   * the supervisor reports the reason to it. Both fall through to the
   * navigation this replaced, so the worst case here is the behaviour that was
   * here before.
   */
  const DEATH_BUDGET_MS = 15_000
  const REVIVAL_BUDGET_MS = 60_000
  const POLL_MS = 400

  const settleIntoNewEditor = async (label: string): Promise<void> => {
    const until = async (alive: boolean, budget: number): Promise<boolean> => {
      const deadline = Date.now() + budget
      while (Date.now() < deadline) {
        /*
         * A control that has been torn down stops watching, and this is the
         * check that makes the whole wait safe to start.
         *
         * The loop outlives the element by up to seventy-five seconds, and what
         * it does at the end of it is reload the page. A detached control that
         * kept counting would eventually reload a document it is no longer part
         * of — out from under whatever replaced it, for a switch nobody is
         * waiting on any more.
         */
        if (destroyed) return false
        if ((await proxyAlive()) === alive) return true
        await wait(POLL_MS)
      }
      return false
    }

    if (await until(false, DEATH_BUDGET_MS)) {
      if (await until(true, REVIVAL_BUDGET_MS)) {
        window.location.reload()
        return
      }
    }
    if (destroyed) return
    // Neither phase landed. The start screen is the one page that can say what
    // became of the editor, so this is where the old behaviour is kept.
    if (config.chooserUrl) window.location.assign(config.chooserUrl)
    else showNote(`${label} did not come up, and there is no start screen to ask why.`)
  }

  /**
   * The switch has been accepted and this editor is being taken down with it.
   *
   * The menu stays open and holds the explanation, because it is the surface
   * the click happened on and the app behind it is about to stop answering —
   * a toast alone would leave a page that visibly stops working with nothing
   * on it saying why.
   */
  const leave = (label: string): void => {
    if (leaving) return
    leaving = true
    context.toast(`Switching to ${label}\u2026`)
    showNote(`Starting ${label}. This editor reloads as soon as it is up.`)
    void settleIntoNewEditor(label)
  }

  const render = (payload: AppsResponse | null): void => {
    if (!payload) {
      showNote("Could not reach the editor server to list the running apps.")
      return
    }
    if (typeof payload.error === "string" && payload.error.length > 0) {
      showNote(payload.error)
      return
    }
    /*
     * No chooser behind this session, and the control still draws.
     *
     * Hiding it here would make the chrome's shape depend on how the editor was
     * started, so a designer who learns the control on one machine looks for it
     * and finds nothing on another. The honest version keeps the name of the
     * app on screen — which is useful on its own — and says why the list is
     * empty when it is opened.
     */
    if (payload.chooser === false) {
      showNote(
        "This session was started without the app chooser, so there is nothing to switch between."
      )
      return
    }
    const apps = Array.isArray(payload.apps) ? payload.apps : []
    if (apps.length === 0) {
      showNote(
        config.chooserUrl
          ? `Nothing else is running. Start another app from ${config.chooserUrl}`
          : "Nothing else is running."
      )
      return
    }
    const drawn: HTMLElement[] = apps.map(rowFor)
    /*
     * One sentence under the list when anything in it is unswitchable, and the
     * way out named in it.
     *
     * The disabled row says the folder was not found, which is the fact; this
     * says what to do about it, which the row has no room for and should not
     * repeat once per app. The start screen is where it is said, because that
     * screen has a field for typing a project path and this menu has nothing of
     * the kind — a chooser built out of what is already running cannot ask about
     * a folder nothing reported.
     */
    const unplaced = drawn.some((row) => row.classList.contains("de-app-menu-row--unplaced"))
    if (unplaced && config.chooserUrl) {
      drawn.push(
        note(
          `An app whose project folder could not be found has to be opened from the start screen at ${config.chooserUrl}, where its path can be typed in.`
        )
      )
    }
    menu.replaceChildren(...drawn)
    if (switching) setRowsDisabled(true)
    if (focusFirstOnLoad) {
      focusFirstOnLoad = false
      focusRow(0)
    }
  }

  /**
   * The answer this menu is currently DRAWN from, so an identical one can be
   * thrown away instead of repainting the card.
   *
   * A signature rather than the object: two fetches a second apart produce two
   * different objects describing the same three apps, and replacing the rows
   * for that would blink the menu under the cursor and move focus off whatever
   * the arrow keys had reached. Only the fields a row is built from are in it,
   * so a change nobody can see is not a change.
   */
  let shownSignature: string | null = null

  const signatureOf = (payload: AppsResponse | null): string =>
    payload === null
      ? "unreachable"
      : JSON.stringify([
          payload.chooser !== false,
          payload.error ?? "",
          (payload.apps ?? []).map((app) => [
            app.url,
            app.packageName,
            app.title,
            app.projectRoot,
          ]),
        ])

  /** Machine state, not app state: what is running is the same question whichever app is open. */
  const CACHE_KEY = "designlayer.running-apps"

  const readCache = (): AppsResponse | null => {
    const raw = readScoped(CACHE_KEY)
    if (!raw) return null
    try {
      const parsed = JSON.parse(raw) as AppsResponse
      return isRecordLike(parsed) ? parsed : null
    } catch {
      return null
    }
  }

  /**
   * Never caches a failure.
   *
   * A cached error would be shown instantly on the next open and then sit there
   * until a fetch replaced it, which is the one thing worse than the delay the
   * cache exists to remove: a menu that opens already claiming something is
   * broken, about a request that has not been made yet.
   */
  const writeCache = (payload: AppsResponse | null): void => {
    if (payload === null || typeof payload.error === "string") return
    writeScoped(CACHE_KEY, JSON.stringify(payload))
  }

  /**
   * Fetches, and repaints only if the answer is different from what is up.
   *
   * This is the revalidate half of the menu's bargain. The open half draws the
   * last known list at once, which is almost always right — the set of dev
   * servers on a machine changes a few times a day, and the menu is opened far
   * more often than that. So the common case is that this returns, finds the
   * signature unchanged, and does nothing at all: no repaint, no reflow, no
   * focus lost, nothing on screen to notice.
   *
   * When it HAS changed — a prototype started in another terminal since the
   * last look — the rows are replaced and the card is repositioned, which is a
   * visible change because a real one happened.
   */
  const load = async (): Promise<void> => {
    const token = ++request
    let payload: AppsResponse | null = null
    try {
      const response = await fetch(`${context.apiBase}/apps`, {
        cache: "no-store",
        headers: { accept: "application/json" },
      })
      payload = (await response.json()) as AppsResponse
    } catch {
      payload = null
    }
    if (token !== request) return
    writeCache(payload)
    cached = payload ?? cached
    // Closed since: the answer is banked for the next open and nothing is drawn.
    if (!isOpen) return
    /*
     * A failed refresh with a list already on screen changes nothing.
     *
     * The rows are the last thing this machine actually reported, and they stay
     * more useful than an apology — the editor's own server having a moment
     * says nothing about whether those apps are still running. An unreachable
     * server is only worth reporting when there is nothing else to show.
     */
    if (payload === null && shownSignature !== null && shownSignature !== "unreachable") return
    const signature = signatureOf(payload)
    if (signature === shownSignature) return
    render(payload)
    position()
  }

  /**
   * Warms the cache without opening anything.
   *
   * Two moments, and both are ones where the answer is wanted shortly but not
   * yet. Boot is the obvious one — the first open of a session would otherwise
   * be the one open that waits — and it is deferred so it queues behind the
   * chrome actually appearing rather than competing with it. A pointer arriving
   * on the trigger is the better one: it is the most reliable signal in a
   * pointer interface that a click is coming, and it buys the round trip the
   * distance between hovering a control and pressing it.
   */
  let warmedAt = 0
  const warm = (): void => {
    // A hand resting on the control must not become a request per frame, and
    // two opens in quick succession should not each pay for a scan.
    if (isOpen || Date.now() - warmedAt < 1500) return
    warmedAt = Date.now()
    void load()
  }

  const open = (fromKeyboard: boolean): void => {
    if (isOpen) return
    isOpen = true
    focusFirstOnLoad = fromKeyboard
    trigger.setAttribute("aria-expanded", "true")
    menu.style.display = "block"
    menu.style.left = "0px"
    menu.style.top = "0px"
    /*
     * The last known list, drawn in the same task as the click.
     *
     * The menu used to open holding "Looking for running apps…" and swap it for
     * rows a round trip later. Two things were wrong with that, and the second
     * is the one that mattered. The delay was one; but the swap also resized
     * the card from one line to three under a cursor that had just stopped
     * moving, so a menu that was about to be read jumped instead — and because
     * the answer is nearly always the same three apps, it jumped to say nothing
     * new.
     *
     * The note is now only for a menu that genuinely has nothing to show yet,
     * which after the first open of the first session is nobody.
     */
    if (cached) {
      render(cached)
      shownSignature = signatureOf(cached)
    } else {
      showNote(CHOOSER.looking)
      shownSignature = null
    }
    position()
    void load()
  }

  trigger.addEventListener("click", (event) => {
    if (isOpen) {
      close(true)
      return
    }
    // `detail === 0` is a click the keyboard synthesised from Enter or Space.
    // A pointer click leaves focus on the trigger, where the hand already is;
    // a keyboard one has to land somewhere the arrow keys can work from.
    open((event as MouseEvent).detail === 0)
  })

  trigger.addEventListener("keydown", (event) => {
    const key = (event as KeyboardEvent).key
    if (isOpen || (key !== "ArrowDown" && key !== "ArrowUp")) return
    event.preventDefault()
    open(true)
  })

  const onPointerDown = (event: Event): void => {
    if (!isOpen) return
    const target = event.target as Node
    // The trigger is excluded as well as the menu: closing here and toggling on
    // the click that follows would reopen it, and the control would need two
    // presses to shut.
    if (menu.contains(target) || trigger.contains(target)) return
    close()
  }

  const onKeyDown = (event: KeyboardEvent): void => {
    if (!isOpen) return
    const all = rows().filter((row) => !row.disabled)
    const index = all.indexOf(document.activeElement as HTMLButtonElement)
    if (event.key === "Escape") {
      event.preventDefault()
      event.stopImmediatePropagation()
      close(true)
      return
    }
    if (event.key === "ArrowDown") focusRow(index + 1)
    else if (event.key === "ArrowUp") focusRow(index - 1)
    else if (event.key === "Home") focusRow(0)
    else if (event.key === "End") focusRow(all.length - 1)
    else if ((event.key === "Enter" || event.key === " ") && index >= 0) all[index].click()
    else return
    event.preventDefault()
    event.stopImmediatePropagation()
  }

  /*
   * Scroll closes rather than repositions, and blur closes rather than waits.
   *
   * The menu is anchored to a control in a panel that scrolls independently of
   * the page, so following the anchor would mean measuring on every frame of
   * someone else's scroll. Closing is what the layer stack does and it is the
   * right trade for a menu nobody holds open: the gesture that scrolled is
   * evidence the reader is looking at something else.
   */
  const onScroll = (): void => close()
  const onBlur = (): void => close()

  /*
   * Seeded before anything can open the menu, and warmed a moment after boot.
   *
   * The read is synchronous and off localStorage, so it costs nothing at a
   * point in the session where cost would be noticed; the fetch behind it is
   * pushed past the frame the chrome mounts in, because a port scan competing
   * with the editor appearing is a worse trade than a first open that is warm
   * a second later than it could have been.
   */
  cached = readCache()
  const warmTimer = window.setTimeout(warm, 800)

  // The most reliable signal in a pointer interface that a click is coming, and
  // `focusin` is its keyboard equivalent for someone tabbing to the control.
  trigger.addEventListener("pointerenter", warm)
  trigger.addEventListener("focusin", warm)

  window.addEventListener("pointerdown", onPointerDown, true)
  window.addEventListener("keydown", onKeyDown, true)
  window.addEventListener("scroll", onScroll, true)
  window.addEventListener("blur", onBlur)

  return {
    node: trigger,
    /*
     * Tears down everything that outlives the trigger, which is all of it.
     *
     * The menu is in `document.body` and the four listeners are on `window`, so
     * removing the button from the panel would leave both behind — a menu that
     * can still be opened by a keystroke aimed at whatever replaced it. The
     * handover wait goes too, and it is the one that matters: it outlives the
     * element by up to seventy-five seconds and ends by reloading the page.
     */
    destroy() {
      // First, so a handover wait already in flight stops before anything else
      // here runs. It is the one thing in this control that can outlive the
      // element, and what it does at the end is reload the page.
      destroyed = true
      window.clearTimeout(warmTimer)
      // Bumped so an in-flight `GET /apps` cannot render into a menu that is
      // already gone from the document.
      request += 1
      isOpen = false
      window.removeEventListener("pointerdown", onPointerDown, true)
      window.removeEventListener("keydown", onKeyDown, true)
      window.removeEventListener("scroll", onScroll, true)
      window.removeEventListener("blur", onBlur)
      menu.remove()
    },
  }
}
