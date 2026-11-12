/**
 * Light or dark. A first visit follows the system setting; pressing the theme button
 * switches to the other theme and remembers the choice.
 *
 * The choice is applied by setting data-theme on <html>; styles.css does the rest.
 * A small script in index.html applies the saved choice before the page draws,
 * so a visitor who picked Dark never sees a flash of the light theme.
 */
import { saveSetting } from './storage.js';

const DARK_SCHEME_QUERY = '(prefers-color-scheme: dark)';

function getSystemTheme() {
  return window.matchMedia(DARK_SCHEME_QUERY).matches ? 'dark' : 'light';
}

/** The theme on screen right now: the saved choice, or the system's when there is none. */
export function getCurrentTheme() {
  return document.documentElement.dataset.theme ?? getSystemTheme();
}

export function toggleTheme() {
  const nextTheme = getCurrentTheme() === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = nextTheme;
  saveSetting('theme', nextTheme);
  return nextTheme;
}
