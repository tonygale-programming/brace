# Changelog

What changed in Brace, day by day. Newest first. Each day lists what people using the site would notice,
then changes behind the scenes. Release versions match the `?v=` value in `index.html`.

## Upcoming

- Redesign based on the Brace design system
  ([design system](https://claude.ai/artifact/G2fKVhvYDpQxE6Rzz2rTHh), made from a Figma draft).

## 12 November 2026

**Behind the scenes**
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
