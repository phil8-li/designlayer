/**
 * Google Chrome driven over `--remote-debugging-pipe`, for the few CDP calls
 * the installer needs: PWA.install, PWA.launch, PWA.uninstall, Target.getTargets.
 *
 * Chrome 154 exposes the PWA domain only with `--enable-devtools-pwa-handler`,
 * only on the browser target, and only for a non-default `--user-data-dir`.
 * The pipe (fds 3/4, NUL-delimited JSON) avoids opening a debugging port that
 * anything else on the machine could connect to.
 */

import { execFileSync, spawn } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

export const CHROME_BINARY = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

export function chromeProfileDir(home = os.homedir()) {
  return path.join(home, "Library", "Application Support", "DesignLayer", "Chrome")
}

/** The pid named by the profile's SingletonLock (`<host>-<pid>`), or null. */
function lockPid(userDataDir) {
  try {
    const pid = Number(fs.readlinkSync(path.join(userDataDir, "SingletonLock")).split("-").pop())
    return Number.isInteger(pid) && pid > 0 ? pid : null
  } catch {
    return null
  }
}

/** Whether a Chrome process already owns this profile (its SingletonLock points at a live pid). */
export function profileInUse(userDataDir) {
  const pid = lockPid(userDataDir)
  if (!pid) return false
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return error?.code === "EPERM"
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Quit the Chrome instance that owns this profile — the app's own window, never
 * the user's browser. The lock's pid is only signalled when its command line
 * names this exact `--user-data-dir`, so a stale lock whose pid was reused by
 * something else is left alone. SIGTERM is Chrome's clean shutdown.
 */
export async function quitProfileChrome(userDataDir, timeoutMs = 10000) {
  const pid = lockPid(userDataDir)
  if (!pid || !profileInUse(userDataDir)) return true
  let command = ""
  try {
    command = execFileSync("/bin/ps", ["-o", "command=", "-p", String(pid)], { encoding: "utf8" })
  } catch {
    return !profileInUse(userDataDir)
  }
  if (!command.includes(`--user-data-dir=${userDataDir}`)) return false
  try {
    process.kill(pid, "SIGTERM")
  } catch {}
  for (let waited = 0; waited < timeoutMs; waited += 250) {
    if (!profileInUse(userDataDir)) return true
    await sleep(250)
  }
  return !profileInUse(userDataDir)
}

export async function openChrome({ userDataDir, args = [], binary = CHROME_BINARY, timeoutMs = 20000 }) {
  if (!fs.existsSync(binary)) throw new Error(`Google Chrome not found at ${binary}`)
  fs.mkdirSync(userDataDir, { recursive: true })
  const chrome = spawn(
    binary,
    [
      `--user-data-dir=${userDataDir}`,
      "--remote-debugging-pipe",
      "--enable-devtools-pwa-handler",
      "--no-first-run",
      "--no-default-browser-check",
      ...args,
    ],
    { stdio: ["ignore", "ignore", "ignore", "pipe", "pipe"] }
  )
  const toChrome = chrome.stdio[3]
  const fromChrome = chrome.stdio[4]
  const pending = new Map()
  let buffer = ""
  let nextId = 0
  let exited = false
  chrome.once("exit", () => {
    exited = true
    for (const resolve of pending.values()) resolve({ error: { message: "Chrome exited" } })
    pending.clear()
  })
  fromChrome.on("data", (chunk) => {
    buffer += chunk.toString()
    let end
    while ((end = buffer.indexOf("\0")) >= 0) {
      const message = JSON.parse(buffer.slice(0, end))
      buffer = buffer.slice(end + 1)
      if (message.id && pending.has(message.id)) {
        pending.get(message.id)(message)
        pending.delete(message.id)
      }
    }
  })
  toChrome.on("error", () => {})

  const send = (method, params = {}, ms = 30000, sessionId) =>
    new Promise((resolve) => {
      if (exited) return resolve({ error: { message: "Chrome exited" } })
      const id = ++nextId
      const timer = setTimeout(() => {
        pending.delete(id)
        resolve({ error: { message: `${method} timed out` } })
      }, ms)
      pending.set(id, (message) => {
        clearTimeout(timer)
        resolve(message)
      })
      toChrome.write(`${JSON.stringify(sessionId ? { id, method, params, sessionId } : { id, method, params })}\0`)
    })

  // Ready is the first answer on the pipe, not a fixed sleep.
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const version = await send("Browser.getVersion", {}, 2000)
    if (version.result) break
    if (exited || Date.now() > deadline) {
      chrome.kill()
      throw new Error("Chrome did not answer on the debugging pipe")
    }
    await sleep(300)
  }

  async function close() {
    if (!exited) await send("Browser.close", {}, 5000)
    for (let i = 0; i < 20 && !exited; i += 1) await sleep(250)
    if (!exited) chrome.kill()
  }

  return { send, close, process: chrome }
}
