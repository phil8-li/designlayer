/**
 * Canvas-mode frames: keep the editor out of them, and let them load at all.
 *
 * The board shows each page of the host app in a same-origin iframe, and every
 * page the proxy serves carries the overlay script. Left alone, each frame would
 * boot a whole second editor, and the vendor's WebSocket server keeps exactly
 * one client — `activeClient.close(4001, "replaced by new connection")` — so the
 * last frame to load would kick the real editor off the socket.
 *
 * The board marks its frames two ways, and the check accepts either: the frame's
 * `name`, which the document inside can read before anything else, and an
 * attribute on the <iframe> element, which survives a page that reassigns
 * `window.name`. The client lane in src/board/ sets both, from these constants.
 */

export const BOARD_FRAME_NAME_PREFIX = "designlayer-frame:"
export const BOARD_FRAME_ATTRIBUTE = "data-designlayer-frame"

// `frameElement` is null in a top-level window and throws in some embedders; a
// throw is read as "not a board frame" so the editor still boots where it would
// have before this guard existed.
const IN_BOARD_FRAME =
  `(function(){try{return window.name.indexOf(${JSON.stringify(BOARD_FRAME_NAME_PREFIX)})===0||` +
  `!!(window.frameElement&&window.frameElement.hasAttribute(${JSON.stringify(BOARD_FRAME_ATTRIBUTE)}))}` +
  `catch(e){return false}})()`

/**
 * Wraps the served overlay so none of it runs inside a board frame.
 *
 * A block, not a function: the vendor bundle's `var ReactRewrite=` has to stay
 * a global, and `var` inside an `if` block of a classic script still lands on
 * the window where a function wrapper would scope it away. Skipping instead of
 * throwing matters too — Next's dev overlay reports an uncaught error in a frame
 * the same as in the page.
 */
export function guardBoardFrames(source) {
  return `if (!${IN_BOARD_FRAME}) {\n${source}\n}\n`
}

function isBoardFrameRequest(request) {
  const headers = request?.headers
  return headers?.["sec-fetch-dest"] === "iframe" && headers?.["sec-fetch-site"] === "same-origin"
}

/** The CSP value with only its `frame-ancestors` directive removed. */
function withoutFrameAncestors(policy) {
  return String(policy)
    .split(";")
    .map((directive) => directive.trim())
    .filter((directive) => directive && !/^frame-ancestors(\s|$)/i.test(directive))
    .join("; ")
}

/**
 * Drops what stops the board framing the host's own pages.
 *
 * A host that sends `X-Frame-Options: DENY` or `frame-ancestors 'none'` would
 * render every board frame blank. Only a same-origin iframe request is relaxed —
 * the board is the proxy's own origin — so a cross-site page still cannot frame
 * the app through this proxy, and a top-level load keeps every header. The rest
 * of the policy is left exactly as the host wrote it.
 */
export function stripFrameBlockingHeaders(request, headers) {
  if (!headers || typeof headers !== "object" || !isBoardFrameRequest(request)) return headers
  for (const name of Object.keys(headers)) {
    const lower = name.toLowerCase()
    if (lower === "x-frame-options") {
      delete headers[name]
    } else if (lower === "content-security-policy") {
      const value = headers[name]
      const policy = Array.isArray(value)
        ? value.map(withoutFrameAncestors).filter(Boolean)
        : withoutFrameAncestors(value)
      if (policy.length === 0) delete headers[name]
      else headers[name] = policy
    }
  }
  return headers
}

/**
 * The same relaxation for headers a handler set with `setHeader` before
 * `writeHead`, which never appear in the object `writeHead` is handed.
 */
export function stripFrameBlockingResponseHeaders(response) {
  if (!isBoardFrameRequest(response?.req)) return
  response.removeHeader("x-frame-options")
  const current = response.getHeader("content-security-policy")
  if (current === undefined) return
  const stripped = stripFrameBlockingHeaders(response.req, { "content-security-policy": current })
  if (stripped["content-security-policy"] === undefined) response.removeHeader("content-security-policy")
  else response.setHeader("content-security-policy", stripped["content-security-policy"])
}
