# DesignLayer for Mac

A Dock app for DesignLayer that installs on a Santa-managed Mac without compiling or signing anything.

- **Desk server** (`desk-server.mjs`): runs on `127.0.0.1:3454`, loopback only. A user LaunchAgent (`dev.designlayer.desk`) starts it at login. It keeps the start screen (`cli.mjs --start --no-open`, port 3455) running and restarts it with backoff if it dies. If a start screen is already running on 3455, the desk uses that one and never kills it.
- **Window**: a Chrome-installed web app (PWA) named DesignLayer, kept in its own Chrome profile. It shows a tab strip in the title bar: Home (the start screen), your open editors, a dashed offer for each other running editor (from `runtime/editor-registry.mjs`), and `+`.

## Install, status, uninstall

```sh
node desktop/mac/install.mjs                   # install and open the app
node desktop/mac/install.mjs --dry-run         # print the plan, change nothing
node desktop/mac/install.mjs --status          # LaunchAgent, health, start screen, app + Santa decision
node desktop/mac/install.mjs --start | --stop  # restart / stop the desk server
node desktop/mac/install.mjs --verify-window   # relaunch the app over CDP and check what it loads (an open window is reopened after)
node desktop/mac/install.mjs --app-window      # fallback window, see below
node desktop/mac/install.mjs --uninstall --yes # remove the LaunchAgent, the app and its Chrome profile
```

Running the installer again is safe. It rewrites the plist, restarts the desk, and keeps the existing app registration. If the app is open, the installer and `--uninstall` quit it first: they stop only the Chrome instance whose command line names the app's own profile, never your browser.

Tests: `node desktop/mac/test/desk-cases.mjs`. Icons: `node desktop/mac/make-icons.mjs` renders `icons/mark.svg` to PNG in a headless Playwright Chromium.

## Why this is within policy

Results of `santactl fileinfo` on this machine (macOS 26.6.2, Santa in Lockdown, transitive allowlisting with 1 compiler rule):

| Option | Santa rule | Verdict |
|---|---|---|
| Electron 44 (npm) | None (ad-hoc signed) | blocked |
| Tauri / Swift + WKWebView (locally compiled) | None, SIGKILL on run | blocked |
| AppleScript/JXA applet (`osacompile`) | None | blocked |
| Chrome `--app=` window | Chrome itself is allowed | works, but gives no Dock identity of its own |
| **Chrome PWA shim** (`app_mode_loader`) | **Allowed (Binary, Transitive)** | **used** |

Chrome is the fleet's Santa compiler rule, so the app shim Chrome writes when it installs a web app is allowlisted transitively. Everything else this uses is already allowed: Apple's `launchctl`, `open`, `osascript` and `plutil`, and Homebrew `node` (Allowed (Binary)). Nothing is compiled, signed or downloaded, and `codesign`/`spctl` are never run. Signing questions go through `santactl fileinfo`, which is read-only.

The PWA is installed over Chrome's DevTools pipe (`--remote-debugging-pipe --enable-devtools-pwa-handler`, `PWA.install`). Chrome 154 accepts that only on a non-default `--user-data-dir`, which is why the app has its own profile at `~/Library/Application Support/DesignLayer/Chrome`.

## How the window works

- The start screen and the editor proxies send no `X-Frame-Options` or `frame-ancestors` header (checked in `runtime/`, `server/` and `react-rewrite-cli`), so each one loads directly in an iframe. No reverse proxy is needed. They are all on 127.0.0.1, so they are same-site with the desk and keep the same storage they have in a normal tab.
- Pressing Start in a Home tab turns that tab into the editor, the same way it does in a browser. The desk renames the tab to the editor's name rather than opening a second copy.
- Any editor already running appears as a dashed "offer" tab. Click it to open it. Offered editors are never opened for you, because an editor's socket takes one client: opening it here disconnects any other window showing it.
- Shortcuts: ⌘1–9 switch tabs, ⌘T opens a new Home tab, ⌘W closes a tab. They only work when focus is on the tab strip or the desk page, because a cross-origin frame keeps its own keystrokes. Chrome can also reserve ⌘T and ⌘W for itself.
- Title bar: Chrome opens a new install with the normal title bar. Click the ⌃ toggle in the title bar once to move the tabs into it (Window Controls Overlay). The strip shows a one-time hint about this.
- The folder button opens the macOS folder picker (`osascript choose folder`) and copies the path you choose to the clipboard, so you can paste it into the start screen.

## Limits and fallback

- **If Santa ever blocks the shim** (for example, if Chrome stops being the compiler rule), `install.mjs` prints the decision and exits with code 2. Use `install.mjs --app-window` instead: it opens `Google Chrome --app=http://127.0.0.1:3454/ --user-data-dir=<the same profile>`, which runs Chrome itself and needs no shim.
- **Homebrew node upgrades**: Santa allows node by hash. After `brew upgrade node`, the new binary may not be allowlisted yet, and the LaunchAgent would be killed on start. Check with `santactl fileinfo /opt/homebrew/bin/node`, then `install.mjs --status`. The plist uses the stable `/opt/homebrew/bin/node` symlink rather than the versioned Cellar path, so an allowed upgrade needs no reinstall.
- The window needs the desk server. When the server is down, the service worker shows an offline page with the command to start it.

## Troubleshooting

- Logs: `~/Library/Logs/DesignLayer/desk.log` (desk) and `start-screen.log` (start screen and the editors it starts).
- `launchctl print gui/$(id -u)/dev.designlayer.desk` shows the agent's state and last exit code.
- "A Chrome instance is using …/DesignLayer/Chrome": the app's Chrome did not quit within 10 s. Quit the DesignLayer app (⌘Q) and run the command again.
