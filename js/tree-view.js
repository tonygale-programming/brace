/**
 * The collapsible tree view of parsed JSON.
 *
 * Each object or array is a <details> element. Its children are only built the first
 * time it opens, so even very large documents render quickly.
 */
import { escapeHtml } from './html.js';
import { isPrimitive, getNumberText } from './json-engine.js';

const AUTO_EXPAND_DEPTH = 2;
const AUTO_EXPAND_MAX_CHILDREN = 200;
export const EXPAND_ALL_LIMIT = 5000;

const IDENTIFIER_PATTERN = /^[A-Za-z_$][\w$]*$/;

// <details> element → { value, path, depth, childrenRendered }
const containerData = new WeakMap();

// Row or <summary> element → the value it shows, for "Copy value"
const rowValues = new WeakMap();

/** Builds a JSONPath-style path such as $.order.items[0]["first name"]. */
function getChildPath(parentPath, key, parentIsArray) {
  if (parentIsArray) return `${parentPath}[${key}]`;
  if (IDENTIFIER_PATTERN.test(key)) return `${parentPath}.${key}`;
  return `${parentPath}[${JSON.stringify(key)}]`;
}

function countChildren(value) {
  return Array.isArray(value) ? value.length : Object.keys(value).length;
}

function keyHtml(key, isArrayIndex) {
  if (key === undefined) return '<span class="tree-key" tabindex="0">$</span> ';

  const label = isArrayIndex ? String(key) : JSON.stringify(key);
  const cssClass = isArrayIndex ? 'tree-key array-index' : 'tree-key';
  return `<span class="${cssClass}" tabindex="0">${escapeHtml(label)}</span><span class="token-punctuation">: </span>`;
}

function primitiveHtml(value) {
  if (value === null) return '<span class="token-null">null</span>';
  if (typeof value === 'string') return `<span class="token-string">${escapeHtml(JSON.stringify(value))}</span>`;
  if (typeof value === 'boolean') return `<span class="token-boolean">${value}</span>`;
  return `<span class="token-number">${escapeHtml(getNumberText(value))}</span>`;
}

function containerSummaryHtml(key, value, isArrayIndex) {
  const isArray = Array.isArray(value);
  const childCount = countChildren(value);
  const singular = isArray ? 'item' : 'key';
  const noun = childCount === 1 ? singular : `${singular}s`;
  const [openingBracket, closingBracket] = isArray ? ['[', ']'] : ['{', '}'];

  return keyHtml(key, isArrayIndex)
    + `<span class="token-punctuation">${openingBracket}</span>`
    + `<span class="child-count">${childCount} ${noun}</span>`
    + `<span class="token-punctuation">${closingBracket}</span>`;
}

function createPrimitiveRow({ key, value, path, isArrayIndex }) {
  const row = document.createElement('div');
  row.className = 'tree-leaf';
  row.dataset.path = path;
  row.innerHTML = keyHtml(key, isArrayIndex) + primitiveHtml(value);
  rowValues.set(row, value);
  return row;
}

function createContainer({ key, value, path, depth, isArrayIndex }) {
  const container = document.createElement('details');
  const summary = document.createElement('summary');
  summary.dataset.path = path;
  summary.innerHTML = containerSummaryHtml(key, value, isArrayIndex);
  rowValues.set(summary, value);
  container.append(summary);

  containerData.set(container, { value, path, depth, childrenRendered: false });
  container.addEventListener('toggle', () => {
    if (container.open) renderChildren(container);
  });

  const isSmallAndNearTop = depth < AUTO_EXPAND_DEPTH && countChildren(value) <= AUTO_EXPAND_MAX_CHILDREN;
  if (isSmallAndNearTop) {
    renderChildren(container);
    container.open = true;
  }
  return container;
}

function createNode(node) {
  return isPrimitive(node.value) ? createPrimitiveRow(node) : createContainer(node);
}

function renderChildren(container) {
  const data = containerData.get(container);
  if (!data || data.childrenRendered) return;
  data.childrenRendered = true;

  const { value, path, depth } = data;
  const isArray = Array.isArray(value);
  const childList = document.createElement('div');
  childList.className = 'tree-children';

  for (const key of Object.keys(value)) {
    childList.append(createNode({
      key,
      value: value[key],
      path: getChildPath(path, key, isArray),
      depth: depth + 1,
      isArrayIndex: isArray,
    }));
  }
  container.append(childList);
}

export function renderTree(rootElement, data) {
  const rootNode = createNode({ key: undefined, value: data, path: '$', depth: 0, isArrayIndex: false });
  rootElement.replaceChildren(rootNode);
}

/** Opens every node, up to EXPAND_ALL_LIMIT. Returns false if the limit stopped it early. */
export function expandAll(rootElement) {
  let openedCount = 0;
  let closedNodes = rootElement.querySelectorAll('details:not([open])');

  while (closedNodes.length > 0 && openedCount < EXPAND_ALL_LIMIT) {
    for (const node of closedNodes) {
      if (openedCount >= EXPAND_ALL_LIMIT) break;
      renderChildren(node);
      node.open = true;
      openedCount++;
    }
    closedNodes = rootElement.querySelectorAll('details:not([open])');
  }
  return closedNodes.length === 0;
}

/** Closes everything except the top level. */
export function collapseAll(rootElement) {
  rootElement.querySelectorAll('details').forEach((node, index) => {
    node.open = index === 0;
  });
}

/** Highlights the row of a clicked key and returns { path, value }, or null if it has none. */
export function selectNode(rootElement, keyElement) {
  const row = keyElement.closest('[data-path]');
  if (!row) return null;

  rootElement.querySelectorAll('.selected').forEach((element) => element.classList.remove('selected'));
  row.classList.add('selected');
  return { path: row.dataset.path, value: rowValues.get(row) };
}
