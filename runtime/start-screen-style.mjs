/**
 * The start screen's stylesheet, kept out of the page module so both stay
 * readable and under the file limit.
 *
 * Every colour, radius, shadow, face and curve is lifted from the vendored
 * chrome tokens into custom properties once, at the top, so the rules below are
 * plain CSS instead of a template literal with an interpolation on every line.
 * Nothing here may name a colour directly: the start screen is the same chrome
 * as the editor it launches, and it has to stay that way when the rung moves.
 *
 * `dist/` is gitignored and built by `prepare`, so the tokens module is always
 * there in an install — but a source checkout that was never built would
 * otherwise fail with a bare module-resolution error naming a path the reader
 * has no reason to recognise. This is the one place the bundle is loaded, so
 * this is the one place that has to say what to do about it.
 */

let tokens
try {
  ;({ tokens } = await import("../dist/tokens.mjs"))
} catch (error) {
  if (error.code !== "ERR_MODULE_NOT_FOUND") throw error
  throw new Error("designlayer: the token bundle is missing — run `npm run build` in the package")
}

const { color, radius, shadow, font, type, ease, duration } = tokens

export function startScreenStyle() {
  return `
:root {
  color-scheme: dark;
  --bg: ${color.bg};
  --bg-raised: ${color.bgRaised};
  --bg-sunken: ${color.bgSunken};
  --border: ${color.border};
  --border-strong: ${color.borderStrong};
  --border-interactive: ${color.borderInteractive};
  --text: ${color.text};
  --text-muted: ${color.textMuted};
  --text-dim: ${color.textDim};
  --accent: ${color.accent};
  --accent-soft: ${color.accentSoft};
  --accent-surface: ${color.accentSurface};
  --accent-surface-hover: ${color.accentSurfaceHover};
  --on-accent: ${color.onAccent};
  --field: ${color.field};
  --field-hover: ${color.fieldHover};
  --row-selected: ${color.rowSelected};
  --danger: ${color.danger};
  --radius: ${radius.lg};
  --radius-sm: ${radius.md};
  --radius-card: ${radius.xl};
  --shadow: ${shadow.float};
  --font: ${font.ui};
  --mono: ${font.mono};
  --ease: ${ease};
  --fast: ${duration.fast};
  --base: ${duration.base};
  --weight-body: ${type.weightBody};
  --weight-value: ${type.weightValue};
  --weight-section: ${type.weightSection};

  /*
   * The token type scale is 11/10/9px because it was cut for a 240px docked
   * panel. This card is the full window and its field is the primary control of
   * the whole product, so it carries product-scale type. The label rung is
   * still the token's, which is what keeps the two surfaces related.
   */
  --size-label: ${type.body};
  --size-body: 13px;
  --size-lede: 15px;
  --size-url: 16px;
}

*, *::before, *::after { box-sizing: border-box; }
[hidden] { display: none !important; }

body {
  margin: 0;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px 16px;
  background: var(--bg);
  color: var(--text);
  font: var(--weight-body) var(--size-body)/1.5 var(--font);
  -webkit-font-smoothing: antialiased;
}

.card {
  width: min(100%, 496px);
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  background: var(--bg-raised);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow);
}

.brand {
  margin: 0;
  font-family: var(--mono);
  font-size: var(--size-label);
  letter-spacing: 0.04em;
  color: var(--text-dim);
}
.lede { margin: 6px 0 0; font-size: var(--size-lede); font-weight: var(--weight-value); }

form { display: contents; }
.section { display: flex; flex-direction: column; gap: 8px; }
.label {
  margin: 0;
  font-size: var(--size-label);
  font-weight: var(--weight-section);
  letter-spacing: 0.03em;
  text-transform: uppercase;
  color: var(--text-dim);
}
.note { margin: 0; font-size: var(--size-label); color: var(--text-muted); }
.error { margin: 0; font-size: var(--size-label); color: var(--danger); }
code { font-family: var(--mono); color: var(--text); }

#url {
  width: 100%;
  padding: 12px 14px;
  font: var(--weight-value) var(--size-url) var(--mono);
  color: var(--text);
  background: var(--bg-sunken);
  border: 1px solid var(--border-interactive);
  border-radius: var(--radius);
  transition: border-color var(--fast) var(--ease);
}
#url::placeholder { color: var(--text-dim); }
#url:hover { border-color: var(--accent-soft); }

:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
#url:focus { border-color: var(--accent); outline: none; }

/*
 * No reserved height. Most machines run one dev server, and a list sized for
 * two left a hole under it that read as a rendering fault rather than as room.
 * The note below carries the empty case, so the list can simply not be there.
 */
.apps { display: flex; flex-direction: column; gap: 4px; }
.apps:empty { display: none; }
.app {
  width: 100%;
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 7px 10px;
  text-align: left;
  font: inherit;
  color: var(--text);
  background: var(--field);
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background var(--fast) var(--ease);
}
.app:hover { background: var(--field-hover); }
.app[aria-pressed="true"] { background: var(--row-selected); border-color: var(--accent-soft); }
.app-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.app-port { font-family: var(--mono); font-size: var(--size-label); color: var(--text-muted); }

/*
 * A field rather than a label, because typing or pasting a path is the way a
 * project folder is named — the only way, since the native folder panel that
 * used to sit beside it was dropped. It spans the section for that reason: it
 * shared a flex row with a Browse button, and with the button gone there is
 * nothing to share it with. It scrolls to the caret like any text input, so the
 * tail — the identifying part of a path — is what stays in view while it is
 * being typed.
 */
.path {
  width: 100%;
  padding: 7px 10px;
  font-family: var(--mono);
  font-size: var(--size-label);
  color: var(--text);
  background: var(--bg-sunken);
  border: 1px solid var(--border-interactive);
  border-radius: var(--radius-sm);
  transition: border-color var(--fast) var(--ease);
}
.path::placeholder { color: var(--text-dim); }
.path:hover { border-color: var(--accent-soft); }
.path:focus { border-color: var(--accent); outline: none; }

button { font: inherit; cursor: pointer; }
.ghost {
  padding: 6px 10px;
  color: var(--text-muted);
  background: transparent;
  border: 1px solid var(--border-interactive);
  border-radius: var(--radius-sm);
  font-size: var(--size-label);
  transition: color var(--fast) var(--ease), border-color var(--fast) var(--ease);
}
.ghost:hover { color: var(--text); border-color: var(--accent); }

select {
  align-self: flex-start;
  padding: 6px 8px;
  font: inherit;
  color: var(--text);
  background: var(--field);
  border: 1px solid var(--border-interactive);
  border-radius: var(--radius-sm);
}

.primary {
  padding: 11px 16px;
  font-size: var(--size-body);
  font-weight: var(--weight-section);
  color: var(--on-accent);
  background: var(--accent-surface);
  border: 0;
  border-radius: var(--radius);
  transition: background var(--fast) var(--ease);
}
.primary:hover:not(:disabled) { background: var(--accent-surface-hover); }
.primary:disabled { background: var(--field); color: var(--text-dim); cursor: default; }

/*
 * The pair under "Now editing": go to what is running, or go and pick something
 * else. The first is an anchor rather than a button because it goes to a URL,
 * and an anchor is the control a browser already knows how to open in a new tab
 * — which is exactly what someone with two apps in flight will want to do.
 */
.actions { display: flex; align-items: center; gap: 8px; }
a.primary { text-decoration: none; text-align: center; }

.waiting { display: flex; flex-direction: column; gap: 8px; }
.progress { margin: 0; display: flex; align-items: center; gap: 10px; font-size: var(--size-lede); }
.pulse {
  width: 8px;
  height: 8px;
  flex: none;
  border-radius: 50%;
  background: var(--accent);
  animation: pulse 1.4s var(--ease) infinite;
}
@keyframes pulse { 0%, 100% { opacity: 0.25; } 50% { opacity: 1; } }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; transition: none !important; }
  .pulse { opacity: 1; }
}
`
}
