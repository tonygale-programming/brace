/**
 * Helpers for building HTML strings safely.
 */

const HTML_ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
};

/** Makes any text safe to insert into HTML, so user JSON can never inject markup. */
export function escapeHtml(text) {
  return String(text).replace(/[&<>"]/g, (character) => HTML_ESCAPES[character]);
}
