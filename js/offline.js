/**
 * Turns on offline use by registering service-worker.js.
 * If the browser doesn't support it (or blocks it, as some private windows do),
 * nothing changes: Brace works the same, just not without a connection.
 */

const SERVICE_WORKER_URL = 'service-worker.js';

export function enableOfflineUse() {
  if (!('serviceWorker' in navigator)) return;

  // Wait until the page has finished loading, so registering never slows down the first view.
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(SERVICE_WORKER_URL).catch(() => {
      // Registration refused: the app still works online.
    });
  });
}
