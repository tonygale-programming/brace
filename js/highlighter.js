/**
 * Colours formatted JSON text and shows it with line numbers.
 */
import { escapeHtml } from './html.js';

// One token of formatted JSON. Strings are matched first, so digits or brackets
// inside a string are never mistaken for numbers or punctuation.
const TOKEN_PATTERN = /("(?:[^"\\]|\\.)*")(\s*:)?|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(true|false)\b|\b(null)\b|([{}[\],])/g;

// Above this many characters, colouring costs more time than it is worth.
const PLAIN_TEXT_LIMIT = 2_000_000;

const wrapToken = (cssClass, text) => `<span class="${cssClass}">${escapeHtml(text)}</span>`;

function tokenToHtml(match) {
  const [, stringToken, colonAfterKey, numberToken, booleanToken, nullToken, punctuationToken] = match;

  if (stringToken !== undefined) {
    return colonAfterKey !== undefined
      ? wrapToken('token-key', stringToken) + wrapToken('token-punctuation', colonAfterKey)
      : wrapToken('token-string', stringToken);
  }
  if (numberToken !== undefined) return wrapToken('token-number', numberToken);
  if (booleanToken !== undefined) return wrapToken('token-boolean', booleanToken);
  if (nullToken !== undefined) return wrapToken('token-null', nullToken);
  return wrapToken('token-punctuation', punctuationToken);
}

export function highlightLine(line) {
  let html = '';
  let lastIndex = 0;

  for (const match of line.matchAll(TOKEN_PATTERN)) {
    html += escapeHtml(line.slice(lastIndex, match.index));
    html += tokenToHtml(match);
    lastIndex = match.index + match[0].length;
  }
  return html + escapeHtml(line.slice(lastIndex));
}

/**
 * Fills the code element with one numbered, coloured line per line of text.
 * @param {{ wrapLines: boolean }} options wrap long lines instead of scrolling sideways
 */
export function renderHighlightedCode(codeElement, text, { wrapLines }) {
  codeElement.classList.toggle('is-wrapped', wrapLines);
  codeElement.classList.toggle('is-plain', text.length > PLAIN_TEXT_LIMIT);

  if (text.length > PLAIN_TEXT_LIMIT) {
    codeElement.textContent = text;
    return;
  }
  codeElement.innerHTML = text
    .split('\n')
    .map((line) => `<span class="code-line">${highlightLine(line) || ' '}</span>`)
    .join('');
}
