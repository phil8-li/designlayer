/**
 * Cases for the promise that a designer configures nothing.
 *
 * Every value here used to be a constant that happened to be right for one
 * framework: the dev script was `dev`, the port was 3000, the port travelled as
 * `PORT`, the app was assumed to be on `127.0.0.1`, and the folder column of
 * the start screen was macOS-only. Each of those is correct for Next and wrong
 * for something else, and the workaround in every case was a flag the designer
 * had to know to pass.
 *
 * So these are the questions the tool must answer for itself, asked once per
 * host kind against a real project on disk:
 *
 *   which framework  -> which resolver and which write lane
 *   which script     -> `npm run` what
 *   which port       -> where to wait
 *   how to say it    -> `PORT`, or `--port` on the command line
 *   which address    -> 127.0.0.1 or ::1, because the app picks, not us
 *
 * The port and host tables are measured behaviour, not documentation:
 * `PORT=3999 vite` binds 5173, and `npm start` in a stock Angular project
 * answers on `[::1]` and refuses `127.0.0.1`. A case that pins `--port` and
 * `--host` is pinning those measurements.
 *
 * Usage: node designlayer/test/zero-config-cases.mjs
 */

import assert from "node:assert/strict"
import fs from "node:fs"
import http from "node:http"
import net from "node:net"
import os from "node:os"
import path from "node:path"

import { detectDevServer, resolveConfig, resolveDevPort, resolveDevScript } from "../config.mjs"
import { describeProject, projectRootForPort, scanLocalApps } from "../runtime/local-apps.mjs"
import { ensureAppRunning, loopbackHostFor, urlHost } from "../runtime/dev-server.mjs"

let passed = 0
let failed = 0

function check(name, fn) {
  try {
    fn()
    passed += 1
    console.log(`  ok   ${name}`)
  } catch (error) {
    failed += 1
    console.log(`  FAIL ${name}\n       ${error.message}`)
  }
}

async function checkAsync(name, fn) {
  try {
    await fn()
    passed += 1
    console.log(`  ok   ${name}`)
  } catch (error) {
    failed += 1
    console.log(`  FAIL ${name}\n       ${error.message}`)
  }
}

const temporary = []
function project(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "de-zero-"))
  temporary.push(root)
  for (const [name, contents] of Object.entries(files)) {
    const target = path.join(root, name)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, typeof contents === "string" ? contents : JSON.stringify(contents))
  }
  return root
}

const manifest = (extra) => ({ name: "host", private: true, ...extra })

const freePort = () =>
  new Promise((resolve) => {
    const server = net.createServer()
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address()
      server.close(() => resolve(port))
    })
  })

const serveOn = (host) =>
  new Promise((resolve, reject) => {
    const server = http.createServer((_req, res) => {
      res.writeHead(200, { "content-type": "text/html" })
      res.end("<title>Hand started</title>")
    })
    server.once("error", reject)
    server.listen(0, host, () => resolve({ server, port: server.address().port }))
  })

/* ---------------------------------------------------------------------- */
console.log("\nWhat kind of host is this")

{
  const cases = [
    [
      "a stock Angular app",
      project({ "package.json": manifest({ dependencies: { "@angular/core": "^22.0.0" } }) }),
      { devServer: "angular", framework: "angular", port: 4200, portFlag: "--port", hostFlag: "--host" },
    ],
    [
      "a Next app with no next.config",
      project({ "package.json": manifest({ dependencies: { next: "^15.0.0", react: "^19.0.0" } }) }),
      { devServer: "next", framework: "react", port: 3000, portFlag: "--port", hostFlag: "--hostname" },
    ],
    [
      "a Next app known only by its config file",
      project({ "package.json": manifest({}), "next.config.mjs": "export default {}" }),
      { devServer: "next", framework: "react", port: 3000, portFlag: "--port", hostFlag: "--hostname" },
    ],
    [
      "a Vite + React app",
      project({
        "package.json": manifest({
          dependencies: { react: "^19.0.0" },
          devDependencies: { vite: "^7.0.0" },
        }),
      }),
      { devServer: "vite", framework: "react", port: 5173, portFlag: "--port", hostFlag: "--host" },
    ],
    [
      "a Create React App",
      project({ "package.json": manifest({ dependencies: { "react-scripts": "^5.0.0" } }) }),
      { devServer: "cra", framework: "react", port: 3000, portFlag: null, hostFlag: null },
    ],
    [
      "something this tool has never seen",
      project({ "package.json": manifest({ dependencies: { svelte: "^5.0.0" } }) }),
      { devServer: "unknown", framework: "react", port: 3000, portFlag: null, hostFlag: null },
    ],
  ]

  for (const [label, root, want] of cases) {
    check(label, () => {
      assert.equal(detectDevServer(root), want.devServer, "devServer")
      const config = resolveConfig({}, { cwd: root })
      assert.equal(config.host.framework, want.framework, "framework")
      assert.equal(config.app.devPort, want.port, "devPort")
      assert.equal(config.app.devPortFlag, want.portFlag, "devPortFlag")
      assert.equal(config.app.devHostFlag, want.hostFlag, "devHostFlag")
    })
  }

  check("Angular wins over a vite.config it happens to ship", () => {
    const root = project({
      "package.json": manifest({
        dependencies: { "@angular/core": "^22.0.0" },
        devDependencies: { vite: "^7.0.0" },
      }),
      "vite.config.ts": "export default {}",
    })
    assert.equal(detectDevServer(root), "angular")
  })

  check("Next wins over a Vite it depends on for tests", () => {
    const root = project({
      "package.json": manifest({
        dependencies: { next: "^15.0.0", react: "^19.0.0" },
        devDependencies: { vite: "^7.0.0" },
      }),
    })
    assert.equal(detectDevServer(root), "next")
  })

  check("a project with no package.json at all is still startable", () => {
    const root = project({ "index.html": "<html></html>" })
    const config = resolveConfig({}, { cwd: root })
    assert.equal(config.host.framework, "react")
    assert.equal(config.app.devPort, 3000)
  })
}

/* ---------------------------------------------------------------------- */
console.log("\nWhich script to run")

{
  check("`dev` is used when the host has one", () => {
    const root = project({
      "package.json": manifest({ scripts: { dev: "next dev", start: "next start" } }),
    })
    assert.equal(resolveConfig({}, { cwd: root }).app.devScript, "dev")
  })

  check("an Angular host's `start` is found without being asked for", () => {
    // `ng new` writes `start` and no `dev`, which is the whole reason this
    // resolution exists: the old default named a script that does not exist and
    // the run died on `Missing script: dev`.
    const root = project({
      "package.json": manifest({
        dependencies: { "@angular/core": "^22.0.0" },
        scripts: { ng: "ng", start: "ng serve", build: "ng build" },
      }),
    })
    assert.equal(resolveConfig({}, { cwd: root }).app.devScript, "start")
  })

  check("the preference order holds when several are present", () => {
    const root = project({
      "package.json": manifest({ scripts: { serve: "x", start: "y", develop: "z" } }),
    })
    assert.equal(resolveDevScript(root, "dev", false), "develop")
  })

  check("`build` is not mistaken for a dev script", () => {
    const root = project({ "package.json": manifest({ scripts: { build: "ng build" } }) })
    assert.equal(resolveDevScript(root, "dev", false), "dev")
  })

  check("an explicit devScript wins, even one the host does not have", () => {
    const root = project({
      "package.json": manifest({
        dependencies: { "@angular/core": "^22.0.0" },
        scripts: { start: "ng serve" },
      }),
    })
    // npm should be the one to say there is no such script — silently running
    // something else would be the tool overruling a stated choice.
    const config = resolveConfig({ app: { devScript: "dev" } }, { cwd: root })
    assert.equal(config.app.devScript, "dev")
  })
}

/* ---------------------------------------------------------------------- */
console.log("\nWhich port to wait on")

{
  check("an Angular project that moved its port is believed over the default", () => {
    const root = project({
      "package.json": manifest({ dependencies: { "@angular/core": "^22.0.0" } }),
      "angular.json": {
        projects: { app: { architect: { serve: { options: { port: 4400 } } } } },
      },
    })
    assert.equal(resolveConfig({}, { cwd: root }).app.devPort, 4400)
  })

  check("the newer `targets` spelling is read too", () => {
    const root = project({
      "package.json": manifest({ dependencies: { "@angular/core": "^22.0.0" } }),
      "angular.json": { projects: { app: { targets: { serve: { options: { port: 4500 } } } } } },
    })
    assert.equal(resolveDevPort(root, "angular"), 4500)
  })

  check("a malformed angular.json falls back rather than throwing", () => {
    const root = project({
      "package.json": manifest({ dependencies: { "@angular/core": "^22.0.0" } }),
      "angular.json": "{ not json",
    })
    assert.equal(resolveDevPort(root, "angular"), 4200)
  })
}

/* ---------------------------------------------------------------------- */
console.log("\nHow the port is handed over")

{
  // A stand-in dev server that binds whichever port it was TOLD about, by
  // whichever route. The assertion is then about what reached the script rather
  // than about what this package believes it sent.
  //
  // A file rather than `node -e`, because `node -e "..." --port 3000` makes
  // node parse `--port` as its own option and exit 9 — the script has to be a
  // script for npm's `--` forwarding to mean anything.
  const SERVER = [
    "const args = process.argv.slice(2)",
    "const at = (name) => { const i = args.indexOf(name); return i === -1 ? null : args[i + 1] }",
    "const port = at('--port') ?? process.env.PORT",
    "const host = at('--host') ?? process.env.HOST",
    "if (!port) { console.error('told no port'); process.exit(2) }",
    "if (!host) { console.error('told no host'); process.exit(3) }",
    "require('http')",
    "  .createServer((_q, s) => { s.writeHead(200, { 'content-type': 'text/html' }); s.end('<title>up</title>') })",
    "  .listen(Number(port), host)",
  ].join("\n")
  const script = "node server.cjs"

  await checkAsync("a flagged host is told on the command line, and lands there", async () => {
    const port = await freePort()
    const root = project({
      "package.json": manifest({ scripts: { dev: script } }),
      "server.cjs": SERVER,
    })
    const app = await ensureAppRunning({
      projectRoot: root,
      host: "127.0.0.1",
      port,
      script: "dev",
      portFlag: "--port",
      hostFlag: "--host",
      timeoutMs: 20_000,
      log: () => {},
    })
    assert.equal(app.started, true)
    app.stop()
  })

  await checkAsync("an unflagged host is told through PORT, and lands there", async () => {
    const port = await freePort()
    const root = project({
      "package.json": manifest({ scripts: { dev: script } }),
      "server.cjs": SERVER,
    })
    const app = await ensureAppRunning({
      projectRoot: root,
      host: "127.0.0.1",
      port,
      script: "dev",
      portFlag: null,
      hostFlag: null,
      timeoutMs: 20_000,
      log: () => {},
    })
    assert.equal(app.started, true)
    app.stop()
  })

  await checkAsync("the interface is named too, not just the port", async () => {
    // The silent half of the same bug: `vite` and `ng serve` default to
    // `localhost`, which on an IPv6-first machine is `[::1]` alone. The app
    // comes up and the launcher, probing 127.0.0.1, never sees it. This server
    // exits rather than guessing, so a missing host fails the case.
    const port = await freePort()
    const root = project({
      "package.json": manifest({ scripts: { dev: script } }),
      "server.cjs": SERVER,
    })
    const app = await ensureAppRunning({
      projectRoot: root,
      host: "127.0.0.1",
      port,
      script: "dev",
      portFlag: "--port",
      hostFlag: "--host",
      timeoutMs: 20_000,
      log: () => {},
    })
    assert.equal(app.started, true)
    // Reachable on the interface the editor's proxy will actually target.
    const response = await fetch(`http://127.0.0.1:${port}/`)
    assert.equal(response.status, 200)
    app.stop()
  })

  await checkAsync("a server someone else already started is left alone", async () => {
    const port = await freePort()
    const server = http.createServer((_req, res) => res.end("hi"))
    await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve))
    const root = project({ "package.json": manifest({ scripts: { dev: "exit 1" } }) })
    const app = await ensureAppRunning({
      projectRoot: root,
      host: "127.0.0.1",
      port,
      script: "dev",
      portFlag: "--port",
      log: () => {},
    })
    assert.equal(app.started, false, "it started a second server over a live one")
    await new Promise((resolve) => server.close(resolve))
  })

  await checkAsync("a build that is still talking is not killed for being slow", async () => {
    const port = await freePort()
    // Prints for a while, then binds — the shape of a big first compile. With a
    // fixed deadline shorter than the build, this is the case that got a
    // working dev server killed and blamed for not answering.
    const root = project({
      "package.json": manifest({ scripts: { dev: "node slow.cjs" } }),
      "slow.cjs": [
        "const args = process.argv.slice(2)",
        "const port = args[args.indexOf('--port') + 1]",
        "let n = 0",
        "const tick = setInterval(() => { console.log('building chunk ' + ++n) }, 100)",
        "setTimeout(() => {",
        "  clearInterval(tick)",
        "  require('http').createServer((_q, s) => { s.writeHead(200, {'content-type':'text/html'}); s.end('<title>up</title>') }).listen(Number(port), '127.0.0.1')",
        "}, 1200)",
      ].join("\n"),
    })
    const app = await ensureAppRunning({
      projectRoot: root,
      host: "127.0.0.1",
      port,
      script: "dev",
      portFlag: "--port",
      // Shorter than the build it is waiting on. It survives because the child
      // keeps printing, which is the whole point of the quiet-timeout model.
      timeoutMs: 500,
      log: () => {},
    })
    assert.equal(app.started, true)
    app.stop()
  })

  await checkAsync("a script that goes silent without binding is given up on", async () => {
    const port = await freePort()
    const root = project({
      "package.json": manifest({ scripts: { dev: "node hang.cjs" } }),
      "hang.cjs": "console.log('starting'); setTimeout(() => {}, 60000)",
    })
    await assert.rejects(
      ensureAppRunning({
        projectRoot: root,
        host: "127.0.0.1",
        port,
        script: "dev",
        portFlag: null,
        timeoutMs: 1_500,
        log: () => {},
      }),
      /has said nothing for \d+s/
    )
  })

  await checkAsync("the failure names the command it actually ran", async () => {
    const port = await freePort()
    const root = project({
      "package.json": manifest({ scripts: { dev: "node fail.cjs" } }),
      "fail.cjs": "process.exit(3)",
    })
    await assert.rejects(
      ensureAppRunning({
        projectRoot: root,
        host: "127.0.0.1",
        port,
        script: "dev",
        portFlag: "--port",
        hostFlag: "--host",
        timeoutMs: 5_000,
        log: () => {},
      }),
      /npm run dev -- --host 127\.0\.0\.1 --port \d+/
    )
  })
}

/* ---------------------------------------------------------------------- */
console.log("\nLoopback has two addresses and the app may be on either")

{
  check("a URL host brackets an IPv6 literal and leaves v4 alone", () => {
    // `http://::1:4200` is not a URL. The socket form is not the URL form, and
    // conflating them takes the launch down inside `new URL()`.
    assert.equal(urlHost("::1"), "[::1]")
    assert.equal(urlHost("127.0.0.1"), "127.0.0.1")
  })

  await checkAsync("an app on ::1 alone is still found", async () => {
    // What `npm start` in a stock Angular project actually produces on an
    // IPv6-first machine: `ng serve` binds the NAME localhost, which resolves
    // to [::1] and leaves 127.0.0.1 refusing connections.
    let listener
    try {
      listener = await serveOn("::1")
    } catch {
      return // No IPv6 stack on this machine; nothing to prove.
    }
    try {
      assert.equal(await loopbackHostFor(listener.port), "::1")
      const apps = await scanLocalApps({ ports: [listener.port], timeoutMs: 2000 })
      assert.equal(apps.length, 1, "the start screen could not see an IPv6-only app")
      assert.equal(apps[0].url, `http://[::1]:${listener.port}`)
      assert.equal(apps[0].title, "Hand started")
    } finally {
      await new Promise((resolve) => listener.server.close(resolve))
    }
  })

  await checkAsync("an app on 127.0.0.1 keeps the address it always had", async () => {
    const listener = await serveOn("127.0.0.1")
    try {
      assert.equal(await loopbackHostFor(listener.port), "127.0.0.1")
      const apps = await scanLocalApps({ ports: [listener.port], timeoutMs: 2000 })
      assert.equal(apps[0].url, `http://127.0.0.1:${listener.port}`)
    } finally {
      await new Promise((resolve) => listener.server.close(resolve))
    }
  })

  await checkAsync("a port with nothing on it resolves to no address", async () => {
    assert.equal(await loopbackHostFor(await freePort()), null)
  })

  await checkAsync("--dev attaches to an IPv6 app rather than starting a rival", async () => {
    // A designer with `npm start` already running has their app on whichever
    // address their own script chose. Probing v4 only concluded nothing was
    // there and spawned a SECOND dev server on the same port and a different
    // address — both alive, and the editor proxying the wrong one.
    let listener
    try {
      listener = await serveOn("::1")
    } catch {
      return // No IPv6 stack here.
    }
    try {
      const app = await ensureAppRunning({
        projectRoot: project({ "package.json": manifest({ scripts: { dev: "exit 1" } }) }),
        host: "127.0.0.1",
        port: listener.port,
        script: "dev",
        portFlag: "--port",
        hostFlag: "--host",
        log: () => {},
      })
      assert.equal(app.started, false, "it started a rival server beside a live one")
      assert.equal(app.host, "::1", "it attached without saying where")
    } finally {
      await new Promise((resolve) => listener.server.close(resolve))
    }
  })
}

/* ---------------------------------------------------------------------- */
console.log("\nThe start screen opens both frameworks")

{
  const { createStartScreen } = await import("../runtime/start-screen.mjs")

  /** Presses Start the way the page does, and returns what the server said. */
  async function pressStart(screen, body) {
    const response = await fetch(new URL("/api/start", screen.url), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
    return { status: response.status, body: await response.json().catch(() => null) }
  }

  const angular = project({
    "package.json": manifest({
      name: "ng-app",
      dependencies: { "@angular/core": "^22.0.0" },
      scripts: { start: "ng serve" },
    }),
  })
  const react = project({
    "package.json": manifest({
      name: "rx-app",
      dependencies: { react: "^19.0.0" },
      scripts: { dev: "vite" },
    }),
  })
  const neither = project({
    "package.json": manifest({ name: "svelte-app", dependencies: { svelte: "^5.0.0" } }),
  })

  /*
   * One screen per case. The first accepted Start latches the supervisor —
   * "the editor is already starting" — which is right for the product and
   * would otherwise make every case after the first pass for the wrong reason.
   */
  async function onFreshScreen(fn) {
    const screen = await createStartScreen({ port: 0, log: () => {} })
    try {
      return await fn(screen)
    } finally {
      screen.close()
    }
  }

  await checkAsync("an Angular project is accepted", () =>
    onFreshScreen(async (screen) => {
      // The gate here read `dependencies.react` and nothing else, so the screen
      // refused BY NAME the projects the editor had just learned to edit — and
      // this is the entry point a designer actually uses.
      const answer = await pressStart(screen, {
        url: "http://127.0.0.1:4200/",
        projectRoot: angular,
        devScript: "start",
      })
      assert.notEqual(answer.status, 400, `refused: ${answer.body?.error}`)
    })
  )

  await checkAsync("a React project is still accepted", () =>
    onFreshScreen(async (screen) => {
      const answer = await pressStart(screen, {
        url: "http://127.0.0.1:3000/",
        projectRoot: react,
        devScript: "dev",
      })
      assert.notEqual(answer.status, 400, `refused: ${answer.body?.error}`)
    })
  )

  await checkAsync("a project of neither kind is refused, and says so", () =>
    onFreshScreen(async (screen) => {
      const answer = await pressStart(screen, {
        url: "http://127.0.0.1:3000/",
        projectRoot: neither,
        devScript: null,
      })
      assert.equal(answer.status, 400)
      assert.match(answer.body.error, /neither React nor Angular/)
    })
  )
}

/* ---------------------------------------------------------------------- */
console.log("\nThe start screen fills the folder in")

{
  check("an Angular project is named as Angular, not as unrecognised", () => {
    const root = project({
      "package.json": manifest({
        dependencies: { "@angular/core": "^22.0.0" },
        scripts: { start: "ng serve" },
      }),
    })
    const described = describeProject(root)
    assert.equal(described.framework, "angular")
    assert.deepEqual(described.devScripts, ["start"])
  })

  check("a Vite React project still reports vite", () => {
    const root = project({
      "package.json": manifest({ dependencies: { react: "^19.0.0" }, scripts: { dev: "vite" } }),
      "vite.config.ts": "export default {}",
    })
    const described = describeProject(root)
    assert.equal(described.framework, "vite")
    assert.equal(described.hasReact, true)
  })

  await checkAsync("a running app's folder is discovered without asking the user", async () => {
    if (process.platform === "win32") {
      // No supported way to ask; the screen falls back to the folder picker.
      return
    }
    const root = project({
      "package.json": manifest({ name: "found-me", scripts: { dev: "x" } }),
    })
    // A server whose working directory IS the project, which is what a dev
    // server started by `npm run dev` looks like to the machine.
    const server = http.createServer((_req, res) => {
      res.writeHead(200, { "content-type": "text/html" })
      res.end("<title>Discovered</title>")
    })
    const port = await new Promise((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve(server.address().port))
    })
    const previous = process.cwd()
    process.chdir(root)
    try {
      // `projectRootForPort` asks the OS for the LISTENER's cwd. This process is
      // the listener, so chdir makes it answerable — and it is answerable only
      // because the lookup works off /proc on Linux as well as lsof on macOS.
      const found = projectRootForPort(port)
      assert.equal(found && fs.realpathSync(found), fs.realpathSync(root))

      const apps = await scanLocalApps({ ports: [port], timeoutMs: 2000 })
      assert.equal(apps.length, 1)
      assert.equal(apps[0].title, "Discovered")
      assert.equal(apps[0].packageName, "found-me")
      assert.ok(apps[0].projectRoot, "the row arrived with no folder")
    } finally {
      process.chdir(previous)
      await new Promise((resolve) => server.close(resolve))
    }
  })
}

for (const root of temporary) fs.rmSync(root, { recursive: true, force: true })

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
