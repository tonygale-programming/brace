/**
 * Brace JSON Formatter: entry point.
 * Connects the page controls to the JSON tools and keeps the app's small state.
 */
import { readJson, stringifyJson, sortKeysDeep, repairJson, canRepair } from './json-engine.js';
import { getLineAndColumn } from './syntax-checker.js';
import { createResultPanel } from './result-panel.js';
import { expandAll, collapseAll, selectNode, EXPAND_ALL_LIMIT } from './tree-view.js';
import { showToast, copyToClipboard, MODIFIER_KEY_LABEL, LONG_TOAST_MS } from './notifications.js';
import { loadSetting, saveSetting } from './storage.js';
import { getSavedTheme, applyTheme, chooseTheme } from './theme.js';

const TYPING_DELAY_MS = 180;
const MAX_SAVED_DRAFT_LENGTH = 500_000; // characters; larger inputs are not remembered
const LINES_SHOWN_ABOVE_ERROR = 3;
const BYTE_ORDER_MARK = /^﻿/;

const SAMPLE_JSON = '{"order":{"id":"ORD-20419","placedAt":"2026-11-08T09:41:27Z","status":"shipped","customer":{"name":"Mara Lindqvist","email":"mara@example.com","loyaltyTier":"gold"},"items":[{"sku":"KB-7720","title":"Mechanical keyboard, 75% layout","qty":1,"unitPrice":129.0},{"sku":"CB-0031","title":"Braided USB-C cable, 2 m","qty":2,"unitPrice":14.5}],"shipping":{"carrier":"DHL","tracking":"JD014600006281990","address":{"line1":"Sveavägen 44","city":"Stockholm","postcode":"111 34","country":"SE"}},"totals":{"subtotal":158.0,"shipping":0,"tax":39.5,"currency":"EUR"},"giftWrap":false,"notes":null}}';

const getElement = (id) => document.getElementById(id);

const elements = {
  input: getElement('json-input'),
  inputPane: getElement('input-pane'),
  sampleBadge: getElement('sample-badge'),
  fileInput: getElement('file-input'),
  indentSelect: getElement('indent-select'),
  sortKeysCheckbox: getElement('sort-keys-checkbox'),
  formatButton: getElement('format-button'),
  minifyButton: getElement('minify-button'),
  sampleButton: getElement('sample-button'),
  repairButton: getElement('repair-button'),
  clearButton: getElement('clear-button'),
  copyButton: getElement('copy-button'),
  textTab: getElement('text-tab'),
  treeTab: getElement('tree-tab'),
  textView: getElement('text-view'),
  treeView: getElement('tree-view'),
  treeActions: getElement('tree-actions'),
  expandButton: getElement('expand-button'),
  collapseButton: getElement('collapse-button'),
  treeRoot: getElement('tree-root'),
  codeElement: getElement('formatted-code'),
  pathBar: getElement('path-bar'),
  selectedPath: getElement('selected-path'),
  copyPathButton: getElement('copy-path-button'),
  statusChip: getElement('status-chip'),
  stats: getElement('stats'),
  modifierKey: getElement('modifier-key'),
  themeButtons: document.querySelectorAll('[data-theme-choice]'),
};

const state = {
  mode: 'format',      // 'format' or 'minify'
  output: '',          // the latest valid result, used by Copy
  errorLocation: null, // { position, line } of the current error, used by "Show in input"
};

let typingTimer = null;

const resultPanel = createResultPanel(elements, {
  onRepair: repairInput,
  onShowInInput: showErrorInInput,
});

/* ---------- Formatting ---------- */

function getIndent() {
  const choice = elements.indentSelect.value;
  return choice === 'tab' ? '\t' : Number(choice);
}

/** Reads the input and shows the result, an error, or the empty state. */
function updateResult(newMode) {
  if (newMode) state.mode = newMode;
  state.output = '';
  state.errorLocation = null;

  const text = elements.input.value.replace(BYTE_ORDER_MARK, '');
  if (!text.trim()) {
    resultPanel.showEmpty();
    return;
  }

  const { data, error } = readJson(text);
  if (error) {
    state.errorLocation = resultPanel.showError(text, error, { canRepair: canRepair && error.repairable });
    return;
  }

  const isMinified = state.mode === 'minify';
  const orderedData = elements.sortKeysCheckbox.checked ? sortKeysDeep(data) : data;
  state.output = isMinified ? stringifyJson(orderedData) : stringifyJson(orderedData, getIndent());
  resultPanel.showResult({ inputText: text, outputText: state.output, data: orderedData, isMinified });
}

function showErrorInInput() {
  const { input } = elements;
  const location = state.errorLocation;
  if (!location) return;

  input.focus();
  input.setSelectionRange(location.position, Math.min(location.position + 1, input.value.length));
  const lineHeight = parseFloat(getComputedStyle(input).lineHeight) || 20;
  input.scrollTop = Math.max(0, (location.line - 1 - LINES_SHOWN_ABOVE_ERROR) * lineHeight);
}

/* ---------- Input ---------- */

function setInputText(text, { isSample = false } = {}) {
  elements.input.value = text;
  elements.sampleBadge.hidden = !isSample;
  updateResult('format');
}

function saveDraft(text) {
  if (text.length <= MAX_SAVED_DRAFT_LENGTH) saveSetting('draft', text);
}

function handleTyping() {
  elements.sampleBadge.hidden = true;
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => {
    updateResult();
    saveDraft(elements.input.value);
  }, TYPING_DELAY_MS);
}

function clearInput() {
  setInputText('');
  saveSetting('draft', '');
  elements.input.focus();
}

function openFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    setInputText(String(reader.result));
    showToast(`Opened ${file.name}`);
  };
  reader.onerror = () => showToast(`Could not read ${file.name}`);
  reader.readAsText(file);
}

/* ---------- Repair ---------- */

/**
 * Replaces the whole input using the browser's editing command, so Undo brings
 * the original back. Returns false if the browser refused and we had to set the
 * value directly; Undo will not work in that case.
 */
function replaceInputUndoably(text) {
  const { input } = elements;
  input.focus();
  input.select();

  let replaced = false;
  try {
    replaced = document.execCommand('insertText', false, text) && input.value === text;
  } catch {
    replaced = false;
  }
  if (!replaced) input.value = text;

  input.setSelectionRange(0, 0);
  input.scrollTop = 0;
  return replaced;
}

function repairInput() {
  const text = elements.input.value;
  if (!text.trim()) {
    showToast('Nothing to repair yet');
    return;
  }
  if (!canRepair) {
    showToast('Repair is unavailable because its library did not load. Check your connection and reload.', LONG_TOAST_MS);
    return;
  }
  if (!readJson(text).error) {
    showToast('This is already valid JSON');
    return;
  }

  let repairedText;
  try {
    repairedText = repairJson(text);
  } catch (error) {
    const lineHint = typeof error.position === 'number'
      ? ` (line ${getLineAndColumn(text, error.position).line})`
      : '';
    showToast(`Could not repair this automatically${lineHint}. Fix it by hand using the error details.`, LONG_TOAST_MS);
    return;
  }
  if (repairedText === text) {
    showToast('Repair cannot fix this one. Fix it by hand using the error details.', LONG_TOAST_MS);
    return;
  }

  const canUndo = replaceInputUndoably(repairedText);
  clearTimeout(typingTimer); // the replacement counts as typing; update right away instead
  elements.sampleBadge.hidden = true;
  updateResult('format');
  saveDraft(repairedText);
  showToast(canUndo ? `Repaired. Press ${MODIFIER_KEY_LABEL}+Z to undo.` : 'Repaired', LONG_TOAST_MS);
}

/* ---------- Result tabs and tree ---------- */

function showTab(tabName) {
  const isTree = tabName === 'tree';
  elements.textTab.setAttribute('aria-selected', String(!isTree));
  elements.treeTab.setAttribute('aria-selected', String(isTree));
  elements.textView.hidden = isTree;
  elements.treeView.hidden = !isTree;
  elements.treeActions.hidden = !isTree;
  elements.pathBar.hidden = !isTree;
  saveSetting('tab', tabName);
}

function selectTreeKey(event) {
  if (!event.target.classList.contains('tree-key')) return;
  event.preventDefault();
  const path = selectNode(elements.treeRoot, event.target);
  if (path) elements.selectedPath.textContent = path;
}

function expandWholeTree() {
  const isComplete = expandAll(elements.treeRoot);
  if (!isComplete) showToast(`Expanded the first ${EXPAND_ALL_LIMIT.toLocaleString()} nodes`);
}

function copyOutput() {
  const message = state.mode === 'minify' ? 'Copied minified JSON' : 'Copied formatted JSON';
  copyToClipboard(state.output, message, elements.codeElement);
}

/* ---------- Theme ---------- */

function showChosenTheme(theme) {
  for (const button of elements.themeButtons) {
    button.setAttribute('aria-pressed', String(button.dataset.themeChoice === theme));
  }
}

function handleThemeClick(event) {
  const theme = event.currentTarget.dataset.themeChoice;
  chooseTheme(theme);
  showChosenTheme(theme);
}

/* ---------- Events ---------- */

const isFileDrag = (event) => Boolean(event.dataTransfer?.types.includes('Files'));

function bindFileDrop() {
  const { inputPane } = elements;

  const showDropTarget = (event) => {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    inputPane.classList.add('is-dragging');
  };
  const hideDropTarget = () => inputPane.classList.remove('is-dragging');

  inputPane.addEventListener('dragenter', showDropTarget);
  inputPane.addEventListener('dragover', showDropTarget);
  inputPane.addEventListener('dragleave', hideDropTarget);
  inputPane.addEventListener('drop', (event) => {
    hideDropTarget();
    if (!event.dataTransfer?.files.length) return;
    event.preventDefault();
    openFile(event.dataTransfer.files[0]);
  });
}

function handleShortcut(event) {
  const isModifierPressed = event.metaKey || event.ctrlKey;
  if (!isModifierPressed || event.key !== 'Enter') return;
  event.preventDefault();
  updateResult(event.shiftKey ? 'minify' : 'format');
}

function bindEvents() {
  elements.input.addEventListener('input', handleTyping);
  elements.formatButton.addEventListener('click', () => updateResult('format'));
  elements.minifyButton.addEventListener('click', () => updateResult('minify'));

  elements.indentSelect.addEventListener('change', () => {
    saveSetting('indent', elements.indentSelect.value);
    updateResult('format');
  });
  elements.sortKeysCheckbox.addEventListener('change', () => {
    saveSetting('sort', elements.sortKeysCheckbox.checked ? '1' : '');
    updateResult();
  });

  elements.sampleButton.addEventListener('click', () => setInputText(SAMPLE_JSON, { isSample: true }));
  elements.clearButton.addEventListener('click', clearInput);
  elements.repairButton.hidden = !canRepair;
  elements.repairButton.addEventListener('click', repairInput);
  elements.fileInput.addEventListener('change', () => {
    openFile(elements.fileInput.files[0]);
    elements.fileInput.value = ''; // lets the same file be opened again
  });
  bindFileDrop();

  elements.copyButton.addEventListener('click', copyOutput);
  elements.textTab.addEventListener('click', () => showTab('text'));
  elements.treeTab.addEventListener('click', () => showTab('tree'));
  elements.expandButton.addEventListener('click', expandWholeTree);
  elements.collapseButton.addEventListener('click', () => collapseAll(elements.treeRoot));
  elements.treeRoot.addEventListener('click', selectTreeKey);
  elements.treeRoot.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') selectTreeKey(event);
  });
  elements.copyPathButton.addEventListener('click', () => {
    copyToClipboard(elements.selectedPath.textContent, 'Copied path', elements.selectedPath);
  });

  for (const button of elements.themeButtons) {
    button.addEventListener('click', handleThemeClick);
  }

  document.addEventListener('keydown', handleShortcut);
}

/* ---------- Start ---------- */

function restorePreferences() {
  const savedTheme = getSavedTheme();
  applyTheme(savedTheme);
  showChosenTheme(savedTheme);

  const savedIndent = loadSetting('indent');
  const indentChoices = [...elements.indentSelect.options].map((option) => option.value);
  if (indentChoices.includes(savedIndent)) elements.indentSelect.value = savedIndent;

  elements.sortKeysCheckbox.checked = loadSetting('sort') === '1';
  if (loadSetting('tab') === 'tree') showTab('tree');
}

function loadInitialInput() {
  const draft = loadSetting('draft');
  if (draft?.trim()) setInputText(draft);
  else setInputText(SAMPLE_JSON, { isSample: true });
}

elements.modifierKey.textContent = MODIFIER_KEY_LABEL;
bindEvents();
restorePreferences();
loadInitialInput();
