/**
 * Canvas view: every page of the app on one board you can pan and zoom, and a
 * way straight back into any of them.
 *
 * The board is a view, not a mode (see `canvasView` in `core/store`). It covers
 * the canvas rect — the strip between the two panels — and leaves the chrome
 * where it is, so opening it changes what the middle of the screen shows and
 * nothing else. The live page stays mounted underneath the whole time: closing
 * to the page you came from is only hiding the board, which is why that
 * direction can be instant and exact.
 *
 * The motion is the feature. Opening shrinks the live page into its own frame
 * on the board with a view transition, so the thing that moves is literally
 * the page you were looking at, and closing grows that frame back until it IS
 * the page. Every frame is laid out at the canvas size for the same reason:
 * at scale 1 a frame and the live page are the same pixels, and there is no
 * jump at either end of the trip.
 *
 * Nothing here may throw into the page. Every async path is caught and logged,
 * and a request that arrives while a transition is running is ignored rather
 * than queued — two overlapping transitions cannot both land.
 */

import { registerCommand } from "../core/commands"
import { config, type DesignLayerConfig } from "../core/config"
import { notify } from "../core/toast"
import type { EditorContext } from "../core/context"
import {
  BOARD_ENTER_MS,
  BOARD_EXIT_MS,
  BOARD_FADE_MS,
  BOARD_FLY_MS,
  BOARD_HANDOFF_MS,
  boardCss,
  boardEnterCss,
  boardExitCss,
  boardTrustedVtCss,
} from "../core/css/board"
import { el } from "../core/dom"
import { focusControl } from "../core/focus"
import { icon } from "../core/icons"
import { tokens } from "../core/tokens"
import { isTextEntryEvent } from "../core/keymap"
import { prefersReducedMotion } from "../core/motion"
import { appInsets, onInsetsChange } from "../shell/shell"
import {
  boardEase,
  fit as fitCamera,
  focus as focusCamera,
  interpolate,
  pan,
  rectToScreen,
  screenToWorld,
  toCss,
  zoomAt,
  type Camera,
  type Point,
  type Rect,
  type Size,
} from "./camera"
import { createFramePool, type FrameView } from "./frames"
import { distanceToRect, hitFrame, layoutFrames } from "./layout"
import { navigateLive, type NavigateWindow } from "./navigate"
import { loadPages, normalizePath, type PageEntry } from "./pages"

/**
 * Why the board cannot open in this session, or null when it can.
 *
 * The frames are only safe because the launcher wraps the served bundle so it
 * stands down inside them (runtime/board-frame.mjs). An editor process started
 * before that wrapper existed still serves this NEW chrome — it reads dist/ per
 * request — so it can show the toggle while every frame it loads would start
 * the vendor overlay, whose socket takes one client and would knock this page's
 * editor off it. The prelude of a launcher that has the guard says so; one that
 * does not gets a sentence instead of a board.
 */
export function staleLauncherMessage(settings: Pick<DesignLayerConfig, "boardFrames">): string | null {
  if (settings.boardFrames) return null
  return "Restart this editor to use canvas view. It was started before canvas view was added."
}

export interface Board {
  isOpen(): boolean
  open(): Promise<void>
  /** Back to live: to the page you came from, or — given a path — to that one. */
  close(targetPath?: string): Promise<void>
  toggle(): Promise<void>
  fit(): void
  /** Start loading the current page's frame before the board is asked for. */
  prewarm(): void
  destroy(): void
}

type Phase = "closed" | "opening" | "open" | "closing"

const STYLE_ID = "designlayer-board-style"
const VT_STYLE_ID = "designlayer-board-vt-style"
/** Input goes quiet for this long before the board re-rasterizes and reloads. */
const SETTLE_MS = 120
const WHEEL_ZOOM = 0.0022
const LINE_HEIGHT = 16
const KEY_PAN = 80
const ZOOM_STEP = 1.5
const STEP_MS = 240
const FIT_MS = 400
/** Other frames arrive after the current one, 30ms apart, never later than this. */
const STAGGER_MS = 30
const STAGGER_CAP_MS = 300
const ENTERING_MS = 420 + STAGGER_CAP_MS
/** A page list this fresh is reused by `open()` instead of fetched again. */
const PAGES_FRESH_MS = 5000
/** How long an open waits for a fresh page list before using the last one. */
const PAGES_WAIT_MS = 400

const warn = (error: unknown) => console.warn("[designlayer]", error)
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/** A fade that runs on the compositor where it can, and is instant where it cannot. */
function fade(node: HTMLElement, from: number, to: number, ms: number): Promise<void> {
  if (typeof node.animate !== "function" || ms <= 0) return Promise.resolve()
  try {
    const animation = node.animate([{ opacity: from }, { opacity: to }], {
      duration: ms,
      easing: "ease-out",
      fill: "forwards",
    })
    return animation.finished.then(
      () => undefined,
      () => undefined
    )
  } catch {
    return Promise.resolve()
  }
}

function startViewTransition(update: () => void): ViewTransition | null {
  const doc = document as Document & { startViewTransition?: Document["startViewTransition"] }
  if (typeof doc.startViewTransition !== "function") return null
  return doc.startViewTransition(update)
}

interface LabelView {
  label: HTMLElement
  path: HTMLElement
  meta: HTMLElement
  tag: HTMLElement
  live: HTMLButtonElement
  file?: string
}

export function installBoard(context: EditorContext): Board {
  const html = document.documentElement
  html.dataset.deView = "live"

  if (!document.getElementById(STYLE_ID)) {
    const style = el("style", { id: STYLE_ID })
    style.textContent = boardCss
    document.head.append(style)
  }

  const world = el("div", { class: "de-board-world" })
  const hoverBox = el("div", { class: "de-board-hover" })
  const labels = el("div", { class: "de-board-labels" }, [hoverBox])
  const zoomValue = el("span", { class: "de-board-zoom-value", "aria-live": "polite" }, ["100%"])
  const zoomButton = (kind: "out" | "in" | "fit", label: string, content: Node | string) =>
    el(
      "button",
      {
        type: "button",
        "data-de-zoom": kind,
        "aria-label": label,
        "data-de-tip": label,
        onclick: () => {
          if (kind === "fit") board.fit()
          else zoomStep(kind === "in" ? ZOOM_STEP : 1 / ZOOM_STEP)
        },
      },
      [content]
    )
  const zoom = el("div", { class: "de-board-zoom", role: "group", "aria-label": "Zoom" }, [
    zoomButton("out", "Zoom out", icon("Minus", tokens.icon.action)),
    zoomValue,
    zoomButton("in", "Zoom in", icon("Plus", tokens.icon.action)),
    zoomButton("fit", "Zoom to fit", "Fit"),
  ])
  const root = el(
    "div",
    {
      class: "de-board",
      "data-state": "closed",
      "data-scale": "1",
      role: "region",
      "aria-label": "Canvas",
      // Focusable so the board can hold the keys while it is up; see `reveal`.
      tabindex: "-1",
    },
    [world, labels, zoom]
  )
  document.body.append(root)

  /*
   * The board's box is its own, and nothing else may move it.
   *
   * To everything else on the page the board is one more large element on
   * <body>: a drag preview, a companion's layout tool, a browser extension that
   * moves elements. Any of them can write a transform or an offset into its
   * style, and the board then slides off the canvas rect with the live page
   * showing round its edges — the canvas "dragged around". The stylesheet pins
   * the box with !important, which beats every inline style except an inline
   * !important; this takes those out too, along with anything else written
   * here that the board did not write itself. The observer runs before the next
   * paint, so a foreign write is never drawn.
   */
  const ownStyle = (name: string) =>
    name.startsWith("--de-board-") ||
    name.startsWith("background-position") ||
    name === "background-size" ||
    name === "opacity"
  const guardBox =
    typeof MutationObserver === "function"
      ? new MutationObserver(() => {
          for (const name of Array.from(root.style)) if (!ownStyle(name)) root.style.removeProperty(name)
        })
      : null
  guardBox?.observe(root, { attributes: true, attributeFilter: ["style"] })

  let phase: Phase = "closed"
  let busy = false
  /**
   * The last request made while a transition was running, run when it lands.
   *
   * Transitions cannot overlap, but dropping a request made during one felt like
   * a dead button: a ⇧1 pressed while the board was still growing back into the
   * page, or a second click on the toggle mid-flight, did nothing. So the LAST
   * such request wins and runs as soon as the current transition is done.
   */
  let queued: { kind: "open" } | { kind: "close"; target?: string } | null = null
  const runQueued = () => {
    const next = queued
    queued = null
    if (!next) return
    if (next.kind === "open" && phase === "closed") void open()
    else if (next.kind === "close" && phase === "open") void close(next.target)
  }
  /** Bumped by every instant close, so an async path can tell it was overtaken. */
  let epoch = 0
  let camera: Camera = { x: 0, y: 0, scale: 1 }
  let insets = appInsets()
  /** The frame size, which is the canvas rect when the board last opened. */
  let frameSize: Size = { width: 0, height: 0 }
  let pages: PageEntry[] = []
  let order: string[] = []
  const rects = new Map<string, Rect>()
  const labelViews = new Map<string, LabelView>()
  let bounds: Rect = { x: 0, y: 0, width: 1, height: 1 }
  let currentPath = normalizePath(window.location.pathname)
  let liveScroll = { x: 0, y: 0 }
  let hovered: string | null = null
  let transition: ViewTransition | null = null
  let vtStyle: HTMLStyleElement | null = null
  let enteringTimer = 0

  let pagesPromise: Promise<PageEntry[]> | null = null
  let pagesAt = 0

  const pool = createFramePool({
    // The host's dev chrome and the companions' UI are "not the product" by the
    // same declaration the canvas lane already honours, so frames hide them too.
    hideSelector: config.chrome.trustedSelector,
    onLoad(view) {
      refreshLabel(view.path)
      if (view.path !== currentPath) return
      // The current page's frame shows what the user was just looking at, so
      // the zoom back into it lands on the same scroll position.
      try {
        view.iframe.contentWindow?.scrollTo(liveScroll.x, liveScroll.y)
      } catch {
        // Cross-origin or not ready: the frame simply starts at the top.
      }
      // SPAs often set the title after load.
      setTimeout(() => {
        try {
          view.title = view.iframe.contentDocument?.title?.trim() || view.title
          refreshLabel(view.path)
        } catch {
          // Nothing to read.
        }
      }, 1000)
    },
  })

  /* ── geometry ─────────────────────────────────────────────────────────── */

  const measureCanvas = (): Size => {
    insets = appInsets()
    return {
      width: Math.max(1, window.innerWidth - insets.left - insets.right),
      height: Math.max(1, window.innerHeight),
    }
  }

  // Custom properties rather than `left`/`right`, because those two are pinned
  // with !important in the stylesheet and read from these.
  const syncRootBox = () => {
    insets = appInsets()
    root.style.setProperty("--de-board-left", `${insets.left}px`)
    root.style.setProperty("--de-board-right", `${insets.right}px`)
  }
  syncRootBox()

  const boardSize = (): Size => ({
    width: Math.max(1, window.innerWidth - insets.left - insets.right),
    height: Math.max(1, window.innerHeight),
  })

  const center = (): Point => {
    const size = boardSize()
    return { x: size.width / 2, y: size.height / 2 }
  }

  const fitTarget = (): Camera => fitCamera(boardSize(), bounds)

  /* ── pages and frames ─────────────────────────────────────────────────── */

  const fetchPages = (): Promise<PageEntry[]> => {
    pagesAt = Date.now()
    pagesPromise = loadPages({ apiBase: config.apiBase }).catch((error) => {
      warn(error)
      return [{ path: currentPath }]
    })
    return pagesPromise
  }

  const freshPages = async (): Promise<PageEntry[]> => {
    const fallback = pages.length ? pages : [{ path: currentPath }]
    const pending =
      pagesPromise && Date.now() - pagesAt < PAGES_FRESH_MS ? pagesPromise : fetchPages()
    // The first open has nothing to fall back on and waits for the list; later
    // ones use the last list rather than hold the transition on a slow server.
    if (!pages.length) return pending
    return Promise.race([pending, wait(PAGES_WAIT_MS).then(() => fallback)])
  }

  const ensureLabel = (page: PageEntry): LabelView => {
    let view = labelViews.get(page.path)
    if (!view) {
      const pathText = el("span", { class: "de-board-label-path" }, [page.path])
      const tag = el("span", { class: "de-board-tag", hidden: true }, ["Current"])
      const meta = el("span", { class: "de-board-label-meta" })
      const label = el("div", { class: "de-board-label", "data-path": page.path }, [
        el("div", { class: "de-board-label-row" }, [pathText, tag]),
        meta,
      ])
      const live = el(
        "button",
        {
          type: "button",
          class: "de-board-live",
          "data-path": page.path,
          "aria-label": `Open ${page.path} live`,
          "data-de-tip": "Open this page live",
          onclick: (event: Event) => {
            event.stopPropagation()
            void board.close(page.path)
          },
          onfocus: () => setHover(page.path),
          onblur: () => {
            if (hovered === page.path) setHover(null)
          },
        },
        [icon("Play", tokens.icon.marker), "Live"]
      )
      view = { label, path: pathText, meta, tag, live }
      labelViews.set(page.path, view)
    }
    view.file = page.file
    return view
  }

  function refreshLabel(path: string): void {
    const view = labelViews.get(path)
    if (!view) return
    const frame = pool.get(path)
    const title = frame?.status === "loaded" ? frame.title : ""
    view.meta.textContent = [title, view.file].filter(Boolean).join(" · ")
    const current = path === currentPath
    view.tag.hidden = !current
  }

  /** Brings the frames and labels in line with `list`, without touching live iframes. */
  const reconcile = (list: PageEntry[]) => {
    pages = list
    order = list.map((page) => page.path)
    const keep = new Set(order)
    for (const view of pool.views()) if (!keep.has(view.path)) pool.remove(view.path)
    for (const [path, view] of labelViews) {
      if (keep.has(path)) continue
      view.label.remove()
      view.live.remove()
      labelViews.delete(path)
    }
    list.forEach((page, index) => {
      const frame = pool.ensure(page)
      frame.setCurrent(page.path === currentPath)
      frame.element.style.setProperty("--de-delay", `${Math.min(index * STAGGER_MS, STAGGER_CAP_MS)}ms`)
      // Appended once: moving an iframe in the DOM reloads it.
      if (frame.element.parentNode !== world) world.append(frame.element)
      const label = ensureLabel(page)
      refreshLabel(page.path)
      // Labels and buttons ARE reordered, so Tab walks the frames in board order.
      labels.append(label.label, label.live)
    })
  }

  const layout = (size: Size) => {
    frameSize = size
    const result = layoutFrames(order.length, size, size)
    bounds = result.bounds
    rects.clear()
    order.forEach((path, index) => {
      const rect = result.frames[index]
      rects.set(path, rect)
      const frame = pool.get(path)
      if (!frame) return
      const style = frame.element.style
      style.left = `${rect.x}px`
      style.top = `${rect.y}px`
      style.width = `${rect.width}px`
      style.height = `${rect.height}px`
    })
  }

  /** Current page first, then outward from the middle of the view. */
  const scheduleFrames = () => {
    const middle = screenToWorld(camera, center())
    const others = order
      .filter((path) => path !== currentPath)
      .map((path) => ({ path, distance: distanceToRect(rects.get(path)!, middle.x, middle.y) }))
      .sort((a, b) => a.distance - b.distance)
      .map((entry) => entry.path)
    pool.schedule(order.includes(currentPath) ? [currentPath, ...others] : others)
  }

  /* ── camera ───────────────────────────────────────────────────────────── */

  const GRID = 24
  const applyCamera = () => {
    world.style.transform = toCss(camera)
    for (const [path, view] of labelViews) {
      const rect = rects.get(path)
      if (!rect) continue
      const box = rectToScreen(camera, rect)
      view.label.style.width = `${Math.max(0, box.width)}px`
      view.label.style.transform = `translate3d(${box.x}px, ${box.y}px, 0) translateY(-100%)`
      view.live.style.transform = `translate3d(${box.x + box.width - 8}px, ${box.y + 8}px, 0) translateX(-100%)`
    }
    const hoverRect = hovered ? rects.get(hovered) : undefined
    if (hoverRect) {
      const box = rectToScreen(camera, hoverRect)
      hoverBox.style.width = `${box.width}px`
      hoverBox.style.height = `${box.height}px`
      hoverBox.style.transform = `translate3d(${box.x}px, ${box.y}px, 0)`
    }
    let pitch = GRID * camera.scale
    while (pitch < 12) pitch *= 2
    while (pitch > 48) pitch /= 2
    root.style.backgroundSize = `${pitch}px ${pitch}px`
    root.style.backgroundPosition = `${camera.x % pitch}px ${camera.y % pitch}px`
    zoomValue.textContent = `${Math.round(camera.scale * 100)}%`
  }

  let navigating = false
  let settleTimer = 0

  const settle = () => {
    clearTimeout(settleTimer)
    navigating = false
    root.removeAttribute("data-navigating")
    // Dropping the layer hint is what lets the iframes re-raster at the new
    // scale; left on, they stay the blurry bitmap from when the gesture began.
    world.style.willChange = ""
    root.dataset.scale = String(Math.round(camera.scale * 1000) / 1000)
    world.style.setProperty("--de-board-inv", String(1 / camera.scale))
    if (phase === "open" || phase === "opening") scheduleFrames()
  }

  /** Input is moving the camera: keep it on one layer and hold the hover UI. */
  const touch = () => {
    if (!navigating) {
      navigating = true
      root.setAttribute("data-navigating", "true")
      world.style.willChange = "transform"
      setHover(null)
    }
    clearTimeout(settleTimer)
    settleTimer = setTimeout(settle, SETTLE_MS) as unknown as number
  }

  let tweenId = 0
  let tweenTarget: Camera | null = null

  const tweenCamera = (to: Camera, ms: number): Promise<void> => {
    const id = ++tweenId
    if (ms <= 0 || prefersReducedMotion()) {
      tweenTarget = null
      camera = to
      applyCamera()
      touch()
      return Promise.resolve()
    }
    const from = { ...camera }
    const start = performance.now()
    tweenTarget = to
    return new Promise((resolve) => {
      const step = () => {
        if (id !== tweenId) return resolve()
        const progress = Math.min(1, (performance.now() - start) / ms)
        camera = interpolate(from, to, boardEase(progress))
        applyCamera()
        touch()
        if (progress < 1) requestAnimationFrame(step)
        else {
          camera = to
          tweenTarget = null
          applyCamera()
          resolve()
        }
      }
      requestAnimationFrame(step)
    })
  }

  const stopTween = () => {
    tweenId += 1
    tweenTarget = null
  }

  function zoomStep(factor: number): void {
    if (phase !== "open") return
    void tweenCamera(zoomAt(tweenTarget ?? camera, factor, center()), STEP_MS)
  }

  const zoomTo100 = () => {
    if (phase !== "open") return
    const base = tweenTarget ?? camera
    void tweenCamera(zoomAt(base, 1 / base.scale, center()), STEP_MS)
  }

  /* ── hover ────────────────────────────────────────────────────────────── */

  function setHover(path: string | null): void {
    if (hovered === path) return
    if (hovered) {
      const previous = labelViews.get(hovered)
      previous?.label.removeAttribute("data-hover")
      previous?.live.removeAttribute("data-hover")
    }
    hovered = path
    if (path) {
      const next = labelViews.get(path)
      next?.label.setAttribute("data-hover", "true")
      next?.live.setAttribute("data-hover", "true")
      hoverBox.setAttribute("data-on", "true")
      applyCamera()
    } else {
      hoverBox.removeAttribute("data-on")
    }
  }

  const localPoint = (event: MouseEvent): Point => ({
    x: event.clientX - insets.left,
    y: event.clientY,
  })

  const frameAt = (point: Point): string | null => {
    const worldPoint = screenToWorld(camera, point)
    const index = hitFrame(
      order.map((path) => rects.get(path)!),
      worldPoint.x,
      worldPoint.y
    )
    return index === -1 ? null : order[index]
  }

  /* ── showing and hiding ───────────────────────────────────────────────── */

  const showBoard = (state: Phase) => {
    syncRootBox()
    root.dataset.state = state
  }

  const hideBoard = () => {
    stopTween()
    setHover(null)
    clearTimeout(enteringTimer)
    root.removeAttribute("data-entering")
    root.removeAttribute("data-space")
    root.removeAttribute("data-panning")
    root.dataset.state = "closed"
    root.style.opacity = ""
    for (const animation of root.getAnimations?.() ?? []) animation.cancel()
  }

  const markEntering = () => {
    root.setAttribute("data-entering", "")
    clearTimeout(enteringTimer)
    enteringTimer = setTimeout(() => root.removeAttribute("data-entering"), ENTERING_MS) as unknown as number
  }

  const clearVt = () => {
    html.classList.remove("de-vt", "de-vt-enter", "de-vt-exit", "de-vt-fade")
    vtStyle?.remove()
    vtStyle = null
    transition = null
  }

  const injectVt = (css: string, ...classes: string[]) => {
    vtStyle?.remove()
    vtStyle = el("style", { id: VT_STYLE_ID })
    vtStyle.textContent = boardTrustedVtCss(config.chrome.trustedSelector) + css
    document.head.append(vtStyle)
    html.classList.add("de-vt", ...classes)
  }

  /** The current frame's rect on screen, in viewport coordinates, under `view`. */
  const slotOnScreen = (view: Camera): Rect | null => {
    const rect = rects.get(currentPath)
    if (!rect) return null
    const box = rectToScreen(view, rect)
    return { ...box, x: box.x + insets.left }
  }

  /*
   * Focus, taken while the board is up and handed back when it goes.
   *
   * Opening from the toolbar leaves focus on the Canvas button, and a focused
   * button answers Space by pressing itself. So the first Space+drag closed the
   * board instead of panning it, and while Space was held the vendor's own pan
   * layer went up over the whole window and took the drag. With focus on the
   * board, every key it answers stops at it.
   *
   * Handed back only if it is still here: a designer who clicked into a panel
   * while the board was up has put focus where they want it.
   */
  let returnFocus: HTMLElement | null = null
  const takeFocus = () => {
    const active = document.activeElement
    if (active instanceof HTMLElement && !root.contains(active)) returnFocus = active
    root.focus({ preventScroll: true })
  }
  const giveFocusBack = () => {
    const target = returnFocus
    returnFocus = null
    if (!root.contains(document.activeElement)) return
    if (target?.isConnected) focusControl(target, { preventScroll: true })
    else root.blur()
  }

  /** Everything the store and the document need to say the board is gone. */
  const markClosed = () => {
    phase = "closed"
    html.dataset.deView = "live"
    giveFocusBack()
    if (context.getState().canvasView) context.setState({ canvasView: false })
  }

  /** Down at once, mid-transition or not: hidden chrome and mode switches. */
  const closeInstant = () => {
    epoch += 1
    busy = false
    queued = null
    try {
      transition?.skipTransition()
    } catch {
      // Already finished.
    }
    clearVt()
    hideBoard()
    settle()
    markClosed()
  }

  /* ── open ─────────────────────────────────────────────────────────────── */

  const open = async (): Promise<void> => {
    if (busy) {
      // Asked for while the board is still closing — including the last stretch
      // of a closing transition, where the board already reads "closed" but the
      // page is still growing back — so open again once it lands.
      if (phase === "closing" || phase === "closed") queued = { kind: "open" }
      return
    }
    if (phase !== "closed") return
    const state = context.getState()
    if (state.chromeHidden) return
    const stale = staleLauncherMessage(config)
    if (stale) {
      notify(stale)
      return
    }
    busy = true
    const mine = ++epoch
    try {
      phase = "opening"
      html.dataset.deView = "canvas"
      currentPath = normalizePath(window.location.pathname)
      liveScroll = { x: window.scrollX, y: window.scrollY }
      const list = await freshPages()
      if (mine !== epoch) return
      reconcile(list.length ? list : [{ path: currentPath }])
      layout(measureCanvas())
      const target = fitTarget()
      const reduced = prefersReducedMotion()

      const reveal = (start: Camera) => {
        showBoard("opening")
        stopTween()
        camera = start
        applyCamera()
        settle()
        if (!reduced) markEntering()
        if (!context.getState().canvasView) context.setState({ canvasView: true })
        takeFocus()
      }

      const slot = slotOnScreen(target)
      transition = null
      if (slot) {
        if (reduced) injectVt("", "de-vt-fade")
        else {
          const s = slot.width / frameSize.width
          injectVt(
            boardEnterCss({
              left: insets.left,
              right: insets.right,
              scale: s,
              tx: slot.x - s * insets.left,
              ty: slot.y,
            }),
            "de-vt-enter"
          )
        }
        transition = startViewTransition(() => reveal(target))
        if (!transition) clearVt()
      }

      if (transition) {
        await transition.finished.catch(warn)
        if (mine !== epoch) return
        clearVt()
      } else if (reduced) {
        reveal(target)
        await fade(root, 0, 1, BOARD_FADE_MS)
      } else {
        // The same motion without the snapshot: start with the current frame
        // filling the canvas, which is what the live page looked like, and fly
        // out to the whole board.
        const from = rects.get(currentPath)
        reveal(from ? focusCamera(from) : target)
        await tweenCamera(target, BOARD_ENTER_MS)
      }
      if (mine !== epoch) return
      phase = "open"
      root.dataset.state = "open"
      settle()
    } catch (error) {
      warn(error)
      if (mine === epoch) closeInstant()
    } finally {
      if (mine === epoch) busy = false
    }
    if (mine === epoch) runQueued()
  }

  /* ── close ────────────────────────────────────────────────────────────── */

  const closeToCurrent = async (mine: number) => {
    const size = boardSize()
    const slot = slotOnScreen(camera)
    const reduced = prefersReducedMotion()
    const finish = () => {
      hideBoard()
      markClosed()
    }
    if (slot && slot.width > 0) {
      if (reduced) injectVt("", "de-vt-fade")
      else {
        const s = size.width / slot.width
        injectVt(
          boardExitCss({
            left: insets.left,
            right: insets.right,
            scale: s,
            tx: insets.left - s * slot.x,
            ty: -s * slot.y,
          }),
          "de-vt-exit"
        )
      }
      transition = startViewTransition(finish)
      if (!transition) clearVt()
    }
    if (transition) {
      await transition.finished.catch(warn)
      if (mine === epoch) clearVt()
      return
    }
    if (reduced) {
      await fade(root, 1, 0, BOARD_FADE_MS)
    } else {
      const rect = rects.get(currentPath)
      if (rect) await tweenCamera(focusCamera(rect), BOARD_EXIT_MS)
    }
    if (mine === epoch) finish()
  }

  const closeToPage = async (path: string, mine: number) => {
    const rect = rects.get(path)
    if (rect) await tweenCamera(focusCamera(rect), BOARD_FLY_MS)
    if (mine !== epoch) return
    const strategy = await navigateLive(path, { window: window as unknown as NavigateWindow })
    // A full navigation is under way: the frame holds the screen until the new
    // document paints, and this document is about to be gone.
    if (strategy === "assign" || mine !== epoch) return
    currentPath = normalizePath(window.location.pathname)
    await fade(root, 1, 0, prefersReducedMotion() ? BOARD_FADE_MS : BOARD_HANDOFF_MS)
    if (mine !== epoch) return
    hideBoard()
    markClosed()
    for (const view of pool.views()) view.setCurrent(view.path === currentPath)
  }

  const close = async (targetPath?: string): Promise<void> => {
    if (busy) {
      // Asked for while the board is still opening: close once it has landed.
      if (phase === "opening" || phase === "open") queued = { kind: "close", target: targetPath }
      return
    }
    if (phase !== "open") return
    busy = true
    const mine = ++epoch
    try {
      phase = "closing"
      root.dataset.state = "closing"
      settle()
      const target = targetPath ? normalizePath(targetPath) : currentPath
      if (target === currentPath || !rects.has(target)) await closeToCurrent(mine)
      else await closeToPage(target, mine)
    } catch (error) {
      warn(error)
      if (mine === epoch) closeInstant()
    } finally {
      if (mine === epoch) busy = false
    }
    if (mine === epoch) runQueued()
  }

  /* ── input ────────────────────────────────────────────────────────────── */

  const inBoard = (target: EventTarget | null) => target instanceof Node && root.contains(target)

  let pendingZoom = 1
  let zoomPoint: Point = { x: 0, y: 0 }
  let pendingPan = { x: 0, y: 0 }
  let wheelFrame = 0

  const flushWheel = () => {
    wheelFrame = 0
    if (phase !== "open") return
    stopTween()
    if (pendingZoom !== 1) camera = zoomAt(camera, pendingZoom, zoomPoint)
    if (pendingPan.x || pendingPan.y) camera = pan(camera, pendingPan.x, pendingPan.y)
    pendingZoom = 1
    pendingPan = { x: 0, y: 0 }
    applyCamera()
  }

  const onWheel = (event: WheelEvent) => {
    if (phase !== "open" || !inBoard(event.target)) return
    event.preventDefault()
    const unit = event.deltaMode === 1 ? LINE_HEIGHT : event.deltaMode === 2 ? boardSize().height : 1
    if (event.ctrlKey || event.metaKey) {
      // A trackpad pinch arrives as a ctrl-wheel, so this is also the pinch.
      pendingZoom *= Math.exp(-event.deltaY * unit * WHEEL_ZOOM)
      zoomPoint = localPoint(event)
    } else {
      pendingPan.x -= event.deltaX * unit
      pendingPan.y -= event.deltaY * unit
    }
    touch()
    if (!wheelFrame) wheelFrame = requestAnimationFrame(flushWheel)
  }

  let spaceHeld = false
  let drag: { id: number; x: number; y: number } | null = null

  const onPointerDown = (event: PointerEvent) => {
    if (phase !== "open" || !inBoard(event.target)) return
    const target = event.target as Element
    if (target.closest(".de-board-zoom, .de-board-live")) return
    if (event.button !== 1 && !(event.button === 0 && spaceHeld)) return
    // The shell swaps these out on chrome events (see `restoreChromeFocus`);
    // the prototype's is the real one, and middle-click autoscroll needs it.
    Event.prototype.preventDefault.call(event)
    stopTween()
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY }
    root.setAttribute("data-panning", "")
    try {
      root.setPointerCapture?.(event.pointerId)
    } catch {
      // Synthetic pointers cannot be captured; the window listeners still see them.
    }
  }

  const onMouseDown = (event: MouseEvent) => {
    if (phase === "open" && event.button === 1 && inBoard(event.target)) {
      Event.prototype.preventDefault.call(event)
    }
  }

  const onPointerMove = (event: PointerEvent) => {
    if (phase !== "open") return
    if (drag && event.pointerId === drag.id) {
      camera = pan(camera, event.clientX - drag.x, event.clientY - drag.y)
      drag.x = event.clientX
      drag.y = event.clientY
      applyCamera()
      touch()
      return
    }
    if (!inBoard(event.target) || (event.target as Element).closest(".de-board-zoom")) {
      setHover(null)
      return
    }
    if (navigating) return
    setHover(frameAt(localPoint(event)))
  }

  const onPointerUp = (event: PointerEvent) => {
    if (!drag || event.pointerId !== drag.id) return
    drag = null
    root.removeAttribute("data-panning")
    try {
      root.releasePointerCapture?.(event.pointerId)
    } catch {
      // Never captured.
    }
  }

  const onDoubleClick = (event: MouseEvent) => {
    if (phase !== "open" || !inBoard(event.target)) return
    if ((event.target as Element).closest(".de-board-zoom, .de-board-live")) return
    const path = frameAt(localPoint(event))
    if (path) void close(path)
  }

  /**
   * Keys are the board's while it is up, wherever focus is — except text entry,
   * and anything that owns Escape or the arrows for itself.
   *
   * It used to answer only with focus on the page or the board, and the most
   * common way in broke that: clicking the toolbar's Canvas button leaves focus
   * ON that button, so the Escape that followed went nowhere. A focused button
   * does nothing with Escape, `=`, `-` or an arrow, so the board may have them;
   * a menu, a dialog or a listbox does, so it keeps them.
   */
  const OWNS_ESCAPE = '[role="menu"], [role="listbox"], [role="dialog"], dialog, select, [popover]'
  // Composite widgets move focus with the arrows (the layers tree, a tab strip,
  // the toolbar's roving focus), so only Escape is taken from inside them.
  const OWNS_ARROWS = `${OWNS_ESCAPE}, [role="toolbar"], [role="tree"], [role="treeitem"], [role="tablist"], [role="tab"], [role="grid"], [role="radiogroup"], [role="slider"], [role="separator"]`
  const keyIsOurs = (event: KeyboardEvent, owners = OWNS_ARROWS) => {
    if (isTextEntryEvent(event)) return false
    const target = event.target
    if (target === document.body || target === html || target === document || target === window) return true
    if (inBoard(target)) return true
    return target instanceof Element && target.closest(owners) === null
  }

  const consume = (event: KeyboardEvent) => {
    event.preventDefault()
    event.stopPropagation()
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (phase === "closed") return
    /*
     * Escape is taken in EVERY phase the board is up, not only once it is open.
     *
     * Unanswered, Escape falls through to the shell's last-resort handler, which
     * collapses the whole editor — so an Escape pressed during the half second
     * the page is still shrinking used to fold the panels away instead of
     * cancelling the board. Mid-opening it now closes the board as soon as it
     * lands; mid-closing it is simply already happening.
     */
    if (event.key === "Escape") {
      if (!keyIsOurs(event, OWNS_ESCAPE)) return
      consume(event)
      if (phase === "open") void close()
      else if (phase === "opening") queued = { kind: "close" }
      return
    }
    if (phase !== "open" || !keyIsOurs(event)) return
    const plain = !event.metaKey && !event.ctrlKey && !event.altKey
    if (event.key === " " || event.code === "Space") {
      // A focused Live button activates on Space; everywhere else it is the pan key.
      if (event.target instanceof HTMLButtonElement) return
      consume(event)
      if (!spaceHeld) {
        spaceHeld = true
        root.setAttribute("data-space", "")
      }
      return
    }
    if (!plain) return
    if (event.shiftKey && event.code === "Digit0") {
      consume(event)
      zoomTo100()
      return
    }
    if (event.key === "=" || event.key === "+") {
      consume(event)
      zoomStep(ZOOM_STEP)
      return
    }
    if (event.key === "-" || event.key === "_") {
      consume(event)
      zoomStep(1 / ZOOM_STEP)
      return
    }
    const arrows: Record<string, [number, number]> = {
      ArrowLeft: [KEY_PAN, 0],
      ArrowRight: [-KEY_PAN, 0],
      ArrowUp: [0, KEY_PAN],
      ArrowDown: [0, -KEY_PAN],
    }
    const move = arrows[event.key]
    if (move) {
      consume(event)
      stopTween()
      camera = pan(camera, move[0], move[1])
      applyCamera()
      touch()
    }
  }

  const releaseSpace = () => {
    spaceHeld = false
    root.removeAttribute("data-space")
  }
  const onKeyUp = (event: KeyboardEvent) => {
    if (event.key === " " || event.code === "Space") releaseSpace()
  }

  const listeners: Array<[string, EventListener, AddEventListenerOptions]> = [
    ["wheel", onWheel as EventListener, { capture: true, passive: false }],
    ["pointerdown", onPointerDown as EventListener, { capture: true }],
    ["mousedown", onMouseDown as EventListener, { capture: true }],
    ["pointermove", onPointerMove as EventListener, { capture: true }],
    ["pointerup", onPointerUp as EventListener, { capture: true }],
    ["pointercancel", onPointerUp as EventListener, { capture: true }],
    ["dblclick", onDoubleClick as EventListener, { capture: true }],
    ["keydown", onKeyDown as EventListener, { capture: true }],
    ["keyup", onKeyUp as EventListener, { capture: true }],
    ["blur", releaseSpace as EventListener, { capture: false }],
  ]
  for (const [type, fn, options] of listeners) window.addEventListener(type, fn, options)

  /* ── the rest of the editor ───────────────────────────────────────────── */

  /*
   * Collapsing the editor (⌘. or Hide) does NOT close the board.
   *
   * It used to, on the argument that hidden chrome means "hand the page back".
   * But the page is not what is on screen in canvas view — the board is — and a
   * designer who collapses the panels here is asking for more room to look at
   * the board, not for the board to go away. So the board stays, grows into the
   * room the panels gave up (see the insets listener below), and keeps its own
   * ways out: Escape, a frame's Live button, or ⌘. and the toolbar.
   */
  const unsubscribe = context.subscribe((next, previous) => {
    if (phase === "closed") return
    const modeChanged = next.interactive !== previous.interactive || next.annotating !== previous.annotating
    // Somebody else took the view down (a reset, a test): follow at once.
    const dropped = !next.canvasView && previous.canvasView && phase === "open"
    if (modeChanged || dropped) closeInstant()
  })

  /*
   * The canvas rect changed shape: a panel opened, closed or was dragged, or the
   * whole editor collapsed.
   *
   * Two steps, on two clocks. At once, the board's box follows the panels and
   * the camera absorbs the move, so nothing on the board jumps. Then, once the
   * edges stop moving, the frames are laid out again at the new canvas size,
   * because "a frame is exactly the canvas" is what makes the zoom back into a
   * page land without a reflow — and a frame that stayed 940px wide in a 1440px
   * canvas would open into a different layout than the one it showed.
   */
  let relayoutTimer = 0
  const RELAYOUT_MS = 160
  const relayout = () => {
    if (phase === "opening" || phase === "closing") {
      relayoutTimer = setTimeout(relayout, RELAYOUT_MS) as unknown as number
      return
    }
    if (phase !== "open") return
    syncRootBox()
    const size = measureCanvas()
    if (Math.abs(size.width - frameSize.width) < 1 && Math.abs(size.height - frameSize.height) < 1) return
    layout(size)
    void tweenCamera(fitTarget(), FIT_MS)
  }
  const unsubscribeInsets = onInsetsChange(() => {
    const before = insets.left
    syncRootBox()
    if (phase === "closed") return
    camera = { ...camera, x: camera.x + (before - insets.left) }
    applyCamera()
    clearTimeout(relayoutTimer)
    relayoutTimer = setTimeout(relayout, RELAYOUT_MS) as unknown as number
  })
  const onResize = () => {
    if (phase === "closed") return
    clearTimeout(relayoutTimer)
    relayoutTimer = setTimeout(relayout, RELAYOUT_MS) as unknown as number
  }
  window.addEventListener("resize", onResize)

  const board: Board = {
    isOpen: () => phase !== "closed",
    open: () => open().catch(warn),
    close: (targetPath) => close(targetPath).catch(warn),
    // Mid-closing a toggle means "open again", mid-opening it means "close".
    toggle: () => (phase === "closed" || phase === "closing" ? open() : close()).catch(warn),
    fit() {
      if (phase !== "open") return
      void tweenCamera(fitTarget(), FIT_MS)
    },
    prewarm() {
      if (phase !== "closed") return
      try {
        currentPath = normalizePath(window.location.pathname)
        liveScroll = { x: window.scrollX, y: window.scrollY }
        const size = measureCanvas()
        const view: FrameView = pool.ensure({ path: currentPath })
        view.setCurrent(true)
        if (view.element.parentNode !== world) world.append(view.element)
        view.element.style.width = `${size.width}px`
        view.element.style.height = `${size.height}px`
        pool.schedule([currentPath])
        if (!pagesPromise || Date.now() - pagesAt >= PAGES_FRESH_MS) void fetchPages()
      } catch (error) {
        warn(error)
      }
    },
    destroy() {
      closeInstant()
      guardBox?.disconnect()
      disposers.forEach((dispose) => dispose())
      for (const [type, fn, options] of listeners) window.removeEventListener(type, fn, options)
      unsubscribe()
      unsubscribeInsets()
      window.removeEventListener("resize", onResize)
      clearTimeout(relayoutTimer)
      clearTimeout(settleTimer)
      if (wheelFrame) cancelAnimationFrame(wheelFrame)
      pool.destroy()
      root.remove()
      document.getElementById(STYLE_ID)?.remove()
      delete html.dataset.deView
    },
  }

  const disposers = [
    registerCommand("view.canvas", () => {
      if (phase === "closed" || phase === "closing") void board.open()
      else board.fit()
    }),
    registerCommand("view.canvas.toggle", () => void board.toggle()),
    registerCommand("view.canvas.prewarm", () => board.prewarm()),
  ]

  return board
}
