/**
 * Every ink-and-fill pair the chrome renders, measured, in both themes.
 *
 * THIS SUITE EXISTS BECAUSE THE OTHER COLOUR TESTS CANNOT CATCH THE BUG THAT
 * KEEPS HAPPENING.
 *
 * The palette has shipped the same failure twice. `onAccent` was near-black,
 * five rules paired it with a pale semantic fill, and the pairing was right.
 * The accent later moved to Figma's blues and `onAccent` correctly became white
 * in both themes — at which point those five rules were putting white on a pale
 * coral at 2.31:1, and the suite stayed green. Three of them carried a comment
 * naming 2.31:1 as the bug they had already fixed. The second time, the measure
 * badge went to 2.68:1 the same way and was found by hand, weeks later.
 *
 * Every guard that missed it named a ROLE: "is `onSemantic` still `#1a1a1a`",
 * which stays true while the thing it is painted on moves out from under it. A
 * role is half a pair, and contrast is a property of the pair.
 *
 * So this asks the rendered question instead, over the compiled stylesheet: for
 * every rule that sets both an ink and a fill, what is the ratio, in each
 * theme? It needs no list of roles to watch and no one to remember to add to
 * it. A rule written next month is measured the day it is written.
 *
 * ## The floors, and the one judgement in here
 *
 * 4.5:1 for anything that can hold a word (WCAG 1.4.3) and 3:1 for a surface
 * that only ever holds a mark (1.4.11). `GLYPH_ONLY` below is the whole of the
 * second set, and every entry names the control and why it can hold no text —
 * because "call it a glyph" is exactly how a label gets quietly exempted.
 *
 * ## What it does not see
 *
 * A rule that inherits its ground. That is not a gap for this bug class — every
 * instance of it has been a rule setting both halves — but `UNRESOLVABLE_CAP`
 * keeps the unchecked set from growing silently.
 */

import assert from "node:assert/strict"
import { build } from "esbuild"

import { PACKAGE_DIR } from "./host.mjs"
import { sweep, themeBlock } from "../tools/contrast.mjs"

let passed = 0
let failed = 0
const check = (name, fn) => {
  try {
    fn()
    passed += 1
    console.log(`  ok   ${name}`)
  } catch (error) {
    failed += 1
    console.log(`  FAIL ${name}\n       ${error.message}`)
  }
}

const bundled = await build({
  stdin: {
    contents: `export { shellCss } from "./src/core/css"`,
    resolveDir: PACKAGE_DIR,
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  write: false,
  logLevel: "silent",
})
const { shellCss } = await import(
  `data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`
)

/**
 * Surfaces that can only ever hold a mark, and therefore owe 3:1 not 4.5:1.
 *
 * Each one is a control whose content is built by `icon()` and which has no
 * text node anywhere in it. Adding a row here is a claim about the DOM, so it
 * is worth checking the builder before you make one: if a label can ever land
 * on the surface, the surface owes 4.5 and this list is how it stops being
 * asked for it.
 */
const GLYPH_ONLY = [
  /*
   * `.de-tool` in every variant and state. It is the chrome's square icon
   * button — the toolbar's tools, the panels' toggles, the commit mark — and
   * `toolbar.ts` builds its content with `icon()` and nothing else. What a
   * reader gets is the `aria-label`; no code path puts a word inside one.
   *
   * Matched as a family rather than state by state, because the previous list
   * named three exact selectors and the sweep then reported `:hover` and
   * `--commit` as failures the moment it started seeing the whole sheet. A
   * per-state list of a control that has six states is a list that is wrong
   * every time somebody adds the seventh.
   */
  /(^|\s)\.de-tool\b/,
  // The 18px icon plate in a 24px row — eye, lock, bin, rename. Same argument:
  // `icon()` only, and its name is on the `aria-label`.
  /(^|\s)\.de-mini\b/,
]

/**
 * Pairs that fail a floor and are allowed to, each with the argument.
 *
 * This list is the dangerous one, so it is short, every row carries its reason
 * in the code rather than in a commit message, and the case below caps it. An
 * exemption is a promise that the ratio is not the whole story; a promise
 * nobody can read is just a suppressed test.
 */
const EXEMPT = [
  {
    probe: /^\.de-ann-(marker|index)$/,
    why:
      "The fill is a colour the USER picked from seven Apple system hues, so no " +
      "ink clears 4.5:1 on all of them — white on #FFCC00 is 1.4:1 at any weight. " +
      "`tokens.ts` argues this at `onUserColor` and `css/annotations.ts` carries " +
      "it with a 1px contact shadow on the glyph rather than by bending the " +
      "palette. The content is a numeral on a map pin, the pattern white is " +
      "designed against.",
  },
]

/**
 * Rules whose pair is real but whose ground this cannot resolve statically.
 *
 * Deliberately tiny, and the cap below is what keeps it that way.
 */
const UNRESOLVABLE_CAP = 2

const THEMES = [
  ["dark", ':root,\n[data-designlayer][data-de-theme="dark"]'],
  ["light", ':root[data-de-theme="light"]'],
]

console.log("The contrast sweep")

const swept = THEMES.map(([theme, selector]) => {
  const palette = themeBlock(shellCss, selector)
  return { theme, ...sweep(shellCss, { theme, palette, glyphOnly: GLYPH_ONLY }) }
})

for (const { theme, results } of swept) {
  check(`every ${theme} surface that sets its own ink and fill can be read`, () => {
    const under = results
      .filter((row) => row.measured < row.floor)
      .filter((row) => !EXEMPT.some((exempt) => exempt.probe.test(row.selector)))
      .sort((a, b) => a.measured - b.measured)
      .map((row) => `      ${row.measured}:1 (owes ${row.floor}) ${row.selector}\n        ${row.ink} on ${row.fill}`)
    assert.equal(
      under.length,
      0,
      `${under.length} ${theme} pair(s) under their floor:\n${under.join("\n")}`
    )
  })
}

/*
 * The sweep has to be MEASURING something, and this is the case that says so.
 *
 * A resolver that silently returned null for everything would report zero
 * failures and pass the two cases above for ever. The count is the evidence
 * that they mean anything, and it is asserted as a floor rather than an exact
 * number so that adding a rule does not fail an unrelated test.
 */
check("the sweep is reading the real stylesheet, not an empty one", () => {
  for (const { theme, results } of swept) {
    assert.ok(
      results.length >= 50,
      `only ${results.length} ${theme} pairs resolved — the sweep has stopped seeing the sheet`
    )
  }
})

check("nothing has quietly dropped out of the sweep's reach", () => {
  for (const { theme, unresolvable } of swept) {
    const named = unresolvable.map((row) => `      ${row.selector} — ${row.ink} on ${row.fill}`)
    assert.ok(
      unresolvable.length <= UNRESOLVABLE_CAP,
      `${unresolvable.length} ${theme} pair(s) cannot be resolved, over the cap of ${UNRESOLVABLE_CAP}:\n${named.join("\n")}\n` +
        "      Either teach `tools/contrast.mjs` the value, or raise the cap with a reason."
    )
  }
})

/*
 * The exemption list is a liability, so it is bounded too.
 *
 * Every entry is a promise that a surface holds no text. The cheapest way for
 * this suite to stop meaning anything is for that list to grow one plausible
 * row at a time until the 4.5 floor applies to nothing.
 */
check("the exemptions are still few, and every one still matches something", () => {
  assert.ok(GLYPH_ONLY.length <= 4, `${GLYPH_ONLY.length} glyph families — the 4.5 floor is eroding`)
  assert.ok(EXEMPT.length <= 2, `${EXEMPT.length} outright exemptions — each one is an unmeasured surface`)
  const selectors = swept[0].results.map((row) => row.selector)
  for (const probe of [...GLYPH_ONLY, ...EXEMPT.map((e) => e.probe)]) {
    assert.ok(
      selectors.some((selector) => probe.test(selector)),
      `${probe} exempts nothing — the rule was renamed or deleted, so the exemption is stale`
    )
  }
  // An exemption with no argument is a suppressed test. This is the only thing
  // stopping the list above from becoming one.
  for (const { probe, why } of EXEMPT) {
    assert.ok(why && why.length > 80, `${probe} is exempt without saying why`)
  }
})

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
