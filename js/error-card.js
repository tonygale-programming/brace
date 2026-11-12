/**
 * The card at the bottom of the field while the JSON is invalid:
 * where the problem is, what it is in plain words, and the line with a caret under the problem.
 */
import { escapeHtml } from './html.js';
import { getLineAndColumn } from './syntax-checker.js';

// How many characters of the error's line to show around the error.
const SNIPPET_WIDTH = 90;

/** @param elements { card, title, message, snippet, repairButton } */
export function createErrorCard({ card, title, message, snippet, repairButton }) {
  /** @returns {{ position: number, line: number, column: number }} where the error is */
  function show(text, error, { canRepair }) {
    const { line, column, lineStart } = getLineAndColumn(text, error.position);
    const { snippetText, caretOffset } = buildErrorSnippet(text, lineStart, column);

    title.textContent = `Line ${line}, column ${column}`;
    message.textContent = error.message;
    snippet.innerHTML = `${escapeHtml(snippetText)}\n<span class="error-caret">${' '.repeat(caretOffset)}^</span>`;
    repairButton.hidden = !canRepair;
    card.hidden = false;
    return { position: error.position, line, column };
  }

  function hide() {
    card.hidden = true;
  }

  return { show, hide };
}

/** Returns the line with the error, shortened around the error if long, and where the ^ goes. */
function buildErrorSnippet(text, lineStart, column) {
  const lineEnd = text.includes('\n', lineStart) ? text.indexOf('\n', lineStart) : text.length;
  const line = text.slice(lineStart, lineEnd).replace(/\t/g, ' ');
  const caretOffset = Math.max(0, column - 1);

  if (line.length <= SNIPPET_WIDTH) return { snippetText: line, caretOffset };

  const start = Math.max(0, caretOffset - SNIPPET_WIDTH / 2);
  const end = start + SNIPPET_WIDTH;
  const prefix = start > 0 ? '…' : '';
  const suffix = end < line.length ? '…' : '';
  return {
    snippetText: prefix + line.slice(start, end) + suffix,
    caretOffset: caretOffset - start + prefix.length,
  };
}
