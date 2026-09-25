/**
 * Renders the PWA icons from icons/mark.svg in a private headless Chromium.
 *
 * Chrome's installability check wants PNG icons at 192 and 512, and the
 * maskable one is what macOS shows in the Dock — full-bleed ground with the
 * mark inside the 80% safe zone, because the OS crops it to its own squircle.
 *
 * Usage: node desktop/mac/make-icons.mjs
 */

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const PLAYWRIGHT = "/opt/homebrew/lib/node_modules/@playwright/mcp/node_modules/playwright/index.mjs"
const here = path.dirname(fileURLToPath(import.meta.url))
const iconsDir = path.join(here, "icons")
const svg = fs.readFileSync(path.join(iconsDir, "mark.svg"), "utf8")
const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`

const { chromium } = await import(PLAYWRIGHT)
const browser = await chromium.launch()
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 })
  const render = async (file, size, maskable) => {
    await page.setViewportSize({ width: size, height: size })
    // Maskable: the ground fills the square and the mark shrinks to the safe zone.
    const inner = maskable ? Math.round(size * 0.8) : size
    await page.setContent(
      `<html><body style="margin:0;background:${maskable ? "#1a1a1a" : "transparent"};display:grid;place-items:center;width:${size}px;height:${size}px">` +
        `<img src="${dataUrl}" width="${inner}" height="${inner}"></body></html>`
    )
    await page.screenshot({ path: path.join(iconsDir, file), omitBackground: !maskable })
    console.log(`wrote icons/${file} (${size}x${size})`)
  }
  await render("icon-192.png", 192, false)
  await render("icon-512.png", 512, false)
  await render("icon-maskable-512.png", 512, true)
} finally {
  await browser.close()
}
