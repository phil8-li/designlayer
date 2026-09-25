#!/usr/bin/env node

/**
 * Installs DesignLayer as a Mac app without compiling or signing anything.
 *
 *   node desktop/mac/install.mjs                 install (LaunchAgent + Chrome app) and open it
 *   node desktop/mac/install.mjs --dry-run       print the plan, change nothing
 *   node desktop/mac/install.mjs --start         (re)start the desk server
 *   node desktop/mac/install.mjs --stop          stop the desk server until next login/--start
 *   node desktop/mac/install.mjs --status        LaunchAgent, health, start screen, app + Santa
 *   node desktop/mac/install.mjs --app-window    fallback: open a Chrome --app window instead of the shim
 *   node desktop/mac/install.mjs --verify-window launch the installed app over CDP and check it loads
 *   node desktop/mac/install.mjs --uninstall [--yes]
 *
 * Why this shape: under Santa lockdown, locally compiled or ad-hoc signed
 * binaries (Electron, Tauri, swiftc, osacompile) are blocked. The pieces used
 * here are all already allowed — Apple's launchctl/open/osascript, the fleet's
 * Homebrew node, and the app shim Chrome writes for an installed web app, which
 * Santa allows transitively because Chrome is the compiler rule.
 */

import { execFileSync, spawn } from "node:child_process"
import fs from "node:fs"
import http from "node:http"
import os from "node:os"
import path from "node:path"
import readline from "node:readline"
import { fileURLToPath } from "node:url"

import { CHROME_BINARY, chromeProfileDir, openChrome, profileInUse, quitProfileChrome } from "./chrome-pipe.mjs"
import { LABEL, buildPlist, logDir, plistPath } from "./launch-agent.mjs"

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(HERE, "..", "..")
const SERVER = path.join(HERE, "desk-server.mjs")
const PORT = Number(process.env.DESIGNLAYER_DESK_PORT) || 3454
const DESK_URL = `http://127.0.0.1:${PORT}/`
const HOME = os.homedir()
const UID = process.getuid()
const DOMAIN = `gui/${UID}`
const SHIM = path.join(HOME, "Applications", "Chrome Apps.localized", "DesignLayer.app")
const SHIM_LOADER = path.join(SHIM, "Contents", "MacOS", "app_mode_loader")
const PROFILE = chromeProfileDir(HOME)
const MARKER = path.join(path.dirname(PROFILE), ".installed-by-designlayer")
const LOG_FILE = path.join(logDir(HOME), "desk.log")

const args = new Set(process.argv.slice(2))
const DRY = args.has("--dry-run")
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const say = (line = "") => console.log(line)
const step = (n, total, line) => say(`\n[${n}/${total}] ${line}`)
const warn = (line) => say(`  !! ${line}`)

function run(cmd, argv, { allowFail = false } = {}) {
  try {
    return { ok: true, out: execFileSync(cmd, argv, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }) }
  } catch (error) {
    if (!allowFail) throw error
    return { ok: false, out: `${error.stdout ?? ""}${error.stderr ?? ""}`, code: error.status }
  }
}

/** `Rule : Allowed (Binary)` → "Allowed (Binary)". Read-only; santactl changes nothing. */
function santaRule(file) {
  const result = run("/usr/local/bin/santactl", ["fileinfo", file], { allowFail: true })
  const line = result.out.split("\n").find((l) => l.startsWith("Rule"))
  return { line: line?.trim().replace(/\s+:\s+/, ": ") ?? null, rule: line ? line.split(":").slice(1).join(":").trim() : null }
}

function santaMode() {
  const result = run("/usr/local/bin/santactl", ["status"], { allowFail: true })
  return result.out.match(/Mode\s*\|\s*(\S+)/)?.[1] ?? "unknown (santactl not found?)"
}

/**
 * The node launchd should run. Homebrew's `process.execPath` is the versioned
 * Cellar path, which disappears on `brew upgrade`; the /opt/homebrew/bin/node
 * symlink survives it. Use the stable symlink when it is the same binary.
 */
function stableNodePath() {
  const real = fs.realpathSync(process.execPath)
  for (const dir of (process.env.PATH ?? "").split(":")) {
    const candidate = path.join(dir, "node")
    try {
      if (candidate !== real && fs.realpathSync(candidate) === real) return candidate
    } catch {
      /* not there */
    }
  }
  return process.execPath
}

function health(timeoutMs = 1500) {
  return new Promise((resolve) => {
    const req = http.get(`${DESK_URL}api/health`, { timeout: timeoutMs }, (res) => {
      let body = ""
      res.on("data", (c) => (body += c))
      res.on("end", () => {
        try {
          resolve(JSON.parse(body))
        } catch {
          resolve(null)
        }
      })
    })
    req.on("timeout", () => req.destroy())
    req.on("error", () => resolve(null))
  })
}

async function waitFor(fn, ms, every = 500) {
  const deadline = Date.now() + ms
  for (;;) {
    const value = await fn()
    if (value) return value
    if (Date.now() > deadline) return null
    await sleep(every)
  }
}

function agentState() {
  const result = run("/bin/launchctl", ["print", `${DOMAIN}/${LABEL}`], { allowFail: true })
  if (!result.ok) return { loaded: false }
  return {
    loaded: true,
    state: result.out.match(/^\s*state = (.+)$/m)?.[1] ?? "unknown",
    pid: result.out.match(/^\s*pid = (\d+)$/m)?.[1] ?? null,
    lastExit: result.out.match(/last exit code = (.+)$/m)?.[1] ?? null,
  }
}

function plan() {
  const nodePath = stableNodePath()
  const plist = buildPlist({
    nodePath,
    serverPath: SERVER,
    repoRoot: REPO_ROOT,
    env: { PATH: process.env.PATH, HOME, LANG: process.env.LANG ?? "en_US.UTF-8" },
    logFile: LOG_FILE,
    port: PORT === 3454 ? undefined : PORT,
  })
  return { nodePath, plist }
}

function preflight() {
  const mode = santaMode()
  say(`  Santa mode: ${mode}`)
  const node = santaRule(process.execPath)
  say(`  node ${process.execPath} (${process.version}): ${node.line ?? "no Santa answer"}`)
  if (node.rule && !/Allowed/.test(node.rule)) {
    warn(`Santa does not allow this node binary (${node.rule}). The LaunchAgent would be killed on start.`)
    warn("Use a node that `santactl fileinfo` reports as Allowed, or wait for the fleet rule after a Homebrew upgrade.")
  }
  const chrome = fs.existsSync(CHROME_BINARY)
  say(`  Google Chrome: ${chrome ? CHROME_BINARY : "NOT FOUND"}`)
  if (!chrome) throw new Error("Google Chrome is required: the app window is a Chrome-installed web app.")
  return { mode, node }
}

function writeAgent({ plist }) {
  fs.mkdirSync(logDir(HOME), { recursive: true })
  fs.mkdirSync(path.dirname(plistPath(HOME)), { recursive: true })
  fs.writeFileSync(plistPath(HOME), plist)
  run("/usr/bin/plutil", ["-lint", plistPath(HOME)])
  run("/bin/launchctl", ["bootout", `${DOMAIN}/${LABEL}`], { allowFail: true })
  // bootout is asynchronous; bootstrap fails with "Input/output error" if it races.
  for (let i = 0; i < 10; i += 1) {
    const result = run("/bin/launchctl", ["bootstrap", DOMAIN, plistPath(HOME)], { allowFail: true })
    if (result.ok) return
    if (i === 9) throw new Error(`launchctl bootstrap failed: ${result.out.trim()}`)
    execFileSync("/bin/sleep", ["0.5"])
  }
}

async function installPwa() {
  if (profileInUse(PROFILE)) {
    say("  the DesignLayer app is open: quitting it to update the install")
    if (!(await quitProfileChrome(PROFILE))) {
      throw new Error(`A Chrome instance is using ${PROFILE}. Quit the DesignLayer app (⌘Q) and run the installer again.`)
    }
  }
  fs.mkdirSync(path.dirname(PROFILE), { recursive: true })
  if (!fs.existsSync(MARKER)) fs.writeFileSync(MARKER, `${new Date().toISOString()}\n`)
  const chrome = await openChrome({ userDataDir: PROFILE, args: ["--no-startup-window"] })
  try {
    // PWA.install refuses an app that is already installed ("Couldn't fetch
    // install info"), so a re-run keeps the registration unless the shim is gone.
    let installed = !(await chrome.send("PWA.getOsAppState", { manifestId: DESK_URL })).error
    if (installed && !fs.existsSync(SHIM_LOADER)) {
      await chrome.send("PWA.uninstall", { manifestId: DESK_URL })
      installed = false
    }
    if (installed) {
      say("  already installed in this profile: kept")
    } else {
      const result = await chrome.send("PWA.install", { manifestId: DESK_URL, installUrlOrBundleUrl: DESK_URL }, 60000)
      if (result.error) throw new Error(`PWA.install failed: ${result.error.message}`)
      say("  PWA.install: ok")
    }
    // CDP installs can default to "open in a browser tab"; the desk needs its own window.
    const mode = await chrome.send("PWA.changeAppUserSettings", { manifestId: DESK_URL, displayMode: "standalone" })
    say(`  display mode standalone: ${mode.error ? mode.error.message : "ok"}`)
    await waitFor(() => fs.existsSync(SHIM_LOADER), 15000)
  } finally {
    await chrome.close()
  }
}

function checkShim() {
  if (!fs.existsSync(SHIM_LOADER)) return { exists: false }
  const santa = santaRule(SHIM_LOADER)
  return { exists: true, ...santa, allowed: Boolean(santa.line && /Allowed/.test(santa.rule ?? "")) }
}

function openAppWindow() {
  const child = spawn(
    CHROME_BINARY,
    [`--user-data-dir=${PROFILE}`, `--app=${DESK_URL}`, "--no-first-run", "--no-default-browser-check"],
    { detached: true, stdio: "ignore" }
  )
  child.unref()
}

async function install() {
  const total = 5
  const p = plan()
  step(1, total, "Preflight")
  preflight()

  step(2, total, `LaunchAgent ${LABEL}`)
  say(`  plist: ${plistPath(HOME)}`)
  say(`  runs:  ${p.nodePath} ${SERVER}`)
  say(`  logs:  ${LOG_FILE}`)
  if (DRY) {
    say("  (dry run) would write this plist, then launchctl bootout + bootstrap " + DOMAIN)
    say(p.plist.split("\n").map((l) => `    ${l}`).join("\n"))
  } else {
    writeAgent(p)
    const up = await waitFor(() => health(), 20000)
    if (!up) throw new Error(`The desk did not answer on ${DESK_URL}api/health. See ${LOG_FILE}.`)
    say(`  health: ok (pid ${up.pid})`)
    const ss = await waitFor(async () => ((await health())?.startScreen?.ready ? (await health()).startScreen : null), 30000)
    say(ss ? `  start screen: ${ss.url} (${ss.owned ? "started by the desk" : "already running, reused"})` : "  start screen: not up yet (the desk keeps trying)")
  }

  step(3, total, `Chrome web app (profile ${PROFILE})`)
  if (DRY) {
    say(`  (dry run) would launch Chrome with --user-data-dir=<profile> --remote-debugging-pipe --enable-devtools-pwa-handler`)
    say(`  and send PWA.install {manifestId: "${DESK_URL}", installUrlOrBundleUrl: "${DESK_URL}"}`)
  } else {
    await installPwa()
  }

  step(4, total, "Santa decision for the app shim")
  if (DRY) {
    say(`  (dry run) would run santactl fileinfo ${SHIM_LOADER} and require Rule: Allowed`)
  } else {
    const shim = checkShim()
    if (!shim.exists) throw new Error(`Chrome did not write ${SHIM}. Try again, or use --app-window.`)
    say(`  ${SHIM_LOADER}`)
    say(`  ${shim.line}`)
    if (!shim.allowed) {
      warn("Santa does not allow the shim. The desk is running; open it with:")
      warn(`node ${path.relative(process.cwd(), fileURLToPath(import.meta.url)) || "install.mjs"} --app-window`)
      process.exitCode = 2
      return
    }
  }

  step(5, total, "Open DesignLayer")
  if (DRY) {
    say(`  (dry run) would run: open "${SHIM}"`)
    say("\nDry run: nothing was written, loaded or launched.")
    return
  }
  run("/usr/bin/open", [SHIM])
  say(`  opened ${SHIM}`)
  say(`\nInstalled. DesignLayer is in ~/Applications/Chrome Apps and can be kept in the Dock.`)
  say(`Uninstall: node ${path.join(HERE, "install.mjs")} --uninstall --yes`)
}

async function start() {
  if (!fs.existsSync(plistPath(HOME))) {
    say(`Not installed: ${plistPath(HOME)} is missing. Run: node ${path.join(HERE, "install.mjs")}`)
    process.exitCode = 1
    return
  }
  if (DRY) return say(`(dry run) would bootstrap or kickstart ${DOMAIN}/${LABEL}`)
  if (agentState().loaded) run("/bin/launchctl", ["kickstart", "-k", `${DOMAIN}/${LABEL}`])
  else run("/bin/launchctl", ["bootstrap", DOMAIN, plistPath(HOME)])
  const up = await waitFor(() => health(), 20000)
  say(up ? `Desk running on ${DESK_URL} (pid ${up.pid}).` : `The desk did not answer. See ${LOG_FILE}.`)
  if (!up) process.exitCode = 1
}

function stop() {
  if (DRY) return say(`(dry run) would launchctl bootout ${DOMAIN}/${LABEL}`)
  const result = run("/bin/launchctl", ["bootout", `${DOMAIN}/${LABEL}`], { allowFail: true })
  say(result.ok ? "Desk stopped. It starts again at login, or with --start." : "Desk was not loaded.")
}

async function status() {
  const agent = agentState()
  say(`LaunchAgent ${LABEL}: ${agent.loaded ? `${agent.state}${agent.pid ? `, pid ${agent.pid}` : ""}${agent.lastExit ? `, last exit ${agent.lastExit}` : ""}` : "not loaded"}`)
  say(`  plist: ${fs.existsSync(plistPath(HOME)) ? plistPath(HOME) : "missing"}`)
  const h = await health()
  say(`Desk ${DESK_URL}: ${h ? `ok (pid ${h.pid}, up ${Math.round(h.uptimeMs / 1000)} s)` : "not answering"}`)
  if (h) {
    const s = h.startScreen
    say(`Start screen: ${s.ready ? `${s.url} (${s.owned ? `owned by desk, pid ${s.pid}` : "external, reused"})` : s.state}${s.restarts ? `, ${s.restarts} restarts` : ""}`)
  }
  const shim = checkShim()
  say(`App shim: ${shim.exists ? SHIM : "not installed"}`)
  if (shim.exists) say(`  Santa ${shim.line}`)
  say(`Node: ${process.execPath} — Santa ${santaRule(process.execPath).line ?? "unknown"}`)
  say(`Logs: ${logDir(HOME)}`)
}

/** Launches the installed app over CDP and confirms a page at the desk URL titled DesignLayer. */
async function verifyWindow() {
  // CDP needs to start the app's Chrome itself, so an open window is closed
  // for the check and opened again after it.
  const wasOpen = profileInUse(PROFILE)
  if (wasOpen) {
    say("The DesignLayer app is open: quitting it for the check, it reopens afterwards.")
    if (!(await quitProfileChrome(PROFILE))) {
      say(`A Chrome instance still owns ${PROFILE}. Quit the app (⌘Q) and run --verify-window again.`)
      process.exitCode = 1
      return
    }
  }
  try {
    await verifyWindowOverCdp()
  } finally {
    if (wasOpen && fs.existsSync(SHIM)) {
      for (let waited = 0; waited < 5000 && profileInUse(PROFILE); waited += 250) await sleep(250)
      run("/usr/bin/open", [SHIM], { allowFail: true })
    }
  }
}

async function verifyWindowOverCdp() {
  const chrome = await openChrome({ userDataDir: PROFILE, args: ["--no-startup-window"] })
  try {
    const launched = await chrome.send("PWA.launch", { manifestId: DESK_URL }, 30000)
    say(`PWA.launch: ${launched.error ? `error ${launched.error.message}` : `ok, targetId ${launched.result?.targetId}`}`)
    const page = await waitFor(async () => {
      const targets = await chrome.send("Target.getTargets")
      return targets.result?.targetInfos.find(
        (t) => t.type === "page" && t.url.startsWith(DESK_URL) && t.title === "DesignLayer"
      )
    }, 20000)
    const all = (await chrome.send("Target.getTargets")).result?.targetInfos ?? []
    for (const t of all) say(`  target ${t.type} ${t.url} "${t.title}"`)
    say(page ? `Verified: app window shows ${page.url} titled "${page.title}".` : "NOT verified: no DesignLayer page target.")
    if (page) {
      const attached = await chrome.send("Target.attachToTarget", { targetId: page.targetId, flatten: true })
      const sessionId = attached.result?.sessionId
      await sleep(2500)
      const probe = await chrome.send(
        "Runtime.evaluate",
        {
          expression: `JSON.stringify({
            wco: navigator.windowControlsOverlay?.visible ?? null,
            titlebar: navigator.windowControlsOverlay?.getTitlebarAreaRect?.().toJSON?.() ?? null,
            displayMode: ["window-controls-overlay", "standalone", "browser"].find((m) => matchMedia("(display-mode: " + m + ")").matches),
            tabs: [...document.querySelectorAll(".tab")].map((t) => t.querySelector(".label")?.textContent),
            frames: [...document.querySelectorAll("iframe")].map((f) => f.src),
            booting: !document.getElementById("boot").hidden,
          })`,
          returnByValue: true,
        },
        10000,
        sessionId
      )
      say(`  in-window: ${probe.result?.result?.value ?? JSON.stringify(probe.error)}`)
    }
    if (!page) process.exitCode = 1
  } finally {
    await chrome.close()
  }
}

async function confirm(question) {
  if (args.has("--yes")) return true
  if (!process.stdin.isTTY) return false
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  const answer = await new Promise((resolve) => rl.question(`${question} [y/N] `, resolve))
  rl.close()
  return /^y/i.test(answer)
}

async function uninstall() {
  const targets = [
    fs.existsSync(plistPath(HOME)) && `LaunchAgent ${plistPath(HOME)} (bootout ${DOMAIN}/${LABEL})`,
    fs.existsSync(SHIM) && `App ${SHIM} (PWA.uninstall, then delete if left)`,
    fs.existsSync(MARKER) && `Chrome profile ${PROFILE} (created by this installer)`,
  ].filter(Boolean)
  if (targets.length === 0) return say("Nothing to uninstall.")
  say("Uninstall removes:")
  for (const t of targets) say(`  - ${t}`)
  say(`Kept: logs in ${logDir(HOME)}, the repo, and any start screen or editor the desk did not start.`)
  say("Stopped: the desk, and the start screen (plus its editors) if the desk started it.")
  if (DRY) return say("(dry run) nothing removed.")
  if (!(await confirm("Remove these?"))) {
    say("Not removed. Re-run with --yes to confirm.")
    return
  }

  const agentWasOwned = fs.existsSync(plistPath(HOME))
  run("/bin/launchctl", ["bootout", `${DOMAIN}/${LABEL}`], { allowFail: true })
  if (agentWasOwned) fs.rmSync(plistPath(HOME), { force: true })
  say("  LaunchAgent removed")

  if (fs.existsSync(SHIM) || fs.existsSync(MARKER)) {
    // The app's Chrome has to be gone before its profile is: deleting the
    // directory under a running instance leaves an orphan with nothing on disk.
    if (profileInUse(PROFILE) && (await quitProfileChrome(PROFILE))) say("  quit the open DesignLayer app")
    if (profileInUse(PROFILE)) {
      warn("The DesignLayer app is open; quit it (⌘Q) so Chrome can unregister it. Deleting files anyway.")
    } else if (fs.existsSync(PROFILE)) {
      try {
        const chrome = await openChrome({ userDataDir: PROFILE, args: ["--no-startup-window"] })
        const result = await chrome.send("PWA.uninstall", { manifestId: DESK_URL }, 30000)
        say(`  PWA.uninstall: ${result.error ? result.error.message : "ok"}`)
        await sleep(1500)
        await chrome.close()
      } catch (error) {
        warn(`PWA.uninstall skipped: ${error.message}`)
      }
    }
  }
  if (fs.existsSync(SHIM)) {
    fs.rmSync(SHIM, { recursive: true, force: true })
    say(`  deleted ${SHIM}`)
  }
  if (fs.existsSync(MARKER)) {
    fs.rmSync(path.dirname(PROFILE), { recursive: true, force: true })
    say(`  deleted ${path.dirname(PROFILE)}`)
  }
  say("Uninstalled.")
}

try {
  if (args.has("--help") || args.has("-h")) say(fs.readFileSync(fileURLToPath(import.meta.url), "utf8").match(/\/\*\*([\s\S]*?)\*\//)[1].replace(/^ \* ?/gm, ""))
  else if (args.has("--uninstall")) await uninstall()
  else if (args.has("--status")) await status()
  else if (args.has("--start")) await start()
  else if (args.has("--stop")) stop()
  else if (args.has("--verify-window")) await verifyWindow()
  else if (args.has("--app-window")) {
    if (!(await health())) await start()
    if (DRY) say(`(dry run) would run: "${CHROME_BINARY}" --user-data-dir=${PROFILE} --app=${DESK_URL}`)
    else {
      openAppWindow()
      say(`Opened ${DESK_URL} in a Chrome app window (profile ${PROFILE}).`)
    }
  } else await install()
} catch (error) {
  console.error(`\n  designlayer desk: ${error.message}\n`)
  process.exit(1)
}
