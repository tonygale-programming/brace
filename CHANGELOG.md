# Changelog

What changed in Brace, day by day. Newest first. Each day lists what people using the site would notice,
then changes behind the scenes. Release versions match the `?v=` value in `index.html`.

## 12 November 2026

Release `2026-11-12.2`.

**New look** (from the [Brace design system](https://claude.ai/artifact/G2fKVhvYDpQxE6Rzz2rTHh))
- **One field** instead of two panes: paste, then Format, Minify or Stringify change the text in place.
  `Ctrl/⌘ + Z` goes back.
- Grey page, white field with a black outline, rounded pill buttons, Lucide icons, yellow for the main
  action (Format) and for anything selected.
- Line numbers and coloured JSON right in the field you type in; the line with an error is marked.
- One theme button (moon / sun) instead of Auto / Light / Dark. A first visit follows the system setting.
- The status chip says Valid or Invalid with an icon, not by colour alone.

**New**
- Pasting into an empty field formats it straight away.
- Format and Minify undo a Stringify.
- Changing Indent or Sort keys applies at once.
- **Download** saves the JSON as a file.
- **Undo** button after Clear, Sample and Repair.
- **Copy value** next to Copy path in the tree.
- The error's line and column in the status row jump to the error when pressed.
- Drop a file anywhere on the page.
- **Shortcuts** list (press `?`).
- Buttons that can't do anything right now are disabled, instead of explaining after the click.
- Clearer error for keys without quotes: `write "notes" instead of notes`.

**Behind the scenes**
- New modules: `editor.js`, `error-card.js`, `status-bar.js`, `download.js`; `result-panel.js` removed.
- `CHANGELOG.md` (this file).
- Created the Brace design system from the Figma draft: colours, Roboto type, spacing, rounded
  pill controls, a two-column screen layout and the states the draft did not show yet.
- Added `CLAUDE.md` so future Claude sessions know the project's rules.

## 10 November 2026

**Behind the scenes**
- Added `ROADMAP.md`: small UX ideas (including a Download button), later phases, rules for
  choosing ideas, and the ideas we decided against.

## 9 November 2026

Releases `2026-11-09.1` to `2026-11-09.5`.

**New**
- **Stringify**: turns the JSON into one escaped string, ready to paste into code.
- **Works offline** and can be installed as an app.
- **Private by design**: the page loads nothing from other sites, and its security policy stops it from
  sending data anywhere. A note in the header says so and links to how anyone can check it.
- **Theme switch**: Auto, Light or Dark.
- **Repair**: fixes trailing commas, single quotes, comments, missing quotes and more, with Undo.
- **Exact numbers**: big IDs and values like `129.0` stay exactly as written.
- **Duplicate keys** with different values are reported as an error.

**Fixed**
- The page could look half unstyled for a few minutes after an update, because browsers mixed a new
  page with an old stylesheet. Every file now carries a release version.
- The Indent dropdown's arrow sat against its border.

**Improved**
- All spacing and sizes follow a 4px scale, and every control is the same height, so rows line up.
- Link previews in chats and social networks show a proper title and image.

**Behind the scenes**
- The code was split into small modules with full, descriptive names, and code style rules were written down.
- Both libraries and the fonts are served from the site itself.
- `scripts/release.py` prepares each release.
- Competitor research and a plan for how Brace can stand out: safe for secrets, instant, and good with
  messy real-world JSON.
- MIT license.

## 8 November 2026

**New**
- First version of Brace: format, minify, validate with the exact line and column of each error,
  tree view with copyable paths, open or drop a file, light and dark colours.
- Published on GitHub Pages at https://tonygale-programming.github.io/brace/.
