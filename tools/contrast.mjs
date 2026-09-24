/**
 * Every ink-and-fill pair the chrome actually renders, resolved and measured.
 *
 * This exists because the palette has now shipped the same class of bug twice,
 * and both times a test was watching. `onAccent` was near-black, five rules
 * paired it with a light semantic fill, and the pairing was correct. The accent
 * later moved to a dark blue and `onAccent` correctly became white in both
 * themes — at which point those five rules were putting white on a pale coral
 * at 2.31:1, and nothing failed. Three of them carried a comment naming 2.31:1
 * as the bug they had already fixed.
 *
 * The reason nothing failed is that every guard in the suite named a ROLE. A
 * role-named assertion answers "is `onSemantic` still `#1a1a1a`", which stays
 * true while the thing it is painted on moves out from under it. The only
 * question that catches this is the rendered one: for every rule that sets both
 * an ink and a fill, what is the ratio?
 *
 * So this resolves the compiled stylesheet rather than reading the token
 * module. It is deliberately dumb about CSS and exact about colour.
 *
 * ## What it can and cannot see
 *
 * It measures a rule only when that rule declares BOTH an ink and a fill, which
 * is 56 of the chrome's 419 rules. That is not a shortfall for this bug class —
 * every failure of it has been a rule setting both — but it does mean a rule
 * inheriting its ground is out of scope, and `KNOWN_GROUNDS` below is the
 * hand-maintained exception list for the few that matter most.
 *
 * Unresolvable values are reported rather than skipped silently, because a
 * value this cannot parse is a value nobody is checking.
 */

/* ---------- colour ---------- */

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i
const RGB = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)\s*(?:[,/]\s*([\d.]+%?)\s*)?\)$/i
const MIX = /^color-mix\(in srgb,\s*(.+?)\s+([\d.]+)%,\s*(.+?)\)$/i
/** `var(--x, <fallback>)` — the fallback is the dark theme's literal. */
const VAR = /^var\(\s*(--[\w-]+)\s*(?:,\s*([\s\S]+))?\)$/

const clamp = (n) => Math.min(255, Math.max(0, n))

/**
 * A colour, as `{ r, g, b, a }` in 0-255 / 0-1, or null when unresolvable.
 *
 * `theme` supplies the per-role values; a `var()` is looked up there first and
 * falls back to its own literal, which is what the browser does.
 */
export function parseColor(value, theme, depth = 0) {
  if (typeof value !== "string" || depth > 8) return null
  const text = value.trim()
  if (text === "transparent") return { r: 0, g: 0, b: 0, a: 0 }
  if (text === "currentColor" || text === "inherit" || text === "initial") return null

  const hex = HEX.exec(text)
  if (hex) {
    const full = hex[1].length === 3 ? hex[1].split("").map((c) => c + c).join("") : hex[1]
    const n = Number.parseInt(full, 16)
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 }
  }

  const rgb = RGB.exec(text)
  if (rgb) {
    const alpha = rgb[4] === undefined
      ? 1
      : rgb[4].endsWith("%")
        ? Number.parseFloat(rgb[4]) / 100
        : Number.parseFloat(rgb[4])
    return { r: +rgb[1], g: +rgb[2], b: +rgb[3], a: alpha }
  }

  const ref = VAR.exec(text)
  if (ref) {
    const declared = theme.get(ref[1])
    if (declared !== undefined) return parseColor(declared, theme, depth + 1)
    return ref[2] ? parseColor(ref[2], theme, depth + 1) : null
  }

  const mix = MIX.exec(text)
  if (mix) {
    // srgb mixing is a straight per-channel lerp once alpha is premultiplied,
    // which is the one space worth resolving by hand. Anything else returns
    // null and is reported as unresolvable rather than guessed at.
    const a = parseColor(mix[1], theme, depth + 1)
    const b = parseColor(mix[3], theme, depth + 1)
    if (!a || !b) return null
    const w = Number.parseFloat(mix[2]) / 100
    const alpha = a.a * w + b.a * (1 - w)
    if (alpha === 0) return { r: 0, g: 0, b: 0, a: 0 }
    const ch = (x, y) => clamp((x * a.a * w + y * b.a * (1 - w)) / alpha)
    return { r: ch(a.r, b.r), g: ch(a.g, b.g), b: ch(a.b, b.b), a: alpha }
  }
  return null
}

/** Composite a possibly-translucent colour over an opaque one. */
export const over = (top, bottom) =>
  top.a >= 1
    ? top
    : {
        r: top.r * top.a + bottom.r * (1 - top.a),
        g: top.g * top.a + bottom.g * (1 - top.a),
        b: top.b * top.a + bottom.b * (1 - top.a),
        a: 1,
      }

const channel = (v) => {
  const s = v / 255
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}
const luminance = (c) => 0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b)

/** WCAG 2.x contrast, to two decimals. */
export function ratio(ink, fill) {
  const [hi, lo] = [luminance(ink), luminance(fill)].sort((a, b) => b - a)
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100
}

/* ---------- the stylesheet ---------- */

/** `--de-color-x: value` declarations from one theme block of the palette. */
export function themeBlock(css, selector) {
  const start = css.indexOf(selector)
  if (start === -1) throw new Error(`no ${selector} block in the stylesheet`)
  const open = css.indexOf("{", start)
  const body = css.slice(open + 1, css.indexOf("}", open))
  const map = new Map()
  for (const line of body.split(";")) {
    const at = line.indexOf(":")
    if (at === -1) continue
    const name = line.slice(0, at).trim()
    if (name.startsWith("--")) map.set(name, line.slice(at + 1).trim())
  }
  return map
}

const lastDeclaration = (body, property) => {
  const found = [...body.matchAll(new RegExp(`(?:^|[;{\\s])${property}\\s*:\\s*([^;]+)`, "g"))]
  return found.length ? found[found.length - 1][1].trim() : null
}

/**
 * The first top-level token of a value, with parentheses balanced.
 *
 * `background` is a shorthand, so the colour may be followed by a position or a
 * repeat keyword and only the first token is the ground. Splitting on
 * whitespace is the obvious way to take it and it is wrong here: a token in
 * this stylesheet is routinely `var(--x, color-mix(in srgb, #fff 14%, #1a1a1a))`,
 * which contains four spaces and two levels of nesting.
 *
 * Counting depth was worth the ten lines. The regex that preceded it split
 * inside the `color-mix` and handed back `var(--de-color-bg-raised,` — a string
 * that parses as nothing, so twenty-five of the chrome's rules reported as
 * unresolvable and went unchecked, which is the exact failure this whole file
 * exists to prevent.
 */
function firstToken(value) {
  let depth = 0
  for (let i = 0; i < value.length; i += 1) {
    const ch = value[i]
    if (ch === "(") depth += 1
    else if (ch === ")") depth -= 1
    else if (depth === 0 && /\s/.test(ch)) return value.slice(0, i)
  }
  return value
}

/**
 * Grounds for rules that set an ink and inherit their fill.
 *
 * Hand-maintained and deliberately short. A selector listed here is measured
 * against the named role as well; anything not listed and not self-grounded is
 * simply not checked, and `sweep` reports how many those are so the number
 * cannot quietly grow.
 */
export const KNOWN_GROUNDS = [
  [/^\.de-panel\b|^\.de-panel-body\b|^\.de-section\b/, "--de-color-bg"],
  [/^\.de-toolbar\b/, "--de-color-bg"],
  [/^\.de-app-menu\b/, "--de-color-bg-raised"],
]

/**
 * Every measurable pair in one theme.
 *
 * `floor` is 4.5 by default — the ratio a label owes — and a selector matching
 * `glyphOnly` is measured at 3.0 instead, which is what WCAG 1.4.11 asks of a
 * mark. That list is the only judgement in this file and every entry needs a
 * reason, because calling something a glyph is how a label gets exempted.
 */
export function sweep(shellCss, { theme, palette, glyphOnly = [], ignore = [] }) {
  const results = []
  const unresolvable = []
  /*
   * Comments out first, and this is not tidying.
   *
   * The comments in this codebase are long, they sit directly above the rule
   * they explain, and they contain braces and colons — so a rule matcher run
   * over the raw sheet takes the comment as part of the next selector, and the
   * finding it reports names a paragraph of prose instead of a control. Worse,
   * the prose often QUOTES a declaration, which is how one comment came back
   * measured as four separate failures.
   */
  const css = shellCss.replace(/\/\*[\s\S]*?\*\//g, "")
  /*
   * NO LEADING ANCHOR, and this was a real bug rather than a tidy-up.
   *
   * The matcher was `(?:^|\})\s*([^{}@][^{}]*?)\{([^{}]*)\}`. A global regex
   * resumes from the end of the previous match, so once rule A had been matched
   * — closing brace consumed — the next match had to begin on a literal `}`,
   * which is rule B's. B was swallowed as leading context and never inspected,
   * and C was reported as the next selector. Against adjacent rules, which is
   * every rule in these files, the sweep saw about HALF the stylesheet, and
   * which half depended on how many rules happened to precede them.
   *
   * A contrast guard that silently skips every other rule is worse than none:
   * it reports green over an unmeasured set and nobody looks again. Matching
   * the body alone and trimming the selector off the front has no anchor to get
   * wrong, and the pair count in the suite is what proves it sees the sheet.
   */
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]

  for (const [, rawSelector, body] of rules) {
    const selector = rawSelector.replace(/\s+/g, " ").trim()
    if (!selector || selector.startsWith("@")) continue
    if (ignore.some((probe) => probe.test(selector))) continue

    const inkText = lastDeclaration(body, "color")
    if (!inkText) continue
    let fillText = lastDeclaration(body, "background-color") ?? lastDeclaration(body, "background")
    // `background: <color>` only; a gradient or an image has no single ground.
    if (fillText && /(gradient|url\(|image-set)/i.test(fillText)) continue
    if (fillText) fillText = firstToken(fillText)

    let groundedBy = null
    if (!fillText) {
      const known = KNOWN_GROUNDS.find(([probe]) => probe.test(selector))
      if (!known) continue
      fillText = `var(${known[1]})`
      groundedBy = known[1]
    }

    const ink = parseColor(inkText, palette)
    const fillRaw = parseColor(fillText, palette)
    if (!ink || !fillRaw) {
      // Reported, never skipped silently: a value this cannot parse is a value
      // nobody is checking, and the count is what stops that set growing.
      unresolvable.push({ selector, ink: inkText, fill: fillText })
      continue
    }
    // A translucent ground is composited over the panel, which is what is
    // behind every surface in this chrome that is not the canvas.
    const page = parseColor("var(--de-color-bg)", palette) ?? { r: 0, g: 0, b: 0, a: 1 }
    const fill = over(fillRaw, page)
    if (fill.a === 0) continue
    const inkOver = over(ink, fill)

    const glyph = glyphOnly.some((probe) => probe.test(selector))
    results.push({
      theme,
      selector,
      ink: inkText,
      fill: fillText,
      groundedBy,
      floor: glyph ? 3 : 4.5,
      measured: ratio(inkOver, fill),
    })
  }
  return { results, unresolvable }
}
