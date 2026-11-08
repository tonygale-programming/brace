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
index.html   page markup
styles.css   theme colours (light and dark), layout and syntax colours
app.js       parsing, error locating, formatting, tree view and controls
```

## Run locally

Serve the folder with any static server, then open http://localhost:8000:

```bash
python3 -m http.server 8000
```

Opening `index.html` directly from disk also works.

## Tech

Plain HTML, CSS and JavaScript with no build step. Two small libraries load from jsDelivr, pinned to exact versions with integrity hashes:

| Library | Version | Used for |
|---|---|---|
| [lossless-json](https://github.com/josdejong/lossless-json) | 4.3.3 | Parsing and formatting without rounding numbers; duplicate key detection |
| [jsonrepair](https://github.com/josdejong/jsonrepair) | 3.15.0 | The Repair button |

If the CDN can't be reached, the page still works: it falls back to the browser's built-in JSON and hides Repair.

Fonts load from Google Fonts.
