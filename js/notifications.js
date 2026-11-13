/**
 * Short messages at the bottom of the screen, and copying to the clipboard.
 */
import { describeKeys } from './keyboard.js';

export const SHORT_TOAST_MS = 1600;
export const LONG_TOAST_MS = 4000; // for messages with a full sentence to read

const toast = document.getElementById('toast');
let hideToastTimer = null;

/**
 * Shows one short message, without buttons; a new one replaces the old.
 * Undo is always Ctrl/⌘+Z, because every change to the field goes through the browser's editing history.
 */
export function showToast(message, { durationMs = SHORT_TOAST_MS } = {}) {
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
  if (!text) return;
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
  if (typeof element.select === 'function') {
    element.focus();
    element.select();
  } else {
    const range = document.createRange();
    range.selectNodeContents(element);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }
  showToast(`Selected. Press ${describeKeys({ command: true, key: 'C' })} to copy`);
}
