(function () {
  'use strict';

  var STORAGE_KEY = 'pgSettings';

  var MAX_LENGTH = 256;
  var MAX_COUNT = 12;

  var SETS = {
    upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    lower: 'abcdefghijklmnopqrstuvwxyz',
    digit: '0123456789',
    symbol: '!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~'
  };

  var AMBIGUOUS = { upper: 'O', lower: 'lo', digit: '0' };

  var els = {
    length: document.getElementById('length'),
    lengthVal: document.getElementById('length-val'),
    count: document.getElementById('count'),
    countVal: document.getElementById('count-val'),
    setBits: document.getElementById('set-bits'),
    upper: document.getElementById('use-upper'),
    lower: document.getElementById('use-lower'),
    digit: document.getElementById('use-digit'),
    symbol: document.getElementById('use-symbol'),
    noAmbiguous: document.getElementById('no-ambiguous'),
    ensureAll: document.getElementById('ensure-all'),
    generate: document.getElementById('generate'),
    passwords: document.getElementById('passwords'),
    empty: document.getElementById('empty-state'),
    strengthCells: document.getElementById('strength-cells').children,
    strengthName: document.getElementById('strength-name'),
    strengthHint: document.getElementById('strength-hint'),
    entropyMeter: document.getElementById('entropy-meter'),
    themeToggle: document.getElementById('theme-toggle'),
    themeLabel: document.getElementById('theme-label')
  };

  var theme = 'dark';
  var currentPasswords = [];

  function loadSettings() {
    var def = {
      length: 20, count: 1, upper: true, lower: true, digit: true, symbol: true,
      noAmbiguous: true, ensureAll: true, theme: 'dark', generated: []
    };
    try {
      var raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      Object.keys(def).forEach(function (k) {
        if (raw[k] !== undefined && typeof raw[k] === typeof def[k]) def[k] = raw[k];
      });
    } catch (_) { /* ignore */ }
    return def;
  }

  function saveSettings(extra) {
    var s = {
      length: readLength(),
      count: readCount(),
      upper: els.upper.checked,
      lower: els.lower.checked,
      digit: els.digit.checked,
      symbol: els.symbol.checked,
      noAmbiguous: els.noAmbiguous.checked,
      ensureAll: els.ensureAll.checked,
      theme: theme,
      generated: extra && extra.passwords ? extra.passwords : currentPasswords
    };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch (_) { /* ignore */ }
  }

  function apiRand() {
    var buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0];
  }

  function randInt(max) {
    if (max <= 0) return 0;
    var limit = Math.floor(0x100000000 / max) * max;
    var v;
    do { v = apiRand(); } while (v >= limit);
    return v % max;
  }

  function pick(arr) {
    return arr[randInt(arr.length)];
  }

  function buildAlphabet() {
    var checks = [
      { key: 'upper', el: els.upper },
      { key: 'lower', el: els.lower },
      { key: 'digit', el: els.digit },
      { key: 'symbol', el: els.symbol }
    ];
    var keep = checks.filter(function (c) { return c.el.checked; });
    if (keep.length === 0) keep = [checks[0]];
    var useAmbiguity = !els.noAmbiguous.checked;
    return keep.map(function (c) {
      var chars = SETS[c.key];
      if (!useAmbiguity && AMBIGUOUS[c.key]) {
        chars = chars.split('').filter(function (ch) { return AMBIGUOUS[c.key].indexOf(ch) === -1; }).join('');
      }
      return { key: c.key, chars: chars };
    });
  }

  function generateOne(length, alphabet) {
    var result = [];
    if (els.ensureAll.checked) {
      alphabet.forEach(function (s) { result.push(pick(s.chars.split(''))); });
    }
    var pool = alphabet.reduce(function (acc, s) { return acc.concat(s.chars.split('')); }, []);
    while (result.length < length) result.push(pick(pool));
    for (var i = result.length - 1; i > 0; i--) {
      var j = randInt(i + 1);
      var tmp = result[i];
      result[i] = result[j];
      result[j] = tmp;
    }
    return result.join('');
  }

  function alphabetSize(alphabet) {
    return alphabet.reduce(function (acc, s) { return acc + s.chars.length; }, 0);
  }

  function entropyBits(alphabet, length) {
    var size = alphabetSize(alphabet);
    if (size === 0) return 0;
    return Math.round(length * Math.log2(size) * 10) / 10;
  }

  function strengthOf(bits) {
    if (bits < 40) return { cells: 1, name: 'WEAK_', hint: 'TOO SHORT FOR A LOCK' };
    if (bits < 60) return { cells: 2, name: 'FAIR_', hint: 'MOSTLY SMALL CHARSET' };
    if (bits < 80) return { cells: 3, name: 'GOOD_', hint: 'SERVICEABLE IN 2026' };
    if (bits < 112) return { cells: 4, name: 'STRONG_', hint: 'RIDICULOUS TO BRUTE-FORCE' };
    return { cells: 5, name: 'MAXIMUM_', hint: 'UPPER BOUND OF THE ALPHABET' };
  }

  function renderStrength(bits) {
    var s = strengthOf(bits);
    var cells = els.strengthCells;
    for (var i = 0; i < cells.length; i++) cells[i].classList.toggle('on', i < s.cells);
    els.strengthName.textContent = s.name;
    els.strengthHint.textContent = s.hint;
  }

  function readLength() {
    var v = parseInt(els.length.value, 10);
    if (isNaN(v)) v = 20;
    return Math.max(4, Math.min(MAX_LENGTH, v));
  }

  function readCount() {
    var v = parseInt(els.count.value, 10);
    if (isNaN(v)) v = 1;
    return Math.max(1, Math.min(MAX_COUNT, v));
  }

  function refreshMeta() {
    var alphabet = buildAlphabet();
    var size = alphabetSize(alphabet);
    var length = readLength();
    if (els.ensureAll.checked && alphabet.length > length) length = alphabet.length;
    els.lengthVal.textContent = String(length);
    els.countVal.textContent = String(readCount());
    els.setBits.textContent = size === 0 ? '0' : String(size);
    var bits = entropyBits(alphabet, length);
    els.entropyMeter.textContent = bits + ' BITS';
    renderStrength(bits);
  }

  function copyText(text, btn) {
    function done() {
      if (!btn) return;
      btn.textContent = 'COPIED_';
      btn.classList.add('done');
      var item = btn.closest('.pass-item');
      if (item) item.classList.add('copied');
      setTimeout(function () {
        btn.textContent = 'COPY_';
        btn.classList.remove('done');
        if (item) item.classList.remove('copied');
      }, 1400);
    }
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch (_) { /* ignore */ }
      document.body.removeChild(ta);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallback(); done(); });
    } else {
      fallback();
      done();
    }
  }

  function renderEmpty() {
    els.passwords.innerHTML = '';
    var li = document.createElement('li');
    li.className = 'passwords__empty';
    li.textContent = 'PRESS GENERATE_';
    els.passwords.appendChild(li);
  }

  function renderList(passwords) {
    currentPasswords = passwords;
    els.passwords.innerHTML = '';
    if (!passwords.length) {
      renderEmpty();
      return;
    }
    passwords.forEach(function (pw, i) {
      var li = document.createElement('li');
      li.className = 'pass-item';
      li.tabIndex = 0;

      var idx = document.createElement('span');
      idx.className = 'pass-item__idx';
      idx.textContent = String(i + 1).padStart(2, '0');

      var val = document.createElement('span');
      val.className = 'pass-item__val';
      val.textContent = pw;
      val.title = pw;

      var btn = document.createElement('button');
      btn.className = 'pass-item__copy';
      btn.type = 'button';
      btn.textContent = 'COPY_';

      li.appendChild(idx);
      li.appendChild(val);
      li.appendChild(btn);
      els.passwords.appendChild(li);

      function doCopy() { copyText(pw, btn); }
      btn.addEventListener('click', function (e) { e.stopPropagation(); doCopy(); });
      li.addEventListener('click', doCopy);
      li.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); doCopy(); }
      });
    });
  }

  function generate() {
    var alphabet = buildAlphabet();
    var length = readLength();
    if (els.ensureAll.checked && alphabet.length > length) length = alphabet.length;
    var passwords = [];
    for (var i = 0; i < readCount(); i++) passwords.push(generateOne(length, alphabet));
    renderList(passwords);
    refreshMeta();
    saveSettings({ passwords: passwords });
  }

  function applyTheme(next) {
    theme = next === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    els.themeLabel.textContent = theme === 'dark' ? 'DARK' : 'LIGHT';
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#0a0a0a' : '#f2f2f0');
  }

  function init() {
    var s = loadSettings();
    applyTheme(s.theme);
    els.length.value = String(s.length);
    els.count.value = String(s.count);
    els.upper.checked = !!s.upper;
    els.lower.checked = !!s.lower;
    els.digit.checked = !!s.digit;
    els.symbol.checked = !!s.symbol;
    els.noAmbiguous.checked = !!s.noAmbiguous;
    els.ensureAll.checked = !!s.ensureAll;
    refreshMeta();

    if (Array.isArray(s.generated) && s.generated.length) {
      renderList(s.generated.slice(0, readCount()));
    } else {
      renderEmpty();
    }

    els.length.addEventListener('input', refreshMeta);
    els.count.addEventListener('input', refreshMeta);
    [els.upper, els.lower, els.digit, els.symbol, els.noAmbiguous, els.ensureAll]
      .forEach(function (el) { el.addEventListener('change', refreshMeta); });

    els.generate.addEventListener('click', generate);
    els.themeToggle.addEventListener('click', function () {
      applyTheme(theme === 'dark' ? 'light' : 'dark');
      saveSettings();
    });
  }

  init();
})();