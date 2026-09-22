/**
 * The start screen document: the product's front door.
 *
 * Until now the only way in was `designlayer --dev 3000` — you had to know
 * the port, the project root and the flag before anything appeared. This page
 * is the replacement, and it is served by the start-screen server before the
 * editing proxy exists, so it has to be one self-contained document: inline
 * style, inline module script, no fetches for anything but its own loopback
 * JSON routes.
 *
 * Everything the script renders from the server — a page title, a folder name,
 * an error sentence — arrives as untrusted string data and is written with
 * `textContent`. That is the whole injection surface of this feature, and it is
 * closed by never building markup from a string.
 */

import { startScreenStyle } from "./start-screen-style.mjs"

/** How long the waiting state stays silent before it says what to check. */
const SLOW_MS = 90_000

/** Long enough that a path is typed rather than spelled, short enough to feel live. */
const TYPING_MS = 300

const CLIENT = `
const $ = (id) => document.getElementById(id)
const el = {
  form: $("form"), url: $("url"),
  apps: $("apps"), appsNote: $("apps-note"), appsError: $("apps-error"),
  path: $("folder-path"), folderError: $("folder-error"),
  scriptRow: $("script-row"), script: $("script"),
  submit: $("submit"), hint: $("hint"), submitError: $("submit-error"),
  waiting: $("waiting"), progress: $("progress"), waitingNote: $("waiting-note"),
  current: $("current"), currentName: $("current-name"), currentWhere: $("current-where"),
  currentOpen: $("current-open"), currentChange: $("current-change"),
  stopped: $("stopped"),
}

let apps = []
let root = null   // { path, info } — the folder the editor will write source into
let devScript = null
let busy = false
let typing = 0
// The editor this tab knows is up, if any. Only ever read to decide whether a
// press is a start or a switch — the server is the authority on what is running.
let runningUrl = null

/*
 * The browser is never told the server's home directory and the API contract is
 * frozen, so the two conventional layouts are recognised by shape. Anything
 * else renders in full, which is correct — only longer.
 */
const HOME = /^(\\/Users\\/[^/]+|\\/home\\/[^/]+|[A-Za-z]:\\\\Users\\\\[^\\\\]+)(?=[/\\\\]|$)/
const tilde = (value) => value.replace(HOME, "~")

function show(node, message) {
  node.textContent = message
  node.hidden = message === ""
}

function clearErrors() {
  for (const node of [el.appsError, el.folderError, el.submitError]) show(node, "")
}

/** A typed URL only counts as one of the detected apps if it is loopback. */
function portOf(value) {
  try {
    const url = new URL(/^[a-z]+:\\/\\//i.test(value) ? value : "http://" + value)
    const host = url.hostname.replace(/^\\[|\\]$/g, "")
    if (host !== "localhost" && host !== "127.0.0.1" && host !== "::1") return null
    return Number(url.port || (url.protocol === "https:" ? 443 : 80))
  } catch {
    return null
  }
}

const matchedApp = () => {
  const port = portOf(el.url.value.trim())
  return port === null ? null : apps.find((app) => app.port === port) ?? null
}

function render() {
  const app = matchedApp()
  for (const row of el.apps.children) {
    row.setAttribute("aria-pressed", String(app !== null && Number(row.dataset.port) === app.port))
  }
  // The field is never written from here — it is the one control the user types
  // into, and render() runs on every keystroke.
  const scripts = root ? root.info.devScripts : []
  el.scriptRow.hidden = app !== null || scripts.length < 2
  el.submit.textContent = app ? "Start designing" : "Start app & designing"
  // A disabled primary button has to say what is missing. The folder is the one
  // thing the machine often cannot work out for itself, so it is the one step
  // most likely to be sitting unanswered here.
  if (!root) show(el.hint, el.url.value.trim() === "" ? "" : "Now the folder its source is in.")
  else if (app) show(el.hint, "")
  else if (devScript) show(el.hint, "Runs npm run " + devScript + " in " + tilde(root.path))
  else show(el.hint, "That folder has no dev script in its package.json.")
  el.submit.disabled = busy || el.url.value.trim() === "" || !root || (!app && !devScript)
}

async function askServer(path, errorNode, init) {
  let response
  try {
    response = await fetch(path, init)
  } catch (error) {
    show(errorNode, "Could not reach the start screen: " + error.message)
    return null
  }
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    show(errorNode, (data && data.error) || "The start screen answered " + response.status + ".")
    return null
  }
  return data
}

function adoptProject(project) {
  root = { path: project.path, info: project }
  // Only when it differs, so confirming what was pasted does not move the caret.
  if (el.path.value !== project.path) el.path.value = project.path
  devScript = project.devScripts[0] ?? null
  el.script.replaceChildren()
  for (const name of project.devScripts) {
    const option = document.createElement("option")
    option.value = name
    option.textContent = name
    el.script.append(option)
  }
  if (devScript) el.script.value = devScript
}

function appRow(app) {
  const row = document.createElement("button")
  row.type = "button"
  row.className = "app"
  row.dataset.port = String(app.port)
  row.setAttribute("aria-pressed", "false")
  const name = document.createElement("span")
  name.className = "app-name"
  name.textContent = app.title || app.url
  const port = document.createElement("span")
  port.className = "app-port"
  port.textContent = ":" + app.port
  row.append(name, port)
  row.addEventListener("click", () => chooseApp(app))
  return row
}

/*
 * The row says nothing about where its source is, so whatever folder is in the
 * field belongs to the app that was picked before it. Left standing, Start is
 * enabled and the editor boots pointed at THIS server with THAT app's source
 * tree — every edit written into the wrong project. Clearing it costs the path
 * being typed again; leaving it costs the other project.
 *
 * The sentence is only said when something was actually taken away. A field
 * that was already empty is the ordinary first-load state, and the hint under
 * the button already asks for the folder. When it is said it points at the
 * field, because typing a path there is now the only way to close the gap it
 * reports.
 */
function forgetProject(app) {
  const had = root !== null || el.path.value.trim() !== ""
  root = null
  devScript = null
  el.path.value = ""
  if (had) show(el.folderError, "The editor cannot work out where " + app.title + " keeps its source. Type the path to its folder below.")
}

async function chooseApp(app) {
  clearErrors()
  // A path in the field is the page the user asked for, and it is theirs to
  // keep as long as it is a page of the app being clicked. Row to row it is a
  // page of the app they just left, so it goes with the origin.
  if (matchedApp() !== app) el.url.value = app.url
  if (app.projectRoot) {
    const data = await askServer("/api/project?path=" + encodeURIComponent(app.projectRoot), el.folderError)
    if (data) adoptProject(data.project)
  } else forgetProject(app)
  render()
}

/*
 * The typed path, resolved once the typing stops.
 *
 * This is how a project folder is named. A native folder panel used to sit
 * beside this field; it was dropped, because it put a second, slower way to say
 * the same thing on screen — one that also had to be built three times, once
 * per desktop, and could open behind the browser window with nothing on the
 * page to explain where it had gone.
 *
 * What is left has to carry the cases the panel used to: a project the machine
 * will not name for itself — a dev server whose cwd macOS refuses to report —
 * is reachable only by saying where it is. Finder's Copy as Pathname, the
 * shell's pwd, and a folder dragged onto a terminal all produce exactly what
 * this field takes, which is what makes that a fair trade rather than a loss.
 */
async function resolveTyped() {
  const value = el.path.value.trim()
  if (value === "") return
  if (!/^([/~]|[A-Za-z]:[\\\\/])/.test(value)) {
    show(el.folderError, "Paste the folder's full path — the one starting at /.")
    return
  }
  const data = await askServer("/api/project?path=" + encodeURIComponent(value), el.folderError)
  // Typed on while that was in flight; the later keystroke owns the field.
  if (!data || el.path.value.trim() !== value) return
  if (!data.project.isDirectory) {
    show(el.folderError, "There is no folder at that path.")
    return
  }
  adoptProject(data.project)
  render()
}

el.path.addEventListener("input", () => {
  clearErrors()
  // Anything already adopted is stale the moment the path changes, so the
  // button goes back to disabled rather than starting the wrong project.
  root = null
  devScript = null
  render()
  clearTimeout(typing)
  typing = setTimeout(resolveTyped, ${TYPING_MS})
})

el.url.addEventListener("input", () => {
  clearErrors()
  render()
})
el.script.addEventListener("change", () => {
  devScript = el.script.value
  render()
})

/** What the server says is running right now, or null if it would not say. */
async function readStatus() {
  const response = await fetch("/api/status").catch(() => null)
  return response && response.ok ? await response.json().catch(() => null) : null
}

/*
 * The two faces of this card. Only one is ever up: what is running, or the form
 * for choosing what should be. The form stays built underneath either way, so
 * "Choose a different app" is one click rather than a second boot.
 */
function showCurrent(status) {
  runningUrl = status.url
  const editing = status.editing
  el.currentName.textContent =
    (editing && (editing.packageName || editing.appUrl)) || "An app is open in the editor"
  show(el.currentWhere, editing ? editing.appUrl + " — source in " + tilde(editing.projectRoot) : "")
  el.currentOpen.href = status.url
  el.form.hidden = true
  el.waiting.hidden = true
  el.current.hidden = false
}

function showChooser() {
  el.current.hidden = true
  el.waiting.hidden = true
  el.form.hidden = false
  el.url.focus()
}

el.currentChange.addEventListener("click", () => {
  show(el.stopped, "")
  showChooser()
})

el.form.addEventListener("submit", async (event) => {
  event.preventDefault()
  if (el.submit.disabled) return
  clearErrors()
  const script = matchedApp() ? null : devScript
  busy = true
  render()

  let response
  try {
    response = await fetch("/api/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: el.url.value.trim(), projectRoot: root.path, devScript: script }),
    })
  } catch (error) {
    busy = false
    render()
    show(el.submitError, "Could not reach the start screen: " + error.message)
    return
  }

  const data = await response.json().catch(() => null)
  if (!response.ok) {
    busy = false
    render()
    show(el.submitError, (data && data.error) || "The start screen answered " + response.status + ".")
    return
  }
  waitForEditor(script, runningUrl !== null)
})

/*
 * A first Next.js compile routinely runs past thirty seconds, so this state has
 * no deadline. It keeps polling forever and, once it is clearly slow, says
 * where to look instead of failing into a dead end.
 *
 * This is also the one path that still moves the tab by itself, and it should:
 * whoever pressed Start asked to go there. A tab that merely loaded this URL
 * gets the card above instead.
 */
function waitForEditor(script, switching) {
  el.form.hidden = true
  el.current.hidden = true
  show(el.stopped, "")
  el.waiting.hidden = false
  el.progress.textContent = switching
    ? "Switching…"
    : script
      ? "Starting your app…"
      : "Starting the editor…"
  const startedAt = Date.now()
  const poll = async () => {
    const data = await readStatus()
    // The editor that was up is cleared the moment a choice is accepted, so
    // a ready answer here can only be the one this press asked for, which matters
    // because a switch usually lands back on the very same port.
    if (data && data.ready) {
      location.replace(data.url)
      return
    }
    // It died on the way up. The chooser is still here, so this is a sentence
    // to read and another go, not a page that polls for a process nobody runs.
    if (data && data.stopped) {
      busy = false
      runningUrl = null
      render()
      showChooser()
      show(el.stopped, data.stopped)
      return
    }
    if (Date.now() - startedAt > ${SLOW_MS}) {
      show(
        el.waitingNote,
        "Still working. A first compile can take a while — the terminal running designlayer has the app's output."
      )
    }
    setTimeout(poll, 500)
  }
  poll()
}

async function boot() {
  // Asked before the scan, which costs a second and a half: a tab that comes
  // back to this URL to reach a running editor should not wait on discovery.
  const status = await readStatus()
  if (status && status.ready) showCurrent(status)
  else if (status && status.stopped) show(el.stopped, status.stopped)

  const data = await askServer("/api/apps", el.appsError)
  apps = (data && data.apps) || []
  el.apps.replaceChildren(...apps.map(appRow))
  show(
    el.appsNote,
    apps.length
      ? ""
      : "Nothing is running yet. Type the URL your dev server will use and it will be started for you."
  )
  if (apps.length && el.url.value.trim() === "") await chooseApp(apps[0])
  else render()
}

boot()
`

export function startScreenPage() {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<title>designlayer — open an app</title>
<style>${startScreenStyle()}</style>
</head>
<body>
<main class="card">
  <header>
    <p class="brand">designlayer</p>
    <p class="lede">Open a running dev server and edit the page straight into its source.</p>
  </header>

  <!--
    What is running, for a tab that arrived here rather than one that pressed
    Start. This used to be a redirect, which is why there was no way back to the
    chooser at all: the URL bounced to the editor and the session was over.
  -->
  <div class="section" id="current" hidden>
    <p class="label">Now editing</p>
    <p class="lede" id="current-name"></p>
    <p class="note" id="current-where"></p>
    <div class="actions">
      <a class="primary" id="current-open">Open the editor</a>
      <button type="button" class="ghost" id="current-change">Choose a different app</button>
    </div>
  </div>

  <p class="note" id="stopped" hidden></p>

  <form id="form" autocomplete="off">
    <div class="section">
      <label class="label" for="url">Dev server URL</label>
      <input id="url" name="url" type="text" spellcheck="false" autofocus
             placeholder="http://127.0.0.1:3000">
    </div>

    <div class="section">
      <p class="label">Running locally</p>
      <div class="apps" id="apps"></div>
      <p class="note" id="apps-note">Looking for dev servers…</p>
      <p class="error" id="apps-error" hidden></p>
    </div>

    <div class="section">
      <label class="label" for="folder-path">Project folder</label>
      <input id="folder-path" class="path" type="text" spellcheck="false"
             placeholder="/Users/you/Projects/your-app">
      <p class="error" id="folder-error" hidden></p>
    </div>

    <div class="section" id="script-row" hidden>
      <label class="label" for="script">Dev script</label>
      <select id="script"></select>
    </div>

    <div class="section">
      <button type="submit" class="primary" id="submit" disabled>Start designing</button>
      <p class="note" id="hint" hidden></p>
      <p class="error" id="submit-error" hidden></p>
    </div>
  </form>

  <div class="waiting" id="waiting" hidden>
    <p class="progress"><span class="pulse"></span><span id="progress"></span></p>
    <p class="note" id="waiting-note" hidden></p>
  </div>
</main>
<script type="module">${CLIENT}</script>
</body>
</html>
`
}
