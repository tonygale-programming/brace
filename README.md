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

## Run locally

It's a single static file. Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000
```

## Tech

Plain HTML, CSS and JavaScript with no build step and no dependencies. Fonts load from Google Fonts.
