#!/usr/bin/env node

/**
 * The DesignLayer desk: a loopback HTTP server that the installed Chrome app
 * window loads, and the supervisor that keeps the start screen alive for it.
 *
 * Run by the `dev.designlayer.desk` LaunchAgent (see install.mjs). It adds no
 * editor logic of its own: the start screen (cli.mjs --start) still chooses
 * apps and spawns editors, and runtime/editor-registry.mjs still says which
 * editors are running. This process only puts them in one window.
 *
 * Env:
 *   DESIGNLAYER_DESK_PORT        port to bind (default 3454)
 *   DESIGNLAYER_DESK_SUPERVISE   "0" to leave the start screen alone (tests)
 *   DESIGNLAYER_START_SCREEN_PORT start screen port to probe/spawn (default 3455)
 */

import { spawn, execFile } from "node:child_process"
import fs from "node:fs"
import http from "node:http"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { listEditors } from "../../runtime/editor-registry.mjs"
import { PREFERRED_START_SCREEN_PORT } from "../../runtime/start-screen.mjs"
import { offlinePage, shellPage } from "./shell-page.mjs"

const HERE = path.dirname(fileURLToPath(import.meta.url))
export const REPO_ROOT = path.resolve(HERE, "..", "..")
export const DEFAULT_DESK_PORT = 3454
const LOOPBACK = "127.0.0.1"
const LOOPBACK_ADDRESSES = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"])
const ICONS = new Map([
  ["/icons/icon-192.png", ["icon-192.png", "image/png"]],
  ["/icons/icon-512.png", ["icon-512.png", "image/png"]],
  ["/icons/icon-maskable-512.png", ["icon-maskable-512.png", "image/png"]],
  ["/icons/mark.svg", ["mark.svg", "image/svg+xml"]],
])

/** Same rule as server/routes.mjs `isLocalRequest`, including refusing Origin "null". */
function isLoopbackHost(value) {
  if (typeof value !== "string" || value.length === 0) return false
  let host
  try {
    host = new URL(value.includes("://") ? value : `http://${value}`).hostname.replace(/^\[|\]$/g, "")
  } catch {
    return false
  }
  return host === "localhost" || host === "127.0.0.1" || host === "::1"
}

export function isLocalRequest(req) {
  if (!LOOPBACK_ADDRESSES.has(req.socket?.remoteAddress ?? "")) return false
  if (!isLoopbackHost(req.headers.host)) return false
  const origin = req.headers.origin
  if (origin !== undefined && !isLoopbackHost(origin)) return false
  return true
}

export function manifest() {
  return {
    id: "/",
    name: "DesignLayer",
    short_name: "DesignLayer",
    description: "Visual editing for the apps running on this Mac",
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["window-controls-overlay"],
    theme_color: "#1a1a1a",
    background_color: "#1a1a1a",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }
}

const SERVICE_WORKER = `// DesignLayer desk: network first; an offline page when the desk is not running.
const CACHE = "designlayer-desk-v1"
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add("/offline.html")).then(() => self.skipWaiting()))
})
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()))
})
self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return
  event.respondWith(fetch(event.request).catch(() => caches.match("/offline.html")))
})
`

/** Registry entries in the shape the shell uses. The registry already swept dead pids. */
export function normalizeEditors(entries) {
  return entries.map((entry) => ({
    name: entry.packageName ?? (entry.projectRoot ? path.basename(entry.projectRoot) : `Editor on ${entry.proxyPort}`),
    url: entry.url ?? `http://${LOOPBACK}:${entry.proxyPort}`,
    projectRoot: entry.projectRoot ?? null,
    appUrl: entry.appUrl ?? null,
    pid: entry.pid,
    startedAt: entry.startedAt ?? null,
    alive: true,
  }))
}

function getJson(url, timeoutMs = 1500) {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout: timeoutMs }, (res) => {
      const chunks = []
      res.on("data", (c) => chunks.push(c))
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(Buffer.concat(chunks).toString("utf8")) })
        } catch {
          resolve({ status: res.statusCode, body: null })
        }
      })
    })
    req.on("timeout", () => req.destroy())
    req.on("error", () => resolve(null))
  })
}

/**
 * Keeps one start screen answering. Reuses one that is already up (another
 * terminal's `npx designlayer`), and never kills what it did not start.
 */
export function createSupervisor({ repoRoot = REPO_ROOT, port = PREFERRED_START_SCREEN_PORT, logDir, enabled = true, log }) {
  const state = {
    state: enabled ? "checking" : "disabled",
    url: null,
    ready: false,
    owned: false,
    pid: null,
    restarts: 0,
    detail: null,
    editing: null,
  }
  let child = null
  let spawnedUrl = null
  let backoffMs = 1000
  let startedAt = 0
  let timer = null
  let stopped = false

  const probeUrl = () => spawnedUrl ?? `http://${LOOPBACK}:${port}`

  async function probe() {
    const answer = await getJson(`${probeUrl()}/api/status`)
    // The start screen's /api/status always carries `ready`; anything else on the port is not it.
    if (answer?.status === 200 && answer.body && "ready" in answer.body) {
      state.url = probeUrl()
      state.ready = true
      state.editing =
        answer.body.ready && answer.body.url
          ? { url: answer.body.url, projectRoot: answer.body.editing?.projectRoot ?? null, packageName: answer.body.editing?.packageName ?? null }
          : null
      return true
    }
    state.ready = false
    state.editing = null
    return false
  }

  function spawnStartScreen() {
    fs.mkdirSync(logDir, { recursive: true })
    const out = fs.openSync(path.join(logDir, "start-screen.log"), "a")
    const args = [path.join(repoRoot, "cli.mjs"), "--start", "--no-open"]
    if (port !== PREFERRED_START_SCREEN_PORT) args.push("--start-screen-port", String(port))
    // cwd is home, not the repo: the start screen then loads no project config,
    // and each chosen app is started with its own --project-root anyway.
    child = spawn(process.execPath, args, {
      cwd: os.homedir(),
      stdio: ["ignore", "pipe", out],
      env: { ...process.env, FORCE_COLOR: "0" },
    })
    fs.closeSync(out)
    startedAt = Date.now()
    state.owned = true
    state.pid = child.pid
    state.state = "starting"
    state.detail = "Starting the start screen…"
    log(`[desk] started start screen pid ${child.pid}: node ${args.join(" ")}`)
    const logStream = fs.createWriteStream(path.join(logDir, "start-screen.log"), { flags: "a" })
    let pending = ""
    child.stdout.on("data", (chunk) => {
      logStream.write(chunk)
      pending += chunk.toString()
      let nl
      while ((nl = pending.indexOf("\n")) >= 0) {
        const line = pending.slice(0, nl)
        pending = pending.slice(nl + 1)
        // cli.mjs prints this once it has bound (on 3455, or wherever the OS put it).
        const match = line.match(/open (http:\/\/[^\s]+) to choose an app/)
        if (match) spawnedUrl = match[1]
      }
    })
    child.once("exit", (code, signal) => {
      logStream.end()
      log(`[desk] start screen exited (${signal ?? code})`)
      child = null
      spawnedUrl = null
      state.ready = false
      state.pid = null
      if (stopped) return
      if (Date.now() - startedAt > 60000) backoffMs = 1000
      state.restarts += 1
      state.state = "backoff"
      state.detail = `The start screen stopped (${signal ?? `code ${code}`}). Restarting in ${Math.round(backoffMs / 1000)} s — see ~/Library/Logs/DesignLayer/start-screen.log.`
      clearTimeout(timer)
      timer = setTimeout(tick, backoffMs)
      backoffMs = Math.min(backoffMs * 2, 30000)
    })
  }

  async function tick() {
    if (stopped) return
    clearTimeout(timer)
    const up = await probe()
    if (up) {
      state.state = child ? "running" : "external"
      state.owned = Boolean(child)
      state.detail = null
    } else if (!child) {
      spawnStartScreen()
    }
    timer = setTimeout(tick, up ? 5000 : 700)
  }

  return {
    state,
    start() {
      if (enabled) tick()
    },
    /** Health reads call this so the page sees the start screen within one poll. */
    async refresh() {
      if (enabled && !stopped) await probe()
    },
    stop() {
      stopped = true
      clearTimeout(timer)
      if (child) child.kill("SIGTERM")
    },
  }
}

function send(res, status, type, body, extra = {}) {
  const buffer = Buffer.isBuffer(body) ? body : Buffer.from(body)
  res.writeHead(status, {
    "content-type": type,
    "content-length": String(buffer.byteLength),
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    ...extra,
  })
  res.end(buffer)
}
const sendJson = (res, status, payload) => send(res, status, "application/json; charset=utf-8", JSON.stringify(payload))

let picking = null
function pickFolder() {
  // One dialog at a time; a second press waits for the first answer.
  picking ??= new Promise((resolve) => {
    execFile(
      "/usr/bin/osascript",
      ["-e", 'POSIX path of (choose folder with prompt "Choose your app folder")'],
      { timeout: 10 * 60 * 1000 },
      (error, stdout, stderr) => {
        picking = null
        if (error) {
          // -128 is "User canceled."
          if (/-128/.test(String(stderr)) || /-128/.test(String(error.message))) resolve({ cancelled: true })
          else resolve({ error: String(stderr || error.message).trim() })
          return
        }
        resolve({ path: stdout.trim().replace(/\/$/, "") || "/" })
      }
    )
  })
  return picking
}

export async function createDeskServer({
  port = DEFAULT_DESK_PORT,
  repoRoot = REPO_ROOT,
  supervise = true,
  startScreenPort = PREFERRED_START_SCREEN_PORT,
  logDir = path.join(os.homedir(), "Library", "Logs", "DesignLayer"),
  log = (line) => console.log(`${new Date().toISOString()} ${line}`),
  pickFolder: picker = pickFolder,
} = {}) {
  const supervisor = createSupervisor({ repoRoot, port: startScreenPort, logDir, enabled: supervise, log })
  const startedAt = Date.now()
  const iconsDir = path.join(HERE, "icons")

  const routes = {
    "GET /": (_req, res) =>
      send(res, 200, "text/html; charset=utf-8", shellPage({ repoRoot }), {
        "content-security-policy": "frame-ancestors 'none'",
        "x-frame-options": "DENY",
      }),
    "GET /offline.html": (_req, res) => send(res, 200, "text/html; charset=utf-8", offlinePage({ repoRoot })),
    "GET /manifest.webmanifest": (_req, res) =>
      send(res, 200, "application/manifest+json; charset=utf-8", JSON.stringify(manifest(), null, 2)),
    "GET /sw.js": (_req, res) =>
      send(res, 200, "text/javascript; charset=utf-8", SERVICE_WORKER, { "service-worker-allowed": "/" }),
    "GET /api/health": async (_req, res) => {
      await supervisor.refresh()
      const s = supervisor.state
      sendJson(res, 200, {
        ok: true,
        name: "designlayer-desk",
        pid: process.pid,
        uptimeMs: Date.now() - startedAt,
        node: process.execPath,
        repoRoot,
        startScreen: {
          state: s.state,
          ready: s.ready,
          url: s.url,
          owned: s.owned,
          pid: s.pid,
          restarts: s.restarts,
          detail: s.detail,
          editing: s.editing,
        },
      })
    },
    "GET /api/editors": (_req, res) => sendJson(res, 200, { editors: normalizeEditors(listEditors()) }),
    "POST /api/pick-folder": async (_req, res) => {
      const result = await picker()
      sendJson(res, result.error ? 500 : 200, result)
    },
  }

  async function route(req, res) {
    const url = new URL(req.url ?? "/", `http://${LOOPBACK}`)
    const icon = req.method === "GET" && ICONS.get(url.pathname)
    if (icon) {
      return send(res, 200, icon[1], fs.readFileSync(path.join(iconsDir, icon[0])), { "cache-control": "max-age=3600" })
    }
    const handler = routes[`${req.method} ${url.pathname}`]
    if (handler) return handler(req, res, url)
    const known = Object.keys(routes).find((key) => key.endsWith(` ${url.pathname}`))
    if (known) return sendJson(res, 405, { error: `${url.pathname} accepts ${known.split(" ")[0]} only` })
    sendJson(res, 404, { error: `No desk route for ${url.pathname}` })
  }

  const server = http.createServer((req, res) => {
    if (!isLocalRequest(req)) return sendJson(res, 403, { error: "The DesignLayer desk is loopback-only" })
    route(req, res).catch((error) => {
      if (res.headersSent) return res.end()
      sendJson(res, 500, { error: error?.message ?? "desk route failed" })
    })
  })

  await new Promise((resolve, reject) => {
    server.once("error", reject)
    server.listen(port, LOOPBACK, () => {
      server.removeListener("error", reject)
      resolve()
    })
  })
  supervisor.start()

  return {
    url: `http://${LOOPBACK}:${server.address().port}`,
    port: server.address().port,
    supervisor,
    close() {
      supervisor.stop()
      server.closeAllConnections()
      return new Promise((resolve) => server.close(() => resolve()))
    },
  }
}

function isDirectRun() {
  try {
    return fs.realpathSync(process.argv[1] ?? "") === fs.realpathSync(fileURLToPath(import.meta.url))
  } catch {
    return false
  }
}

if (isDirectRun()) {
  const port = Number(process.env.DESIGNLAYER_DESK_PORT) || DEFAULT_DESK_PORT
  const startScreenPort = Number(process.env.DESIGNLAYER_START_SCREEN_PORT) || PREFERRED_START_SCREEN_PORT
  try {
    const desk = await createDeskServer({ port, startScreenPort, supervise: process.env.DESIGNLAYER_DESK_SUPERVISE !== "0" })
    console.log(`${new Date().toISOString()} [desk] serving ${desk.url} (node ${process.version}, pid ${process.pid})`)
    for (const signal of ["SIGINT", "SIGTERM"]) {
      process.once(signal, async () => {
        await desk.close()
        process.exit(0)
      })
    }
  } catch (error) {
    console.error(`${new Date().toISOString()} [desk] could not start: ${error.message}`)
    // Non-zero so launchd's KeepAlive {SuccessfulExit:false} retries (e.g. port still held).
    process.exit(1)
  }
}
