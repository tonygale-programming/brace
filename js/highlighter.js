/**
 * Colours one line of JSON text, for the editor's coloured layer.
 * It works on any text, valid or not, so colours keep up while someone types.
 */
import { escapeHtml } from './html.js';

// One token of JSON. Strings are matched first, so digits or brackets
// inside a string are never mistaken for numbers or punctuation.
const TOKEN_PATTERN = /("(?:[^"\\]|\\.)*")(\s*:)?|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(true|false)\b|\b(null)\b|([{}[\],:])/g;

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
