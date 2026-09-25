# DesignLayer

A visual editor for a running React or Angular dev server. It proxies your app,
lets you select an element in the page, edit its layout, styles and design
tokens, and writes the change back into the component source.

Nothing in your app imports it, and nothing in it imports your app. It attaches
from the outside, at the proxy, so adopting it is additive and dropping it
leaves no trace in your source tree.

What it does, in the order you meet it:

- **Edit the page, and keep the change.** Select an element and work on its
  layout, spacing, typography, fill and effects. Elements can be inserted and
  deleted too, and every edit is written back to real source — see
  [Where a change ends up](#where-a-change-ends-up).
- **Read whatever design system the app already loads.** Point it at a
  manifest, a W3C tokens file, or nothing but a stylesheet the app serves, and
  the token pickers, component catalog and icon set come from *that* system
  rather than one hardcoded here. See [Design-system catalog](#design-system-catalog)
  and [A design system that is not a manifest](#a-design-system-that-is-not-a-manifest).
- **Say what is wrong without writing the fix.** Leave a note on an element, a
  region or a run of text, then hand the set to your coding agent over MCP — it
  reads the notes, the elements they point at, and the source that renders them.
  See [Handing a change to your coding agent](#handing-a-change-to-your-coding-agent).
- **Move between the apps you have running.** One chooser lists every editor on
  the machine, so changing prototypes is a click rather than a restart. See
  [Switching apps](#switching-apps).

Both frameworks are first-class and neither needs configuring. Tailwind is
detected separately from the framework: durable layout and appearance edits
write Tailwind utilities, and an app without it still inspects, annotates, and
edits text.

## Requirements

- Node >= 20.9
- A React app (Next.js, or Vite) or an Angular app, with a dev script (the start
  screen and `--dev` both run it for you; with neither, start the dev server
  yourself first). Which one it is is detected from the host's `package.json` —
  see [Angular hosts](#angular-hosts).
- App Router and Pages Router are both supported, and neither requires a
  `next.config` file. The overlay can inspect any Next app; durable layout and
  appearance edits currently write Tailwind utilities, so full visual editing
  requires Tailwind. Text edits do not.
- A project under a folder macOS guards — Documents, Desktop, iCloud Drive — is
  supported. Such a folder can read perfectly and still refuse `stat`,
  `realpath`, `mkdir` and `write` to this process, which is enough to break a
  tool that assumes a readable path is a fully usable one. The config is read as
  source rather than imported, the working directory is taken from config rather
  than read back from the OS, and the containment guard and control defaults
  degrade instead of refusing.
- The package installs `react-rewrite-cli@0.1.1` exactly. The runtime patches
  that build's minified bundle at serve time against 23 pinned anchors; a
  different version will not patch, and the launcher tells you so instead.

## Install

The package is not on npm. Install it from source as a development
dependency; its prepare script builds the browser bundle on install.

1. Clone it beside your app and install the checkout:

   ```sh
   git clone https://github.com/phil8-li/designlayer.git
   npm i -D ../designlayer
   ```

   To hand off one immutable artifact instead, run `npm pack` in this package
   and install the resulting `.tgz` file.

2. Optionally add the scripts. The start screen needs neither — they are the
   shortcut for a project you open every day:

   ```json
   {
     "scripts": {
       "design": "designlayer --dev --open 3000",
       "verify:designlayer": "designlayer --verify"
     }
   }
   ```

3. When developing the package itself, rebuild after a change under its `src/`:

   ```sh
   npm run build
   ```

   You will rarely have to. The launcher compares `dist/` against `src/` at
   startup and rebuilds a bundle that has fallen behind, saying so in a line you
   cannot miss — an editor that silently served last week's `src/` is the kind
   of thing that gets debugged for an hour. Installing a prebuilt `dist/` with
   no `esbuild` present is still supported: it starts, and serves what it has.

4. Ignore the state directory:

   ```
   .local/designlayer/
   ```

## Use

```sh
npx designlayer
```

With no arguments it opens a start screen in your browser and asks which app to
edit, which page of it to open, and where its source is.

- **Which app.** It scans the usual dev-server ports and lists what answered, by
  page title, so `Host App` is what you click rather than `127.0.0.1:3000`.
  Nothing running yet is fine — type the URL you want and it will start the app
  for you. A running app usually knows its own folder, so picking a row fills
  the folder in for you; a row that cannot work its folder out clears the field
  and says so, rather than leaving the previous row's folder standing.
- **Which page.** The URL is where you say it. Type `127.0.0.1:3000/pricing` and
  that is the page you land on, not the app's `/`.
- **Where its source is.** Type or paste the folder's full path. `~` works, and
  so does a folder dragged onto a terminal — the shell's escaping is undone for
  you — so Finder's Copy as Pathname, `pwd`, and the command line of the running
  dev server all produce something the field takes as-is. It reads that folder's
  `package.json` to confirm it is the right project and to find the dev script,
  and tells you what it is about to run before you commit to it.

Press the button and it does the rest: starts the dev server if it has to, waits
for the app to answer, mounts the editing proxy in front of it, and puts the tab
you are already in onto the editor. The page you land on is your app — the
editor is the chrome around it.

An app that is throwing still opens. A dev server answering 500 has plainly been
found, and a broken render is exactly when you want the overlay in front of it.

That is the whole flow, so nothing about your project has to change first. There
is no config file to write, no script to add, and no dependency to install into
the app you are editing.

### Getting the editor out of the way

**⌘. — Ctrl+. on Windows and Linux**, the same key Figma uses, and the collapse
button in the toolbar does the same thing. The panels slide out to the edges
they are docked to, the bar drops through the bottom, and the app gets the full
window and its own clicks back — the same pass-through as interactive mode, with
nothing left on screen to argue with it. What stays is one round button in the
bottom-right corner; press it, or the shortcut again, and everything comes back.

The shortcut works from anywhere on the page, including while the editor is
hidden and the focus is somewhere in your app — it is the way back, so it cannot
depend on the editor having the keyboard. Typing a full stop into one of the
editor's own fields is left alone.

Drag that button somewhere else if it is standing where you want to look. It
stays inside the window, it remembers where you left it, and the drag that ends
on it does not also count as a press.

### Resizing the panels

Grab the inner edge of either panel and pull. There is no gutter and no grip to
find — the hairline between the chrome and your app *is* the handle, and it
lights up when the pointer is near enough to take it. Your app reflows while you
drag rather than when you let go, so the layout you widened the inspector to
look at is the layout you end up looking at.

| Gesture | Does |
| --- | --- |
| **Drag** the inner edge | Resize. The app follows live. |
| **Arrow keys** on a focused edge | 10px a press; 50px with Shift, or Page Up/Down |
| **Home / End** | Straight to the narrowest or widest the panel may be |
| **Double-click** the edge | Back to the width it started at |
| **Drag past half the minimum** | Closes the panel, same as its toolbar toggle |

Each panel keeps its own bounds: it will not go narrower than its contents can
use, and neither may take more than about a third of the window, so the canvas
stays the largest thing on screen. Shrink the window under two wide panels and
they give room back until the app has room to be looked at; grow it again and
they return to the widths you set. Those widths outlive the tab.

The resizing is [`motion-panels`](https://motion-panels.letstri.dev), wired
through its framework-agnostic core rather than its React adapter, because this
overlay is plain DOM. The library owns the drag, the bounds, the keyboard map
and the settle; the panels keep their own stylesheet, and nothing about how the
chrome looks at rest moved to make room for it.

### The canvas is your app's viewport

The panels do not cover your app — they take room from it. The strip between
them is inset as padding on `<html>`, so an app laid out in percentages reflows
into it on its own, and two more things are made to agree with it:

- **Viewport units.** `100vw` means the window, and the window does not change
  when a panel opens, so an app sized that way used to stay full width and run
  on underneath the inspector. Those declarations are re-pointed at the canvas
  while the editor is up, in the live CSSOM — no file is touched, and hiding the
  editor with <kbd>⌘.</kbd> puts every one of them back.
- **Breakpoints.** A `@media (max-width: 1024px)` is asked about the canvas
  rather than the window, so a 940px canvas inside a 1440px window wears the
  layout it would wear in a 940px window — measured on a real prototype, down to
  the pixel. Close the inspector and the app crosses its own breakpoints as it
  widens.

Four things stay on the window, because nothing here can honestly move them:
`position: fixed` chrome (inherent to insetting without a transform, and the
alternative would break shared-element morphs), stylesheets served from another
origin, `vw` written into an inline `style` attribute, and `matchMedia` in your
app's own JavaScript. If one part of a layout ignores the panels, it is almost
always one of those four.

### Switching apps

The chooser lasts as long as the session, not as long as the first app you pick.
The command you ran stays a supervisor on 3455 and never becomes an editor
itself; each app you choose is a child process it starts, watches, and can
replace. So designing a second app is not a quit and a restart.

From inside the editor, the **Choose app** pill in the toolbar is the way back.
Unapplied changes and uncopied prompts live only in that tab, so the first click
arms the control rather than leaving — it asks, and reverts on its own if you
walk away. An editor started any other way has no such pill, because there is no
chooser behind it to return to.

### From the command line instead

If you already know the port, name it and the start screen is skipped:

```sh
npm run design            # designlayer --dev --open 3000
```

If a dev server is already up on the port, it attaches to that one instead and
leaves it alone, including on the way out: `Ctrl+C` only stops a server this
command started.

Without `--dev` the app has to be running already, and the launcher says so
rather than failing inside the vendor's health check. Without `--open`, open the
**proxy** URL it prints — not your dev server. The line to trust is the one
prefixed `[designlayer]`; the vendored CLI prints a banner just above it that
reports the ports it asked for rather than the ones it bound.

```
designlayer [appPort] [options]

  (no arguments)          Open the start screen: pick a running app and its folder
  appPort                 Dev server port (default: app.port, else framework detection)
  --start / --no-start    Force or skip the start screen (default: when no port is known)
  --dev                   Start the app's dev server too, and attach when it is up
  --dev-script <name>     npm script --dev runs (default: app.devScript, "dev")
  --config <path>         Config file (default: nearest one above cwd)
  --project-root <path>   Project the config loads against (default: the current folder)
  --start-screen-port <n> Port for the start screen (default: 3455, else any free port)
  --proxy-port <n>        Port for the editing proxy the browser loads
  --ws-port <n>           Port for the source-edit WebSocket
  --host <host>           Dev server host (default: 127.0.0.1)
  --open / --no-open      Open the editing URL on start (default: no)
  --verify                Check the vendor patch still applies, then exit
  --print-config          Print the resolved config as JSON, then exit
```

`--dev` runs your own npm script with `PORT` set, so whatever that script
already does — env files, wrappers, extra flags — keeps happening. The start
screen takes the same path: the script it names in the hint is the one it runs.

Because the folder you choose is the project root, the config file is discovered
from there rather than from wherever you happened to be standing when you typed
the command.

`--verify` is worth running in CI. It is the check that fails loudly when a
dependency bump moves the vendored bundle out from under the patch.

Every edit is undoable with the platform's own pair — `⌘Z` and `⇧⌘Z` on macOS,
`Ctrl+Z` and `Shift+Ctrl+Z` elsewhere — and with the two toolbar buttons, which
run the same call. The timeline lives on the writer rather than on the panels,
so a section added later is undoable without being wired up for it, and it
covers the preview and the queued source operation together: undoing a change
also takes back what "Apply to code" would have written.

Dragging and resizing on the canvas go through that same writer, so a gesture is
one undo step, one row in the Changes tab, and — for the width and height a
resize settles on — a queued operation "Apply to code" can write. A gesture that
moved and resized at once is a single step, not three.

### As a Dock app on a Mac

`desktop/mac` installs DesignLayer as a Mac app, which is a nicer front door
than a terminal for the way this is actually used: opened in the morning, left
running, switched between apps all day.

```sh
node desktop/mac/install.mjs              # install and open it
node desktop/mac/install.mjs --status     # LaunchAgent, health, start screen, app
node desktop/mac/install.mjs --uninstall --yes
```

Nothing is compiled and nothing is signed, which is the constraint it is built
around — a managed Mac will not run an ad-hoc signed binary, and this needs no
binary at all. A user LaunchAgent starts a loopback-only desk server at login,
which keeps the start screen up and restarts it if it dies; the window is a
Chrome-installed web app in its own profile, showing a tab strip of Home, your
open editors, and an offer for each other editor running on the machine. An
existing start screen is adopted rather than killed, and `--uninstall` stops
only the Chrome whose command line names this app's own profile, never your
browser.

`desktop/mac/README.md` has the whole thing, including the policy table it was
designed against. The suite is `desktop/mac/test/desk-cases.mjs`; it is in
`npm test` and skips loudly off macOS.

## Angular hosts

An Angular app is a first-class host. Nothing has to be configured — not the
framework, not the dev script, not the port. `npx designlayer` and pick it off
the start screen, or `designlayer --dev` from the project folder.

What the tool works out for itself, and where each answer comes from:

| Question | Answered by |
|---|---|
| Which framework | `@angular/core` in the host's `package.json` |
| Which npm script `--dev` runs | the first of `dev`, `develop`, `start`, `serve` the host actually has — `ng new` writes `start` and no `dev` |
| Which port to wait on | `angular.json`'s `serve.options.port`, else 4200 |
| How to name that port | `--port` on the command line; `ng serve` ignores `PORT` |
| Which interface to ask for | `--host 127.0.0.1`; `ng serve` defaults to `localhost` |
| Which interface the app is on | probed, `127.0.0.1` then `::1`. An app the DESIGNER started is wherever their own script put it, so the proxy follows rather than assumes |
| Which folder a running app is in | the listener's own working directory, via `/proc` on Linux and `lsof` on macOS |
| Whether to offer Tailwind controls | `tailwindcss` in the host's dependencies — a separate question from the framework |
| When the app is ready | `ng-version`, the mark Angular leaves on the element it bootstrapped into |

`host.framework` and `host.tailwind` in a config file override the first and the
second-to-last of those, and nothing else needs saying. The same table is what
makes a Vite React app work unconfigured: it ignores `PORT` and binds `[::1]`
too, so those columns were fixing one bug on two frameworks.

The loopback row is the one that bites hardest, because it is silent. A designer
who runs `npm start` in a stock Angular project has an app on `http://[::1]:4200`
and nothing on `127.0.0.1`. Scanned only for v4, that app simply did not appear
on the start screen — and typing its address by hand did not help either,
because the proxy then targeted an address with nothing on it. The scan now
looks on both, the row carries the address that answered, and `--dev` attaches
to a server already running on either rather than starting a rival beside it.

Two things differ, and both follow from Angular not being React.

**Where an element comes from.** There is no fiber, so there is no owner stack
to walk. The browser reads the authoring component off Angular's own dev-mode
global — `ng.getOwningComponent(el)`, the same accessor Angular DevTools uses —
and sends its class name to the loopback server, which maps it through the
`@Component` decorator to a `templateUrl` (or an inline `template`). An element
is then located inside that template by tag, static classes, parent and sibling
index. A descriptor that fits two template nodes equally well resolves to
NOTHING: the inspector still names the component's file, "Apply to code" leaves
that element alone, and the change goes to the Changes tab. Guessing between two
candidates would restyle an element the user was not looking at, and the only
clue would be the wrong thing moving.

**What gets written.** Angular templates have no utility classes, so there is no
Tailwind translation step and no property the translator cannot spell. A style
edit is written as a declaration in the element's own `style` attribute, in its
template, and merges with whatever is already there; `transform`, which a drag
produces and which is preview-only on the React lane, is writable here. Class
edits rewrite the static `class` attribute. Text edits replace static text and
are refused — not overwritten — where the content holds an interpolation, a
control-flow block, or child elements.

Only static markup is touched. A `[style.x]`, `[class.x]` or `[ngClass]`
binding is read as part of the live element's identity and never rewritten, and
the block syntax around an element (`@if`, `@for`) is left exactly as it stands.

`source.extensions` gains `.html`, `.css` and `.scss` on an Angular host unless
the host sets that list itself, in which case it gets exactly what it asked for.

**The right panel is the same panel.** Every section a React host draws, an
Angular host draws, with one exception and it is not about Angular: the
Responsive section writes Tailwind breakpoint variants, so it appears only where
Tailwind is compiled — hidden on a React app without it, shown on an Angular app
with it. The Code tab drops its JSX view for an Angular element, because
`className=` describes a file that does not exist, and the class list stops
calling itself "Tailwind classes" in a project that has none. The handoff record
follows the same rule: on an Angular host it reports the element's `class`, not
its `className`, because a brief that names a JSX attribute sends an agent
looking through `.html` templates for something that was never there.
`test/host-parity-cases.mjs` renders the panel under each host, files a real
request through each, and fails if any of that drifts.

Under the hood the vendored `react-rewrite-cli` still supplies the proxy, the
script injection and the overlay's hit-testing, none of which know what
framework they are in front of. Its startup `detect()` does — it requires a
`react` dependency and a `next.config`/`vite.config` file — so those two probes
are answered for the duration of its own synchronous detection pass and no
longer. Nothing is written into the host project.

## Configure

Optional. With no config file the tool runs against generic defaults for a
stock Next.js + Tailwind + shadcn/ui app. It does not look for Leva,
Agentation, or any host dev panel unless the host opts in.

Copy `designlayer/designlayer.config.example.mjs` to
`designlayer.config.mjs` in your project root and delete everything you do
not need. The file is discovered by walking up from the working directory, and
all its paths resolve against the directory holding it.

The settings most likely to matter:

- **`tailwind.version`** — on Tailwind v4, set `4` and
  `spacingScale: "v4-linear"`, or the editor writes arbitrary values for
  spacing tokens that do exist in your build.
- **`tailwind.breakpoints`** — the responsive prefixes the inspector offers;
  the default is Tailwind's `sm` through `2xl` scale.
- **`tailwind.containerBreakpoints`** — the separate container-query scale.
  It is empty by default because container variants are host-dependent.
- **`tailwind.colorWords`** — your palette stems, so `bg-brand-500` is written
  as a class rather than as an arbitrary colour.
- **`designSystem.manifest`** — the canonical token catalog displayed beside
  the selected element. Add `designSystem.cssSources` to map authored CSS and
  Tailwind aliases back to those tokens.
- **`icons`** — your icon set, so a selected `<svg>` names itself and the
  inspector can offer the other drawings as variants.
- **`source.roots`** — the directories the agent may edit.

### Design-system catalog

The optional catalog keeps the package generic while letting a host expose its
real token vocabulary in the inspector:

```js
designSystem: {
  manifest: "docs/design-tokens.json",
  cssSources: ["app/globals.css"],
},
```

The manifest may contain `Color`, `Spacing`, and `Radius` collections plus
`textStyles`, `uiTextStyles`, `effectStyles`, `iconScale`, and `motion` arrays.
Every one of them is optional. A design system with no motion tokens and no
text styles simply omits those keys; the axis resolves empty and the inspector
drops the row rather than drawing a picker with nothing in it. What the launcher
validates is the groups you did supply — a group that is present and the wrong
shape fails at startup with its field name, so a stale generated manifest is
caught, while a smaller design system is not mistaken for a broken one.

`designSystem.trackingUnit` — `"em"` or `"px"` — states the unit your text
styles express letter-spacing in. It is declared rather than inferred: `-0.5` is
a plausible em and a plausible px, and guessing by magnitude makes a text style
stop matching the moment a host writes tracking the other way. A manifest may
carry its own `trackingUnit`; the config's value wins.

### A design system that is not a manifest

Some hosts keep tokens in a TypeScript module, a Style Dictionary build, or a
CMS. `designSystem.adapter` is the escape hatch — one function, called with
`{ projectRoot }`, returning the same token groups the manifest path produces:

```js
designSystem: {
  adapter: () => ({
    name: "Lattice",
    colors: Object.entries(palette).map(([name, light]) => ({
      id: `color:${name}`, name, category: "color",
      cssVar: `--lattice-${name}`, values: { light },
    })),
  }),
  cssSources: ["app/globals.css"],
},
```

Everything downstream — alias resolution, the pickers, the inspector rows — is
identical, because the adapter produces the catalog rather than a second kind of
catalog. `manifest` and `adapter` are mutually exclusive; supplying both is
refused at startup instead of silently ranked.

### A design system behind a sign-in

Point the panel at an internal component catalog — a Storybook on your company's
network, a token file behind SSO — and the editor will hit the same wall a
stranger would. It fetches that link from its own process on your machine, which
holds none of the sessions your browser holds, so a site you can open in the
next tab is still closed to it.

You are not asked for a token, and on the walls this was built for you could not
supply one anyway: on an SSO proxy of this shape, every cookie in the exchange
is `HttpOnly` and `document.cookie` on that page returns nothing at
all. So the editor opens **that site's own sign-in** in a browser window, you
sign in the way you always do, and the session it produces is picked up for you:

1. Paste the link. The add is refused and the panel says which site is private.
2. Press **Sign in with Google** — or whichever provider the site redirects to;
   the button is named from the redirect rather than guessed.
3. Finish in the window that opens. It closes itself and the add is replayed.

The session is verified against the link before it is stored, so the panel can
never claim you are signed in to a site whose libraries still fail. It is
remembered in a browser profile under the editor's state directory, which means
the next library behind the same sign-on needs no window at all — the editor
retries silently first and only asks when the provider does.

`Forget` on a signed-in row drops both halves: the credential the editor holds
and that origin's session inside the profile, so the next sign-in genuinely
asks.

If a site cannot be opened that way, **I have an access token** is still there,
folded away, with the OAuth client id the refusal carried.

### Tailwind aliases, v4 and v3

On Tailwind v4 the theme lives in the stylesheet, so the editor reads
`@theme` custom properties and traces them back to tokens.
`tailwind.themeNamespaces` says which namespaces your app declares; the default
is Tailwind's own `color`, `radius`, `text`, and `shadow`. Extend it for
anything else you compile, and note that a longer name wins over a shorter
prefix — listing `"text-shadow"` keeps `--text-shadow-lift` out of the
typography axis.

On Tailwind v3 there is no theme block to read, so point the editor at the
config file, or hand it the scale directly:

```js
designSystem: {
  tailwindConfig: "tailwind.config.js",   // or
  tailwindTheme: { color: { ink: "var(--ink)" }, radius: { card: "6px" } },
},
```

`colors`, `borderRadius`, `fontSize`, and `boxShadow` map onto the catalog's
colour, radius, text, and shadow axes. A scale entry may be a `var()`, which is
traced like a v4 alias, or a literal, which is matched against the token's own
value — so `brand: "#0b7285"` still resolves to the token that holds that
colour. Without either key a v3 host resolves no Tailwind aliases at all.

### Host icon set

Separate from `designSystem.iconScale`, which is the icon *size* scale. This is
the drawing data, and it turns a selected `<svg>` into a layer with a name and a
list of alternatives:

```js
icons: {
  attribute: "data-acme-icon",
  data: "src/components/icons/acme-icon-data.json",
},
```

`attribute` is the DOM attribute your icon factory stamps each glyph with — that
is how a selection names itself. `data` is a JSON map of name to
`{ nodes: [[tag, attrs, children?]], rootFill, rootStroke? }`, the shape a React
icon factory already stores, so a host points at the file its components render
and writes no adapter. Both halves or neither: an attribute with no data names
icons the picker cannot offer, and data with no attribute cannot be matched to a
selection. Leave the block out and the inspector's icon section never renders.

The set is served on request by `GET {apiPrefix}/icons` rather than shipped in
the browser prelude, because it is path data measured in hundreds of kilobytes
and most sessions never open the panel. Only the attribute and a boolean cross
into the browser at load.

A swap redraws the glyph in place and says "preview only" every time: the source
writer speaks in classes and text, and the JSX still names the component it
always did. Width, height, and class are left alone — size and colour belong to
the call site that placed the icon, not to the drawing.

### Responsive metadata

Two facts, deliberately kept apart. `tailwind.breakpoints` says which variant
prefixes your build **compiles**; the optional `designSystem.breakpoints` says
which of those steps your design system has a **meaning** for:

```js
tailwind: {
  breakpoints: { sm: 640, md: 768, lg: 1024 },
  containerBreakpoints: { md: 448, lg: 512, xl: 576 },
},
designSystem: {
  breakpoints: {
    md: { usage: "Sheet: the nav stops docking and floats over the canvas.",
          owner: "src/hooks/use-mobile.ts" },
  },
  containerBreakpoints: {
    xl: { usage: "Cards: switch to two columns.", owner: "src/cards.tsx" },
  },
  responsiveMeasures: {
    contentFits: {
      formula: "viewport - navigation >= 720px",
      usage: "Whether the reading column keeps its minimum measure.",
      owner: "src/layout.ts",
    },
  },
},
```

Viewport and container pixels keep separate owners in `tailwind.breakpoints`
and `tailwind.containerBreakpoints`; annotations may only add prose. Naming a
step its corresponding map does not define fails at startup. A prefix you leave
unannotated still appears in the inspector because it compiles, but it is marked
as outside the design system rather than presented as a decision someone made.
Responsive measures are read-only metadata: they describe product layout rules
that cannot be represented honestly as one editable CSS declaration.

CSS sources are scanned for custom-property chains and Tailwind `@theme`
aliases. Resolution stops at a manifest-owned custom property: for example,
`--color-background` may point through `--background` to
`--sem-background-primary`. Conflicting declarations are retained as ambiguous
aliases rather than assigned to one token. Only the normalized catalog enters
the browser prelude; manifest and stylesheet paths remain server-side.

### Dev chrome

If your app renders a dev-only GUI, list its selectors in
`chrome.trustedSelectors` so the editor treats it as furniture rather than as
something you meant to restyle. `chrome.dockedPanel` goes one step further and
keeps the editor's inspector beside that panel instead of on top of it: the
editor publishes the panel's width and its own offset as two CSS variables, and
your stylesheet reads them to make room.

```css
/* only if you set chrome.dockedPanel */
.my-dev-panel {
  right: calc(var(--designlayer-dev-panel-offset, 0px) + 1rem);
}
```

Both variable names are configurable. Leave the whole `chrome` block out if you
have no dev GUI — an empty selector list is legal and correct.

### Companions

A companion is somebody else's dev-time browser tooling, loaded onto the page
beside the editor rather than instead of it — an annotation toolbar, a
feature-flag switcher, a locale picker. The editor injects one script into every
page it proxies, and a companion rides in on that injection, so nothing dev-only
has to be added to an app that ships.

It is declared as a bundle plus the selectors that bundle draws under. The
second half is what makes it usable: the canvas treats everything it did not
draw as the app, so without them a click on a companion's button selects the
button instead of pressing it. The selectors join `chrome.trustedSelectors`.

```js
// designlayer.config.mjs
companions: ["./tools/flag-switcher/companion.json"],
```

```json
{
  "name": "flag-switcher",
  "script": "./flag-switcher.js",
  "trustedSelectors": ["[data-flag-switcher]"]
}
```

The script must be a self-contained browser bundle — an IIFE, no imports, no
exports. Paths inside a manifest are read against the manifest, so a companion
and its bundle travel together. A bare `.js` path is also accepted, for a
companion with no chrome of its own to declare. A declared companion that is not
there fails at startup rather than launching an editor silently missing it.

`DESIGNLAYER_COMPANIONS` names the same manifests for the whole machine, in a
list separated by `:` or `,`. That is the lane for tooling that belongs to the
person rather than to the project — one annotation toolbar wired into every app
they open, with nothing added to any of their repositories.

Bundles are concatenated after the editor's own, each fenced, so a companion
that throws on evaluation costs itself and nothing else.

A companion whose gesture is clicking the app — an annotation toolbar is the
obvious one — has to say so, because `inspecting` mode is exactly what swallows
that click. `window.__DESIGNLAYER__.claimPointer(name)` holds the editor in
`interactive` for as long as the claim is held and returns the release:

```js
const release = window.__DESIGNLAYER__?.claimPointer?.("flag-switcher")
// …later, when your tool disarms
release?.()
```

Look the API up at claim time rather than at load: companion bundles evaluate
before the editor has finished booting.

The user still outranks a claim — pressing Inspect while one is held puts the
editor back. A companion has to disarm itself when that happens, or both tools
answer the same click and one gesture does two things: measured on a real page,
a single click both selected a `<span>` into the inspector and opened an
annotation box on it. `onModeChange` is how a companion finds out.

```js
window.__DESIGNLAYER__?.onModeChange?.((mode) => {
  if (mode !== "interactive") disarmMyTool()
})
```

Between the two, the editor's mode is the single switch on the page, and both
tools end up on the correct side of it whichever one the person reached for.

A companion that paints over the editor needs a z-index above `.de-root`
(2147483000) and above the surfaces the editor raises over itself: the note
layer at 2147483100, the pickers and menus through 2147483300, and the toast at
2147483646. Going to the very top is only safe if your full-viewport layers are
`pointer-events: none` — one that takes the pointer up there puts an invisible
sheet over the editor and the app both.

A companion that sits *beside* the chrome rather than over it usually ends up
depending on two things this repository owns: the `--de-*` custom properties
that say where the panels are, and `.de-root`'s z-index, which anything drawing
above the panels has to clear. Both are a real contract, and neither is
enforceable from here — a companion built from its own source under
`~/.local/share/designlayer/companions/` is invisible to any search of this
repository. Renaming the `de-` prefix or restacking `.de-root` therefore means
editing each companion's source and rebuilding it in the same change. Both
values carry that warning at their definitions in `src/core/css/base.ts`.

### Contextual controls and source defaults

Leva integration is optional and explicit. Configure `controls.leva.storeGlobal`
to inventory the live controls. A binding connects a path pattern to the DOM
elements it affects; first match wins, `*` matches one path segment, and `**`
matches any suffix. The editor never infers relationships from names.

```js
controls: {
  leva: {
    storeGlobal: "__STORE",
    sourceDefaults: {
      file: "src/design-defaults.ts",
      exportName: "DESIGN_DEFAULTS",
    },
    bindings: [{
      pathPattern: "Cards.Spacing.*",
      selectors: ["[data-card]"],
      relationship: "spacing within",
      defaultGroup: "Card spacing",
    }],
  },
}
```

`sourceDefaults` must name an exported object literal. Its groups must also be
object literals, and editable values must be string, finite-number, boolean, or
null literals. Dynamic expressions and files outside `source.roots` are refused.
Writes replace only the target literal; unrelated comments and formatting stay
untouched.

Activating “Show affected” dispatches
`designlayer:highlight-elements` on `window`. The event detail is
`{ path, relationship, selectors, elements }`; a canvas integration may draw
those elements without coupling the options inventory to canvas state.

## Deleting a layer

Select an element and press **Delete** or **Backspace** — the same pair Figma
takes, from the canvas or from a row in the Layers panel. Each row also carries
a trash button beside its lock and eye, for when the keyboard is not where your
hand is. A multi-select deletes as one step, and selecting a parent along with
one of its own children deletes the parent once rather than cutting two
overlapping holes in one file.

**Cmd+Z puts it back**, between the same two siblings it came from, and takes
the pending source write back with it. A delete that is undone and never redone
leaves nothing for "Apply to code" to write.

Locked layers are not deleted. The tree can still select one — that is the only
way back out of the lock — so the refusal lives with the delete itself rather
than with the canvas.

The source write is the one edit this package performs itself on both hosts. On
Angular it splices the element out of its template; on React it splices the JSX
element out of the file, as bytes rather than as a reprint, so nothing else in
the file is reformatted. Both take the element's whole line when it had that
line to itself, and both refuse rather than guess:

| Refused | Because |
| --- | --- |
| An element matching two places in the file equally well | The wrong one would disappear, and nothing would say so |
| A component's root element in JSX | `return ;` does not parse — delete the component instead |
| An element inside `{open && …}` or a `.map()` callback | The branch would be left empty; delete the branch |

A refusal is reported by name in the Apply toast, and the change stays on screen
with a line in the Changes tab an agent can act on.

## Where a change ends up

Two surfaces catch an edit, and between them nothing is dropped.

- **"Apply to code"** writes the changes the codemod can spell, into the
  component source it resolved them to.
- **The Changes tab** catches the rest, as a written instruction you hand to an
  agent. A change can land here because the property is one the writer cannot
  express — but also because the *file* could not be found: under React 19 the
  fibre walk can answer with no path at all, and the async resolver can come
  back with a bundler chunk rather than your component.

That second case used to be a hole. The edit was on screen, and no surface in
the editor admitted it existed: it was dropped on its way to the queue, "Apply
to code" stayed disabled, and the Changes tab said there was nothing to hand
over. Now a write that cannot reach source falls back to the tab, carrying the
value it read *before* the element changed, so the instruction says what to
change it from. A change reaching the queue stays out of the tab, so an agent is
never asked to redo what the codemod is about to write.

The tab repaints as the ledger moves, so an edit made while it is open appears
in it. Only while it is the tab being looked at — a hidden pane is read when you
switch to it, which is what keeps both it and the Code view off the hot path of
a drag.

## Handing a change to your coding agent

The **Changes** tab holds everything a session produced — the notes you left and
the edits you made — as one list in the order they happened. Notes and edits
share one system:

- **One numbering.** Item 4 is 4 on its row, on its pin on the canvas, and in
  the brief. Edits get pins too, drawn as squares beside the notes' discs.
- **One undo timeline.** Pinning, rewriting and deleting a note are Cmd+Z steps
  beside every style edit, so Undo always takes back the newest thing you did.
- **One send button.** It writes everything the codemod can spell straight into
  your files first, then hands whatever is left — notes, and edits no commit can
  write — to a coding agent that is already running, with the written half in
  the brief as context. A session that only moved some padding finishes at the
  first stage; the button reads **Apply to code** then, and **Send to agent**
  once something needs the agent.
- **One copy.** **Copy** in the tab and the copy shortcut write the same brief.
  It is not a fallback: the editor cannot see whether an agent is attached, so
  the paste path has to stay a peer.

Which half a change lands in is never the designer's question to answer: every
edit row says whether it is Ready, In your files, or Needs the agent.

### How it works

An MCP server cannot push work to an agent. The protocol's set of
server-to-client messages is a closed list — pings, elicitation, roots, task
bookkeeping, and notifications that a list has gone stale. There is no "here is
a task, go do it". An agent's turn runs when a human types, or while a tool call
it made has not yet returned, so a server's only way into that loop is to be
*inside a tool call that has not returned yet*.

The handoff is therefore not a push. It is a pull that was already parked: the
agent calls a tool that blocks, you click, the tool returns.

So the editor is the MCP **server** and your agent is the client, which reads
backwards until you notice that MCP's roles are about who offers context, not
who has a window.

### Turning it on

The editor serves MCP on its own fixed port — `ports.mcp`, default `5747` —
rather than on the proxy, because `ports.proxy` is `auto` and this URL goes into
an agent's config by hand. It prints the URL at startup:

```
[designlayer] MCP http://127.0.0.1:5747/mcp — point your agent at it
```

Point the agent at it as a **remote** server, not a local one. A local entry
would spawn a second copy of this package with no editor attached to it:

```jsonc
// CloudCode: ~/.config/cloudcode/cloudcode.jsonc
"mcp": {
  "designlayer": { "type": "remote", "url": "http://127.0.0.1:5747/mcp", "enabled": true }
}
```

```bash
# Claude Code
claude mcp add --transport http designlayer http://127.0.0.1:5747/mcp
```

Set `ports.mcp` to `null` to turn the endpoint off. A port already in use is a
warning and nothing more — the editor starts, and Copy still works.

### The loop

Four tools, which together are a workflow rather than a verb:

| Tool | What it does |
|---|---|
| `wait_for_change` | Drains anything already queued, otherwise blocks. Returns the changes with their brief, files and selected element. |
| `list_changes` | The same, without blocking. |
| `get_change` | One change by id. |
| `resolve_change` | Marks it `applied` or `rejected` with a summary. |

Tell the agent to work the loop — wait, apply, resolve, wait again — and
pressing the button becomes the whole interaction.

`resolve_change` is not bookkeeping. A change that stays pending is a change the
next `wait_for_change` hands back, and an agent that never resolves will re-apply
its own finished work until you stop it.

### The 55-second ceiling

`wait_for_change` blocks for at most 55 seconds and then returns
`{"timeout": true}`. That is not an error; it means nobody has clicked yet, and
the reply says so, so a model calls again instead of giving up.

The number is not arbitrary. MCP clients abort a request at 60 seconds by
default, and the escape hatch — progress notifications with
`resetTimeoutOnProgress` — needs an SSE response stream, which this endpoint
deliberately does not open. A timed-out request is worse than it sounds: the
client stops listening and the server is never told, so the block is left
holding the next click. A loop of short waits is indistinguishable from one long
wait and cannot strand a watcher, so that is what this does.

## What it writes, and where

- **Your component source**, only through an explicit edit, and only for files
  that pass both the extension allowlist and a denylist you cannot widen
  (`.env*`, `*.config.*`, `node_modules`, `.git`). If `source.roots` is set,
  files outside those roots are refused as well.
- **`<stateDir>/options.json`** — saved option sets, written atomically.
- **`<stateDir>/requests/`** — one markdown file per handover, carrying the same
  brief the Copy button writes. Written even when an agent is attached over MCP:
  the file is the durable record, the queue push is only the trigger, and the
  two answer different questions a week later.
- **`<stateDir>/endpoint.json`** — the ports actually bound, so tooling can find
  a running instance without guessing. Best-effort: the start screen learns that
  an editor is up over IPC from the child that bound the ports, so a project
  folder that refuses the write still starts.

## Security model

This process edits files in your project, so it is a development tool and
nothing else. Ship it nowhere near production.

- Every route refuses a request that is not loopback, by peer address, `Host`,
  and `Origin`.
- All three servers are forced to bind `127.0.0.1`, overriding the vendored CLI,
  which binds every interface.
- The MCP endpoint applies that same guard, rather than a second copy of it. The
  transport spec requires `Origin` validation against DNS rebinding, and it is
  reachable by anything on the machine that can open a socket — so it shares the
  routes' own `isLocalRequest`, including the part that treats `Origin: null` as
  hostile rather than absent.
- The file allowlist above is the only thing standing between the browser and
  `.env.local`, which lives in the same project root as your components. Keep
  `source.extensions` restrictive.

### What leaves your machine

Nothing, and there is no setting that changes it. The editor opens no connection
to anything but the dev server you pointed it at and loopback. It holds no API
key, sends no telemetry, and never calls a model: handing work over means writing
a brief to `<stateDir>/requests/` and waking a coding agent you are already
running, over MCP on `127.0.0.1`.

That agent is of course free to send your source anywhere it likes — but it is
*your* agent, running under whatever rules you already gave it, and this tool
adds nothing to that.

It was not always true. An earlier version could send the selected element and
its whole source file to the Anthropic API when `ANTHROPIC_API_KEY` was set, and
the `agent.transport` setting existed to turn that off. Both are gone with the
"Ask AI" panel that was the only way to reach them, so the answer no longer
depends on your environment.

If your employer restricts which AI services may see your source code — many do,
and the rule usually covers anything you write at work — the question to ask is
about the coding agent on the other end of the handoff, not about this editor.

## Performance boundary

The host application never imports this package. A normal development server
and every production build therefore ship zero editor JavaScript; the editor
bundle is injected only by the separate proxy started with `designlayer`.

While that proxy is active, selection geometry is tracked only while an element
is selected, hovered, or highlighted. The shared animation-frame loop stops
when idle, batches layout reads before overlay writes, and reads computed styles
only while Option/Alt measurement is active.

## Testing

```sh
npm test                                        # no host needed
DESIGNLAYER_HOST=../host-app npm test           # plus the host-pinned suites
npm run test:standalone-next                    # needs a host
```

Most of the suite runs against this repository alone. Four suites —
`token-cases`, `responsive-cases`, `picker-cases`, `icon-set-cases` — pin a real
app's own catalog, breakpoints and icon set, deliberately: they are the net that
catches a change to the tool silently changing what a real app sees. They find
that app through `test/host.mjs`, which is the single owner of "where is the
host": `DESIGNLAYER_HOST` if set, otherwise a `host-app` checkout beside
this one. With neither present they print a skip and exit 0, so a bare clone is
green and a skip never reads as a pass.

The package suite covers its npm-bin entry point, options, selection, shell,
hydration readiness, and offline source translation. `test/resize-cases.mjs`
drives the panel seams through jsdom — a supplied viewport rather than a real
one, because a bounds check against a window that is always zero wide cannot
tell a clamp from a no-op — and pins the parts the library does not own: the
group it needs in order to work, the seam as a `role="separator"`, the app's
inset following a live drag, and the rule that a panel gives room up when the
window shrinks and takes exactly that room back when it grows. It also covers the paths
this tool is judged on and cannot watch itself: the start screen and its folder
dialog, bundle freshness, whole drag gestures driven through jsdom — pinning the
value each one records as its "from" — and the two ways a write can fail to
reach source, which must land in the Changes tab rather than vanish.
`test/delete-cases.mjs` runs the delete path end to end on both hosts, against
real files in a temp project: the key, the undo that restores an element between
its original siblings, and every refusal the two source writers are allowed to
make — because a refusal that quietly becomes a write deletes the wrong element.
`test/host-agnostic-cases.mjs` is the decoupling proof: three synthetic hosts
under `test/fixtures` — a Tailwind v4 app whose `@theme` namespaces are spelled
differently from this repo's, a Tailwind v3 app with a classic config scale and
no motion or text tokens at all, and an adapter-only app with no manifest — each
resolving a catalog, aliases, and inspector rows. It never reads the repository
the package sits in. The standalone test packs
the package, installs it into a throwaway config-free Next app, and verifies the
isolated proxy and source-write path in both the App and Pages Routers. To
exercise the live write path against the current app, run
`node test/ui-change-cases.mjs` while the editor is running. Its live levels use
throwaway fixtures and restore the one real component they touch byte for byte.
Ports and the API prefix come from the launcher's `endpoint.json`.

## Layout

```
cli.mjs                     argv contract, entry point, and the app supervisor
config.mjs                  defaults, discovery, resolution, browser prelude, host detection
build.mjs                   bundles src/ into dist/designlayer.js and dist/tokens.mjs
runtime/start-screen.mjs    the loopback server behind the no-arguments flow
runtime/start-screen-page.mjs   its document, and the script that drives it
runtime/start-screen-style.mjs  its stylesheet, built from the editor's tokens
runtime/local-apps.mjs      port scan, project inspection, folder listing
runtime/launcher.mjs        vendor resolution, monkey-patches, route mount
runtime/vendor-patch.mjs    the 23 splices against react-rewrite-cli 0.1.1
tools/build-icons.mjs       vendors src/core/icons.ts from Reicon; owns the name mapping
server/angular-source.mjs   Angular component index, template scan, template writer
server/react-source.mjs     JSX element removal, the one React write not in the vendor
server/element-match.mjs    descriptor scoring and byte-range splicing, shared by both
server/design-system-config.mjs token manifest and authored-alias normalization
server/icon-set.mjs         the host icon set, read once and served on request
server/routes.mjs           loopback-guarded HTTP routes
server/options-store.mjs    saved option sets
server/control-defaults.mjs configured literal default reader/writer
server/agent.mjs            AI edit transport
src/core/angular.ts         the Angular resolver, edit queue and commit
src/core/element-target.ts  how the browser describes an element to a source writer
src/core/removal.ts         the delete queue, one for both hosts
src/shell/resize.ts         the panel rail: motion-panels' core wired to plain DOM
src/                        the editor UI, bundled to an IIFE
test/host.mjs               where this package is, and where a host app is
test/ui-change-cases.mjs    the harness
```

`runtime/` is the only part that knows the vendored CLI exists. Everything the
patches need about your app arrives as resolved config, so replacing the vendor
later is a change confined to those two files.

## Contributing

Contributions are welcome, and a bare clone is green — the four suites that
pin a real app's catalog skip themselves when no host app is on disk, so you
are not expected to supply one. [CONTRIBUTING.md](CONTRIBUTING.md) covers
setup, what the skips mean, the file that owns what, and how a change is
expected to be shaped. Participation is governed by the
[Code of Conduct](CODE_OF_CONDUCT.md).

To report a vulnerability, read [SECURITY.md](SECURITY.md) first — this is a
development tool with write access to your project by design, so it says what
counts as one — and report it privately rather than in an issue.

## License

[MIT](LICENSE) © Haoyang Li

The editor's glyphs are [Reicon](https://reicon.dev) (MIT, © the Reicon
authors), vendored as path data by `tools/build-icons.mjs` rather than imported
— the overlay bundle takes no runtime dependencies. Change which glyph a name
draws by editing the mapping in that script and re-running it; `npm run verify`
fails if its output has gone stale.

Three rules hold that set together, and each is enforced rather than documented
and hoped for:

- **One size ramp: 12, 16, 20, 24, 32.** Call sites name a role from
  `tokens.icon` — `row`, `control`, `launcher`, `display`, `hero` — and
  `IconSize` makes anything off the ramp a compile error. It had drifted to
  seven sizes, including a 13 and a 14 that read as blur rather than as scale.
- **Every glyph inks the same 20 of its 24 grid.** Reicon's own extents vary by
  half again across the set, so the generator measures each glyph and fits its
  viewBox. One window per icon, shared by both weights, so a control's mark
  never changes size when it is pressed.
- **On is filled, off is outline.** Each glyph ships both weights and the
  stylesheet picks, reading `aria-pressed` / `aria-selected` off the control
  itself — so a button's state and its icon cannot disagree.
