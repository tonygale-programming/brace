/**
 * The one field: a transparent textarea laid over a coloured copy of the same text,
 * with line numbers on the left.
 *
 * Why two layers: a textarea can't colour its text, and a full code editor would be a large
 * library. Both layers use the same font, size and line height and share one grid cell, so every
 * character lines up, and the outer .editor scrolls them together.
 */
import { escapeHtml } from './html.js';
import { highlightLine } from './highlighter.js';

// Above this many characters, colouring on every keystroke would make typing slow.
const COLOUR_LIMIT = 200_000;
const LINES_SHOWN_ABOVE_ERROR = 3;

/**
 * @param elements { container, input, highlight, gutter }: the .editor, its textarea, the coloured
 *                 <pre> and the line-number column
 */
export function createEditor({ container, input, highlight, gutter }) {
  let errorLine = null;

  const lineHtml = (contentHtml, lineNumber) => (lineNumber === errorLine
    ? `<span class="has-error">${contentHtml}</span>`
    : `<span>${contentHtml}</span>`);

  function render() {
    const text = input.value;
    const lines = text.split('\n');
    const isPlain = text.length > COLOUR_LIMIT;

    container.classList.toggle('is-plain', isPlain);
    gutter.innerHTML = lines.map((line, index) => lineHtml(String(index + 1), index + 1)).join('');

    // In plain mode the copy is hidden but still sized by the text, so the field keeps its size.
    highlight.innerHTML = isPlain
      ? escapeHtml(`${text} `)
      : lines.map((line, index) => lineHtml(highlightLine(line) || ' ', index + 1)).join('');
  }

  function getText() {
    return input.value;
  }

  /**
   * Replaces the whole text. By default it goes through the browser's editing command, so
   * Ctrl/⌘+Z brings the old text back; returns false if the browser refused and Undo won't work.
   */
  function setText(text, { undoable = true } = {}) {
    let replaced = false;
    if (undoable) {
      input.focus({ preventScroll: true });
      input.select();
      try {
        replaced = document.execCommand('insertText', false, text) && input.value === text;
      } catch {
        replaced = false;
      }
    }
    if (!replaced) input.value = text;

    input.setSelectionRange(0, 0);
    container.scrollTop = 0;
    container.scrollLeft = 0;
    render();
    return replaced;
  }

  /** Marks one line as the error's line, or none with null. */
  function markErrorLine(lineNumber) {
    if (lineNumber === errorLine) return;
    errorLine = lineNumber;
    render();
  }

  /** Puts the cursor on a position and scrolls so a few lines above it stay visible. */
  function showPosition(position, lineNumber) {
    input.focus({ preventScroll: true });
    input.setSelectionRange(position, Math.min(position + 1, input.value.length));
    const lineHeight = parseFloat(getComputedStyle(input).lineHeight) || 20;
    container.scrollTop = Math.max(0, (lineNumber - 1 - LINES_SHOWN_ABOVE_ERROR) * lineHeight);
  }

  input.addEventListener('input', render);
  render();

  return { getText, setText, markErrorLine, showPosition, render };
}
