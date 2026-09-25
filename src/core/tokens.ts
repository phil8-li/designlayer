/**
 * Chrome tokens for the editor UI.
 *
 * This chrome sits *around* the product and must read as tooling, never as
 * product surface — but "not product surface" is not the same as "not the
 * design system". The design system already owns a theme-invariant CHROME rung
 * for exactly this: the surfaces the workspace paints around its content
 * canvas. That rung is what the editor wears now, in place of the Figma greys
 * it was born with.
 *
 * Values are vendored as literals rather than read from the app. The package
 * contract is that nothing here imports the app and nothing in the app imports
 * this, so the coupling is the comment naming each source role, not a module
 * edge. Regenerate against `src/app/globals.css` if the rung moves.
 *
 *   --sem-background-chrome   --base-gray-1200   #363c44
 *   --sem-fixed-always-light  --base-gray-white  #ffffff
 *   --sem-decorative-on-chrome --base-indigos-indigo-01  #a1bbff
 *   --sem-fixed-always-dark   --base-gray-1600   #0c1014
 *
 * ---------------------------------------------------------------------------
 * TWO THEMES, AND WHY THE COLOURS ARE THE ONLY THING THAT MOVED
 *
 * Everything in `color`, `code` and the tints inside `shadow` is now a
 * REFERENCE — `var(--de-color-bg)` rather than `#1c1d21`. The values live in
 * `PALETTE` below, two per role, and `css/base.ts` emits them as two blocks of
 * custom properties switched by `data-de-theme`.
 *
 * This is not a stylistic preference for variables. Fourteen css modules
 * interpolate these tokens at BUILD time, into one string, once — so a literal
 * here is a literal baked into the stylesheet, and there is exactly one theme
 * available for the lifetime of the bundle. A reference is the only shape that
 * lets the same interpolation resolve differently at run time, and it means
 * every `${t.color.x}` already written keeps compiling untouched.
 *
 * `icon`, `size`, `type`, `radius`, `duration` and `ease` stay literal. Two of
 * those are read by JAVASCRIPT as numbers — `tokens.icon.control` is handed to
 * `icon()` and `tokens.size.panelInset` to the drag clamp — and `var(--x)` is a
 * string a browser resolves, not a number a program can add. They also do not
 * vary by theme, which is the other half of the test: a token belongs in
 * `PALETTE` when the answer depends on which theme is up, and nowhere else.
 */

// ─────────────────────────────────────────────────── the dark theme ────────

/**
 * The ground every surface below is a step off.
 *
 * Near-black, not the host app's `--sem-background-chrome` slate (`#363c44`)
 * this used to borrow, and not the `#2c2c2c` neutral grey it was after that.
 * The editor is chrome AROUND someone else's product, not a panel inside one,
 * and any grey bar over a page reads as a fourth colour competing with the
 * design under review. Near-black recedes: it stops looking like part of the
 * app and starts looking like the frame around it.
 *
 * IT IS THE SAME VALUE AS `INK`, and that is the symmetry rather than a
 * collision. The note on `INK` states the rule this kit is built on — each
 * theme paints with the other's ground — and until now that was true only
 * approximately. The two constants are kept separate anyway, because they are
 * separate decisions that happen to agree: `INK` means "what the light theme
 * writes with", `CHROME` means "the ground the dark theme is built on", and
 * moving one must not silently move the other.
 *
 * NOT PURE `#000`, WHICH THIS BRIEFLY WAS, and the reason is measurable rather
 * than aesthetic. The sRGB ramp compresses near black, so `lift()` buys less
 * separation the lower the ground sits. In L*, against the ground:
 *
 *                #2c2c2c   #000000   #1a1a1a
 *   sunken        +5.97     +4.31     +6.85
 *   hoverQuiet    +8.65     +7.74    +10.14
 *   hover        +11.29    +11.76    +12.90
 *   raised       +13.46    +14.20    +15.16
 *   raisedHover  +16.88    +18.94    +19.15
 *
 * On black the control surface — the rung every field, track and pad in the
 * chrome is drawn on — lost a quarter of its step off the ground. `#1a1a1a`
 * does not merely recover that, it beats both alternatives on every rung: dark
 * enough to recede behind the product, high enough that a percentage of white
 * still cuts a visible step. `borderInteractive` lands at 3.22:1 here, its best
 * of the three and clear of the 3:1 WCAG 1.4.11 asks of a control's boundary,
 * where on black it scraped 3.00.
 *
 * THE PANEL EDGE does not depend on any of this. Against a dark app the ground
 * may sit within a point or two of the page, so the edge is drawn by
 * `color.borderStrong` — white cut to alpha — which is the whole reason the
 * hairlines are alpha rather than a mixed grey. It survives on any ground.
 *
 * Every derived step follows from here, which is the point of routing them all
 * through `lift`/`rule`: moving this one constant restyles the whole chrome,
 * and the white-on-chrome contrast ratios documented below only IMPROVE as the
 * ground darkens — white on this ground is 17.4:1 against 13.97:1 on the old
 * `#2c2c2c`, so the tightest of them, `textDim` at 70% on a hovered control,
 * sits further clear of its floor rather than nearer it.
 */
const CHROME = "#1a1a1a"
/** `--sem-fixed-always-light`. Also the substance every quiet step is cut from. */
const ON_CHROME = "#ffffff"
/**
 * The accent as INK — a stroke, a focus ring, a chosen glyph.
 *
 * Figma's published `--figma-color-icon-brand` in dark, which is also its
 * `text-brand`, `icon-selected` and `border-selected-strong`: one light blue
 * doing every accent-as-ink job. That is the half of Figma's accent most easily
 * got wrong, because the brand blue it ships on a filled CTA is far darker and
 * would be 3.1:1 as ink on this ground.
 *
 * This was `#8dc2f3` — screen-measured off Figma's own chrome, and wrong by the
 * width of a colour space. The capture came off a Display-P3 panel, which
 * shifts every reading; the light-theme numbers happened to match the published
 * list because that capture came off a second, sRGB display. The published
 * token is authoritative and the measurement is not, so the measurement loses.
 *
 * 7.4:1 on the chrome and 3.8:1 on the selected tint it most often sits in —
 * past the 3:1 WCAG 1.4.11 asks of a glyph, which is all this token ever is.
 */
const RAIL = "#7cc4f8"
/**
 * The accent as a FILL, under a glyph.
 *
 * Figma's published `--figma-color-bg-brand` in dark, which is also its
 * `bg-selected-strong` and `border-selected`: the fill behind a primary button
 * and under a selected tool. White on it measures **3.53:1** — past the 3:1
 * WCAG 1.4.11 asks of a non-text component, so it is right for a fill whose
 * content is a mark, which is nearly every accent-filled surface in this
 * chrome: the selected toolbar tool, the lint toggle, a canvas handle.
 *
 * It is NOT enough under a word — see `RAIL_FILL_TEXT`.
 *
 * This was `#3f8ae2`, from the same P3-shifted capture that got `RAIL` wrong.
 * The two blues land on the same lightness (both 3.53:1 under white) and differ
 * in hue and saturation, so the correction is invisible in the contrast table
 * and visible on screen: the published blue is the more saturated one, which is
 * the half of "looks like Figma" a ratio cannot check.
 */
const RAIL_FILL = "#0c8ce9"
/**
 * The accent fill for a surface that carries a text LABEL.
 *
 * `RAIL_FILL` is 3.53:1 under white, which is not enough under a word: 1.4.3
 * wants 4.5:1 for a 12px label, and the primary button and the tab's count
 * badge both put one on this fill.
 *
 * Figma's own answer to "the same blue, darker" is `bg-brand-hover`, which is
 * also its `bg-brand-pressed` — one rung down the published brand ramp, and
 * **5.28:1** under white. So the AA-safe text fill does not have to be invented
 * after all; it is already in the list. This used to be `#2e77cc`, a hand-mixed
 * blue that cleared the floor by 0.04 and belonged to nobody.
 *
 * Two tokens rather than one compromise blue, because the compromise loses
 * twice — too dark to be Figma's brand colour on the eight glyph surfaces, and
 * still the wrong question on the two that carry text. Figma ships both; it
 * just calls the second one a hover.
 */
const RAIL_FILL_TEXT = "#0a6dc2"
/** Ink on a filled accent. White in both themes now, the way Figma draws it. */
const ON_RAIL = "#ffffff"

/** A quiet step off the chrome, expressed the way the app expresses it. */
const lift = (percent: number) => `color-mix(in srgb, ${ON_CHROME} ${percent}%, ${CHROME})`
/** A hairline cut from the chrome ink, so it survives on any ground. */
const rule = (percent: number) => `color-mix(in srgb, ${ON_CHROME} ${percent}%, transparent)`

// ────────────────────────────────────────────────── the light theme ────────

/**
 * The light ground, and it IS `#ffffff` — which is not the mirror of `CHROME`
 * stopping short of `#000`, and the asymmetry is deliberate.
 *
 * This comment used to say the opposite, and described an off-white `#f4f5f7`
 * that had already been replaced. The reasoning then was that a pure-white
 * chrome over a white page leaves the panel edge invisible, and that white
 * should be kept free to mean "raised". Both halves were overtaken by the same
 * change: Figma's light panel measures `#ffffff` with its controls a step DOWN
 * at `#f5f5f5`, so `press()` does the stepping and the ground does not have to.
 * A popover is told apart by its shadow, which is what a shadow is for.
 *
 * The dark end cannot borrow that trick, which is why it stops at `#1a1a1a`
 * rather than going to `#000`: `lift()` has to cut its steps UPWARD out of the
 * ground, and the sRGB ramp gives it less to work with the lower it starts. See
 * the L* table on `CHROME`.
 */
const PAPER = "#ffffff"
/**
 * The light theme's ink, and the substance its quiet steps are cut from.
 *
 * `--sem-fixed-always-dark`, the same constant the dark theme uses as the ink
 * that rides on a filled accent. That is the symmetry the two themes are built
 * on: each one paints with the other's ground.
 */
const INK = "#1a1a1a"
/**
 * The accent, recomputed rather than reused.
 *
 * `RAIL` is the dark theme's `icon-brand` and it means it: on `PAPER` it
 * measures 1.6:1, invisible as a stroke and unusable as a focus ring. Figma
 * publishes a separate light `icon-brand`, and this is it — 4.2:1 as ink, past
 * the 3:1 a focus ring needs, and 4.2:1 under white when it is used as a fill.
 *
 * NOT the light `bg-brand`, `#0d99ff`, even though that is the fill Figma puts
 * behind its own Share button. White on it is 2.99:1, which fails even the 3:1
 * a non-text component needs, so it cannot carry a glyph here. Figma's light
 * CTA is the one place its published system does not clear its own floor, and
 * `icon-brand` is the nearest rung that does.
 *
 * This was `#0a8ae8`, derived rather than looked up, and the comment claimed
 * 5.9:1 as ink where it actually measured 3.61:1 — the derivation was both
 * unsourced and over-reported. The published token is darker and better.
 *
 * The pairing therefore flips with the theme, and that is the point of having
 * `onAccent` at all: dark chrome gets a light fill under dark ink, light chrome
 * gets a dark fill under white ink, and no call site has to know which.
 */
const INDIGO = "#007be5"
/**
 * The light theme's text-bearing accent fill: Figma's `bg-brand-secondary`,
 * the rung below `INDIGO` on the published light brand ramp. 5.4:1 under white,
 * where `INDIGO` itself is 4.2:1 and a 12px label wants 4.5:1.
 */
const INDIGO_TEXT = "#0768cf"

/**
 * A quiet step DOWN, which is the direction a light theme recesses in.
 *
 * The mirror of `lift` and deliberately not `lift` with a different constant. A
 * `color-mix` with white is how you cut a visible step out of near-black; the
 * same mix on near-white returns near-white, and the two or three percent of
 * difference it can manage reads as a rendering artefact rather than as a
 * surface. Wells, hovers and fields all go this way on paper.
 *
 * The one role that does NOT is `bgRaised`, which goes up to `#ffffff` — a
 * panel in front of the ground is nearer the light in both themes, and on paper
 * that is the only direction with room left in it.
 */
const press = (percent: number) => `color-mix(in srgb, ${INK} ${percent}%, ${PAPER})`
/** A hairline cut from the light theme's ink, so it survives on any ground. */
const wash = (percent: number) => `color-mix(in srgb, ${INK} ${percent}%, transparent)`

/**
 * Every value that depends on which theme is up, as ROLE -> the two it takes.
 *
 * One table rather than two, because the failure this shape exists to prevent
 * is a role defined in one theme and missing from the other — which does not
 * crash, it ships a white label on a white ground. A pair per row makes that
 * unspellable, and `test/token-cases.mjs` checks the emitted CSS for it anyway.
 *
 * Read a row across and you are reading the design decision: the two values are
 * the same ROLE, recomputed for their ground, never the same swatch inverted.
 */
const PALETTE = {
  color: {
    bg: { dark: CHROME, light: PAPER },
    /**
     * Panels and popovers. 6% is the app's `--sidebar-shelf` step; on paper the
     * step is to white, which is the only lift a near-white ground has left.
     */
    /*
     * A surface IN FRONT of the control layer — a popover, a chosen segment.
     *
     * `lift(14)` rather than the `lift(6)` it was, because `lift(6)` is now the
     * control surface itself: a chip drawn at the same value as the track it
     * rides in is not a chip. 14 puts it a clear step above — `#3a3a3a` on this
     * ground — which is the separation Figma's own selected segment has from
     * its rail, the same eight rungs it was when the ground was `#2c2c2c` and
     * this landed on `#4a4a4a`.
     *
     * Light keeps `#ffffff`. Its control surface stepped DOWN to `#f5f5f5`, so
     * the ground is already the raised value and the chip returning to white is
     * exactly what Figma draws.
     */
    bgRaised: { dark: lift(14), light: "#ffffff" },
    /**
     * The rung BELOW chrome — wells, inset tracks, the code view's ground.
     *
     * Derived rather than the literal `#25292e` it was: that value was a step
     * below the old slate and sat LIGHTER than the near-black ground, so every
     * well inverted into a raised panel the moment the chrome went dark. Its
     * light twin is a literal for the same reason the dark one is: this is a
     * large slab, and it is picked to sit clear of the transient hover tints
     * rather than derived from one of them.
     */
    /*
     * THE CONTROL SURFACE — and in dark it is a step UP, not down.
     *
     * This was `#121316`, below the ground, on the reasoning that a field is a
     * recess. Figma's dark chrome does the opposite and the measurement is
     * unambiguous: its panel ground is `#2c2c2c` and every field, track and
     * pad inside it is `#383838` — lighter. Light flips the other way, `#f5f5f5`
     * under a white ground, because that is the direction with room.
     *
     * Both are the same rule, which is why they are derived rather than
     * literal: move AWAY from the ground, whichever way the ground leaves free.
     * `press(4)` lands on `#f5f5f5`, Figma's light value exactly. `lift(6)`
     * used to land on Figma's `#383838` and now lands on `#282828`, because the
     * ground moved down to `#1a1a1a` under it — the same six rungs off the
     * ground, lower down. The relationship is what is being kept here, not the
     * swatch: a control still reads as a step up from the panel it sits in, and
     * at ΔL* 6.85 it reads as a slightly clearer one than it did on the slate.
     *
     * The name is now half wrong and is kept anyway: every call site says
     * `bgSunken` and the role it names — "the surface a control is drawn on" —
     * did not change, only its direction. Renaming it touches sixty rules to
     * say nothing new.
     */
    bgSunken: { dark: lift(6), light: press(4) },
    /* Six rungs above the control surface — `#353535` on this ground, where on
       the old `#2c2c2c` it was `#454545` against Figma's measured `#444444`.
       The quiet rung sits between the control surface and it. */
    bgHover: { dark: lift(12), light: press(9) },
    bgHoverQuiet: { dark: lift(9), light: press(6) },
    bgActive: { dark: RAIL, light: INDIGO },
    /** Dividers and rests — decorative, so the 3:1 rule does not apply. */
    border: { dark: rule(14), light: wash(13) },
    borderStrong: { dark: rule(22), light: wash(24) },
    /**
     * Boundary of a control you can act on, per WCAG 1.4.11.
     *
     * 32% is the app's `--sidebar-border` step. Measured, it is 2.90:1 on the
     * near-black ground rather than the 3.2:1 this comment used to claim, and
     * `css/options.ts` already records the shortfall and accepts it as the best
     * the vendored rung set offers. It is left alone here so that note stays
     * true; the light theme has no such constraint and is set where the floor
     * actually lands — 48% ink is 3.3:1 on paper and still clears 3:1 on the
     * darkest ground a control is ever drawn on, a hovered field.
     */
    borderInteractive: { dark: rule(35), light: wash(48) },
    text: { dark: ON_CHROME, light: INK },
    /** `--sem-fixed-always-light-weaker` — Prism's 75% step. 9.9:1 on chrome. */
    textMuted: { dark: "rgba(255,255,255,0.75)", light: wash(80) },
    /**
     * The quietest readable ink, in both themes, and the pair is tuned to the
     * WORST ground each one is drawn on rather than to the base.
     *
     * 58% is 6.5:1 on the chrome and 4.7:1 on a hovered field, which is the
     * tightest pairing the dark theme actually produces (a placeholder in a
     * hovered composer). 66% ink is the light theme's equivalent: 6.0:1 on
     * paper, 5.4:1 on a hovered field. The obvious 55%/60% both land under 4.5
     * somewhere and fail.
     */
    textDim: { dark: "rgba(255,255,255,0.70)", light: wash(70) },
    /**
     * The ink of a control that cannot be pressed — quieter than `textDim`, and
     * still above the floor on purpose.
     *
     * This role exists because the chrome used to say "disabled" with
     * `opacity`, and opacity fades a control's ink and its fill by the same
     * factor toward whatever is behind them. On the toolbar that put a disabled
     * Undo at 2.38:1 against the 3:1 that WCAG 1.4.11 asks of a glyph; on the
     * primary pill it was worse, because the fade took the accent away and left
     * the near-black ink meant to sit on it, at 1.06:1 — invisible.
     *
     * Tuned to the STRICTER of the two floors, because one role serves both: a
     * disabled glyph owes 3:1 and disabled label text owes 4.5:1, and a value
     * chosen for the glyph quietly fails the label. 40% was that mistake — it
     * measured 3.8:1 on the bar, fine for an icon, and put the disabled Copy
     * pill's text at 3.2:1. 50% is 5.1:1 on the bar, 4.7:1 on a raised surface
     * and 5.3:1 on a sunken one, so the worst ground in the chrome still clears
     * 4.5, against `textDim`'s 6.5:1 for a live control.
     *
     * The light theme's 60% is the same floor found the same way, and its worst
     * ground is the opposite one: `bgRaised` is plain white on paper, so the
     * lightest surface is where dark ink has least to work with. It measures
     * 5.0:1 there against the live control's 19.1:1. 56% was tried first and
     * came to 4.36 — close enough to look fine and still a failure.
     *
     * WCAG exempts inactive controls from contrast entirely. This chrome does
     * not take that exemption anywhere, and the reason is in `css/panels.ts`:
     * an editor is read while it is half-unusable, and a greyed-out control is
     * information about what the tool wants next, not decoration.
     */
    textDisabled: { dark: "rgba(255,255,255,0.62)", light: wash(62) },
    /** Strokes, handles, and focus rings. 7.4:1 dark, 4.2:1 light. */
    accent: { dark: RAIL, light: INDIGO },
    /**
     * Accent as a FILL, under a MARK. Both themes carry white on it, which is
     * how Figma draws it in both: `text-onbrand` and `icon-onbrand` are
     * `#ffffff` on either side of the published list.
     *
     * 3.5:1 dark and 4.2:1 light — each past the 3:1 a non-text component
     * needs, neither past the 4.5:1 a word needs, which is the whole reason
     * `accentSurfaceText` exists beside it.
     */
    accentSurface: { dark: RAIL_FILL, light: INDIGO },
    /** The same fill for a surface with a WORD on it. See `RAIL_FILL_TEXT`. */
    accentSurfaceText: { dark: RAIL_FILL_TEXT, light: INDIGO_TEXT },
    /**
     * The accent as INK ON A PANEL, where the thing it writes is a word.
     *
     * The third rung of the same split `accentSurface` and `accentSurfaceText`
     * already make, and it was the missing one. `accent` is Figma's published
     * `icon-brand`, tuned to be a STROKE — a focus ring, a border, a chosen
     * glyph — all of which owe 3:1 and all of which it clears. A word owes 4.5,
     * and measured on the three panel grounds it does not have it in light:
     *
     *            bg     bg-raised   bg-sunken
     *   dark    7.39      4.72        6.14      accent, fine everywhere
     *   light   4.23      4.23        3.91      accent, short on all three
     *   light   5.40      5.40        4.99      this role
     *
     * Dark keeps `RAIL` because it already passes and because the accent a
     * reader sees as text should be the accent they see as a stroke wherever
     * that is legible. Light drops to `INDIGO_TEXT`, the rung below on Figma's
     * own published ramp, which is the same value `accentSurfaceText` takes —
     * the two are the same colour arrived at from opposite directions, one as
     * ink on paper and one as a fill under white.
     *
     * Found by the contrast sweep rather than by eye, on the annotation badge
     * reading "Ready" at 4.23:1. That is the kind of pair that survives review:
     * accent-on-panel looks systematic, both halves came out of the palette,
     * and nobody measures a colour that was already approved.
     */
    accentText: { dark: RAIL, light: INDIGO_TEXT },
    /**
     * Hover on a filled accent moves AWAY from its own ink, whichever way that
     * is: lighter on the dark theme's light fill, darker on the light theme's
     * dark one. Mixing white into the light theme's fill would have walked it
     * toward the white ink sitting on top of it.
     */
    /*
     * Hover on a filled accent moves AWAY from its own ink. Both fills now
     * carry WHITE, so both go darker — the dark theme's no longer lightens,
     * because its fill stopped being a light indigo under near-black ink.
     */
    accentSurfaceHover: {
      dark: `color-mix(in srgb, ${INK} 14%, ${RAIL_FILL})`,
      light: `color-mix(in srgb, ${INK} 14%, ${INDIGO})`,
    },
    /**
     * Hover on the TEXT-bearing accent fill.
     *
     * Without this the primary button hovered to `accentSurfaceHover`, which is
     * derived from the glyph fill and is therefore lighter — it took the
     * button's own label from 5.28:1 down to 4.40:1, under AA, at the exact
     * moment the pointer was on it. Same 14% step as its sibling, taken from
     * the darker fill so the label keeps its floor while the surface still
     * visibly answers: 6.35:1 dark, 6.45:1 light.
     *
     * A derived step rather than Figma's own next rung, and deliberately. The
     * published brand ramp is three deep and this palette has already spent two
     * of its rungs — `bg-brand` under a mark, `bg-brand-hover` under a word —
     * so a hover for the second one would have to come from `bg-brand-secondary`,
     * which is the rung the LIGHT theme's text fill already occupies. Deriving
     * keeps the two themes' hovers built the same way instead of one reaching
     * down a ramp the other has run out of.
     */
    accentSurfaceTextHover: {
      dark: `color-mix(in srgb, ${INK} 14%, ${RAIL_FILL_TEXT})`,
      light: `color-mix(in srgb, ${INK} 14%, ${INDIGO_TEXT})`,
    },
    /**
     * Hover on a RAISED surface, which the palette had no way to express.
     *
     * `bgRaised` is `lift(14)` in dark and a control on it hovered to
     * `bgHover` — `lift(12)`, which is DARKER. A hover that recedes is a hover
     * that reads as a press, or as nothing. One rung above the surface it sits
     * on, in whichever direction that theme lifts.
     */
    bgRaisedHover: { dark: lift(18), light: press(6) },
    /**
     * Ink for anything sitting on `accentSurface`.
     *
     * White in both themes, which is right, because the accent fill is a Figma
     * blue in both — `RAIL_FILL` dark, `INDIGO` light — and both are dark
     * enough to carry it. This role does not flip and must not.
     */
    onAccent: { dark: ON_RAIL, light: ON_CHROME },
    /**
     * Ink for a SEMANTIC fill: `success`, `danger`, `lintWarning`, `component`,
     * `guide`, `autoLayout`. The half of `onAccent` that was lost, split back
     * out into its own role.
     *
     * The two were one role until the accent moved to Figma's published blues.
     * That move was right for the accent and silently wrong for everything else
     * sharing the ink. The blues are dark fills in both themes, so `onAccent`
     * correctly became `#ffffff` in both; the six semantic hues did NOT move,
     * and they are pale in dark and deep in light precisely so they can be read
     * as INK on their own ground. White landed on the pale ones.
     *
     * Measured, every hue, both themes — the numbers this was retuned from:
     *
     *   role         dark fill  white  near-black    light fill  white
     *   success      #7ee2a8     1.58      11.05     #0e6e40      6.32
     *   danger       #ff8a65     2.31       7.52     #b83408      5.94
     *   lintWarning  #f5b74e     1.78       9.75     #8a5a00      5.93
     *   component    #c9b8ff     1.78       9.77     #6435cc      7.18
     *   guide        #ff6b9a     2.68       6.48     #c41149      5.96
     *
     * Unanimous in both directions, which is what makes this one role and not
     * six: near-black on every dark-theme hue, white on every light-theme one,
     * and the worst pair either way is 5.93:1 — past the 4.5:1 a label owes.
     *
     * The failures it replaces were not marginal, and three of them were
     * regressions against a fix already recorded in the file. `css/panels.ts`,
     * `css/options.ts` and `css/annotations.ts` each carry a comment naming
     * "white on it measures about 2.3:1" as the bug they had fixed, and each had
     * gone back to exactly 2.31:1. The "In your files" badge measured 1.58:1.
     *
     * `INK` rather than `CHROME` for the dark end, and the two are now the
     * SAME VALUE — `#1a1a1a` both — which makes the choice of name look
     * arbitrary and is exactly when it stops being. `INK` is what this palette
     * means by "the dark theme's ink"; `CHROME` means "the ground the dark
     * theme is built on". A fill's ink is the first of those. They agree today
     * and nothing holds them together, so the day the ground moves again this
     * has to follow the ink and not the ground.
     */
    onSemantic: { dark: INK, light: ON_CHROME },
    /**
     * Ink for a fill the USER picked, which is the one fill the theme does not
     * get to flip.
     *
     * `onSemantic` above is near-black in dark and white in light, and that is
     * right for every fill the stylesheet owns, because those flip with it:
     * `success` is a pale mint in dark and a deep green in light, so its ink has
     * to swap ends to stay on the fill. A note pin's colour is one of the seven
     * `MARKER_PRESETS` and is the same hex in both themes, so an ink that swaps
     * is an ink that is wrong in one of them. It was: the numeral on a green pin
     * measured 5.7:1 in dark and 3.4:1 in light — same pin, same green, and the
     * theme had turned the ink white underneath it.
     *
     * White, fixed, both themes. This was near-black until the palette moved:
     * the old presets were mid-to-light hues picked to sit under dark ink, and
     * white on them bottomed out at 1.95:1. The presets are Apple's system
     * colours now, which is the set white is designed against, and a white
     * numeral on a saturated disc is what a map pin looks like everywhere the
     * pattern appears — Agentation included, which is where this one is from.
     *
     * It does not clear 4.5:1 on all seven, and cannot: white on `#FFCC00` is
     * 1.4:1 whatever the weight. `css/annotations.ts` carries that with a 1px
     * contact shadow on the glyph rather than by bending the palette, and the
     * reasoning is recorded there.
     */
    onUserColor: { dark: ON_CHROME, light: ON_CHROME },
    /**
     * The light half of the note pin's two-tone focus ring.
     *
     * Fixed white in both themes for the same reason `onUserColor` is fixed
     * dark: this ring is drawn over the app being edited, not over the chrome,
     * so the editor's theme is not evidence about what is behind it. Paired
     * with the near-black inner ring, one of the two always has contrast —
     * white carries a dark page at up to 21:1, the near-black carries a light
     * one, and neither needs to know which it got.
     */
    focusHalo: { dark: ON_CHROME, light: ON_CHROME },
    /**
     * The dark half of that same two-tone ring.
     *
     * A separate role from `onUserColor` even though both were near-black once,
     * and the split is the point: `onUserColor` means "ink on the fill the user
     * picked" and followed the palette to white when the pins became Apple
     * system colours. This one means "the dark tone of a focus ring drawn over
     * an unknown page" and must not move when a palette does. They were the same
     * value and are not the same decision; sharing one role would have turned
     * the pin's focus ring white-on-white the moment the numeral changed.
     */
    focusCore: { dark: ON_RAIL, light: ON_RAIL },
    /**
     * THE BLUE CONTAINER BEHIND A CHOSEN ICON — and the selected layer row.
     *
     * Figma's published `--figma-color-bg-selected`, which is one token in its
     * system doing both jobs: the container behind an ON icon button in the
     * right panel, and the band under the selected row in the layers tree. So
     * it is one token here too — see `rowSelected`, which points at this.
     *
     * OPAQUE, where this was a transparent wash. A tint that composites against
     * whatever is behind it is a different colour on the panel than it is on a
     * hovered row, and the whole point of the treatment is that a selected
     * thing looks the same everywhere. Figma's is flat.
     *
     * Not the brand blue at an alpha, and not close either:
     * `color-mix(#0a6dc2 25%, #2c2c2c)` comes out `#0f4a72` against the
     * published `#4a5878`, which is far greyer and slightly violet. The
     * selection tint is its own hue in Figma's system, not the CTA diluted.
     *
     * This was `#3b435e`, from the P3-shifted capture described on `RAIL`. The
     * correction is the largest of the four: `#4a5878` is ΔL* 19.5 off the
     * chrome against the old value's 10.8, so a selected row now separates from
     * its ground at 1.97:1 where it used to manage 1.43:1.
     */
    accentSoft: { dark: "#4a5878", light: "#e5f4ff" },
    /**
     * The canvas overlay's wash. Lighter on paper because the accent under it
     * is four times darker: the same 18% that reads as a tint over near-black
     * reads as a solid band over white.
     */
    selectionSurface: {
      dark: `color-mix(in srgb, ${RAIL} 18%, transparent)`,
      light: `color-mix(in srgb, ${INDIGO} 14%, transparent)`,
    },
    /**
     * A control's own well.
     *
     * Fields used to be transparent until hovered, which made a panel of eight
     * numbers read as eight pieces of text. Giving every field a resting well
     * — the step open-pencil calls `--color-panel-field` — is what turns the
     * column into a form. A percentage rather than a literal grey so it still
     * tracks the ground if the rung moves.
     */
    field: { dark: lift(10), light: press(6) },
    fieldHover: { dark: lift(16), light: press(12) },
    /**
     * A selected LAYER ROW, which is not a selected element outline.
     *
     * The row is a solid band the width of the panel, so it carries ink at
     * full contrast rather than the 18% wash the canvas overlay uses. Muted is
     * the same band while focus is elsewhere: still findable, no longer loud.
     *
     * The light band is a smaller share of a much darker accent — 22% of the
     * indigo over paper — because the band has to stay light enough to carry
     * near-black ink, exactly as the dark band stays dark enough to carry white.
     */
    /*
     * A selected LAYER ROW is the same blue container a chosen icon gets.
     *
     * These were two hand-mixed bands — 34% of the accent for the focused row,
     * 16% for the unfocused one. Figma draws the selected row at exactly the
     * value it draws a selected icon's container, so the focused band is now
     * `accentSoft` itself and there is one blue-selection colour in the chrome
     * instead of three that nearly agreed.
     *
     * The muted band — "still selected, focus is elsewhere" — was then a 55%
     * mix of that band into the ground, and it turns out Figma publishes the
     * role: `bg-selected-secondary`. The mix landed at ΔL* 10.8 off the chrome
     * and the published token sits at 10.7, so this is a literal replacing a
     * formula that had independently found it, which is the best evidence
     * either one is right.
     */
    rowSelected: { dark: "#4a5878", light: "#e5f4ff" },
    rowSelectedMuted: { dark: "#394360", light: "#f2f9ff" },
    /**
     * A committed write, in the one place that reports one: the code footer.
     *
     * Each of the four role colours below is the same hue in both themes and a
     * different lightness, because each one is read as INK on its ground and as
     * a FILL under `onAccent`. The dark theme's are lifted so they carry on
     * near-black; the light theme's are taken down so they carry on paper — at
     * 5.2:1 or better as ink, and 5.9:1 or better under white.
     */
    success: { dark: "#7ee2a8", light: "#0e6e40" },
    /** Component (as opposed to plain element) names. */
    component: { dark: "#c9b8ff", light: "#6435cc" },
    /** `--sem-text-icon-alert`, lifted to carry on the dark chrome. */
    danger: { dark: "#ff8a65", light: "#b83408" },
    /**
     * A design-system violation, and deliberately NOT `danger`.
     *
     * The note pin already spends `danger` as its default, and the two marker
     * layers have to be told apart at a glance — so the audit's severities take
     * their own pair of hues: amber for a warning the page still renders, and
     * `danger` itself for an error, which is the one case where the two layers
     * agree that something is wrong. Shape carries the rest of the distinction,
     * because hue alone is not a difference every reader can see.
     */
    lintWarning: { dark: "#f5b74e", light: "#8a5a00" },
    guide: { dark: "#ff6b9a", light: "#c41149" },
    measure: { dark: "#ff6b9a", light: "#c41149" },
  },
  /**
   * Syntax tints for the Code tab, and only there.
   *
   * Kept out of `color` because they are not chrome roles — nothing else in
   * the editor may reach for "the colour of a string literal". They are tuned
   * against `bgSunken`, which is the only ground the code view is drawn on, and
   * they are themed because that ground moves: the pastels that read at 10:1 on
   * a near-black slab read at 1.4:1 on a light one, which is a code view with
   * no code in it.
   */
  code: {
    tag: { dark: "#7dd3fc", light: "#0369a1" },
    attribute: { dark: "#c4b5fd", light: "#6d28d9" },
    string: { dark: "#86efac", light: "#166534" },
    number: { dark: "#fca5a5", light: "#b3261e" },
    punctuation: { dark: "rgba(255,255,255,0.58)", light: wash(66) },
  },
  /**
   * The TINT of a cast shadow, and only the tint.
   *
   * The geometry stays literal in `shadow` below, because an offset and a blur
   * are not a theme decision — how dark the cast is, is. A 50%-black 22px cast
   * is what puts a popover in front of near-black; dropped on paper unchanged
   * it is a grey smudge under a white card, which is the one way a light theme
   * reads as unfinished no matter how well the palette is tuned.
   */
  shadow: {
    cast: { dark: "rgba(0,0,0,0.5)", light: `color-mix(in srgb, ${INK} 16%, transparent)` },
    ring: { dark: "rgba(0,0,0,0.6)", light: `color-mix(in srgb, ${INK} 14%, transparent)` },
    castSoft: { dark: "rgba(0,0,0,0.4)", light: `color-mix(in srgb, ${INK} 12%, transparent)` },
  },
} as const satisfies Record<string, Record<string, { dark: string; light: string }>>

export type ThemeName = "dark" | "light"

/** Both of them, in the order `css/base.ts` emits them and tests iterate them. */
export const THEMES = ["dark", "light"] as const satisfies readonly ThemeName[]

/**
 * The custom property a role is carried by: `bgRaised` -> `--de-color-bg-raised`.
 *
 * Derived rather than written out beside each role, so the reference and the
 * declaration cannot drift into naming two different properties — which is the
 * one typo in this file that produces no error anywhere, just an unresolved
 * `var()` and a transparent surface.
 */
const customProperty = (group: string, role: string) =>
  `--de-${group}-${role.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`

/**
 * The whole group as references — each one carrying the dark value as a
 * FALLBACK, which is not belt and braces.
 *
 * A bare `var(--de-color-bg)` resolves to nothing on any page that does not
 * carry the palette, and "invalid at computed-value time" is not a missing
 * background, it is an inherited or initial one: transparent surfaces, black
 * text, an unreadable screen. One such page exists in this package and it is
 * not hypothetical — `runtime/start-screen-style.mjs` imports this module
 * directly and aliases every role into its own `:root` block for the chooser,
 * which is a separate document with no editor root and no `css/base.ts` in it.
 * Without the fallback that screen loses its entire palette the moment these
 * tokens stop being literals.
 *
 * Dark is the right fallback for the same reason it is the default theme: it is
 * what the editor has always looked like, and the chooser is hard-coded to it.
 * This does not become a second source of truth — the fallback is generated
 * from the same `PALETTE` row as the declaration it stands in for, so there is
 * still exactly one place to edit a colour.
 */
function references<T extends Record<string, { dark: string }>>(
  group: string,
  roles: T
): { [K in keyof T]: string } {
  const out = {} as { [K in keyof T]: string }
  for (const role of Object.keys(roles) as Array<keyof T & string>) {
    out[role] = `var(${customProperty(group, role)}, ${roles[role].dark})`
  }
  return out
}

/**
 * One theme's declarations, for `css/base.ts` to wrap in a selector.
 *
 * The values live here, beside the role they name and its reasoning, and the
 * SELECTOR lives in the stylesheet that owns the document — which is the same
 * split every other token in this file already has. A designer changing the
 * palette opens this file and only this file.
 */
export function themeDeclarations(theme: ThemeName, indent = "  "): string {
  return Object.entries(PALETTE)
    .flatMap(([group, roles]) =>
      Object.entries(roles).map(
        ([role, value]) => `${indent}${customProperty(group, role)}: ${value[theme]};`
      )
    )
    .join("\n")
}

/**
 * `@property` registrations for every palette role, so the theme can CROSSFADE.
 *
 * A plain custom property is an untyped token as far as the cascade is
 * concerned: the browser has no idea `--de-color-bg` holds a colour, so it
 * cannot interpolate one value into another and a `transition` naming it is a
 * no-op. That is why flipping the theme repainted the entire chrome between two
 * frames — not an oversight in the stylesheet, but a thing the stylesheet could
 * not express.
 *
 * Registering each role with `syntax: "<color>"` is what makes them animatable.
 * Nothing else changes: the values, the fallbacks and the two-selector split in
 * `css/base.ts` are all exactly as they were, and `css/base.ts` is still the
 * only place that decides WHICH theme is up.
 *
 * `inherits: true` because that is what these already do and what every
 * `var()` call site depends on — a popover mounted on `<body>` resolves the
 * palette by inheriting it from `:root`.
 *
 * The initial value is the DARK one, matching the `references()` fallback above
 * and for the same reason: dark is what the editor is when nothing has said
 * otherwise. Generated from the same `PALETTE` row rather than restated, so a
 * registration cannot drift from the declaration it types.
 *
 * Shadows and code tints are registered too — they are colours, they are in
 * `PALETTE`, and a crossfade that took the surfaces but left the casts behind
 * would be a worse artefact than no crossfade at all.
 *
 * A malformed registration is dropped by the parser rather than throwing, and
 * an unregistered property still works exactly as it does today; so a browser
 * that does not support `@property` loses the crossfade and keeps the theme.
 */
export function themeRegistrations(): string {
  return Object.entries(PALETTE)
    .flatMap(([group, roles]) =>
      Object.entries(roles).map(
        ([role, value]) =>
          `@property ${customProperty(group, role)} {\n` +
          `  syntax: "<color>";\n` +
          `  inherits: true;\n` +
          `  initial-value: ${value.dark};\n` +
          `}`
      )
    )
    .join("\n")
}

/** Every custom property the palette defines, for the suite that pins them. */
export const themeProperties = (): string[] =>
  Object.entries(PALETTE).flatMap(([group, roles]) =>
    Object.keys(roles).map((role) => customProperty(group, role))
  )

const { cast, castSoft, ring } = references("shadow", PALETTE.shadow)

export const tokens = {
  color: references("color", PALETTE.color),
  code: references("code", PALETTE.code),
  /*
   * The design kit's radius scale: 4, 8, 12, 16, 20, 24, 28, 32, 36.
   *
   * The role names are unchanged so no call site moves, but every value did:
   * the old ramp was 2/4/6/10, which is half this one and reads as a different
   * product beside it. A `50%` circle is still written as `50%` at the call
   * site — a pill is not a step on a radius scale, it is the absence of one.
   */
  radius: {
    /** The tightest corner the kit has. Chips, swatches, inline marks. */
    sm: "4px",
    /** Controls: fields, buttons, rows. */
    md: "8px",
    /** Cards and grouped containers. */
    lg: "12px",
    /** Panels and popovers. */
    xl: "16px",
    /** Larger surfaces, up the kit's own scale. */
    "2xl": "20px",
    "3xl": "24px",
    "4xl": "28px",
    "5xl": "32px",
    "6xl": "36px",
  },
  /*
   * Every corner in the chrome is a squircle, and this is the only place the
   * curve is chosen.
   *
   * `border-radius` sets how BIG a corner is; `corner-shape` sets what curve is
   * drawn inside it. A plain radius draws a circular arc, which meets the
   * straight edge at a curvature discontinuity — the thing the eye reads as a
   * corner being "stuck on" rather than the side flowing into it. A superellipse
   * has no such break, which is why Apple's icons, and Figma's smoothing
   * slider, are this shape and not an arc.
   *
   * `superellipse(2)` is the `squircle` keyword spelled out, and it is the
   * strongest smoothing this chrome can actually carry. The keyword is not used
   * because a bare word gives the next person nothing to turn; the number does.
   *
   * Higher is NOT better here, and the radii are the reason. The whole chrome
   * draws at 4, 8, 12 and 16px, and `superellipse()` — unlike Figma's slider,
   * which scales its smoothing against the shape — applies the same exponent
   * whatever the radius. At K=3 a 4px corner is already square to the eye and
   * at K=4 the 8px one is too: dialling "smoothing" up past 2 does not make
   * these corners smoother, it deletes them. Verified by rendering the kit's
   * radii at K = 1, 2, 2.5, 3 and 4 side by side.
   */
  cornerShape: "superellipse(2)",
  /*
   * Two shadows, and both are for surfaces that genuinely float.
   *
   * There is no panel shadow here on purpose. The side panels are docked —
   * flush to the viewport, nothing overlapping — so they are beside the app
   * rather than in front of it, and a hairline is the whole boundary they
   * need. Every cast tried on them (a ring-plus-halo, then a directional
   * one) only fogged a strip of the product with a gradient it had not asked
   * for. If a docked surface is ever added, it does not want one of these.
   *
   * The geometry is literal and the tint is a variable, so a theme can change
   * how dark a cast is without any theme being able to change how far a surface
   * floats. Those are two different decisions and only one of them is a colour.
   */
  shadow: {
    popover: `0 6px 22px ${cast}, 0 0 0 0.5px ${ring}`,
    /**
     * A surface that hangs over the product rather than docking to an edge.
     *
     * The toolbar pill and the launcher both float in the middle of the screen
     * over live product pixels of an unknown colour, where a tight cast reads
     * as a rectangle pasted on rather than as something in front. Wide, and
     * hung below the element, is what puts air underneath.
     *
     * TWO LAYERS, like `popover`, and the second one is the edge.
     *
     * It was one layer for a long time, and the consequence was that its three
     * users each solved the edge themselves: the launcher and the bar added a
     * real `border: 1px solid border`, and the drag ghost added nothing and had
     * no edge at all. A wide soft cast fades to nothing at the rim, so on a page
     * whose colour happens to sit near `color.bg` the surface has no boundary —
     * which is the failure a `float` surface is most exposed to, because the
     * page under it belongs to someone else and cannot be tuned.
     *
     * A border is the wrong instrument for it anyway, and this kit says so
     * twice already: `shadow.marker` replaced a pin's border with an inset
     * hairline because a real border grew the 22px disc to 24 and laid a hard
     * line between the fill and the page, and `css/annotations.ts` fixed the
     * same problem on the note hint by reaching for `popover`'s ring. A
     * `0 0 0 0.5px` layer costs no layout, cannot be knocked off the pixel grid
     * by a radius, and rides the cast instead of fighting it.
     *
     * Same `ring` tint as `popover`, not a new value: these are the same
     * decision — "where does this surface end" — made for two distances.
     */
    float: `0 8px 30px ${castSoft}, 0 0 0 0.5px ${ring}`,
    /**
     * The note pin's lift and its edge, in one declaration — Agentation's pair.
     *
     * Deliberately NOT theme-referenced, unlike `popover` and `float` above.
     * Those hang over the editor's own surfaces, so their cast is mixed against
     * the theme's ink; a pin hangs over the app being edited, where the theme is
     * not evidence about what is behind it. Fixed black at low alpha is the only
     * cast that behaves the same on a white page and a dark one.
     *
     * The second layer is an INSET hairline, and it is the pin's border. Drawing
     * a real `border` would grow the 22px disc to 24 and lay a hard line between
     * the fill and the page; an inset shadow darkens the fill's own rim instead,
     * which reads as the disc curving away rather than as a ring on top of it.
     * 0.04 is nearly nothing on purpose — enough to stop a light pin dissolving
     * into a light page, not enough to be seen as an outline.
     *
     * Tight, too: `0 2px 6px` against `popover`'s `0 6px 22px`. A 22px disc with
     * a 22px blur under it reads as a balloon; the pin is supposed to sit ON the
     * page it is marking, close enough that the shadow says "attached here".
     */
    marker: "0 2px 6px rgba(0, 0, 0, 0.2), inset 0 0 0 1px rgba(0, 0, 0, 0.04)",
  },
  font: {
    /** `--font-sans`. The face the product ships, not next/font Inter. */
    ui: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "SF Pro", ui-sans-serif, system-ui, sans-serif',
    mono: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
  },
  /**
   * One type scale for the whole shell. Editor chrome is denser than the
   * product's 14px body on purpose — but the density lives here, once, so a
   * surface picks a role rather than a number.
   */
  /*
   * Three steps, floor 10.
   *
   * This ramp has now been moved twice and both moves were right at the time.
   * It began 11/10/9, which is where density lands if it is tuned on a 27-inch
   * display and never rechecked; it went to 13/12/12 when the brief was a hard
   * 12px floor, which bought legibility and spent it on a `micro` rung that was
   * no longer a rung at all. The floor is 10 now, so all three steps are real
   * again and the body rung comes back down to the density a 260px panel wants.
   *
   * 10 is for a mark, not for prose: an eyebrow, a type tag, a numeral in a
   * chip. Anything a person reads a sentence of belongs on `body`.
   */
  type: {
    /** Panel rows, field labels, tool labels. The editor's body. */
    body: "12px",
    /** Group headers and hints. Density, not tone — use sparingly. */
    caption: "11px",
    /** The floor. Eyebrows and type tags, and only where a word is a label. */
    micro: "10px",
    weightBody: 400,
    weightValue: 500,
    weightSection: 600,
    /*
     * AND THE LEADING, WHICH THIS SCALE DID NOT HAVE.
     *
     * A type scale that ships three sizes and no line-heights is two thirds of
     * a scale: a role is "a size, a leading and a weight" and only two of those
     * were ever a decision anybody could look up. What the stylesheets did
     * instead is exactly what happens when there is nothing to name — a survey
     * of `css/` found `1`, `1.4`, `1.45`, `1.5`, `1.55`, `14px`, `15px` and
     * `16px` in 40 declarations, which is not five roles, it is eight numbers
     * that happen to be near each other. 1.4 and 1.45 differ by 0.6px at the
     * body rung and nothing anywhere said which of them a wrapping sentence was
     * supposed to take.
     *
     * UNITLESS, so a line box scales with the size it is set on. The four
     * px-valued leadings this replaces did the opposite: the root's `16px`
     * inherited down onto a `micro` eyebrow as 1.6 and onto `body` as 1.33, so
     * the tightest leading in the chrome landed on the rung that reads
     * sentences and the loosest on the rung that never wraps at all.
     *
     * Four roles, and the boundary between the first two is the one that
     * matters — `better-typography` puts the floor for anything wrapping to
     * three lines at 1.4 even in a height-constrained row, and every value
     * below that floor in this chrome was on prose.
     */
    /** A single line centred in a box of its own: a numeral in a disc, a chip. */
    leadingFlush: 1,
    /**
     * The chrome's default, and the floor for text that wraps inside a row of
     * fixed height. 16.8px at the body rung, against the 16px flat it replaces.
     */
    leadingRow: 1.4,
    /**
     * Prose: a hint, a description, an empty state, a composer. The bottom of
     * the 1.5–1.6 band a reader wants, picked rather than the top because a
     * 240px panel pays for every pixel of leading twice — once per line and
     * again in how much of the list is left on screen under it.
     */
    leadingBody: 1.5,
    /**
     * Code, which wants more air than prose and not less.
     *
     * Monospace sets denser than the UI face at the same size — every glyph is
     * the width of the widest one — so a code slab at body leading reads as a
     * block rather than as lines. This is also the only leading in the chrome
     * applied to text that is WRAPPED but must still be counted in logical
     * lines, and a wrapped continuation has to be visibly nearer its own line
     * than the next one.
     */
    leadingCode: 1.55,
    /**
     * THE MEASURE, which this scale did not have either.
     *
     * A role is a size, a leading, a weight — and, for anything anybody reads a
     * SENTENCE of, a maximum line length. Past roughly 75 characters the eye
     * loses the start of the next line on the return sweep, which is why the
     * long-standing advice is 60–75; 62 is inside that band and is already the
     * number this chrome picked once, by hand, on `.de-shortcut-note`.
     *
     * It matters more here than it does on a web page, because these panels are
     * RESIZABLE. `size.panelMax` lets the inspector out to 38% of the viewport,
     * so a component description that reads at a comfortable 55 characters on a
     * 1280px laptop is ~87 on a 1440 and ~155 on a 2560 — and it is the reader
     * with the biggest display who gets the least readable prose, which is
     * backwards.
     *
     * `ch` rather than `px` on purpose: the cap is a statement about characters
     * per line, and `ch` is the one unit that keeps meaning that if the type
     * scale ever moves.
     *
     * For PROSE only. A row, a label, a value and a path all want the width
     * they are given — capping those would leave a panel with a ragged right
     * edge and no reason for it.
     */
    measure: "62ch",
  },
  /**
   * The design kit's spacing scale: 2, 4, 8, 12, 14, 16, 18, 20, 24, 30, 36.
   *
   * There was no scale before this, only numbers: a survey of the stylesheets
   * found 1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 16 and 24 in use, which is not a
   * system, it is twelve separate decisions that happened to be near each
   * other. Six of those values are not on the kit's scale at all.
   *
   * Numbers, not strings, so arithmetic at a call site stays honest — a rule
   * that needs `space.md * 2` should say so rather than interpolate a string
   * and hope. The `px` is added where it is written.
   */
  space: {
    /** A hairline gap: the space inside a chip, between a glyph and its word. */
    xs: 2,
    /** The default tight step. Row padding, icon-to-label. */
    sm: 4,
    /** The workhorse. Gaps between controls in a row. */
    md: 8,
    /** Between groups of controls. */
    lg: 12,
    xl: 14,
    "2xl": 16,
    "3xl": 18,
    "4xl": 20,
    /** Between sections of a panel. */
    "5xl": 24,
    "6xl": 30,
    "7xl": 36,
  },
  /**
   * The glyph ramp: 10, 12, 16, 20, 24, 32. Every icon in the chrome is one of them.
   *
   * It used to be seven sizes — 10, 12, 13, 14, 16, 18, 20 — arrived at one
   * call site at a time, and the two that did the damage were the odd ones: a
   * 13px tab mark and a 14px align mark, each a single step off the 12 and 16
   * beside them. A step that small is not read as a smaller icon, it is read as
   * a blurrier one, because it lands the same drawing on a different subpixel
   * grid. Five values, each a clear step from the next, is what makes two icons
   * either obviously the same size or obviously different.
   *
   * Roles rather than numbers at the call site, for the reason the type scale
   * above gives: a surface should pick what the glyph is FOR. The numbers are
   * here so the ramp can be read in one place, and `IconSize` in `core/icons`
   * makes anything off it a type error rather than a review note.
   */
  icon: {
    /**
     * The floor, and a mark rather than a control: a numeral in a chip, a
     * twisty, an inline dot beside a label. Nothing you press lives here — a
     * 10px hit target is not one, and the row actions that briefly sat at this
     * end of the ramp are the reason the panel read as too small.
     */
    mark: 10,
    /** Dense panel rows: chips, tree glyphs, inline marks. */
    row: 12,
    /** The default. Toolbar controls, tabs, and panel tool buttons. */
    control: 16,
    /** A glyph alone on a surface of its own — today, the floating launcher. */
    launcher: 20,
    /** Empty states, where the mark is the largest thing in the box. */
    display: 24,
    /** The top of the ramp. Nothing draws here yet; a hero slot would. */
    hero: 32,
  },
  size: {
    toolbarHeight: 36,
    panelInset: 12,
    /*
     * The width a panel STARTS at, not the width it stays at.
     *
     * Both panels are draggable (see `shell/resize.ts`), so these are two
     * things at once: the default the chrome mounts with, and the width a
     * double-click on the seam resets to. They are still the only widths baked
     * into the stylesheet, which is what makes a failed boot look like the
     * editor always did rather than like a layout with no numbers in it.
     */
    panelWidth: 240,
    inspectorWidth: 260,
    /*
     * How far either panel may be dragged, and the floor the canvas keeps.
     *
     * The minimums are where the panel's own content stops being a form. The
     * layers tree needs room for a chevron, a type glyph and enough of a name
     * to tell two siblings apart; the inspector is the tighter of the two
     * because its rows are 1fr-1fr grids, and under about 200px a pair of
     * number fields stops being two fields and becomes two boxes.
     *
     * The maximums are SHARES rather than pixels, because the thing they are
     * protecting is a share: the canvas. A 480px cap is generous on a 27-inch
     * display and swallows the whole page on a laptop, which is the case where
     * a cap matters at all. `canvasMin` is the same protection from the other
     * end, for the window narrow enough that the two shares still leave nothing
     * worth looking at between them.
     */
    panelMinWidth: 180,
    panelMaxShare: 0.34,
    inspectorMinWidth: 200,
    inspectorMaxShare: 0.38,
    canvasMinWidth: 320,
    /**
     * The grab strip on a panel seam, centred on the hairline.
     *
     * Half of it lies over the panel and half over the app, so the target is
     * the same size whichever side you approach from. 8 is what `motion-panels`
     * uses for a fine pointer and it is also the smallest strip that can be
     * hit without aiming; a coarse pointer gets the library's own wider margin
     * on top, from its hit test rather than from this box.
     */
    separatorHit: 8,
    /** Panel rows and fields. */
    rowHeight: 24,
    /** Section headers: taller than a row so the fold target is unmissable. */
    sectionHeader: 32,
    /** Trailing row affordances (eye, remove) and header adds. */
    miniSize: 18,
    /** Toolbar hit targets: larger on purpose, they are pointer-first. */
    toolSize: 28,
    /**
     * Both panels' tab strips. Tall enough to be a landmark, not a row: 8px of
     * air above and below a 24px pill, where 34 left the pills pressed against
     * the app chooser over them and the first section under them.
     */
    tabBar: 40,
    /**
     * The left panel's app chooser, the band above everything else in the
     * chrome. Taller than a section header because it heads the whole panel,
     * not one section of it.
     */
    panelHeader: 44,
    /** Handles, guides, and the marquee all share one hairline. */
    hairline: 1,
  },
  /** Shared curve for occasional controls; high-frequency selection chrome stays instant. */
  ease: "cubic-bezier(0.32, 0.72, 0, 1)",
  /**
   * One curve that overshoots, for the one thing that should feel like an
   * object arriving rather than a value changing: the launcher popping in.
   *
   * Bounce this small (the curve passes 1 at about 60% and settles back) is the
   * top of the range UI can carry — anything springier belongs to drag, where
   * the user supplied the energy. Nothing in a panel uses it; a field that
   * bounced would read as a bug.
   */
  easeSpring: "cubic-bezier(0.34, 1.2, 0.64, 1)",
  duration: {
    /**
     * The bottom rung: a change you register without watching it happen.
     *
     * For a surface that only crossfades — no travel to follow — on a control
     * pressed many times a session. At this length the eye reads "it went"
     * rather than "it is going", which is the point: the toolbar is not telling
     * you a story about leaving, it is getting out of the way. Much below this
     * and the crossfade stops doing its one job, which is to keep the change
     * from registering as a flicker.
     */
    snap: "70ms",
    fast: "120ms",
    base: "180ms",
    /**
     * A whole surface crossing the screen edge. Longer than `base` because the
     * distance is the panel's own width rather than a few pixels of hover, and
     * still under the 300ms where UI starts to feel like it is waiting for you.
     */
    drawer: "240ms",
  },
} as const

export type Tokens = typeof tokens

/**
 * A filled accent surface and the ink that rides on it, as ONE declaration.
 *
 * The fill and its foreground are not two decisions. While the accent was
 * Figma's dark blue a call site could write `background: accentSurface` alone
 * and inherit the shell's white ink harmlessly; against the design system's
 * light indigo that same line lands at 1.9:1 and the label disappears. Five
 * call sites were already written that way. Emitting both properties together
 * means the wrong pairing cannot be written — the same reason `glyph-plate.ts`
 * owns a fill and a radius rather than exporting a colour.
 *
 * Written through the TOKENS rather than through `RAIL`/`ON_RAIL`, which it
 * used to be. The two literals only happened to equal `accentSurface` and
 * `onAccent`; with two themes they are the dark theme's half of a pair, so
 * spelling them here would have pinned every accent-filled surface in the
 * chrome — nine of them — to a light indigo under near-black ink whichever
 * theme was up. On paper that is the 1.9:1 this export exists to prevent,
 * reintroduced by the export itself.
 */
export const accentFill = `background: ${tokens.color.accentSurface}; color: ${tokens.color.onAccent};`
export const accentFillHover = `background: ${tokens.color.accentSurfaceHover}; color: ${tokens.color.onAccent};`

/**
 * The accent fill for a surface with a WORD on it.
 *
 * Same pairing, one step darker, because the floor is different: `accentFill`
 * is Figma's `bg-brand` at 3.53:1 under white in dark and 4.23:1 in light,
 * which clears the 3:1 a non-text component owes and not the 4.5:1 a 12px
 * label owes. The two call sites that need this are the primary button and the
 * tab's count badge.
 *
 * Emitted as a pair for the same reason `accentFill` is: a call site that set
 * only the background would inherit whatever ink the surface around it had, and
 * the whole point of these two constants is that the wrong pairing cannot be
 * written.
 */
export const accentFillText = `background: ${tokens.color.accentSurfaceText}; color: ${tokens.color.onAccent};`
export const accentFillTextHover = `background: ${tokens.color.accentSurfaceTextHover}; color: ${tokens.color.onAccent};`

/* ---------- concentric corners ---------- */

/**
 * A container's padding and its children's radius, derived together.
 *
 * Two rounded rectangles, one inside the other, look WRONG unless their corners
 * share a centre. The rule is the offset-curve one: move a curve of radius R
 * inward by p and you get a curve of radius R − p, clamped at zero because a
 * corner cannot bend backwards. So the inner radius is not a taste decision and
 * it is not a step to be picked off the scale — it FALLS OUT of the outer
 * radius and the distance between the two shapes.
 *
 * The clamp is the whole edge case: once the inset reaches the radius, the
 * corner has been eroded away and the child is square. Past that point the
 * naive subtraction goes negative and, if you take its absolute value, starts
 * growing again — a child that rounds back off as you pad it further.
 *
 * `hairline` is the part nobody gets right, and it is why this is a function
 * instead of a comment. `border-radius` is measured on the element's OUTER
 * edge, so a 1px border sits between the two curves and counts toward the
 * offset exactly as padding does. The toolbar had `border: 1px` + `padding: 4px`
 * around 12px children under a 16px pill and read as concentric in the source —
 * it was off by one on screen for as long as it existed, because the true gap
 * was 5. Declaring the INSET and letting this subtract the border is what stops
 * that arithmetic being done by eye at each call site.
 *
 * It throws rather than returning a wrong-looking number, and that is
 * deliberate. These calls run when the stylesheet module is EVALUATED, so an
 * inset that does not land back on the radius ramp takes down every test that
 * imports the sheet — `npm test` names the container and the arithmetic. Not
 * `npm run build`: esbuild bundles this file without running it, so a bad nest
 * compiles perfectly and then throws the first time anything loads it.
 *
 * The ramp moves in steps of 4 and a hairline is 1, so the mistake it catches
 * is nearly always one of two — an inset that forgot the border, or a padding
 * taken from the spacing scale's odd rungs (2, 14, 18, 30). Both land the child
 * between two steps of a scale the rest of the chrome is drawn on.
 */
export interface Nest {
  /** The container this describes, quoted back in errors and by the guard. */
  readonly of: string
  /** The container's own radius. Always a step on the ramp. */
  readonly outer: string
  /** The gap between the two curves: the container's border plus its padding. */
  readonly inset: number
  /** How much of that gap the container's own border eats. */
  readonly hairline: number
  /**
   * Which rule writes the `padding` — the container itself, unless a bare
   * wrapper between it and the children is what actually holds them off.
   *
   * `.de-ann-box` is the case this exists for: it has no padding at all, and
   * the 4px separating its curve from its rows belongs to `.de-ann-list` in
   * between. The gap is just as real and the arithmetic is unchanged; what
   * changes is where the resulting number has to be written, and a guard that
   * assumed the container always wrote it went looking for a declaration that
   * was never going to be there.
   */
  readonly padOn: string
  /** What `padOn` writes for `padding`, so the gap measures `inset`. */
  readonly padding: string
  /** What a child tucked into one of the container's corners writes. */
  readonly radius: string
}

const RAMP = Object.values(tokens.radius).map((step) => Number.parseFloat(step))

const declared: Nest[] = []

export const nest = (spec: {
  of: string
  outer: string
  inset: number
  /** Default 0. Pass the container's border-width when it has one. */
  hairline?: number
  /** Defaults to `of`. Name the wrapper when the padding lives on one. */
  padOn?: string
}): Nest => {
  const { of, outer, inset, hairline = 0, padOn = spec.of } = spec
  /*
   * Pixels, spelled out, and nothing else.
   *
   * `parseFloat("50%")` is 50, so a percentage waved straight through here and
   * came out the other side as a fifty-pixel corner. A percentage radius is not
   * a length at all — it resolves against the box, which is why `50%` is how
   * this chrome draws a circle — and a circle has no corner for anything to be
   * concentric with. Same for a pill: a radius at or past half the height is
   * the ABSENCE of a step on the ramp, so subtracting from it means nothing.
   */
  if (!/^-?\d+(\.\d+)?px$/.test(outer)) {
    throw new Error(
      `nest(${of}): outer radius ${outer} is not a length in px — a circle or a pill has no corner to nest inside`
    )
  }
  const R = Number.parseFloat(outer)
  if (inset < hairline) {
    throw new Error(`nest(${of}): inset ${inset} is smaller than its own ${hairline}px border`)
  }
  const inner = Math.max(R - inset, 0)
  if (inner !== 0 && !RAMP.includes(inner)) {
    throw new Error(
      `nest(${of}): ${R} − ${inset} = ${inner}, which is not on the radius ramp ` +
        `(${RAMP.join(", ")}). Move the inset to a multiple of 4 counting the ` +
        `${hairline}px border, or square the corner off.`
    )
  }
  const built: Nest = {
    of,
    outer,
    inset,
    hairline,
    padOn,
    padding: `${inset - hairline}px`,
    radius: `${inner}px`,
  }
  declared.push(built)
  return built
}

/**
 * Every nest built this run, in declaration order.
 *
 * The stylesheet is assembled by importing every module in `css/`, so by the
 * time `shellCss` exists this holds the chrome's complete set of nested
 * corners. `test/concentric-cases.mjs` reads it and checks each one against the
 * CSS that was actually emitted — which is what catches the other half of the
 * problem this file cannot see on its own: a `nest()` declared correctly and
 * then not used, or used by a child that quietly overrides it later in the
 * cascade.
 */
export const declaredNests = (): readonly Nest[] => declared
