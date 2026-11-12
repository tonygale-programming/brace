/**
 * The status row under the field: a chip that says whether the JSON is valid,
 * then figures about it, or the place of the error as a button that jumps there.
 */
import { describeStructure } from './json-engine.js';

/** @param elements { chip, label, stats, errorPosition } */
export function createStatusBar({ chip, label, stats, errorPosition }) {
  function setChip(status, text) {
    chip.classList.toggle('is-valid', status === 'valid');
    chip.classList.toggle('is-invalid', status === 'invalid');
    label.textContent = text;
  }

  function showWaiting() {
    setChip('waiting', 'Waiting for input');
    stats.textContent = '';
    errorPosition.hidden = true;
  }

  function showValid(text, data) {
    setChip('valid', 'Valid JSON');
    stats.innerHTML = buildStatsHtml(text, describeStructure(data));
    errorPosition.hidden = true;
  }

  /** @param location { line, column } */
  function showInvalid({ line, column }) {
    setChip('invalid', 'Invalid JSON');
    stats.textContent = '';
    errorPosition.textContent = `Line ${line}, column ${column}`;
    errorPosition.hidden = false;
  }

  return { showWaiting, showValid, showInvalid };
}

function buildStatsHtml(text, structure) {
  const { valueCount, maxDepth, preservedNumberCount } = structure;
  const items = [
    `<b>${formatBytes(byteLength(text))}</b>`,
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
