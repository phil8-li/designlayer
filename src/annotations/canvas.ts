/**
 * Annotation capture on the canvas, and the pins it leaves behind.
 *
 * The store remembers notes; this is where one gets made. Three gestures,
 * because the thing worth annotating is not always an element: a click pins a
 * note on what is under it, a drag pins one on a box that may contain nothing
 * at all, and a text selection pins one on the exact words. The drag is the
 * reason the mode exists — a gap that is too tight has no element to select,
 * and every other surface in this editor can only talk about elements.
 *
 * Everything here is inert unless `annotating` is set. The mode lives in the
 * store rather than in this file for the reason `core/store` gives, and the
 * consequence lands here: the selection lane keeps every handler it has
 * installed and stands down through `selectionOwnsInput()`, so this module
 * never unbinds anything to take the pointer. It only has to be sure that when
 * it does take it, it takes all of it.
 */

import { clamp, el, isCanvasElement, isChrome } from "../core/dom"
import { icon } from "../core/icons"
import { tokens } from "../core/tokens"
import { editorOwnsInput } from "../core/store"
import type { EditorContext } from "../core/context"
import {
  addAnnotation,
  annotationSettings,
  annotations,
  notePinsVisible,
  onAnnotationsChange,
  onMarkerLayerChange,
  onSettingsChange,
  setMarkerLayer,
  updateAnnotation,
} from "./store"
import { describeElement } from "./output"
import type { AnnotationKind, AnnotationRect, AnnotationRecord } from "./types"

/**
 * One pixel more than the marquee's threshold, and deliberately so: a region
 * note is the only gesture here that cannot be undone by clicking elsewhere —
 * it opens a composer — so a hand that shook during a click should still read
 * as a click.
 */
const DRAG_THRESHOLD = 4

/** Keep-out from the viewport edge, the same margin the token picker uses. */
const EDGE = 8

/** Gap between the thing being annotated and the composer above or below it. */
const GAP = 8

/** How far past the viewport a pin may sit before it stops being painted. */
const BLEED = 32

/**
 * The contract between a note's two views: the pin here, and the row in the
 * Notes panel.
 *
 * They are ONE note seen twice, so they have to light up together — a list of
 * six rows beside six pins is unreadable unless pointing at either half says
 * which half of the pair the other is. The seam is three events on `window`,
 * the same one `designlayer:highlight-elements` already uses between the
 * options panel and the canvas, and for the same reason: the two surfaces are
 * mounted independently, neither owns the other, and an import either way
 * would make the marker layer unusable without the panel or vice versa.
 *
 *   `designlayer:annotation-hover`  panel -> canvas  `{ id: string | null }`
 *     The pointer is on that row, or has left every row (`null`). The matching
 *     pin takes `MARKER_ACTIVE`; the stylesheet owns what that looks like.
 *
 *   `designlayer:marker-hover`      canvas -> panel  `{ id: string | null }`
 *     The mirror of it. The pointer is on that pin, or has left it (`null`),
 *     and the panel lights the matching row.
 *
 *   `designlayer:annotation-edit`   panel -> canvas  `{ id: string }`
 *     Re-open that note's composer over the page, prefilled, saving back to
 *     the SAME note rather than writing a second one.
 *
 * `null` is a value in the hover pair rather than a second event, because the
 * two halves have to be handled by one code path: a listener that only ever
 * hears "now this one" is how a highlight gets stuck on a row nobody is on.
 */
const HOVER_EVENT = "designlayer:annotation-hover"
const MARKER_HOVER_EVENT = "designlayer:marker-hover"
const EDIT_EVENT = "designlayer:annotation-edit"

/** The pin the panel is pointing at. The look belongs to `css/annotations`. */
const MARKER_ACTIVE = "de-ann-marker--active"

/** A viewport-space box: what a gesture produced and what the composer anchors to. */
interface Box {
  left: number
  top: number
  width: number
  height: number
}

/** One completed gesture, before the user has said anything about it. */
interface Gesture {
  kind: AnnotationKind
  box: Box
  /** The live node the note is about, or `null` for a region over empty space. */
  element: Element | null
  selectedText: string | null
}

export function installAnnotations(context: EditorContext): void {
  const layer = el("div", { class: "de-ann-layer" })
  context.slots.overlay.append(layer)

  /** Pins are pooled: a scroll must not allocate DOM on every frame. */
  const markers: HTMLButtonElement[] = []

  let hint: HTMLElement | null = null
  let outline: HTMLElement | null = null
  let region: HTMLElement | null = null
  let composer: HTMLElement | null = null
  let dismiss: () => void = () => {}

  /**
   * The element under the pointer while annotating.
   *
   * Local rather than `state.hovered`, and that is not tidiness: writing it to
   * the store would wake the selection painter and draw an accent outline over
   * the element as well, which is the editor claiming it is about to select
   * something it will not select.
   */
  let hovered: Element | null = null

  /**
   * The note the PANEL says its pointer is on, held as an id rather than as a
   * node.
   *
   * The pins are pooled, so the button carrying a note this frame may carry a
   * different one the next. Latching onto whichever element matched when the
   * event arrived is exactly how a highlight ends up on the wrong pin after a
   * scroll; deriving it in `paint` from the id means the class follows the
   * note, which is the only thing the panel named.
   */
  let activeNote: string | null = null

  /**
   * The note whose pin we last told the panel about, so the mirror is only
   * dispatched on a real change.
   */
  let reportedHover: string | null = null

  const reportMarkerHover = (id: string | null): void => {
    if (reportedHover === id) return
    reportedHover = id
    window.dispatchEvent(new CustomEvent(MARKER_HOVER_EVENT, { detail: { id } }))
  }

  let originX = 0
  let originY = 0
  let pending = false
  let dragging = false
  let started: Gesture | null = null

  const annotating = (): boolean => context.getState().annotating

  /**
   * The topmost element of the APP under a point.
   *
   * `elementsFromPoint` rather than `elementFromPoint` because our own pins,
   * the composer and the live drag rect all sit over the page: the first hit is
   * regularly chrome, and `isCanvasElement` rejects it along with `html` and
   * `body`. That rejection is also the guard against the infinite regress —
   * every node this module creates goes through `el()`, which marks it
   * `data-designlayer`, so a pin can never become the target of a note.
   */
  const elementAt = (x: number, y: number): Element | null => {
    for (const node of document.elementsFromPoint(x, y)) {
      if (isCanvasElement(node)) return node
    }
    return null
  }

  const boxOf = (rect: DOMRect): Box => ({
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
  })

  /**
   * Viewport to page, at the moment of the gesture.
   *
   * Converted here and never later: the composer stays open while the user
   * types, the page underneath still scrolls, and a conversion done at save
   * time would offset the note by however far they scrolled while thinking.
   */
  const toPageRect = (box: Box): AnnotationRect => ({
    x: box.left + window.scrollX,
    y: box.top + window.scrollY,
    width: box.width,
    height: box.height,
  })

  // ---------- blocking the app ----------

  /**
   * Swallow a page interaction while annotating.
   *
   * Capture on `window`, which is the first node in the propagation path, so
   * the app never sees the event at all. Bubble phase would be far too late:
   * by then the menu item the user was trying to annotate has already run its
   * own handler and closed the menu it lives in, and there is no state left to
   * annotate. That case is the whole reason `blockPageInteractions` defaults
   * on, and turning it off is for the other case — driving the app INTO the
   * state worth a note — where the click has to land.
   *
   * Cancelling the press has a second effect worth having: the default action
   * of a press is to collapse the current text selection, so preventing it is
   * what keeps a selection alive long enough for the gesture to read it.
   */
  const swallow = (event: Event): void => {
    if (!annotating() || !editorOwnsInput()) return
    if (isChrome(event.target)) return
    if (!annotationSettings().blockPageInteractions) return
    event.preventDefault()
    event.stopPropagation()
  }

  // ---------- the composer ----------

  /**
   * The edges the composer may not cross.
   *
   * NOT the viewport. The shell insets the app between its docked panels and
   * publishes where they end as `--de-left` / `--de-right`, so on a 1440px
   * screen with the inspector open the last usable pixel is 1180. Clamping
   * against `innerWidth` put the Save button underneath the inspector — seen
   * on the Angular host the first time a note was written on anything in the
   * right half of the page, with Cancel the only button still reachable.
   *
   * Read per placement rather than cached: a panel can be toggled while the
   * composer is open, and Hide editor moves both edges at once.
   */
  const bounds = (): { left: number; right: number } => {
    const style = getComputedStyle(document.documentElement)
    const read = (name: string): number => {
      const value = Number.parseFloat(style.getPropertyValue(name))
      return Number.isFinite(value) ? value : 0
    }
    return { left: read("--de-left"), right: window.innerWidth - read("--de-right") }
  }

  /**
   * Anchored to what is being annotated, flipped above it when the popover
   * would run off the bottom. Measured after mount rather than estimated: the
   * stylesheet owns its size, and a Save button past the edge is a note that
   * cannot be saved.
   */
  const place = (node: HTMLElement, anchor: Box): void => {
    const box = node.getBoundingClientRect()
    const edges = bounds()
    const min = edges.left + EDGE
    const max = Math.max(min, edges.right - box.width - EDGE)
    node.style.left = `${clamp(anchor.left, min, max)}px`
    const below = anchor.top + anchor.height + GAP
    node.style.top =
      below + box.height + EDGE <= window.innerHeight
        ? `${below}px`
        : `${Math.max(EDGE, anchor.top - GAP - box.height)}px`
  }

  const openComposer = (anchor: Box, initial: string, commit: (comment: string) => void): void => {
    // One at a time. A second gesture while the first is still being typed
    // discards the draft rather than stacking two popovers over each other.
    dismiss()

    const text = el("textarea", {
      class: "de-ann-composer-text",
      placeholder: "What is wrong here?",
      "aria-label": "Annotation comment",
      rows: 3,
    })
    text.value = initial

    const close = (): void => {
      window.removeEventListener("keydown", onKey, true)
      composer?.remove()
      composer = null
      dismiss = () => {}
    }

    const save = (): void => {
      const comment = text.value.trim()
      // An empty note is the user changing their mind mid-gesture, which is the
      // same thing as cancelling — and a pin with nothing to say would be one
      // more marker on the page that an agent has to be told to ignore.
      if (comment) commit(comment)
      close()
    }

    /**
     * Escape cancels wherever the focus happens to be.
     *
     * At capture on `window`, because the canvas keymap answers Escape too: it
     * stands down for a text field, but the moment focus is anywhere else the
     * first Escape would clear the selection instead of closing this.
     */
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") return
      event.preventDefault()
      event.stopPropagation()
      close()
    }

    text.addEventListener("keydown", (event) => {
      // Enter saves and Shift+Enter is the newline, not the other way round:
      // almost every note is one line, and every comment box the designer has
      // ever used has already trained this pair.
      if (event.key !== "Enter" || event.shiftKey) return
      event.preventDefault()
      save()
    })

    composer = el(
      "div",
      {
        class: "de-ann-composer",
        role: "dialog",
        "aria-label": "Leave a note",
        // The layer is inert so it cannot swallow the app's clicks; each
        // interactive surface opts back in for itself, the same shape the
        // resize handles in `canvas/selection` use.
        style: "pointer-events:auto",
      },
      [
        text,
        el("div", { class: "de-ann-composer-actions" }, [
          el("button", { class: "de-button", type: "button", onclick: close }, ["Cancel"]),
          el("button", { class: "de-button de-button--primary", type: "button", onclick: save }, [
            "Save",
          ]),
        ]),
      ]
    )

    layer.append(composer)
    place(composer, anchor)
    window.addEventListener("keydown", onKey, true)
    dismiss = close
    text.focus()
  }

  /**
   * Turn a finished gesture into a note.
   *
   * The target is described HERE rather than when the user presses Save. The
   * page under this editor is a dev server that hot-reloads, and a reload while
   * the composer is open would otherwise have us write down whatever replaced
   * the element instead of the one they pointed at.
   */
  const capture = (gesture: Gesture): void => {
    const target = gesture.element ? describeElement(gesture.element) : null
    const rect = toPageRect(gesture.box)
    openComposer(gesture.box, "", (comment) => {
      addAnnotation({
        kind: gesture.kind,
        comment,
        url: window.location.href,
        rect,
        target,
        selectedText: gesture.selectedText,
        element: gesture.element,
      })
    })
  }

  /**
   * A stored box dragged back inside the editable band, keeping its size.
   *
   * Only the fallback path needs this. A pin can only be clicked where it is
   * painted, and `markerPoint` hides the ones that are off screen — but the
   * Notes panel can ask to edit a note that is a screen and a half further
   * down, and the stored rect converted at the current scroll then anchors the
   * composer somewhere nobody can see or type into.
   */
  const intoView = (box: Box): Box => {
    const edges = bounds()
    const min = edges.left + EDGE
    return {
      ...box,
      left: clamp(box.left, min, Math.max(min, edges.right - EDGE)),
      top: clamp(box.top, EDGE, Math.max(EDGE, window.innerHeight - EDGE)),
    }
  }

  /**
   * Re-opening a note edits it rather than starting another one.
   *
   * The live element wins when there still is one; a reload dropped every
   * node, so the stored page rect is all a rehydrated note has left, and it is
   * still enough to put the composer beside the place the note is about.
   */
  const reopen = (note: AnnotationRecord): void => {
    const live = note.element
    const anchor =
      live && live.isConnected
        ? boxOf(live.getBoundingClientRect())
        : intoView({
            left: note.rect.x - window.scrollX,
            top: note.rect.y - window.scrollY,
            width: note.rect.width,
            height: note.rect.height,
          })
    openComposer(anchor, note.comment, (comment) => updateAnnotation(note.id, { comment }))
  }

  // ---------- the marker layer ----------

  const markerAt = (index: number): HTMLButtonElement => {
    const pooled = markers[index]
    if (pooled) return pooled
    const marker = el("button", {
      class: "de-ann-marker",
      type: "button",
      style: "pointer-events:auto",
    })
    marker.addEventListener("click", (event) => {
      // The pin belongs to the editor, not to the page beneath it, and while
      // annotating the next press would otherwise pin a second note on top.
      event.preventDefault()
      event.stopPropagation()
      const note = annotations().find((entry) => entry.id === marker.dataset.note)
      if (note) reopen(note)
    })
    /**
     * The mirror of the panel's own hover, and the id is captured on the way
     * IN rather than re-read on the way out.
     *
     * `dataset.note` is repainted under the pointer whenever the set of notes
     * changes, so a leave handler that read it again could clear the highlight
     * for a note the pointer never touched — or, worse, decline to clear the
     * one it did. The guard is what makes pins that overlap safe: the second
     * pin has already claimed the mirror by the time the first one leaves.
     */
    let entered: string | null = null
    marker.addEventListener("pointerenter", () => {
      entered = marker.dataset.note ?? null
      reportMarkerHover(entered)
    })
    marker.addEventListener("pointerleave", () => {
      if (reportedHover === entered) reportMarkerHover(null)
      entered = null
    })
    markers.push(marker)
    layer.append(marker)
    return marker
  }

  /**
   * Where a pin goes this frame, or `null` when it is off screen.
   *
   * The live element wins over the stored rect whenever there still is one:
   * that is the whole reason the record holds a node it never persists — a
   * sticky header or an accordion opening above the element moves it without
   * moving the page, and the stored page rect cannot know. Off-screen pins are
   * hidden rather than parked past the edge, because a button positioned out
   * of view is still in the tab order and Tab would walk notes nobody can see.
   */
  /**
   * Put a rehydrated note back on the element it was written about.
   *
   * A reload drops every `element`, and until this existed the marker fell
   * straight through to its stored page rect for the rest of the session. That
   * is only equivalent to the live node while the PAGE is what scrolls, and in
   * an app that scrolls an inner container — which is most of them — the window
   * never scrolls at all. `window.scrollY` stays 0, the rect never changes, and
   * the pin freezes at the coordinate it was dropped on while the content
   * moves out from under it: the first note ends up somewhere its element no
   * longer is, or off the top of the viewport where `markerPoint` hides it, and
   * it reads as a marker that has gone missing.
   *
   * The selector is the same one `cssPath` built for the agent brief, and it
   * was already written to disambiguate siblings. Re-resolving costs one query
   * per note, once, and the result is cached back onto the record so a miss is
   * not retried every frame. It is deliberately NOT persisted: the element is
   * live state, and the whole point is that it is re-derived after a reload.
   */
  const reattach = (note: AnnotationRecord): Element | null => {
    const selector = note.target?.selector
    if (!selector) return null
    let found: Element | null = null
    try {
      found = document.querySelector(selector)
    } catch {
      // A selector the page can no longer parse is a miss, not a crash.
      found = null
    }
    // Never re-attach to the editor's own chrome: a marker that anchored itself
    // to a panel would follow the panel around and annotate the annotator.
    note.element = found && isCanvasElement(found) ? found : null
    return note.element
  }

  const markerPoint = (note: AnnotationRecord): { left: number; top: number } | null => {
    const live = note.element?.isConnected ? note.element : reattach(note)
    const rect =
      live && live.isConnected
        ? live.getBoundingClientRect()
        : { left: note.rect.x - window.scrollX, top: note.rect.y - window.scrollY }
    if (rect.left < -BLEED || rect.top < -BLEED) return null
    if (rect.left > window.innerWidth + BLEED || rect.top > window.innerHeight + BLEED) return null
    return { left: rect.left, top: rect.top }
  }

  /**
   * One pin per open note, plus the outline under the pointer.
   *
   * Every rect is read before anything is written, for the reason
   * `canvas/selection` spells out: a style write between two reads invalidates
   * layout, so an interleaved pass costs one synchronous reflow per note on
   * every frame of a scroll.
   */
  const paint = (): void => {
    const notes = annotations()
    const settings = annotationSettings()
    // Stood-down chrome answers the same way `hideUntilRestart` does: an editor
    // that has handed the page back must not leave its own marks over it. And
    // the audit layer answers alongside it: `notePinsVisible` is the hide
    // setting AND this being the layer in charge, because the two badges would
    // otherwise land on the same corner. See `MarkerLayer` in `./store`.
    const shown = notePinsVisible() && editorOwnsInput()

    const points = shown ? notes.map(markerPoint) : []
    const hoverRect =
      annotating() && hovered?.isConnected ? hovered.getBoundingClientRect() : null

    /*
     * On the DOCUMENT, not on the layer.
     *
     * Once, rather than on each pin: the colour is one fact about the set, and
     * a hundred inline fills would be a hundred style writes per settings
     * change to say it. But the layer is the wrong place to say it, because the
     * pins are not the only thing wearing this colour — the Notes panel draws
     * the same numbered disc beside every row, and the panel is a sibling
     * subtree, not a descendant of the canvas layer.
     *
     * Published on the layer, `var(--de-ann-color, …)` resolved for the pins
     * and fell through to the fallback everywhere else, so picking blue turned
     * the canvas blue and left every disc in the panel coral. `<html>` is the
     * only ancestor the canvas overlay, the docked panels and the popovers all
     * share — the same reason `css/base.ts` declares the theme palette there.
     */
    document.documentElement.style.setProperty("--de-ann-color", settings.markerColor)

    /**
     * Which notes ended up on screen this frame.
     *
     * Both highlights are reconciled against it below rather than trusted to
     * the pointer, because neither half of the correspondence is guaranteed to
     * be told when it ends. A note deleted while its row is hovered takes the
     * row away without a `pointerleave`; a pin scrolled out of view is hidden
     * under the pointer and fires none either. Either way the class or the
     * mirror would be left standing, which is the one failure that makes the
     * pairing untrustworthy — a lit pin for a note nobody is pointing at.
     */
    const onScreen = new Set<string>()

    for (let index = 0; index < points.length; index += 1) {
      const point = points[index]
      const marker = markerAt(index)
      if (!point) {
        marker.style.display = "none"
        marker.classList.remove(MARKER_ACTIVE)
        continue
      }
      const note = notes[index]
      const label = String(index + 1)
      onScreen.add(note.id)
      marker.style.display = "block"
      marker.style.left = `${point.left}px`
      marker.style.top = `${point.top}px`
      // Written only on change. These are the three properties that would
      // otherwise be re-set on every frame of every scroll, and `title` in
      // particular closes the tooltip the user is reading when it is re-set.
      if (marker.dataset.note !== note.id) marker.dataset.note = note.id
      if (marker.textContent !== label) marker.textContent = label
      if (marker.title !== note.comment) {
        marker.title = note.comment
        marker.setAttribute("aria-label", `Note ${label}: ${note.comment}`)
      }
      // Re-stated rather than added once, because the nodes are pooled: a pin
      // that last drew a resolved note would keep reading as resolved under
      // whichever note reuses it next.
      // Same reason, and the reason the panel names a note rather than a pin:
      // re-derived from the id every frame, so the emphasis follows the note
      // through a repool instead of staying on the button it first landed on.
      marker.classList.toggle(MARKER_ACTIVE, note.id === activeNote)
    }
    for (let index = points.length; index < markers.length; index += 1) {
      markers[index].style.display = "none"
      markers[index].classList.remove(MARKER_ACTIVE)
    }

    // Deleted, not merely off screen. A pin scrolled out of view under a row
    // the pointer is still on must light up again when it scrolls back, so the
    // id survives; what it must never survive is the note itself going away.
    if (activeNote && !annotations().some((note) => note.id === activeNote)) activeNote = null
    // The mirror is the opposite case and answers to the pointer: a pin that
    // is no longer painted is a pin the pointer is no longer on, whatever the
    // browser did or did not send us on the way out.
    if (reportedHover && !onScreen.has(reportedHover)) reportMarkerHover(null)

    if (!outline) return
    if (!hoverRect) {
      outline.style.display = "none"
      return
    }
    outline.style.display = "block"
    outline.style.left = `${hoverRect.left}px`
    outline.style.top = `${hoverRect.top}px`
    outline.style.width = `${hoverRect.width}px`
    outline.style.height = `${hoverRect.height}px`
  }

  let frame = 0
  let destroyed = false

  const schedule = (): void => {
    if (!destroyed && frame === 0) frame = requestAnimationFrame(draw)
  }

  /**
   * Whether anything on screen can move without telling us.
   *
   * A note pinned to a live element follows a sticky header or an accordion,
   * and neither fires an event worth waking on. A note pinned to page
   * coordinates moves only when the page scrolls, and that wakes the loop by
   * itself — so a reloaded page of notes, whose records lost their elements,
   * costs no frames at all until the user touches it.
   */
  const tracking = (): boolean => {
    if (!editorOwnsInput()) return false
    if (annotating() && hovered) return true
    // The same pair `paint` asks, and it has to be the same pair: a loop that
    // kept running for a layer the audit has taken over would read a rect per
    // note per frame to draw nothing at all.
    if (!notePinsVisible()) return false
    return annotations().some((note) => Boolean(note.element?.isConnected))
  }

  function draw(): void {
    frame = 0
    if (!layer.isConnected) {
      destroyed = true
      teardown()
      return
    }
    paint()
    if (tracking()) schedule()
  }

  // ---------- mode surfaces ----------

  const enter = (): void => {
    if (!hint) {
      hint = el("div", { class: "de-ann-hint", role: "status" }, [
        icon("MessageSquare", tokens.icon.control),
        "Click an element, drag a region, or select text to leave a note",
      ])
      layer.append(hint)
    }
    if (!outline) {
      outline = el("div", { class: "de-ann-target", style: "display:none" })
      layer.append(outline)
    }
    if (!region) {
      region = el("div", { class: "de-ann-region", style: "display:none" })
      layer.append(region)
    }
  }

  /**
   * Leaving the mode takes every transient surface with it and leaves the pins.
   *
   * The distinction is the feature: the notes are the output and stay readable
   * with the mode off, while the hint bar, the hover outline and a half-typed
   * composer are all statements that the next click will annotate something —
   * and once it will not, each of them is a lie on the screen.
   */
  const leave = (): void => {
    dismiss()
    hint?.remove()
    hint = null
    outline?.remove()
    outline = null
    region?.remove()
    region = null
    hovered = null
    pending = false
    dragging = false
    started = null
  }

  // ---------- gestures ----------

  const onPointerDown = (event: PointerEvent): void => {
    if (!annotating() || !editorOwnsInput()) return
    if (event.button !== 0) return
    if (isChrome(event.target)) return

    originX = event.clientX
    originY = event.clientY
    pending = true
    dragging = false
    // Read at the START of the gesture, not the end. With blocking off the
    // press itself collapses the selection, and by pointerup the words the
    // note is about are gone.
    started = textGesture()
    swallow(event)
  }

  const onPointerMove = (event: PointerEvent): void => {
    if (!annotating() || !editorOwnsInput()) return

    if (pending) {
      const dx = event.clientX - originX
      const dy = event.clientY - originY
      if (!dragging && Math.hypot(dx, dy) < DRAG_THRESHOLD) return
      // Past the threshold this is a region, not a click — the same test the
      // marquee makes, because the two gestures start identically and only the
      // distance travelled tells them apart.
      dragging = true
      if (hovered) {
        // An element outline under a drag rect reads as a second selection.
        hovered = null
        schedule()
      }
      event.preventDefault()
      if (region) {
        region.style.display = "block"
        region.style.left = `${Math.min(originX, event.clientX)}px`
        region.style.top = `${Math.min(originY, event.clientY)}px`
        region.style.width = `${Math.abs(dx)}px`
        region.style.height = `${Math.abs(dy)}px`
      }
      return
    }

    const next = isChrome(event.target) ? null : elementAt(event.clientX, event.clientY)
    if (next === hovered) return
    hovered = next
    schedule()
  }

  const onPointerUp = (event: PointerEvent): void => {
    if (!pending) return
    pending = false
    if (region) region.style.display = "none"
    swallow(event)

    const snapshot = started
    started = null

    if (dragging) {
      dragging = false
      const left = Math.min(originX, event.clientX)
      const top = Math.min(originY, event.clientY)
      const width = Math.abs(event.clientX - originX)
      const height = Math.abs(event.clientY - originY)
      // The element under the middle of the box, when there is one. A region
      // over empty space has no target at all, and that is the case the kind
      // exists for rather than a gap in it.
      capture({
        kind: "region",
        box: { left, top, width, height },
        element: elementAt(left + width / 2, top + height / 2),
        selectedText: null,
      })
      return
    }

    if (snapshot) {
      capture(snapshot)
      return
    }

    const element = elementAt(event.clientX, event.clientY)
    // A click on nothing is not a note. Empty space is annotated by dragging a
    // box round it, which is the only gesture that can say how much of it.
    if (!element) return
    capture({
      kind: "element",
      box: boxOf(element.getBoundingClientRect()),
      element,
      selectedText: null,
    })
  }

  /**
   * A live text selection, as a gesture, or `null` when there is none.
   *
   * The range's own box is the subject rather than the element's: a note on one
   * sentence of a paragraph should pin to that sentence, and an element rect
   * would put the marker at the top of a block the user never pointed at.
   */
  const textGesture = (): Gesture | null => {
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null
    const selectedText = selection.toString().trim()
    if (!selectedText) return null

    const range = selection.getRangeAt(0)
    const node = range.commonAncestorContainer
    const element = node instanceof Element ? node : node.parentElement
    // A selection inside our own panels is someone copying a class name out of
    // the inspector, not a note about the page.
    if (!element || isChrome(element)) return null

    const rect = range.getBoundingClientRect()
    if (rect.width <= 0 && rect.height <= 0) return null
    return {
      kind: "text",
      box: boxOf(rect),
      element: isCanvasElement(element) ? element : null,
      selectedText,
    }
  }

  const onPointerCancel = (): void => {
    pending = false
    dragging = false
    started = null
    if (region) region.style.display = "none"
  }

  // ---------- wiring ----------

  window.addEventListener("pointerdown", onPointerDown, true)
  window.addEventListener("pointermove", onPointerMove, true)
  window.addEventListener("pointerup", onPointerUp, true)
  window.addEventListener("pointercancel", onPointerCancel, true)

  // Blocking `click` alone is not enough, which is what the selection lane gets
  // away with: a dropdown written against the native pattern closes on
  // `mousedown`, so by the time a click could be swallowed the item the user
  // was annotating has gone.
  for (const type of ["mousedown", "mouseup", "click", "dblclick"]) {
    window.addEventListener(type, swallow, true)
  }

  /**
   * The panel's half of the correspondence.
   *
   * Bound once here, beside every other listener this module owns, rather than
   * per marker: the pins are pooled and rebuilt, and a listener added where
   * they are would be added again on every note that outgrows the pool.
   *
   * Nothing is looked up or written on the DOM in either handler — one records
   * an id and asks for a frame, the other opens the composer. The highlight is
   * `paint`'s job, which is the only place that knows which pin is currently
   * showing which note.
   */
  const onPanelHover = (event: Event): void => {
    const detail = (event as CustomEvent<{ id?: string | null }>).detail
    const next = typeof detail?.id === "string" ? detail.id : null
    if (next === activeNote) return
    activeNote = next
    schedule()
  }

  const onPanelEdit = (event: Event): void => {
    const id = (event as CustomEvent<{ id?: string | null }>).detail?.id
    if (typeof id !== "string") return
    // Every note, not just the open ones: a resolved note is still a note you
    // can be asked to rewrite, and it has no pin of its own to reopen from.
    const note = annotations().find((entry) => entry.id === id)
    if (note) reopen(note)
  }

  window.addEventListener(HOVER_EVENT, onPanelHover)
  window.addEventListener(EDIT_EVENT, onPanelEdit)

  // Capture, because `scroll` does not bubble: a note pinned inside a scrolling
  // panel would otherwise only be repositioned when the window itself moved.
  window.addEventListener("scroll", schedule, { capture: true, passive: true })
  window.addEventListener("resize", schedule)

  const stopNotes = onAnnotationsChange(schedule)
  const stopSettings = onSettingsChange(schedule)
  const stopLayer = onMarkerLayerChange(schedule)
  const unsubscribe = context.subscribe((next, previous) => {
    if (next.annotating !== previous.annotating) {
      if (next.annotating) {
        /*
         * Entering the mode claims the marker layer back for the notes.
         *
         * Not tidiness — it is the only thing that makes the mode honest while
         * an audit is on screen. The gesture that follows pins a note, the note
         * is drawn as a pin, and the pin is on the layer the audit badges are
         * currently occupying: without this the user clicks, types, saves, and
         * nothing appears on the page. They have written a note they cannot
         * see, and every reasonable reading of that is "the editor lost it".
         *
         * Done here rather than in `addAnnotation` because the decision belongs
         * to the MODE, not to the record: the hint bar and the hover outline
         * already promise that the next click will leave a mark, and the promise
         * is made on entry, not on save.
         */
        setMarkerLayer("notes")
        enter()
      } else leave()
    }
    if (
      next.annotating !== previous.annotating ||
      next.interactive !== previous.interactive ||
      next.chromeHidden !== previous.chromeHidden
    ) {
      schedule()
    }
  })

  function teardown(): void {
    unsubscribe()
    stopNotes()
    stopSettings()
    stopLayer()
    window.removeEventListener(HOVER_EVENT, onPanelHover)
    window.removeEventListener(EDIT_EVENT, onPanelEdit)
    window.removeEventListener("scroll", schedule, true)
    window.removeEventListener("resize", schedule)
    // A layer torn down mid-hover would otherwise leave the panel lighting a
    // row whose pin no longer exists to un-light it.
    reportMarkerHover(null)
  }

  schedule()
  window.addEventListener("beforeunload", () => {
    destroyed = true
    teardown()
    if (frame) cancelAnimationFrame(frame)
  })
}
