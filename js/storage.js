/**
 * Remembers settings and the last input in this browser.
 * Storage can be blocked (private windows, strict privacy settings), so every
 * access is wrapped: the app works the same without it, it just won't remember.
 */

const KEY_PREFIX = 'brace:';

export function loadSetting(name) {
  try {
    return localStorage.getItem(KEY_PREFIX + name);
  } catch {
    return null;
  }
}

export function saveSetting(name, value) {
  try {
    localStorage.setItem(KEY_PREFIX + name, value);
  } catch {
    // Storage is unavailable; there is nothing useful to tell the user.
  }
}
