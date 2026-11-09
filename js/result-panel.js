/**
 * Draws the result pane and the status line: the empty state, the error card,
 * or the formatted output with its tree and statistics.
 */
import { escapeHtml } from './html.js';
import { getLineAndColumn } from './syntax-checker.js';
import { describeStructure } from './json-engine.js';
import { renderHighlightedCode } from './highlighter.js';
import { renderTree } from './tree-view.js';

// How many characters of the error's line to show around the error.
const SNIPPET_WIDTH = 90;

/**
 * @param elements the DOM elements this panel draws into
 * @param actions  callbacks for the error card buttons: { onRepair, onShowInInput }
 */
export function createResultPanel(elements, actions) {
  const { textView, codeElement, treeRoot, selectedPath, statusChip, stats } = elements;

  function setStatus(status, label) {
    statusChip.classList.toggle('is-valid', status === 'valid');
    statusChip.classList.toggle('is-invalid', status === 'invalid');
    statusChip.textContent = label;
  }

  function showMessage(container, html) {
    container.innerHTML = `<div class="empty-message">${html}</div>`;
  }

  function showEmpty() {
    showMessage(textView, '<strong>Nothing to format yet.</strong><br>'
      + 'Paste JSON into the input, drop a .json file on it, or press Sample to try an example order.');
    showMessage(treeRoot, 'The tree appears once the input is valid JSON.');
    setStatus('waiting', 'Waiting for input');
    stats.textContent = '';
  }

  /** @returns {{ position: number, line: number }} where the error is, for "Show in input" */
  function showError(text, error, { canRepair }) {
    const { line, column, lineStart } = getLineAndColumn(text, error.position);
    const { snippet, caretOffset } = buildErrorSnippet(text, lineStart, column);
    const repairButton = canRepair
      ? '<button type="button" class="primary" data-action="repair">Repair JSON</button>'
      : '';

    textView.innerHTML = `
      <div class="error-card">
        <h2>Line ${line}, column ${column}</h2>
        <p>${escapeHtml(error.message)}</p>
        <pre>${escapeHtml(snippet)}\n<span class="error-caret">${' '.repeat(caretOffset)}^</span></pre>
        <div class="error-actions">
          ${repairButton}
          <button type="button" data-action="show-in-input">Show in input</button>
        </div>
      </div>`;
    textView.querySelector('[data-action="repair"]')?.addEventListener('click', actions.onRepair);
    textView.querySelector('[data-action="show-in-input"]').addEventListener('click', actions.onShowInInput);

    showMessage(treeRoot, `Fix the error on line ${line} to see the tree.`);
    setStatus('invalid', 'Invalid JSON');
    stats.innerHTML = `<span>Error at <b>line ${line}, col ${column}</b></span>`;
    return { position: error.position, line };
  }

  function showResult({ inputText, outputText, data, isMinified }) {
    textView.replaceChildren(codeElement);
    renderHighlightedCode(codeElement, outputText, { wrapLines: isMinified });
    renderTree(treeRoot, data);
    selectedPath.textContent = '$';
    setStatus('valid', isMinified ? 'Valid · minified' : 'Valid JSON');
    stats.innerHTML = buildStatsHtml(inputText, outputText, describeStructure(data));
  }

  return { showEmpty, showError, showResult };
}

/** Returns the line with the error, shortened around the error if long, and where the ^ goes. */
function buildErrorSnippet(text, lineStart, column) {
  const lineEnd = text.includes('\n', lineStart) ? text.indexOf('\n', lineStart) : text.length;
  const line = text.slice(lineStart, lineEnd).replace(/\t/g, ' ');
  const caretOffset = column - 1;

  if (line.length <= SNIPPET_WIDTH) return { snippet: line, caretOffset };

  const start = Math.max(0, caretOffset - SNIPPET_WIDTH / 2);
  const end = start + SNIPPET_WIDTH;
  const prefix = start > 0 ? '…' : '';
  const suffix = end < line.length ? '…' : '';
  return {
    snippet: prefix + line.slice(start, end) + suffix,
    caretOffset: caretOffset - start + prefix.length,
  };
}

function buildStatsHtml(inputText, outputText, structure) {
  const { valueCount, maxDepth, preservedNumberCount } = structure;
  const items = [
    `Input <b>${formatBytes(byteLength(inputText))}</b> → output <b>${formatBytes(byteLength(outputText))}</b>`,
    `<b>${valueCount.toLocaleString()}</b> values`,
    `Depth <b>${maxDepth}</b>`,
  ];
  let html = items.map((item) => `<span>${item}</span>`).join('');

  if (preservedNumberCount > 0) {
    const noun = preservedNumberCount === 1 ? 'number' : 'numbers';
    html += `<span title="Plain JSON.parse would round these. Brace keeps them exactly as written.">`
      + `<b>${preservedNumberCount.toLocaleString()}</b> ${noun} kept exact</span>`;
  }
  return html;
}

function byteLength(text) {
  return new TextEncoder().encode(text).length;
}

function formatBytes(bytes) {
  const kilobyte = 1024;
  const megabyte = kilobyte * 1024;
  if (bytes < kilobyte) return `${bytes} B`;
  if (bytes < megabyte) return `${(bytes / kilobyte).toFixed(1)} KB`;
  return `${(bytes / megabyte).toFixed(2)} MB`;
}
