/**
 * The parsing brain behind added libraries: four file formats in, one catalog
 * shape out.
 *
 * `server/library-sources.mjs` is pure — no filesystem, no config, no store —
 * and that is the whole reason it exists as its own module. Everything a
 * library ever contributes to the inspector is decided here, so the things
 * worth pinning are the ones that would silently change what a designer's own
 * stylesheet is understood to MEAN:
 *
 *  - detection is ordered, and the order is load-bearing. A Figma-style
 *    manifest's spacing tokens are `{ name, value }` objects, which is also
 *    exactly what a Style Dictionary leaf looks like. Read the file as DTCG and
 *    every colour keeps its `cssVar` but loses its theme pair, the text styles
 *    vanish, and nothing throws — the library just quietly brings less than it
 *    has. Only the rule ORDER stops that, so it is asserted rather than assumed;
 *  - the CSS classifier is the feature's real surface area. A host who writes
 *    `--border-color` and a host who writes `--color-border` are both right,
 *    `1rem` and `16px` are the same spacing step, and a Tailwind v4 text style
 *    is FOUR declarations that have to collapse into ONE token or the picker
 *    offers a designer four rows for one decision. Each of those is one rule,
 *    and each one is a token that appears or does not appear in a picker;
 *  - what is DROPPED matters as much as what is kept. An `ease-*` curve cannot
 *    be written by a motion axis that spells itself as a duration, and a font
 *    stack is not a token this editor can bind to anything. Offering either
 *    would put a row in the inspector that writes nothing and reports success;
 *  - the manifest path DELEGATES. `server/design-system-manifest.mjs` already
 *    normalizes this exact shape for the host's own design system, and a second
 *    implementation of it is how a library's colours come to differ from the
 *    host's for the same input. The colour assertion here compares against that
 *    function's own output, so a reimplementation fails even if it is correct;
 *  - malformation is not absence. A group a source does not have is `[]`; a
 *    group that is present and the wrong shape throws. Half a catalog installed
 *    silently is worse than a refused file, because the designer has no way to
 *    tell which half is missing.
 *
 * No server and no filesystem writes: the fixtures under `fixtures/libraries/`
 * are read as text and handed straight to the parsers, which is also what makes
 * them readable as the documentation of what each format is allowed to contain.
 *
 * Usage: node designlayer/test/library-source-cases.mjs
 */

import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

import { normalizeDesignSystemManifest } from "../server/design-system-manifest.mjs"
import {
  LIBRARY_SOURCE_KINDS,
  describeLibrary,
  detectLibraryKind,
  libraryCounts,
  libraryId,
  parseLibrary,
} from "../server/library-sources.mjs"

import { PACKAGE_DIR } from "./host.mjs"

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

const FIXTURES = path.join(PACKAGE_DIR, "test/fixtures/libraries")
const fixture = (name) => fs.readFileSync(path.join(FIXTURES, name), "utf8")

const MANIFEST = fixture("manifest.json")
const TOKENS = fixture("tokens.json")
const ICONS = fixture("icons.json")
const THEME = fixture("theme.css")

/** Every token in a catalog, whichever group it landed in. */
const allTokens = (catalog) => [
  ...catalog.colors,
  ...catalog.spacing,
  ...catalog.radii,
  ...catalog.textStyles,
  ...catalog.uiTextStyles,
  ...catalog.effects,
  ...catalog.icons,
  ...catalog.motion,
]

const byVar = (group, cssVar) => group.find((token) => token.cssVar === cssVar) ?? null
const byName = (group, name) => group.find((token) => token.name === name) ?? null

// ── Detection ──────────────────────────────────────────────────────────────

console.log("\nWhich kind of file this is")

check("the six kinds are the six the rest of the feature names", () => {
  assert.deepEqual(
    [...LIBRARY_SOURCE_KINDS],
    ["manifest", "css", "tokens", "icons", "components", "url"]
  )
})

check("each fixture is recognised as the format it is written in", () => {
  assert.equal(detectLibraryKind("tokens/meridian.json", MANIFEST), "manifest")
  assert.equal(detectLibraryKind("tokens/dtcg.json", TOKENS), "tokens")
  assert.equal(detectLibraryKind("icons/glyphs.json", ICONS), "icons")
  assert.equal(detectLibraryKind("src/styles/theme.css", THEME), "css")
})

/*
 * The one ordering that is not obvious from either file on its own.
 *
 * A manifest's Spacing collection is `[{ name, cssVar, value }]`, and a Style
 * Dictionary leaf is `{ value }` under a name. Both are true of the manifest
 * fixture at the same time, so rule 3 would claim it if rule 1 did not run
 * first — and the DTCG reading of a manifest throws nothing away loudly. It
 * silently produces a library with no text styles, no effects and no theme
 * pairs, which reads in the panel as a design system that simply has fewer
 * tokens than the designer thought.
 */
check("a manifest is a manifest even though its tokens also read as DTCG", () => {
  assert.equal(detectLibraryKind("anything.json", MANIFEST), "manifest")
  const manifest = JSON.parse(MANIFEST)
  assert.ok(
    manifest.collections.some((collection) =>
      collection.tokens.some((token) => "value" in token)
    ),
    "the fixture no longer contains the `value` leaves that make this ambiguous"
  )
})

check("only the five manifest marker keys claim a JSON file", () => {
  for (const key of ["collections", "textStyles", "effectStyles", "iconScale", "motion"]) {
    assert.equal(
      detectLibraryKind("x.json", JSON.stringify({ [key]: [] })),
      "manifest",
      `${key} did not mark the file as a manifest`
    )
  }
})

check("a file that is not a design system is not a library", () => {
  assert.equal(
    detectLibraryKind("README.md", "# Nimbus\n\nA design system for the web.\n"),
    null
  )
  // Three custom properties is a component's local variables, not a system.
  assert.equal(
    detectLibraryKind(
      "src/card.css",
      ".card {\n  --card-pad: 8px;\n  --card-gap: 4px;\n  --card-bg: #fff;\n}\n"
    ),
    null
  )
  assert.equal(
    detectLibraryKind("package.json", '{"name":"app","version":"1.0.0","scripts":{"dev":"next"}}'),
    null
  )
  assert.equal(detectLibraryKind("broken.json", "{ not json"), null)
})

check("the fourth custom property is what turns a stylesheet into a library", () => {
  const three = ":root {\n  --a-color: #fff;\n  --b-color: #000;\n  --c-color: #111;\n}\n"
  assert.equal(detectLibraryKind("t.css", three), null)
  assert.equal(detectLibraryKind("t.css", three.replace("}", "  --d-color: #222;\n}")), "css")
})

// ── Identity ───────────────────────────────────────────────────────────────

console.log("\nThe id a library is known by")

check("a path slugs to lowercase, dash-joined, untrimmed of nothing else", () => {
  assert.equal(libraryId("src/styles/tokens.css"), "src-styles-tokens-css")
  assert.equal(libraryId("Design/Tokens (v2).JSON"), "design-tokens-v2-json")
  assert.equal(libraryId("./packages/ui/theme.css"), "packages-ui-theme-css")
  assert.equal(libraryId("_private/@scope/icons.json"), "private-scope-icons-json")
})

check("a path with nothing sluggable in it is refused rather than given an empty id", () => {
  assert.throws(() => libraryId("///"))
  assert.throws(() => libraryId(""))
})

/*
 * Ids are the keys of the installed list AND the prefix that keeps two
 * libraries' identically-named tokens apart, so a collision is not a cosmetic
 * problem: adding the second library would silently overwrite the first.
 *
 * This asserts the paths a real project produces, not every path that exists.
 * The slug is lossy by construction — `src/a-b.css` and `src/a/b.css` both
 * reduce to `src-a-b-css` — so "never collides" cannot be true of all inputs,
 * only of inputs that differ somewhere the slug can see.
 */
check("the paths a real project ships do not collide with each other", () => {
  const paths = [
    "src/styles/tokens.css",
    "src/styles/theme.css",
    "packages/ui/tokens.css",
    "design/tokens.json",
    "design/icons.json",
    "tokens.json",
  ]
  const ids = paths.map(libraryId)
  assert.equal(new Set(ids).size, ids.length, `two of ${ids.join(", ")} are the same library`)
})

// ── CSS ────────────────────────────────────────────────────────────────────

console.log("\nA design system written as CSS custom properties")

const nimbus = parseLibrary("css", THEME, { name: "Nimbus" })

check("the given name is the catalog's, and a CSS file brings no components", () => {
  assert.equal(nimbus.name, "Nimbus")
  assert.deepEqual(nimbus.uiTextStyles, [])
  assert.deepEqual(nimbus.components, [])
  assert.deepEqual(nimbus.iconDrawings, [])
  assert.equal(nimbus.iconAttribute, "")
})

check("every property lands in the group its name claims", () => {
  assert.deepEqual(
    nimbus.colors.map((token) => token.cssVar),
    ["--color-brand-500", "--color-surface", "--border-color"]
  )
  assert.deepEqual(
    nimbus.spacing.map((token) => token.cssVar),
    ["--spacing-sm", "--spacing-md", "--space-xs"]
  )
  assert.deepEqual(nimbus.radii.map((token) => token.cssVar), ["--radius-card"])
  assert.deepEqual(nimbus.effects.map((token) => token.cssVar), ["--shadow-card"])
  assert.deepEqual(nimbus.icons.map((token) => token.cssVar), ["--icon-size-action"])
  // `--icon-size-action` must not be read as a `size-` spacing step on its way
  // past the spacing rule, or the icon axis loses its only scale.
  assert.equal(byVar(nimbus.spacing, "--icon-size-action"), null)
})

check("a colour is named by its prefix OR by its suffix, and carries its category", () => {
  const brand = byVar(nimbus.colors, "--color-brand-500")
  assert.equal(brand.name, "brand-500")
  assert.equal(brand.id, "color:brand-500")
  assert.equal(brand.category, "color")
  // The suffix rule is the whole reason this one is a colour at all.
  assert.ok(byVar(nimbus.colors, "--border-color"), "--border-color was not read as a colour")
})

check("a spacing step is pixels, whichever unit it was authored in", () => {
  assert.equal(byVar(nimbus.spacing, "--spacing-sm").values.default, 8)
  assert.equal(byVar(nimbus.spacing, "--spacing-md").values.default, 16)
  assert.equal(byVar(nimbus.spacing, "--space-xs").values.default, 8)
  assert.equal(byVar(nimbus.radii, "--radius-card").values.default, 12)
  assert.equal(byVar(nimbus.icons, "--icon-size-action").values.default, 16)
})

check("a .dark block is a second value for a colour, not a second colour", () => {
  assert.deepEqual(byVar(nimbus.colors, "--color-brand-500").values, {
    light: "#5b8cff",
    dark: "#93b0ff",
  })
  assert.deepEqual(byVar(nimbus.colors, "--color-surface").values, {
    light: "#ffffff",
    dark: "#101319",
  })
  // A colour the dark block never mentions keeps one value rather than
  // inventing a second the designer did not choose.
  assert.deepEqual(Object.keys(byVar(nimbus.colors, "--border-color").values), ["light"])
})

check("four Tailwind declarations are one text style, not four rows", () => {
  assert.equal(nimbus.textStyles.length, 1)
  const [style] = nimbus.textStyles
  assert.equal(style.name, "lg")
  assert.equal(style.id, "typography:lg")
  assert.equal(style.category, "typography")
  assert.equal(style.cssUtility, "text-lg")
  assert.deepEqual(style.values.default, {
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: -0.01,
    fontWeight: 500,
  })
  assert.deepEqual(style.cssVars, {
    fontSize: "--text-lg",
    lineHeight: "--text-lg--line-height",
    letterSpacing: "--text-lg--letter-spacing",
    fontWeight: "--text-lg--font-weight",
  })
})

check("a stem with nothing but a size is still a complete text style", () => {
  const catalog = parseLibrary("css", ":root {\n  --text-sm: 14px;\n  --color-a: #fff;\n  --color-b: #000;\n  --color-c: #111;\n}\n")
  assert.equal(catalog.textStyles.length, 1)
  const [style] = catalog.textStyles
  assert.equal(style.values.default.fontSize, 14)
  assert.equal(style.values.default.lineHeight, 14, "leading fell back to something other than the size")
  assert.equal(style.values.default.letterSpacing, 0)
  assert.deepEqual(Object.keys(style.cssVars), ["fontSize"])
})

check("tracking is read in the unit it was authored in, and never guessed", () => {
  assert.equal(nimbus.trackingUnit, "em")
  const pixels = parseLibrary(
    "css",
    ":root {\n  --text-sm: 14px;\n  --text-sm--letter-spacing: -0.2px;\n  --color-a: #fff;\n  --color-b: #000;\n}\n"
  )
  assert.equal(pixels.trackingUnit, "px")
  assert.equal(pixels.textStyles[0].values.default.letterSpacing, -0.2)
  // No text style at all is not an em system by default.
  assert.equal(parseLibrary("css", ":root { --color-a: #fff; }").trackingUnit, "px")
})

check("a duration becomes a spring the motion axis can write, and a curve is dropped", () => {
  assert.deepEqual(nimbus.motion.map((token) => token.cssVar), ["--duration-quick"])
  assert.deepEqual(byVar(nimbus.motion, "--duration-quick").values.default, {
    visualDuration: 0.2,
    bounce: 0,
  })
  assert.equal(
    byVar(nimbus.motion, "--ease-standard"),
    null,
    "an easing curve reached a picker whose only verb is transition-duration"
  )
  // Seconds and milliseconds are the same declaration spelled two ways.
  const seconds = parseLibrary(
    "css",
    ":root {\n  --duration-slow: 0.4s;\n  --color-a: #fff;\n  --color-b: #000;\n  --color-c: #111;\n}\n"
  )
  assert.equal(seconds.motion[0].values.default.visualDuration, 0.4)
})

check("an effect keeps the whole value it was authored as", () => {
  assert.equal(
    byVar(nimbus.effects, "--shadow-card").values.default,
    "0 2px 8px rgba(12, 16, 20, 0.16)"
  )
  assert.equal(byVar(nimbus.effects, "--shadow-card").category, "shadow")
})

check("a property this editor cannot bind is dropped rather than offered", () => {
  const vars = allTokens(nimbus).map((token) => token.cssVar)
  assert.equal(
    vars.includes("--font-family-body"),
    false,
    "a font stack became a token in a picker that has no font-family axis"
  )
  // And a commented-out declaration is not a declaration at all.
  assert.equal(vars.includes("--color-legacy-teal"), false, "comments were not stripped first")
})

check("the value decides when the name does not", () => {
  const catalog = parseLibrary(
    "css",
    ":root {\n  --brand: oklch(0.62 0.15 264);\n  --inset: 4px;\n  --leading-tight: 1.2;\n  --shadow-x: 0 1px 2px #0002;\n}\n"
  )
  assert.deepEqual(catalog.colors.map((token) => token.cssVar), ["--brand"])
  assert.deepEqual(catalog.spacing.map((token) => token.cssVar), ["--inset"])
  // A unitless ratio is neither a colour nor a length, so nothing claims it.
  assert.equal(
    allTokens(catalog).some((token) => token.cssVar === "--leading-tight"),
    false
  )
})

check("every block a design system is declared in is read, and the last word wins", () => {
  const catalog = parseLibrary(
    "css",
    [
      "@theme {",
      "  --color-brand: #111111;",
      "  --radius-card: 12px;",
      "}",
      '[data-theme="high-contrast"] {',
      "  --color-ink: #000000;",
      "}",
      "html {",
      "  --spacing-md: 16px;",
      "}",
      ":root {",
      "  --radius-card: 16px;",
      "}",
    ].join("\n")
  )
  // Sorted, because which BLOCK a declaration was found in is not an ordering
  // the contract fixes — only that every one of these blocks is looked in.
  assert.deepEqual(catalog.colors.map((token) => token.cssVar).sort(), [
    "--color-brand",
    "--color-ink",
  ])
  assert.deepEqual(catalog.spacing.map((token) => token.cssVar), ["--spacing-md"])
  assert.equal(byVar(catalog.radii, "--radius-card").values.default, 16)
})

check("a file with no blocks at all is still read", () => {
  const catalog = parseLibrary(
    "css",
    "--color-a: #fff;\n--color-b: #000;\n--spacing-sm: 8px;\n--radius-sm: 4px;\n"
  )
  assert.equal(catalog.colors.length, 2)
  assert.equal(catalog.spacing.length, 1)
  assert.equal(catalog.radii.length, 1)
})

// ── Manifest ───────────────────────────────────────────────────────────────

console.log("\nA design system written as a Figma-style manifest")

const meridian = parseLibrary("manifest", MANIFEST)

/*
 * The delegation, asserted against the real normaliser rather than a copy of
 * its output.
 *
 * `normalizeDesignSystemManifest` is what the HOST's own design system goes
 * through, and the entire promise of a library is that the merged catalog
 * cannot tell the two apart. A second implementation here would pass a test
 * written as a literal — and would then disagree with the host on the next
 * manifest feature only one of the two learned about.
 */
check("a manifest library is normalized by the module the host's own system uses", () => {
  const direct = normalizeDesignSystemManifest(JSON.parse(MANIFEST))
  assert.deepEqual(meridian.colors, direct.colors)
  assert.deepEqual(meridian.spacing, direct.spacing)
  assert.deepEqual(meridian.radii, direct.radii)
  assert.deepEqual(meridian.textStyles, direct.textStyles)
  assert.deepEqual(meridian.uiTextStyles, direct.uiTextStyles)
  assert.deepEqual(meridian.effects, direct.effects)
  assert.deepEqual(meridian.icons, direct.icons)
  assert.deepEqual(meridian.motion, direct.motion)
  assert.equal(meridian.name, direct.name)
  assert.equal(meridian.trackingUnit, direct.trackingUnit)
  // Not vacuous: the fixture really does carry every group.
  assert.equal(direct.colors.length, 2)
  assert.equal(direct.motion.length, 1)
})

check("an explicit name overrides the one the manifest gave itself", () => {
  assert.equal(meridian.name, "Meridian")
  assert.equal(parseLibrary("manifest", MANIFEST, { name: "Vendored" }).name, "Vendored")
})

check("components come across with an id of their own", () => {
  assert.equal(meridian.components.length, 1)
  const [button] = meridian.components
  assert.equal(button.id, "component:button")
  assert.equal(button.name, "Button")
  assert.equal(button.description, "The primary action control.")
  assert.equal(button.snippet, '<Button variant="primary">Label</Button>')
  assert.deepEqual(button.props, [
    { name: "variant", type: "enum", values: ["primary", "ghost"] },
    { name: "disabled", type: "boolean" },
  ])
})

check("a manifest with no components brings none, and it is not an error", () => {
  const catalog = parseLibrary("manifest", JSON.stringify({ name: "Bare", collections: [] }))
  assert.deepEqual(catalog.components, [])
  assert.deepEqual(catalog.colors, [])
})

/*
 * Breakpoints are a compile-time fact of the HOST's Tailwind build. A library
 * that claimed one would put a `md:` prefix in the inspector that compiles to
 * nothing in the app the designer is looking at.
 */
check("a library contributes no breakpoints, measures or aliases", () => {
  for (const key of ["breakpoints", "containerBreakpoints", "responsiveMeasures", "aliases"]) {
    assert.equal(key in meridian, false, `a library catalog carries ${key}`)
  }
  assert.ok(JSON.parse(MANIFEST).breakpoints, "the fixture no longer has a breakpoint to drop")
})

check("a manifest carries no drawings and names no icon attribute", () => {
  assert.deepEqual(meridian.iconDrawings, [])
  assert.equal(meridian.iconAttribute, "")
})

// ── DTCG / Style Dictionary ────────────────────────────────────────────────

console.log("\nA design system written as DTCG tokens")

const dtcg = parseLibrary("tokens", TOKENS, { name: "Nimbus Tokens" })

check("a token is named for the path it sits at", () => {
  assert.ok(byName(dtcg.colors, "color/brand/500"), "the dotted path was not joined with /")
  assert.ok(byName(dtcg.colors, "color/brand/600"))
  assert.ok(byName(dtcg.spacing, "space/md"))
  assert.ok(byName(dtcg.radii, "radius/card"))
})

check("$type decides the group", () => {
  assert.deepEqual(dtcg.effects.map((token) => token.name), ["elevation/card"])
  assert.deepEqual(dtcg.motion.map((token) => token.name), ["quickness/fast"])
  assert.deepEqual(dtcg.textStyles.map((token) => token.name), ["text/body"])
  assert.deepEqual(dtcg.textStyles[0].values.default, {
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: -0.01,
    fontWeight: 400,
  })
})

check("an untyped leaf is grouped by the shape of its value", () => {
  assert.ok(byName(dtcg.colors, "untyped/ink"), "a hex value was not read as a colour")
  assert.ok(byName(dtcg.spacing, "untyped/inset"), "a px value was not read as a spacing step")
  assert.equal(
    allTokens(dtcg).some((token) => token.name === "untyped/family"),
    false,
    "a font stack became a token"
  )
})

/*
 * These tokens have no live custom property behind them — a Style Dictionary
 * file is an input to a build, not something the browser resolves. A `cssVar`
 * here would make `authoredTokenMatches` claim an element was bound to a
 * variable that does not exist in the page.
 */
check("a DTCG token has no cssVar, because there is no variable to point at", () => {
  for (const token of allTokens(dtcg)) {
    assert.equal(token.cssVar, undefined, `${token.name} claims ${token.cssVar}`)
  }
})

check("values arrive in the shape the editor reads them in", () => {
  assert.deepEqual(byName(dtcg.colors, "color/brand/500").values, { light: "#5b8cff" })
  assert.equal(byName(dtcg.spacing, "space/md").values.default, 16)
  assert.equal(byName(dtcg.radii, "radius/card").values.default, 12)
})

check("a DTCG file brings no components, drawings or attribute", () => {
  assert.deepEqual(dtcg.components, [])
  assert.deepEqual(dtcg.iconDrawings, [])
  assert.equal(dtcg.iconAttribute, "")
  assert.equal(dtcg.name, "Nimbus Tokens")
})

// ── Icons ──────────────────────────────────────────────────────────────────

console.log("\nA library of icon drawings")

const glyphs = parseLibrary("icons", ICONS, { name: "Nimbus Icons" })

check("drawings are normalized, sorted, and the broken ones are dropped not thrown", () => {
  assert.deepEqual(glyphs.iconDrawings.map((icon) => icon.name), ["arrow-right", "circle"])
  const [arrow, circle] = glyphs.iconDrawings
  assert.equal(arrow.nodes.length, 2)
  assert.equal(arrow.rootFill, "none")
  assert.equal(arrow.rootStroke, "currentColor")
  // No `rootFill` in the source: an icon drawn in the current text colour is
  // the normal case, so it is the default rather than a required field.
  assert.equal(circle.rootFill, "currentColor")
  assert.equal("rootStroke" in circle, false)
})

check("an icon library contributes drawings and nothing else", () => {
  for (const group of [
    "colors", "spacing", "radii", "textStyles", "uiTextStyles", "effects", "icons", "motion",
    "components",
  ]) {
    assert.deepEqual(glyphs[group], [], `${group} is not empty`)
  }
})

check("the attribute glyphs name themselves with is declared, or defaulted", () => {
  assert.equal(glyphs.iconAttribute, "data-icon")
  const declared = parseLibrary(
    "icons",
    JSON.stringify({ $attribute: "data-lucide", box: { nodes: [["rect", { x: "3", y: "3" }]] } })
  )
  assert.equal(declared.iconAttribute, "data-lucide")
  assert.deepEqual(declared.iconDrawings.map((icon) => icon.name), ["box"])
})

// ── Counts and the one line that describes them ────────────────────────────

console.log("\nWhat a library says it brings")

check("counts are derived from the catalog, including the drawings", () => {
  assert.deepEqual(libraryCounts(nimbus), {
    colors: 3,
    spacing: 3,
    radii: 1,
    textStyles: 1,
    effects: 1,
    icons: 1,
    motion: 1,
    components: 0,
    iconDrawings: 0,
  })
  assert.deepEqual(libraryCounts(glyphs), {
    colors: 0,
    spacing: 0,
    radii: 0,
    textStyles: 0,
    effects: 0,
    icons: 0,
    motion: 0,
    components: 0,
    iconDrawings: 2,
  })
  assert.equal(libraryCounts(meridian).components, 1)
  assert.equal(libraryCounts(meridian).colors, 2)
})

check("the description names the biggest groups, at most three of them", () => {
  const line = describeLibrary("css", nimbus)
  assert.equal(typeof line, "string")
  assert.ok(line.length > 0, "a library with seven populated groups described itself as nothing")
  assert.ok(
    line.split("·").length <= 3,
    `"${line}" names more than three groups, which does not fit a 260px card`
  )
  assert.match(line, /3 colou?rs/)
  assert.equal(describeLibrary("icons", glyphs), "2 icons")
})

check("one of something is not one somethings", () => {
  const one = parseLibrary(
    "icons",
    JSON.stringify({ dot: { nodes: [["circle", { cx: "12", cy: "12", r: "2" }]] } })
  )
  assert.equal(describeLibrary("icons", one), "1 icon")
  const colour = parseLibrary("css", ":root { --color-only: #fff; }")
  assert.match(describeLibrary("css", colour), /^1 colou?r$/)
})

// ── Refusal ────────────────────────────────────────────────────────────────

console.log("\nMalformed input is refused, not half-read")

check("a manifest that is not JSON, or not a manifest, throws", () => {
  assert.throws(() => parseLibrary("manifest", "{ not json"))
  assert.throws(() => parseLibrary("manifest", "[]"))
  // Present and the wrong shape. Absence would be `[]`; this is a host mistake.
  assert.throws(() => parseLibrary("manifest", '{"collections": 5}'))
  assert.throws(() => parseLibrary("manifest", '{"textStyles": [{"name": "X"}]}'))
})

check("a token file that is not JSON, or has no tokens in it, throws", () => {
  assert.throws(() => parseLibrary("tokens", "not json at all"))
  assert.throws(() => parseLibrary("tokens", "[]"))
})

check("an icon file that is not a name-to-drawing object throws", () => {
  assert.throws(() => parseLibrary("icons", "{"))
  assert.throws(() => parseLibrary("icons", "[]"))
  assert.throws(() => parseLibrary("icons", '"a string"'))
})

/*
 * A stylesheet with no custom properties in it is the CSS equivalent of a
 * manifest with no collections: the file was pointed at by mistake. Installing
 * it as an empty library would put a card in the panel that brings nothing and
 * explains nothing.
 */
check("a stylesheet with no custom properties throws", () => {
  assert.throws(() => parseLibrary("css", ".card { padding: 8px; }"))
  assert.throws(() => parseLibrary("css", ""))
})

check("a kind nobody defined throws instead of guessing one", () => {
  assert.throws(() => parseLibrary("sketch", THEME))
  assert.throws(() => parseLibrary(null, THEME))
})

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
