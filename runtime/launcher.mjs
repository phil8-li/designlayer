/**
 * Runtime launcher: six monkey-patches over `react-rewrite-cli@0.1.1`, the
 * overlay+chrome concatenation, and the loopback route mount.
 *
 * The patches fix defects in the pinned vendor build — an unauthenticated
 * all-interfaces bind, a `content-length` + `transfer-encoding` conflict
 * browsers reject, React 19's percent-encoded owner-stack paths, and a health
 * check that walks away from a dev server whose app is throwing. None of them
 * know anything about the host app, so they ship verbatim.
 *
 * Everything that DID know about one host is now read from the resolved config:
 * the project root, the ports, the API prefix, and the chrome selectors handed
 * to the vendor patch.
 */

import fs from "node:fs"
import { publishEditor, withdrawEditor } from "./editor-registry.mjs"
import http from "node:http"
import net from "node:net"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { createRequire, syncBuiltinESMExports } from "node:module"
import { Readable } from "node:stream"
import { fileURLToPath, pathToFileURL } from "node:url"

import { browserPrelude } from "../config.mjs"
import { wrapCompanion } from "../server/companions.mjs"
import {
  guardBoardFrames,
  stripFrameBlockingHeaders,
  stripFrameBlockingResponseHeaders,
} from "./board-frame.mjs"
import { chooserUrlFromEnv, isLoopbackOrigin } from "./chooser-url.mjs"
import { urlHost } from "./dev-server.mjs"
import { deskUrlFromHost } from "./mac-desk.mjs"
import { openBrowser } from "./open-browser.mjs"
import { patchOverlay } from "./vendor-patch.mjs"

const LOOPBACK = "127.0.0.1"

// The pinned vendor probes upward from these two constants and never exposes
// them as options, so a configured port is applied by remapping the probe.
const VENDOR_WS_PORT = 3457
const VENDOR_PROXY_PORT = 3456

const CHROME_BUNDLE = fileURLToPath(
  new URL("../dist/designlayer.js", import.meta.url)
)

/**
 * Re-exported, not defined here any more: `server/apps.mjs` reads the same
 * environment variable to find the screen it relays the app list from, and it
 * cannot import this module to get at it — importing this one patches `fs`,
 * `http` and `net`. The definition moved to runtime/chooser-url.mjs and the
 * name stays on this module's surface, because the callers that already read it
 * from here are not wrong about where it belongs.
 */
export { chooserUrlFromEnv }

/** The absolute URL a `fetch` argument names, or null when it names none. */
function requestedUrl(input) {
  const value =
    typeof input === "string" ? input : input instanceof URL ? input.href : input?.url
  try {
    return new URL(value).href
  } catch {
    return null
  }
}

/**
 * Lets the vendor's health check attach to a dev server that answers 500.
 *
 * `healthCheck` in the pinned build accepts a response only when
 * `response.ok || response.status < 500`, and otherwise reports "No dev server
 * found". That conflates two different facts about the world: a server nothing
 * can reach, and a server that was reached and spoke HTTP and said something
 * the vendor dislikes. The second one has plainly been found — and an app
 * throwing on every render is exactly when a designer wants the editor open,
 * because the error overlay is the thing they are trying to look at.
 *
 * `globalThis.fetch` is the only seam: the vendor's `healthCheck` is an ESM
 * live binding, read-only from out here. So the patch is kept as narrow as the
 * defect. Only a response to THIS launch's dev server root is reinterpreted,
 * only when the server really answered, and only its verdict — no body and no
 * status is invented, so a refused connection, a DNS failure and a timeout all
 * still reject and a port with nothing on it is still reported as empty.
 *
 * Returns the undo, which the caller owes the proxy: the proxy polls the same
 * origin to decide whether the app came back, and it must see a 500 as a 500.
 */
export function acceptErroringDevServer(host, appPort) {
  // Without a port there is no origin to be narrow about — the vendor is about
  // to guess one from its framework detection, and guessing alongside it would
  // put this patch on some other server's traffic.
  if (!appPort) return () => {}

  // Bracketed, or an IPv6 loopback host makes this throw and take the launch
  // with it: `http://::1:4200` is not a URL.
  const root = new URL(`http://${urlHost(host || "localhost")}:${appPort}`).href
  const originalFetch = globalThis.fetch

  const patched = async (input, ...rest) => {
    const response = await originalFetch(input, ...rest)
    if (response.status < 500 || requestedUrl(input) !== root) return response
    // Deliberately not a Response. The vendor reads `.ok` and `.status` and
    // discards the rest, and handing back a synthesized 200 would claim a page
    // the server never sent. This says only what was learned: reached, and
    // still broken.
    return { ok: true, status: response.status }
  }

  globalThis.fetch = patched
  return () => {
    if (globalThis.fetch === patched) globalThis.fetch = originalFetch
  }
}

/**
 * Prefers the HOST's copy of the vendor, so an app that already pins
 * `react-rewrite-cli` wins over the one installed beside this package. The 22
 * splices are only valid against 0.1.1 either way, which is why the dependency
 * is exact-pinned rather than a peer.
 */
export function resolveVendor(config) {
  const specifier = config.vendor.package
  let entry
  try {
    entry = createRequire(path.join(config.projectRoot, "package.json")).resolve(specifier)
  } catch {
    entry = fileURLToPath(import.meta.resolve(specifier))
  }

  return {
    entry,
    overlay: config.vendor.overlayPath
      ? path.resolve(config.projectRoot, config.vendor.overlayPath)
      : path.join(path.dirname(entry), "overlay.js"),
  }
}

export function readOverlaySource(config) {
  return fs.readFileSync(resolveVendor(config).overlay, "utf8")
}

/**
 * The vendored `detect()` gates, answered for a host it was never written for.
 *
 * `react-rewrite-cli@0.1.1` refuses to start unless the host's package.json
 * declares `react` AND a `next.config.*` or `vite.config.*` file sits in the
 * project root. Neither is a real requirement of anything this package uses at
 * runtime: the proxy is HTTP, the injection is a `<script>` before `</body>`,
 * and the overlay's hit-testing is `elementsFromPoint`. They are a one-time
 * check the vendor performs on a project it assumes it owns.
 *
 * Two hosts trip them:
 *
 *   - A stock create-next-app project, which needs no `next.config` file. Only
 *     the second gate applies; the dependency is really there.
 *   - An Angular project, which has neither. Both gates apply, and both answers
 *     are fictions — but fictions confined to the vendor's own synchronous
 *     detection pass, which runs entirely inside `program.parse()` before the
 *     dynamic import below resolves.
 *
 * So this returns the shims that pass, and the caller installs them for exactly
 * that window. Nothing is written into the host project, every other filesystem
 * probe keeps its real answer, and a project the vendor would have accepted
 * unaided gets no shim at all.
 */
export function vendorDetectionShims(config) {
  const manifestPath = path.join(config.projectRoot, "package.json")
  let manifest
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"))
  } catch {
    return null
  }
  const dependencies = { ...manifest.dependencies, ...manifest.devDependencies }
  const has = (names) => names.some((name) => fs.existsSync(path.join(config.projectRoot, name)))

  if (config.host?.framework === "angular") {
    return {
      manifestPath,
      // The vendor reads `allDeps["react"]` and nothing else about it. A version
      // string it never compares is the smallest thing that answers the gate.
      declareReact: !dependencies.react,
      // Angular 17+ serves through Vite, so "vite" is the framework the vendor's
      // own vocabulary has for this host. The port it infers from that is
      // discarded — `--project-root` and the app port are both already known.
      virtualConfig: has(["vite.config.js", "vite.config.ts"])
        ? null
        : path.join(config.projectRoot, "vite.config.ts"),
    }
  }

  if (!dependencies.next) return null
  return {
    manifestPath,
    declareReact: false,
    virtualConfig: has(["next.config.js", "next.config.ts", "next.config.mjs"])
      ? null
      : path.join(config.projectRoot, "next.config.mjs"),
  }
}

export function readChromeBundle() {
  try {
    return fs.readFileSync(CHROME_BUNDLE, "utf8")
  } catch {
    console.warn(
      "[designlayer] chrome bundle missing — run `npm run build` in the package"
    )
    return ""
  }
}

/**
 * The configured companions, concatenated after the editor's own chrome.
 *
 * After, because the editor is the thing this package is responsible for: a
 * companion that blows up on evaluation must not be able to take it with it,
 * and `wrapCompanion` fences each one for the same reason. Read on every
 * overlay request rather than cached, so rebuilding a companion's bundle shows
 * up on reload — the editor's own dist is checked at launch precisely because
 * it CANNOT be, being concatenated from a path this process pins.
 *
 * A companion that has gone missing since launch warns and is skipped. The
 * alternative is a 500 on the overlay, which takes down the editor over a file
 * that belongs to somebody else.
 */
export function readCompanionBundles(config) {
  return (config.companions ?? [])
    .map((companion) => {
      try {
        return wrapCompanion(companion.name, fs.readFileSync(companion.script, "utf8"))
      } catch (error) {
        console.warn(
          `[designlayer] companion "${companion.name}" could not be read (${error.message})`
        )
        return ""
      }
    })
    .join("")
}

const BUILD_SCRIPT = fileURLToPath(new URL("../build.mjs", import.meta.url))

/**
 * `dist/` is gitignored, built by `build.mjs`, and read straight off disk by the
 * function above — so the browser gets whatever happens to be sitting there. A
 * MISSING bundle was loud. One that was merely BEHIND said nothing, and that is
 * the worse of the two: the editor ran two commits older than its own source
 * while `tsc` passed, every suite passed, and every source review was correct
 * about a feature that simply was not in the browser. `build.mjs --check`
 * already knew how to catch it; nothing on the path that actually serves the
 * bundle ever asked it.
 *
 * So the serving path asks, once, before the vendor boots. It asks by running
 * `build.mjs` in a child process rather than by calling esbuild inline, because
 * there must be exactly one description of how this package compiles: a second
 * copy of the target list here would drift from the real one and then either
 * miss a stale bundle or cry stale over a fresh one. That costs ~75ms when
 * everything matches and ~150ms when it does not, against a first host compile
 * measured in seconds.
 *
 * Behind is rebuilt, not refused. The repair is one command, so refusing to
 * start would only make the user type it; and a rebuild that said nothing would
 * hide that the source had moved underneath them, which is precisely how this
 * went unnoticed. Rebuild, then say so in a line that cannot be mistaken for
 * routine output. When the rebuild is impossible — `esbuild` pruned from a
 * published install, a source tree that does not compile — the editor still
 * starts, because a prebuilt `dist/` with no rebuild wanted is a supported way
 * to consume this package; it just starts behind a warning that the thing in
 * the browser is not the source in this tree.
 */
export function ensureCurrentChromeBundle() {
  const runBuild = (...args) =>
    spawnSync(process.execPath, [BUILD_SCRIPT, ...args], {
      cwd: path.dirname(BUILD_SCRIPT),
      encoding: "utf8",
    })

  if (runBuild("--check").status === 0) return

  const rebuilt = runBuild()
  if (rebuilt.status === 0) {
    console.warn("[designlayer] dist/ was behind src/ — rebuilt it before serving")
    return
  }

  // Why it failed goes ABOVE the verdict, not below it. The reason is a compile
  // error or a module resolution stack — tens of lines either way — and a
  // warning printed on top of one is a warning nobody reads.
  const reason = (rebuilt.stderr || rebuilt.error?.message || "").trim()
  console.warn(
    (reason ? `${reason}\n\n` : "") +
      "[designlayer] dist/ does not match src/ and could not be rebuilt. The editor\n" +
      "  in the browser is NOT the source in this tree — it is whatever was built last.\n" +
      "  Run `npm run build` in the package to see your own changes."
  )
}

async function loadRoutes(config) {
  try {
    const { createDesignLayerRoutes } = await import("../server/routes.mjs")
    return createDesignLayerRoutes(config)
  } catch (error) {
    console.warn(
      `[designlayer] routes unavailable — options and AI will be disabled (${error.message})`
    )
    return null
  }
}

/**
 * The MCP endpoint a coding agent connects to, on its own fixed port.
 *
 * Not mounted on the proxy, which binds `auto`: this URL is typed into an
 * agent's config file by hand and has to survive a restart. A busy port is a
 * warning and nothing more — the editor's whole job is unaffected, and the
 * clipboard path in the Prompts tab still works.
 */
async function startMcpEndpoint(config, runtime) {
  const port = config.ports?.mcp
  if (typeof port !== "number") return null
  try {
    const [{ createMcpEndpoint }, { handoffQueue }, { isLocalRequest }] = await Promise.all([
      import("../server/mcp.mjs"),
      import("../server/handoff.mjs"),
      import("../server/routes.mjs"),
    ])
    const queue = handoffQueue()
    const endpoint = createMcpEndpoint({ queue, isLocalRequest })
    await endpoint.listen(port, LOOPBACK)
    // Only after the bind. The route that records a click reads this to decide
    // whether to promise the designer a delivery or only a queued file, and a
    // flag set optimistically would promise one on the exact runs — port taken,
    // endpoint disabled — where nothing can ever arrive.
    queue.markEndpointListening()
    runtime.mcpPort = port
    writeEndpointFile(config, runtime)
    console.log(`[designlayer] MCP http://${LOOPBACK}:${port}/mcp — point your agent at it`)
    return endpoint
  } catch (error) {
    const reason = error?.code === "EADDRINUSE" ? `port ${port} is in use` : error.message
    console.warn(
      `[designlayer] MCP endpoint not started (${reason}) — "Send to agent" still queues to ${config.apiPrefix}`
    )
    return null
  }
}

/** The working directory, or `null` where the machine will not name it. */
function currentDirectory() {
  try {
    return path.resolve(process.cwd())
  } catch {
    return null
  }
}

function decodeSourcePath(value) {
  if (typeof value !== "string" || !value.includes("%")) return value
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

/**
 * The endpoint file says where THIS editor is, inside the project it is
 * editing. The registry says the same thing somewhere every other editor can
 * read it — see `editor-registry.mjs` for why one is not enough.
 *
 * Published from the same place and at the same moments, so the two can never
 * disagree about a port, and withdrawn on the way out so the chooser does not
 * offer a door into a process that has gone.
 */
function publishToRegistry(config, runtime) {
  if (!runtime.proxyPort) return
  publishEditor({
    proxyPort: runtime.proxyPort,
    wsPort: runtime.wsPort ?? null,
    appPort: runtime.appPort ?? null,
    appUrl: runtime.appPort ? `http://${LOOPBACK}:${runtime.appPort}` : null,
    projectRoot: config.projectRoot,
    packageName: readPackageName(config.projectRoot),
    url: `http://${LOOPBACK}:${runtime.proxyPort}`,
  })
  if (!registryWithdrawal) {
    const port = runtime.proxyPort
    registryWithdrawal = () => withdrawEditor(port)
    // Both, because they catch different exits: `exit` covers a normal return
    // and an explicit `process.exit`, the signals cover Ctrl+C and a supervisor
    // replacing this editor with the next one.
    process.once("exit", registryWithdrawal)
    for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
      process.once(signal, () => {
        registryWithdrawal?.()
        process.exit(0)
      })
    }
  }
}

let registryWithdrawal = null

/**
 * What the project calls itself, for a chooser row that has to name it. Read
 * from disk rather than carried in the config because the config does not have
 * it and nothing else needed it until now.
 */
function readPackageName(projectRoot) {
  try {
    const raw = fs.readFileSync(path.join(projectRoot, "package.json"), "utf8")
    const name = JSON.parse(raw)?.name
    return typeof name === "string" && name.length > 0 ? name : null
  } catch {
    return null
  }
}

function writeEndpointFile(config, runtime) {
  publishToRegistry(config, runtime)
  try {
    fs.mkdirSync(config.stateDir, { recursive: true })
    fs.writeFileSync(
      config.endpointFile,
      `${JSON.stringify(
        {
          pid: process.pid,
          appPort: runtime.appPort ?? null,
          proxyPort: runtime.proxyPort,
          wsPort: runtime.wsPort,
          apiPrefix: config.apiPrefix,
          apiBase: `http://${LOOPBACK}:${runtime.proxyPort}${config.apiPrefix}`,
          wsUrl: `ws://${LOOPBACK}:${runtime.wsPort}`,
          mcpPort: runtime.mcpPort ?? null,
          mcpUrl: runtime.mcpPort ? `http://${LOOPBACK}:${runtime.mcpPort}/mcp` : null,
          projectRoot: config.projectRoot,
        },
        null,
        2
      )}\n`,
      "utf8"
    )
  } catch (error) {
    // Port discovery is a convenience for the harness, never a launch blocker.
    console.warn(`[designlayer] could not write endpoint file (${error.message})`)
  }
}

/**
 * Installs every patch, then hands control to the vendor CLI.
 *
 * `argv` must already be in the vendor's own shape: commander parses
 * `process.argv` at module scope and aborts on any flag it does not declare,
 * so every first-party flag has to be consumed before this point.
 *
 * `onReady` is called with the editing URL the moment the proxy binds. It is
 * how the start screen learns to move the browser on, and it is deliberately
 * not the endpoint file: that write goes into the project folder, which is not
 * always a folder this process is allowed to write to.
 */
export async function launch(config, { appPort, host, open, verbose = false, onReady = () => {} }) {
  // Before anything binds a port: whatever is about to be concatenated onto the
  // overlay has to be this tree's source, not a bundle left over from before it.
  ensureCurrentChromeBundle()

  const vendor = resolveVendor(config)

  // The WebSocket patch below rewrites `WebSocket.prototype.on`, which only
  // reaches the vendor if both resolve to the SAME `ws` instance. Resolve it
  // through the vendor so a nested install cannot silently split them.
  let wsSpecifier = "ws"
  try {
    wsSpecifier = pathToFileURL(createRequire(vendor.entry).resolve("ws")).href
  } catch {
    // Falls back to this package's own `ws`, which is the hoisted copy.
  }
  // `ws` is CommonJS, and its named exports are only statically detectable when
  // it is imported by package specifier — not by resolved path.
  const wsModule = await import(wsSpecifier)
  const WebSocket = wsModule.WebSocket ?? wsModule.default?.WebSocket ?? wsModule.default
  if (!WebSocket?.prototype) throw new Error(`Could not load 'ws' from ${wsSpecifier}`)
  const WebSocketServer =
    wsModule.WebSocketServer ??
    wsModule.Server ??
    wsModule.default?.WebSocketServer ??
    wsModule.default?.Server
  if (!WebSocketServer?.prototype?.handleUpgrade) {
    throw new Error(`Could not load 'ws' WebSocketServer from ${wsSpecifier}`)
  }

  const originalCreateReadStream = fs.createReadStream
  const originalExistsSync = fs.existsSync
  const originalReadFileSync = fs.readFileSync
  const originalCreateServer = http.createServer
  const originalListen = net.Server.prototype.listen
  const originalWriteHead = http.ServerResponse.prototype.writeHead
  const originalWebSocketOn = WebSocket.prototype.on
  const originalHandleUpgrade = WebSocketServer.prototype.handleUpgrade

  // Read once, at launch, and carried in `runtime` beside the ports: the
  // prelude is rebuilt on every overlay request, and an environment variable
  // re-read per request could hand two tabs of one session different answers.
  const runtime = {
    appPort,
    proxyPort: null,
    wsPort: null,
    // Set only once the MCP endpoint has actually bound, so the endpoint file
    // never advertises a URL nothing is serving.
    mcpPort: null,
    chooserUrl: chooserUrlFromEnv(),
    // A Mac app installed after this launch shows up at the next one, the same
    // bargain the chooser URL makes.
    deskUrl: deskUrlFromHost(),
  }
  let patchedOverlay

  // Keep the package immutable on disk. The pinned bundle is patched only when
  // the development proxy serves it, and every replacement is shape-checked.
  // The path compare is exact, so a fork, a rename, or pnpm's non-flat layout
  // cannot make an unrelated `overlay.js` look like the vendor's.
  fs.createReadStream = function createPatchedOverlayReadStream(filePath, ...args) {
    if (path.resolve(String(filePath)) === vendor.overlay) {
      patchedOverlay ??= patchOverlay(fs.readFileSync(vendor.overlay, "utf8"), config)
      // Guarded as one unit: a canvas-mode frame loads the same page, and any
      // part of the editor booting there would take the vendor's single socket.
      return Readable.from([
        guardBoardFrames(
          `${browserPrelude(config, runtime)}\n${patchedOverlay}\n;\n${readChromeBundle()}` +
            `\n;\n${readCompanionBundles(config)}`
        ),
      ])
    }

    return originalCreateReadStream.call(this, filePath, ...args)
  }
  syncBuiltinESMExports()

  // The vendor constructs its WebSocketServer with no `verifyClient`, and the
  // browser same-origin policy does not cover WebSockets: any page in any tab
  // could open `ws://127.0.0.1:<wsPort>` and send `updateProperty` /
  // `commitBatch`, which write project source. Binding to loopback does not
  // help — the victim's own browser is on loopback.
  //
  // The handshake is the only chokepoint the vendor leaves reachable, so the
  // origin is checked there. `undefined` passes (non-browser clients send no
  // Origin and carry no ambient authority); `"null"` does not, for the same
  // reason as in server/routes.mjs.
  WebSocketServer.prototype.handleUpgrade = function handleLoopbackUpgrade(
    request,
    socket,
    head,
    callback
  ) {
    const origin = request?.headers?.origin
    if (origin !== undefined && !isLoopbackOrigin(origin)) {
      socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n")
      socket.destroy()
      return
    }
    return originalHandleUpgrade.call(this, request, socket, head, callback)
  }

  // React 19 owner stacks URL-encode spaces in absolute source paths. Normalize
  // only path-bearing editor messages before React Rewrite applies its existing
  // project-root validation; otherwise it treats the encoded absolute path as a
  // relative path and prepends the workspace twice.
  WebSocket.prototype.on = function onNormalizedEditorMessage(event, listener) {
    if (event !== "message") {
      return originalWebSocketOn.call(this, event, listener)
    }

    return originalWebSocketOn.call(this, event, function normalizedMessage(data, ...args) {
      try {
        const message = JSON.parse(String(data))
        if (message && typeof message === "object") {
          message.filePath = decodeSourcePath(message.filePath)
          message.file = decodeSourcePath(message.file)
          if (Array.isArray(message.operations)) {
            message.operations = message.operations.map((operation) => ({
              ...operation,
              file: decodeSourcePath(operation?.file),
            }))
          }
          data = Buffer.from(JSON.stringify(message))
        }
      } catch {
        // Non-JSON WebSocket traffic is unrelated to editor source operations.
      }

      return listener.call(this, data, ...args)
    })
  }

  // The published proxy buffers Next's streamed HTML, sets Content-Length, but
  // leaves Transfer-Encoding: chunked in place. Browsers reject that conflicting
  // response even though curl accepts it. Normalize only this CLI process.
  http.ServerResponse.prototype.writeHead = function writeValidHeaders(statusCode, ...args) {
    const headers = args.find((arg) => arg && typeof arg === "object" && !Array.isArray(arg))
    if (headers?.["content-length"] && headers["transfer-encoding"]) {
      delete headers["transfer-encoding"]
    }
    // Canvas mode frames the host's own pages; a host that forbids framing
    // would leave every board frame blank. Both header sources are relaxed —
    // the object handed here and anything set earlier with `setHeader`.
    stripFrameBlockingHeaders(this.req, headers)
    if (!this.headersSent) stripFrameBlockingResponseHeaders(this)

    return originalWriteHead.call(this, statusCode, ...args)
  }

  const restoreFetch = acceptErroringDevServer(host, appPort)

  function configuredPort(port) {
    if (config.ports.ws !== "auto" && port === VENDOR_WS_PORT) return config.ports.ws
    if (config.ports.proxy !== "auto" && port === VENDOR_PROXY_PORT) return config.ports.proxy
    return port
  }

  // Both long-lived servers are http.Servers and the pinned vendor starts the
  // WebSocket one first, so recording them in order names the ports without
  // guessing at 3456/3457 — which the vendor abandons the moment either is busy.
  function recordBoundPort(server) {
    if (!(server instanceof http.Server)) return
    server.once("listening", () => {
      const address = server.address()
      if (!address || typeof address !== "object") return
      if (runtime.wsPort === null) runtime.wsPort = address.port
      else if (runtime.proxyPort === null) {
        runtime.proxyPort = address.port
        writeEndpointFile(config, runtime)
        onReady(`http://${LOOPBACK}:${runtime.proxyPort}`)
        // The vendor's own banner reports the port it asked for, not the one it
        // got, so this line has to land after it to be the one a reader trusts.
        setImmediate(() => {
          const url = `http://${LOOPBACK}:${runtime.proxyPort}`
          console.log(
            `[designlayer] proxy ${url} — ws ://${LOOPBACK}:${runtime.wsPort} — api ${config.apiPrefix}`
          )
          // Started here rather than earlier for one reason: `recordBoundPort`
          // names the ports by counting `http.Server`s, so a third server bound
          // before the proxy would be recorded as the proxy and the editor would
          // open on an MCP endpoint. By this line both numbers are already taken.
          void startMcpEndpoint(config, runtime)
          // This is the editing URL. The dev server's own URL still works and
          // still has no editor on it, so the one worth opening is this one.
          if (open) openBrowser(url)
        })
      }
    })
  }

  // React Rewrite can write project files, but its published CLI binds the proxy
  // and WebSocket to every interface. Keep both servers local until upstream adds
  // an authenticated, loopback-only binding option.
  net.Server.prototype.listen = function listenOnLoopback(...args) {
    // The vendor binds nothing until its health check has returned, so the
    // first bind of the run is where that window closes. Everything past it —
    // the proxy above all — gets the unpatched fetch back.
    restoreFetch()
    recordBoundPort(this)

    if (typeof args[0] === "number") {
      args[0] = configuredPort(args[0])
      const hasExplicitHost = typeof args[1] === "string"
      if (!hasExplicitHost) {
        const [port, ...rest] = args
        return originalListen.call(this, port, LOOPBACK, ...rest)
      }
    } else if (args[0] && typeof args[0] === "object") {
      const options = { ...args[0] }
      if (typeof options.port === "number") options.port = configuredPort(options.port)
      if (!("host" in options)) options.host = LOOPBACK
      args[0] = options
    }

    return originalListen.apply(this, args)
  }

  // The chrome needs a few endpoints the vendor WebSocket protocol has no verb
  // for — saved element options and the AI handoff. Mounting them by wrapping the
  // proxy's own request handler keeps them on the same loopback origin as the
  // page, so no CORS or second port is involved.
  const routes = await loadRoutes(config)
  if (routes) {
    http.createServer = function createRoutedServer(...args) {
      const handler = args.find((arg) => typeof arg === "function")
      if (!handler) return originalCreateServer.apply(this, args)

      const routed = (req, res) => {
        if (routes.handle(req, res)) return
        return handler(req, res)
      }

      return originalCreateServer.apply(
        this,
        args.map((arg) => (arg === handler ? routed : arg))
      )
    }
    syncBuiltinESMExports()
  }

  // The vendor derives its own project root from `process.cwd()`. Aligning the
  // two derivations is what keeps its "outside the project root" refusal and
  // ours from ever disagreeing about which files are in scope.
  //
  // `chdir` into a TCC-protected folder succeeds and then `cwd` cannot read it
  // back: `uv_cwd` stats, and stat is the one call a managed Mac refuses for a
  // protected Documents subtree — while opening, listing and reading all work.
  // A cwd nothing can name takes down `path.resolve` and every library that
  // asks, so the answer is supplied from the config the chdir came from.
  if (currentDirectory() !== config.projectRoot) process.chdir(config.projectRoot)
  if (currentDirectory() === null) process.cwd = () => config.projectRoot

  const shims = vendorDetectionShims(config)
  const virtualConfig = shims?.virtualConfig ?? null
  if (virtualConfig) {
    fs.existsSync = function existsWithConfig(filePath) {
      return path.resolve(String(filePath)) === virtualConfig || originalExistsSync.call(this, filePath)
    }
  }
  if (shims?.declareReact) {
    fs.readFileSync = function readManifestWithReact(filePath, ...args) {
      const contents = originalReadFileSync.call(this, filePath, ...args)
      if (typeof contents !== "string") return contents
      if (path.resolve(String(filePath)) !== shims.manifestPath) return contents
      try {
        const parsed = JSON.parse(contents)
        // Under `devDependencies`, and named for what it is. If it ever escapes
        // this window into something a human reads, it should read as a marker
        // rather than as a dependency someone forgot to install.
        parsed.devDependencies = {
          ...parsed.devDependencies,
          react: "0.0.0-designlayer-host-shim",
        }
        return JSON.stringify(parsed)
      } catch {
        return contents
      }
    }
  }
  if (virtualConfig || shims?.declareReact) syncBuiltinESMExports()

  process.argv = [
    process.argv[0],
    vendor.entry,
    ...(appPort ? [String(appPort)] : []),
    // Never the vendor's own open. It fires with the port it asked for, which
    // the listen patch above may have remapped, so it can send the browser to a
    // port nothing is serving. `recordBoundPort` opens the bound one instead.
    "--no-open",
    // The vendor puts this straight into `http://${host}:${port}` for both its
    // health check and its proxy target, so it needs the URL spelling.
    ...(host ? ["--host", urlHost(host)] : []),
    ...(verbose ? ["--verbose"] : []),
  ]

  try {
    await import(pathToFileURL(vendor.entry).href)
  } finally {
    if (virtualConfig || shims?.declareReact) {
      fs.existsSync = originalExistsSync
      fs.readFileSync = originalReadFileSync
      syncBuiltinESMExports()
    }
  }
}
