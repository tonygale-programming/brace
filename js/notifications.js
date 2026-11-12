/**
 * Short messages at the bottom of the screen, and copying to the clipboard.
 */
import { describeKeys } from './keyboard.js';

export const SHORT_TOAST_MS = 1600;
export const LONG_TOAST_MS = 4000; // long enough to reach the Undo button

const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toast-message');
const undoButton = document.getElementById('toast-action');
let hideToastTimer = null;
let pendingUndo = null;

function hideToast() {
  toast.classList.remove('is-visible');
  pendingUndo = null;
}

/**
 * Shows one message; a new one replaces the old.
 * With onUndo, the toast carries an Undo button and stays up longer.
 */
export function showToast(message, { durationMs, onUndo } = {}) {
  toastMessage.textContent = message;
  pendingUndo = onUndo ?? null;
  undoButton.hidden = !onUndo;
  toast.classList.add('is-visible');

  clearTimeout(hideToastTimer);
  hideToastTimer = setTimeout(hideToast, durationMs ?? (onUndo ? LONG_TOAST_MS : SHORT_TOAST_MS));
}

undoButton.addEventListener('click', () => {
  const undo = pendingUndo;
  hideToast();
  undo?.();
});

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
