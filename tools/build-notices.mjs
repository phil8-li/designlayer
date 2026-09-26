#!/usr/bin/env node
/**
 * Writes `THIRD_PARTY_NOTICES.md`: every open source project this package
 * uses, and the full license text of each one whose license requires it.
 *
 *   node tools/build-notices.mjs          # rewrite the file
 *   node tools/build-notices.mjs --check  # fail if it is out of date
 *
 * WHAT NEEDS A NOTICE, AND WHAT ONLY GETS A LINE
 *
 * MIT and ISC ask for one thing: the copyright and permission notice travels
 * with every copy of the code. So the test is whether a copy of somebody
 * else's code leaves this repository with it.
 *
 *   - BUNDLED. `dist/designlayer.js` is one IIFE with React, Sonner and Motion
 *     compiled into it, served into the host page. `build.mjs` drops legal
 *     comments to keep `dist/` readable, so this file is where those notices
 *     live. The list is read from esbuild's metafile, not written by hand: a
 *     new import that pulls a package in shows up here on the next run, and
 *     `--check` fails until it does.
 *   - VENDORED. Sonner's stylesheet and Lucide's path data are copied into
 *     `src/` as generated modules (`tools/build-sonner-css.mjs`,
 *     `tools/build-icons.mjs`). React Rewrite is installed, not copied, but
 *     the patch needles quote its bundle, so it gets a notice too: it costs
 *     nothing and removes the question.
 *   - INSTALLED. Everything else in `dependencies` is fetched from npm by the
 *     person installing, with its own license file. No copy is made, so no
 *     notice is owed; they are listed so the page is complete.
 *
 * Kept honest the way `src/core/icons.ts` is: generated, checked in, and
 * re-checked by `npm run verify`, so a dependency bump that changes a license
 * or the bundle's contents fails the build instead of shipping a stale page.
 */

import { build } from "esbuild"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.dirname(fileURLToPath(new URL("../package.json", import.meta.url)))
const OUT = path.join(root, "THIRD_PARTY_NOTICES.md")
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"))

/** Copied into `src/` rather than bundled from `node_modules`. */
const VENDORED = {
  sonner: "`src/core/css/sonner-css.ts` (the toast stylesheet, verbatim)",
  lucide: "`src/core/icons.ts` (icon path data) and `tools/icons/foundations/`",
  "react-rewrite-cli":
    "installed from npm and pinned exactly: the dev proxy, source mapping and write-back engine. `runtime/vendor-patch.mjs` quotes short fragments of its bundle to patch the installed copy in memory",
}

/**
 * License texts for packages whose npm tarball omits the file. Copied from the
 * project's repository; re-check it when the pinned version moves.
 */
const LICENSE_FALLBACK = {
  "react-rewrite-cli": `MIT License

Copyright (c) 2025-present Dongha Kim

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`,
}

/** Installed dependencies that deserve more than a one-line entry. */
const NOTES = {
  motion: "Umbrella package; the parts of it the editor uses are bundled as framer-motion, motion-dom and motion-utils above.",
  "@babel/parser": "Parses component source on the local server.",
  esbuild: "Builds `dist/` from `src/` when the package is installed (`prepare`).",
  ws: "WebSockets for the local server and for library sign-in.",
}

function manifest(name) {
  return JSON.parse(fs.readFileSync(path.join(root, "node_modules", name, "package.json"), "utf8"))
}

function licenseText(name) {
  const dir = path.join(root, "node_modules", name)
  const file = fs.readdirSync(dir).find((f) => /^licen[cs]e(\.(md|txt))?$/i.test(f))
  if (!file && LICENSE_FALLBACK[name]) return LICENSE_FALLBACK[name]
  if (!file) throw new Error(`${name} ships no LICENSE file — add its text to this tool by hand`)
  return fs.readFileSync(path.join(dir, file), "utf8").trim()
}

function repoUrl(m) {
  const url = typeof m.repository === "string" ? m.repository : m.repository?.url ?? m.homepage ?? ""
  return url.replace(/^git\+/, "").replace(/\.git$/, "").replace(/^git:\/\//, "https://").replace(/\/$/, "")
}

/** Packages with at least one byte in the browser bundle, same graph as `build.mjs`. */
async function bundledPackages() {
  const result = await build({
    absWorkingDir: root,
    entryPoints: [path.join(root, "src", "index.ts")],
    bundle: true,
    write: false,
    metafile: true,
    format: "iife",
    platform: "browser",
    tsconfig: path.join(root, "tsconfig.json"),
    define: { "process.env.NODE_ENV": '"production"' },
    logLevel: "silent",
  })
  const names = new Set()
  for (const output of Object.values(result.metafile.outputs)) {
    for (const [file, input] of Object.entries(output.inputs)) {
      const match = file.match(/node_modules\/((?:@[^/]+\/)?[^/]+)\//)
      if (match && input.bytesInOutput > 0) names.add(match[1])
    }
  }
  return [...names].sort()
}

const bundled = await bundledPackages()
const noticed = [...new Set([...bundled, ...Object.keys(VENDORED)])].sort()
const installed = Object.keys(pkg.dependencies).filter((n) => !noticed.includes(n)).sort()
const dev = Object.keys(pkg.devDependencies).filter((n) => !noticed.includes(n)).sort()

function row(name, how) {
  const m = manifest(name)
  return `| [${name}](${repoUrl(m)}) | ${m.version} | ${m.license} | ${how} |`
}

const file = `# Third-party notices

designlayer is MIT licensed (see [LICENSE](LICENSE)) and is built on the open
source projects below. Where a project's license requires its notice to travel
with copies of its code, the full text is reproduced at the end of this file.

GENERATED by \`node tools/build-notices.mjs\` — do not edit by hand.

## Included in what designlayer ships

These projects' code is copied into this repository or compiled into
\`dist/designlayer.js\`, so their notices are reproduced below.

| Project | Version | License | Where |
| --- | --- | --- | --- |
${noticed
  .map((n) => {
    const where = [bundled.includes(n) && "bundled into `dist/designlayer.js`", VENDORED[n]]
    return row(n, where.filter(Boolean).join("; "))
  })
  .join("\n")}
| Design foundations kit | — | MIT (this repository's license) | \`tools/icons/foundations/\` (SVG glyphs, verbatim) and \`src/core/tokens.ts\` (token values). First-party: © Haoyang Li, not a third-party project. Its Lucide-derived glyphs are covered by the Lucide notice. |

## Installed from npm, not redistributed

npm fetches these with their own license files when designlayer is installed.
No copy is included here, so no notice is required; they are listed for
completeness.

| Project | Version | License | Role |
| --- | --- | --- | --- |
${installed.map((n) => row(n, NOTES[n] ?? "")).join("\n")}

Development only, never shipped: ${dev
  .map((n) => `${n} (${manifest(n).license})`)
  .join(", ")}.

## License texts

${noticed
  .map((n) => {
    const m = manifest(n)
    return `### ${n} ${m.version}\n\n\`\`\`\n${licenseText(n)}\n\`\`\``
  })
  .join("\n\n")}
`

if (process.argv.includes("--check")) {
  const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf8") : ""
  if (current !== file) {
    console.error("STALE THIRD_PARTY_NOTICES.md — run `node tools/build-notices.mjs`")
    process.exit(1)
  }
  console.log(`PASS THIRD_PARTY_NOTICES.md covers ${noticed.length} redistributed packages`)
  process.exit(0)
}

fs.writeFileSync(OUT, file)
console.log(`Wrote THIRD_PARTY_NOTICES.md — ${noticed.length} notices, ${installed.length} installed`)
