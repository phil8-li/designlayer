/**
 * Entry point for the Figma-style DesignLayer overlay.
 *
 * Loaded by the dev proxy on :3456 after the vendored React Rewrite bundle,
 * which we drive headlessly for fiber -> source resolution and source writes.
 * Nothing here runs on :3000.
 */

import { whenBridgeReady } from "./core/bridge"
import { createContext } from "./core/context"
import { whenHostHydrated } from "./core/host-readiness"
import { installToaster, mirrorVendorToasts } from "./core/toast"
import { mountShell } from "./shell/shell"
import { installVendorChromeSuppression } from "./shell/vendor-chrome"
import { installToolbar } from "./shell/toolbar"
import { installShortcuts } from "./shell/shortcuts"
import { installTooltips } from "./core/tooltip"
import { installCanvas } from "./canvas"
import { installAnnotations } from "./annotations/canvas"
import { installAgentation } from "./agentation/toolbar"
import { installLintMarkers } from "./lint/markers"
import { installLeftPanel } from "./panels/left"
import { installInspector } from "./panels/inspector"
import { installOptionsBrowser } from "./options/inventory-panel"

/*
 * Before anything is awaited, and deliberately outside `boot`.
 *
 * `boot` waits on the bridge and on host hydration, and the vendor paints its
 * own toolbar well inside that wait — so suppression owned by the shell was
 * always one flash late (see `shell/vendor-chrome.ts`). At module scope it
 * runs while the concatenated bundle is still evaluating, which is before the
 * vendor's root exists, which is the only time that beats it.
 *
 * It is not released with the shell either. The reason to hide that chrome is
 * that the editor is LOADED, not that its panels are currently mounted: hiding
 * the editor with ⌘. must not hand the page back wearing the vendor's UI.
 */
installVendorChromeSuppression({ onRoot: mirrorVendorToasts })

/*
 * The toaster, mounted here rather than with the shell, for the same reason
 * the suppression above is.
 *
 * Sonner subscribes to its store from a `useEffect`, so a message raised before
 * that effect has run has nobody listening — and the things that speak earliest
 * are exactly the ones worth hearing: the bridge timing out, a host that never
 * hydrates. `notify` queues across the gap either way (see `core/toast.ts`),
 * but mounting at module scope makes the gap a boot-time detail rather than
 * something every caller has to survive.
 *
 * Not released with the shell, again for the reason the suppression is not:
 * hiding the editor with ⌘. does not mean the editor has stopped having
 * anything to say.
 */
installToaster()

/*
 * The annotation toolbar, at module scope for a reason the other two do not
 * share: it must survive a boot that does not happen.
 *
 * `boot` returns early when the bridge never arrives or the host never
 * hydrates, and those are among the sessions where writing a note down matters
 * most — "the editor did not come up on this page" is feedback, and it has to
 * be reportable from the page it is about. Nothing in this toolbar reads the
 * bridge, the shell or the context, so there is nothing for it to wait on.
 */
installAgentation()

async function boot(): Promise<void> {
  let bridge
  try {
    ;[bridge] = await Promise.all([whenBridgeReady(), whenHostHydrated()])
  } catch (error) {
    console.warn("[designlayer]", error)
    return
  }

  const shell = mountShell()
  const context = createContext(bridge, shell.slots)

  installToolbar(context)
  // The left panel is a tab host now, not the layer tree directly: it mounts
  // the tree into one pane and the assets browser into the other. Everything
  // that used to reach `installLayersPanel` from here goes through it.
  installLeftPanel(context)
  installInspector(context)
  installCanvas(context)
  // Order here is cosmetic, and deliberately so. Both lanes listen at window
  // capture, where registration order decides who runs first — but the
  // selection lane asks `selectionOwnsInput()`, which is false the moment
  // annotation mode is on, so it declines whether it ran first or not.
  // Leaning on the order instead would have been a trap: `stopPropagation`
  // does not stop other listeners on the SAME target, so a swallow here can
  // never be what protects the lane next door. The gate is.
  installAnnotations(context)
  // Straight after the note pins, because the two are one decision rather than
  // two features: both pin a badge to an element's top-left corner, so the
  // state they share lets exactly one of them paint at a time. Mounted eagerly
  // and cheaply — the layer draws nothing until an audit has actually run.
  installLintMarkers(context)
  // Eagerly, not from the inspector's options section: browsing what controls
  // exist is the answer to "I cannot tell what options we have", and that
  // question is asked before anything is selected.
  installOptionsBrowser(context)
  /*
   * LAST, and that is the whole of its ordering requirement.
   *
   * It is the editor's only keyboard listener and it dispatches through the
   * command registry, so what it can actually do is whatever the lanes above
   * have registered by now. Mounting it earlier would still work — a name is
   * resolved at the moment a key is pressed, not at install — but a lane that
   * reads every other lane's output belongs after them in the list, or the next
   * reader has to prove the indirection to themselves before believing it.
   */
  installShortcuts(context)

  /*
   * One tooltip for the whole chrome, installed last because it listens to the
   * document rather than to any one surface.
   *
   * Delegated: nothing above has to register a tip, and nothing has to be
   * rebuilt when a panel repaints. Every control that already writes
   * `data-de-tip` — the toolbar's tools, the note-row actions, the settings
   * help dots — is picked up as-is, and so is every `title` the chrome sets,
   * which is what finally takes the operating system's own one-second tip out
   * of a surface that has its own visual language.
   *
   * The three hand-rolled CSS tips it replaces could not do the one thing that
   * matters here: a `::after` cannot measure the viewport, so a tip on a
   * control near the right edge ran off it. This one flips and shifts.
   */
  installTooltips()

  context.refresh()
  console.info("[designlayer] Figma-style overlay ready")
}

void boot()
