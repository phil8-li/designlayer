#!/usr/bin/env node
/**
 * Bundles the designlayer overlay, and the tokens the start screen needs.
 *
 * The overlay output is concatenated onto the vendored React Rewrite bundle by
 * the package runtime, so it must be a self-contained IIFE with no imports and
 * no globals beyond the bridge it reads from `window`.
 *
 * The tokens output exists because `src/core/tokens.ts` is the only source of
 * colour in this package and the start screen is served by plain ESM, before
 * any bundling happens and with no TypeScript loader in the process. Emitting
 * the same module twice — once into the browser IIFE, once as ESM Node can
 * import — is what lets the front door wear the chrome without a second copy
 * of the values.
 */

import { build } from "esbuild"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.dirname(fileURLToPath(import.meta.url))
const tsconfig = path.join(root, "tsconfig.json")
const watch = process.argv.includes("--watch")
const check = process.argv.includes("--check")

/**
 * React's own dead-code probe, removed — because this bundle is not minified.
 *
 * `react-dom/index.js` ships a `checkDCE()` that hands ITSELF to React
 * DevTools, which reads the function back with `Function.prototype.toString`
 * and looks for the literal `'^_^'`. The string sits in a branch that only runs
 * in development, so a production build is supposed to have dropped it — and
 * with `minify: false` esbuild folds the condition to `if (false)` and leaves
 * the body sitting there in plain sight. The hook then reports, on every single
 * page load and twice:
 *
 *   React is running in production mode, but dead code elimination has not
 *   been applied.
 *
 * It is a false positive — the branch is genuinely unreachable — but the probe
 * cannot tell, and two console errors from a tool whose job is to sit quietly
 * beside somebody else's app is not a cost worth paying. The alternatives are
 * worse: `minifySyntax` clears it by comma-joining and re-declaring the
 * editor's OWN code, and turning `minify` on gives up a readable `dist/` for
 * one vendored string.
 *
 * Exact-once, in the spirit of `runtime/vendor-patch.mjs`: a React release that
 * renames or duplicates the probe should stop the build rather than quietly
 * stop being handled here.
 */
const PROBE = "throw new Error('^_^');"
const dropReactDceProbe = {
  name: "drop-react-dce-probe",
  setup(build) {
    build.onLoad({ filter: /[\\/]node_modules[\\/]react-dom[\\/](index|client)\.js$/ }, (args) => {
      const source = fs.readFileSync(args.path, "utf8")
      const first = source.indexOf(PROBE)
      if (first === -1 || source.indexOf(PROBE, first + PROBE.length) !== -1) {
        throw new Error(`react-dom no longer carries exactly one DCE probe: ${args.path}`)
      }
      return { contents: source.replace(PROBE, ""), loader: "js" }
    })
  },
}

/**
 * Sonner's self-injected stylesheet, kept OUT of the host document.
 *
 * `sonner/dist/index.mjs` opens with an `__insertCSS(…)` call at module scope
 * that appends its whole stylesheet to `document.head` the moment the module is
 * evaluated. That is the right default for an app importing Sonner for itself,
 * and exactly wrong here: this editor is loaded into apps it did not write, and
 * Sonner's selectors are global and unprefixed. The injected sheet includes
 *
 *   html[dir=ltr] { --toast-icon-margin-start: -3px; … }
 *   [data-sonner-toast][data-styled=true] { padding: 16px; … }
 *
 * — so a host app that uses Sonner itself would have its own toasts silently
 * restyled by ours, and every page gets custom properties written onto its
 * `<html>` by a tool that is supposed to be looking, not touching. Confirmed on
 * the running editor before this was added: one leaked `<style>` in the host's
 * head, carrying the full sheet.
 *
 * Nothing is lost by dropping it. `core/css/toast.ts` puts the same stylesheet
 * — from the same package version, checked by `tools/build-sonner-css.mjs` —
 * inside the toaster's shadow root, which is the only place it can reach our
 * toasts and the only place it cannot reach anyone else's.
 *
 * The guard is neutered rather than the call deleted: the needle is one short
 * line instead of a 17KB string argument, and the function keeps its shape for
 * anything that might call it. Exact-once, so a Sonner release that changes
 * this stops the build rather than quietly resuming the leak.
 */
const INSERT_CSS_GUARD = "if (!code || typeof document == 'undefined') return"
const dropSonnerGlobalCss = {
  name: "drop-sonner-global-css",
  setup(build) {
    build.onLoad({ filter: /[\\/]node_modules[\\/]sonner[\\/]dist[\\/]index\.mjs$/ }, (args) => {
      const source = fs.readFileSync(args.path, "utf8")
      const first = source.indexOf(INSERT_CSS_GUARD)
      if (first === -1 || source.indexOf(INSERT_CSS_GUARD, first + INSERT_CSS_GUARD.length) !== -1) {
        throw new Error(`sonner no longer guards __insertCSS exactly once: ${args.path}`)
      }
      return { contents: source.replace(INSERT_CSS_GUARD, "if (true) return"), loader: "js" }
    })
  },
}

const shared = {
  absWorkingDir: root,
  bundle: true,
  sourcemap: false,
  minify: false,
  legalComments: "none",
  logLevel: "info",
  tsconfig,
  /*
   * React reads `process.env.NODE_ENV`, and there is no `process` in a browser.
   *
   * It arrives with Sonner, which draws the editor's toast (`core/toast.ts`) —
   * the one React root in a package that is otherwise plain DOM. Without this
   * the bundle throws `process is not defined` while it is still evaluating,
   * before a line of the editor runs, so this is load-bearing rather than an
   * optimisation. `production` also drops React's dev-only warnings, which are
   * about a tree the person using this editor does not own and cannot act on.
   *
   * Nothing else in `src/` reads `process`. If something ever does, this will
   * quietly rewrite it too, which is the trade a `define` always makes.
   */
  define: { "process.env.NODE_ENV": '"production"' },
}

const TARGETS = [
  {
    label: "designlayer bundle",
    outfile: path.join(root, "dist", "designlayer.js"),
    options: {
      ...shared,
      entryPoints: [path.join(root, "src", "index.ts")],
      format: "iife",
      platform: "browser",
      target: ["chrome110", "safari16"],
      // Only this target pulls React and Sonner in; the token module is data.
      plugins: [dropReactDceProbe, dropSonnerGlobalCss],
    },
  },
  {
    label: "token module",
    outfile: path.join(root, "dist", "tokens.mjs"),
    options: {
      ...shared,
      entryPoints: [path.join(root, "src", "core", "tokens.ts")],
      format: "esm",
      platform: "neutral",
    },
  },
]

async function run() {
  for (const target of TARGETS) {
    const result = await build({
      ...target.options,
      outfile: target.outfile,
      write: !check,
    })

    if (!check) {
      console.log(`Built ${path.relative(process.cwd(), target.outfile)}`)
      continue
    }

    const fresh = Buffer.from(result.outputFiles?.[0]?.contents ?? new Uint8Array())
    if (!fs.existsSync(target.outfile)) {
      console.error(`FAIL ${target.label} is missing — run \`npm run design:build\``)
      process.exit(1)
    }
    // Compiling proves the source is valid; it does not prove `dist/` matches it.
    // The launcher serves whatever is on disk, so a stale bundle means the running
    // editor is older than the reviewed source — and every other check passes.
    const onDisk = fs.readFileSync(target.outfile)
    if (!fresh.equals(onDisk)) {
      console.error(
        `FAIL ${target.label} is stale — dist/ is ${onDisk.length} bytes, ` +
          `src/ compiles to ${fresh.length}. Run \`npm run design:build\`.`
      )
      process.exit(1)
    }
    console.log(`PASS ${target.label} compiles and matches dist/ (${fresh.length} bytes)`)
  }
}

if (watch) {
  const { context } = await import("esbuild")
  for (const target of TARGETS) {
    const ctx = await context({ ...target.options, outfile: target.outfile })
    await ctx.watch()
  }
  console.log("Watching designlayer sources…")
} else {
  await run()
}
