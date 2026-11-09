# {brace} JSON Formatter

Format, minify and validate JSON in your browser. Nothing is uploaded: all work happens on your device.

## Features

- Format with 2 spaces, 4 spaces or tabs, or minify to one line
- Optional key sorting
- Validation with the exact line and column of each error, and a plain explanation
- **Repair**: fixes trailing commas, single quotes, comments, unquoted keys, missing commas, Python-style `True`/`None` and more (undo with `Ctrl/⌘ + Z`)
- **Exact numbers**: large IDs like `12345678901234567890` and values like `129.0` stay exactly as written instead of being rounded
- Catches duplicate keys with conflicting values, which most tools accept silently
- Collapsible tree view; click a key to get its path (for example `$.order.items[0].sku`)
- Open or drag in a `.json` file, copy the result
- Light and dark themes
- Shortcuts: `Ctrl/⌘ + Enter` formats, `Ctrl/⌘ + Shift + Enter` minifies

## Project structure

```
index.html              page markup
styles.css              theme colours (light and dark), layout and syntax colours
js/
  main.js               entry point: connects the controls to everything below
  json-engine.js        parse, format, sort and repair JSON (wraps the two libraries)
  syntax-checker.js     finds the first syntax error and explains it in plain words
  result-panel.js       draws the result pane: empty state, error card or output
  highlighter.js        colours formatted JSON and adds line numbers
  tree-view.js          the collapsible tree and key paths
  notifications.js      toast messages and copying to the clipboard
  storage.js            remembers settings and the last input in this browser
  html.js               escapes text before it goes into HTML
```

## Run locally

The app uses JavaScript modules, which browsers only load over HTTP. Serve the folder,
then open http://localhost:8000:

```bash
python3 -m http.server 8000
```

Opening `index.html` directly from disk will show the page without any behaviour.

## Code style

The goal is code a person can read without running it.

- **Full names, no abbreviations.** `position`, not `i`; `repairInput`, not `rep`; `.token-string`, not `.t-s`.
  The only exception is a name the whole industry uses, like `id` or `html`.
- **One job per file.** If a module starts doing two things, split it.
- **Small functions that say what they do.** A function name is a verb phrase (`showError`, `getLineAndColumn`).
  If you need a comment to explain *what* a block does, make it a function with that name instead.
- **Comments explain *why*, not *what*.** For example, why the tree builds children lazily, or why
  Repair uses `execCommand`.
- **Named constants instead of magic numbers.** `TYPING_DELAY_MS`, not `180`.
- **Return early** instead of nesting `if` blocks.
- **CSS uses design tokens.** Every colour is a `--variable` in the Theme section at the top of `styles.css`,
  so light and dark mode change in one place. One declaration per line.
- **No build step.** Anything added must still run when the folder is served as plain files.

Formatting rules for editors are in `.editorconfig`.

## Tech

Plain HTML, CSS and JavaScript with no build step. Two small libraries load from jsDelivr, pinned to exact versions with integrity hashes:

| Library | Version | Used for |
|---|---|---|
| [lossless-json](https://github.com/josdejong/lossless-json) | 4.3.3 | Parsing and formatting without rounding numbers; duplicate key detection |
| [jsonrepair](https://github.com/josdejong/jsonrepair) | 3.15.0 | The Repair button |

If the CDN can't be reached, the page still works: it falls back to the browser's built-in JSON and hides Repair.

Fonts load from Google Fonts.
