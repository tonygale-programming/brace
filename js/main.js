/**
 * Brace JSON Formatter: entry point.
 *
 * One field holds the JSON. Format, Minify and Stringify rewrite it in place (Ctrl/⌘+Z goes back),
 * and everything else follows whatever is in the field: the status row, the error card,
 * which buttons can be used, and the tree.
 */
import {
  readJson, stringifyJson, stringifyAsEscapedString, unwrapStringifiedJson, sortKeysDeep, repairJson, canRepair,
} from './json-engine.js';
import { getLineAndColumn } from './syntax-checker.js';
import { createEditor } from './editor.js';
import { createErrorCard } from './error-card.js';
import { createStatusBar } from './status-bar.js';
import { renderTree, expandAll, collapseAll, selectNode, EXPAND_ALL_LIMIT } from './tree-view.js';
import { showToast, copyToClipboard, LONG_TOAST_MS } from './notifications.js';
import { bindShortcuts, renderShortcutList } from './keyboard.js';
import { saveTextAsFile } from './download.js';
import { loadSetting, saveSetting } from './storage.js';
import { toggleTheme } from './theme.js';
import { enableOfflineUse } from './offline.js';

const TYPING_DELAY_MS = 180;
const MAX_SAVED_DRAFT_LENGTH = 500_000; // characters; larger inputs are not remembered
const BYTE_ORDER_MARK = /^﻿/;
const DEFAULT_FILE_NAME = 'brace.json';

const SAMPLE_JSON = '{"order":{"id":"ORD-20419","placedAt":"2026-11-08T09:41:27Z","status":"shipped","customer":{"name":"Mara Lindqvist","email":"mara@example.com","loyaltyTier":"gold"},"items":[{"sku":"KB-7720","title":"Mechanical keyboard, 75% layout","qty":1,"unitPrice":129.0},{"sku":"CB-0031","title":"Braided USB-C cable, 2 m","qty":2,"unitPrice":14.5}],"shipping":{"carrier":"DHL","tracking":"JD014600006281990","address":{"line1":"Sveavägen 44","city":"Stockholm","postcode":"111 34","country":"SE"}},"totals":{"subtotal":158.0,"shipping":0,"tax":39.5,"currency":"EUR"},"giftWrap":false,"notes":null}}';

const getElement = (id) => document.getElementById(id);

const elements = {
  editorPane: getElement('editor-pane'),
  editor: getElement('editor'),
  input: getElement('json-input'),
  fileInput: getElement('file-input'),
  formatButton: getElement('format-button'),
  minifyButton: getElement('minify-button'),
  stringifyButton: getElement('stringify-button'),
  indentSelect: getElement('indent-select'),
  sortKeysButton: getElement('sort-keys-button'),
  sampleButton: getElement('sample-button'),
  repairButton: getElement('repair-button'),
  clearButton: getElement('clear-button'),
  textTab: getElement('text-tab'),
  treeTab: getElement('tree-tab'),
  treeView: getElement('tree-view'),
  treeRoot: getElement('tree-root'),
  expandToggle: getElement('expand-toggle'),
  pathBar: getElement('path-bar'),
  selectedPath: getElement('selected-path'),
  copyPathButton: getElement('copy-path-button'),
  copyValueButton: getElement('copy-value-button'),
  errorRepairButton: getElement('error-repair-button'),
  errorShowButton: getElement('error-show-button'),
  downloadButton: getElement('download-button'),
  copyButton: getElement('copy-button'),
  themeButton: getElement('theme-button'),
  shortcutsButton: getElement('shortcuts-button'),
  shortcutsDialog: getElement('shortcuts-dialog'),
  shortcutsCloseButton: getElement('shortcuts-close-button'),
};

const editor = createEditor({
  container: elements.editor,
  input: elements.input,
  highlight: getElement('editor-highlight'),
  gutter: getElement('editor-gutter'),
});

const errorCard = createErrorCard({
  card: getElement('error-card'),
  title: getElement('error-title'),
  message: getElement('error-message'),
  snippet: getElement('error-snippet'),
  repairButton: elements.errorRepairButton,
});

const statusBar = createStatusBar({
  chip: getElement('status-chip'),
  label: getElement('status-label'),
  stats: getElement('stats'),
});

const state = {
  lastAction: 'format',     // 'format', 'minify' or 'stringify': re-applied when Sort keys changes
  parsed: null,             // { data, isStringified } while the field holds valid JSON
  unsortedData: null,       // the data before Sort keys was turned on, so turning it off restores the order
  sortedText: null,         // the field's text right after sorting; any edit makes the old order stale
  errorLocation: null,      // { position, line, column } while it doesn't
  view: 'text',             // 'text' or 'tree'
  selectedValue: undefined, // the tree node shown in the path bar, for "Copy value"
  fileName: DEFAULT_FILE_NAME,
};

let typingTimer = null;

/* ---------- Following the field ---------- */

function getFieldText() {
  return editor.getText().replace(BYTE_ORDER_MARK, '');
}

/** Checks the field and updates everything that depends on it. */
function refresh() {
  clearTimeout(typingTimer);
  const text = getFieldText();
  state.parsed = null;
  state.errorLocation = null;

  if (!text.trim()) {
    statusBar.showWaiting();
    errorCard.hide();
    editor.markErrorLine(null);
  } else {
    const { data, error } = readJson(text);
    if (error) {
      state.errorLocation = errorCard.show(text, error, { canRepair: canRepair && error.repairable });
      editor.markErrorLine(state.errorLocation.line);
      statusBar.showInvalid();
    } else {
      state.parsed = { data, isStringified: unwrapStringifiedJson(data) !== null };
      errorCard.hide();
      editor.markErrorLine(null);
      statusBar.showValid(text, data);
    }
  }

  updateButtons();
  if (state.view === 'tree') showView(state.parsed ? 'tree' : 'text');
}

/** A control that can't do anything right now is disabled, rather than explaining after the click. */
function updateButtons() {
  const isValid = Boolean(state.parsed);
  const isInvalid = Boolean(state.errorLocation);
  // Format, Minify, Stringify and Indent only shape the text, which the tree view hides.
  // Sort keys stays, because it reorders the tree too.
  const canShapeText = isValid && state.view === 'text';

  for (const button of [elements.downloadButton, elements.copyButton, elements.treeTab]) button.disabled = !isValid;
  elements.formatButton.disabled = !canShapeText;
  elements.minifyButton.disabled = !canShapeText;
  // Text that Stringify made is already one escaped string; stringifying it again would only add backslashes
  elements.stringifyButton.disabled = !canShapeText || state.parsed.isStringified;
  elements.indentSelect.disabled = state.view === 'tree';
  elements.repairButton.disabled = !(isInvalid && canRepair);
  elements.clearButton.disabled = !getFieldText().trim();
}

function handleTyping() {
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => {
    refresh();
    saveDraft(editor.getText());
  }, TYPING_DELAY_MS);
}

function saveDraft(text) {
  if (text.length <= MAX_SAVED_DRAFT_LENGTH) saveSetting('draft', text);
}

/** Replaces the field's text (Ctrl/⌘+Z can bring the old one back) and updates everything. */
function replaceFieldText(text) {
  const canUndo = editor.setText(text);
  refresh();
  saveDraft(text);
  return canUndo;
}

/* ---------- Format, Minify, Stringify ---------- */

function getIndent() {
  const choice = elements.indentSelect.value;
  return choice === 'tab' ? '\t' : Number(choice);
}

const isSortingKeys = () => elements.sortKeysButton.getAttribute('aria-pressed') === 'true';

function buildOutput(data, action) {
  const orderedData = isSortingKeys() ? sortKeysDeep(data) : data;
  if (action === 'minify') return stringifyJson(orderedData);
  if (action === 'stringify') return stringifyAsEscapedString(orderedData);
  return stringifyJson(orderedData, getIndent());
}

/** Rewrites the field as formatted, minified or stringified JSON. */
function applyAction(action) {
  refresh();
  if (!state.parsed) return;

  // Every action starts from the real data, unwrapping text that Stringify made. That lets Format undo a
  // Stringify, and makes pressing Stringify twice give the same result instead of more backslashes.
  const { data } = state.parsed;
  const sourceData = unwrapStringifiedJson(data) ?? data;

  // Edited since sorting: the order the visitor now sees becomes the one to come back to.
  if (isSortingKeys() && editor.getText() !== state.sortedText) state.unsortedData = sourceData;

  state.lastAction = action;
  const output = buildOutput(sourceData, action);
  replaceFieldText(output);
  state.sortedText = isSortingKeys() ? output : null;
}

function changeIndent() {
  saveSetting('indent', elements.indentSelect.value);
  if (state.parsed) applyAction('format');
}

/**
 * On: sorts the keys and remembers the order before. Off: brings that order back, as long as the
 * JSON wasn't edited in between (after an edit the old order no longer matches, so the text stays).
 */
function toggleSortKeys() {
  const isOn = !isSortingKeys();
  elements.sortKeysButton.setAttribute('aria-pressed', String(isOn));
  saveSetting('sort', isOn ? '1' : '');
  if (!state.parsed) return;

  if (isOn) {
    state.unsortedData = unwrapStringifiedJson(state.parsed.data) ?? state.parsed.data;
    state.sortedText = null;
    applyAction(state.lastAction);
    return;
  }
  const isUnchangedSinceSorting = state.unsortedData !== null && editor.getText() === state.sortedText;
  if (isUnchangedSinceSorting) replaceFieldText(buildOutput(state.unsortedData, state.lastAction));
  state.unsortedData = null;
  state.sortedText = null;
}

/** Pasting into an empty field formats it straight away; one Undo brings back what was pasted. */
function handlePaste() {
  if (getFieldText().trim()) return;
  // The pasted text arrives after this event, so wait for it.
  setTimeout(() => {
    refresh();
    if (state.parsed) applyAction('format');
  }, 0);
}

/* ---------- Repair, Sample, Clear, files ---------- */

function repairInput() {
  const text = editor.getText();
  let repairedText;
  try {
    repairedText = repairJson(text);
  } catch (error) {
    const lineHint = typeof error.position === 'number'
      ? ` (line ${getLineAndColumn(text, error.position).line})`
      : '';
    showToast(`Could not repair this automatically${lineHint}. Fix it by hand using the error details.`,
      { durationMs: LONG_TOAST_MS });
    return;
  }
  if (repairedText === text) {
    showToast('Repair cannot fix this one. Fix it by hand using the error details.', { durationMs: LONG_TOAST_MS });
    return;
  }
  replaceFieldText(repairedText); // Ctrl/⌘+Z still brings the original back
  showToast('Repaired');
}

function loadSample() {
  state.fileName = DEFAULT_FILE_NAME;
  replaceFieldText(buildOutput(readJson(SAMPLE_JSON).data, 'format')); // Ctrl/⌘+Z brings back what was there
  showToast('Sample loaded');
}

function clearField() {
  state.fileName = DEFAULT_FILE_NAME;
  replaceFieldText(''); // Ctrl/⌘+Z still brings the text back
  showToast('Cleared');
  elements.input.focus();
}

function openFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    state.fileName = file.name;
    replaceFieldText(String(reader.result));
    if (state.parsed) applyAction('format');
    showToast(`Opened ${file.name}`);
  };
  reader.onerror = () => showToast(`Could not read ${file.name}`);
  reader.readAsText(file);
}

function showErrorInInput() {
  if (!state.errorLocation) return;
  showView('text');
  editor.showPosition(state.errorLocation.position, state.errorLocation.line);
}

/* ---------- Text and Tree ---------- */

function showView(view) {
  const isTree = view === 'tree' && Boolean(state.parsed);
  const wasTree = state.view === 'tree';
  state.view = isTree ? 'tree' : 'text';

  elements.textTab.setAttribute('aria-selected', String(!isTree));
  elements.treeTab.setAttribute('aria-selected', String(isTree));
  elements.editor.hidden = isTree;
  elements.treeView.hidden = !isTree;
  elements.expandToggle.hidden = !isTree;
  elements.pathBar.hidden = !isTree;

  // Rebuild the tree when it opens or the JSON changed under it; keep it while just switching back
  if (isTree && (!wasTree || elements.treeRoot.dataset.source !== editor.getText())) {
    renderTree(elements.treeRoot, state.parsed.data);
    elements.treeRoot.dataset.source = editor.getText();
    elements.selectedPath.textContent = '$';
    elements.expandToggle.setAttribute('aria-expanded', 'false');
    state.selectedValue = state.parsed.data;
  }
  updateButtons();
}

function selectTreeKey(event) {
  if (!event.target.classList.contains('tree-key')) return;
  event.preventDefault();
  const selection = selectNode(elements.treeRoot, event.target);
  if (!selection) return;
  elements.selectedPath.textContent = selection.path;
  state.selectedValue = selection.value;
}

function copySelectedValue() {
  const value = state.selectedValue;
  // A string is copied as its text; anything else as JSON
  const text = typeof value === 'string' ? value : stringifyJson(value, getIndent());
  copyToClipboard(text, 'Copied value', elements.selectedPath);
}

/** One button: Expand all, then Collapse all. Its label always says what the next press does. */
function toggleTreeExpansion() {
  const isExpanded = elements.expandToggle.getAttribute('aria-expanded') === 'true';
  if (isExpanded) {
    collapseAll(elements.treeRoot);
  } else {
    const isComplete = expandAll(elements.treeRoot);
    if (!isComplete) showToast(`Expanded the first ${EXPAND_ALL_LIMIT.toLocaleString()} nodes`);
  }
  elements.expandToggle.setAttribute('aria-expanded', String(!isExpanded));
}

/* ---------- Download and Copy ---------- */

function downloadField() {
  saveTextAsFile(editor.getText(), state.fileName);
  showToast(`Downloaded ${state.fileName}`);
}

function copyField() {
  copyToClipboard(editor.getText(), 'Copied', elements.input);
}

/* ---------- Events ---------- */

const hasFiles = (event) => Boolean(event.dataTransfer?.types.includes('Files'));

/** A file can be dropped anywhere on the page; the field lights up while one is dragged over. */
function bindFileDrop() {
  const showDropTarget = (event) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    elements.editorPane.classList.add('is-dragging');
  };
  const hideDropTarget = () => elements.editorPane.classList.remove('is-dragging');

  document.addEventListener('dragenter', showDropTarget);
  document.addEventListener('dragover', showDropTarget);
  document.addEventListener('dragleave', (event) => {
    if (!event.relatedTarget) hideDropTarget(); // the pointer left the window
  });
  document.addEventListener('drop', (event) => {
    hideDropTarget();
    if (!event.dataTransfer?.files.length) return;
    event.preventDefault();
    openFile(event.dataTransfer.files[0]);
  });
}

/** Presses a button the way a click would, so a shortcut does nothing while its button is disabled. */
function press(button) {
  if (!button.disabled) button.click();
}

function toggleView() {
  if (!elements.treeTab.disabled) showView(state.view === 'tree' ? 'text' : 'tree');
}

/* The one list of shortcuts: it drives the keys, the shortcuts dialog and the button tooltips. */
const SHORTCUTS = [
  { group: 'Change the JSON', label: 'Format', button: elements.formatButton, run: () => press(elements.formatButton),
    keys: [{ shift: true, option: true, key: 'F', code: 'KeyF' }, { command: true, key: 'Enter', code: 'Enter' }] },
  { group: 'Change the JSON', label: 'Minify', button: elements.minifyButton, run: () => press(elements.minifyButton),
    keys: [{ shift: true, option: true, key: 'M', code: 'KeyM' }] },
  { group: 'Change the JSON', label: 'Stringify', button: elements.stringifyButton, run: () => press(elements.stringifyButton),
    keys: [{ shift: true, option: true, key: 'S', code: 'KeyS' }] },
  { group: 'Change the JSON', label: 'Repair', button: elements.repairButton, run: () => press(elements.repairButton),
    keys: [{ shift: true, option: true, key: 'R', code: 'KeyR' }] },
  { group: 'Change the JSON', label: 'Undo the last change',
    keys: [{ command: true, key: 'Z' }] },
  { group: 'File', label: 'Open file', run: () => elements.fileInput.click(),
    keys: [{ command: true, key: 'O', code: 'KeyO' }] },
  { group: 'File', label: 'Download', button: elements.downloadButton, run: () => press(elements.downloadButton),
    keys: [{ command: true, key: 'S', code: 'KeyS' }] },
  { group: 'View', label: 'Switch Text / Tree', run: toggleView,
    keys: [{ shift: true, option: true, key: 'T', code: 'KeyT' }] },
  { group: 'View', label: 'Show shortcuts', button: elements.shortcutsButton,
    run: () => elements.shortcutsDialog.showModal(), notWhileTyping: true,
    keys: [{ key: '?', character: '?' }] },
];

/**
 * Closes a dialog when a click lands on the dimmed area around it. The browser reports those clicks on the
 * dialog itself, so the click's position decides whether it was inside the window or outside.
 */
function closeOnOutsideClick(dialog) {
  dialog.addEventListener('click', (event) => {
    const box = dialog.getBoundingClientRect();
    const isOutside = event.clientX < box.left || event.clientX > box.right
      || event.clientY < box.top || event.clientY > box.bottom;
    if (isOutside) dialog.close();
  });
}

function bindEvents() {
  elements.input.addEventListener('input', handleTyping);
  elements.input.addEventListener('paste', handlePaste);

  elements.formatButton.addEventListener('click', () => applyAction('format'));
  elements.minifyButton.addEventListener('click', () => applyAction('minify'));
  elements.stringifyButton.addEventListener('click', () => applyAction('stringify'));
  elements.indentSelect.addEventListener('change', changeIndent);
  elements.sortKeysButton.addEventListener('click', toggleSortKeys);

  elements.fileInput.addEventListener('change', () => {
    openFile(elements.fileInput.files[0]);
    elements.fileInput.value = ''; // lets the same file be opened again
  });
  elements.sampleButton.addEventListener('click', loadSample);
  elements.repairButton.hidden = !canRepair;
  elements.repairButton.addEventListener('click', repairInput);
  elements.errorRepairButton.addEventListener('click', repairInput);
  elements.clearButton.addEventListener('click', clearField);
  bindFileDrop();

  elements.errorShowButton.addEventListener('click', showErrorInInput);

  elements.textTab.addEventListener('click', () => showView('text'));
  elements.treeTab.addEventListener('click', () => showView('tree'));
  elements.expandToggle.addEventListener('click', toggleTreeExpansion);
  elements.treeRoot.addEventListener('click', selectTreeKey);
  elements.treeRoot.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') selectTreeKey(event);
  });
  elements.copyPathButton.addEventListener('click', () => {
    copyToClipboard(elements.selectedPath.textContent, 'Copied path', elements.selectedPath);
  });
  elements.copyValueButton.addEventListener('click', copySelectedValue);

  elements.downloadButton.addEventListener('click', downloadField);
  elements.copyButton.addEventListener('click', copyField);

  elements.themeButton.addEventListener('click', toggleTheme);
  elements.shortcutsButton.addEventListener('click', () => elements.shortcutsDialog.showModal());
  elements.shortcutsCloseButton.addEventListener('click', () => elements.shortcutsDialog.close());
  closeOnOutsideClick(elements.shortcutsDialog);

  bindShortcuts(SHORTCUTS);
  renderShortcutList(getElement('shortcut-groups'), SHORTCUTS);
}

/* ---------- Start ---------- */

function restorePreferences() {
  const savedIndent = loadSetting('indent');
  const indentChoices = [...elements.indentSelect.options].map((option) => option.value);
  if (indentChoices.includes(savedIndent)) elements.indentSelect.value = savedIndent;
  elements.sortKeysButton.setAttribute('aria-pressed', String(loadSetting('sort') === '1'));
}

function loadInitialText() {
  const draft = loadSetting('draft');
  const initialText = draft?.trim() ? draft : buildOutput(readJson(SAMPLE_JSON).data, 'format');
  editor.setText(initialText, { undoable: false });
  refresh();
}

bindEvents();
restorePreferences();
loadInitialText();
enableOfflineUse();
