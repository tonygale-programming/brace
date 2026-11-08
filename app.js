(() => {
  const $ = (s) => document.querySelector(s);
  const input = $('#input'), code = $('#code'), tree = $('#tree');
  const chip = $('#chip'), stats = $('#stats'), toast = $('#toast');
  const indentSel = $('#indent'), sortBox = $('#sort');

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
  };

  const SAMPLE = '{"order":{"id":"ORD-20419","placedAt":"2026-11-08T09:41:27Z","status":"shipped","customer":{"name":"Mara Lindqvist","email":"mara@example.com","loyaltyTier":"gold"},"items":[{"sku":"KB-7720","title":"Mechanical keyboard, 75% layout","qty":1,"unitPrice":129.0},{"sku":"CB-0031","title":"Braided USB-C cable, 2 m","qty":2,"unitPrice":14.5}],"shipping":{"carrier":"DHL","tracking":"JD014600006281990","address":{"line1":"Sveavägen 44","city":"Stockholm","postcode":"111 34","country":"SE"}},"totals":{"subtotal":158.0,"shipping":0,"tax":39.5,"currency":"EUR"},"giftWrap":false,"notes":null}}';

  let mode = 'format';      // 'format' | 'minify'
  let current = '';         // last good output text
  let lastError = null;     // {pos,line,col}
  let isSample = false;

  const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

  /* ---------- Error location: a strict JSON scanner that reports where and why ---------- */
  function locate(text) {
    let i = 0;
    const n = text.length;
    const fail = (msg, p = i) => { throw { pos: p, msg }; };
    const what = (c) => c === undefined ? 'the end of the input' : (c === '\n' ? 'a line break' : '"' + c + '"');
    const ws = () => { while (i < n && (text[i] === ' ' || text[i] === '\t' || text[i] === '\n' || text[i] === '\r')) i++; };
    const NUM = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;

    function value() {
      ws();
      const c = text[i];
      if (c === '{') return obj();
      if (c === '[') return arr();
      if (c === '"') return str();
      if (c === '-' || (c >= '0' && c <= '9')) return num();
      for (const w of ['true', 'false', 'null']) if (text.startsWith(w, i)) { i += w.length; return; }
      if (c === undefined) fail('The input ends where a value was expected.');
      if (c === "'") fail('Strings must use double quotes, not single quotes.');
      if (c === '/') fail('JSON does not allow comments.');
      if (/[A-Za-z_]/.test(c)) {
        const word = /[A-Za-z_]\w*/y; word.lastIndex = i;
        fail('Unexpected word "' + word.exec(text)[0] + '". Text values need double quotes; literals are true, false and null (lowercase).');
      }
      fail('Expected a value but found ' + what(c) + '.');
    }
    function obj() {
      i++; ws();
      if (text[i] === '}') { i++; return; }
      for (;;) {
        ws();
        if (text[i] !== '"') {
          if (text[i] === "'") fail('Keys must use double quotes, not single quotes.');
          if (text[i] === undefined) fail('The input ends inside an object. A closing } is missing.');
          fail('Expected a key in double quotes but found ' + what(text[i]) + '.');
        }
        str(); ws();
        if (text[i] !== ':') fail('Expected a colon after the key but found ' + what(text[i]) + '.');
        i++; value(); ws();
        if (text[i] === ',') {
          const comma = i; i++; ws();
          if (text[i] === '}') fail('Trailing comma: remove the comma before }.', comma);
          continue;
        }
        if (text[i] === '}') { i++; return; }
        if (text[i] === undefined) fail('The input ends inside an object. A closing } is missing.');
        if (text[i] === '"') fail('Missing comma between properties.');
        fail('Expected a comma or } after the value but found ' + what(text[i]) + '.');
      }
    }
    function arr() {
      i++; ws();
      if (text[i] === ']') { i++; return; }
      for (;;) {
        value(); ws();
        if (text[i] === ',') {
          const comma = i; i++; ws();
          if (text[i] === ']') fail('Trailing comma: remove the comma before ].', comma);
          continue;
        }
        if (text[i] === ']') { i++; return; }
        if (text[i] === undefined) fail('The input ends inside an array. A closing ] is missing.');
        fail('Expected a comma or ] after the item but found ' + what(text[i]) + '.');
      }
    }
    function str() {
      const start = i; i++;
      while (i < n) {
        const c = text[i];
        if (c === '"') { i++; return; }
        if (c === '\\') {
          const e = text[i + 1];
          if (e !== undefined && '"\\/bfnrt'.includes(e)) { i += 2; continue; }
          if (e === 'u' && /^[0-9a-fA-F]{4}$/.test(text.substr(i + 2, 4))) { i += 6; continue; }
          fail('Invalid escape sequence. Allowed: \\" \\\\ \\/ \\b \\f \\n \\r \\t \\uXXXX.');
        }
        if (c < ' ') fail(c === '\n' ? 'Line break inside a string. Use \\n instead, or close the quote.' : 'Control character inside a string.');
        i++;
      }
      fail('This string is never closed. A closing " is missing.', start);
    }
    function num() {
      NUM.lastIndex = i;
      const m = NUM.exec(text);
      if (!m) fail('Invalid number.');
      i += m[0].length;
      if (text[i] === '.' || /[0-9]/.test(text[i] || '')) fail('Invalid number. Leading zeros and trailing dots are not allowed.');
    }

    try {
      if (text.charCodeAt(0) === 0xfeff) i = 1;
      value(); ws();
      if (i < n) fail('Extra content after the JSON value: ' + what(text[i]) + '.');
      return null;
    } catch (e) {
      if (e && typeof e.pos === 'number') return e;
      throw e;
    }
  }

  function lineCol(text, pos) {
    let line = 1, lineStart = 0;
    for (let k = 0; k < pos && k < text.length; k++) if (text[k] === '\n') { line++; lineStart = k + 1; }
    return { line, col: pos - lineStart + 1, lineStart };
  }

  /* ---------- Rendering ---------- */
  const TOK = /("(?:[^"\\]|\\.)*")(\s*:)?|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(true|false)\b|\b(null)\b|([{}[\],])/g;
  function hl(line) {
    let out = '', last = 0, m;
    TOK.lastIndex = 0;
    while ((m = TOK.exec(line))) {
      out += esc(line.slice(last, m.index));
      if (m[1] !== undefined) out += m[2] !== undefined
        ? '<span class="t-k">' + esc(m[1]) + '</span><span class="t-p">' + m[2] + '</span>'
        : '<span class="t-s">' + esc(m[1]) + '</span>';
      else if (m[3] !== undefined) out += '<span class="t-n">' + m[3] + '</span>';
      else if (m[4] !== undefined) out += '<span class="t-b">' + m[4] + '</span>';
      else if (m[5] !== undefined) out += '<span class="t-z">null</span>';
      else out += '<span class="t-p">' + m[6] + '</span>';
      last = TOK.lastIndex;
    }
    return out + esc(line.slice(last));
  }

  function renderCode(s, wrap) {
    code.className = 'code' + (wrap ? ' wrap' : '');
    if (s.length > 2000000) { code.classList.add('plain'); code.textContent = s; return; }
    code.innerHTML = s.split('\n').map((l) => '<span class="ln">' + (hl(l) || ' ') + '</span>').join('');
  }

  const IDENT = /^[A-Za-z_$][\w$]*$/;
  const childPath = (p, k, isArr) => isArr ? p + '[' + k + ']' : (IDENT.test(k) ? p + '.' + k : p + '[' + JSON.stringify(k) + ']');

  function leafHtml(v) {
    if (v === null) return '<span class="t-z">null</span>';
    if (typeof v === 'string') return '<span class="t-s">' + esc(JSON.stringify(v)) + '</span>';
    if (typeof v === 'number') return '<span class="t-n">' + v + '</span>';
    return '<span class="t-b">' + v + '</span>';
  }
  function keyHtml(k, isIdx) {
    if (k === undefined) return '<span class="key" tabindex="0">$</span> ';
    return isIdx
      ? '<span class="key idx" tabindex="0">' + k + '</span><span class="t-p">: </span>'
      : '<span class="key" tabindex="0">' + esc(JSON.stringify(k)) + '</span><span class="t-p">: </span>';
  }

  function makeNode(k, v, path, depth, isIdx) {
    if (v === null || typeof v !== 'object') {
      const row = document.createElement('div');
      row.className = 'leaf';
      row.dataset.path = path;
      row.innerHTML = keyHtml(k, isIdx) + leafHtml(v);
      return row;
    }
    const isArr = Array.isArray(v);
    const count = isArr ? v.length : Object.keys(v).length;
    const d = document.createElement('details');
    const s = document.createElement('summary');
    s.dataset.path = path;
    s.innerHTML = keyHtml(k, isIdx) + '<span class="t-p">' + (isArr ? '[' : '{') + '</span><span class="cnt">' +
      count + ' ' + (isArr ? (count === 1 ? 'item' : 'items') : (count === 1 ? 'key' : 'keys')) +
      '</span><span class="t-p">' + (isArr ? ']' : '}') + '</span>';
    d.append(s);
    d._v = v; d._path = path; d._depth = depth;
    d.addEventListener('toggle', () => { if (d.open) fill(d); });
    if (depth < 2 && count <= 200) { fill(d); d.open = true; }
    return d;
  }
  function fill(d) {
    if (d._filled) return;
    d._filled = true;
    const v = d._v, isArr = Array.isArray(v);
    const box = document.createElement('div');
    box.className = 'kids';
    const keys = isArr ? v.map((_, i) => i) : Object.keys(v);
    const frag = document.createDocumentFragment();
    for (const k of keys) frag.append(makeNode(k, v[k], childPath(d._path, k, isArr), d._depth + 1, isArr));
    box.append(frag);
    d.append(box);
  }
  function renderTree(data) {
    tree.textContent = '';
    tree.append(makeNode(undefined, data, '$', 0, false));
    $('#path').textContent = '$';
  }

  /* ---------- Main ---------- */
  function sortDeep(v) {
    if (Array.isArray(v)) return v.map(sortDeep);
    if (v && typeof v === 'object') {
      const o = {};
      for (const k of Object.keys(v).sort((a, b) => a.localeCompare(b))) o[k] = sortDeep(v[k]);
      return o;
    }
    return v;
  }
  function measure(v) {
    let count = 0, depth = 0;
    const stack = [[v, 1]];
    while (stack.length) {
      const [x, d] = stack.pop();
      count++;
      if (d > depth) depth = d;
      if (x && typeof x === 'object') for (const k in x) stack.push([x[k], d + 1]);
    }
    return { count, depth };
  }
  const bytes = (s) => { try { return new TextEncoder().encode(s).length; } catch (e) { return s.length; } };
  const fmtBytes = (b) => b < 1024 ? b + ' B' : b < 1048576 ? (b / 1024).toFixed(1) + ' KB' : (b / 1048576).toFixed(2) + ' MB';

  function indentValue() {
    const v = indentSel.value;
    return v === 'tab' ? '\t' : Number(v);
  }

  function setChip(kind, text) { chip.className = 'chip' + (kind ? ' ' + kind : ''); chip.textContent = text; }

  function showEmpty() {
    current = ''; lastError = null;
    code.className = 'code';
    $('#view-text').innerHTML = '<div class="empty"><strong>Nothing to format yet.</strong><br>Paste JSON into the input, drop a .json file on it, or press Sample to try an example order.</div>';
    tree.innerHTML = '<div class="empty">The tree appears once the input is valid JSON.</div>';
    setChip('', 'Waiting for input');
    stats.textContent = '';
  }

  function ensureCodeView() {
    const view = $('#view-text');
    if (!view.contains(code)) { view.textContent = ''; view.append(code); }
  }

  function showError(text, err) {
    current = '';
    const { line, col, lineStart } = lineCol(text, err.pos);
    lastError = { pos: err.pos, line };
    let lineEnd = text.indexOf('\n', lineStart);
    if (lineEnd === -1) lineEnd = text.length;
    let src = text.slice(lineStart, lineEnd).replace(/\t/g, ' ');
    let caretAt = col - 1;
    if (src.length > 90) {
      const from = Math.max(0, caretAt - 45);
      src = (from > 0 ? '…' : '') + src.slice(from, from + 90) + (from + 90 < src.length ? '…' : '');
      caretAt = caretAt - from + (from > 0 ? 1 : 0);
    }
    const view = $('#view-text');
    view.innerHTML =
      '<div class="errcard"><h2>Line ' + line + ', column ' + col + '</h2><p>' + esc(err.msg) + '</p>' +
      '<pre>' + esc(src) + '\n<span class="caret">' + ' '.repeat(Math.max(0, caretAt)) + '^</span></pre>' +
      '<button type="button" id="btn-goto">Show in input</button></div>';
    $('#btn-goto').addEventListener('click', gotoError);
    tree.innerHTML = '<div class="empty">Fix the error on line ' + line + ' to see the tree.</div>';
    setChip('bad', 'Invalid JSON');
    stats.innerHTML = '<span>Error at <b>line ' + line + ', col ' + col + '</b></span>';
  }

  function gotoError() {
    if (!lastError) return;
    input.focus();
    input.setSelectionRange(lastError.pos, Math.min(lastError.pos + 1, input.value.length));
    const lh = parseFloat(getComputedStyle(input).lineHeight) || 20;
    input.scrollTop = Math.max(0, (lastError.line - 4) * lh);
  }

  function run(newMode) {
    if (newMode) mode = newMode;
    const text = input.value.replace(/^﻿/, '');
    if (!text.trim()) { showEmpty(); return; }
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      const err = locate(text) || { pos: 0, msg: e.message };
      showError(text, err);
      return;
    }
    lastError = null;
    if (sortBox.checked) data = sortDeep(data);
    current = mode === 'minify' ? JSON.stringify(data) : JSON.stringify(data, null, indentValue());
    ensureCodeView();
    renderCode(current, mode === 'minify');
    renderTree(data);
    const m = measure(data);
    setChip('ok', mode === 'minify' ? 'Valid · minified' : 'Valid JSON');
    stats.innerHTML =
      '<span>Input <b>' + fmtBytes(bytes(text)) + '</b> → output <b>' + fmtBytes(bytes(current)) + '</b></span>' +
      '<span><b>' + m.count.toLocaleString() + '</b> values</span>' +
      '<span>Depth <b>' + m.depth + '</b></span>';
  }

  /* ---------- Clipboard + toast ---------- */
  let toastTimer;
  function say(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 1600);
  }
  function copyText(text, label, fallbackEl) {
    if (!text) { say('Nothing to copy yet'); return; }
    const selectFallback = () => {
      if (fallbackEl) {
        const r = document.createRange(); r.selectNodeContents(fallbackEl);
        const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
        say('Selected. Press ' + ($('#mod').textContent) + '+C to copy');
      } else say('Copy is blocked here. Select the text instead.');
    };
    try {
      navigator.clipboard.writeText(text).then(() => say(label), selectFallback);
    } catch (e) { selectFallback(); }
  }

  /* ---------- Wiring ---------- */
  let timer;
  input.addEventListener('input', () => {
    if (isSample) { isSample = false; $('#sample-badge').hidden = true; }
    clearTimeout(timer);
    timer = setTimeout(() => {
      run();
      if (input.value.length < 500000) store.set('brace:draft', input.value);
    }, 180);
  });

  $('#btn-format').addEventListener('click', () => run('format'));
  $('#btn-minify').addEventListener('click', () => run('minify'));
  indentSel.addEventListener('change', () => { store.set('brace:indent', indentSel.value); run('format'); });
  sortBox.addEventListener('change', () => { store.set('brace:sort', sortBox.checked ? '1' : ''); run(); });

  function loadSample() {
    input.value = SAMPLE;
    isSample = true;
    $('#sample-badge').hidden = false;
    run('format');
  }
  $('#btn-sample').addEventListener('click', loadSample);
  $('#btn-clear').addEventListener('click', () => {
    input.value = ''; isSample = false; $('#sample-badge').hidden = true;
    store.set('brace:draft', ''); run(); input.focus();
  });

  function readFile(file) {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      input.value = String(r.result);
      isSample = false; $('#sample-badge').hidden = true;
      run('format');
      say('Opened ' + file.name);
    };
    r.onerror = () => say('Could not read ' + file.name);
    r.readAsText(file);
  }
  $('#file').addEventListener('change', (e) => { readFile(e.target.files[0]); e.target.value = ''; });

  const inPane = $('#in-pane');
  ['dragenter', 'dragover'].forEach((t) => inPane.addEventListener(t, (e) => {
    if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) { e.preventDefault(); inPane.classList.add('dragging'); }
  }));
  ['dragleave', 'drop'].forEach((t) => inPane.addEventListener(t, () => inPane.classList.remove('dragging')));
  inPane.addEventListener('drop', (e) => {
    if (e.dataTransfer && e.dataTransfer.files.length) { e.preventDefault(); readFile(e.dataTransfer.files[0]); }
  });

  $('#btn-copy').addEventListener('click', () => copyText(current, mode === 'minify' ? 'Copied minified JSON' : 'Copied formatted JSON', code));

  // Tabs
  function showTab(which) {
    const isTree = which === 'tree';
    $('#tab-text').setAttribute('aria-selected', String(!isTree));
    $('#tab-tree').setAttribute('aria-selected', String(isTree));
    $('#view-text').hidden = isTree;
    $('#view-tree').hidden = !isTree;
    $('#tree-actions').hidden = !isTree;
    $('#pathbar').hidden = !isTree;
    store.set('brace:tab', which);
  }
  $('#tab-text').addEventListener('click', () => showTab('text'));
  $('#tab-tree').addEventListener('click', () => showTab('tree'));

  $('#btn-expand').addEventListener('click', () => {
    let opened = 0, round;
    do {
      round = 0;
      tree.querySelectorAll('details:not([open])').forEach((d) => { if (opened < 5000) { fill(d); d.open = true; opened++; round++; } });
    } while (round && opened < 5000);
    if (opened >= 5000) say('Expanded the first 5,000 nodes');
  });
  $('#btn-collapse').addEventListener('click', () => {
    tree.querySelectorAll('details').forEach((d, i) => { d.open = i === 0; });
  });

  function pick(target) {
    const holder = target.closest('[data-path]');
    if (!holder) return;
    tree.querySelectorAll('.sel').forEach((n) => n.classList.remove('sel'));
    holder.classList.add('sel');
    $('#path').textContent = holder.dataset.path;
  }
  tree.addEventListener('click', (e) => {
    if (e.target.classList.contains('key')) { e.preventDefault(); pick(e.target); }
  });
  tree.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('key')) { e.preventDefault(); pick(e.target); }
  });
  $('#btn-path').addEventListener('click', () => copyText($('#path').textContent, 'Copied path', $('#path')));

  const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  $('#mod').textContent = isMac ? '⌘' : 'Ctrl';
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); run(e.shiftKey ? 'minify' : 'format'); }
  });

  // Restore per-viewer preferences, then start with the draft or the sample
  const savedIndent = store.get('brace:indent');
  if (savedIndent && [...indentSel.options].some((o) => o.value === savedIndent)) indentSel.value = savedIndent;
  sortBox.checked = store.get('brace:sort') === '1';
  if (store.get('brace:tab') === 'tree') showTab('tree');
  const draft = store.get('brace:draft');
  if (draft && draft.trim()) { input.value = draft; run('format'); } else loadSample();
})();
