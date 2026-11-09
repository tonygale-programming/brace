/**
 * Light, dark, or "auto" (follow the system setting).
 *
 * The choice is applied by setting data-theme on <html>; styles.css does the rest.
 * A small script in index.html applies the saved choice before the page draws,
 * so a visitor who picked Dark never sees a flash of the light theme.
 */
import { loadSetting, saveSetting } from './storage.js';

export const THEME_CHOICES = ['auto', 'light', 'dark'];
const DEFAULT_THEME = 'auto';

export function getSavedTheme() {
  const savedTheme = loadSetting('theme');
  return THEME_CHOICES.includes(savedTheme) ? savedTheme : DEFAULT_THEME;
}

export function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === DEFAULT_THEME) {
    delete root.dataset.theme;
  } else {
    root.dataset.theme = theme;
  }
}

export function chooseTheme(theme) {
  applyTheme(theme);
  saveSetting('theme', theme);
}
