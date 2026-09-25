/**
 * Cases for the Mac desk: the desk server's routes and refusals, the manifest
 * Chrome's installability check reads, the LaunchAgent plist, and the
 * installer's dry run.
 *
 * The desk server runs in-process on an ephemeral port with the start-screen
 * supervisor off, and HOME points at a temp directory so the editor registry
 * (runtime/editor-registry.mjs reads os.homedir()) is one this file controls.
 *
 * Skipped, loudly, off macOS. Most of what is checked here is portable — the
 * routes, the refusals, the manifest — but the plist case shells out to
 * `/usr/bin/plutil` to prove the XML this writes is XML launchd will take, and
 * a Linux runner has nothing to answer that with. The suite is named in
 * `npm test` so the macOS legs of CI run it, rather than it being the one
 * subsystem in the repository that nothing runs.
 *
 * Usage: node desktop/mac/test/desk-cases.mjs
 */

import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import http from "node:http"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

if (process.platform !== "darwin") {
  console.log(
    `\nNot macOS (${process.platform}) — skipping the desk run.\n` +
      "  The desk is a Mac Dock app: a user LaunchAgent and a Chrome-installed web app.\n" +
      "  Its plist case needs /usr/bin/plutil, which only this platform has.\n" +
      "  Run it on a Mac with `node desktop/mac/test/desk-cases.mjs`."
  )
  console.log("\n0 passed, 0 failed")
  process.exit(0)
}

const HERE = path.dirname(fileURLToPath(import.meta.url))
const MAC = path.resolve(HERE, "..")
const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "desk-cases-"))
const realHome = os.homedir()
process.env.HOME = tempHome

const { createDeskServer, manifest } = await import("../desk-server.mjs")
const { buildPlist, LABEL } = await import("../launch-agent.mjs")

let passed = 0
let failed = 0

async function check(name, fn) {
  try {
    await fn()
    passed += 1
    console.log(`  ok   ${name}`)
  } catch (error) {
    failed += 1
    console.log(`  FAIL ${name}\n       ${error.message}`)
  }
}

function request(port, { method = "GET", pathname = "/", headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port, method, path: pathname, headers }, (res) => {
      const chunks = []
      res.on("data", (c) => chunks.push(c))
      res.on("end", () => {
        const body = Buffer.concat(chunks)
        let json = null
        try {
          json = JSON.parse(body.toString("utf8"))
        } catch {
          /* not json */
        }
        resolve({ status: res.statusCode, headers: res.headers, body, json })
      })
    })
    req.on("error", reject)
    req.end()
  })
}

let pickerCalls = 0
const desk = await createDeskServer({
  port: 0,
  supervise: false,
  logDir: path.join(tempHome, "logs"),
  log: () => {},
  pickFolder: async () => {
    pickerCalls += 1
    return { cancelled: true }
  },
})
const port = desk.port

console.log("desk server")

await check("health answers ok with the supervisor disabled", async () => {
  const res = await request(port, { pathname: "/api/health" })
  assert.equal(res.status, 200)
  assert.equal(res.json.ok, true)
  assert.equal(res.json.startScreen.state, "disabled")
})

await check("shell page is the DesignLayer window with a manifest link and WCO strip", async () => {
  const res = await request(port)
  assert.equal(res.status, 200)
  const html = res.body.toString("utf8")
  assert.match(html, /<title>DesignLayer<\/title>/)
  assert.match(html, /rel="manifest" href="\/manifest.webmanifest"/)
  assert.match(html, /titlebar-area-width/)
  assert.match(html, /clipboard-read; clipboard-write; fullscreen/)
  assert.equal(res.headers["x-frame-options"], "DENY")
})

await check("manifest meets Chrome installability", async () => {
  const res = await request(port, { pathname: "/manifest.webmanifest" })
  assert.equal(res.status, 200)
  assert.match(res.headers["content-type"], /application\/manifest\+json/)
  const m = res.json
  assert.deepEqual(m, manifest())
  assert.equal(m.id, "/")
  assert.equal(m.name, "DesignLayer")
  assert.ok(m.short_name)
  assert.equal(m.start_url, "/")
  assert.equal(m.scope, "/")
  assert.equal(m.display, "standalone")
  assert.deepEqual(m.display_override, ["window-controls-overlay"])
  assert.equal(m.theme_color, "#1a1a1a")
  assert.equal(m.background_color, "#1a1a1a")
  const sizes = m.icons.filter((i) => i.type === "image/png").map((i) => Number(i.sizes.split("x")[0]))
  assert.ok(sizes.some((s) => s >= 192), "needs a >=192 PNG")
  assert.ok(sizes.includes(512), "needs a 512 PNG")
  assert.ok(m.icons.some((i) => i.purpose === "maskable"), "needs a maskable icon")
})

await check("every manifest icon is served as a real PNG of the stated size", async () => {
  for (const icon of manifest().icons) {
    const res = await request(port, { pathname: icon.src })
    assert.equal(res.status, 200, icon.src)
    assert.equal(res.headers["content-type"], "image/png")
    assert.equal(res.body.subarray(1, 4).toString("latin1"), "PNG", `${icon.src} is not a PNG`)
    const width = res.body.readUInt32BE(16)
    const height = res.body.readUInt32BE(20)
    assert.equal(`${width}x${height}`, icon.sizes, icon.src)
  }
})

await check("service worker and offline page are served", async () => {
  const sw = await request(port, { pathname: "/sw.js" })
  assert.equal(sw.status, 200)
  assert.match(sw.headers["content-type"], /javascript/)
  assert.match(sw.body.toString(), /offline\.html/)
  const offline = await request(port, { pathname: "/offline.html" })
  assert.equal(offline.status, 200)
  assert.match(offline.body.toString(), /install\.mjs --start/)
})

await check("refuses a foreign Host header", async () => {
  const res = await request(port, { pathname: "/api/health", headers: { host: "evil.example" } })
  assert.equal(res.status, 403)
})

await check("refuses a foreign Origin", async () => {
  const res = await request(port, { pathname: "/api/editors", headers: { origin: "https://evil.example" } })
  assert.equal(res.status, 403)
})

await check('refuses Origin "null" (sandboxed iframe, data: URL)', async () => {
  const res = await request(port, { pathname: "/api/health", headers: { origin: "null" } })
  assert.equal(res.status, 403)
})

await check("accepts a loopback Origin", async () => {
  const res = await request(port, { pathname: "/api/health", headers: { origin: `http://localhost:${port}` } })
  assert.equal(res.status, 200)
})

await check("editors: empty registry is an empty list", async () => {
  const res = await request(port, { pathname: "/api/editors" })
  assert.equal(res.status, 200)
  assert.deepEqual(res.json, { editors: [] })
})

await check("editors: live entries are normalized, dead ones swept", async () => {
  const dir = path.join(tempHome, ".local", "state", "designlayer", "editors")
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(
    path.join(dir, "4100.json"),
    JSON.stringify({ proxyPort: 4100, packageName: "demo-app", projectRoot: "/tmp/demo-app", url: "http://127.0.0.1:4100", pid: process.pid, startedAt: 1 })
  )
  fs.writeFileSync(
    path.join(dir, "4200.json"),
    JSON.stringify({ proxyPort: 4200, projectRoot: "/tmp/no-name", pid: process.pid, startedAt: 2 })
  )
  // A pid that cannot exist.
  fs.writeFileSync(path.join(dir, "4300.json"), JSON.stringify({ proxyPort: 4300, pid: 2 ** 31 - 2 }))
  const res = await request(port, { pathname: "/api/editors" })
  assert.equal(res.status, 200)
  assert.deepEqual(
    res.json.editors.map(({ name, url, projectRoot, pid, alive }) => ({ name, url, projectRoot, pid, alive })),
    [
      { name: "demo-app", url: "http://127.0.0.1:4100", projectRoot: "/tmp/demo-app", pid: process.pid, alive: true },
      { name: "no-name", url: "http://127.0.0.1:4200", projectRoot: "/tmp/no-name", pid: process.pid, alive: true },
    ]
  )
  assert.equal(fs.existsSync(path.join(dir, "4300.json")), false, "dead entry should be swept")
})

await check("pick-folder refuses GET without opening a dialog", async () => {
  const res = await request(port, { pathname: "/api/pick-folder" })
  assert.equal(res.status, 405)
  assert.equal(pickerCalls, 0)
})

await check("pick-folder POST from a foreign Origin is refused before the dialog", async () => {
  const res = await request(port, { method: "POST", pathname: "/api/pick-folder", headers: { origin: "https://evil.example" } })
  assert.equal(res.status, 403)
  assert.equal(pickerCalls, 0)
})

await check("pick-folder POST reports a cancelled dialog", async () => {
  const res = await request(port, { method: "POST", pathname: "/api/pick-folder" })
  assert.equal(res.status, 200)
  assert.deepEqual(res.json, { cancelled: true })
  assert.equal(pickerCalls, 1)
})

await check("unknown routes are 404", async () => {
  const res = await request(port, { pathname: "/nope" })
  assert.equal(res.status, 404)
})

await desk.close()

console.log("launch agent plist")

const plistInput = {
  nodePath: "/opt/homebrew/bin/node",
  serverPath: "/Users/me/designlayer/desktop/mac/desk-server.mjs",
  repoRoot: "/Users/me/designlayer",
  env: { PATH: "/opt/homebrew/bin:/usr/bin:/bin", HOME: "/Users/me", LANG: "en_US.UTF-8" },
  logFile: "/Users/me/Library/Logs/DesignLayer/desk.log",
}

await check("plist has the label, absolute program, env, logs and keep-alive policy", () => {
  const xml = buildPlist(plistInput)
  assert.equal(LABEL, "dev.designlayer.desk")
  assert.match(xml, /<key>Label<\/key>\s*<string>dev\.designlayer\.desk<\/string>/)
  assert.match(xml, /<key>ProgramArguments<\/key>\s*<array>\s*<string>\/opt\/homebrew\/bin\/node<\/string>\s*<string>\/Users\/me\/designlayer\/desktop\/mac\/desk-server\.mjs<\/string>\s*<\/array>/)
  assert.match(xml, /<key>WorkingDirectory<\/key>\s*<string>\/Users\/me\/designlayer<\/string>/)
  assert.match(xml, /<key>PATH<\/key>\s*<string>\/opt\/homebrew\/bin:\/usr\/bin:\/bin<\/string>/)
  assert.match(xml, /<key>HOME<\/key>\s*<string>\/Users\/me<\/string>/)
  assert.match(xml, /<key>LANG<\/key>/)
  assert.match(xml, /<key>StandardOutPath<\/key>\s*<string>\/Users\/me\/Library\/Logs\/DesignLayer\/desk\.log<\/string>/)
  assert.match(xml, /<key>StandardErrorPath<\/key>/)
  assert.match(xml, /<key>RunAtLoad<\/key>\s*<true\/>/)
  assert.match(xml, /<key>KeepAlive<\/key>\s*<dict>\s*<key>SuccessfulExit<\/key>\s*<false\/>\s*<\/dict>/)
  assert.match(xml, /<key>ProcessType<\/key>\s*<string>Interactive<\/string>/)
  assert.doesNotMatch(xml, /com\.google/)
})

await check("plist escapes XML and passes plutil -lint", () => {
  const xml = buildPlist({ ...plistInput, repoRoot: "/Users/me/R&D <x>" })
  assert.match(xml, /R&amp;D &lt;x&gt;/)
  const file = path.join(tempHome, "lint.plist")
  fs.writeFileSync(file, xml)
  const out = execFileSync("/usr/bin/plutil", ["-lint", file], { encoding: "utf8" })
  assert.match(out, /OK/)
})

await check("plist refuses relative paths", () => {
  assert.throws(() => buildPlist({ ...plistInput, nodePath: "node" }), /absolute/)
})

console.log("installer")

await check("install.mjs --dry-run prints the plan and writes nothing", () => {
  const dryHome = fs.mkdtempSync(path.join(os.tmpdir(), "desk-dry-"))
  const out = execFileSync(process.execPath, [path.join(MAC, "install.mjs"), "--dry-run"], {
    encoding: "utf8",
    env: { ...process.env, HOME: dryHome },
  })
  assert.match(out, /\[1\/5\] Preflight/)
  assert.match(out, /dev\.designlayer\.desk/)
  assert.match(out, /PWA\.install/)
  assert.match(out, /Dry run: nothing was written/)
  const written = fs.readdirSync(dryHome, { recursive: true })
  assert.deepEqual(written, [], `dry run wrote: ${written.join(", ")}`)
  fs.rmSync(dryHome, { recursive: true, force: true })
})

await check("install.mjs --uninstall --dry-run against an empty home says nothing to do", () => {
  const dryHome = fs.mkdtempSync(path.join(os.tmpdir(), "desk-dry-"))
  const out = execFileSync(process.execPath, [path.join(MAC, "install.mjs"), "--uninstall", "--dry-run"], {
    encoding: "utf8",
    env: { ...process.env, HOME: dryHome },
  })
  assert.match(out, /Nothing to uninstall/)
  fs.rmSync(dryHome, { recursive: true, force: true })
})

console.log("app profile")

const { quitProfileChrome } = await import("../chrome-pipe.mjs")
const { spawn } = await import("node:child_process")
const alive = (pid) => {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

/** A stand-in for the app's Chrome: a live process whose command line names a profile. */
async function lockedProfile(namedDir) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "desk-profile-"))
  const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)", "--", `--user-data-dir=${namedDir ?? dir}`], {
    stdio: "ignore",
  })
  fs.symlinkSync(`${os.hostname()}-${child.pid}`, path.join(dir, "SingletonLock"))
  await new Promise((resolve) => setTimeout(resolve, 300))
  return { dir, child }
}

await check("quitProfileChrome leaves a process alone when it names another profile", async () => {
  const { dir, child } = await lockedProfile("/somewhere/else")
  try {
    assert.equal(await quitProfileChrome(dir, 1000), false)
    assert.equal(alive(child.pid), true, "the unrelated process was signalled")
  } finally {
    child.kill("SIGKILL")
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

await check("quitProfileChrome stops the process that owns this exact profile", async () => {
  const { dir, child } = await lockedProfile()
  try {
    assert.equal(await quitProfileChrome(dir, 3000), true)
    assert.equal(alive(child.pid), false)
  } finally {
    if (alive(child.pid)) child.kill("SIGKILL")
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

process.env.HOME = realHome
fs.rmSync(tempHome, { recursive: true, force: true })

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
