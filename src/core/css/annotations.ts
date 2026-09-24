/**
 * Annotations: the markers drawn over the app, and the tab that lists them.
 *
 * One module for two surfaces, because they are two halves of one object. A
 * note is a numbered pin on the canvas AND a row in the panel, and the number
 * is the only thing joining them — so the disc on the page and the disc in the
 * row have to be cut from the same rule or the mapping stops being readable
 * the moment either one drifts.
 *
 * The marker colour is the user's, not ours. `--de-ann-color` is written at
 * runtime from `AnnotationSettings.markerColor`, because a designer annotating
 * a red page needs a marker that is not red. Every rule that paints it reads
 * the property with a fallback rather than a token, and nothing here may assume
 * what it resolves to — which is why every distinction below carries a
 * non-colour channel as well.
 *
 * Every text run in a panel row is a single line with an ellipsis, for the
 * reason prompts.ts already documents: a 260px panel plus one long value pushes
 * a row to four lines and the list stops being scannable, which is the only
 * thing a list is for. The untruncated text goes in the `title`.
 */

import { tokens as t, nest } from "../tokens"

/**
 * The pin, in px, and the disc that stands for it in a panel row.
 *
 * Two numbers rather than one: the canvas pin has a whole product page to be
 * found on and the row badge has a 260px column, so they are not the same
 * object at two sizes. They are written together here so a change to the pin
 * is made in sight of the thing that has to keep matching it.
 */
const MARKER = 22
const INDEX = 16

/**
 * How small a glyph gets while it is the one leaving.
 *
 * Agentation's own number, and it is worth keeping rather than rounding to a
 * token: at 0.8 a 12px mark loses 2.4px across its diagonal, which the eye
 * reads as a direction without ever resolving a size. Deeper and the outgoing
 * glyph collapses to a dot; shallower and the two marks look like one mark
 * blurring into another.
 */
const SWAP_SCALE = 0.8

/**
 * The composer card, the textarea filling its top, and the Save button in its
 * bottom corner.
 *
 * Unusually for this chrome the offset here is a real distance rather than a
 * thin rail: `space.md` between the two curves, because the card is a popover
 * with room in it and not a pill wrapped around a row. Both of the things that
 * reach its corners are ordinary `radius.md` furniture — a field and a button,
 * at the size they are everywhere else — so the inset fixes what the OUTER
 * radius has to be, and the answer is `radius.xl`, not the `radius.lg` this was
 * drawn at.
 *
 * Solving it from the outside is what makes it right rather than merely
 * consistent. Going the other way — keeping `lg` and taking the children down
 * to `radius.sm` — is equally concentric and much worse: `.de-button` is shared
 * furniture, so it would mean a button that rounds differently depending on
 * which surface it is standing on. And `xl` is the token this card should have
 * had from the start; the scale calls `lg` a card and `xl` a popover, and a
 * floating composer anchored to a pin is the second thing.
 */
const COMPOSER = nest({ of: ".de-ann-composer", outer: t.radius.xl, inset: t.space.md, hairline: 1 })

/*
 * THE OUTBOX HAS NO BOX, and the nest that described one went with it.
 *
 * `BOX` used to declare `.de-ann-box` at `radius.lg` over a 4px inset carried
 * by `.de-ann-list` — the only nest in the chrome whose padding lived on a
 * wrapper rather than on the container itself, and the reason `nest()` grew its
 * `padOn` parameter. What it described was a bordered, rounded, sunken frame
 * around rows that are each already bordered, rounded and raised. Removing the
 * frame removes the only pair of curves there was anything to keep parallel.
 *
 * `padOn` stays on `nest()`. It is still the honest way to describe a container
 * holding a child at a distance it does not declare itself, and the next person
 * to need it should not have to rediscover that it exists.
 */

/**
 * A row, and the two `.de-mini` buttons parked in its top-right corner.
 *
 * The row is a two-column grid — text, then an `auto` column of actions — so
 * the thing in the corner is a button, not the head.
 *
 * IT GOT ROOMIER, AND THE RADIUS HAD TO MOVE WITH IT.
 *
 * The inset was `space.sm`: 4px less a 1px hairline, so a 3px gap between the
 * row's edge and the sentence inside it. That was sized for life inside
 * `.de-ann-box`, where the frame supplied the air and the row could not afford
 * its own; with the frame gone the rows are the only objects in the list and
 * 3px reads as text pressed against a border. `space.md` doubles it to a 7px
 * pad inside an 8px gap.
 *
 * The corner follows, and not for taste: the `.de-mini` in the top-right sits
 * at the nest's inner radius, and `radius.md` less 8 clamps to zero — square
 * buttons inside a rounded row. Stepping the row up to `radius.lg` puts the
 * inner radius back on 4, which is the `radius.sm` those buttons already draw.
 * The two numbers are one decision: a roomier row is a rounder row, or its
 * corner stops being parallel to anything.
 */
const ITEM = nest({ of: ".de-ann-item", outer: t.radius.lg, inset: t.space.md, hairline: 1 })

/**
 * How much the pin grows when the panel points at it.
 *
 * Small on purpose. The pin sits over someone else's layout, so a pop big
 * enough to be a gesture would also be big enough to cover the thing the note
 * is about — at ${MARKER}px this is under three pixels of growth, which the eye catches
 * as movement without the disc taking any more of the page.
 */
const ACTIVE_SCALE = 1.12

/**
 * The tab's gutter, and the air between the two stacked sections.
 *
 * The tab is one column now — Notes, then Settings — so the only thing telling
 * a reader where one section ends is the space under it. `space.md` is the
 * panel's own inset everywhere else; `space.2xl` is twice that, which is the
 * smallest step on the kit's scale that still reads as "a different section"
 * rather than "a wider row gap" once the section titles are as quiet as they
 * are below.
 */
const GUTTER = t.space.md
const SECTION_GAP = t.space["2xl"]

/**
 * The floor for anything you have to hit, and the disc beside a setting's name.
 *
 * 24 is the pointer target WCAG 2.5.8 asks for and the height of every field
 * in this shell, so a control that draws smaller earns its hit area back from
 * a transparent pad rather than by growing.
 *
 * 14 was sized for the settings checkbox that used to share it — a 14px box
 * has a 12px padding box and an INTEGER centre at 1x and at 2x, where 13 put
 * the centre on 5.5 and landed the tick's 1.5px strokes between pixels. The
 * checkbox is gone and the number stays: the help dot is the only thing left
 * on it, and at 14 the ${t.icon.row}px glyph inside sits inside its own circle, which 13
 * could not do.
 */
const TARGET = 24
const CHECK = 14

/**
 * The overlay's rung, and the composer's stated one above it.
 *
 * Written relative rather than as two literals so they cannot drift. The
 * composer has to beat the markers it is anchored to whether it is mounted
 * inside the layer or beside it, and a second literal is how that stops being
 * true after someone renumbers one of them.
 *
 * The band is the one `options.ts` uses for a fixed surface that is NOT inside
 * `.de-root`'s stacking context — annotation chrome outlives a chrome-hidden
 * editor, so it cannot borrow the 1/2/3 ordering base.ts gives `.de-root`'s
 * own children.
 */
const LAYER_Z = 2147483100
const COMPOSER_Z = LAYER_Z + 1

export const annotationsCss = `/* ---------- annotation overlay ---------- */
.de-ann-layer { position: fixed; inset: 0; pointer-events: none; z-index: ${LAYER_Z}; }

/*
 * The pin floats over product pixels of an unknown colour, and it is Agentation's
 * pin: white numeral, Apple-system fill, a tight cast and a hairline of shadow
 * rather than a border.
 *
 * That last part is the bit worth naming, because it is not how the rest of this
 * chrome draws an edge. There is no \`border\` here at all — the disc's boundary
 * is the second layer of \`shadow.marker\`, an INSET hairline, so the edge is
 * painted inside the circle instead of around it. A real border would grow the
 * 22px disc to 24 and put a hard line between the fill and the page; an inset
 * shadow darkens the fill's own rim, which reads as the disc curving away rather
 * than as a ring drawn on top of it. The outer \`0 2px 6px\` cast is what lifts it
 * off the page.
 *
 * White numeral, and it is the fill that earns it. White on a mid-light hue is
 * the pairing this file used to reject — correctly, for the palette it had then,
 * where white bottomed out at 1.95:1 on the old amber. The shipped colour is
 * one of Apple's system hues, chosen as the set white is designed
 * against, and the numeral is fixed white in BOTH themes: the fill is the user's
 * and does not flip with the theme, so neither may its ink. That is what
 * \`onUserColor\` is for — a role that flips is the wrong way to say "fixed",
 * however right it looks in the theme you happen to be in.
 *
 * Not every preset clears 4.5:1 with white on it; yellow in particular cannot,
 * at any weight. \`.de-ann-marker\` answers that with the ink-shadow below rather
 * than by darkening the palette, because the palette IS the thing being matched.
 *
 * The layer is \`pointer-events: none\` so the app underneath stays usable, so
 * the marker has to switch them back on for itself. It is the only thing in
 * here that takes a pointer.
 */
.de-ann-marker {
  position: absolute;
  width: ${MARKER}px; height: ${MARKER}px;
  display: inline-flex; align-items: center; justify-content: center;
  padding: 0;
  border: none; border-radius: 50%;
  background: var(--de-ann-color, ${t.color.danger});
  color: ${t.color.onUserColor};
  box-shadow: ${t.shadow.marker};
  /* 11px/600 — \`caption\` is already Agentation's 0.6875rem, so the pin lands on
     the kit's own rung rather than introducing a size for one element. */
  font-family: inherit; font-size: ${t.type.caption}; font-weight: ${t.type.weightSection};
  line-height: ${t.type.leadingFlush};
  /*
   * The numeral carries its own shadow, and this is the one liberty taken with
   * Agentation's treatment.
   *
   * White on \`#FFCC00\` is 1.4:1. Nothing about weight or size rescues that, and
   * the alternatives were both worse than a shadow: darkening the yellow stops
   * it being the Apple yellow the palette is copied from, and flipping the ink
   * per-preset means two kinds of pin on one page, which is exactly the
   * inconsistency a fixed ink exists to prevent.
   *
   * A 1px contact shadow under the glyph adds a dark edge where white meets
   * yellow, so the numeral has a boundary of its own whatever it sits on. On
   * the dark presets it is invisible; on the light ones it is the difference
   * between a digit and a smudge. Not a blur — a blur at 11px grey-fringes the
   * strokes; a hard 1px offset stays a shape.
   */
  text-shadow: 0 1px 0 rgba(0, 0, 0, 0.32);
  cursor: pointer;
  user-select: none;
  pointer-events: auto;
  /*
   * Agentation's pair, and the split is deliberate: colour eases slower than
   * geometry, so a pin that is both recolouring and growing finishes its move
   * before it finishes its hue and never looks like it is lagging the pointer.
   */
  transition: background-color 150ms ${t.ease}, transform 100ms ${t.ease},
    box-shadow ${t.duration.fast} ${t.ease};
}
/*
 * A PIN LANDING ON THE PAGE, which is the one moment here that is an object
 * arriving rather than a value changing.
 *
 * Saving a note revealed a pooled node with \`display: block\` — not something
 * the browser can animate, so the rule above never had anything to do with the
 * arrival even though it transitions all three of the properties involved.
 *
 * So it is a keyframe, on \`easeSpring\`, which \`tokens.ts\` reserves for exactly
 * this sentence. From 0.3 rather than 0.8: the pin is 22px and lands somewhere
 * the user was not looking, so it has to be caught out of the corner of the eye
 * — a small pop at this size is indistinguishable from the node simply being
 * there. \`canvas.ts\` fires it once per NOTE, never per reveal, so scrolling a
 * pin back into view does not pop it again.
 */
@keyframes de-ann-marker-in { from { opacity: 0; transform: scale(0.3); } }
.de-ann-marker--arriving { animation: de-ann-marker-in ${t.duration.base} ${t.easeSpring}; }
/* ${MARKER}px drawn, ${TARGET}px hit. A pin is a click target on a page it shares with the
   app's own controls, and ${MARKER} is under the ${TARGET} WCAG 2.5.8 asks for; a transparent
   pad buys the 1px a side back without growing the disc. */
.de-ann-marker::before {
  content: "";
  position: absolute; inset: -${(TARGET - MARKER) / 2}px;
  border-radius: 50%;
}
/*
 * Hover grows the pin itself — Agentation's 1.1, not a ring.
 *
 * This used to paint a 3px halo of the marker's own colour, on the reasoning
 * that a ring of itself reads as the same object answering. That reasoning
 * holds, and it is still the wrong move for a 22px disc on someone's page: a
 * halo makes the pin 28px for as long as the pointer is near it, so pins that
 * sit close together start touching on hover and the page looks like it grew
 * something. Scaling changes the pin's size without changing the space it
 * claims from its neighbours.
 *
 * 100ms, from the \`transform\` half of the transition pair on the base rule.
 */
/*
 * ## AND IT IS BEHIND \`hover: hover\`, WHICH ALMOST NOTHING IN THIS CHROME IS
 *
 * There are eighty-odd \`:hover\` rules here and this is one of three that get
 * the wrapper. The other seventy-nine change a background, a border or an ink
 * colour: on a touch device the tint sticks after a tap until the next tap
 * moves it, which is invisible as a defect and not worth doubling the nesting
 * of every stylesheet in the chrome to prevent.
 *
 * A TRANSFORM is different in kind, and this one especially. The pin is drawn
 * over the app being reviewed, not over a surface this editor owns — so a pin
 * left frozen at 110% beside its unhovered neighbours does not read as stale
 * editor chrome, it reads as a rendering fault in the app under review. That is
 * the one thing a design tool must never do to the thing it is measuring.
 *
 * Reachable in practice, not in theory: the servers bind loopback so no phone
 * can open this, but a touchscreen laptop can, and so can DevTools device
 * emulation — which reports \`hover: none\` and is exactly what a designer uses
 * to check their own mobile breakpoints, with this chrome on screen.
 */
@media (hover: hover) {
  .de-ann-marker:hover { transform: scale(1.1); }
}
/*
 * Two tones, because this is the one focus ring in the chrome that lands on a
 * page nobody here chose.
 *
 * Every other control is focused against a surface this stylesheet painted, so
 * a single accent ring has a known ratio behind it. A pin sits on the app being
 * edited, over whatever colour happens to be there, and the accent measured
 * 1.9:1 against a white page — a ring that is visible in the sense that it is
 * a different hue, and invisible in the sense WCAG 1.4.11 means, which is the
 * sense that survives a monochrome display or a red-green deficiency.
 *
 * A dark ring wrapped in a white one cannot fail both ways at once: against
 * light ground the near-black is 16:1, against dark ground the white is, and
 * the pair reads as one ring at any size because they are concentric and
 * adjacent. The colours are the fixed pair, not theme roles — the ring is over
 * the app, so the editor's theme says nothing about what is behind it.
 *
 * \`box-shadow\` for the outer tone rather than a second outline: an element gets
 * one outline, and the shadow is already on this rule's transition so the ring
 * arrives with the same timing as everything else the pin does.
 */
.de-ann-marker:focus-visible {
  /* \`focusCore\`, not \`onUserColor\`: the numeral's ink is white now, and this
     ring's inner tone has to stay dark or the pair is white on white. */
  outline: 2px solid ${t.color.focusCore};
  outline-offset: 2px;
  box-shadow: ${t.shadow.marker}, 0 0 0 6px ${t.color.focusHalo};
}

/*
 * The pin whose ROW the pointer is in — the other half of the correspondence.
 *
 * \`canvas.ts\` puts this class on the one marker the panel is pointing at, and
 * until now there was no rule for it at all: the row lit up and the page did
 * nothing, which reads as the mapping being broken rather than as the pin being
 * somewhere off screen.
 *
 * Three channels, because one is not enough over product pixels of an unknown
 * colour. A ${Math.round((ACTIVE_SCALE - 1) * 100)}% grow is the movement the eye catches in peripheral vision while
 * it is still reading the row; \`z-index\` lifts it out from under the pins it
 * overlaps in a dense corner; and the ring is the part that has to survive any
 * background, so it is TWO rings at opposite ends of the scale — 2px of the
 * chrome's near-black, then 2px of white. Against a white page the dark spacer
 * is the edge, against a dark page the white ring is, and against the user's own
 * marker colour both are.
 *
 * Not the editor accent: an indigo ring around an orange pin reads as a second
 * object arriving, and it says nothing at all if indigo is what the user picked.
 */
.de-ann-marker--active {
  z-index: 1;
  transform: scale(${ACTIVE_SCALE});
  box-shadow: ${t.shadow.marker}, 0 0 0 2px ${t.color.bg}, 0 0 0 4px ${t.color.text};
}

/*
 * The composer, anchored to the pin that opened it.
 *
 * Above the markers, and it has to be: it opens next to one and would otherwise
 * be punched through by the disc it belongs to. \`pointer-events: auto\` for the
 * same reason the marker needs it — the layer around it lets everything fall
 * through to the app.
 */
.de-ann-composer {
  position: absolute;
  z-index: ${COMPOSER_Z};
  display: flex; flex-direction: column; gap: ${t.space.md}px;
  padding: ${COMPOSER.padding};
  border: ${COMPOSER.hairline}px solid ${t.color.border}; border-radius: ${COMPOSER.outer};
  background: ${t.color.bgRaised};
  box-shadow: ${t.shadow.popover};
  pointer-events: auto;
  animation: de-ann-composer-in ${t.duration.fast} ${t.ease};
  /*
   * Aimed at the pin, the same way the chrome's shared \`.de-arrive\` is aimed at
   * its trigger. \`annotations/canvas.ts\`'s \`place\` flips this card above the
   * anchor when dropping below would overrun the viewport — which is most of
   * the time on the lower half of a page — and until now it flipped the
   * POSITION without flipping the entrance, so the composer grew out of its top
   * edge and drifted downward while sitting above the pin it belongs to. The
   * pair of properties is the same one \`core/motion.ts\` writes, so both
   * surfaces move on one decision.
   */
  transform-origin: var(--de-arrive-origin, center top);
}
@keyframes de-ann-composer-in {
  from { opacity: 0; transform: translateY(var(--de-arrive-rise, -4px)); }
}
/*
 * Wide enough for a sentence before it wraps, and it grows DOWN only — as the
 * note is typed, not as a corner is dragged.
 *
 * The grip is off on BOTH axes, which is a change from the \`resize: vertical\`
 * this shipped with. The card is a popover anchored to a pin: \`place\` in
 * \`annotations/canvas.ts\` measures it once, on open, and clamps it between the
 * docked panels and the foot of the window. A drag on the grip resizes it after
 * that measurement and nothing re-places it, so a note taken on the lower half
 * of a page could be dragged until Save sat under the edge of the window, with
 * the only other way out being Escape. Dragging a field also reads as dragging
 * the card, which this popover does not do.
 *
 * Height is still the axis a note needs, so \`openComposer\` grows the field on
 * input up to this ceiling and the field scrolls past it. The ceiling is what
 * keeps the growth bounded where the grip was not: roughly eight lines, longer
 * than any note in the journal, and short enough that the card still fits
 * beside the pin it belongs to.
 */
.de-ann-composer-text {
  min-width: 180px;
  min-height: 56px;
  max-height: 200px;
  overflow-y: auto;
  resize: none;
  padding: ${t.space.md}px;
  /* Read off the card's nest. It resolves to the \`radius.md\` a field wears
     anywhere else, and that is not a coincidence to leave to chance — the card
     was sized around it. See \`COMPOSER\`. */
  border: 1px solid transparent; border-radius: ${COMPOSER.radius};
  background: ${t.color.field};
  color: ${t.color.text};
  font-family: inherit; font-size: ${t.type.body};
  line-height: ${t.type.leadingBody};
  outline: none;
  transition: border-color ${t.duration.fast} ${t.ease}, background ${t.duration.fast} ${t.ease};
}
.de-ann-composer-text:hover { background: ${t.color.fieldHover}; }
.de-ann-composer-text:focus { background: ${t.color.fieldHover}; border-color: ${t.color.accent}; }
.de-ann-composer-text::placeholder { color: ${t.color.textDim}; }
.de-ann-composer-actions { display: flex; align-items: center; justify-content: flex-end; gap: ${t.space.sm}px; }

/*
 * The drag rectangle, while it is being dragged.
 *
 * Dashed, because the box is not committed until the pointer comes up — the
 * same reading the canvas already gives a dashed outline. The wash is mixed
 * from the marker colour rather than from a token so the fill and the stroke
 * are obviously one object over a page whose own colours are unknown.
 */
.de-ann-region {
  position: absolute;
  border: 2px dashed var(--de-ann-color, ${t.color.danger});
  border-radius: ${t.radius.sm};
  background: color-mix(in srgb, var(--de-ann-color, ${t.color.danger}) 14%, transparent);
  pointer-events: none;
  transition: none;
  animation: none;
}

/*
 * The hover outline while annotating — deliberately NOT the selection outline.
 *
 * This is the point of the rule. Annotation mode and inspect mode both draw a
 * frame around whatever is under the pointer, and if the two frames look alike
 * the user cannot tell which one a click is about to do: pin a note, or select
 * an element and start editing it. So this one differs on two channels at once.
 * It is 2px where \`.de-outline\` is a hairline, and it is rounded where the
 * selection frame is square — so it still reads as the other mode if the user
 * has picked indigo as their marker colour and the hue channel says nothing.
 */
.de-ann-target {
  position: absolute;
  border: 2px solid var(--de-ann-color, ${t.color.danger});
  border-radius: ${t.radius.sm};
  background: color-mix(in srgb, var(--de-ann-color, ${t.color.danger}) 8%, transparent);
  pointer-events: none;
  transition: none;
  animation: none;
}

/*
 * What the mode does, said once, at the top.
 *
 * The top edge and not the bottom: the toolbar owns the bottom inset and is
 * centred on the same axis, so a pill down there would land on the bar at any
 * viewport narrow enough to matter. Centred on the CANVAS rather than the
 * viewport, using the toolbar's own pair of variables — \`--de-bar-*\` does not
 * collapse while the chrome is hidden, so the hint does not jump sideways in
 * the frame the panels leave.
 *
 * \`pointer-events: none\`: it is a label, and it sits over the app.
 *
 * Its EDGE is two declarations because the chrome went near-black. A soft cast
 * (\`shadow.float\`) and a \`border\` hairline measuring 1.5:1 against the pill's
 * own fill was the whole boundary, which is nothing at all over a dark page.
 * \`borderStrong\` is a light line that reads on a dark page; \`shadow.popover\`
 * brings the half-pixel dark rule that reads on a light one. Both, because the
 * page is not ours to know — the same argument the marker above makes.
 */
.de-ann-hint {
  position: fixed;
  top: calc(var(--de-top) + 12px);
  left: calc(var(--de-bar-left) + (100vw - var(--de-bar-left) - var(--de-bar-right)) / 2);
  transform: translateX(-50%);
  max-width: calc(100vw - var(--de-bar-left) - var(--de-bar-right) - 24px);
  min-height: 24px;
  display: inline-flex; align-items: center; gap: ${t.space.md}px;
  padding: ${t.space.sm}px ${t.space.md}px;
  border: 1px solid ${t.color.borderStrong}; border-radius: ${t.radius.xl};
  background: ${t.color.bg};
  color: ${t.color.textMuted};
  font-size: ${t.type.body};
  line-height: ${t.type.leadingBody};
  box-shadow: ${t.shadow.popover};
  /*
   * IT WRAPS NOW, BECAUSE IT CANNOT TRUNCATE.
   *
   * This used to be \`white-space: nowrap; overflow: hidden; text-overflow:
   * ellipsis\` two declarations above \`pointer-events: none\`, which is a
   * truncation nobody can ever open: there is no hover, no focus, no press and
   * no second view. The rule on that is not "prefer a tooltip" but "if you cut
   * it, leave a way to the whole of it" — and on a label that is deliberately
   * inert, there is no way to leave one.
   *
   * The string it cuts is annotation mode's only instruction — "Click an
   * element, drag a region, or select text to leave a note" — so the part that
   * goes is the part naming two of the three ways in. At 900px with both panels
   * open it did go.
   *
   * So the fix is the cheapest one available: stop cutting. \`min-height\`
   * replaces the fixed 24 so a second line has somewhere to go, the padding
   * becomes symmetric now that it is not centring a single line in a fixed box,
   * and \`text-wrap: pretty\` keeps a lone word off the last line the way every
   * other wrapped string in this chrome does.
   */
  text-wrap: pretty;
  pointer-events: none;
}

/* ---------- annotations tab ---------- */
/*
 * One column, one scroll, nothing pinned.
 *
 * The tab used to be three things fighting over the pane's height: a list that
 * scrolled inside its own box, a footer that followed it, and a settings block
 * nailed to the bottom edge by \`margin-top: auto\`. Two scrollbars is the visible
 * symptom — the pane's and the list's, four pixels apart — and the invisible one
 * is worse: a note scrolled out of the inner list could not be reached by
 * scrolling the tab, because the wheel was over the wrong box.
 *
 * So the tab is a plain stack now. Notes, then Settings, top to bottom, and the
 * ONE scroll belongs to \`.de-tabpanel\`, which already has \`overflow-y: auto\`
 * from inspector.ts. Nothing in here may set \`overflow-y\` on itself or the
 * second scrollbar comes back.
 *
 * \`flex: 1 0 auto\`: grow to fill a pane taller than the content, never shrink
 * below it. Shrinking is what would clip the last section instead of scrolling
 * to it.
 */
.de-ann {
  flex: 1 0 auto;
  display: flex; flex-direction: column;
  padding: ${GUTTER}px ${GUTTER}px ${t.space.lg}px;
}

/*
 * A section is a title and its contents, and the space under it is the only
 * thing separating it from the next.
 *
 * No hairline between them on purpose: the notes section already closes with a
 * bordered box, and a rule under that would land parallel to the box's own
 * bottom edge 8px away and read as a mis-drawn double border.
 */
.de-ann-section { display: flex; flex-direction: column; }
.de-ann-section + .de-ann-section { margin-top: ${SECTION_GAP}px; }
/*
 * THIS TAB'S HEADINGS ARE THE SHELL'S, not its own.
 *
 * There was a \`.de-ann-section-title\` here — a whole heading treatment, dim ink
 * at \`weightValue\`, restated for one tab. Every section in the Notes pane is
 * now an ordinary \`.de-section\` wearing the shared \`.de-section-title\` from
 * \`css/panels.ts\`, which is what the Design and Design-system tabs already use,
 * so the ladder below is the shell's and this file no longer has an opinion:
 *
 *   heading   ${t.type.body} / ${t.type.weightValue} / textDim     6.5:1   quietest
 *   metadata  ${t.type.body} / ${t.type.weightBody} / textDim     6.5:1
 *   controls  ${t.type.body} / ${t.type.weightValue} / textMuted   9.9:1  → text on hover
 *   row body  ${t.type.body} / ${t.type.weightBody} / text        16.8:1  loudest
 *
 * SIZE carries none of it and cannot: \`type\` tops out at ${t.type.body} and the floor for
 * this surface is ${t.icon.row}px, so every run in the file is at the same rung and the
 * ladder is INK and WEIGHT alone. That is the better ordering here anyway — a
 * 260px column of one size reads as one list, and the eye sorts it by strength.
 */
/*
 * NO TALLY RULE HERE ANY MORE, and the deletion is the point.
 *
 * \`.de-ann-count\` rode the section heading with "1 note and 1 edit" in it,
 * while each group head under it carried a "1" of its own. Three statements of
 * the same arithmetic over a list you could count by looking. A count earns a
 * slot when what it counts is off screen; the rows ARE the section now, so it
 * never is.
 */
/*
 * THE DETAIL ROW: a name on the left, the chosen level and a chevron on the
 * right.
 *
 * This was \`.de-ann-formats\`, a scrolling strip of four segments — Compact,
 * Standard, Detailed, Forensic. Four labelled pills do not fit 244px, so the
 * strip overflowed sideways with its scrollbar hidden, and announced the
 * overflow by cutting the last pill in half. That is a menu with extra steps:
 * the options were not all visible, and the one segment that was fully legible
 * was the one already chosen.
 *
 * A row and a \`selectField\` instead. It is the shape every other
 * one-of-several setting in the inspector already uses, it fits at any panel
 * width because a menu is as wide as its trigger rather than as wide as its
 * options, and the platform supplies the keyboard behaviour the strip
 * hand-rolled in about forty lines.
 *
 * The label takes the panel's caption rank — it names a control, exactly as
 * \`.de-group-caption\` does in the Design tab — and the menu flexes into the
 * rest of the row, so its chevron lands on the same right-hand column every
 * other trailing control in the panel sits on.
 */
.de-ann-detail {
  display: flex; align-items: center; gap: ${t.space.md}px;
  margin-bottom: ${t.space.md}px;
}
.de-ann-detail-label {
  flex: none;
  font-size: ${t.type.caption};
  font-weight: ${t.type.weightBody};
  color: ${t.color.textDim};
}
.de-ann-detail > .de-select-shell { flex: 1; min-width: 0; }

/*
 * THE LIST, with nothing around it.
 *
 * There was a \`.de-ann-box\` here: a hairline, a \`radius.lg\` corner and a
 * \`bgSunken\` ground, wrapping the rows so they would "read as cards on a well".
 * They already read as cards — each row draws its own hairline, its own raised
 * ground, a numbered disc and a badge — so the well was a second frame around a
 * set of objects that were not short of definition. Three nested edges (panel,
 * box, row) for one list.
 *
 * Its two supporting details went with it and are worth recording as solved
 * rather than dropped. The box needed \`overflow: visible\` so a row's focus ring
 * would not be shaved at the first and last row; with no box there is nothing
 * to clip against. And the 4px the list padded by existed only to hold those
 * rings off the box's hairline; with no hairline the padding is zero and the
 * rows start on the section's own column, which is where every other row in the
 * inspector starts.
 *
 * Still no scroll: the pane above owns the only scrollbar, and a list that
 * scrolled inside it would be two scrollbars a few pixels apart.
 */
.de-ann-list {
  display: flex; flex-direction: column; gap: ${t.space.sm}px;
}

/*
 * One row, two species.
 *
 * A note is something the designer WROTE; an edit is something the editor DID.
 * Reading them as one list is the whole value of the outbox, and mistaking one
 * for the other is the whole risk — so the kind has to land before the text is
 * read, not from it.
 *
 * The left rule is a pseudo-element rather than a \`border-left\`, for the same
 * reason layers.ts draws its indent guides that way: it lets the mark be a
 * SHAPE. Note is a continuous bar, edit is a broken one, and broken against
 * whole is legible in greyscale and legible when the user has picked the
 * editor accent as their marker colour. Colour here is reinforcement; it is
 * never the distinction.
 */
.de-ann-item {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: start;
  /* The head and the body are two lines of one object, so the step between
     them is the tight one; the actions column is a separate thing and takes
     the workhorse step away from the text it must not crowd. */
  column-gap: ${t.space.md}px; row-gap: ${t.space.sm}px;
  /* One inset on all four sides, one under its spacing step because the
     hairline takes that pixel. The leading edge used to be wider than the
     other three — air the frame outside was not providing — and with the frame
     gone there is no reason for the left to differ from the right. */
  padding: ${ITEM.padding};
  border: ${ITEM.hairline}px solid ${t.color.border};
  border-radius: ${ITEM.outer};
  background: ${t.color.bgRaised};
  font-size: ${t.type.body};
  /* Prose, not a label: the comment is the one place in this panel somebody
     reads a sentence, and 1.45 is what keeps two wrapped lines from setting
     solid. Every other surface here is single-line and inherits nothing. */
  line-height: ${t.type.leadingBody};
  color: ${t.color.text};
  transition: background ${t.duration.fast} ${t.ease}, border-color ${t.duration.fast} ${t.ease};
}
/*
 * THREE ways in, ONE highlight — this rule is the correspondence.
 *
 * A note is one object with two views: a pin on the page and a row in here.
 * The pointer can arrive at either of them, and the keyboard arrives at a third
 * place, the actions inside the row. If hovering the marker lit the row in a
 * different tint from hovering the row itself, the two would stop reading as
 * the same note — the highlight would look like two different facts rather than
 * one thing answering.
 *
 * So all three states are declared once, in one rule, and there is deliberately
 * no second place to change one of them:
 *   :hover        the pointer is on the row
 *   :focus-within the keyboard is in the row
 *   --hover       the canvas says the pointer is on this note's MARKER
 */
/* \`bgRaisedHover\`: the item is \`bgRaised\` and \`bgHover\` is the rung below it,
   so this hover used to darken the card the pointer was on. See the token's own
   note in \`tokens.ts\` — it was added for this shape and three surfaces were
   still reaching past it. */
.de-ann-item:hover,
.de-ann-item:focus-within,
.de-ann-item--hover {
  background: ${t.color.bgRaisedHover};
  border-color: ${t.color.borderInteractive};
}
/*
 * Inset 2px top and bottom, so the rule stops short of the corner arcs.
 *
 * At \`top: 0; bottom: 0\` the bar ran the full height of a box with a 4px
 * radius, and its square ends poked out through the curve — two 2px nicks on
 * the left corners of every row in the list, which at this size reads as a
 * rendering fault rather than as a mark.
 */
/*
 * No left rule on a row.
 *
 * There was one, in three variants: solid for a note, broken for an unwritten
 * edit, closed-up for a written one. Each said something true, and together
 * they put a coloured bar down the left of every row in a 260px panel to
 * restate what the row's own words already said. The kinds are still told apart
 * — by the note's numbered disc, by the mono face on an edit's body, and by the
 * written state's own words — none of which costs a column of ink.
 */

/* Metadata rung: the row's quietest line, under the body it introduces. */
.de-ann-item-head {
  grid-column: 1;
  display: flex; align-items: center; gap: ${t.space.sm}px; min-width: 0;
  font-size: ${t.type.body};
  font-weight: ${t.type.weightBody};
  color: ${t.color.textDim};
}
/*
 * The number, and only notes carry one.
 *
 * Its presence is the third channel telling the two kinds apart, and the
 * cheapest one to read: an edit has no pin on the canvas, so it has no number,
 * so the column of discs down the list IS the set of things you can go and look
 * at. Same fill as the marker for the same reason, and — since it is the same
 * object — the same dark ink, for the reason spelled out up there: white on the
 * seven presets runs 1.95:1 to 4.35:1 and the numeral on the pale ones is gone.
 * This disc does not even get the pin's ring to fall back on.
 */
.de-ann-index {
  flex: none;
  width: ${INDEX}px; height: ${INDEX}px;
  display: inline-flex; align-items: center; justify-content: center;
  border-radius: 50%;
  background: var(--de-ann-color, ${t.color.danger});
  /* The row's copy of the pin, so it takes the pin's whole treatment: white
     numeral, the same contact shadow under it, the same inset hairline. The two
     have to be recognisably one object — the row is how you find the pin. */
  color: ${t.color.onUserColor};
  text-shadow: 0 1px 0 rgba(0, 0, 0, 0.32);
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.04);
  /* \`micro\`, not \`caption\`: this disc is ${INDEX}px against the pin's ${MARKER}, so it
     steps down one rung to keep the same numeral-to-disc proportion. */
  font-size: ${t.type.micro}; font-weight: ${t.type.weightSection};
  line-height: ${t.type.leadingFlush};
}
/*
 * Outlined at rest; the filled version below is reserved for "written".
 *
 * \`flex: 0 1 auto\` and not \`none\`: a badge is short today, but a \`none\` chip
 * beside a \`none\` disc in a flex row has nothing left that can give, so one
 * longer word would have pushed the head past the row's right edge and under
 * the actions column instead of ellipsising like everything else here.
 */
.de-ann-badge {
  flex: 0 1 auto; min-width: 0;
  overflow: hidden; text-overflow: ellipsis;
  padding: 0 ${t.space.sm}px;
  border: 1px solid ${t.color.borderInteractive}; border-radius: ${t.radius.sm};
  background: transparent;
  color: ${t.color.textDim};
  font-size: ${t.type.body};
  line-height: 14px;
  white-space: nowrap;
}
/*
 * THREE STATES, AND THE COLOUR HAS TO AGREE WITH THE WORD.
 *
 * Keyed on \`data-de-state\`, not on \`.de-ann-item--written\`, because that class
 * is true of two different rows. The writer sets \`written\` the moment it knows
 * it CAN spell a change, so a queued edit and a committed one both carried it —
 * and both came out filled green. Screenshotted, the tab said a change was done
 * when the file had never been touched, in the most reassuring colour the
 * chrome owns. That is the failure this rule exists to prevent, so it reads the
 * same attribute the badge's own text is chosen from and the two cannot drift.
 *
 * Filled green is spent on ONE state — the only one that is finished. Green
 * means "nothing further is owed here" and can mean nothing else in this list.
 */
.de-ann-badge[data-de-state="written"] {
  border-color: transparent;
  background: ${t.color.success};
  color: ${t.color.onSemantic};
}
/*
 * Ready is OUTLINED in the accent, not filled by it.
 *
 * It is the most common state in a live session — every writable edit sits here
 * until Apply — so a filled chip would put a saturated block on nearly every
 * row and leave the list with no quiet ground to read against. Outlined reads
 * as "armed, not done", which is exactly the claim, and it keeps the filled
 * treatment meaning finished.
 */
.de-ann-badge[data-de-state="ready"] {
  /* The BORDER stays \`accent\` — a stroke owes 3:1 and has it in both themes.
     The WORD takes \`accentText\`, which is the same colour in dark and one rung
     down in light, where plain \`accent\` measures 4.23:1 against the 4.5 a
     label owes. The sweep found this; the eye did not. */
  border-color: ${t.color.accent};
  background: transparent;
  color: ${t.color.accentText};
}
/*
 * Needs-the-agent is AMBER, and the reason it is not \`danger\` is the same
 * reason the audit's severities are not: nothing is broken. The change is real
 * and simply cannot be written mechanically.
 *
 * It must not inherit the default \`textDim\` either, which is what it did when
 * it was first drawn. Dim ink on a transparent ground is the chrome's disabled
 * treatment, so the one row that needs a decision looked like the one row that
 * could not be acted on — precisely inverted.
 */
.de-ann-badge[data-de-state="agent"] {
  border-color: ${t.color.lintWarning};
  background: transparent;
  color: ${t.color.lintWarning};
}

/*
 * One line, ellipsised, whole value in the \`title\`. A note can be a paragraph
 * and an edit's value can be a four-part box-shadow; either one wrapping in a
 * 260px panel turns a scannable list into a wall.
 *
 * FULL-STRENGTH ink, and it is the only run in the tab that gets it. This is
 * what the user wrote; everything around it — the heading naming the section,
 * the number, the kind chip, the controls — exists to get them to this line. It
 * was \`textMuted\` while the section titles were shouting in caps above it, so
 * the loudest thing in the column was the word "NOTES" and the quietest was the
 * note. 14.2:1 on the row's own ground, against 8.7:1 before.
 */
.de-ann-item-body {
  grid-column: 1;
  min-width: 0;
  color: ${t.color.text};
}
/*
 * The ellipsis has to be on the LINE, not on the box around it.
 *
 * It was on \`.de-ann-item-body\`, whose children are two \`<div>\`s — and
 * \`text-overflow\` only draws on the box whose own inline content overflows.
 * The divs overflowed themselves (visible), the body clipped them, and no
 * ellipsis was ever painted: a long note was cut mid-glyph at the row's edge,
 * which reads as a rendering fault rather than as "there is more". Same
 * declarations, one level down, where they can actually fire.
 */
.de-ann-item-body > * {
  min-width: 0;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
/*
 * ONE LINE, FULL INK — there were two, and the second has gone to the tooltip.
 *
 * A row was what the user wrote and then where it is: "add a hover animation",
 * and under it "OverviewComponent · page.tsx:24". Ranking the second line
 * quieter fixed the loudness but not the arithmetic — five rows still cost ten
 * lines of a ${t.size.inspectorWidth}px column, and half of them were filing notes the reader
 * did not write and cannot act on. The pin says where a note is; the brief
 * carries the selector, the component and the file to the agent, which is the
 * copy that was ever going to be read for them.
 *
 * So \`.de-ann-item-where\` is gone rather than restyled, and the string it held
 * is the \`title\` of the line above it.
 */
.de-ann-item-line { color: ${t.color.text}; }
/*
 * THE SHARED-COMPONENT CAUTION, and it is amber rather than red.
 *
 * Nothing is wrong. The edit is valid, it will apply cleanly, and for a design
 * system component changing every instance is very often exactly what the
 * designer means. What they cannot see from the page is the SCOPE, so this
 * reports scope — and a red line reporting a correct operation trains people to
 * ignore red lines.
 *
 * Amber is the same hue the audit spends on "a warning the page still renders",
 * which is precisely this situation, and it is already the badge colour for a
 * row the editor cannot write. One amber vocabulary across the tab: this needs
 * your attention before you press the button.
 *
 * Set back to the body font on purpose. The rest of an edit row is mono because
 * it is a property and two values; this is a sentence, and a sentence in mono
 * inside a 260px column wraps badly and reads as data.
 */
.de-ann-item-shared {
  margin-top: ${t.space.xs}px;
  font-family: ${t.font.ui};
  color: ${t.color.lintWarning};
  /*
   * The one child of an edit row allowed to WRAP.
   *
   * .de-ann-item-body > * sets nowrap and an ellipsis on every child,
   * which is right for a property and two values — one line, whole value in
   * the title attribute. This is a sentence, and a sentence clipped at
   * "…used in 13 other pla…" has lost the number, which is the only part of
   * it anybody needs. It gets two lines instead.
   */
  overflow: visible;
  white-space: normal;
  overflow-wrap: anywhere;
}

/*
 * THE TWO SECTIONS, AND WHAT IS LEFT OF THEM HERE.
 *
 * They were \`.de-ann-group\`s: a small heading, a tally, a sentence, the rows,
 * and the button that finishes them — two of those stacked inside ONE section
 * called Handover. So the tab drew a foldable header over two more headings
 * that were not foldable, and the pile a reader came for was always a level
 * down from the heading that named it.
 *
 * They are \`section()\`s now, which is the panel's own header and costs this
 * file nothing: no group box, no group head, no sub-heading rank, no tally.
 * Three rules survive, because a section header carries none of them.
 *
 * The sentence under each heading is one of them, and it does the real work of
 * the split. It is \`.de-ann-brief\` and not \`.de-ann-hint\`, which is taken: the
 * canvas pill that says "click an element to leave a note" owns that name, and a
 * section heading inheriting \`position: fixed\` from it lands the sentence over
 * the app instead of under its own title. "Editor" and
 * "agent" are this tool's words, not a designer's; one plain sentence saying
 * what will actually happen to these rows is what makes the two sections
 * explain themselves the first time somebody meets them.
 */
.de-ann-brief {
  margin-bottom: ${t.space.md}px;
  color: ${t.color.textDim};
  font-size: ${t.type.caption};
}
/*
 * "No notes yet", at the hint's rank and on the row column.
 *
 * The section stays on screen over a session of pure edits because it holds the
 * detail menu — so this is the line that stops a heading with a menu under it
 * and nothing else from reading as a list that failed to load.
 */
.de-ann-none {
  padding: ${t.space.sm}px 0;
  color: ${t.color.textDim};
  font-size: ${t.type.caption};
}
/* The button spans the rows it belongs to, so its scope is its width. */
.de-ann-cta { margin-top: ${t.space.md}px; display: flex; }
.de-ann-cta > .de-button { flex: 1; justify-content: center; }

/*
 * THE AGENT ADDRESS.
 *
 * Mono, selectable, and allowed to wrap. It is a string somebody has to get
 * into another program: an ellipsis would make the one useful thing in the
 * block unreadable, and at 260px wrapping is the honest choice.
 */
.de-mcp-row { display: flex; align-items: center; gap: ${t.space.sm}px; }
.de-mcp-url {
  flex: 1; min-width: 0;
  padding: ${t.space.xs}px ${t.space.sm}px;
  border-radius: ${t.radius.sm};
  background: ${t.color.bgHover};
  color: ${t.color.text};
  font-family: ${t.font.mono};
  font-size: ${t.type.caption};
  overflow-wrap: anywhere;
  user-select: all;
}
/*
 * The status sentence, tinted by state.
 *
 * Green only for a live agent, amber for "set me up", and muted ink for a
 * port that never bound — which is not the designer's fault and not something
 * they can fix from this panel, so it gets no alarm colour.
 */
.de-mcp-state { font-size: ${t.type.caption}; color: ${t.color.textDim}; }
.de-mcp-state[data-de-state="on"] { color: ${t.color.success}; }
.de-mcp-state[data-de-state="idle"] { color: ${t.color.lintWarning}; }
/*
 * There were three orphaned lines here — \`font-family\`, a duplicate \`color\`
 * and a closing brace with no selector above them, left behind when the
 * \`idle\` rule was collapsed onto one line.
 *
 * They were not merely dead. A stray declaration at the top level puts the CSS
 * parser into error recovery, and recovery runs to the end of the NEXT block —
 * so the orphan silently ate the rule that followed it. Confirmed against a
 * browser's CSSOM rather than reasoned about: of \`.a-before\`, the idle rule,
 * \`.a-after\` and \`.a-after-2\`, the parser kept three and dropped
 * \`.a-after\` entirely.
 *
 * What it had been eating since 5d43657 is the mono treatment directly below,
 * so every edit row in the Changes tab has been setting its body in the UI face
 * while the comment beside it explained why that had to be mono. Nothing was
 * lost by deleting the orphan itself: neither declaration had ever applied.
 */
/*
 * An edit's body is a property and two values, so it is set in mono — the
 * fourth channel, and the one that reads before any mark does, because a
 * change of typeface is visible in peripheral vision.
 */
.de-ann-item--edit .de-ann-item-body {
  font-family: ${t.font.mono};
}
/*
 * A trailing column, always in the DOM, faded in on the same three states the
 * row highlights on.
 *
 * Two things make this safe to hide at rest, and both are conditions the old
 * always-visible treatment was written to avoid. The column is laid out and
 * SPACED whether or not it is painted — \`grid-row: 1 / -1\` in a track of its
 * own — so nothing moves when it appears and the text never reflows under the
 * pointer. And the reveal is keyed on \`:focus-within\` as well as hover, on the
 * row AND on the group, so a keyboard tabbing into a button can never land on
 * something at \`opacity: 0\`: the ring and the glyph arrive together.
 *
 * Opacity and nothing else. A \`display\` or \`visibility\` swap would take the
 * buttons out of the tab order (or out of layout) between frames, which is how
 * a Tab press ends up somewhere the eye did not follow.
 *
 * \`space.md\`, and the rung below it would break the row: each ${t.size.miniSize}px button
 * carries ${(TARGET - t.size.miniSize) / 2}px of invisible hit pad on every side, so any gap under
 * ${TARGET - t.size.miniSize}px leaves a strip down the middle where Resolve and Delete both
 * claim the click. \`sm\` would overlap them by ${TARGET - t.size.miniSize - t.space.sm}px; \`md\` clears them with
 * ${t.space.md - (TARGET - t.size.miniSize)}px to spare.
 */
.de-ann-item-actions {
  grid-column: 2; grid-row: 1 / -1;
  align-self: start;
  display: inline-flex; align-items: center; gap: ${t.space.md}px;
  opacity: 0;
  transition: opacity ${t.duration.fast} ${t.ease};
}
.de-ann-item:hover .de-ann-item-actions,
.de-ann-item:focus-within .de-ann-item-actions,
.de-ann-item--hover .de-ann-item-actions,
.de-ann-item-actions:focus-within { opacity: 1; }
/* No pointer, no hover: on touch the reveal would hide the row's only actions
   behind a gesture the device cannot make. */
@media (hover: none) {
  .de-ann-item-actions { opacity: 1; }
}
/*
 * ${t.size.miniSize}px of drawing, ${TARGET}px of target.
 *
 * The glyph is right at this density — a 24px square button in a two-line row
 * would be the biggest thing in it — but 18px is under the 24px pointer target
 * WCAG 2.5.8 asks for, and on a row you delete things from that is the miss
 * that costs the most. A transparent pad gives the button back the 3px a side
 * it is short without changing a pixel of what is painted.
 */
.de-ann-item-actions .de-mini { position: relative; }
.de-ann-item-actions .de-mini::after {
  content: "";
  position: absolute; inset: -${(TARGET - t.size.miniSize) / 2}px;
}
/*
 * A hovered action inside a hovered row needs a ground of its own.
 *
 * \`.de-mini:hover\` paints \`bgHover\`, and \`bgHover\` is also what the ROW is
 * wearing by the time a pointer can be on one of its buttons — the same colour
 * twice, so the button you are about to press looks exactly like the button
 * beside it. That is only visible on the near-black chrome, where the two quiet
 * steps are a tenth of a stop apart; on the old slate the wash was wide enough
 * to get away with it.
 *
 * The well is the next rung up and the hairline is the channel that actually
 * reads at ${t.size.miniSize}px — a 1.15:1 change of fill is not something you find with your
 * eye, an edge appearing where there was none is. Nothing here for
 * \`--danger\`: it goes to a filled coral and was never in doubt.
 */
.de-ann-item-actions .de-mini:hover:not(.de-mini--danger) {
  background: ${t.color.fieldHover};
  border-color: ${t.color.borderInteractive};
}

/* Inside the box now, not instead of it, so it is inset from the hairline
   rather than from the panel: 16/12 are the tab's own steps, where the 20/16 it
   carried were sized for an empty state that owned the whole pane. */
.de-ann-empty {
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: ${t.space.md}px;
  padding: ${t.space["2xl"]}px ${t.space.lg}px;
  color: ${t.color.textDim};
  text-align: center;
  line-height: ${t.type.leadingBody};
}

/*
 * What you do with the WHOLE session, under everything it acts on.
 *
 * It sat inside the Handover section, which was fine while one section held
 * both piles. With a section per pile it cannot: Send and Copy hand over every
 * note and every edit, so filing them under either heading would claim a
 * narrower scope than they have, and folding that heading away would hide the
 * button that finishes the session.
 *
 * Out here it is the last row of the tab rather than a footer pinned to the
 * pane — no hairline, no ground of its own, nothing to make it furniture. It
 * does take its own side padding now: \`.de-ann\` pads to the tab's ${GUTTER}px gutter
 * and every section body pads ${t.space.md} more, so without this the buttons would start
 * one step left of the rows they act on.
 *
 * One course, four controls, about 205px of the ${t.size.inspectorWidth - 16}px this row has.
 * \`flex-wrap\` stays as the relief valve — a narrower shell must fold the two
 * groups rather than let a label wrap out of its own pill.
 *
 * The slack \`space-between\` leaves is the only thing standing between the bin
 * and the button that sends everything — worth more here than anywhere else in
 * the panel.
 */
.de-ann-ctas {
  display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: ${t.space.md}px;
  margin-top: ${t.space.lg}px;
  padding: 0 ${t.space.md}px;
}
/*
 * The two glyph utilities, at the height of the pills they share a row with.
 *
 * \`.de-mini\` is ${t.size.miniSize}px because it was drawn for a trailing slot inside a row. Out
 * here it stands beside two ${TARGET}px buttons, and 18 against 24 on one line reads as
 * two different courses of furniture — the eye finds the mismatch before it
 * finds either label. Growing the BOX to 24 (the glyph inside stays 12) fixes
 * the line and pays for the pointer target in the same move.
 */
.de-ann-tools { display: inline-flex; align-items: center; gap: ${t.space.sm}px; }
.de-ann-tools .de-mini { width: ${TARGET}px; height: ${TARGET}px; }
.de-ann-actions { display: inline-flex; align-items: center; gap: ${t.space.sm}px; margin-left: auto; }
.de-ann-actions button { white-space: nowrap; }
/*
 * A GLYPH THAT BECOMES A TICK, and the becoming is the whole point.
 *
 * Copy's confirmation used to be a toast alone, which arrives at the bottom of
 * the screen while the pointer is at the right edge of a 260px panel — the one
 * place the eye is not. Agentation's toolbar, which sits on the same page as
 * this panel, answers a copy on the button itself, and two products on one
 * screen confirming the same gesture two different ways reads as two products.
 * So this is its treatment, matched deliberately: both marks in one box,
 * crossfaded, the outgoing one shrinking to ${SWAP_SCALE} and the incoming one arriving at
 * full size. Its numbers are 200ms and 0.8; ours are \`duration.base\` and the
 * same 0.8, which is the step the rest of this file already presses at.
 *
 * STACKED, not replaced. Swapping the \`<svg>\` gives the browser no previous
 * state to interpolate from, so the tick would appear rather than arrive — and
 * a glyph momentarily missing from the flow lets the label slide, which on a
 * pill that shares a ${TARGET}px line with three other controls is the one motion
 * nobody asked for. \`position: absolute\` on both children with a sized box
 * means the row geometry never learns that anything happened.
 *
 * The tick is \`success\`, not \`currentColor\`. On the plain pill the colour is
 * the only channel saying the press LANDED rather than merely registered, and
 * the scale is the second — so it survives greyscale, and it survives the
 * reduced-motion rule below that takes the scale away.
 */
.de-swap {
  position: relative;
  flex: none;
  display: inline-block;
  width: ${t.icon.row}px; height: ${t.icon.row}px;
}
/*
 * AND A BLUR, which is the third channel the crossfade was missing.
 *
 * Two drawings of the same size stacked at 50% opacity in the middle of a
 * crossfade read as one glyph struck twice, not as one becoming another. Blur
 * is what separates them during the overlap: the outgoing mark goes soft as it
 * leaves and the incoming one resolves as it lands, so at every frame there is
 * exactly one sharp drawing to look at.
 *
 * 4px, which is the chrome's existing pop blur — \`POP_BLUR\` in
 * \`css/tooltip.ts\` — rather than a fourth number. The SCALE is not moved to
 * match the same sheet's 0.25: 0.8 is argued above from the upstream component
 * this box is matched to, and 0.25 of a 16px glyph is a four-pixel speck.
 */
/*
 * The selector carries \`[data-designlayer]\` and \`[data-de-glyph]\` for one
 * reason, and it is the reason this crossfade never ran.
 *
 * \`css/icons.ts\` declares \`transition: stroke-width\` on
 * \`[data-designlayer] svg[data-de-glyph]\`, which is (0,2,1) against the
 * (0,1,1) this rule used to be — and \`transition\` is a shorthand, so that rule
 * did not add a property to this list, it replaced the list. Every glyph in
 * this box was transitioning \`stroke-width\` and nothing else, so the tick
 * appeared at full size and full opacity in one frame: the jump this whole
 * module exists to prevent, described in detail directly above it, and not
 * happening.
 *
 * (0,3,1) settles it outright rather than by import order. \`stroke-width\` is
 * restated because taking the declaration also means taking responsibility for
 * what it was doing — a glyph inside this box still thickens when its control
 * turns on.
 */
[data-designlayer] .de-swap > svg[data-de-glyph] {
  position: absolute; inset: 0;
  transform-origin: center;
  transition: opacity ${t.duration.base} ${t.ease}, transform ${t.duration.base} ${t.ease},
    filter ${t.duration.base} ${t.ease}, stroke-width ${t.duration.fast} ${t.ease};
}
.de-swap > .de-swap-done {
  opacity: 0; transform: scale(${SWAP_SCALE}); filter: blur(4px); color: ${t.color.success};
}
.de-swap--done > .de-swap-rest { opacity: 0; transform: scale(${SWAP_SCALE}); filter: blur(4px); }
.de-swap--done > .de-swap-done { opacity: 1; transform: scale(1); filter: blur(0px); }
/*
 * A TOGGLE KEEPS ITS OWN INK, and that is the entire difference between the two
 * uses of this box.
 *
 * The green above is what makes a confirmation a confirmation: on a plain pill
 * the colour is the only channel saying the press LANDED rather than merely
 * registered. A toolbar tool turning on is not a confirmation — the accent
 * surface underneath has already said which state it is in — and a green glyph
 * on that surface would be a second, contrary claim about what just happened.
 * So the toggle variant inherits, and takes only the crossfade from the rule
 * above.
 *
 * The box is sized here for the panel's \`icon.row\` glyphs; the toolbar's are
 * \`icon.control\`, and \`core/swap-mark.ts\` writes that one case inline rather
 * than growing a second class for one number.
 */
.de-swap--plain > .de-swap-done { color: inherit; }
/*
 * Clear-all, waiting for its second click.
 *
 * It wears the hover treatment of \`.de-mini--danger\` without the pointer being
 * there, which is the plainest way to say "this is live now" in a vocabulary
 * the panel already has. The ink flips to the dark fixed tone rather than
 * staying white: \`danger\` is a LIGHT coral on this chrome, and white on it
 * measures about 2.3:1 — the same pairing trap \`accentFill\` exists to close.
 *
 * The fill is the second channel, never the only one. The glyph itself changes
 * from a bin to a tick, so the armed state survives greyscale and survives a
 * reader who is not looking directly at it.
 */
.de-ann-clear--armed,
.de-ann-clear--armed:hover {
  background: ${t.color.danger};
  color: ${t.color.onSemantic};
}

/* ---------- settings ---------- */
/*
 * The second section, sitting where the first one ends.
 *
 * It used to be pinned to the bottom edge with \`margin-top: auto\` and closed
 * off with a hairline, on the argument that the pane's free space had to go
 * somewhere and above a folded block was the cheapest place. That was true
 * while the list scrolled inside itself; with the whole tab scrolling as one
 * column it produced the opposite — a block floating at the bottom of the
 * viewport with a void between it and the notes it belongs to. The section
 * title above it is the separation now, so the rule goes too.
 */
.de-ann-settings {
  display: flex; flex-direction: column;
}
/*
 * NO FOLD BUTTON HERE ANY MORE, and the deletion is the point.
 *
 * There was a \`.de-ann-settings-toggle\` — a whole-row target that collapsed the
 * block under it, with its own hover ground, its own focus ring and a chevron
 * that rotated. Settings is four switches; a fold that hides four switches
 * behind a press costs a click on every visit to save four rows on a tab that
 * already scrolls as one column. The section is a plain \`.de-section\` now and
 * the body is always open, so the only thing this block still needs is its own
 * rhythm under the shared heading.
 */
.de-ann-settings-body { display: flex; flex-direction: column; padding: ${t.space.xs}px 0 ${t.space.md}px; }
/* An author \`display\` beats the UA [hidden] rule, so restate it. */
.de-ann-settings-body[hidden] { display: none; }
/*
 * Opening fades; it does not unroll.
 *
 * Height is the obvious thing to animate here and the wrong one: the block is
 * pinned to the bottom of a pane that is already scrolling, so a height
 * transition relayouts the list above it on every frame and the rows the user
 * was reading walk up the panel. Opacity is free, and at \`fast\` it is over
 * before the eye finishes travelling to the first row.
 */
.de-ann-settings-body:not([hidden]) {
  animation: de-ann-settings-in ${t.duration.fast} ${t.ease};
}
@keyframes de-ann-settings-in {
  from { opacity: 0; }
}

/*
 * A run of rows, and a hairline only ever BETWEEN two runs.
 *
 * There are TWO groups now and the rule between them separates kinds, not
 * drawings. Above it, MCP: an address, a Copy button and a live status line —
 * a thing you read, not a thing you set. Below it, every setting, all of them
 * a switch on the right edge. The two extra rules this block used to carry
 * marked a switch/checkbox split that the controls no longer make, so they
 * were claiming three kinds of setting over one.
 *
 * A rule under the last group would close the block off from the panel edge it
 * is already sitting on and read as a second border.
 */
.de-ann-setting-group { display: flex; flex-direction: column; }
.de-ann-setting-group + .de-ann-setting-group {
  margin-top: ${t.space.md}px;
  padding-top: ${t.space.md}px;
  border-top: 1px solid ${t.color.border};
}

/*
 * One setting, one line. The whole point of the block.
 *
 * Every row used to carry a two- or three-line hint under it, which turned six
 * settings into an essay: on a 900px screen the last row fell below the fold,
 * so the setting most likely to be wrong on a given project was the one to
 * scroll a wall of prose for. The hints moved into \`.de-ann-help\` — a dot
 * beside the label, with the sentence in its \`title\` — and the row went back
 * to being a row.
 *
 * No \`flex-wrap\` here on purpose: wrapping is how a row silently becomes two
 * again. The label is the only thing that gives, and it gives by clipping
 * rather than by pushing the control off the panel — see the rule on it.
 */
.de-ann-setting {
  position: relative;
  display: flex; align-items: center; gap: ${t.space.md}px;
  min-height: ${t.size.rowHeight}px;
}
/* An author \`display\` beats the UA [hidden] rule, so restate it. */
.de-ann-setting[hidden] { display: none; }
/*
 * The slack goes in FRONT of the control, not into the label.
 *
 * With the label flexed to fill, the help dot was carried out to the middle of
 * the row and read as a mark on the switch — it explains the setting, so it has
 * to touch the words. The control is pushed right by its own auto margin
 * instead, which leaves label and dot as one object at the left edge.
 */
.de-ann-setting > .de-ann-toggle { margin-left: auto; }

/*
 * A control too wide to sit beside its own name — today, the MCP address and
 * the Copy button that follows it.
 *
 * Wrap is switched back on for this variant only, and it is the CONTROL that
 * claims the whole second line rather than the label claiming the first: label
 * and help dot have to stay together on line one, which they do for free now
 * that the dot is inside the label rather than beside it.
 */
.de-ann-setting--stacked {
  flex-wrap: wrap; row-gap: ${t.space.md}px;
  padding-top: ${t.space.sm}px; padding-bottom: ${t.space.sm}px;
}
.de-ann-setting--stacked > :not(.de-ann-setting-label) { flex: 1 1 100%; }

/*
 * THE CHECKBOX VARIANT IS GONE, and about ninety lines of drawing with it.
 *
 * \`.de-ann-setting--check\` put a hand-drawn \`<input type="checkbox">\` in
 * FRONT of the words, opposite the switches on the right, and the asymmetry
 * was the whole argument for it: a switch says "this is how the tool behaves
 * from here on", a checkbox says "do this to the handover". Every row in the
 * block persists and takes effect on press, so there was no second kind of
 * choice for the second drawing to mark — two alignments and two controls
 * saying one thing. The rows are \`role="switch"\` now, all of them, and what
 * left with the checkbox is a tick centred to a tenth of a pixel, a 24px hit
 * pad and an \`appearance: none\` reset that existed only to make a native
 * control look like it belonged.
 *
 * Nothing replaced the \`:hover\` tint the variant put on its own label: a
 * switch row's target is the switch, and lighting the words on hover promised
 * a click they never took.
 */

/*
 * Name and help dot, as one flex ROW. Shrinks, never grows.
 *
 * It was a block, and the dot inside it was an inline-flex box on a TEXT LINE,
 * which is the whole of the reported misalignment. Measured against the centre
 * of the cap band — where the eye puts the middle of a word — the dot sat:
 *
 *   inline, no fix                2.12px HIGH
 *   inline, vertical-align:middle 0.98px LOW
 *   flex item, align-items:center 0.12px low
 *
 * An inline-flex box holding nothing but an SVG has no text baseline of its own,
 * so the line hands it the replaced element's bottom edge — that is the 2.12.
 * \`vertical-align: middle\` was the fix for that and overshot: \`middle\` is the
 * baseline plus half the X-HEIGHT, and the cap band's centre is higher than
 * that. A pixel on a 14px dot beside 11px text is the difference between a dot
 * on the word and a dot under it.
 *
 * A flex row has no such approximation and no dependence on what the SVG does
 * about baselines: the dot's centre goes on the line box's centre, which is
 * where the text is centred too, at every size and every zoom step.
 *
 * It also stops the dot being the thing that VANISHES when the row is tight — an
 * atomic inline at the end of an ellipsised line is dropped from paint and from
 * hit testing, so the hint was one longer label away from being unreachable. As
 * a \`flex: none\` item it is the one thing here that cannot be taken away.
 *
 * The cost, stated plainly: \`text-overflow\` does not apply to a flex
 * container's items, and every row here is a bare text node now that the
 * checkbox rows and their \`<label for>\` are gone — so a name too long for the
 * slot shrinks to its longest word and is then clipped rather than
 * ellipsised. Today's longest label measures about 118px in a 210px slot, so
 * nothing is near it; if one ever is, the fix is a \`<span>\` around the words
 * in the markup, not a return to the block.
 *
 * \`overflow: clip\` with a margin rather than \`hidden\`, because the dot is a
 * tabbable \`<button>\` and \`hidden\` shaved 3px off every side of its focus ring.
 * A clip margin keeps the ring and still stops a long label painting over the
 * switch. The tip below is unaffected either way — it is absolutely positioned
 * against the ROW, which is outside this box, and a clip only reaches as far
 * down as the containing block.
 */
.de-ann-setting-label {
  flex: 0 1 auto; min-width: 0;
  display: flex; align-items: center; gap: ${t.space.sm}px;
  overflow: clip; overflow-clip-margin: 3px;
  white-space: nowrap;
  color: ${t.color.textMuted};
  font-size: ${t.type.body};
  transition: color ${t.duration.fast} ${t.ease};
}
/*
 * \`.de-ann-setting-label > label\` STOOD HERE and has nothing left to style.
 *
 * It gave the checkbox rows' \`<label for>\` an ellipsis and the row's cursor.
 * Those rows are switches now and carry a bare text node, so there is no
 * \`<label>\` in the block at all — see the note above about what that costs.
 */

/*
 * The hint, folded into a dot.
 *
 * Quiet enough at rest that six of them down a block read as punctuation
 * rather than as six things to do, and full-strength the moment the pointer or
 * the keyboard reaches one — it is a real \`<button>\`, so it is tabbable, and a
 * tabbable thing with no focus ring is a thing a keyboard user loses.
 *
 * NOT \`cursor: help\`, which is what this carried and what it was reported for.
 * The question-mark cursor is the browser's mark for "there is an explanation
 * attached to this text", and it belongs on a word or a phrase — on a control
 * it is a second glyph saying what the ⓘ inside the dot already says, drawn
 * by swapping out the pointer. On a 14px target the swap is also the loudest
 * thing that happens on hover, so a pointer merely crossing the settings block
 * flickered through four cursor changes on its way to the switch.
 *
 * \`pointer\`, and not \`default\`, because the house rule is that every enabled
 * control in this chrome draws the pointer and \`default\` is for disabled
 * states and for things that are not controls — \`concentric-cases.mjs\`
 * enforces exactly that. This is a \`<button>\` in the tab order with a hover
 * state and a focus ring; it is a control, whatever it does on press.
 *
 * The vertical alignment is the label's job now, not this rule's. It used to
 * carry \`vertical-align: middle\`, which was the best a box on a TEXT LINE can
 * do and still about a pixel low — see \`.de-ann-setting-label\` above, which is
 * a flex row for exactly this reason. Nothing is left here to state: a flex
 * item is centred by its container.
 *
 * THE DISC IS THE CIRCLE, and the glyph inside it is \`InfoMark\` — Lucide's
 * \`Info\` with its ring taken off. It was the ringed \`Info\`, and at ${t.icon.row}px in a
 * ${CHECK}px disc that put two concentric circles 1.4px apart with a 1.25px stroke
 * over 2px of stem between them: rasterised at 1x the \`i\` is a smudge inside a
 * ring, which is what this dot was reported for. The ring was never adding
 * anything a disc with a \`border-radius: 50%\` was not already saying, and
 * dropping it spends the whole ${CHECK}px on the mark that carries the meaning — the
 * \`i\` goes from 3.25px of ink to 7.25px at the same stroke weight. The lint
 * badge in \`css/lint-markers.ts\` still draws the ringed \`Info\`, because it is
 * a rounded SQUARE plate and there a bare \`i\` is a letter, not a notice.
 *
 * ${CHECK}px and not 13: the glyph inside is ${t.icon.row}px, and a 13px disc left the ringed
 * drawing half a pixel proud of its own circle on every side — the marks of an
 * outline glyph sticking out past the surface they are drawn on. The bare mark
 * no longer reaches the edge, but ${t.icon.row} is still the floor for a glyph anywhere
 * in this shell, so the disc cannot shrink without the mark going with it.
 *
 * No hit pad on this one, unlike the switch and the row actions. It is not an
 * action — clicking it does nothing — so all it owes is a hover and a focus
 * ring, and a ${TARGET}px pad around a dot sitting inside a line of text would steal
 * the last few pixels of the label's own hover and text selection. WCAG 2.5.8
 * exempts a target inline in a line of text for the same reason.
 */
.de-ann-help {
  flex: none;
  width: ${CHECK}px; height: ${CHECK}px;
  display: inline-flex; align-items: center; justify-content: center;
  padding: 0;
  border: none; border-radius: 50%;
  background: ${t.color.field};
  color: ${t.color.textDim};
  font-family: inherit; font-size: ${t.type.body}; font-weight: ${t.type.weightSection};
  line-height: ${t.type.leadingFlush};
  cursor: pointer;
  transition: background ${t.duration.fast} ${t.ease}, color ${t.duration.fast} ${t.ease};
}
.de-ann-help:hover, .de-ann-help:focus-visible { background: ${t.color.fieldHover}; color: ${t.color.text}; }
.de-ann-help:focus-visible { outline: 2px solid ${t.color.accent}; outline-offset: 1px; }



/*
 * NEITHER TIP IS DRAWN HERE ANY MORE.
 *
 * Two lived in this file: one on the settings help dot, anchored to the whole
 * row and wrapped, 400ms in; one on the note-row actions, anchored under the
 * button and instant. Both are now the shared card in \`css/tooltip.ts\`.
 *
 * Each was working around the same missing capability from a different angle.
 * The help dot's was stretched \`left: 0; right: 0\` across its row precisely
 * BECAUSE a bubble hung off a 14px dot in a 260px panel ran off the left edge —
 * a viewport problem solved by making the tip as wide as the column, which is
 * not a solution so much as somewhere the problem does not fit. The row
 * actions' skipped the delay because its buttons only appear once the pointer
 * is already inside the row.
 *
 * The shared one keeps both behaviours and needs neither workaround: it
 * measures, so it can hang off a 14px dot and still stay on screen, and its
 * warm window means a tip shown while another is already up appears instantly —
 * which is the row actions' case, arrived at by a rule rather than by an
 * exception.
 *
 * The help dot keeps its own hover tint above; only the card left.
 */


/*
 * The switch: a track, and a knob that travels its length.
 *
 * \`transform\` on a \`::after\`, never \`left\` — a knob animated on an inset is
 * laid out again on every frame, and this one sits in a block pinned below a
 * scrolling list. The knob also FLIPS its ink as it arrives: white on the dark
 * well, \`onAccent\` on the light indigo, because a white knob on this accent
 * measures 1.9:1 — the pairing \`accentFill\` exists to prevent, and the reason
 * the tick on the old settings checkbox was \`onAccent\` too. That gives the on
 * state two channels
 * — where the knob is, and what colour it is — so it survives greyscale.
 *
 * \`base\` rather than the 160ms the reference uses: there is no token between
 * \`fast\` and \`base\`, and for 12px of travel the longer rung is the one that
 * reads as a thing sliding rather than a thing blinking.
 *
 * THE OFF TRACK NEEDS A BOUNDARY, and that is what the near-black ground took
 * away. \`field\` is a 10% lift off the chrome: against the old slate it was a
 * visible well, against \`#1c1d21\` it measures 1.35:1 and an off switch is a
 * white dot floating on nothing. \`borderInteractive\` is the token for exactly
 * this — the boundary of a control you can act on, at 2.9:1 on the chrome,
 * which is the 3:1 WCAG 1.4.11 asks of a component boundary. The ON track does
 * not need one (the accent fill is 8.9:1 by itself), but the border stays and
 * only changes colour: dropping it would shrink the padding box by 2px on both
 * axes and the knob would jump a pixel as the switch turned on.
 *
 * The knob's 1px insets follow from that border, since \`box-sizing\` is
 * border-box and an absolute child is laid out in the PADDING box: 26x14 of
 * padding around a 12px knob is 1px of clearance and 12px of travel, which is
 * the same travel the borderless version had.
 */
.de-ann-toggle {
  position: relative;
  flex: none;
  width: 28px; height: 16px;
  padding: 0;
  border: 1px solid ${t.color.borderInteractive}; border-radius: ${t.radius.xl};
  background: ${t.color.field};
  cursor: pointer;
  transition: background-color ${t.duration.base} ${t.ease}, border-color ${t.duration.base} ${t.ease},
    transform ${t.duration.fast} ${t.ease};
}
/* A 28x16 track is the drawing, not the target: 4px a side takes it to ${TARGET}. */
.de-ann-toggle::before {
  content: "";
  position: absolute; inset: -4px 0;
}
.de-ann-toggle::after {
  content: "";
  position: absolute; left: 1px; top: 1px;
  width: 12px; height: 12px;
  border-radius: 50%;
  background: ${t.color.text};
  transform: translateX(0);
  transition: transform ${t.duration.base} ${t.ease}, background-color ${t.duration.base} ${t.ease};
}
.de-ann-toggle:hover { background: ${t.color.fieldHover}; }
.de-ann-toggle[aria-checked="true"] {
  background: ${t.color.accentSurface};
  border-color: ${t.color.accentSurface};
}
.de-ann-toggle[aria-checked="true"]:hover {
  background: ${t.color.accentSurfaceHover};
  border-color: ${t.color.accentSurfaceHover};
}
.de-ann-toggle[aria-checked="true"]::after {
  transform: translateX(12px);
  background: ${t.color.onAccent};
}
/* 3% of 28px is a quarter of a pixel and reads as nothing; at this size the
   press has to be worth seeing, so the whole switch squeezes. */
.de-ann-toggle:active { transform: scale(0.96); }
.de-ann-toggle:focus-visible { outline: 2px solid ${t.color.accent}; outline-offset: 2px; }

/*
 * THE MARKER-COLOUR SWATCHES ARE GONE.
 *
 * Seven 20px circles under a stacked label, and before them a native
 * \`<input type="color">\`. Both were answers to a question the panel had no
 * business asking: the pin is read by the person who dropped it, in the
 * session they dropped it in, and the shipped blue is legible on a white page
 * and a dark one alike. \`markerColor\` is still the setting the painter reads
 * — see \`.de-ann-marker\` above, which still takes its fill from
 * \`--de-ann-color\` — it simply has no control in the fold any more.
 *
 * \`.de-ann-setting--stacked\` survives, because MCP still needs it.
 */

/*
 * Reduced motion keeps the fade and gives up the travel.
 *
 * base.ts flattens every duration under the chrome to 0.01ms, which is right
 * for a hover tint and wrong for a card appearing next to the pointer: cut to
 * nothing, the composer materialises out of the page with no frame saying where
 * it came from. So it keeps a crossfade at the same length and drops the 4px
 * rise — fewer and gentler, not none, the same bargain base.ts strikes for the
 * panels. \`!important\` because the blanket rule it is answering carries one.
 */
@media (prefers-reduced-motion: reduce) {
  .de-ann-composer { animation: de-ann-composer-fade ${t.duration.fast} linear !important; }
  /*
   * The TRANSITION and the TRANSFORM. Zeroing only the first left the pin
   * jumping to 1.1 instantly on hover instead of easing there, which is the
   * jump reduced motion is asked to remove, delivered faster.
   * \`.de-lint-marker\` — the other pin drawn over the app — already does both.
   */
  .de-ann-marker { transition: none !important; }
  .de-ann-marker:hover { transform: none; }
  /*
   * The settings block makes the same trade one level down: the switch keeps
   * its fill and gives up the slide, the knob is simply already at the other
   * end, and nothing under a press squeezes. The fold keeps its crossfade,
   * because it was never movement — it is the only frame saying the rows
   * arrived rather than appeared.
   */
  .de-ann-settings-body:not([hidden]) {
    animation: de-ann-settings-in ${t.duration.fast} linear !important;
  }
  .de-ann-toggle::after { transition: background-color ${t.duration.base} linear !important; }
  /*
   * Copy's tick keeps the crossfade and gives up the squeeze — the same trade
   * the composer makes two rules up. The fade is the frame that says the mark
   * CHANGED rather than that the panel repainted, and cutting it leaves a green
   * tick that was simply always there; the scale is decoration and goes. Both
   * halves are stated, because \`transform: none\` alone would leave the outgoing
   * glyph mid-transition at whatever scale the blanket rule froze it at.
   */
  [data-designlayer] .de-swap > svg[data-de-glyph] {
    transition: opacity ${t.duration.fast} linear !important;
  }
  .de-swap > .de-swap-done,
  .de-swap--done > .de-swap-rest { transform: none; }
  /* \`.de-ann-format:active\` stood beside this one until the four-segment format
     strip became a row and a \`selectField\`. Nothing wears that class now, and a
     reduced-motion exemption for a control that does not exist is one more
     selector every reader of this block has to rule out. */
  .de-ann-toggle:active { transform: none; }
  /*
   * Nothing here for the row actions or the setting tip, for the reason
   * toolbar.ts gives about its own: the blanket rule above clamps DURATION and
   * leaves DELAY alone, which is exactly the trade these two want — the fade
   * goes, the 400ms wait before a tip appears stays. Writing \`transition: none\`
   * for them would zero the property list and take the wait with it, handing
   * the reader most disturbed by flicker six labels flashing as the pointer
   * crosses the block.
   */
}
@keyframes de-ann-composer-fade {
  from { opacity: 0; }
}
`
