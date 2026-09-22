/**
 * The `react-rewrite-cli@0.1.1` overlay patch.
 *
 * 23 exact-once splices, 38 pinned identifiers, and one injected interaction
 * block. All of it is coupling to the pinned VENDOR BUILD, not to any host app,
 * so it ships as-is; only the values that used to encode one particular host —
 * the chrome selectors, the docked-panel geometry, the CSS variable names — are
 * now read from config and templated in at patch time.
 *
 * The patch is source text spliced into a minified bundle, so a selector cannot
 * be a runtime lookup: it is emitted as a `var` in the same block and every
 * reader closes over it. `requiredFragments` therefore asserts the accessor
 * NAMES, not the selector text, or the verifier would only ever pass for the
 * host that wrote it.
 */

function replaceOnce(source, needle, replacement, label) {
  const first = source.indexOf(needle)
  if (first === -1 || source.indexOf(needle, first + needle.length) !== -1) {
    throw new Error(`Unable to apply React Rewrite ${label} patch`)
  }

  return source.replace(needle, replacement)
}

function buildInteractionPatch(config) {
  const dock = config.chrome.dockedPanel
  const s = JSON.stringify
  const { gap, edgeGap, minWidth, maxWidth } = dock

  return [
    `var designLayerChromeSelector=${s(config.chrome.trustedSelector)},designLayerDockChromeSelector=${s(dock.chromeSelector)},designLayerDockSelector=${s(dock.selector)},designLayerDockFallbackSelector=${s(dock.fallbackSelector ?? "")},designLayerOffsetVar=${s(dock.offsetVar)},designLayerWidthVar=${s(dock.widthVar)},designLayerSelectedInteractiveTarget=null,designLayerSelectedInteractiveIdentity=null,designLayerLevaRefreshRaf=0,designLayerLevaRefreshFrames=0,designLayerCoexistenceInstalled=!1,designLayerInspectorSidebar=null,designLayerInspectorOpen=!1,designLayerCoexistenceResizeObserver=null,designLayerObservedLevaPanel=null;`,
    // `Element.closest("")` throws SyntaxError, so a host that declares no dev
    // chrome must short-circuit rather than call it.
    'function designLayerElementIsTrustedChrome(e){return e instanceof Element&&(e.id==="react-rewrite-root"||!!designLayerChromeSelector&&!!e.closest(designLayerChromeSelector))}',
    'function designLayerInstallBridge(){if(window.__DESIGNLAYER_BRIDGE__)return;window.__DESIGNLAYER_BRIDGE__={version:1,tokens:{get colors(){return l},get shadows(){return $},get radii(){return L},get font(){return x}},send:Ae,subscribe:ie,discoverFile:at,elementInfo:function(e){try{return Yl(e)}catch{return null}},elementSourceAsync:function(e){return Promise.resolve().then(function(){return zu(e)}).catch(function(){return null})},resolveSourceAt:function(e,t){return vl(e,t)},hitTest:Pt,selectedElement:Wl,refreshGeometry:ot,toast:V,root:Z,store:Object.create(jo,{removePendingPropertyOperation:{value:su,enumerable:!0}})}}',
    'function designLayerEventIsInsideTrustedChrome(e){return e.composedPath().some(designLayerElementIsTrustedChrome)}',
    'function designLayerEventIsInsideLevaChrome(e){return!!designLayerDockChromeSelector&&e.composedPath().some(t=>t instanceof Element&&!!t.closest(designLayerDockChromeSelector))}',
    'function designLayerLevaPanel(){if(!designLayerDockSelector)return null;let e=document.querySelector(designLayerDockSelector);if(e)return e;if(!designLayerDockFallbackSelector)return null;return[...document.querySelectorAll(designLayerDockFallbackSelector)].find(t=>getComputedStyle(t).position==="fixed")||null}',
    'function designLayerObserveLevaPanel(e){if(!designLayerCoexistenceResizeObserver||!e||designLayerObservedLevaPanel===e)return;designLayerObservedLevaPanel&&designLayerCoexistenceResizeObserver.unobserve(designLayerObservedLevaPanel),designLayerObservedLevaPanel=e,designLayerCoexistenceResizeObserver.observe(e)}',
    'function designLayerClearInspectorState(){let e=document.documentElement;e.classList.contains("react-rewrite-inspector-open")&&e.classList.remove("react-rewrite-inspector-open"),e.dataset.reactRewriteInspector!==void 0&&delete e.dataset.reactRewriteInspector,e.style.getPropertyValue(designLayerWidthVar)&&e.style.removeProperty(designLayerWidthVar),e.style.getPropertyValue(designLayerOffsetVar)&&e.style.removeProperty(designLayerOffsetVar)}',
    `function designLayerSyncInspectorState(){if(!designLayerInspectorOpen||!designLayerInspectorSidebar){designLayerClearInspectorState();return}let e=document.documentElement,t=Math.max(${minWidth},Math.min(${maxWidth},Math.round(designLayerInspectorSidebar.getBoundingClientRect().width||designLayerInspectorSidebar.offsetWidth||300))),o=designLayerLevaPanel(),n=-(t+${gap});if(o){designLayerObserveLevaPanel(o);let r=o.getBoundingClientRect(),i=parseFloat(e.style.getPropertyValue(designLayerOffsetVar))||0,a=r.left-i,s=r.right-i;n=window.innerWidth-t-${gap}-s,n=Math.max(n,${edgeGap}-a)}let r=\`\${t}px\`,i=\`\${Math.round(n)}px\`;e.classList.contains("react-rewrite-inspector-open")||e.classList.add("react-rewrite-inspector-open"),e.dataset.reactRewriteInspector==="open"||(e.dataset.reactRewriteInspector="open"),e.style.getPropertyValue(designLayerWidthVar)===r||e.style.setProperty(designLayerWidthVar,r),e.style.getPropertyValue(designLayerOffsetVar)===i||e.style.setProperty(designLayerOffsetVar,i)}`,
    'function designLayerPublishInspectorState(e,t){e&&(designLayerInspectorSidebar=e),designLayerInspectorOpen=t,t?(designLayerCoexistenceResizeObserver||(designLayerCoexistenceResizeObserver=new ResizeObserver(designLayerSyncInspectorState)),designLayerCoexistenceResizeObserver.observe(designLayerInspectorSidebar),designLayerObserveLevaPanel(designLayerLevaPanel())):(designLayerCoexistenceResizeObserver?.disconnect(),designLayerObservedLevaPanel=null),designLayerSyncInspectorState()}',
    'function designLayerRefreshSelectedGeometry(){typeof ot==="function"&&ot()}',
    'function designLayerScheduleLevaGeometryRefresh(e){if(!designLayerEventIsInsideLevaChrome(e))return;designLayerLevaRefreshFrames=12;if(designLayerLevaRefreshRaf)return;let t=()=>{designLayerSyncInspectorState(),designLayerRefreshSelectedGeometry(),designLayerLevaRefreshFrames-=1,designLayerLevaRefreshFrames>0?designLayerLevaRefreshRaf=requestAnimationFrame(t):designLayerLevaRefreshRaf=0};designLayerLevaRefreshRaf=requestAnimationFrame(t)}',
    'function designLayerInstallCoexistence(){if(designLayerCoexistenceInstalled)return;designLayerCoexistenceInstalled=!0,document.addEventListener("input",designLayerScheduleLevaGeometryRefresh,!0),document.addEventListener("change",designLayerScheduleLevaGeometryRefresh,!0),document.addEventListener("click",designLayerScheduleLevaGeometryRefresh,!0),document.addEventListener("pointerup",designLayerScheduleLevaGeometryRefresh,!0),window.addEventListener("resize",designLayerSyncInspectorState)}',
    'function designLayerCleanupCoexistence(){designLayerCoexistenceInstalled&&(document.removeEventListener("input",designLayerScheduleLevaGeometryRefresh,!0),document.removeEventListener("change",designLayerScheduleLevaGeometryRefresh,!0),document.removeEventListener("click",designLayerScheduleLevaGeometryRefresh,!0),document.removeEventListener("pointerup",designLayerScheduleLevaGeometryRefresh,!0),window.removeEventListener("resize",designLayerSyncInspectorState),designLayerCoexistenceInstalled=!1),designLayerLevaRefreshRaf&&(cancelAnimationFrame(designLayerLevaRefreshRaf),designLayerLevaRefreshRaf=0),designLayerLevaRefreshFrames=0,designLayerInspectorOpen=!1,designLayerInspectorSidebar=null,designLayerCoexistenceResizeObserver?.disconnect(),designLayerCoexistenceResizeObserver=null,designLayerObservedLevaPanel=null,designLayerClearInspectorState()}',
    `function designLayerInteractiveTarget(e){for(let t=e instanceof Element?e:null;t&&t!==document.body;t=t.parentElement){let o=t.matches('a[href],button,input:not([type="hidden"]),select,textarea,summary,label[for],[role="button"],[role="link"],[role="checkbox"],[role="radio"],[role="switch"],[role="menuitem"],[role="tab"],[tabindex]:not([tabindex="-1"])'),n=J(t),r=typeof n?.memoizedProps?.onClick==="function"||typeof t.onclick==="function";if(o||r)return t.matches(':disabled,[aria-disabled="true"]')||t.closest('[inert]')?null:t}return null}`,
    'function designLayerRememberInteractiveTarget(e){designLayerSelectedInteractiveTarget=e,designLayerSelectedInteractiveIdentity=e?{tagName:e.tagName,id:e.id,ariaLabel:e.getAttribute("aria-label"),keyShortcuts:e.getAttribute("aria-keyshortcuts"),text:e.textContent}:null}',
    'function designLayerActionTarget(){if(designLayerSelectedInteractiveTarget&&document.contains(designLayerSelectedInteractiveTarget))return designLayerSelectedInteractiveTarget;let e=designLayerSelectedInteractiveIdentity;if(e){let t=[...document.querySelectorAll(e.tagName)].find(o=>(!e.id||o.id===e.id)&&(!e.ariaLabel||o.getAttribute("aria-label")===e.ariaLabel)&&(!e.keyShortcuts||o.getAttribute("aria-keyshortcuts")===e.keyShortcuts)&&(!e.text||o.textContent===e.text));if(t)return designLayerSelectedInteractiveTarget=t,t}return designLayerInteractiveTarget(Wl())}',
    'function designLayerBlockPointerAction(e){rt&&!Je()&&!designLayerEventIsInsideTrustedChrome(e)&&(designLayerRememberInteractiveTarget(designLayerInteractiveTarget(e.target)),e.stopPropagation(),e.stopImmediatePropagation())}',
    'function designLayerBlockReleaseAction(e){rt&&!Je()&&!designLayerEventIsInsideTrustedChrome(e)&&(e.stopPropagation(),e.stopImmediatePropagation())}',
    'function designLayerDispatchAction(e){if(e.matches("[aria-haspopup]")){e.focus({preventScroll:!0});let t={bubbles:!0,cancelable:!0,composed:!0,key:"Enter",code:"Enter"};e.dispatchEvent(new KeyboardEvent("keydown",t)),document.contains(e)&&e.dispatchEvent(new KeyboardEvent("keyup",t));return}let t=e.getBoundingClientRect(),o=t.left+t.width/2,n=t.top+t.height/2,r={bubbles:!0,cancelable:!0,composed:!0,view:window,clientX:o,clientY:n,button:0,detail:1};e.dispatchEvent(new PointerEvent("pointerdown",{...r,buttons:1,pointerId:1,pointerType:"mouse",isPrimary:!0})),document.contains(e)&&e.dispatchEvent(new MouseEvent("mousedown",{...r,buttons:1})),document.contains(e)&&e.dispatchEvent(new PointerEvent("pointerup",{...r,buttons:0,pointerId:1,pointerType:"mouse",isPrimary:!0})),document.contains(e)&&e.dispatchEvent(new MouseEvent("mouseup",{...r,buttons:0})),document.contains(e)&&e.click()}',
    'function designLayerTriggerSelectedAction(){let e=designLayerActionTarget();if(!e){V("No action available for this element");return}if(Mt()==="select"){Ut("text"),setTimeout(()=>{let t=designLayerActionTarget();t&&designLayerDispatchAction(t),setTimeout(()=>Ut("select"),100)},0);return}designLayerDispatchAction(e)}',
    'function pr(e){rt&&!Je()&&!designLayerEventIsInsideTrustedChrome(e)&&(e.preventDefault(),e.stopPropagation(),e.stopImmediatePropagation())}',
  ].join("")
}

/**
 * The bridge closes over minified vendor internals by name. `replaceOnce` only
 * proves the *call sites* we splice into still exist — a bundler bump that
 * renames `Yl` to `Zm` would patch cleanly and then throw ReferenceError on the
 * first selection. So pin every borrowed name to its declaration, and every
 * store method the typed `RewriteStore` promises to its property definition.
 *
 * Each fragment must appear exactly once: a rename makes it appear zero times,
 * and a refactor that duplicates it means the name no longer identifies one
 * thing. Both are compatibility breaks worth stopping on.
 */
const BORROWED_DECLARATIONS = [
  // Design tokens read through `bridge.tokens`.
  'l={bgPrimary:"#ffffff"',
  '$={sm:"0 1px 3px rgba(0,0,0,0.08)',
  'L={xs:"4px",sm:"6px",md:"10px",lg:"14px"}',
  `x="'Inter', -apple-system`,
  // Fiber lookup and the store namespace object.
  "J=e=>{let t=globalThis.__REACT_DEVTOOLS_G",
  "jo,{addAnnotation:",
  // Functions the bridge exposes directly.
  ...[
    "Ae", // send
    "ie", // subscribe
    "at", // discoverFile
    "Yl", // elementInfo
    // elementSourceAsync — the element-taking async twin of `Yl`. React 19.2
    // removed `fiber._debugSource`, so the synchronous walk `Yl` performs
    // returns an empty `filePath` for every node in this app; this one reads
    // the owner stack and symbolicates it through the chunk's sourcemap, which
    // is the only route to a real file under React 19.
    "zu",
    "vl", // resolveSourceAt
    "Pt", // hitTest
    "Wl", // selectedElement
    "ot", // refreshGeometry
    "V", // toast
    "Z", // root
  ].map((name) => `function ${name}(`),
  // Functions the injected interaction guards call.
  ...["Je", "Mt", "Ut", "cr", "dr", "ur"].map((name) => `function ${name}(`),
  /*
   * `su` — the vendor's own per-property withdrawal from the pending store.
   *
   * It is the exact inverse of `addPendingPropertyOperation`: given a merge key
   * and a list of property keys, it drops those entries from the merged
   * operation and deletes the whole record when nothing is left. The vendor
   * calls it from its canvas-undo path and does not put it on the namespace
   * object the bridge is handed, so the patch adds it there.
   *
   * We borrow rather than reimplement because the pending store is the vendor's
   * data structure: a second writer walking `mt` would have to agree with
   * `Hi` about how `updates` and `propertyKeys` stay parallel, and about
   * firing `Ee()` so `hasChanges` repaints. Two implementations of that
   * invariant is one more than can be kept correct across a version bump.
   *
   * Listed here so a bundle that stops declaring it fails the build loudly
   * instead of silently giving the Changes tab a delete button that removes a
   * row and leaves the write queued behind it.
   */
  "function su(",
  // Every method `RewriteStore` declares, as defined on the store object.
  ...[
    "getActiveTool",
    "setActiveTool",
    "onToolChange",
    "onStateChange",
    "getCanvasTransform",
    "setCanvasTransform",
    "onCanvasTransformChange",
    "viewportToPage",
    "pageToViewport",
    "addPendingPropertyOperation",
    "buildBatchOperations",
    "hasChanges",
    "addMove",
    "updateMoveDelta",
    "getMoveForElement",
    "resetCanvas",
  ].map((method) => `${method}:`),
]

function assertBorrowedInternals(source) {
  for (const fragment of BORROWED_DECLARATIONS) {
    const first = source.indexOf(fragment)
    if (first === -1) {
      throw new Error(
        `React Rewrite bundle no longer declares an internal the bridge borrows: ${fragment}`
      )
    }
    if (source.indexOf(fragment, first + fragment.length) !== -1) {
      throw new Error(
        `React Rewrite internal is no longer unique, so the bridge cannot rely on it: ${fragment}`
      )
    }
  }
}

export function patchOverlay(source, config) {
  assertBorrowedInternals(source)

  // React Rewrite's native selection canvas interpolates hover/selection
  // geometry in `bs()` on requestAnimationFrame. Our first-party canvas owns
  // all visible selection chrome, so leaving that painter alive produces a
  // second, animated highlight underneath it. Keep the vendor's geometry state
  // current for its hit-testing internals, clear any old pixels, and never
  // schedule its painter.
  source = replaceOnce(
    source,
    "function qe(){Yt===null&&(Yt=requestAnimationFrame(bs))}",
    "function qe(){for(let e of [se,j,...G])e&&(e.current={...e.target},e.opacity=e.targetOpacity);P&&oe&&P.clearRect(0,0,oe.width,oe.height)}",
    "native selection painter suppression"
  )

  source = replaceOnce(
    source,
    'rt=!0,document.addEventListener("mousedown",cr,!0),document.addEventListener("mousemove",dr,!0),document.addEventListener("mouseup",ur,!0)',
    'rt=!0,designLayerInstallCoexistence(),document.addEventListener("pointerdown",designLayerBlockPointerAction,!0),document.addEventListener("pointerup",designLayerBlockReleaseAction,!0),document.addEventListener("mousedown",cr,!0),document.addEventListener("mousemove",dr,!0),document.addEventListener("mouseup",ur,!0),document.addEventListener("mouseup",designLayerBlockReleaseAction,!0)',
    "pointer guard"
  )
  source = replaceOnce(
    source,
    'function Xl(){rt=!1,document.removeEventListener("mousedown",cr,!0)',
    'function Xl(){rt=!1,document.removeEventListener("pointerdown",designLayerBlockPointerAction,!0),document.removeEventListener("pointerup",designLayerBlockReleaseAction,!0),document.removeEventListener("mouseup",designLayerBlockReleaseAction,!0),document.removeEventListener("mousedown",cr,!0)',
    "pointer guard cleanup"
  )
  source = replaceOnce(
    source,
    'function pr(e){rt&&(Je()||e.metaKey||e.ctrlKey||e.preventDefault())}',
    buildInteractionPatch(config),
    "interaction guard"
  )
  source = replaceOnce(
    source,
    'e.composedPath().some(r=>r instanceof HTMLElement&&r.id==="react-rewrite-root")',
    "designLayerEventIsInsideTrustedChrome(e)",
    "selection mousedown trusted chrome"
  )
  source = replaceOnce(
    source,
    "if(rt&&!Je()&&!Ko()){",
    "if(rt&&!Je()&&!Ko()&&!designLayerEventIsInsideTrustedChrome(e)){",
    "selection mousemove trusted chrome"
  )
  source = replaceOnce(
    source,
    "function ur(e){if(!rt||Je()||Ko())return;",
    "function ur(e){if(!rt||Je()||Ko()||designLayerEventIsInsideTrustedChrome(e))return;",
    "selection mouseup trusted chrome"
  )
  source = replaceOnce(
    source,
    'e.closest("#react-rewrite-root")||e instanceof HTMLElement&&e.hasAttribute("data-react-rewrite-interaction")',
    'designLayerElementIsTrustedChrome(e)||e instanceof HTMLElement&&e.hasAttribute("data-react-rewrite-interaction")',
    "selection target trusted chrome"
  )
  source = replaceOnce(
    source,
    "function al(e){H&&Lt();",
    'function al(e){if(designLayerEventIsInsideTrustedChrome(e))return;rt&&(e.preventDefault(),e.stopPropagation(),e.stopImmediatePropagation()),H&&Lt();',
    "double-click guard"
  )
  source = replaceOnce(
    source,
    '!o.closest("#react-rewrite-root")?t=o:t=Pt(e.clientX,e.clientY)',
    "!designLayerElementIsTrustedChrome(o)?t=o:t=Pt(e.clientX,e.clientY)",
    "text target trusted chrome"
  )
  source = replaceOnce(
    source,
    'if((t instanceof HTMLElement?t:null)?.closest("#react-rewrite-root")){Lt();return}',
    "if(designLayerElementIsTrustedChrome(t)){Lt();return}",
    "text mousedown trusted chrome"
  )
  source = replaceOnce(
    source,
    '!t.closest("#react-rewrite-root")?t:Pt(e.clientX,e.clientY)',
    "!designLayerElementIsTrustedChrome(t)?t:Pt(e.clientX,e.clientY)",
    "text next target trusted chrome"
  )
  source = replaceOnce(
    source,
    'e.target?.closest?.("#react-rewrite-root")||Js(e)',
    "designLayerElementIsTrustedChrome(e.target)||Js(e)",
    "zoom shortcut trusted chrome"
  )
  source = replaceOnce(
    source,
    '!i.closest("#react-rewrite-root")&&!i.hasAttribute("data-react-rewrite-interaction")',
    '!designLayerElementIsTrustedChrome(i)&&!i.hasAttribute("data-react-rewrite-interaction")',
    "hit testing trusted chrome"
  )
  source = replaceOnce(
    source,
    'if(d.closest("#react-rewrite-root"))continue;',
    "if(designLayerElementIsTrustedChrome(d))continue;",
    "sibling scan trusted chrome"
  )
  source = replaceOnce(
    source,
    "i.appendChild(a),i.appendChild(u),n.appendChild(i)",
    `i.appendChild(a);let designLayerHeaderActions=document.createElement("div");designLayerHeaderActions.className="prop-sidebar-header-actions";let designLayerActionMenu=document.createElement("details");designLayerActionMenu.className="prop-sidebar-action-menu";let designLayerActionSummary=document.createElement("summary");designLayerActionSummary.className="prop-sidebar-action-summary",designLayerActionSummary.title="Element actions",designLayerActionSummary.setAttribute("aria-label","Element actions"),designLayerActionSummary.innerHTML="&#8230;";let designLayerActionList=document.createElement("div");designLayerActionList.className="prop-sidebar-action-list",designLayerActionList.setAttribute("role","menu");let designLayerTriggerAction=document.createElement("button");designLayerTriggerAction.className="prop-sidebar-action-item",designLayerTriggerAction.type="button",designLayerTriggerAction.setAttribute("role","menuitem"),designLayerTriggerAction.innerHTML='<span aria-hidden="true">&#9654;</span><span>Trigger action</span>',designLayerTriggerAction.addEventListener("click",R=>{R.preventDefault(),R.stopPropagation(),designLayerActionMenu.open=!1,setTimeout(designLayerTriggerSelectedAction,0)}),designLayerActionList.appendChild(designLayerTriggerAction),designLayerActionMenu.appendChild(designLayerActionSummary),designLayerActionMenu.appendChild(designLayerActionList),designLayerHeaderActions.appendChild(designLayerActionMenu),designLayerHeaderActions.appendChild(u),i.appendChild(designLayerHeaderActions),n.appendChild(i)`,
    "action menu"
  )
  source = replaceOnce(
    source,
    'function F(R,K,b,w){s.textContent=`<${R}>`',
    'function F(R,K,b,w){let designLayerResolvedActionTarget=designLayerActionTarget(),designLayerActionLabel=designLayerResolvedActionTarget?.getAttribute("aria-label")||designLayerResolvedActionTarget?.tagName.toLowerCase()||"";designLayerActionMenu.open=!1,designLayerActionMenu.hidden=!designLayerResolvedActionTarget,designLayerTriggerAction.dataset.target=designLayerActionLabel,designLayerTriggerAction.title=designLayerActionLabel?`Trigger ${designLayerActionLabel}`:"",s.textContent=`<${R}>`',
    "action menu state"
  )
  source = replaceOnce(
    source,
    'n.style.width=`${b}px`',
    'n.style.width=`${b}px`,designLayerPublishInspectorState(n,n.classList.contains("visible"))',
    "inspector resize state"
  )
  source = replaceOnce(
    source,
    'M||(M=!0,n.offsetHeight,n.classList.add("visible"))',
    'M||(M=!0,n.offsetHeight,n.classList.add("visible"),designLayerPublishInspectorState(n,!0))',
    "inspector open state"
  )
  source = replaceOnce(
    source,
    'function _(){M&&(M=!1,n.classList.remove("visible"))}',
    'function _(){M&&(M=!1,n.classList.remove("visible"),designLayerPublishInspectorState(n,!1))}',
    "inspector close state"
  )
  // Install the bridge after the vendor overlay finishes booting, so every
  // lazily-initialized module it exposes is populated before we read it.
  source = replaceOnce(
    source,
    "function vc(){try{lp(),ap()}",
    "function vc(){try{lp(),ap(),designLayerInstallBridge()}",
    "bridge install"
  )
  source = replaceOnce(
    source,
    'function Pa(){let e=document.getElementById("react-rewrite-root");',
    'function Pa(){designLayerCleanupCoexistence();let e=document.getElementById("react-rewrite-root");',
    "editor teardown cleanup"
  )
  source = replaceOnce(
    source,
    "  .prop-sidebar-header-info {",
    `  .prop-sidebar-header-actions {
    display: flex;
    align-items: center;
    gap: 2px;
    flex-shrink: 0;
  }
  .prop-sidebar-action-menu {
    position: relative;
  }
  .prop-sidebar-action-menu[hidden] {
    display: none;
  }
  .prop-sidebar-action-summary {
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: \${L.sm};
    color: \${l.textTertiary};
    cursor: pointer;
    font-size: 16px;
    font-weight: 600;
    line-height: 1;
    list-style: none;
  }
  .prop-sidebar-action-summary::-webkit-details-marker {
    display: none;
  }
  .prop-sidebar-action-summary:hover,
  .prop-sidebar-action-menu[open] .prop-sidebar-action-summary {
    background: \${l.bgTertiary};
    color: \${l.textPrimary};
  }
  .prop-sidebar-action-list {
    position: absolute;
    top: 26px;
    right: 0;
    width: 164px;
    padding: 4px;
    background: \${l.bgPrimary};
    border: 1px solid \${l.border};
    border-radius: \${L.sm};
    box-shadow: \${$.md};
    z-index: 2;
  }
  .prop-sidebar-action-item {
    width: 100%;
    height: 30px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 8px;
    border: none;
    border-radius: \${L.xs};
    background: transparent;
    color: \${l.textPrimary};
    cursor: pointer;
    font-family: \${x};
    font-size: 11px;
    text-align: left;
  }
  .prop-sidebar-action-item:hover {
    background: \${l.bgSecondary};
  }
  .prop-sidebar-header-info {`,
    "action menu styles"
  )

  const dock = config.chrome.dockedPanel
  const requiredFragments = [
    "designLayerElementIsTrustedChrome",
    // The accessor name, not the selector text: the text is per-host.
    "designLayerChromeSelector=",
    "designLayerDockChromeSelector=",
    "designLayerPublishInspectorState",
    "designLayerLevaPanel",
    "designLayerCoexistenceResizeObserver",
    `window.innerWidth-t-${dock.gap}-s`,
    `Math.max(n,${dock.edgeGap}-a)`,
    "===r||e.style.setProperty",
    "!==void 0&&delete e.dataset.reactRewriteInspector",
    JSON.stringify(dock.widthVar),
    JSON.stringify(dock.offsetVar),
    "designLayerScheduleLevaGeometryRefresh",
    "designLayerCleanupCoexistence",
    "Trigger action",
    "window.__DESIGNLAYER_BRIDGE__",
    "designLayerInstallBridge()",
    // Without this accessor every source write silently drops on React 19, and
    // the failure is invisible: the preview still paints, the Apply button just
    // never leaves its disabled state. A vendor upgrade that renames the async
    // resolver has to fail here rather than degrade into that.
    "elementSourceAsync:function(e){return Promise.resolve().then(function(){return zu(e)})",
    "function qe(){for(let e of [se,j,...G])",
  ]
  for (const fragment of requiredFragments) {
    if (!source.includes(fragment)) {
      throw new Error(
        `React Rewrite patched overlay is missing required fragment: ${fragment}`
      )
    }
  }

  return source
}
