# {brace} JSON Formatter

Format, minify and validate JSON in your browser. Nothing is uploaded: all work happens on your device.

## Features

- Format with 2 spaces, 4 spaces or tabs, or minify to one line
- Optional key sorting
- Validation with the exact line and column of each error, and a plain explanation
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

Plain HTML, CSS and JavaScript with no build step and no dependencies. Fonts load from Google Fonts.
