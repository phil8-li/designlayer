/**
 * The desk shell: one window, a tab strip in the title bar, an iframe per tab.
 *
 * Self-contained on purpose (inline CSS and JS, no build step): the page is
 * served by a LaunchAgent from a checkout other people are editing, and it must
 * keep working when src/ is mid-change or dist/ is stale.
 *
 * Framing was checked, not assumed: neither runtime/start-screen.mjs, the
 * editor proxy (runtime/launcher.mjs, react-rewrite-cli) nor server/routes.mjs
 * sends X-Frame-Options or a CSP frame-ancestors, so the start screen and every
 * editor proxy load directly in an iframe. All of them are on 127.0.0.1, so the
 * frames are same-site with this page and keep the storage they have in a
 * normal tab (storage partitioning keys on site, not port).
 */

export function shellPage({ repoRoot }) {
  const startCommand = `node ${repoRoot}/desktop/mac/install.mjs --start`
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#1a1a1a">
<title>DesignLayer</title>
<link rel="manifest" href="/manifest.webmanifest">
<link rel="icon" href="/icons/mark.svg" type="image/svg+xml">
<style>
  :root {
    --ground: #1a1a1a; --raised: #232323; --tab: #2a2a2a; --ink: #fff;
    --ink-2: rgba(255,255,255,.62); --ink-3: rgba(255,255,255,.4);
    --hair: rgba(255,255,255,.08); --hair-2: rgba(255,255,255,.14);
    --accent: #7cc4f8; --fill: #0c8ce9; --danger: #f28b82;
    --strip-h: env(titlebar-area-height, 38px);
    color-scheme: dark;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; height: 100%; background: var(--ground); color: var(--ink);
    font: 12px/1.4 -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif;
    -webkit-font-smoothing: antialiased; overflow: hidden; }
  button { font: inherit; color: inherit; }
  kbd { font: 11px/1 ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--ink-2);
    border: 1px solid var(--hair-2); border-radius: 4px; padding: 2px 4px; }
  code { font: 12px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; }

  /* Title bar. With Window Controls Overlay the strip sits beside the traffic
     lights; without it (a normal tab, or overlay toggled off) it is a top bar. */
  .strip { position: fixed; top: env(titlebar-area-y, 0); left: env(titlebar-area-x, 0);
    width: env(titlebar-area-width, 100%); height: var(--strip-h);
    display: flex; align-items: center; gap: 2px; padding: 0 6px 0 8px;
    -webkit-app-region: drag; app-region: drag; user-select: none; }
  .strip::after { content: ""; position: fixed; left: 0; right: 0; top: var(--strip-h);
    border-top: 1px solid var(--hair); pointer-events: none; }
  body:not(.wco) .strip { padding-left: 10px; }
  .tabs { display: flex; align-items: center; gap: 2px; min-width: 0; flex: 0 1 auto; overflow: hidden; }
  .tab, .icon-btn { -webkit-app-region: no-drag; app-region: no-drag; }
  .tab { position: relative; display: flex; align-items: center; gap: 6px; height: 26px;
    min-width: 0; max-width: 200px; padding: 0 6px 0 9px; border: 0; border-radius: 6px;
    background: transparent; color: var(--ink-2); cursor: default; flex: 0 1 auto;
    font-size: 12px; transition: background .12s, color .12s; }
  .tab:hover { background: rgba(255,255,255,.05); color: var(--ink); }
  .tab[aria-selected="true"] { background: var(--tab); color: var(--ink);
    box-shadow: inset 0 0 0 1px var(--hair); }
  .tab:focus-visible, .icon-btn:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
  .tab .glyph { width: 14px; height: 14px; flex: none; display: grid; place-items: center; color: var(--ink-3); }
  .tab[aria-selected="true"] .glyph { color: var(--accent); }
  .tab .label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .tab .num { font-size: 10px; color: var(--ink-3); font-variant-numeric: tabular-nums; }
  .tab .close { width: 16px; height: 16px; border-radius: 4px; display: grid; place-items: center;
    color: var(--ink-3); opacity: 0; flex: none; }
  .tab:hover .close, .tab[aria-selected="true"] .close { opacity: 1; }
  .tab .close:hover { background: rgba(255,255,255,.1); color: var(--ink); }
  .tab.dead .label { color: var(--ink-3); text-decoration: line-through; text-decoration-color: var(--ink-3); }
  .tab .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--fill); flex: none;
    box-shadow: 0 0 0 3px rgba(12,140,233,.25); }
  .tab.offer { color: var(--ink-3); border: 1px dashed var(--hair-2); }
  .tab.offer:hover { color: var(--ink); border-color: var(--accent); }
  .icon-btn { width: 26px; height: 26px; border: 0; border-radius: 6px; background: transparent;
    color: var(--ink-2); display: grid; place-items: center; flex: none; }
  .icon-btn:hover { background: rgba(255,255,255,.07); color: var(--ink); }
  .spacer { flex: 1; min-width: 24px; height: 100%; }
  .status { display: flex; align-items: center; gap: 6px; color: var(--ink-3); font-size: 11px;
    padding: 0 6px; white-space: nowrap; }
  .status i { width: 6px; height: 6px; border-radius: 50%; background: #5bb974; }
  .status.warn i { background: #fbbc04; }
  .status.down i { background: var(--danger); }

  .frames { position: fixed; left: 0; right: 0; bottom: 0; top: calc(var(--strip-h) + 1px); background: var(--ground); }
  .frames iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; background: var(--ground); }
  .frames iframe[hidden] { display: block; visibility: hidden; pointer-events: none; }

  .sheet { position: absolute; inset: 0; display: grid; place-items: center; background: var(--ground); z-index: 2; }
  .sheet[hidden] { display: none; }
  .card { width: min(420px, calc(100% - 48px)); text-align: center; }
  .card img { width: 56px; height: 56px; margin-bottom: 16px; }
  .card h1 { font-size: 15px; font-weight: 600; margin: 0 0 6px; letter-spacing: -.01em; }
  .card p { margin: 0 0 14px; color: var(--ink-2); font-size: 12px; }
  .card .cmd { display: block; text-align: left; background: var(--raised); border: 1px solid var(--hair);
    border-radius: 8px; padding: 10px 12px; color: var(--ink); user-select: all; margin-bottom: 14px; overflow-wrap: anywhere; }
  .card .row { display: flex; gap: 8px; justify-content: center; }
  .btn { height: 28px; padding: 0 12px; border-radius: 6px; border: 1px solid var(--hair-2); background: var(--raised); color: var(--ink); }
  .btn:hover { border-color: rgba(255,255,255,.24); }
  .btn.primary { background: var(--fill); border-color: var(--fill); }
  .btn.primary:hover { background: #1a96ef; }
  .spinner { width: 18px; height: 18px; border-radius: 50%; border: 2px solid var(--hair-2);
    border-top-color: var(--accent); animation: spin .9s linear infinite; margin: 0 auto 14px; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .spinner { animation-duration: 3s; } }
  .toast { position: fixed; left: 50%; bottom: 18px; transform: translateX(-50%); background: var(--raised);
    border: 1px solid var(--hair-2); border-radius: 8px; padding: 8px 12px; color: var(--ink); font-size: 12px;
    box-shadow: 0 8px 24px rgba(0,0,0,.4); z-index: 5; max-width: calc(100% - 32px); }
  .toast[hidden] { display: none; }
  .hint { -webkit-app-region: no-drag; app-region: no-drag; height: 22px; padding: 0 8px; border-radius: 11px;
    border: 1px solid rgba(124,196,248,.35); background: rgba(12,140,233,.12); color: var(--accent); font-size: 11px; white-space: nowrap; }
  .hint:hover { background: rgba(12,140,233,.2); }
  .hint[hidden] { display: none; }
  .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
</style>
</head>
<body>
<header class="strip" id="strip">
  <nav class="tabs" id="tabs" role="tablist" aria-label="Open tabs"></nav>
  <button class="icon-btn" id="newTab" title="New Home tab (⌘T)" aria-label="New Home tab">
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M6 1.5v9M1.5 6h9" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
  </button>
  <div class="spacer"></div>
  <button class="hint" id="wcoHint" hidden title="Chrome shows a title-bar toggle for apps like this one">Put tabs in the title bar</button>
  <div class="status" id="status" role="status"><i></i><span>Starting</span></div>
  <button class="icon-btn" id="reload" title="Reload this tab" aria-label="Reload this tab">
    <svg width="13" height="13" viewBox="0 0 16 16" aria-hidden="true"><path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 2.5v3h-3" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
  </button>
  <button class="icon-btn" id="pickFolder" title="Choose a project folder and copy its path" aria-label="Choose a project folder">
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M1.75 4.25c0-.83.67-1.5 1.5-1.5h3l1.5 1.5h5c.83 0 1.5.67 1.5 1.5v5.5c0 .83-.67 1.5-1.5 1.5h-9.5c-.83 0-1.5-.67-1.5-1.5z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>
  </button>
</header>
<main class="frames" id="frames">
  <section class="sheet" id="boot" aria-live="polite">
    <div class="card">
      <img src="/icons/mark.svg" alt="">
      <div class="spinner" id="bootSpin"></div>
      <h1 id="bootTitle">Starting DesignLayer…</h1>
      <p id="bootText">Waiting for the start screen to come up.</p>
      <code class="cmd" id="bootCmd" hidden>${escapeHtml(startCommand)}</code>
    </div>
  </section>
</main>
<div class="toast" id="toast" role="status" hidden></div>
<script>
(() => {
  const KEY = "designlayer.desk.tabs.v1"
  const $ = (id) => document.getElementById(id)
  const tabsEl = $("tabs"), framesEl = $("frames")
  let health = null, editors = [], offers = [], homeUrl = null, deskDown = false
  // undefined until the first poll, so an editor already running at load is not
  // mistaken for one the current Home tab just started.
  let lastEditingKey = undefined, lastActiveHome = null

  const saved = (() => { try { return JSON.parse(localStorage.getItem(KEY)) } catch { return null } })()
  let tabs = Array.isArray(saved?.tabs) && saved.tabs.length ? saved.tabs : [{ id: uid(), kind: "home" }]
  let active = tabs.some((t) => t.id === saved?.active) ? saved.active : tabs[0].id
  const dismissed = new Set(saved?.dismissed ?? [])

  function uid() { return Math.random().toString(36).slice(2, 9) }
  function persist() {
    localStorage.setItem(KEY, JSON.stringify({
      tabs: tabs.map(({ id, kind, url, name, key }) => ({ id, kind, url, name, key })),
      active, dismissed: [...dismissed].slice(-50),
    }))
  }
  const editorKey = (e) => e.url + "#" + e.pid
  const tabUrl = (t) => (t.kind === "home" ? homeUrl : t.url)

  function toast(text, ms = 3200) {
    const el = $("toast"); el.textContent = text; el.hidden = false
    clearTimeout(toast.t); toast.t = setTimeout(() => (el.hidden = true), ms)
  }

  const HOME_GLYPH = '<svg width="12" height="12" viewBox="0 0 16 16"><path d="M8 1.8 14.2 5 8 8.2 1.8 5z" fill="currentColor"/><path d="M1.8 8 8 11.2 14.2 8M1.8 11 8 14.2 14.2 11" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" opacity=".6"/></svg>'
  const EDIT_GLYPH = '<svg width="12" height="12" viewBox="0 0 16 16"><rect x="2" y="2.5" width="12" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M2 5.5h12" stroke="currentColor" stroke-width="1.3"/></svg>'
  const X = '<svg width="8" height="8" viewBox="0 0 8 8"><path d="M1 1l6 6M7 1 1 7" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>'

  function render() {
    tabsEl.textContent = ""
    tabs.forEach((t, i) => {
      const b = document.createElement("div")
      b.className = "tab"; b.setAttribute("role", "tab"); b.tabIndex = t.id === active ? 0 : -1
      b.setAttribute("aria-selected", String(t.id === active))
      const dead = t.kind === "editor" && !editors.some((e) => e.url === t.url)
      if (dead && health) b.classList.add("dead")
      const name = t.kind === "home" ? "Home" : t.name || t.url
      b.title = t.kind === "home" ? "Start screen — choose an app" : (t.projectRoot || name) + (dead ? " (stopped)" : "")
      b.innerHTML = '<span class="glyph">' + (t.kind === "home" ? HOME_GLYPH : EDIT_GLYPH) + '</span><span class="label"></span>' +
        (i < 9 ? '<span class="num">⌘' + (i + 1) + '</span>' : "") +
        (tabs.length > 1 ? '<span class="close" role="button" aria-label="Close tab">' + X + "</span>" : "")
      b.querySelector(".label").textContent = name
      b.onmousedown = (ev) => { if (ev.button === 1) { ev.preventDefault(); close(t.id) } }
      b.onclick = (ev) => { if (ev.target.closest(".close")) close(t.id); else select(t.id) }
      b.onkeydown = (ev) => {
        if (ev.key === "ArrowRight" || ev.key === "ArrowLeft") {
          const n = (i + (ev.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length
          select(tabs[n].id); tabsEl.children[n]?.focus()
        }
      }
      tabsEl.append(b)
    })
    for (const e of offers) {
      const b = document.createElement("button")
      // An editor's socket takes one client, so opening it here disconnects any
      // other window showing it. That is why running editors are offered, not opened.
      b.className = "tab offer"; b.title = "Open " + e.name + " in a tab (" + e.projectRoot + "). Any other window showing this editor disconnects."
      b.innerHTML = '<span class="dot"></span><span class="label"></span>'
      b.querySelector(".label").textContent = e.name
      b.onclick = () => { offers = offers.filter((o) => o !== e); openEditor(e, true) }
      tabsEl.append(b)
    }
    syncFrames()
    persist()
  }

  function syncFrames() {
    const live = new Set(tabs.map((t) => t.id))
    for (const f of framesEl.querySelectorAll("iframe")) if (!live.has(f.dataset.id)) f.remove()
    for (const t of tabs) {
      let f = framesEl.querySelector('iframe[data-id="' + t.id + '"]')
      const url = tabUrl(t)
      if (!f && url) {
        f = document.createElement("iframe")
        f.dataset.id = t.id
        f.allow = "clipboard-read; clipboard-write; fullscreen"
        f.title = t.kind === "home" ? "DesignLayer start screen" : t.name || "Editor"
        f.src = url
        framesEl.append(f)
      }
      if (f) f.hidden = t.id !== active
    }
    const cur = tabs.find((t) => t.id === active)
    const waiting = !cur || (cur.kind === "home" && !homeUrl) || deskDown
    $("boot").hidden = !waiting
    if (cur?.kind === "home") lastActiveHome = cur.id
    document.title = cur && cur.kind === "editor" ? (cur.name || "Editor") + " — DesignLayer" : "DesignLayer"
  }

  function select(id) { active = id; render() }
  function newHome() { const t = { id: uid(), kind: "home" }; tabs.push(t); select(t.id) }
  function close(id) {
    const i = tabs.findIndex((t) => t.id === id); if (i < 0) return
    const t = tabs[i]
    if (t.kind === "editor" && t.key) dismissed.add(t.key)
    tabs.splice(i, 1)
    if (!tabs.length) tabs.push({ id: uid(), kind: "home" })
    if (active === id) active = (tabs[i] || tabs[i - 1] || tabs[0]).id
    render()
  }
  function openEditor(e, focus) {
    const existing = tabs.find((t) => t.kind === "editor" && t.url === e.url)
    if (existing) { if (focus) select(existing.id); return }
    const t = { id: uid(), kind: "editor", url: e.url, name: e.name, key: editorKey(e), projectRoot: e.projectRoot }
    tabs.push(t)
    if (focus) active = t.id
    render()
  }

  async function poll() {
    try {
      const [h, list] = await Promise.all([
        fetch("/api/health", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/editors", { cache: "no-store" }).then((r) => r.json()),
      ])
      deskDown = false; health = h; editors = list.editors || []
    } catch {
      deskDown = true
    }
    applyHealth()
    applyEditors()
    render()
  }

  function applyHealth() {
    const s = $("status"), label = s.querySelector("span")
    const ss = health?.startScreen
    if (deskDown) {
      s.className = "status down"; label.textContent = "Desk offline"
      $("bootSpin").hidden = true; $("bootTitle").textContent = "The DesignLayer desk is not running"
      $("bootText").textContent = "Start it from Terminal, then this window reconnects by itself:"; $("bootCmd").hidden = false
      return
    }
    $("bootCmd").hidden = true; $("bootSpin").hidden = false
    if (ss?.ready && ss.url) {
      if (homeUrl !== ss.url) {
        // The start screen came up on a different port (or for the first time): repoint Home tabs.
        const was = homeUrl; homeUrl = ss.url
        if (was) for (const f of framesEl.querySelectorAll("iframe")) {
          const t = tabs.find((x) => x.id === f.dataset.id); if (t?.kind === "home") f.src = homeUrl
        }
      }
      s.className = "status"; label.textContent = editors.length ? editors.length + (editors.length === 1 ? " editor" : " editors") : "Ready"
    } else {
      s.className = "status warn"; label.textContent = "Starting"
      $("bootTitle").textContent = ss?.state === "backoff" ? "Restarting DesignLayer…" : "Starting DesignLayer…"
      $("bootText").textContent = ss?.detail || "Waiting for the start screen to come up."
    }
    // A Home tab that pressed Start has navigated itself into the editor. Relabel
    // that tab rather than opening the same editor a second time.
    const ed = ss?.editing
    const key = ed?.url ? ed.url + "|" + (ed.projectRoot || "") : null
    if (key && key !== lastEditingKey && lastEditingKey !== undefined) {
      // Only when this window is the one in use: a start screen pressed in some
      // other browser tab must not relabel ours.
      const home = document.hasFocus() && tabs.find((t) => t.id === active && t.id === lastActiveHome && t.kind === "home")
      const origin = new URL(ed.url).origin
      if (home && !tabs.some((t) => t.kind === "editor" && t.url === origin)) {
        const e = editors.find((x) => x.url === origin)
        Object.assign(home, { kind: "editor", url: origin, name: e?.name || ed.packageName || "Editor",
          projectRoot: ed.projectRoot, key: e ? editorKey(e) : null })
        // The iframe already shows the editor; keep it, just re-key what it is.
      }
    }
    lastEditingKey = key
  }

  function applyEditors() {
    const open = new Set(tabs.filter((t) => t.kind === "editor").map((t) => t.url))
    const fresh = editors.filter((e) => !open.has(e.url) && !dismissed.has(editorKey(e)))
    // Editors that were already running are offered, never opened unasked: the
    // vendor socket keeps one client, so a tab here would disconnect whichever
    // browser tab (or agent) is using that editor now.
    offers = fresh
    for (const t of tabs) {
      const e = t.kind === "editor" && editors.find((x) => x.url === t.url)
      if (e) { t.name = e.name; t.projectRoot = e.projectRoot; t.key = editorKey(e) }
    }
  }

  // ⌘1–9, ⌘T, ⌘W reach this page when focus is on the strip or the page itself.
  // A cross-origin frame keeps its own keystrokes, and Chrome may reserve ⌘T/⌘W.
  addEventListener("keydown", (ev) => {
    if (!(ev.metaKey || ev.ctrlKey) || ev.altKey) return
    if (/^[1-9]$/.test(ev.key)) {
      const t = ev.key === "9" ? tabs[tabs.length - 1] : tabs[Number(ev.key) - 1]
      if (t) { ev.preventDefault(); select(t.id) }
    } else if (ev.key === "t" || ev.key === "T") { ev.preventDefault(); newHome() }
    else if (ev.key === "w" || ev.key === "W") { ev.preventDefault(); close(active) }
  })
  $("newTab").onclick = newHome
  $("reload").onclick = () => {
    const f = framesEl.querySelector('iframe[data-id="' + active + '"]'); const t = tabs.find((x) => x.id === active)
    if (f && t) f.src = tabUrl(t) || f.src
  }
  $("pickFolder").onclick = async () => {
    try {
      const r = await fetch("/api/pick-folder", { method: "POST" }).then((x) => x.json())
      if (r.cancelled) return
      if (!r.path) throw new Error(r.error || "No folder")
      try { await navigator.clipboard.writeText(r.path); toast("Copied " + r.path + " — paste it into the folder field") }
      catch { toast(r.path, 8000) }
    } catch (e) { toast("Could not open the folder picker: " + e.message) }
  }
  if ("windowControlsOverlay" in navigator) {
    const hint = $("wcoHint")
    const wco = () => {
      const on = navigator.windowControlsOverlay.visible
      document.body.classList.toggle("wco", on)
      // Chrome starts a new install with the normal title bar; the toggle is in it.
      hint.hidden = on || !matchMedia("(display-mode: standalone)").matches || localStorage.getItem(KEY + ".wcoHint") === "done"
      if (on) localStorage.setItem(KEY + ".wcoHint", "done")
    }
    hint.onclick = () => {
      toast("Click the ⌃ arrow at the right end of the window's title bar to put these tabs in it.", 7000)
      localStorage.setItem(KEY + ".wcoHint", "done"); hint.hidden = true
    }
    navigator.windowControlsOverlay.addEventListener("geometrychange", wco); wco()
  }
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {})

  render()
  poll()
  setInterval(poll, 2000)
})()
</script>
</body>
</html>`
}

export function offlinePage({ repoRoot }) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>DesignLayer</title>
<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#1a1a1a">
<style>html,body{margin:0;height:100%;background:#1a1a1a;color:#fff;font:13px/1.5 -apple-system,system-ui,sans-serif}
body{display:grid;place-items:center}.c{width:min(440px,calc(100% - 48px))}h1{font-size:15px;margin:0 0 6px}
p{color:rgba(255,255,255,.62);margin:0 0 12px}code{display:block;background:#232323;border:1px solid rgba(255,255,255,.08);
border-radius:8px;padding:10px 12px;font:12px/1.5 ui-monospace,Menlo,monospace;user-select:all;overflow-wrap:anywhere}
button{margin-top:14px;height:28px;padding:0 12px;border-radius:6px;border:1px solid #0c8ce9;background:#0c8ce9;color:#fff;font:inherit}</style>
</head><body><div class="c"><h1>The DesignLayer desk is not running</h1>
<p>This window needs the local desk server on 127.0.0.1. Start it from Terminal:</p>
<code>node ${escapeHtml(repoRoot)}/desktop/mac/install.mjs --start</code>
<p style="margin-top:12px">Logs: <span style="color:#fff">~/Library/Logs/DesignLayer/desk.log</span></p>
<button onclick="location.reload()">Try again</button></div>
<script>setInterval(()=>fetch("/api/health",{cache:"no-store"}).then(r=>r.ok&&location.reload()).catch(()=>{}),3000)</script>
</body></html>`
}

function escapeHtml(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}
