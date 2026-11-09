/**
 * Short messages at the bottom of the screen, and copying to the clipboard.
 */

export const SHORT_TOAST_MS = 1600;
export const LONG_TOAST_MS = 3600;

const isApplePlatform = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
export const MODIFIER_KEY_LABEL = isApplePlatform ? '⌘' : 'Ctrl';

const toast = document.getElementById('toast');
let hideToastTimer = null;

export function showToast(message, durationMs = SHORT_TOAST_MS) {
  toast.textContent = message;
  toast.classList.add('is-visible');
  clearTimeout(hideToastTimer);
  hideToastTimer = setTimeout(() => toast.classList.remove('is-visible'), durationMs);
}

/**
 * Copies text. If the browser blocks clipboard access, selects the fallback
 * element instead so the user can copy it with the keyboard.
 */
export async function copyToClipboard(text, successMessage, fallbackElement) {
  if (!text) {
    showToast('Nothing to copy yet');
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    showToast(successMessage);
  } catch {
    selectForManualCopy(fallbackElement);
  }
}

function selectForManualCopy(element) {
  if (!element) {
    showToast('Copy is blocked here. Select the text instead.');
    return;
  }
  const range = document.createRange();
  range.selectNodeContents(element);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
  showToast(`Selected. Press ${MODIFIER_KEY_LABEL}+C to copy`);
}
