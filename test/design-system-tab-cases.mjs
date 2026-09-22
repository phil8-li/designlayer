/**
 * The Design system tab: the libraries you can draw from, and the audit that
 * says where you did not.
 *
 * It replaces `assets-panel-cases.mjs`, which tested a surface that no longer
 * exists. The Assets browser — the component grid, the cards, the thumbnails,
 * the group drill-down, the search box, the details popover and "Insert
 * instance" — is gone by request, and the library manager it opened is now a
 * `section()` on the right panel beside the audit. So the cases here are not a
 * port of that file's cases; they are the claims the new surface has to keep,
 * and one claim about what it must NOT have grown back.
 *
 * Bundled with esbuild and run in JSDOM against a stubbed `fetch`, the same
 * harness `library-panel-cases.mjs` and `lint-marker-cases.mjs` use, and for
 * the same reason: what is under test is what the CLIENT does with a library
 * payload, and a real server would only add a second thing that can fail while
 * proving nothing about the section.
 *
 * What each case guards, and why losing it would be SILENT:
 *
 *  - **a row per library, saying what it contains.** The counts line is the
 *    only thing on the surface that distinguishes a design system the server
 *    parsed from a file it merely pointed at. A row that lost it still looks
 *    like a row, and a designer reads a library with nothing in it as a library
 *    that is simply off;
 *  - **the browsing UI did not survive the move.** This is the case with the
 *    shortest half-life: a grid, a card or an insert button reappearing here is
 *    exactly what a later change "restoring" the assets panel would do, and
 *    nothing else in the suite would notice. It is asserted as the ABSENCE of
 *    the three hooks that surface owned;
 *  - **the URL CTA posts `{url}` and surfaces a refusal in the server's own
 *    words.** Both halves fail invisibly. A field that never posts reads as a
 *    link that failed to parse; a failure reported as "HTTP 400" instead of the
 *    sentence the route wrote is the difference between a user who can fix
 *    their mistake and one who cannot. So the body of the POST is asserted, and
 *    so is the exact sentence the stub refuses with;
 *  - **the field survives a repaint.** The list rebuilds on every store beat,
 *    including the beat a switch fires, and a CTA rebuilt with it eats a
 *    half-typed URL. Asserted by toggling an unrelated library mid-typing and
 *    reading the field back;
 *  - **a walled link offers a way in, and the way in completes the errand.**
 *    Five claims, and every one of them fails quietly. A refusal that carries a
 *    challenge and draws nothing is a dead end wearing a toast; a wall that
 *    names an OAuth client id or a realm and does not print it withholds the
 *    only two strings a designer cannot look up for themselves; a credential
 *    box that is not a password field puts a bearer token into somebody's
 *    screen recording; a refusal that clears the box sends the designer back to
 *    a terminal for a string they already had; and a sign-in that does not
 *    replay the add leaves them to re-paste a URL the editor is still holding.
 *    The suite asserts the ORDER of the two posts for that last one, because
 *    "signed in" and "added" both being true says nothing about whether the
 *    second happened by itself;
 *  - **each wall is named by its MECHANISM, and offers the right credential
 *    first.** The server classifies a refusal by HTTP and OAuth alone, and the
 *    panel's labels have to stay that generic or they describe one company's
 *    stack and mislead about every other. Asserted against three of the five
 *    kinds, each with the credential it should preselect;
 *  - **nothing claims a sign-in the server did not grant.** The list of signed-
 *    in origins is drawn only from what `GET`/`POST /libraries/auth` answered.
 *    Asserted from the refusal case: a rejected credential must leave the list
 *    exactly as empty as it was;
 *  - **DS Lint is a section, with its hooks intact.** The panel was re-housed,
 *    not rewritten: the audit button, the summary, the finding rows and the
 *    footer keep their `data-de-lint` hooks, and `lint-marker-cases.mjs` is
 *    what proves they still behave. What THIS file pins is the housing — a real
 *    `.de-section` whose title is "DS Lint" — because the old bespoke header is
 *    the thing a re-housing is most likely to leave behind;
 *  - **the tab renders both, in that order.** Libraries is the vocabulary and
 *    the audit is the list of places the page does not use it. A tab that
 *    rendered them the other way round would work perfectly and read backwards.
 *
 * The fixtures are invented: two synthetic libraries, one candidate file for
 * the project scan, and the parsed library the URL add answers with. They
 * exercise the SHAPES the real ones have without being anybody's real design
 * system.
 *
 * Usage: node designlayer/test/design-system-tab-cases.mjs
 */

import assert from "node:assert/strict"
import { JSDOM } from "jsdom"

import { PACKAGE_DIR } from "./host.mjs"

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

// ── The world the bundle loads into ────────────────────────────────────────

const API = "/__designlayer"

globalThis.__DESIGNLAYER_CONFIG__ = {
  apiBase: API,
  designSystem: {
    name: "Host",
    trackingUnit: "em",
    colors: [],
    spacing: [],
    radii: [],
    textStyles: [],
    uiTextStyles: [],
    effects: [],
    icons: [],
    motion: [],
    responsiveMeasures: [],
    aliases: { cssVariables: [], tailwind: [] },
  },
  icons: { attribute: "", available: false },
  host: { framework: "react", tailwind: true },
}

const dom = new JSDOM(
  '<!doctype html><html><body><main id="app"><button id="cta">Go</button></main></body></html>',
  { pretendToBeVisual: true, url: "http://localhost/" }
)
const { window } = dom
window.document.elementsFromPoint = () => []
window.Element.prototype.getBoundingClientRect = function box() {
  return { x: 0, y: 0, left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100 }
}
window.Element.prototype.scrollIntoView = function scroll() {}
for (const name of ["setPointerCapture", "releasePointerCapture"]) {
  window.Element.prototype[name] = function capture() {}
}
window.Element.prototype.hasPointerCapture = function held() {
  return false
}
globalThis.DOMMatrixReadOnly = class {
  constructor() {
    this.m41 = 0
    this.m42 = 0
  }
}
for (const key of [
  "window", "document", "navigator", "Node", "Element", "HTMLElement",
  "HTMLInputElement", "HTMLTextAreaElement", "HTMLSelectElement", "HTMLButtonElement",
  "SVGElement", "SVGSVGElement",
  "Event", "CustomEvent", "MouseEvent", "KeyboardEvent", "PointerEvent",
  "requestAnimationFrame", "cancelAnimationFrame", "getComputedStyle",
]) {
  Object.defineProperty(globalThis, key, {
    value: key === "getComputedStyle" ? window.getComputedStyle.bind(window) : window[key],
    configurable: true,
    writable: true,
  })
}

// ── Two invented libraries, and what a URL add answers with ────────────────

const emptyCatalog = (name) => ({
  name,
  trackingUnit: "em",
  colors: [],
  spacing: [],
  radii: [],
  textStyles: [],
  uiTextStyles: [],
  effects: [],
  icons: [],
  motion: [],
  components: [],
  iconDrawings: [],
  iconAttribute: "",
})

const noCounts = {
  colors: 0, spacing: 0, radii: 0, textStyles: 0, effects: 0,
  icons: 0, motion: 0, components: 0, iconDrawings: 0,
}

/**
 * A token stylesheet, added from a path.
 *
 * Its counts are deliberately in three different groups, so the summary line
 * has to be a sentence built from them rather than one number: a row that
 * printed "48" would pass an assertion about colors and say nothing true.
 */
const PIER = {
  id: "src-pier-tokens",
  name: "Pier",
  enabled: true,
  source: { kind: "css", path: "src/pier/tokens.css" },
  addedAt: 1737100000000,
  counts: { ...noCounts, colors: 48, spacing: 12, components: 38 },
  catalog: emptyCatalog("Pier"),
}

/** A second library, off, so the switch has something to be pressed against. */
const BEACON = {
  id: "src-app-shared",
  name: "Beacon",
  enabled: false,
  source: { kind: "components", path: "src/app/shared" },
  addedAt: 1737100001000,
  counts: { ...noCounts, components: 2 },
  catalog: emptyCatalog("Beacon"),
}

/**
 * What a URL add answers with, and the one field that can only have come from
 * the server.
 *
 * `detail` is prose the client cannot derive: the counts on this record say
 * nothing about stories, and a section that wrote its own summary from them
 * would print "9 components" over a Storybook the server described completely
 * differently. That is the assertion the URL row is worth.
 */
const ORBIT = {
  id: "url-orbit",
  name: "Orbit",
  enabled: false,
  source: { kind: "manifest", path: "orbit", url: "https://orbit.example.com/storybook" },
  addedAt: 1737100002000,
  counts: { ...noCounts, components: 9 },
  detail: "9 components across 24 stories",
  catalog: emptyCatalog("Orbit"),
}

/** The one design-system file in this project the scan can find. */
const CANDIDATE = {
  path: "src/anchor/icons.svg",
  kind: "icons",
  name: "Anchor Icons",
  detail: "18 icon drawings",
  installed: false,
}

/** The sentence a refused add has to reach the user as, word for word. */
const REFUSAL = "https://nope.example.com does not serve a design system"

/**
 * A link behind a sign-in wall, and the challenge the server answers it with.
 *
 * Shaped exactly as `classifyWall` writes one for an OAuth redirect: the kind,
 * the origin, the `client_id` lifted out of the authorization request, an empty
 * realm because only a 401 has one, and the server's own hint. The audience is
 * the field this fixture exists for — it is one of the two strings in the whole
 * flow a designer has no way to look up, so a panel that receives it and does
 * not print it looks complete and is useless.
 */
const WALL = {
  kind: "oauth",
  origin: "https://vault.example.com",
  audience: "482913055217-8sfk2m1q9d7vb3ljxcpt0uwyh6razn4e.apps.example.com",
  realm: "",
  hint:
    "This site signs in through OAuth. Mint an identity token for the client id below and " +
    "paste it, or paste the site's session cookie from a browser that can already open it.",
  url: "https://vault.example.com/storybook",
}

/**
 * The other two walls the panel has to read differently, and why each is here.
 *
 * A 401 is the only refusal that carries a realm, so it is the only way to
 * exercise the second fact row — and it is also the one wall whose scheme the
 * wire cannot carry, since the credential union is bearer or cookie and neither
 * is `Authorization: Basic`. A plain sign-in redirect names nothing at all,
 * which is the case where a browser session is the likelier answer and the
 * block has to default to the cookie rather than to the token.
 */
const BASIC_WALL = {
  kind: "basic",
  origin: "https://mono.example.com",
  audience: "",
  realm: "Design tokens",
  hint:
    "This site asked for HTTP Basic authentication. Paste `user:password` base64-encoded, or a " +
    "token your provider issues in its place.",
  url: "https://mono.example.com/tokens.css",
}

const REDIRECT_WALL = {
  kind: "redirect",
  origin: "https://atlas.example.com",
  audience: "",
  realm: "",
  hint:
    "This site redirected to a sign-in page. Paste a bearer token it accepts, or its session " +
    "cookie from a browser that can already open it.",
  url: "https://atlas.example.com/storybook",
}

/** The sentence the refused ADD carries, beside the challenge. */
const WALLED = "vault.example.com asked this editor to sign in"

/**
 * The only credential this server accepts, and the sentence it refuses the rest
 * with.
 *
 * A single right answer rather than "any non-empty string", because the case
 * worth protecting is the WRONG one: the server verifies a credential against
 * the live site before storing it, so a stub that accepted anything would let a
 * panel that marks itself signed in optimistically pass every case here.
 */
const OPENS = "eyJhbGciOiJSUzI1NiJ9.a-real-looking-identity-token"
const BAD_CREDENTIAL =
  "That credential was refused — the site still asked for sign-in. Check it has not expired."

/** What the walled link resolves to once a credential opens it. */
const VAULT = {
  id: "url-vault",
  name: "Vault",
  enabled: false,
  source: { kind: "manifest", path: "vault", url: WALL.url },
  addedAt: 1737100003000,
  counts: { ...noCounts, components: 12 },
  detail: "12 components across 30 stories",
  catalog: emptyCatalog("Vault"),
}

/**
 * The server, as far as the client is concerned.
 *
 * It keeps state so a POST is visible to the next GET, and it records every
 * call — which is the only way the "the CTA posts `{url}`" case can be written,
 * because the claim is about the BODY of a request and nothing in the DOM
 * reports it.
 */
const server = {
  libraries: [],
  candidates: [],
  calls: [],
  /** Origins it holds a credential for — the shape `listOrigins` answers with,
   *  which is to say without the values. The secret never comes back out. */
  credentials: [],
  reset() {
    server.libraries = []
    server.candidates = []
    server.calls = []
    server.credentials = []
  },
}

const clone = (value) => JSON.parse(JSON.stringify(value))

async function serve(input, init = {}) {
  const url = new URL(String(input), "http://localhost")
  const method = (init.method ?? "GET").toUpperCase()
  const rest = url.pathname.slice(API.length)
  const body = init.body ? JSON.parse(init.body) : null
  server.calls.push({ method, path: rest, body })

  const reply = (payload) => ({ ok: true, status: 200, json: async () => payload })

  if (rest === "/libraries" && method === "GET") {
    return reply({ libraries: clone(server.libraries) })
  }
  if (rest === "/libraries/available" && method === "GET") {
    return reply({ candidates: clone(server.candidates) })
  }
  /*
   * The add, both ways in. A link this server recognises comes back as a parsed
   * library; anything else is a 400 carrying a sentence, which is the whole of
   * the help a user gets at the moment of the mistake.
   */
  /*
   * Sign-in, tested BEFORE the `<id>` form below for the reason `routes.mjs`
   * orders itself the same way: `auth` satisfies the library-id pattern, so a
   * server that checked the id form first would answer every one of these with
   * "no such library" — which is exactly what this stub did before the flow
   * existed, and it is a failure the client cannot tell from an empty list.
   */
  if (rest === "/libraries/auth") {
    if (method === "GET") return reply({ origins: clone(server.credentials) })
    if (method === "POST") {
      /*
       * VERIFIED, not stored. The real route re-fetches the URL with the
       * credential attached and refuses to save one that does not open the
       * wall, so a 200 from here is the only thing entitled to make the panel
       * say a designer is signed in.
       */
      if (body?.value !== OPENS) {
        return { ok: false, status: 400, json: async () => ({ message: BAD_CREDENTIAL }) }
      }
      const record = { origin: WALL.origin, scheme: body.scheme, addedAt: 1737100004000 }
      server.credentials = [
        ...server.credentials.filter((entry) => entry.origin !== record.origin),
        record,
      ]
      return reply(clone(record))
    }
    if (method === "DELETE") {
      const before = server.credentials.length
      server.credentials = server.credentials.filter((entry) => entry.origin !== body?.origin)
      return reply({ forgotten: server.credentials.length !== before })
    }
  }

  if (rest === "/libraries" && method === "POST") {
    /*
     * The two walls that are only ever refused. They exist to be READ — which
     * label, which fact row, which credential offered first — so this server
     * never opens them, and nothing downstream has to unwind a sign-in to them.
     */
    const other = [BASIC_WALL, REDIRECT_WALL].find((wall) => wall.url === body?.url)
    if (other) {
      return {
        ok: false,
        status: 400,
        json: async () => ({
          ok: false,
          message: `${new URL(other.origin).host} asked this editor to sign in`,
          auth: clone(other),
        }),
      }
    }
    /*
     * The walled link, which answers two different ways depending on what this
     * server has been given. Refused with the challenge attached and NOTHING
     * written — the real store throws before it writes, because a walled row in
     * the panel is a library named after a site that reports zero colours.
     */
    if (body?.url === WALL.url) {
      if (!server.credentials.some((entry) => entry.origin === WALL.origin)) {
        return {
          ok: false,
          status: 400,
          json: async () => ({ ok: false, message: WALLED, auth: clone(WALL) }),
        }
      }
      const library = clone(VAULT)
      server.libraries = [...server.libraries, library]
      return reply({ library: clone(library) })
    }
    if (body?.url === ORBIT.source.url) {
      const library = clone(ORBIT)
      server.libraries = [...server.libraries, library]
      return reply({ library: clone(library) })
    }
    if (body?.path === CANDIDATE.path) {
      const library = {
        ...clone(BEACON),
        id: "lib-anchor",
        name: "Anchor Icons",
        source: { kind: "icons", path: CANDIDATE.path },
        counts: { ...noCounts, iconDrawings: 18 },
        catalog: emptyCatalog("Anchor Icons"),
      }
      server.libraries = [...server.libraries, library]
      for (const candidate of server.candidates) {
        if (candidate.path === CANDIDATE.path) candidate.installed = true
      }
      return reply({ library: clone(library) })
    }
    return { ok: false, status: 400, json: async () => ({ message: REFUSAL }) }
  }
  // The audit, answered with nothing found: this file is about the section's
  // HOUSING, and `lint-marker-cases.mjs` owns what a finding does.
  if (rest === "/lint/tools") {
    return reply({ tools: [{ id: "stylelint", name: "Stylelint", available: true, reason: "" }] })
  }
  if (rest === "/lint/audit") {
    return reply({ findings: [], ignored: [], ranAt: Date.now() })
  }

  const keyed = /^\/libraries\/([a-z0-9-]+)(\/icons)?$/.exec(rest)
  if (keyed) {
    const library = server.libraries.find((entry) => entry.id === keyed[1])
    if (!library) return { ok: false, status: 404, json: async () => ({ message: "No such library" }) }
    if (keyed[2]) return reply({ attribute: library.catalog.iconAttribute, icons: [] })
    if (method === "PATCH") {
      Object.assign(library, body)
      return reply({ library: clone(library) })
    }
    if (method === "DELETE") {
      server.libraries = server.libraries.filter((entry) => entry.id !== library.id)
      return reply({ ok: true })
    }
  }

  return reply({})
}

globalThis.fetch = serve
window.fetch = serve

// ── The bundle ─────────────────────────────────────────────────────────────

/*
 * Every name here is one the module contract states. Nothing is imported on a
 * guess: one wrong export name is a bundle failure and a file of red lines
 * whose real cause is a typo.
 */
const { build } = await import("esbuild")
const bundled = await build({
  stdin: {
    contents: `
      export { createContext } from "./src/core/context"
      export { librariesSection } from "./src/libraries/libraries-section"
      export { dsLintSection } from "./src/lint/panel"
      export { designSystemTab } from "./src/panels/inspector/tab-design-system"
      export { libraryList, refreshLibraries } from "./src/libraries/store"
    `,
    resolveDir: PACKAGE_DIR,
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  platform: "browser",
  write: false,
  logLevel: "silent",
})
const editor = await import(
  `data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`
)

/** Enough turns of the loop for a fetch, a notify and a repaint to land. */
async function settle(turns = 6) {
  for (let index = 0; index < turns; index += 1) {
    await new Promise((resolve) => window.requestAnimationFrame(() => setTimeout(resolve, 0)))
  }
}

const slot = () => {
  const node = window.document.createElement("div")
  node.setAttribute("data-designlayer", "")
  window.document.body.append(node)
  return node
}

/** Every toast the editor raised, so a refusal can be read as words. */
const toasts = []
const bridge = {
  elementInfo: (element) => ({
    tagName: element?.tagName?.toLowerCase?.() ?? "div",
    componentName: "Page",
    filePath: "src/app/page.tsx",
    lineNumber: 7,
    columnNumber: 0,
    stack: [],
  }),
  elementSourceAsync: async (element) => bridge.elementInfo(element),
  send() {},
  toast: (message, kind) => toasts.push([message, kind]),
  subscribe: () => () => {},
  store: {
    setActiveTool() {},
    hasChanges: () => false,
    buildBatchOperations: () => [],
    onStateChange() {},
    getCanvasTransform: () => ({ x: 0, y: 0, scale: 1 }),
    viewportToPage: (x, y) => ({ x, y }),
    pageToViewport: (x, y) => ({ x, y }),
  },
}

const right = slot()
const context = editor.createContext(bridge, {
  overlay: slot(),
  toolbar: slot(),
  left: slot(),
  right,
})

server.reset()
server.libraries = [clone(PIER), clone(BEACON)]
server.candidates = [clone(CANDIDATE)]
await editor.refreshLibraries(API)

const libraries = editor.librariesSection(context)
right.append(libraries.node)
libraries.update()
await settle()

const click = (node) => {
  assert.ok(node, "nothing to click")
  node.dispatchEvent(new window.MouseEvent("click", { bubbles: true }))
}

/** Every element in the Libraries section wearing one of the contract's hooks. */
const all = (role) => Array.from(libraries.node.querySelectorAll(`[data-de-lib="${role}"]`))
const one = (role) => all(role)[0] ?? null
const row = (id) => libraries.node.querySelector(`[data-de-lib="library"][data-de-lib-id="${id}"]`)
const control = (role, id) =>
  libraries.node.querySelector(`[data-de-lib="${role}"][data-de-lib-id="${id}"]`)

/** The section's own title, read the way a reader would: off the header. */
const titleOf = (node) => node.querySelector(".de-section-title")?.textContent?.trim() ?? ""

// ── The Libraries section ──────────────────────────────────────────────────

console.log("\nLibraries is a section like Fill and Typography")

await check("it is a real de-section titled Libraries, not a panel with a bar", () => {
  assert.ok(libraries.node.classList.contains("de-section"), "the section is a bare div")
  assert.equal(titleOf(libraries.node), "Libraries")
  assert.ok(
    libraries.node.querySelector(".de-section-body"),
    "there is no section body, so the fold has nothing to hide"
  )
  assert.equal(
    libraries.node.querySelector(".de-lib-header"),
    null,
    "the old panel header bar came along with the move"
  )
})

await check("one row per installed library, each saying what it contains", () => {
  assert.equal(all("library").length, 2, "the section did not draw a row per library")

  const pier = row(PIER.id)
  assert.ok(pier, "Pier is missing from the list")
  assert.match(pier.textContent, /Pier/)
  // Three groups, in plain words, from three different count fields: a row that
  // printed one number would satisfy a laxer assertion and say nothing true.
  assert.match(pier.textContent, /48 colors/)
  assert.match(pier.textContent, /12 spacing steps/)
  assert.match(pier.textContent, /38 components/)
  // And where it came from, in full, in a title a pointer can read.
  const where = pier.querySelector(".de-lib-path")
  assert.ok(where, "the row does not say where the library came from")
  assert.equal(where.getAttribute("title"), PIER.source.path)

  const beacon = row(BEACON.id)
  assert.ok(beacon, "Beacon is missing from the list")
  assert.match(beacon.textContent, /2 components/)
})

await check("every row carries a switch that says which library it is for", () => {
  const on = control("enable", PIER.id)
  const off = control("enable", BEACON.id)
  assert.ok(on && off, "a library has no enable switch")
  assert.equal(on.getAttribute("aria-pressed"), "true")
  assert.equal(off.getAttribute("aria-pressed"), "false")
  // The name has to carry the library, because a list of eight of these is
  // otherwise eight controls called the same thing.
  assert.equal(on.getAttribute("aria-label"), `Enable ${PIER.name}`)
  assert.ok(control("remove", PIER.id), "a library has no way out")
})

/*
 * The case with the shortest half-life.
 *
 * The browsing UI was deleted by request, and the way it comes back is not a
 * revert — it is somebody "restoring the assets panel" into the surface that
 * replaced it. Asserted as the absence of the three hooks that surface owned,
 * against the whole document rather than the section, because the details
 * popover was mounted on `document.body` and would not be inside it.
 */
await check("nothing of the assets browser came back", () => {
  for (const selector of [".de-asset-card", ".de-asset-grid", '[data-de-asset="insert"]']) {
    assert.equal(
      window.document.querySelector(selector),
      null,
      `the component browser is back: ${selector}`
    )
  }
  assert.equal(
    libraries.node.querySelector('[data-de-asset="search"]'),
    null,
    "the search box came back"
  )
})

console.log("\nAdding a library by link")

await check("the CTA is a URL field with a real name, and an Add beside it", () => {
  const field = one("url")
  assert.ok(field, "there is no way to add a library by link")
  assert.equal(field.getAttribute("placeholder"), "https://…")
  assert.equal(field.getAttribute("aria-label"), "Link to a design system or Storybook")
  assert.ok(one("url-add"), "the URL field has no Add button")
})

await check("Add posts {url}, and the row that lands is the server's own", async () => {
  const field = one("url")
  field.value = ORBIT.source.url
  const before = server.calls.length
  click(one("url-add"))
  await settle(8)

  const post = server.calls
    .slice(before)
    .find((call) => call.method === "POST" && call.path === "/libraries")
  assert.ok(post, "Add never reached the server")
  assert.equal(post.body?.url, ORBIT.source.url, "the add posted something other than the link")
  assert.equal(post.body?.path, undefined, "a link was posted as a project path")

  const added = row(ORBIT.id)
  assert.ok(added, "the added library never appeared in the list")
  // The server's own sentence, which the counts on this record cannot produce:
  // a section writing its own summary would print "9 components" here.
  assert.match(added.textContent, /9 components across 24 stories/)
  assert.equal(
    added.querySelector(".de-lib-path")?.getAttribute("title"),
    ORBIT.source.url,
    "the row shows a path where the library has a URL"
  )
  assert.equal(field.value, "", "the field kept the link it had already added")
})

await check("a refused link is reported in the server's own words", async () => {
  const field = one("url")
  field.value = "https://nope.example.com"
  toasts.length = 0
  click(one("url-add"))
  await settle(8)

  const said = toasts.find(([, kind]) => kind === "error")
  assert.ok(said, "a refused add said nothing at all")
  assert.equal(said[0], REFUSAL, `the refusal was reworded: ${said[0]}`)
  // The link stays, because it is the thing the user has to correct.
  assert.equal(field.value, "https://nope.example.com", "a failed add threw the link away")
  assert.equal(one("url-add").disabled, false, "the Add button stayed disabled after a refusal")
  assert.equal(row("nope"), null)
  field.value = ""
})

/*
 * The invariant the CTA is built once for.
 *
 * The list repaints on every store beat — including the beat an unrelated
 * switch fires — and a field rebuilt with it loses the caret and the text. The
 * failure is invisible in any test that types and immediately asserts, so this
 * one types, causes a repaint from somewhere else, and reads the field back.
 */
await check("a repaint of the list does not eat a half-typed link", async () => {
  const field = one("url")
  field.value = "https://half-typed.example"
  click(control("enable", BEACON.id))
  await settle(8)

  assert.equal(all("library").length, 3, "the list did not repaint at all, so this proves nothing")
  assert.equal(one("url"), field, "the URL field was rebuilt underneath the caret")
  assert.equal(field.value, "https://half-typed.example", "the half-typed link was thrown away")
  field.value = ""
})

console.log("\nAdding a link that is behind a sign-in wall")

/** The sign-in block is built once and hidden, so "showing" is `hidden`. */
const signInShown = () => one("signin") !== null && one("signin").hidden === false

await check("a refused add draws the wall, names the origin and prints the audience", async () => {
  const field = one("url")
  field.value = WALL.url
  toasts.length = 0
  click(one("url-add"))
  await settle(8)

  // Nothing was installed: a walled URL is refused at the door, and a row for
  // it would be a library reporting zero colours for a reason it cannot state.
  assert.equal(row(VAULT.id), null, "a walled link was installed anyway")
  assert.ok(signInShown(), "a refused add produced no way to sign in")

  const block = one("signin")
  // Which MECHANISM, and whose origin. "This site needs a sign-in" would be
  // true of all five walls and actionable for none of them — and a label naming
  // somebody's identity product would be a guess this editor cannot make.
  assert.match(block.textContent, /OAuth sign-in/, "the block does not say which wall this is")
  assert.ok(
    block.textContent.includes(WALL.origin),
    `the block never names the origin: ${block.textContent}`
  )

  // The client id, in full — one of the two strings in this flow a designer has
  // no way to look up, and seventy characters nobody retypes correctly.
  const audience = control("signin-fact-value", "audience")
  assert.ok(audience, "an OAuth wall was reported with no client id to mint a token for")
  assert.equal(audience.textContent, WALL.audience)
  assert.equal(audience.closest("[hidden]"), null, "the client id is drawn but unreachable")
  assert.ok(
    control("signin-copy", "audience"),
    "the client id has no copy button, so it has to be retyped"
  )
  // And nothing about a realm, which only a 401 carries.
  assert.ok(
    control("signin-fact", "realm").hidden,
    "an empty realm was drawn as a labelled box with nothing in it"
  )

  // Bearer by default for a wall that named an OAuth client: the hint above the
  // box asks for an identity token, and defaulting to Cookie would contradict it.
  assert.equal(control("signin-scheme", "bearer").getAttribute("aria-pressed"), "true")
  assert.equal(control("signin-scheme", "cookie").getAttribute("aria-pressed"), "false")

  // The link stays. The designer is about to sign in and the add is replayed
  // for them; clearing it here would ask them to find the URL twice.
  assert.equal(field.value, WALL.url, "the refused link was thrown away")
  assert.equal(one("url-add").disabled, false, "Add stayed disabled behind the sign-in block")
})

await check("the credential is masked until it is asked for", async () => {
  const value = one("signin-value")
  assert.ok(value, "there is nowhere to paste a credential")
  // The default, and the only state that matters: a designer pastes this with
  // somebody at their shoulder or with a recording running.
  assert.equal(value.getAttribute("type"), "password", "the credential box shows the token")

  const toggle = one("signin-reveal")
  assert.ok(toggle, "a masked field with no way to check what was pasted")
  click(toggle)
  assert.equal(value.getAttribute("type"), "text", "the reveal toggle revealed nothing")
  assert.equal(toggle.getAttribute("aria-pressed"), "true")
  click(toggle)
  assert.equal(value.getAttribute("type"), "password", "the field stayed revealed")
})

/*
 * The invariant the block is built once for, and it is worse here than on the
 * URL field: what this box holds is an 800-character token fetched from another
 * program, and a repaint that ate it would send the designer back for it.
 */
await check("a repaint of the list does not eat a half-pasted credential", async () => {
  const value = one("signin-value")
  value.value = "eyJhbGciOi.half-pas"
  click(control("enable", PIER.id))
  await settle(8)

  assert.ok(signInShown(), "the sign-in block closed when an unrelated switch fired")
  assert.equal(one("signin-value"), value, "the credential box was rebuilt underneath the caret")
  assert.equal(value.value, "eyJhbGciOi.half-pas", "the half-pasted credential was thrown away")
})

await check("a refused credential keeps what was typed and says why", async () => {
  const value = one("signin-value")
  value.value = "eyJhbGciOi.expired-yesterday"
  const before = server.calls.length
  click(one("signin-submit"))
  await settle(8)

  const post = server.calls
    .slice(before)
    .find((call) => call.method === "POST" && call.path === "/libraries/auth")
  assert.ok(post, "Sign in never reached the server")
  // The URL the add was refused for, not the origin: the origin's front page
  // can be public while the page under it is not.
  assert.equal(post.body?.url, WALL.url, "the sign-in posted something other than the walled URL")
  assert.equal(post.body?.scheme, "bearer")
  assert.equal(post.body?.value, "eyJhbGciOi.expired-yesterday")

  const said = one("signin-error")
  assert.ok(said && !said.hidden, "a refused credential said nothing on the surface")
  assert.equal(said.textContent, BAD_CREDENTIAL, `the refusal was reworded: ${said.textContent}`)

  // The two things a refusal must not do: empty the box, or claim a sign-in.
  assert.equal(value.value, "eyJhbGciOi.expired-yesterday", "a refused credential was cleared")
  assert.ok(signInShown(), "the block closed on a refusal, taking the way in with it")
  assert.equal(
    one("signed-in"),
    null,
    "the panel claims a sign-in the server refused"
  )
  assert.equal(row(VAULT.id), null, "the walled library appeared without a working credential")
})

await check("a credential that opens the wall signs in and finishes the add", async () => {
  const value = one("signin-value")
  value.value = OPENS
  toasts.length = 0
  const before = server.calls.length
  click(one("signin-submit"))
  await settle(10)

  /*
   * ORDER, not merely presence. "Signed in" and "added" both being true says
   * nothing about whether the second happened by itself — the designer could
   * have pressed Add again — and the whole point of the replay is that they
   * did not have to.
   */
  const after = server.calls.slice(before)
  const signIn = after.findIndex((call) => call.method === "POST" && call.path === "/libraries/auth")
  const add = after.findIndex((call) => call.method === "POST" && call.path === "/libraries")
  assert.ok(signIn >= 0, "the credential never reached the server")
  assert.ok(add > signIn, "the add the wall refused was not replayed after the sign-in")
  assert.equal(after[add].body?.url, WALL.url, "the replay posted a different link")

  const added = row(VAULT.id)
  assert.ok(added, "the library behind the wall never arrived")
  assert.match(added.textContent, /12 components across 30 stories/)

  assert.equal(signInShown(), false, "the sign-in block stayed open over a completed sign-in")
  assert.equal(value.value, "", "the credential was left in the DOM after it was posted")
  assert.equal(one("url").value, "", "the URL box kept a link that is now a row above it")
  assert.ok(
    toasts.some(([message]) => message.includes(WALL.origin)),
    `nothing said the sign-in worked: ${JSON.stringify(toasts)}`
  )
})

await check("the signed-in origins are listed, and Forget reaches the server", async () => {
  const listed = one("signed-in")
  assert.ok(listed, "the editor holds a credential and says so nowhere")
  assert.equal(listed.getAttribute("data-de-lib-id"), WALL.origin)
  assert.ok(
    listed.textContent.includes(WALL.origin),
    `the row does not name the origin: ${listed.textContent}`
  )
  // Which of the two credentials it is: the fact that explains a later refusal.
  assert.match(listed.textContent, /token/)

  const forget = control("forget", WALL.origin)
  assert.ok(forget, "a stored credential with no way to drop it")
  const before = server.calls.length
  click(forget)
  await settle(8)

  const dropped = server.calls
    .slice(before)
    .find((call) => call.method === "DELETE" && call.path === "/libraries/auth")
  assert.ok(dropped, "Forget never reached the server")
  assert.equal(dropped.body?.origin, WALL.origin, "Forget dropped a different origin")
  assert.deepEqual(server.credentials, [], "the server still holds the credential")

  // Empty draws NOTHING: "signed in to nothing" is furniture in a 260px column.
  assert.equal(one("signed-in"), null, "the forgotten origin is still listed")
  assert.equal(one("signed").hidden, true, "an empty sign-in list is still taking up room")
})

console.log("\nEvery wall is read by its mechanism")

/**
 * Walk a walled link into the block, so a case can read what it drew.
 *
 * Each of these origins is refused for good — the point is the READING, not the
 * sign-in — so the block is dismissed afterwards and the URL box emptied,
 * leaving the section exactly as the previous case left it.
 */
async function refuseAdd(wall) {
  const field = one("url")
  field.value = wall.url
  click(one("url-add"))
  await settle(8)
  assert.ok(signInShown(), `${wall.kind} was refused and offered no way in`)
}

function dismissSignIn() {
  click(one("signin-dismiss"))
  one("url").value = ""
  assert.equal(signInShown(), false, "Not now left the block open")
}

/*
 * The 401, which is the only refusal that carries a realm — and the only wall
 * whose own scheme the wire cannot speak: the credential union is bearer or
 * cookie, because the server refuses to build a header out of a word it does
 * not know. So the token box is what a Basic wall gets, and the block owes the
 * designer a sentence saying what will actually be sent.
 */
await check("a 401 is named as Basic auth, prints its realm and offers the token box", async () => {
  await refuseAdd(BASIC_WALL)

  const block = one("signin")
  assert.match(block.textContent, /HTTP Basic auth/, "a 401 was not named as Basic auth")
  assert.ok(
    block.textContent.includes(BASIC_WALL.origin),
    `the block never names the origin: ${block.textContent}`
  )

  const realm = control("signin-fact-value", "realm")
  assert.equal(realm.textContent, BASIC_WALL.realm, "the realm the 401 named was dropped")
  assert.equal(realm.closest("[hidden]"), null, "the realm is drawn but unreachable")
  assert.ok(control("signin-copy", "realm"), "the realm has no copy button")
  assert.ok(
    control("signin-fact", "audience").hidden,
    "a 401 carries no OAuth client id and the block drew a box for one"
  )

  // The server's sentence AND the editor's, because only this side knows what
  // this side sends. A designer who is told to paste base64 and not told what
  // happens to it has no way to read the refusal that may follow.
  assert.ok(
    block.textContent.includes(BASIC_WALL.hint),
    "the server's own hint did not reach the block"
  )
  assert.match(
    block.textContent,
    /Authorization header/,
    "nothing says what this editor will do with the paste"
  )

  assert.equal(control("signin-scheme", "bearer").getAttribute("aria-pressed"), "true")
  dismissSignIn()
})

/*
 * The bounce to a sign-in page, which names nothing at all: no token format, no
 * client id, no realm. A browser session is the likeliest thing a designer can
 * actually produce for it, so the cookie is what the block has to offer first —
 * and both fact rows have to stay out of the way.
 */
await check("a sign-in redirect offers the cookie, and draws no empty facts", async () => {
  await refuseAdd(REDIRECT_WALL)

  const block = one("signin")
  assert.match(block.textContent, /Sign-in redirect/, "the bounce was not named as a redirect")
  for (const key of ["audience", "realm"]) {
    assert.ok(control("signin-fact", key).hidden, `an empty ${key} was drawn anyway`)
  }

  assert.equal(control("signin-scheme", "cookie").getAttribute("aria-pressed"), "true")
  assert.equal(control("signin-scheme", "bearer").getAttribute("aria-pressed"), "false")
  dismissSignIn()
})

console.log("\nAdding a file from this project")

await check("the local-file fold is shut until it is asked for, and scans when opened", async () => {
  const toggle = one("add-toggle")
  assert.ok(toggle, "a designer can no longer add their own tokens file")
  assert.equal(toggle.getAttribute("aria-expanded"), "false", "the fold is open by default")
  /*
   * "Shut" is asked of the DOM rather than of the flag, and it is asked as
   * `hidden` on an ANCESTOR rather than as absence. The path box is built once
   * and never rebuilt — same invariant as the URL field above — so it is always
   * in the document; what the fold changes is whether anything can reach it,
   * which `hidden` is exactly the statement of.
   */
  assert.ok(
    one("manual-path")?.closest("[hidden]"),
    "the path box is reachable with the fold shut"
  )

  const before = server.calls.length
  click(toggle)
  await settle(8)

  assert.equal(toggle.getAttribute("aria-expanded"), "true")
  assert.ok(
    server.calls.slice(before).some((call) => call.path === "/libraries/available"),
    "the fold never asked the server what this project has in it"
  )
  const candidate = one("candidate")
  assert.ok(candidate, "the scan found a file and the fold drew nothing")
  assert.match(candidate.textContent, /Anchor Icons/)
  assert.match(candidate.textContent, /18 icon drawings/)
  assert.equal(
    one("manual-path").closest("[hidden]"),
    null,
    "the fold was announced as open and left shut"
  )
  assert.ok(one("manual-add"), "a file the scan missed can no longer be added by hand")
})

console.log("\nThe empty state")

await check("with nothing installed it says what turning a library on does", async () => {
  const installed = clone(server.libraries)
  const empty = () => libraries.node.querySelector(".de-lib-empty")
  assert.ok(empty(), "there is no empty state at all")
  assert.equal(empty().hidden, true, "the empty state is showing over a list of libraries")

  server.libraries = []
  await editor.refreshLibraries(API)
  await settle()

  assert.deepEqual(all("library"), [], "the section lists libraries this project does not have")
  assert.equal(empty().hidden, false, "nothing is installed and the section says nothing")
  // Not "press this button": the sentence has to say what pressing it gets you,
  // and it is the only place in the feature that explains what a library IS.
  for (const brought of ["colors", "components", "Design tab"]) {
    assert.ok(
      empty().textContent.includes(brought),
      `the empty state never says a library brings ${brought}: ${empty().textContent}`
    )
  }

  // Scaffolding: the libraries go back, so the file ends where it started.
  server.libraries = installed
  await editor.refreshLibraries(API)
  await settle()
  assert.equal(all("library").length, installed.length, "the borrowed libraries did not come back")
})

// ── DS Lint ────────────────────────────────────────────────────────────────

console.log("\nDS Lint is a section too")

const lint = editor.dsLintSection(context)
right.append(lint.node)
lint.update()
await settle()

const lintHook = (role) => lint.node.querySelector(`[data-de-lint="${role}"]`)

await check("it is a de-section titled DS Lint, with the bespoke header bar gone", () => {
  assert.ok(lint.node.classList.contains("de-section"), "the audit is not in a section")
  assert.equal(titleOf(lint.node), "DS Lint")
  assert.equal(
    lint.node.querySelector(".de-lint-header"),
    null,
    "the panel kept its own header bar inside a section header"
  )
  assert.equal(
    lint.node.querySelector(".de-lint-title"),
    null,
    "the panel is drawing a second title under the section's"
  )
})

await check("Audit is in the body; the checkers dot takes the header's actions slot", () => {
  const audit = lintHook("audit")
  assert.ok(audit, "the audit button is gone")
  // Audit led the group it belongs to out of the header: the two buttons that
  // join it after a run live in the body, and a group split across the fold
  // line is not a group.
  assert.equal(
    audit.closest(".de-section-actions"),
    null,
    "Audit is still riding in the section header"
  )
  assert.ok(audit.closest(".de-lint-controls"), "Audit is not in the button group")

  const info = lintHook("checkers")
  assert.ok(info, "nothing in the header says which checkers run")
  assert.ok(
    info.closest(".de-section-actions"),
    "the checkers dot is in the body rather than in the header's actions slot"
  )
  // The slot stops its own clicks from reaching the fold layer, which is the
  // property that makes it legal to put a control in a header that folds.
  const header = lint.node.querySelector(".de-section-header")
  assert.equal(header.getAttribute("aria-expanded"), null, "the header itself claims a fold state")
  const expanded = () =>
    lint.node.querySelector(".de-section-toggle").getAttribute("aria-expanded")
  const before = expanded()
  click(info)
  assert.equal(expanded(), before, "pressing the checkers dot folded the section")
})

await check("the report keeps every data-de-lint hook it had", async () => {
  // Run it, so the summary has something to count. This fixture answers with no
  // findings — the housing is what this file is about.
  click(lintHook("audit"))
  await settle(8)
  for (const role of ["audit", "summary", "checkers"]) {
    assert.ok(lintHook(role), `the ${role} hook did not survive the move into a section`)
  }
  assert.match(lintHook("summary").textContent, /issues/, "the summary line says nothing")

  // This fixture's audit finds nothing, which is exactly the state in which the
  // other two must NOT be on screen. `lint-marker-cases.mjs` owns the case where
  // they are. Asserting it here as well is cheap and keeps the two files from
  // disagreeing about when the group grows.
  for (const role of ["fix-all", "hide-markers"]) {
    assert.equal(lintHook(role), null, `${role} is offered with no findings to act on`)
  }
})

// ── The tab ────────────────────────────────────────────────────────────────

console.log("\nThe tab holds both, in that order")

await check("designSystemTab renders Libraries then DS Lint", () => {
  const tab = editor.designSystemTab(context)
  assert.ok(tab.node, "the tab has no node")
  assert.equal(typeof tab.update, "function", "the tab does not answer the InspectorTab shape")

  const titles = Array.from(tab.node.querySelectorAll(".de-section-title")).map((node) =>
    node.textContent.trim()
  )
  assert.deepEqual(
    titles,
    ["Libraries", "DS Lint"],
    // The vocabulary before the corrections: a tab that lists what is wrong
    // above what the project measures itself against reads backwards.
    `the tab's sections are ${JSON.stringify(titles)}`
  )

  // And `update()` reaches both, which is what tab activation relies on.
  tab.update()
  assert.ok(
    tab.node.querySelector('[data-de-lib="url"]'),
    "the Libraries section did not render into the tab"
  )
  assert.ok(
    tab.node.querySelector('[data-de-lint="audit"]'),
    "the DS Lint section did not render into the tab"
  )
})

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
