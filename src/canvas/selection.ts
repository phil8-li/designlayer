/**
 * Selection and hover chrome drawn in the overlay layer.
 *
 * Geometry is read every frame while something is selected: the app animates
 * with Motion, so a cached rect would drift behind the element it outlines.
 * Guides and measurements paint from this same loop — a second rAF loop would
 * double the layout reads every frame costs.
 */

import { el } from "../core/dom"
import { prefersReducedMotion } from "../core/motion"
import { selectionOwnsInput } from "../core/store"
import { tokens } from "../core/tokens"
import type { EditorContext } from "../core/context"

const HANDLES = [
  ["nw", 0, 0, "nwse-resize"],
  ["n", 0.5, 0, "ns-resize"],
  ["ne", 1, 0, "nesw-resize"],
  ["e", 1, 0.5, "ew-resize"],
  ["se", 1, 1, "nwse-resize"],
  ["s", 0.5, 1, "ns-resize"],
  ["sw", 0, 1, "nesw-resize"],
  ["w", 0, 0.5, "ew-resize"],
] as const

export type HandleId = (typeof HANDLES)[number][0]

/** Handles read as 7px but grab at 13px: Fitts' law without the visual bulk. */
const HANDLE_SIZE = 7
const HANDLE_HIT = 13

export interface NodePool {
  /** Returns a visible node; call `flush()` once per pass to hide the rest. */
  take(): HTMLElement
  flush(): void
}

/**
 * Shown and hidden as ONE pair of properties, everywhere in this layer.
 *
 * `display` alone is what every node here used to switch on, and it cannot be
 * transitioned: the browser takes the node out of the box tree on the frame it
 * changes, so an outline appearing and a guide vanishing were cuts with nothing
 * to say they had happened — the most repeated state change in the editor, and
 * the one with the least to show for it.
 *
 * Writing `opacity` beside it hands that decision to the stylesheet. WHICH
 * properties actually move is `css/canvas.ts`'s call and differs per class —
 * the outline fades both ways, a guide fades in and leaves at once — and the
 * two writes here are the same either way, so no painter has to know which.
 *
 * `display` is still written, and still inline, because it is what keeps a
 * hidden node out of hit-testing and out of paint. `allow-discrete` in the
 * stylesheet holds its USED value back for the length of the fade without
 * changing what `style.display` reads back as.
 */
function setShown(node: HTMLElement, shown: boolean): void {
  /*
   * Written only when it changes — a cheap guard on a hot path, and honestly
   * reported: it measured as NEUTRAL in Chrome rather than as a saving.
   *
   * This runs for every overlay node on every animation frame while anything is
   * selected, so re-asserting an unchanged `display` looked like the obvious
   * waste to remove. It is not where the time goes; the engine already drops an
   * inline write of an identical value. Kept anyway because it is one inline
   * read against a style mutation, it makes the write self-describing, and not
   * every engine is Chrome — but it is not the optimisation it looks like, and
   * the next person should not go hunting for the saving it does not make.
   *
   * Where the time actually goes is in `css/canvas.ts`, on the transition list
   * itself. The measurement is recorded there.
   */
  const next = shown ? "block" : "none"
  if (node.style.display === next) return
  node.style.display = next
  /*
   * Empty, not `"1"`, and the difference is a bug this used to cause.
   *
   * An inline declaration beats a stylesheet at any specificity, so writing `1`
   * here overruled `.de-outline--related { opacity: 0.82 }` and every related
   * outline painted at full strength — the same weight as the selection it is
   * supposed to sit behind. Clearing the property instead lets each class state
   * its own resting opacity, which is where that decision belongs.
   *
   * Only the zero is pinned: a hidden node has one correct opacity whatever
   * class it wears, and the fade out has to have something to animate to.
   */
  node.style.opacity = shown ? "" : "0"
}

/** Overlay nodes are pooled so the per-frame painters never allocate DOM. */
export function createNodePool(parent: HTMLElement, className: string): NodePool {
  const nodes: HTMLElement[] = []
  let used = 0
  return {
    take() {
      let node = nodes[used]
      if (!node) {
        node = el("div", { class: className })
        parent.append(node)
        nodes.push(node)
      }
      setShown(node, true)
      used += 1
      return node
    },
    flush() {
      for (let index = used; index < nodes.length; index += 1) setShown(nodes[index], false)
      used = 0
    },
  }
}

/** Positions an overlay node; sizes are omitted for auto-sized nodes. */
export function placeNode(
  node: HTMLElement,
  x: number,
  y: number,
  width?: number,
  height?: number
): void {
  node.style.transform = `translate(${x}px, ${y}px)`
  if (width !== undefined) node.style.width = `${width}px`
  if (height !== undefined) node.style.height = `${height}px`
}

/** Centres an auto-sized badge on a point. */
export function placeBadge(node: HTMLElement, x: number, y: number, text: string): void {
  node.textContent = text
  node.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`
}

/**
 * The hover outline, published to the lane that owns the modifier keys.
 *
 * Module-level because the node is built inside `installSelectionFrame` and
 * there is exactly one of it on a page. The alternative was handing it out
 * through the context, which would put a DOM reference into the store so that
 * one keyboard handler could reach it.
 */
let hoverOutlineNode: HTMLElement | null = null

/** The class `css/canvas.ts` pins to zero opacity for the length of a dip. */
const DIP_CLASS = "de-outline--dip"
/** Read off the token rather than restated, the way `core/leave.ts` does it. */
const DIP_MS = Number.parseFloat(tokens.duration.snap)
let dipTimer = 0
/** While true the painter leaves the hover outline where it is. See below. */
let dipHeld = false

/**
 * Let the hover outline MOVE while nobody can see it move.
 *
 * A modifier held or released with the pointer completely stationary changes
 * which element a click would land on, so the outline has to re-answer — and
 * with no pointer travel to carry the change, the box teleports from the
 * shallow element to the deep one between two frames, which reads as a glitch
 * rather than as an answer to the key.
 *
 * A fade rather than a crossfade between two nodes, and that is forced rather
 * than chosen: this file rewrites `transform`, `width` and `height` on every
 * overlay node EVERY animation frame, so the outline's GEOMETRY can never be
 * transitioned — an overlay that eased into place would trail the element it
 * outlines by the length of the ease, for the whole of every drag. `opacity` is
 * the one property the frame loop never writes, so it is the only one there is
 * to spend on this.
 *
 * WHAT IS DEFERRED IS THE PAINT, NOT THE STATE. The store's `hovered` still
 * changes on the key, synchronously, because it is the answer to "what would a
 * click take" and every other reader of it — the layers tree, the click path
 * itself — is entitled to that answer now. Only this one node holds still,
 * which is why the hold is a flag the painter reads rather than a delay in
 * front of `setHovered`: the outline is allowed to lag the truth for exactly as
 * long as it is invisible, and not one frame longer.
 */
export function dipHoverOutline(): void {
  const node = hoverOutlineNode
  /*
   * Nothing to hide behind, in either case, so the move just happens. An
   * outline that is not on screen fades in from `@starting-style` when the
   * painter shows it; and a reader who asked for reduced motion has no fade at
   * all, because the blanket in `css/base.ts` clamps this node's transitions to
   * 0.01ms — dipping there would punch a hole in the overlay for the length of
   * the timer and buy nothing for it.
   */
  if (!node || node.style.display === "none" || prefersReducedMotion()) return
  if (dipTimer) window.clearTimeout(dipTimer)
  node.classList.add(DIP_CLASS)
  dipHeld = true
  dipTimer = window.setTimeout(() => {
    dipTimer = 0
    dipHeld = false
    /*
     * The hold is dropped here and the class one frame later, in that order.
     * The frame loop's own callback is already queued ahead of this one — it
     * requeues itself at the end of every draw while anything is hovered — so
     * it places the new geometry first and this clears the dip second, both
     * inside one style recalculation. Clearing the class first would fade the
     * outline back in around the box it is about to leave, which is the
     * teleport again with an extra step in front of it.
     *
     * Guarded, because a second modifier press landing inside that one frame
     * starts a fresh dip — and this callback, queued by the dip before it,
     * would otherwise clear the class while the painter is still holding the
     * outline still, showing the frozen box it exists to hide.
     */
    requestAnimationFrame(() => {
      if (!dipTimer) node.classList.remove(DIP_CLASS)
    })
  }, DIP_MS)
}

/**
 * End a dip now, wherever it had got to.
 *
 * For the pointer, which outranks the keyboard on this question: a move is a
 * fresh answer to "what is under the pointer", it carries its own change, and
 * the travel is the transition. Leaving the dip running would hold the outline
 * frozen and invisible while the pointer was visibly somewhere else.
 */
export function releaseHoverDip(): void {
  if (!dipTimer) return
  window.clearTimeout(dipTimer)
  dipTimer = 0
  dipHeld = false
  hoverOutlineNode?.classList.remove(DIP_CLASS)
}

export function installSelectionFrame(context: EditorContext): void {
  const layer = context.slots.overlay
  const hoverOutline = el("div", { class: "de-outline de-outline--hover" })
  hoverOutlineNode = hoverOutline
  const boundsOutline = el("div", { class: "de-outline" })
  layer.append(hoverOutline, boundsOutline)

  // Per-element outlines for a multi-selection; `boundsOutline` wraps the set.
  const members = createNodePool(layer, "de-outline")
  const related = createNodePool(layer, "de-outline de-outline--related")
  let highlighted: Element[] = []

  const handles = new Map<HandleId, HTMLElement>()
  const inset = (HANDLE_HIT - HANDLE_SIZE) / 2
  for (const [id, , , cursor] of HANDLES) {
    const visual = el("div", {
      class: "de-handle",
      style: `margin:0;left:${inset}px;top:${inset}px;pointer-events:none`,
    })
    handles.set(
      id,
      el(
        "div",
        {
          // The hit box is the node the painter shows, places and hit-tests, so
          // it is also the node that carries the fade and the one `:hover` can
          // reach — the 7px drawing inside it is `pointer-events: none`, which
          // is why a `.de-handle:hover` rule could never have fired.
          class: "de-handle-hit",
          "data-handle": id,
          style: `position:absolute;width:${HANDLE_HIT}px;height:${HANDLE_HIT}px;margin:${-HANDLE_HIT / 2}px 0 0 ${-HANDLE_HIT / 2}px;pointer-events:auto;cursor:${cursor}`,
        },
        [visual]
      )
    )
  }
  layer.append(...handles.values())

  const hide = (node: HTMLElement) => {
    setShown(node, false)
  }

  const hideAll = () => {
    hide(hoverOutline)
    hide(boundsOutline)
    members.flush()
    related.flush()
    for (const handle of handles.values()) hide(handle)
  }

  const paintSelection = () => {
    const state = context.getState()
    const selection = state.selection

    // Interactive mode is a claim that the editor is not there, and hidden
    // chrome is the same claim made louder. An outline left standing over an
    // app the user is now clicking through is the one thing that would
    // disprove either, so the chrome goes before the handlers do. Asked
    // through the store's gate rather than off `state.interactive`, so a
    // second reason to stand down cannot forget to reach the painter.
    if (!selectionOwnsInput()) {
      hideAll()
      return
    }

    // Every rect this frame needs is read before anything is written. Writing a
    // style between two reads invalidates layout, so an interleaved loop forces
    // one synchronous reflow per selected element — on every animation frame.
    // Any selected element already draws its own stroke; a hover outline on top
    // of one would read as a second, thicker border rather than as feedback.
    const hoverRect =
      state.hovered && !selection.some((entry) => entry.element === state.hovered)
        ? state.hovered.getBoundingClientRect()
        : null
    const rects: DOMRect[] = []
    for (const entry of selection) {
      if (!entry.element.isConnected) continue
      rects.push(entry.element.getBoundingClientRect())
    }
    const relatedRects = highlighted
      .filter(
        (element) =>
          element.isConnected && !selection.some((entry) => entry.element === element)
      )
      .map((element) => element.getBoundingClientRect())

    if (hoverRect) {
      setShown(hoverOutline, true)
      // Frozen rather than tracked for the length of a dip, which is the whole
      // mechanism: `hovered` has already moved to the element the modifier
      // picked, and this node is at zero opacity, so holding its last box is
      // how the jump between the two ends up happening off screen.
      if (!dipHeld) {
        placeNode(hoverOutline, hoverRect.left, hoverRect.top, hoverRect.width, hoverRect.height)
      }
    } else {
      hide(hoverOutline)
    }

    for (const rect of relatedRects) {
      placeNode(related.take(), rect.left, rect.top, rect.width, rect.height)
    }
    related.flush()

    let left = Number.POSITIVE_INFINITY
    let top = Number.POSITIVE_INFINITY
    let right = Number.NEGATIVE_INFINITY
    let bottom = Number.NEGATIVE_INFINITY
    const count = rects.length

    for (const rect of rects) {
      if (rect.left < left) left = rect.left
      if (rect.top < top) top = rect.top
      if (rect.right > right) right = rect.right
      if (rect.bottom > bottom) bottom = rect.bottom
      if (count > 1) {
        placeNode(members.take(), rect.left, rect.top, rect.width, rect.height)
      }
    }
    members.flush()

    if (count === 0) {
      hide(boundsOutline)
      for (const handle of handles.values()) hide(handle)
      return
    }

    const width = right - left
    const height = bottom - top
    setShown(boundsOutline, true)
    boundsOutline.style.borderStyle = "solid"
    placeNode(boundsOutline, left, top, width, height)

    const showHandles = count === 1 && state.tool === "move"
    /*
     * AN AXIS TOO SHORT TO CARRY THREE TARGETS, AND THEN TOO SHORT TO CARRY TWO.
     *
     * The first rule was already here: a middle handle is dropped when its axis
     * is under 24px, because three 13px hit boxes cannot share less than that
     * without the middle one sitting on top of both its neighbours.
     *
     * The second was not, and it is the case with no way out. Below
     * `HANDLE_HIT` the axis cannot carry TWO either — the corners are centred
     * on the edges, so on a 10px-wide element `nw` and `ne` are 10px apart with
     * 13px boxes and overlap by three. Both are live, both are drawn, and the
     * pixels where they cross belong to whichever the hit test reaches first.
     * "Never overlapping" is the half of the hit-area rule a user cannot aim
     * their way out of: with a target too small you can zoom or try again, and
     * with two targets on one pixel there is nothing to try.
     *
     * The collapsed axis keeps ONE side and drops the other. Keeping the near
     * corners — `fx === 0` when too narrow, `fy === 0` when too short — rather
     * than the far ones is arbitrary between the two and consistent across all
     * four handles, which is what matters: the survivors are `nw`/`sw` on a
     * narrow element and `nw`/`ne` on a short one, so the top-left corner is
     * always present and a sliver of any shape still resizes.
     *
     * Growing `HANDLE_HIT` to the 24px floor is the fix that is NOT taken, and
     * `css/canvas.ts` already argues why: at 24 every element under 48px would
     * be completely covered by its own handles, so the target would clear the
     * floor by making the thing it points at unclickable.
     */
    const narrow = width < HANDLE_HIT
    const short = height < HANDLE_HIT
    for (const [id, fx, fy] of HANDLES) {
      const handle = handles.get(id)
      if (!handle) continue
      const horizontalMiddle = fx === 0.5 && width < 24
      const verticalMiddle = fy === 0.5 && height < 24
      // A corner on the far side of an axis that cannot separate two boxes.
      const crowdedCorner = (narrow && fx === 1) || (short && fy === 1)
      if (!showHandles || horizontalMiddle || verticalMiddle || crowdedCorner) {
        hide(handle)
        continue
      }
      setShown(handle, true)
      placeNode(handle, left + width * fx, top + height * fy)
    }
  }

  let frame = 0
  let destroyed = false
  const schedule = () => {
    if (!destroyed && frame === 0) frame = requestAnimationFrame(draw)
  }
  const draw = () => {
    frame = 0
    if (!layer.isConnected) {
      destroyed = true
      unsubscribe()
      return
    }
    paintSelection()
    const state = context.getState()
    // Selected or hovered app content may move under Motion, so track it. Once
    // both are empty, stop entirely until the store wakes the painter again.
    // Standing down stops it too — either reason: a selection survives the mode
    // switch so the user gets it back on the way out, but tracking geometry
    // nobody is drawing would cost a layout read per frame for a blank overlay.
    if (!selectionOwnsInput()) return
    if (state.selection.length > 0 || state.hovered || highlighted.length > 0) schedule()
  }

  const unsubscribe = context.subscribe((next, previous) => {
    if (next.selection !== previous.selection) highlighted = []
    if (
      next.selection !== previous.selection ||
      next.hovered !== previous.hovered ||
      next.tool !== previous.tool ||
      next.interactive !== previous.interactive ||
      next.chromeHidden !== previous.chromeHidden
    ) {
      schedule()
    }
  })
  const onHighlight = (event: Event) => {
    const detail = (event as CustomEvent<{ elements?: Element[] }>).detail
    highlighted = Array.isArray(detail?.elements)
      ? detail.elements.filter((element): element is Element => element instanceof Element)
      : []
    schedule()
  }
  window.addEventListener("designlayer:highlight-elements", onHighlight)
  schedule()
  window.addEventListener("beforeunload", () => {
    destroyed = true
    unsubscribe()
    window.removeEventListener("designlayer:highlight-elements", onHighlight)
    if (frame) cancelAnimationFrame(frame)
  })
}
