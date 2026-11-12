/**
 * Keyboard shortcuts, and how keys are named on this platform.
 *
 * Most shortcuts are Shift+Option (Mac) or Shift+Alt plus a letter: browsers leave these free, and
 * developers know Shift+Option+F as "Format document" from VS Code. The only ⌘/Ctrl ones are those that
 * mean the same everywhere (Open, Save). Keys a page can't or shouldn't take over, such as ⌘T (new tab),
 * ⌘M (minimise), ⌘F (find) or ⌘R (reload), are left alone.
 *
 * One list describes every shortcut; it drives the key handling, the shortcuts dialog and button tooltips.
 */
import { escapeHtml } from './html.js';

const isApplePlatform = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

const KEY_LABELS = isApplePlatform
  ? { command: '⌘', shift: '⇧', option: '⌥', separator: '' }
  : { command: 'Ctrl', shift: 'Shift', option: 'Alt', separator: '+' };

/**
 * A key combination: { key, code, character, command, shift, option }.
 * key is what people read ("F"); code is the physical key (event.code, "KeyF"), because on a Mac
 * Option changes the character a letter types. character matches what is typed instead, for keys like "?"
 * that need Shift on some keyboards and not others. Without code or character, the combination is only
 * shown, not handled (Undo, which the browser already does).
 */
function keyNames({ key, command = false, shift = false, option = false }) {
  return [command && KEY_LABELS.command, shift && KEY_LABELS.shift, option && KEY_LABELS.option, key].filter(Boolean);
}

/** For example "⇧⌥F" on a Mac and "Shift+Alt+F" elsewhere. */
export function describeKeys(keys) {
  return keyNames(keys).join(KEY_LABELS.separator);
}

function matches(keys, event) {
  const isCommand = event.metaKey || event.ctrlKey;
  if (keys.character) return event.key === keys.character && !isCommand && !event.altKey;
  return keys.code === event.code
    && Boolean(keys.command) === isCommand
    && Boolean(keys.shift) === event.shiftKey
    && Boolean(keys.option) === event.altKey;
}

const isTypingInAField = (target) => target.matches('textarea, input, select');

/**
 * @param shortcuts list of { label, group, keys: [combination, …], run, button?, notWhileTyping? }
 */
export function bindShortcuts(shortcuts) {
  document.addEventListener('keydown', (event) => {
    const shortcut = shortcuts.find((candidate) => candidate.run
      && candidate.keys.some((keys) => matches(keys, event)));
    if (!shortcut) return;
    if (shortcut.notWhileTyping && isTypingInAField(event.target)) return;
    event.preventDefault();
    shortcut.run();
  });

  // Tooltips name the first shortcut, so people find them while using the buttons
  for (const { button, keys, label } of shortcuts) {
    if (!button) continue;
    const description = button.title || label;
    button.title = `${description} (${describeKeys(keys[0])})`;
  }
}

/** Fills the shortcuts dialog: a heading per group, then each action with its keys. */
export function renderShortcutList(container, shortcuts) {
  const groups = [...new Set(shortcuts.map((shortcut) => shortcut.group))];
  container.innerHTML = groups.map((group) => {
    const rows = shortcuts.filter((shortcut) => shortcut.group === group).map((shortcut) => {
      const keyCaps = shortcut.keys
        .map((keys) => keyNames(keys).map((name) => `<kbd>${escapeHtml(name)}</kbd>`).join(''))
        .join('<span class="shortcut-or">or</span>');
      return `<dt>${escapeHtml(shortcut.label)}</dt><dd>${keyCaps}</dd>`;
    }).join('');
    return `<h3>${escapeHtml(group)}</h3><dl class="shortcut-list">${rows}</dl>`;
  }).join('');
}
