/**
 * Libraries: which design systems this project can borrow from, and which of
 * them the rest of the editor is allowed to offer.
 *
 * It is a SECTION on the right panel's Design system tab now, built with the
 * same `section()` every block on the Design tab is built with, so it folds,
 * aligns and spaces exactly like Fill and Typography. Two surfaces were folded
 * into it and one was deleted outright, which is the thing a reader arriving
 * here needs told first:
 *
 *  - the library MANAGER, a dialog opened from the old Assets panel's header,
 *    is this section. Same store, same six calls, same switch;
 *  - the Assets BROWSER — the component grid, the cards, the thumbnails, the
 *    group and library drill-down, the search box, the details popover, "Insert
 *    instance" and drag-to-insert — is gone, deliberately and by request. It is
 *    not hiding behind a fold here and it has not moved somewhere else.
 *
 * **The catalog itself is untouched.** Deleting the browser removed a way of
 * LOOKING at the components an enabled library publishes; it removed nothing
 * from the catalog those components live in. `activeDesignSystem()` still folds
 * every enabled library's tokens into the one catalog the fill picker, the
 * text-style field, the radius field and the icon picker all read, and
 * `libraryComponents()` still feeds the Design tab's instance properties. Turn
 * a library on here and all of that grows its contents on the next repaint;
 * turn it off and they lose them. That is the whole of what this section is
 * for, and it is why the empty state says it in words.
 *
 * ## The two ways in, and why they are not peers
 *
 * A URL is the CTA: a design system published on the web, or a Storybook, is
 * one paste and the server does the rest. A file in this project is a fold
 * underneath it, because it is the rarer act and its flow is two controls wide
 * — a scan of the project, and a path box for the file the scan missed. It is
 * kept because the URL box genuinely cannot do it: a designer's own
 * `tokens.css` has no address, and dropping the fold would take the only route
 * to it with it.
 *
 * Nothing in this file parses a design system. It renders `Library` records and
 * calls the store, which is what keeps the surface swappable without touching
 * the parsing at either end.
 */

import { clear, el } from "../core/dom"
import { focusControl } from "../core/focus"
import { icon } from "../core/icons"
import { tokens } from "../core/tokens"
import { section } from "../panels/inspector/field"
import { copyLibrarySnippet } from "./snippet"
import {
  addLibrary,
  discoverLibraries,
  forgetLibrarySignIn,
  libraryList,
  LibraryAuthError,
  librarySignIns,
  loadLibraries,
  removeLibrary,
  setLibraryEnabled,
  signInToLibrary,
  subscribeToLibraries,
} from "./store"
import type {
  Library,
  LibraryCandidate,
  LibraryChallenge,
  LibraryCredentialScheme,
  LibrarySignIn,
  LibrarySource,
  LibrarySourceKind,
} from "./types"
import type { EditorContext } from "../core/context"

/**
 * A library as this section reads it: the wire record, plus the two fields the
 * URL route adds to it.
 *
 * Declared here rather than added to `Library` in `libraries/types.ts` for the
 * reason the old assets browser gave about the same kind of widening: this lane
 * does not own the file the URL route is landing in, and both fields are
 * optional, so a `Library` is assignable to this exactly as it stands and the
 * two converge without a coordinated edit. Until the server sends them the
 * fields are simply absent at run time and the row degrades the way it should —
 * no `detail` means the counts write the summary, and no `url` means the source
 * line is the path it always was.
 */
interface InstalledLibrary extends Library {
  /**
   * The server's own one-line description of a library it fetched over HTTP.
   *
   * Preferred over the counts for a URL library because the counts are a poor
   * description of one: a Storybook's worth is its components and its stories,
   * and the server is the only thing on either side that has read the index.
   */
  detail?: string
  source: LibrarySource & { url?: string }
}

/**
 * What an add is, as this section builds one: a path inside the project, or a
 * link on the internet.
 *
 * There used to be a cast beside this — `addLibrary` was narrowed here while
 * the lane that taught the store about `{ url }` was still in flight, with a
 * note saying the cast could go once the widening landed. It has landed, so it
 * has gone. The interface stays, because the section needs a NAME for an add it
 * is holding on to: a refused one is replayed after a sign-in, and "the input
 * that was refused" has to be storable in a variable.
 */
interface AddLibraryInput {
  path?: string
  kind?: LibrarySourceKind
  url?: string
}

/**
 * The summary line on a row, and the whole of what a library claims to bring.
 *
 * Derived here rather than taken off the wire because `Library` carries counts
 * and not prose — the server's own `describeLibrary` writes the one-liner for a
 * CANDIDATE, where the file has not been added yet and there is no `counts` to
 * read. Two places that both turn numbers into a sentence is the kind of drift
 * that ends with a row and the box that added it disagreeing about how many
 * colors a file has, so the installed side counts from the record it is drawing
 * rather than from a string somebody else wrote.
 *
 * Singular and plural are spelled out per group because three of them do not
 * take an `s` — radii, and the two groups whose names are already phrases.
 */
const COUNT_GROUPS: ReadonlyArray<{ key: keyof Library["counts"]; one: string; many: string }> = [
  { key: "colors", one: "color", many: "colors" },
  { key: "spacing", one: "spacing step", many: "spacing steps" },
  { key: "radii", one: "radius", many: "radii" },
  { key: "textStyles", one: "text style", many: "text styles" },
  { key: "effects", one: "effect", many: "effects" },
  { key: "icons", one: "icon size", many: "icon sizes" },
  { key: "motion", one: "motion token", many: "motion tokens" },
  { key: "components", one: "component", many: "components" },
  { key: "iconDrawings", one: "icon", many: "icons" },
]

/**
 * Three groups on the line, and the rest is not shown anywhere.
 *
 * The same cap the server's candidate line uses, and the reason is the width it
 * has to survive: at 260px a fourth clause wraps to a third line, and a row
 * whose summary is taller than its own name has stopped summarising. What the
 * cap hides used to be one fold away, in a per-library contents list; that list
 * was part of the browsing UI and went with it. The counts it held are not lost
 * — every one of them is a token that is now IN the pickers on the Design tab,
 * which is a better place to read them than a list in a panel.
 */
const SUMMARY_GROUPS = 3

/** The four things `detectLibraryKind` knows how to read, said in one breath. */
const RECOGNISED =
  "A design-system manifest, a DTCG or Style Dictionary token file, an icon " +
  "drawing set, or a stylesheet declaring custom properties."

/**
 * The empty state, and it is the only place the editor says what a library IS.
 *
 * Not "no libraries yet" on its own: an empty list is already visible, and a
 * sentence that restates it teaches nothing. What a reader standing here does
 * not know is what pressing Add would get them, so the copy is about the
 * CONSEQUENCE — the pickers on the Design tab grow, alongside this project's
 * own tokens.
 *
 * It carries no second Add button, which the manager dialog's version did. That
 * button existed because the add flow was folded shut behind a header control;
 * here the URL box is in the same section, unfolded, two rows below this
 * sentence, and a duplicate control for it would be two ways to press one
 * thing in the space of half a panel.
 */
const EMPTY =
  "No libraries yet. Add one and turn it on, and its colors, spacing, text " +
  "styles, effects and components appear in the pickers on the Design tab " +
  "alongside this project's own."

function countsLine(counts: Library["counts"], limit = COUNT_GROUPS.length): string {
  const parts: string[] = []
  for (const group of COUNT_GROUPS) {
    const value = counts[group.key]
    if (!value) continue
    parts.push(`${value} ${value === 1 ? group.one : group.many}`)
    if (parts.length === limit) break
  }
  return parts.join(" · ")
}

/** The kind of file a library was read out of, as a badge. */
function kindBadge(kind: string): HTMLElement {
  return el("span", { class: "de-lib-kind", title: `Read as a ${kind} file` }, [kind])
}

/** A thrown `Error`'s own words, which are the server's, or a stated fallback. */
function messageOf(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message.trim() : ""
  return message || fallback
}

/* ---------- signing in to a walled origin ---------- */

/**
 * What to call each wall, on the line that heads the sign-in block.
 *
 * Each label names the MECHANISM the server read off the refusal, because that
 * is the only thing either side can honestly know: `classifyWall` reads a
 * status, a `WWW-Authenticate` scheme and the shape of a redirect, and never a
 * hostname. A label naming somebody's identity product would be a guess, and a
 * wrong guess here is worse than a vague one — it sends a designer to ask a
 * question about a system their site does not use.
 *
 * Kept at all, rather than collapsed into one "this site needs a sign-in",
 * because the distinction is the only real diagnosis in the flow: it is what
 * tells a designer whether to go looking for a token, a password manager entry
 * or a browser session, and it is why the five are also what the default
 * credential below is chosen from.
 */
const WALL_LABELS: Record<LibraryChallenge["kind"], string> = {
  oauth: "OAuth sign-in",
  basic: "HTTP Basic auth",
  bearer: "Bearer token",
  redirect: "Sign-in redirect",
  forbidden: "Access refused",
}

/**
 * The facts a refusal named that a designer has nowhere else to read.
 *
 * Two, and they are mutually exclusive in practice: `audience` comes off an
 * OAuth redirect and `realm` off a 401, so a wall produces at most one of them.
 * They are drawn from one table all the same, because what the block does with
 * either is identical — a label, the value on a plate, a copy button — and two
 * hand-built rows would be two places for that treatment to drift.
 *
 * `copy` is the word `copyLibrarySnippet` puts in its toast, so it reads as a
 * thing rather than as a field name.
 */
const WALL_FACTS: ReadonlyArray<{
  key: "audience" | "realm"
  label: string
  copy: string
}> = [
  { key: "audience", label: "OAuth client id", copy: "OAuth client id" },
  { key: "realm", label: "Realm", copy: "realm" },
]

/**
 * The two credentials, as a person picks them.
 *
 * The placeholder moves with the choice because the two are not the same act:
 * a token is issued by whatever mints tokens for that site, and a cookie is
 * copied out of a browser's dev tools. A single placeholder would have to be
 * vague enough to cover both, and the box would then say nothing at the moment
 * it is being looked at hardest.
 */
const SCHEMES: ReadonlyArray<{
  value: LibraryCredentialScheme
  label: string
  placeholder: string
  title: string
}> = [
  {
    value: "bearer",
    label: "Bearer token",
    placeholder: "Paste the token",
    title: "Sent to the site as an Authorization: Bearer header",
  },
  {
    value: "cookie",
    label: "Cookie",
    placeholder: "Paste the Cookie header",
    title: "Sent to the site as a Cookie header, the way a browser sends it",
  },
]

/** The same two, as one word on a row that is reporting rather than asking. */
const SCHEME_WORDS: Record<LibraryCredentialScheme, string> = {
  bearer: "token",
  cookie: "cookie",
}

/**
 * Which credential to offer first, and it follows the server's own sentence.
 *
 * A token for the three walls that asked for one in so many words — an OAuth
 * redirect, a `WWW-Authenticate: Bearer`, and a 403, where the server's hint
 * says a token with access will get through. A cookie for a plain sign-in
 * redirect, which named no token format at all and is the case a browser
 * session is most likely to be the only answer to. A default that contradicted
 * the hint printed two lines above it would be a trap rather than a
 * convenience, so this table and that one are written to agree.
 *
 * **HTTP Basic falls in with the token.** The wire accepts two credential
 * shapes and neither of them is `Authorization: Basic` — see
 * `LibraryCredentialScheme`, which is closed because the server refuses any
 * word it does not know rather than send a header of the caller's choosing to
 * an arbitrary host. So a Basic wall gets the token box, the server's hint says
 * what to put in it, and `basicNote` below says plainly what this editor will
 * do with it. Nothing here pretends the paste is sent as a Basic header: if the
 * site wants one, the sign-in is verified against the live URL and refused, and
 * a refusal the designer can read beats a claim they cannot check.
 */
function defaultScheme(wall: LibraryChallenge): LibraryCredentialScheme {
  if (wall.kind === "redirect") return "cookie"
  return "bearer"
}

/**
 * The one sentence the server cannot write, for the one wall it cannot satisfy.
 *
 * The server's hint for a Basic wall tells the designer what the SITE asked
 * for. This says what the EDITOR will send, which is the part that decides
 * whether the paste is going to work, and only this side knows it.
 */
const BASIC_NOTE =
  "This editor sends what you paste as an Authorization header. If the site " +
  "refuses it, a session cookie from a browser that can already open it is the " +
  "other way in."

export function librariesSection(editor: EditorContext): { node: HTMLElement; update(): void } {
  /*
   * Everything the section remembers between renders, and it is all view state.
   *
   * None of it belongs in the store: which fold is open and what half-typed
   * path is in the box are facts about this surface, not about the project, and
   * a second surface onto the same libraries would be wrong to inherit them.
   * They live in the closure rather than on a node for the reason `field.ts`
   * keeps its collapse map at module level — the list is rebuilt on every store
   * write, so anything held on a row is lost the first time somebody flips a
   * switch.
   */
  let addOpen = false
  let scanning = false
  let scanned = false
  let candidates: LibraryCandidate[] = []
  let scanError = ""
  let loaded = false

  /*
   * The sign-in flow's own state, and the one thing that is NOT here.
   *
   * There is no credential in this closure and there is not going to be one.
   * The value lives in the input element until the moment it is posted, and the
   * only thing that comes back is a list of origins with no secrets in it — the
   * server is the single place a credential is held, on purpose, and a copy
   * kept here to save a round trip would be a copy in every heap snapshot this
   * page ever takes.
   *
   * `challenge` is the wall currently being answered and `pendingAdd` is the
   * add it refused, held so it can be replayed the moment the wall opens. They
   * move together and are cleared together: a challenge with no add behind it
   * would be a sign-in that completes and then asks the designer to paste the
   * URL they already pasted.
   */
  let challenge: LibraryChallenge | null = null
  let pendingAdd: AddLibraryInput | null = null
  let scheme: LibraryCredentialScheme = "bearer"
  let signInProblem = ""
  let signIns: LibrarySignIn[] = []

  const count = el("span", { class: "de-lib-count" })
  const list = el("div", { class: "de-lib-list" })
  const empty = el("p", { class: "de-lib-empty" }, [EMPTY])

  /* ---------- the CTA ---------- */

  /*
   * The URL field is built ONCE and never rebuilt.
   *
   * It is the control in this section a user types into, and the list beside it
   * repaints on every store notification — including the one caused by the add
   * this field just issued. Rebuilding it would take the caret out of a
   * half-typed URL the moment an unrelated switch fired, which is invariant 5
   * in `options/inventory-panel.ts` written out for one input. The same applies
   * to the path box in the fold below, and for the same reason.
   */
  const urlField = el("input", {
    class: "de-lib-field",
    type: "url",
    placeholder: "https://…",
    // A design system OR a Storybook, because those are two different things a
    // designer has a link to and the field takes either. Naming only one of
    // them would make the other look unsupported.
    "aria-label": "Link to a design system or Storybook",
    "data-de-lib": "url",
  }) as HTMLInputElement

  const urlAdd = el(
    "button",
    {
      class: "de-button de-button--primary",
      type: "button",
      "data-de-lib": "url-add",
      onclick: () => void addUrl(),
    },
    ["Add"]
  ) as HTMLButtonElement

  urlField.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return
    event.preventDefault()
    void addUrl()
  })

  /* ---------- the sign-in block ---------- */

  /*
   * Built ONCE, hidden until a wall refuses an add, and never rebuilt — the
   * same rule the URL field above it follows, for a worse failure.
   *
   * What a designer puts in this box is an 800-character token they fetched
   * from somewhere else, and the list two rows up repaints on every store
   * notification. A block rebuilt on one of those beats would take the paste
   * with it, and the designer would have to go back to the terminal for a
   * string they had already produced. So the nodes are made here and the only
   * thing that moves afterwards is their text.
   *
   * It lives inside the CTA rather than beside it because it belongs to the URL
   * row: the wall is the answer to the link in the field directly above, and a
   * block further down the section would be a second subject between them.
   */
  const wallTitle = el("span", { class: "de-lib-signin-title" })
  const wallHint = el("p", { class: "de-lib-hint" })

  /*
   * One of the two facts the refusal named, on a plate, with a copy button.
   *
   * Built here — once, like everything else in this block — and shown only when
   * the wall in hand carries a value for it. An absent field draws nothing
   * rather than an empty plate, because a labelled box with nothing in it reads
   * as a value that failed to load.
   *
   * The copy button is the point of the row. An OAuth client id is around
   * seventy characters of digits, a dash and a domain, and a designer retyping
   * one gets a character wrong and reads the refusal that follows as "my token
   * is bad" rather than "I mistyped the audience". `copyLibrarySnippet` is
   * reused rather than reimplemented because its one subtlety is invisible in a
   * copy: the clipboard write is issued synchronously inside the click task, and
   * an `await` in front of it passes every test that awaits before asserting and
   * fails on every real click.
   */
  function factRow(fact: (typeof WALL_FACTS)[number]): {
    row: HTMLElement
    value: HTMLElement
  } {
    const value = el("code", {
      class: "de-lib-fact-value",
      "data-de-lib": "signin-fact-value",
      "data-de-lib-id": fact.key,
    })
    const copy = el(
      "button",
      {
        class: "de-mini",
        type: "button",
        title: `Copy the ${fact.copy}`,
        "aria-label": `Copy the ${fact.copy}`,
        "data-de-lib": "signin-copy",
        "data-de-lib-id": fact.key,
        onclick: () => copyLibrarySnippet(editor, value.textContent ?? "", fact.copy),
      },
      // `icon.control` because every `.de-mini` in this section carries one at
      // that size — the remove button on a library row is the same 18px box.
      [icon("Copy", tokens.icon.control)]
    )
    const row = el(
      "div",
      { class: "de-lib-fact", "data-de-lib": "signin-fact", "data-de-lib-id": fact.key },
      [
        el("span", { class: "de-lib-fact-label" }, [fact.label]),
        el("div", { class: "de-lib-fact-row" }, [value, copy]),
      ]
    )
    row.hidden = true
    return { row, value }
  }

  const facts = WALL_FACTS.map((fact) => ({ fact, ...factRow(fact) }))

  const schemeButtons = SCHEMES.map(
    (option) =>
      el(
        "button",
        {
          class: "de-segment",
          type: "button",
          title: option.title,
          "aria-pressed": "false",
          "data-de-lib": "signin-scheme",
          "data-de-lib-id": option.value,
          onclick: () => setScheme(option.value),
        },
        [option.label]
      ) as HTMLButtonElement
  )

  const schemeRow = el(
    "div",
    { class: "de-segmented", role: "group", "aria-label": "What kind of credential this is" },
    schemeButtons
  )

  /*
   * A password field, and it is not optional politeness.
   *
   * A designer pastes this with a colleague at their shoulder, on a call they
   * are sharing a screen on, or into a panel that is on screen while something
   * is recording. A bearer token rendered as plain text in a 260px column is a
   * credential that leaves the building in somebody's video, and it does not
   * expire when the meeting ends. The reveal toggle beside it is what makes
   * that survivable: masked is the default, and seeing it is a thing you ask
   * for once you have looked at the room.
   */
  const credentialField = el("input", {
    class: "de-lib-field",
    type: "password",
    autocomplete: "off",
    spellcheck: "false",
    "aria-label": "The credential for this site",
    "data-de-lib": "signin-value",
  }) as HTMLInputElement

  const reveal = el("button", {
    class: "de-mini",
    type: "button",
    "aria-pressed": "false",
    "data-de-lib": "signin-reveal",
    onclick: () => setRevealed(reveal.getAttribute("aria-pressed") !== "true"),
  }) as HTMLButtonElement

  /*
   * The refusal, on the surface rather than in a toast.
   *
   * A toast is gone in four seconds and this sentence is the whole of what
   * separates "this token has expired" from "this token is for another site" —
   * a designer reads it, looks back at the box the token is still sitting in,
   * and fixes one of the two. It is `role="alert"` because the press that
   * produced it moved no focus, so nothing else would announce it.
   */
  const problemLine = el("p", {
    class: "de-lib-hint de-lib-error",
    role: "alert",
    "data-de-lib": "signin-error",
  })
  problemLine.hidden = true

  const signInSubmit = el(
    "button",
    {
      class: "de-button de-button--primary",
      type: "button",
      "data-de-lib": "signin-submit",
      onclick: () => void submitSignIn(),
    },
    ["Sign in and add"]
  ) as HTMLButtonElement

  const signInDismiss = el(
    "button",
    {
      class: "de-lib-dismiss",
      type: "button",
      "data-de-lib": "signin-dismiss",
      onclick: () => closeSignIn(),
    },
    ["Not now"]
  )

  credentialField.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return
    event.preventDefault()
    void submitSignIn()
  })

  const signInBlock = el("div", { class: "de-lib-signin", role: "group", "data-de-lib": "signin" }, [
    wallTitle,
    wallHint,
    ...facts.map((entry) => entry.row),
    schemeRow,
    el("div", { class: "de-lib-signin-row" }, [credentialField, reveal]),
    problemLine,
    el("div", { class: "de-lib-signin-actions" }, [signInDismiss, signInSubmit]),
  ])
  signInBlock.hidden = true

  const cta = el("div", { class: "de-lib-cta" }, [
    el("span", { class: "de-lib-cta-label" }, ["Link to a design system or Storybook"]),
    el("div", { class: "de-lib-cta-row" }, [urlField, urlAdd]),
    signInBlock,
  ])

  /* ---------- what this editor is signed in to ---------- */

  const signInRows = el("div", { class: "de-lib-signed-rows" })

  /*
   * Hidden when there is nothing in it, rather than drawn with an empty state.
   *
   * "Signed in to nothing" is furniture: it takes a row and a half of a 260px
   * column to report the case that is true in almost every session, and it
   * teaches nothing, because a designer who has never met a walled library has
   * no use for the concept. The block appears the first time it has something
   * to say and disappears again when the last credential is forgotten.
   */
  const signedBlock = el("div", { class: "de-lib-signed", "data-de-lib": "signed" }, [
    el("span", { class: "de-lib-cta-label" }, ["Signed in to"]),
    signInRows,
  ])
  signedBlock.hidden = true

  /* ---------- the fold: a file in this project ---------- */

  const status = el("span", { class: "de-lib-status", "aria-live": "polite" })
  const candidateList = el("div", { class: "de-lib-candidates" })

  const manualPath = el("input", {
    class: "de-lib-field",
    type: "text",
    placeholder: "src/styles/tokens.css",
    "aria-label": "Path to a design-system file, relative to the project root",
    "data-de-lib": "manual-path",
  }) as HTMLInputElement

  const manualAdd = el(
    "button",
    {
      class: "de-button",
      type: "button",
      "data-de-lib": "manual-add",
      onclick: () => void addManual(),
    },
    ["Add"]
  ) as HTMLButtonElement

  manualPath.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return
    event.preventDefault()
    void addManual()
  })

  const addPanel = el("div", { class: "de-lib-panel", id: "de-lib-local" }, [
    status,
    candidateList,
    el("div", { class: "de-lib-manual" }, [
      el("span", { class: "de-lib-manual-label" }, ["Or add a file by path"]),
      el("div", { class: "de-lib-manual-row" }, [manualPath, manualAdd]),
    ]),
  ])
  addPanel.hidden = true

  /*
   * Folded shut by default, and quiet on purpose.
   *
   * Adding a library at all is a once-a-project act and adding one from a local
   * FILE is the rarer half of it, so the control that opens it takes the same
   * treatment the options browser gives its "why can't I…" folds rather than
   * the filled accent above it. The twisty is the part that says these words are
   * a fold and not a link out of the panel.
   */
  const addToggle = el(
    "button",
    {
      class: "de-lib-expand",
      type: "button",
      "aria-expanded": "false",
      "aria-controls": "de-lib-local",
      "data-de-lib": "add-toggle",
      onclick: () => setAddOpen(addToggle.getAttribute("aria-expanded") !== "true"),
    },
    [
      el("span", { class: "de-lib-twisty", "aria-hidden": "true" }, [
        icon("ChevronRight", tokens.icon.row),
      ]),
      "Add a file from this project",
    ]
  )

  const body = el("div", { class: "de-lib" }, [
    list,
    empty,
    cta,
    // Under the CTA, because a sign-in is a fact about the box above it: the
    // credentials listed here are the reason a link that used to be refused now
    // lands. Above the local-file fold, because nothing in this project has an
    // origin and nothing in that fold can ever be walled.
    signedBlock,
    el("div", { class: "de-lib-local" }, [addToggle, addPanel]),
  ])

  const node = section("Libraries", body, count)

  /* ---------- the add flow ---------- */

  function setAddOpen(open: boolean): void {
    addOpen = open
    addPanel.hidden = !open
    addToggle.setAttribute("aria-expanded", String(open))
    // Scanned once per session, not once per open. The walk reads up to four
    // thousand files, and re-running it because somebody folded the panel shut
    // and open again would spend that on an answer nothing has changed.
    if (open && !scanned && !scanning) void scan()
    else if (open) renderCandidates()
  }

  async function scan(): Promise<void> {
    scanning = true
    scanError = ""
    renderCandidates()
    try {
      candidates = await discoverLibraries(editor.apiBase)
      scanned = true
    } catch {
      // Said on the surface as well as in a toast: a toast is gone in seconds
      // and this fold is then an empty list claiming the project has nothing in
      // it, which is a different and much worse statement than "the scan
      // failed". The path box below is still the way in either way.
      scanError = "Could not scan this project for design-system files."
      editor.toast(scanError, "error")
    } finally {
      scanning = false
      renderCandidates()
    }
  }

  /**
   * The one add path, for all three ways in.
   *
   * Reports whether it landed, because the callers want different things from
   * the answer: a candidate row is about to be rebuilt by `render()` with its
   * button reading "Added", so it needs nothing back, while the two boxes are
   * built once and live forever and have to clear their own field and stand
   * their own button back up.
   */
  async function addFrom(
    input: AddLibraryInput,
    button: HTMLButtonElement,
    fallback: string
  ): Promise<boolean> {
    button.disabled = true
    try {
      const library = await addLibrary(editor.apiBase, input)
      // Marked locally rather than by rescanning: the walk that produced this
      // list costs thousands of stats, and the only thing about it that just
      // became untrue is one row's `installed`.
      for (const candidate of candidates) {
        if (input.path && candidate.path === input.path) candidate.installed = true
      }
      editor.toast(`Added ${library.name}`)
      // The Design tab is built from the merged catalog, and it does not
      // subscribe to this store — `refresh()` is how the tokens this library
      // just contributed reach the fill picker without a reselection.
      editor.refresh()
      render()
      return true
    } catch (error) {
      button.disabled = false
      /*
       * A wall is the one refusal that is not a mistake, so it does not go out
       * as a toast.
       *
       * Every other error here is about what the designer typed and is fixed by
       * typing something else, which is what a toast over the box is for. This
       * one is about who the SERVER is signed in as, the sentence alone cannot
       * be acted on, and the way out is four controls long — so it opens the
       * block under the field instead, where it stays put while the designer
       * goes and fetches a token.
       */
      if (error instanceof LibraryAuthError) {
        openSignIn(error.auth, input)
        return false
      }
      // The server's own sentence, which `failure()` in `store.ts` has already
      // unwrapped out of the response body: every error this route produces is
      // about the thing the user just typed — the link does not resolve, it is
      // not a design system, there are already twenty — and those sentences are
      // the entire help available at the moment of the mistake.
      editor.toast(messageOf(error, fallback), "error")
      return false
    }
  }

  /**
   * The box is cleared only if it still holds the link that just landed.
   *
   * Unconditional before, and it could be: the value was read one statement
   * earlier. It cannot be now — a refused add opens the sign-in block, the
   * designer spends a minute in a terminal, and the add is replayed for them
   * afterwards. Anything they typed into the URL box in between is theirs, and
   * blanking it because an older add finally succeeded would be the field
   * eating a paste by a slower route than a rebuild.
   */
  function clearUrlField(input: AddLibraryInput): void {
    if (input.url && urlField.value.trim() === input.url) urlField.value = ""
    urlAdd.disabled = false
  }

  async function addUrl(): Promise<void> {
    const url = urlField.value.trim()
    if (!url) {
      editor.toast("Paste a link first", "error")
      urlField.focus()
      return
    }
    // Cleared rather than left for a second press: adding it again is a no-op
    // the store answers idempotently, but a box still holding a link that is
    // now a row above it reads as unfinished.
    if (await addFrom({ url }, urlAdd, "Could not read that link")) clearUrlField({ url })
  }

  async function addManual(): Promise<void> {
    const path = manualPath.value.trim()
    if (!path) {
      editor.toast("Type a project-relative path first", "error")
      manualPath.focus()
      return
    }
    // No `kind`: the server detects it, and an undetectable file comes back as
    // a 400 naming the four it looks for, which is a better error than any
    // guess this section could make from a file extension.
    const added = await addFrom({ path }, manualAdd, `Could not add ${path}`)
    if (!added) return
    manualPath.value = ""
    manualAdd.disabled = false
  }

  /* ---------- the sign-in flow ---------- */

  function setScheme(next: LibraryCredentialScheme): void {
    scheme = next
    SCHEMES.forEach((option, index) => {
      schemeButtons[index].setAttribute("aria-pressed", String(option.value === next))
      if (option.value === next) credentialField.placeholder = option.placeholder
    })
  }

  function setRevealed(shown: boolean): void {
    credentialField.type = shown ? "text" : "password"
    reveal.setAttribute("aria-pressed", String(shown))
    // The label says what pressing it will DO, not what the field currently is:
    // a toggle whose name reports its own state is a control a screen reader
    // user has to press to find out what it was called.
    const label = shown ? "Hide the credential" : "Show the credential"
    reveal.setAttribute("title", label)
    reveal.setAttribute("aria-label", label)
    clear(reveal)
    reveal.append(icon(shown ? "EyeOff" : "Eye", tokens.icon.control))
  }

  /**
   * The block's words, recomputed from the challenge and nothing else.
   *
   * Deliberately touches no control the designer has set: not the value in the
   * box, not which scheme is chosen, not whether the value is revealed. Those
   * three are their input and this function runs whenever the block's SUBJECT
   * changes — a repaint that reset them would be the rebuild this whole block
   * was built once to avoid, arriving by a different route.
   */
  function paintSignIn(): void {
    signInBlock.hidden = challenge === null
    problemLine.textContent = signInProblem
    problemLine.hidden = !signInProblem
    if (!challenge) return

    /*
     * The mechanism and the site, joined by a separator rather than by a verb.
     *
     * The five labels are noun phrases of three different grammatical shapes —
     * "Access refused" is a past participle, "Bearer token" is a thing, "OAuth
     * sign-in" is an event — and no one sentence frame reads correctly around
     * all of them. The separator is the same one the counts line uses, so a
     * reader of this panel has already met it, and the sentence a designer
     * needs is the server's hint directly below.
     */
    const where = challenge.origin || challenge.url
    const title = `${WALL_LABELS[challenge.kind]} · ${where}`
    wallTitle.textContent = title
    signInBlock.setAttribute("aria-label", title)

    /*
     * The server's own hint, plus the sentences this side is the only one that
     * can write.
     *
     * A wall over an origin the panel is already listing as signed in is the
     * confusing case in the whole feature: the list below says the editor has a
     * credential and the block above says the site refused. Both are true — the
     * credential expired — and saying so is what stops a designer hunting for a
     * fault in the library instead of pasting a fresh token.
     *
     * The Basic case is the other one, and it is a fact about this editor
     * rather than about the site: see `BASIC_NOTE`.
     */
    const stale = signIns.some((entry) => entry.origin === challenge?.origin)
    const said = [
      challenge.hint,
      challenge.kind === "basic" ? BASIC_NOTE : "",
      stale
        ? "The credential this editor already holds for that origin no longer opens it, so " +
          "signing in again replaces it."
        : "",
    ].filter(Boolean)
    wallHint.textContent = said.join(" ")

    // Each fact appears only if this wall named it — an OAuth redirect carries
    // an audience and a 401 carries a realm, so at most one row is ever drawn.
    for (const entry of facts) {
      const value = challenge[entry.fact.key]
      entry.value.textContent = value
      entry.row.hidden = !value
    }
  }

  /**
   * A wall refused an add: show it, and remember the add so it can be replayed.
   *
   * The box is emptied only when the WALL changes. Two refusals for the same
   * origin in a row is the ordinary shape of getting a long token slightly
   * wrong, and the half-pasted value is the thing being corrected — see
   * `submitSignIn`, which keeps it for exactly the same reason.
   */
  function openSignIn(wall: LibraryChallenge, input: AddLibraryInput): void {
    const moved = challenge?.origin !== wall.origin
    challenge = wall
    pendingAdd = input
    signInProblem = ""
    if (moved) {
      credentialField.value = ""
      setRevealed(false)
      setScheme(defaultScheme(wall))
    }
    paintSignIn()
    focusControl(credentialField, { preventScroll: true })
  }

  function closeSignIn(): void {
    challenge = null
    pendingAdd = null
    signInProblem = ""
    // The value goes with the block. A token left in a hidden input is a secret
    // in the DOM of a page that will be open for hours, held for a wall nobody
    // is answering any more.
    credentialField.value = ""
    setRevealed(false)
    paintSignIn()
  }

  /**
   * Post the credential, and on a 200 replay the add it was refused for.
   *
   * The 200 is the whole of the evidence this surface has, and it is enough:
   * the route re-fetches the URL with the credential attached and refuses to
   * store one that does not open the wall, so a resolved promise here means the
   * site actually answered. Nothing below marks a sign-in optimistically, and
   * nothing marks one from a request this side merely sent.
   *
   * The replay is what makes the flow one act rather than two. The designer
   * pasted a link, was asked for a credential, and gave one; asking them to
   * find the link again afterwards would be the editor forgetting the errand it
   * interrupted them for.
   */
  async function submitSignIn(): Promise<void> {
    if (!challenge) return
    const value = credentialField.value.trim()
    if (!value) {
      signInProblem = "Paste the credential first."
      paintSignIn()
      focusControl(credentialField, { preventScroll: true })
      return
    }

    // The URL the add was refused for, because that is what the server probes.
    // The origin's front page can be public while the page under it is not.
    const target = challenge.url || pendingAdd?.url || ""
    signInSubmit.disabled = true
    try {
      const record = await signInToLibrary(editor.apiBase, { url: target, scheme, value })
      adoptSignIn(record)
      editor.toast(`Signed in to ${record.origin}`)
      const replay = pendingAdd
      challenge = null
      pendingAdd = null
      signInProblem = ""
      credentialField.value = ""
      setRevealed(false)
      paintSignIn()
      if (replay && (await addFrom(replay, urlAdd, "Could not read that link"))) {
        clearUrlField(replay)
      }
    } catch (error) {
      /*
       * The field KEEPS what is in it, and this is the whole reason the
       * refusal is drawn here rather than thrown away in a toast.
       *
       * A refused token is usually a token that lost its last character to a
       * bad copy, or one that expired eleven minutes ago. Clearing the box
       * sends the designer back to a terminal for a string they already have,
       * and it does it at the exact moment they are most likely to give up on
       * the feature.
       */
      signInProblem = messageOf(error, "That credential was refused")
      paintSignIn()
      focusControl(credentialField, { preventScroll: true })
    } finally {
      signInSubmit.disabled = false
    }
  }

  /* ---------- what this editor is signed in to ---------- */

  /** One origin's row, replacing whatever that origin had before. */
  function adoptSignIn(record: LibrarySignIn): void {
    signIns = [...signIns.filter((held) => held.origin !== record.origin), record]
    renderSignIns()
  }

  function signedRow(entry: LibrarySignIn): HTMLElement {
    // Two sentences, the way the library row's Remove is: "Forget" alone does
    // not say what stops working, and what stops working is every library on
    // that origin, silently, on the next refresh.
    const said =
      `Forget the sign-in for ${entry.origin}. Its libraries stop loading until you sign in again.`
    const forget = el(
      "button",
      {
        class: "de-mini de-mini--danger",
        type: "button",
        title: said,
        "aria-label": said,
        "data-de-lib": "forget",
        "data-de-lib-id": entry.origin,
      },
      [icon("Trash", tokens.icon.control)]
    ) as HTMLButtonElement
    forget.addEventListener("click", () => {
      forget.disabled = true
      void forgetLibrarySignIn(editor.apiBase, entry.origin)
        .then(() => {
          signIns = signIns.filter((held) => held.origin !== entry.origin)
          editor.toast(`Forgot the sign-in for ${entry.origin}`)
          renderSignIns()
        })
        .catch((error: unknown) => {
          forget.disabled = false
          editor.toast(messageOf(error, `Could not forget ${entry.origin}`), "error")
        })
    })

    const when = entry.addedAt > 0 ? new Date(entry.addedAt).toLocaleDateString() : ""
    const word = SCHEME_WORDS[entry.scheme] ?? entry.scheme
    return el(
      "div",
      { class: "de-lib-signed-row", "data-de-lib": "signed-in", "data-de-lib-id": entry.origin },
      [
        el("code", { class: "de-lib-path", title: entry.origin }, [entry.origin]),
        // The kind of credential, and the date in the title rather than on the
        // row: a 260px column has no width for a date, and "which of the two is
        // this" is the fact that explains a refusal.
        el(
          "span",
          { class: "de-lib-kind", title: when ? `A ${word}, saved ${when}` : `A ${word}` },
          [word]
        ),
        forget,
      ]
    )
  }

  /**
   * Rebuilt by its own three events, and NOT by the store's beat.
   *
   * Sign-ins are not libraries: adding, toggling or removing a library changes
   * nothing here, and rebuilding this list on those notifications would drop
   * focus off a Forget button every time a switch was flipped two rows up. The
   * three things that do change it — the first load, a sign-in landing, a
   * credential being forgotten — each call this directly.
   */
  function renderSignIns(): void {
    signedBlock.hidden = signIns.length === 0
    clear(signInRows)
    for (const entry of signIns) signInRows.append(signedRow(entry))
    // The wall block's hint reads this list to say whether it is replacing a
    // credential rather than adding a first one.
    paintSignIn()
  }

  function candidateRow(candidate: LibraryCandidate): HTMLElement {
    const add = el(
      "button",
      {
        class: "de-button",
        type: "button",
        disabled: candidate.installed,
        title: candidate.installed ? "Already installed" : `Add ${candidate.path}`,
        "aria-label": candidate.installed
          ? `${candidate.name} is already added`
          : `Add ${candidate.name}`,
        "data-de-lib": "candidate-add",
      },
      [candidate.installed ? "Added" : "Add"]
    ) as HTMLButtonElement
    add.addEventListener("click", () => {
      void addFrom(
        { path: candidate.path, kind: candidate.kind },
        add,
        `Could not add ${candidate.path}`
      )
    })

    return el("div", { class: "de-lib-candidate", "data-de-lib": "candidate" }, [
      el("div", { class: "de-lib-line" }, [
        el("span", { class: "de-lib-name", title: candidate.name }, [candidate.name]),
        kindBadge(candidate.kind),
      ]),
      el("div", { class: "de-lib-detail" }, [candidate.detail]),
      el("code", { class: "de-lib-path", title: candidate.path }, [candidate.path]),
      el("div", { class: "de-lib-actions" }, [add]),
    ])
  }

  function renderCandidates(): void {
    clear(candidateList)
    status.textContent = scanning ? "Scanning the project…" : ""

    if (scanning) return
    if (scanError) {
      candidateList.append(el("p", { class: "de-lib-hint de-lib-error" }, [scanError]))
      return
    }
    if (!candidates.length) {
      candidateList.append(
        el("p", { class: "de-lib-hint" }, [
          `No design-system files found in this project. ${RECOGNISED} Add one by ` +
            `path below if the scan missed it.`,
        ])
      )
      return
    }
    for (const candidate of candidates) candidateList.append(candidateRow(candidate))
  }

  /* ---------- the installed list ---------- */

  /**
   * The switch, as a toggle BUTTON rather than a checkbox or a `role="switch"`.
   *
   * `aria-pressed` on a plain button is the one shape where the accessible name
   * can stay still while the state moves — "Enable Brand tokens", pressed or
   * not — and a name that does not move is what a screen reader user needs to
   * find the same control twice in a list of eight. The alternative the Changes
   * tab uses, `role="switch"` with `aria-checked`, is right there because its
   * switches sit in a settings block where each one is named by the row it is
   * in; here the name has to carry the library it belongs to.
   *
   * It is drawn as a track and a travelling knob all the same, because what it
   * does — flip a thing on now, not record a preference for later — is what a
   * switch means. The drawing is `de-lib-switch` in `css/libraries.ts`.
   */
  function enableSwitch(library: InstalledLibrary): HTMLElement {
    const toggle = el("button", {
      class: "de-lib-switch",
      type: "button",
      "aria-pressed": String(library.enabled),
      "aria-label": `Enable ${library.name}`,
      title: library.enabled ? `Turn ${library.name} off` : `Turn ${library.name} on`,
      "data-de-lib": "enable",
      "data-de-lib-id": library.id,
    }) as HTMLButtonElement
    toggle.addEventListener("click", () => {
      const next = toggle.getAttribute("aria-pressed") !== "true"
      // Painted before the round trip, and corrected if it fails. A switch that
      // waits for a loopback response reads as a dead control on the one gesture
      // this section exists for.
      toggle.setAttribute("aria-pressed", String(next))
      toggle.disabled = true
      void setLibraryEnabled(editor.apiBase, library.id, next)
        .then(() => {
          editor.refresh()
          render()
        })
        .catch((error: unknown) => {
          toggle.setAttribute("aria-pressed", String(library.enabled))
          toggle.disabled = false
          editor.toast(
            messageOf(error, `Could not turn ${library.name} ${next ? "on" : "off"}`),
            "error"
          )
        })
    })
    return toggle
  }

  /**
   * Where the library came from, on one line that cannot push anything off the
   * row.
   *
   * A URL prints as the URL and a file prints as its path, because those are
   * the two strings the person who added it typed. Both are unbounded, so the
   * line truncates and carries the whole of itself in `title` — a project path
   * nested six folders deep and a Storybook URL with a query on it fail the
   * same way and are fixed by the same rule.
   */
  function sourceLine(library: InstalledLibrary): HTMLElement {
    const where = library.source.url || library.source.path
    return el("code", { class: "de-lib-path", title: where }, [where])
  }

  function libraryRow(library: InstalledLibrary): HTMLElement {
    const remove = el(
      "button",
      {
        class: "de-mini de-mini--danger",
        type: "button",
        // Two sentences, because "Remove" alone leaves the reader guessing
        // whether this touches the file. It does not: the library is a pointer
        // at a path or a link, and removing it takes the pointer.
        title: `Remove ${library.name}. The file on disk is not touched.`,
        "aria-label": `Remove ${library.name}. The file on disk is not touched.`,
        "data-de-lib": "remove",
        "data-de-lib-id": library.id,
      },
      [icon("Trash", tokens.icon.control)]
    ) as HTMLButtonElement
    remove.addEventListener("click", () => {
      remove.disabled = true
      void removeLibrary(editor.apiBase, library.id)
        .then(() => {
          // The path is free to be offered again the moment it is gone.
          for (const candidate of candidates) {
            if (candidate.path === library.source.path) candidate.installed = false
          }
          editor.toast(`Removed ${library.name}`)
          editor.refresh()
          render()
        })
        .catch((error: unknown) => {
          remove.disabled = false
          editor.toast(messageOf(error, `Could not remove ${library.name}`), "error")
        })
    })

    // The server's own sentence wins over the counts when it sent one — see
    // `InstalledLibrary.detail`. A library that failed to parse says that
    // instead of either, because "no tokens in this file yet" over a file the
    // server could not read is a description of the wrong problem.
    const summary = library.detail?.trim() || countsLine(library.counts, SUMMARY_GROUPS)

    return el(
      "div",
      {
        class: library.enabled ? "de-lib-card" : "de-lib-card de-lib-card--off",
        "data-de-lib": "library",
        "data-de-lib-id": library.id,
      },
      [
        el("div", { class: "de-lib-line" }, [
          el("span", { class: "de-lib-name", title: library.name }, [library.name]),
          kindBadge(library.source.kind),
          el("span", { class: "de-lib-actions" }, [enableSwitch(library), remove]),
        ]),
        library.error
          ? el("div", { class: "de-lib-error" }, [library.error])
          : el("div", { class: "de-lib-detail" }, [summary || "No tokens in this file yet"]),
        sourceLine(library),
      ]
    )
  }

  /* ---------- render ---------- */

  /**
   * Which control the keyboard was standing on, so a rebuild can put it back.
   *
   * The list is rebuilt whole on every store notification, and the write that
   * causes the notification is usually a press of one of the buttons IN it — so
   * without this, toggling a library with the keyboard drops focus to `<body>`
   * and there is nothing left to Tab from. The identity is the pair the test
   * hooks already carry, `data-de-lib` plus `data-de-lib-id`, rather than an
   * index path: a remove takes a whole row out, and every path after it would
   * then point at the wrong library. Same problem and same shape as
   * `restoreFocus` in `panels/inspector/index.ts`, on a much smaller surface.
   */
  function focusedControl(): { action: string; id: string } | null {
    const active = document.activeElement
    if (!(active instanceof HTMLElement) || !list.contains(active)) return null
    const action = active.getAttribute("data-de-lib")
    if (!action) return null
    return { action, id: active.getAttribute("data-de-lib-id") ?? "" }
  }

  function restore(memory: { action: string; id: string } | null): void {
    if (!memory) return
    const match = [...list.querySelectorAll<HTMLElement>("[data-de-lib]")].find(
      (candidate) =>
        candidate.getAttribute("data-de-lib") === memory.action &&
        (candidate.getAttribute("data-de-lib-id") ?? "") === memory.id
    )
    focusControl(match, { preventScroll: true })
  }

  function render(): void {
    const memory = focusedControl()
    const libraries: InstalledLibrary[] = libraryList()

    // Silent at zero, the way the Handover heading's count is: the empty state
    // directly below is already saying it, in words, in the same column.
    count.textContent = libraries.length ? String(libraries.length) : ""
    empty.hidden = libraries.length > 0

    clear(list)
    for (const library of libraries) list.append(libraryRow(library))

    if (addOpen) renderCandidates()
    restore(memory)
  }

  function update(): void {
    // The first paint is what asks the server for the list. Doing it at mount
    // time would put a request on every page load for a feature most sessions
    // never open, which is the same call `core/icon-set.ts` makes about its
    // 114KB of path data.
    if (!loaded) {
      loaded = true
      void loadLibraries(editor.apiBase).then(() => render())
      /*
       * The sign-ins ride the same first paint, and a failure here is warned
       * about rather than toasted.
       *
       * An editor with no credentials at all is the ordinary case and answers
       * this with an empty list, which draws nothing — so a request that fails
       * produces exactly what a successful one usually produces, and a toast
       * about it would be an error message for a feature the reader has never
       * used. Same bargain `loadLibraries` strikes one line up.
       */
      void librarySignIns(editor.apiBase)
        .then((origins) => {
          signIns = origins
          renderSignIns()
        })
        .catch((error: unknown) => {
          console.warn("[designlayer] could not list the library sign-ins", error)
        })
    }
    render()
  }

  // The two controls in the sign-in block that carry state in an attribute
  // rather than in their markup, put into their resting position once. The
  // reveal toggle also has no glyph until this runs — its icon is chosen by the
  // state, so there is no sensible one to write into the constructor.
  setRevealed(false)
  setScheme(scheme)

  subscribeToLibraries(() => render())

  return { node, update }
}
