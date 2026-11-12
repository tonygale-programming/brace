# Brace JSON Formatter: notes for Claude

## What this is

A JSON formatter, validator and repair tool that runs entirely in the browser.
Plain HTML, CSS and JavaScript modules, no build step, no server.

- Live site: https://tonygale-programming.github.io/brace/ (GitHub Pages, deploys from `main`)
- Repo: https://github.com/tonygale-programming/brace (public, MIT)
- `README.md` covers features, privacy, file structure, releasing and code style. Read it first.
- `ROADMAP.md` holds the ideas waiting to be built, the rules for accepting ideas, and the "Not doing" list.
- `CHANGELOG.md` is the day-by-day history. Add an entry for every release.
- The look follows Tony's design system: https://claude.ai/artifact/G2fKVhvYDpQxE6Rzz2rTHh

## Tony's design decisions (these override the design system)

- **One field**, no separate result pane: Format / Minify / Stringify rewrite the text in place, undoably.
- **Format, Minify, Stringify are three buttons**; Format is filled yellow as the main action. Elsewhere
  yellow means "on" or "selected".
- **Copy and Download are outlined**, not filled. The only ink-filled button is Repair JSON in the error card.
- **One theme button** (moon / sun); a first visit follows the system setting.
- **IBM Plex fonts** for now; Roboto (from the design system) is still to decide.
- **Lucide icons**, inlined as SVG with a `data-lucide` name. Lucide has no brand logos, so GitHub uses `code`.
- **Details:** 16px icons with a 1.5px line (Lucide stroke 2.25); buttons 12px left, 8px icon gap, 16px right;
  focus is a 1.5px yellow ring with a 1.5px gap; dark-mode yellow is `#664C00` with white text; the status chip
  uses a dot, not an icon; the logo is `{brace}` with Lucide's braces; no privacy line in the header (for now).
- Keep it simple: "less is more". Prefer fewer controls and disabled states over extra screens or messages.

## Positioning (why decisions go the way they do)

Brace competes with JSONLint, JSONFormatter.org, CodeBeautify, JSON Editor Online, JSON Crack and JSON Hero.
Its three promises: **safe for secrets** (provably nothing leaves the browser; other formatters leaked
80,000+ pasted documents in Nov 2025), **instant** (no ads, account or cookie banner; works offline),
and **fixes messy real-world JSON**. Any change that weakens the privacy promise is out:
no third-party requests, no server storage, no analytics.

## Rules that are easy to break by accident

- **Run `python3 scripts/release.py` before every push that changes the site.** It bumps `?v=` in
  `index.html` and `RELEASE` in `service-worker.js`, and recalculates the CSP hashes. Editing the inline
  theme script or the import map without running it makes the page stop running (CSP blocks it).
- **New module in `js/`**: add it to the import map in `index.html` and `VERSIONED_FILES` in
  `service-worker.js`. The release script refuses to continue if you forget.
- **Nothing from other sites**: libraries live in `vendor/`, fonts in `fonts/`. The CSP
  (`default-src 'none'`, `connect-src 'none'`) blocks anything else.
- **Spacing**: only `--space-*` tokens (2, 4, 8, 12, 16, 20, 24, 32px); other sizes are multiples of 4px;
  controls share `--control-height` (32px). Exceptions: 1px borders and font sizes.
- **Colours**: tokens written once with `light-dark()`; `data-theme` on `<html>` forces a theme.
- **Names**: full descriptive names, no single letters or abbreviations, in JS, CSS classes and ids.
- **Keep it simple**: one screen, small modules with one job each, no new libraries without a strong reason.

## Working on it

- Serve locally: `python3 -m http.server 8765 --bind 127.0.0.1` in this folder, then open
  http://127.0.0.1:8765/. Modules don't load from `file://`.
- The Claude app's built-in browser blocks service workers, so test offline behaviour in real Chrome,
  for example with `playwright-core` driving `/Applications/Google Chrome.app` (headless): load the page,
  wait for `navigator.serviceWorker.ready`, `context.setOffline(true)`, reload, check the page still works.
- After pushing, wait about a minute for GitHub Pages, then check the live site: no requests to other
  origins, `fetch('https://example.com')` is blocked by the CSP, no console errors.
- The user asks before each commit and push; offer them, don't do them unasked.
- Commit messages: a short summary line, then a body explaining what and why.

## History

An earlier single-file version was published as a claude.ai artifact
(https://claude.ai/artifact/MFhfY6SSAbyQwhxKBTMZ58). It is out of date; the repo is the source of truth.
