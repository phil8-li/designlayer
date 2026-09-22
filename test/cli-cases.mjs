/** Package-entry regression cases. */

import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { spawnSync } from "node:child_process"

import { PACKAGE_DIR } from "./host.mjs"
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "designlayer-cli-"))
const installedBin = path.join(fixture, "designlayer")

try {
  fs.symlinkSync(path.join(PACKAGE_DIR, "cli.mjs"), installedBin)

  const help = spawnSync(installedBin, ["--help"], {
    cwd: fixture,
    encoding: "utf8",
  })
  assert.equal(help.status, 0, help.stderr)
  assert.match(help.stdout, /^Usage: designlayer/m)

  const printed = spawnSync(installedBin, ["--print-config"], {
    cwd: fixture,
    encoding: "utf8",
  })
  assert.equal(printed.status, 0, printed.stderr)
  const config = JSON.parse(printed.stdout)
  assert.equal(fs.realpathSync(config.projectRoot), fs.realpathSync(fixture))
  assert.equal(config.controls.leva, null)
  assert.deepEqual(config.chrome.trustedSelectors, [])

  console.log("3 passed, 0 failed")
} finally {
  fs.rmSync(fixture, { recursive: true, force: true })
}
