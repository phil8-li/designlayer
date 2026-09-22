/**
 * Adding a design system by pasting a URL: what is probed, what is parsed, and
 * what a sign-in wall does to both.
 *
 * Every other library kind is a file this process can open, so its test is a
 * string and a parser. This one is a conversation with somebody else's server,
 * and that makes three things worth pinning that no other suite has to think
 * about:
 *
 *  - **the suite runs offline, always.** `fetchImpl` and `runHelper` are
 *    injected, so nothing here touches the network. That is not tidiness: a
 *    suite allowed to reach the real internet fails on a plane, fails behind a
 *    proxy, and silently changes meaning the day somebody redeploys the site it
 *    points at. Every host below is a documentation domain reserved by RFC 2606
 *    and RFC 6761, so none of them can ever resolve to a real server either;
 *  - **a sign-in wall is the normal case, and it arrives disguised as success.**
 *    Most catalogs worth pointing this at belong to some organisation, and a
 *    refused request mostly does not fail the way a refused request is supposed
 *    to: a `fetch` that follows redirects answers HTTP 200 with a body, and the
 *    body is a login page. So the detection works off the BODY as well as off
 *    the redirect, because following the redirect is exactly what hides the 302.
 *    Left undetected, this feature installs a "library" containing the sign-in
 *    form, reports success, and gives the designer no way to see what happened;
 *  - **cross-origin is the line between a handoff and ordinary routing.** A site
 *    that redirects to its own `/login` is routing inside itself and is not a
 *    wall; a site that sends the request to another host has handed it to an
 *    identity provider. Getting that backwards would refuse to install public
 *    sites for the crime of having a login page.
 *
 * The probe ordering is pinned for a related reason. A designer pastes the page
 * they are reading, which is several levels below the story index describing
 * the whole system, so the walk goes deepest-first and ends at the bare origin.
 * Reverse that order and a Storybook mounted at `/atlas` is found only after
 * the origin has been asked — which on a site that serves its app shell for
 * every path means it is never found at all.
 *
 * The store cases at the end go through a REAL `createLibraryStore` against a
 * real temp directory, because the rules they check are rules about
 * persistence: a URL that could not be READ is installed anyway, carrying its
 * sentence, and a URL that could not be SEEN AT ALL is refused outright.
 *
 * Usage: node designlayer/test/library-url-cases.mjs
 */

import assert from "node:assert/strict"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import { resolveConfig } from "../config.mjs"
import { classifyWall } from "../server/library-auth.mjs"
import { createLibraryStore } from "../server/libraries.mjs"
import {
  URL_SOURCE_KIND,
  catalogProbes,
  componentFromPage,
  fetchLibraryUrl,
  isLibraryUrl,
  libraryNameFromUrl,
  looksLikeSsoWall,
  parseStorybookIndex,
  parseUrlLibrary,
} from "../server/library-url.mjs"

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

/* ---------- two kinds of site, and the provider they hand off to ---------- */

/**
 * A Storybook on a platform that mints its own subdomains. The host is a
 * deployment artefact and says nothing about the design system; the path does.
 */
const STORYBOOK_ORIGIN = "https://storybook-7f3a29b4-uc.example.net"
const STORYBOOK_URL = `${STORYBOOK_ORIGIN}/atlas/primitives/avatar`

/** A documentation site named after the system it documents. */
const DOCS_ORIGIN = "https://design-system.example.com"
const DOCS_URL = `${DOCS_ORIGIN}/toolkit/components/split-button`

/** Somebody else's host: the identity provider these sites hand off to. */
const IDP_ORIGIN = "https://login.example.org"

/** Storybook v7+: `entries`, keyed by `title`, with a docs entry beside the stories. */
const INDEX_V4 = {
  v: 5,
  entries: {
    "primitives-avatar--docs": {
      id: "primitives-avatar--docs",
      title: "Primitives/Avatar",
      name: "Docs",
      importPath: "./src/avatar/avatar.stories.ts",
      type: "docs",
    },
    "primitives-avatar--default": {
      id: "primitives-avatar--default",
      title: "Primitives/Avatar",
      name: "Default",
      importPath: "./src/avatar/avatar.stories.ts",
      type: "story",
    },
    "primitives-avatar--with-image": {
      id: "primitives-avatar--with-image",
      title: "Primitives/Avatar",
      name: "With image",
      importPath: "./src/avatar/avatar.stories.ts",
      type: "story",
    },
    "primitives-badge--default": {
      id: "primitives-badge--default",
      title: "Primitives/Badge",
      name: "Default",
      importPath: "./src/badge/badge.stories.ts",
      type: "story",
    },
  },
}

/** Storybook v6: `stories`, keyed by `kind`, docs flagged in `parameters`. */
const INDEX_V3 = {
  v: 3,
  stories: {
    "primitives-avatar--page": {
      id: "primitives-avatar--page",
      kind: "Primitives/Avatar",
      name: "Page",
      importPath: "./src/avatar/avatar.stories.ts",
      parameters: { docsOnly: true },
    },
    "primitives-avatar--default": {
      id: "primitives-avatar--default",
      kind: "Primitives/Avatar",
      name: "Default",
      importPath: "./src/avatar/avatar.stories.ts",
      parameters: {},
    },
    "primitives-avatar--with-image": {
      id: "primitives-avatar--with-image",
      kind: "Primitives/Avatar",
      name: "With image",
      importPath: "./src/avatar/avatar.stories.ts",
      parameters: {},
    },
    "primitives-badge--default": {
      id: "primitives-badge--default",
      kind: "Primitives/Badge",
      name: "Default",
      importPath: "./src/badge/badge.stories.ts",
      parameters: {},
    },
  },
}

/**
 * What a walled site serves once its redirect has been followed: HTTP 200,
 * `text/html`, and a login form. The password input is the evidence, because
 * the status line has none left.
 */
const LOGIN_PAGE = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Sign in</title></head>
<body>
<form method="post" action="/session">
  <label>Email <input type="email" name="email" autocomplete="username"></label>
  <label>Password <input type="password" name="password"></label>
  <button type="submit">Sign in</button>
</form>
</body></html>`

/** An OAuth 2.0 authorization request, with the parameters RFC 6749 requires. */
const OAUTH_LOCATION =
  `${IDP_ORIGIN}/oauth2/authorize` +
  "?client_id=a1b2c3d4-5e6f-4071-8abc-9d0e1f2a3b4c" +
  "&response_type=code" +
  "&scope=openid+email" +
  `&redirect_uri=${encodeURIComponent(`${STORYBOOK_ORIGIN}/oauth2/callback`)}`

const DOCS_PAGE = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<title>Design system web components</title>
<meta name="description" content="Split button: a primary action with a menu of related actions.">
</head><body><ds-split-button></ds-split-button></body></html>`

/**
 * A fake `fetch` over a recorded map of URL to response. 404 for anything else.
 *
 * The headers come back as a real `Headers`, which is what `fetch` returns and
 * what the code under test reads the challenge out of: a response whose headers
 * are a plain object still yields its content type and its `Location`, but its
 * full header set — `WWW-Authenticate` included — does not survive the trip.
 * A fake that took the easier shape would quietly test a narrower module than
 * the one that ships.
 */
function fakeFetch(routes) {
  return async (url) => {
    const recorded = routes[String(url)]
    const response = recorded ?? { status: 404, headers: { "content-type": "text/html" }, body: "" }
    return {
      status: response.status,
      headers: new Headers(response.headers ?? {}),
      text: async () => response.body ?? "",
    }
  }
}

/**
 * No helper command configured, which is the default and the ordinary case.
 *
 * `runHelper` is how a project points the editor at whatever command-line
 * client its own proxy needs — the editor ships knowing none of them. Unset,
 * there is no second route out of a wall, and the caller reports the wall.
 */
const noHelper = async () => null

const offline = (routes) => ({ fetchImpl: fakeFetch(routes), runHelper: noHelper })

const json = (body) => ({
  status: 200,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
})

const html = (body, status = 200) => ({
  status,
  headers: { "content-type": "text/html" },
  body,
})

// ── Naming ─────────────────────────────────────────────────────────────────

console.log("\nWhat a URL is called")

check("only http and https are library URLs", () => {
  assert.equal(isLibraryUrl(STORYBOOK_URL), true)
  assert.equal(isLibraryUrl("http://localhost:6006/"), true)
  assert.equal(isLibraryUrl("file:///etc/passwd"), false)
  assert.equal(isLibraryUrl("src/styles/theme.css"), false)
  assert.equal(isLibraryUrl(""), false)
  assert.equal(isLibraryUrl(null), false)
})

/*
 * The host wins when it says something, and loses to the path when it is a
 * deployment artefact. `design-system.example.com` is the system's own name;
 * `storybook-7f3a29b4-uc.example.net` is what a hosting platform handed out, and
 * naming a library after it would put a build hash in the panel.
 */
check("a URL is named after whichever of the host and the path is a name", () => {
  assert.equal(libraryNameFromUrl(DOCS_URL), "Design system")
  assert.equal(libraryNameFromUrl(STORYBOOK_URL), "Atlas")
})

// ── Probing ────────────────────────────────────────────────────────────────

console.log("\nWhere the catalog might be")

check("a deep URL is probed deepest-first, with the bare origin last", () => {
  assert.deepEqual(catalogProbes(STORYBOOK_URL), [
    `${STORYBOOK_ORIGIN}/atlas/primitives/avatar/index.json`,
    `${STORYBOOK_ORIGIN}/atlas/primitives/avatar/stories.json`,
    `${STORYBOOK_ORIGIN}/atlas/primitives/index.json`,
    `${STORYBOOK_ORIGIN}/atlas/primitives/stories.json`,
    `${STORYBOOK_ORIGIN}/atlas/index.json`,
    `${STORYBOOK_ORIGIN}/atlas/stories.json`,
    `${STORYBOOK_ORIGIN}/index.json`,
    `${STORYBOOK_ORIGIN}/stories.json`,
  ])
})

check("a URL that already names a JSON file is its own first probe", () => {
  const probes = catalogProbes("https://example.com/design/tokens.json")
  assert.equal(probes[0], "https://example.com/design/tokens.json")
  assert.equal(probes[probes.length - 1], "https://example.com/stories.json")
})

// ── Storybook ──────────────────────────────────────────────────────────────

console.log("\nReading a story index")

/*
 * A story index is a flat list of STORIES and a designer thinks in components,
 * so the collapse onto `title` is the whole translation. Left flat, one
 * component with a dozen variants is a dozen near-identical rows.
 */
check("a v4 index groups stories by title and keeps the names as variants", () => {
  const parsed = parseStorybookIndex(INDEX_V4)
  assert.equal(parsed.components.length, 2)

  const [avatar, badge] = parsed.components
  assert.equal(avatar.id, "component:primitives-avatar")
  assert.equal(avatar.name, "Avatar")
  assert.equal(avatar.group, "Primitives")
  assert.equal(avatar.file, "./src/avatar/avatar.stories.ts")
  assert.deepEqual(avatar.props, [
    { name: "Story", type: "variant", values: ["Default", "With image"], default: "Default" },
  ])
  assert.equal(badge.name, "Badge")
  assert.deepEqual(badge.props?.[0].values, ["Default"])
})

/*
 * `kind` is v3's word for `title` and `parameters.docsOnly` is its word for
 * `type: "docs"`. Two dialects of one fact, so they have to produce one answer
 * — a project that has not upgraded Storybook is not a project with a different
 * design system.
 */
check("a v3 stories.json reads to exactly the same shape through `kind`", () => {
  const fourth = parseStorybookIndex(INDEX_V4)
  const third = parseStorybookIndex(INDEX_V3)
  assert.deepEqual(third, fourth)
})

check("JSON that is not a story index is refused rather than guessed at", () => {
  assert.equal(parseStorybookIndex({ color: { brand: { $value: "#0b57d0" } } }), null)
  assert.equal(parseStorybookIndex([]), null)
  assert.equal(parseStorybookIndex(null), null)
  // `entries` present but carrying no titles is not an index either.
  assert.equal(parseStorybookIndex({ v: 4, entries: { a: { id: "a" } } }), null)
})

// ── Sign-in walls ──────────────────────────────────────────────────────────

console.log("\nTelling a login page from a design system")

/*
 * The 200 case is the one that matters. A `fetch` that follows redirects turns
 * the 302 into a successful-looking HTML page, and every marker of what went
 * wrong is left in the body. Miss it and the editor installs somebody's sign-in
 * form as a design system, with a green checkmark next to it.
 */
check("a 200 HTML body carrying a password input is a wall", () => {
  assert.equal(
    looksLikeSsoWall({ status: 200, contentType: "text/html", text: LOGIN_PAGE }, STORYBOOK_URL),
    true
  )
})

check("a cross-origin 302 to a sign-in service is a wall", () => {
  assert.equal(
    looksLikeSsoWall(
      {
        status: 302,
        contentType: "text/html; charset=UTF-8",
        text: "",
        location: `${IDP_ORIGIN}/sso/request?continue=${encodeURIComponent(DOCS_URL)}`,
      },
      DOCS_URL
    ),
    true
  )
  // And so is the OAuth flavour of the same hop.
  assert.equal(
    looksLikeSsoWall(
      { status: 302, contentType: "text/html", text: "", location: OAUTH_LOCATION },
      STORYBOOK_URL
    ),
    true
  )
})

/*
 * THE BOUNDARY that the cross-origin rule exists to draw. A site redirecting to
 * its own login page is routing inside itself: plenty of perfectly public
 * documentation sites bounce an anonymous visitor to `/login` and then serve
 * them anyway, and reading that as a refusal would make the editor decline to
 * install them with an error blaming the site.
 */
check("a same-origin redirect to /login is routing, not a wall", () => {
  for (const location of [
    "/login",
    `${DOCS_ORIGIN}/login?next=%2Ftoolkit`,
    `${DOCS_ORIGIN}/signin`,
    `${DOCS_ORIGIN}/oauth2/authorize?response_type=code&client_id=a1b2c3d4`,
  ]) {
    assert.equal(
      looksLikeSsoWall({ status: 302, contentType: "text/html", text: "", location }, DOCS_URL),
      false,
      location
    )
  }
})

check("a 401 is a wall whatever its body says, and so is a 403", () => {
  assert.equal(
    looksLikeSsoWall(
      {
        status: 401,
        contentType: "text/html",
        text: "Not authorized",
        headers: { "www-authenticate": "Bearer" },
      },
      STORYBOOK_URL
    ),
    true
  )
  assert.equal(
    looksLikeSsoWall(
      {
        status: 401,
        contentType: "text/html",
        text: "",
        headers: { "www-authenticate": 'Basic realm="Docs"' },
      },
      DOCS_URL
    ),
    true
  )
  assert.equal(
    looksLikeSsoWall({ status: 403, contentType: "text/html", text: "Forbidden" }, DOCS_URL),
    true
  )
})

check("real JSON is not a wall", () => {
  assert.equal(
    looksLikeSsoWall(
      { status: 200, contentType: "application/json", text: JSON.stringify(INDEX_V4) },
      STORYBOOK_URL
    ),
    false
  )
  assert.equal(
    looksLikeSsoWall({ status: 200, contentType: "text/html", text: DOCS_PAGE }, DOCS_URL),
    false
  )
})

// ── The page itself ────────────────────────────────────────────────────────

console.log("\nThe last-resort page parse")

/*
 * One component is the honest answer for a page about one component, and it is
 * what makes pasting a deep link useful at all. The URL is the evidence rather
 * than the markup: every documentation site renders its own chrome, and no
 * scrape of the DOM survives a redesign, while the path segments are the site's
 * own information architecture.
 */
check("a component documentation page names one component from its path", () => {
  const component = componentFromPage(DOCS_URL, DOCS_PAGE)
  assert.equal(component.id, "component:split-button")
  assert.equal(component.name, "Split button")
  assert.equal(component.group, "Components")
  assert.equal(component.description, "Split button: a primary action with a menu of related actions.")
  assert.equal(component.file, DOCS_URL)
})

check("a bare origin, and anything that is not HTML, names nothing", () => {
  assert.equal(componentFromPage("https://example.com/", DOCS_PAGE), null)
  assert.equal(componentFromPage(DOCS_URL, '{"v":4}'), null)
  assert.equal(componentFromPage(DOCS_URL, null), null)
})

// ── Fetching ───────────────────────────────────────────────────────────────

console.log("\nFetching, redirecting and being refused")

await checkAsync("a plain redirect is followed; a login page is refused", async () => {
  const followed = await fetchLibraryUrl("https://example.com/atlas", {
    ...offline({
      "https://example.com/atlas": {
        status: 301,
        headers: { location: "https://example.com/atlas/" },
        body: "",
      },
      "https://example.com/atlas/": json(INDEX_V4),
    }),
  })
  assert.equal(followed.ok, true)
  assert.equal(followed.sso, false)
  assert.equal(followed.viaHelper, false)

  const walled = await fetchLibraryUrl(STORYBOOK_URL, {
    ...offline({ [STORYBOOK_URL]: html(LOGIN_PAGE) }),
  })
  assert.equal(walled.ok, false)
  assert.equal(walled.sso, true)
  assert.equal(walled.wall.kind, "redirect")
  assert.equal(walled.wall.origin, STORYBOOK_ORIGIN)
  assert.match(walled.error, /sign-in/i)
})

await checkAsync("a 401 comes back as the challenge the site actually sent", async () => {
  const refused = await fetchLibraryUrl(DOCS_URL, {
    ...offline({
      [DOCS_URL]: {
        status: 401,
        headers: { "content-type": "text/html", "www-authenticate": 'Basic realm="Docs"' },
        body: "Unauthorized",
      },
    }),
  })
  assert.equal(refused.ok, false)
  assert.equal(refused.sso, true)
  assert.equal(refused.wall.kind, "basic")
  assert.equal(refused.wall.realm, "Docs")
  assert.equal(refused.wall.origin, DOCS_ORIGIN)
})

/*
 * The project's own escape hatch. Some organisations front their internal docs
 * with a proxy that has a command-line client — a signed-request tool, a
 * VPN-aware curl wrapper, a credential helper — and the editor has no business
 * knowing which, so it knows none of them: the project names a command in its
 * config and the editor runs it when a fetch is refused. The rescue is recorded
 * on the response, because an answer that came back by a different route is
 * worth being able to see.
 */
await checkAsync("a wall the project's helper command can get through sets viaHelper", async () => {
  const rescued = await fetchLibraryUrl(DOCS_URL, {
    fetchImpl: fakeFetch({
      [DOCS_URL]: {
        status: 401,
        headers: { "content-type": "text/html", "www-authenticate": "Bearer" },
        body: "",
      },
    }),
    runHelper: async () => ({ status: 200, contentType: "text/html", text: DOCS_PAGE }),
  })
  assert.equal(rescued.ok, true)
  assert.equal(rescued.viaHelper, true)
  assert.equal(rescued.sso, false)
  assert.equal(rescued.text, DOCS_PAGE)
})

/*
 * FIXED, and kept as the guard — this was a real bug and a subtle one.
 *
 * `fetchLibraryUrl` tests the same response for a wall twice: once inside the
 * redirect loop and once after it. The second test was written without the
 * request URL, and the URL is not decorative — it is how `classifyWall` tells a
 * cross-origin handoff from an app routing to its own login page. So the second
 * test could not see any wall whose evidence is cross-origin: an OAuth 302, a
 * sign-in bounce, or a 200 embedding an authorization URL.
 *
 * The loop stopped at the wall correctly and the code after it then denied
 * there was one. The caller got `sso: false`, no `wall`, and "redirected more
 * times than this editor will follow" — a sentence about redirect limits, for a
 * request refused on its first hop. The panel had no challenge to act on, the
 * store installed the login page as a library instead of refusing it, and the
 * OAuth `client_id`, which is the whole payload of the feature, never reached
 * the designer.
 *
 * The fix was one argument. The case stays because nothing else would notice it
 * coming back: every symptom is a plausible-looking message about redirects.
 */
await checkAsync("a cross-origin OAuth 302 is read, and its audience survives", async () => {
  const record = {
    status: 302,
    contentType: "text/html",
    text: "",
    headers: { location: OAUTH_LOCATION, "content-type": "text/html" },
  }

  // The classifier is right, and it is right only because it was given the URL.
  const read = classifyWall(record, STORYBOOK_URL)
  assert.equal(read.kind, "oauth")
  assert.equal(read.audience, "a1b2c3d4-5e6f-4071-8abc-9d0e1f2a3b4c")
  assert.equal(classifyWall(record, ""), null, "without the URL there is nothing to compare")

  // And the caller is told the same thing the classifier saw.
  const refused = await fetchLibraryUrl(STORYBOOK_URL, {
    ...offline({
      [STORYBOOK_URL]: {
        status: 302,
        headers: { location: OAUTH_LOCATION, "content-type": "text/html" },
        body: "",
      },
    }),
  })
  assert.equal(refused.ok, false)
  assert.equal(refused.sso, true, "the wall was detected and then unread again")
  assert.equal(refused.wall?.kind, "oauth")
  assert.equal(refused.wall?.audience, "a1b2c3d4-5e6f-4071-8abc-9d0e1f2a3b4c")
  // The redirect-limit sentence is what this bug used to produce. It must not
  // come back for a request that was refused on its first hop.
  assert.doesNotMatch(refused.error, /redirected more times/)
})

// ── The whole job ──────────────────────────────────────────────────────────

console.log("\nEnd to end, offline")

await checkAsync("a Storybook deep link resolves to the system's whole catalog", async () => {
  const result = await parseUrlLibrary(
    STORYBOOK_URL,
    offline({ [`${STORYBOOK_ORIGIN}/atlas/index.json`]: json(INDEX_V4) })
  )
  assert.equal(result.error, "")
  assert.equal(result.name, "Atlas")
  assert.deepEqual(
    result.catalog.components.map((component) => component.name),
    ["Avatar", "Badge"]
  )
  assert.equal(result.detail, "2 components · 3 variants")
})

/*
 * A token file served over HTTP has to read exactly as the same file on disk
 * does, which is why this branch hands the text to `library-sources.mjs` rather
 * than parsing it again. A second DTCG reader is how a designer who moves a
 * file behind a URL silently loses half their tokens.
 */
await checkAsync("a token file at a URL is read by the parsers the file path uses", async () => {
  const tokens = {
    color: { brand: { $type: "color", $value: "#0b57d0" } },
    space: { md: { $type: "dimension", $value: "16px" } },
  }
  const result = await parseUrlLibrary(
    "https://example.com/design/tokens.json",
    offline({ "https://example.com/design/tokens.json": json(tokens) })
  )
  assert.equal(result.error, "")
  assert.equal(result.catalog.colors.length, 1)
  assert.equal(result.catalog.colors[0].values.light, "#0b57d0")
  assert.equal(result.catalog.spacing.length, 1)
  assert.equal(result.detail, "1 color · 1 spacing step")
})

await checkAsync("a page with no story index behind it yields its one component", async () => {
  const result = await parseUrlLibrary(DOCS_URL, offline({ [DOCS_URL]: html(DOCS_PAGE) }))
  assert.equal(result.error, "")
  assert.equal(result.detail, "1 component")
  assert.equal(result.catalog.components.length, 1)
  assert.equal(result.catalog.components[0].name, "Split button")
})

/*
 * The failure this feature would otherwise ship. Every probe and the page
 * itself answer 200 with the login page, so nothing here is an HTTP error —
 * the only thing standing between the designer and a design system made of
 * somebody's sign-in form is the body sniff.
 */
await checkAsync("a walled URL parses to an empty catalog and a sentence, not a login page", async () => {
  const nothing = await parseUrlLibrary(STORYBOOK_URL, offline({}))
  assert.equal(nothing.catalog.components.length, 0)
  assert.equal(nothing.auth, null, "a 404 is not a sign-in wall")

  const walled = await parseUrlLibrary(STORYBOOK_URL, {
    fetchImpl: async () => ({
      status: 200,
      headers: { "content-type": "text/html" },
      text: async () => LOGIN_PAGE,
    }),
    runHelper: noHelper,
  })
  assert.equal(walled.catalog.components.length, 0)
  assert.equal(walled.auth.kind, "redirect")
  assert.equal(walled.auth.origin, STORYBOOK_ORIGIN)
  assert.match(walled.error, /sign-in/i)
  assert.match(walled.error, /public URL/)
})

// ── The store ──────────────────────────────────────────────────────────────

console.log("\nWhat the store does with a URL")

/** A throwaway project, so the pointer file has somewhere real to live. */
async function project(urlOptions) {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "de-library-url-")))
  await fs.writeFile(
    path.join(root, "package.json"),
    '{ "name": "temp-host", "version": "0.0.0" }\n',
    "utf8"
  )
  const config = resolveConfig({ projectRoot: root }, { cwd: root })
  return {
    config,
    store: createLibraryStore(config, urlOptions),
    stateFile: path.join(config.stateDir, "libraries.json"),
    cleanup: () => fs.rm(root, { recursive: true, force: true }),
  }
}

/** The pointer file as it is on disk, or `[]` when nothing has written it. */
async function storedLibraries(context) {
  try {
    const parsed = JSON.parse(await fs.readFile(context.stateFile, "utf8"))
    return Array.isArray(parsed?.libraries) ? parsed.libraries : []
  } catch {
    return []
  }
}

/*
 * A sign-in wall is the one URL failure that is REFUSED rather than installed,
 * and the distinction is worth stating because the two neighbours go the other
 * way. A URL that times out or answers 500 gets a row: those reasons change
 * while the editor is open, and the row is what carries the retry and the
 * removal. A URL behind a wall gets nothing, because a row named after a site
 * and reporting zero components is a lie in the only way that matters — a
 * designer reading it concludes their design system is empty when the truth is
 * that they are signed out.
 *
 * So the refusal has to carry the challenge with it: `error.auth` is what lets
 * the panel offer a way in instead of just reporting a failure.
 */
await checkAsync("an SSO-walled URL is refused, and never reaches the list", async () => {
  const context = await project(offline({ [STORYBOOK_URL]: html(LOGIN_PAGE) }))
  try {
    await assert.rejects(context.store.add({ url: STORYBOOK_URL }), (error) => {
      assert.equal(error.statusCode, 400)
      assert.match(error.message, /sign-in/i)
      assert.equal(error.auth.kind, "redirect")
      assert.equal(error.auth.origin, STORYBOOK_ORIGIN)
      assert.equal(error.auth.url, STORYBOOK_URL)
      assert.ok(error.auth.hint, "a challenge with no hint gives the panel nothing to say")
      return true
    })

    // Nothing in the answer, and nothing in the file behind it.
    assert.deepEqual((await context.store.list()).libraries, [])
    assert.deepEqual(await storedLibraries(context), [])
  } finally {
    await context.cleanup()
  }
})

/*
 * The neighbouring case, so the rule above reads as a line and not as a blanket
 * refusal: a URL the editor could reach and could not understand is installed,
 * with its sentence on it.
 */
await checkAsync("a URL that answered with nothing useful is installed anyway", async () => {
  // A bare origin serving a home page: reachable, readable, and not a design
  // system. There is no component to read off a path with no segments in it.
  const homepage = "https://docs.example.org/"
  const context = await project(
    offline({ [homepage]: html("<!doctype html><html><body><h1>Welcome</h1></body></html>") })
  )
  try {
    const { library } = await context.store.add({ url: homepage })
    assert.equal(library.source.kind, URL_SOURCE_KIND)
    assert.equal(library.source.path, homepage)
    assert.equal(library.enabled, true)
    assert.ok(library.error, "a library that read as nothing said nothing about it")
    assert.doesNotMatch(library.error, /sign-in/i)
    assert.deepEqual(
      Object.values(library.counts).filter((count) => count !== 0),
      []
    )

    // And it survives a round trip through the pointer file, error included.
    const { libraries } = await context.store.list()
    assert.equal(libraries.length, 1)
    assert.equal(libraries[0].source.path, homepage)
    assert.ok(libraries[0].error)
  } finally {
    await context.cleanup()
  }
})

await checkAsync("a URL library caches its catalog and refreshes on request", async () => {
  let served = json(INDEX_V4)
  const context = await project({
    fetchImpl: async (url) => {
      const recorded =
        String(url) === `${STORYBOOK_ORIGIN}/atlas/index.json`
          ? served
          : { status: 404, headers: { "content-type": "text/html" }, body: "" }
      return {
        status: recorded.status,
        headers: recorded.headers,
        text: async () => recorded.body,
      }
    },
    runHelper: noHelper,
  })
  try {
    const { library } = await context.store.add({ url: STORYBOOK_URL })
    assert.equal(library.counts.components, 2)
    assert.equal(library.detail, "2 components · 3 variants")

    // The catalog is IN the file: this is the one kind that is not re-parsed on
    // every `list()`, because re-reading it means a network round trip.
    const stored = JSON.parse(await fs.readFile(context.stateFile, "utf8"))
    assert.equal(stored.libraries[0].catalog.components.length, 2)

    // So the site changing under the editor is invisible until somebody asks.
    served = json({ v: 5, entries: {} })
    assert.equal((await context.store.list()).libraries[0].counts.components, 2)

    const refreshed = await context.store.update(library.id, { refresh: true })
    assert.equal(refreshed.library.counts.components, 0)
    assert.ok(refreshed.library.error, "a refresh that found nothing said nothing about it")
    assert.match(refreshed.library.error, /Check the address/)
  } finally {
    await context.cleanup()
  }
})

await checkAsync("a url is refused when it is not one, and the same page adds once", async () => {
  const context = await project(offline({ [DOCS_URL]: html(DOCS_PAGE) }))
  try {
    await assert.rejects(context.store.add({ url: "ftp://example.com/tokens.json" }), (error) => {
      assert.equal(error.statusCode, 400)
      assert.match(error.message, /https?:\/\//)
      return true
    })

    const first = await context.store.add({ url: DOCS_URL })
    const again = await context.store.add({ url: DOCS_URL })
    assert.equal(first.library.id, again.library.id)
    assert.equal((await context.store.list()).libraries.length, 1)

    // `url` is a kind, but it is not a kind a PATH can be.
    await assert.rejects(
      context.store.add({ path: "package.json", kind: "url" }),
      (error) => error.statusCode === 400
    )
  } finally {
    await context.cleanup()
  }
})

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
