/* ── Helpers ────────────────────────────────────────────────── */
const $ = id => document.getElementById(id);

/* Which page group the active tab is on ('home', 'bounties', …). Declared
   up here rather than beside the per-page override code further down: the
   first thing the popup does on open is call initPageOverrides(), which
   reads and writes this — and a `let` declared after that call sits in the
   temporal dead zone at that moment. The result was an uncaught
   "Cannot access 'currentPageGroup' before initialization" that aborted
   the rest of popup init, which is why the per-page override toggles never
   reflected what was stored and appeared to do nothing. */
let currentPageGroup = null;

/* Saved themes keyed by id, rebuilt by renderCustomThemes(). Hoisted here
   for the same reason as currentPageGroup above — syncPresetIndicator()
   runs during the popup's first paint, before the declaration's original
   position further down. */
let customThemesById = {};

const KEYS = {
  mode:            'mode',
  dark:            'darkEnabled',
  timeStart:       'timeStart',
  timeEnd:         'timeEnd',
  bgColor:         'custom.bgColor',
  bg2Color:        'custom.bg2Color',
  bg3Color:        'custom.bg3Color',
  borderColor:     'custom.borderColor',
  textColor:       'custom.textColor',
  mutedColor:      'custom.mutedColor',
  accentColor:     'custom.accentColor',
  fontSize:        'custom.fontSize',
  hideNav:         'custom.hideSections.nav',
  hideSidebar:     'custom.hideSections.sidebar',
  hideBanner:      'custom.hideSections.banner',
  hideFooter:      'custom.hideSections.footer',
  wallpaperUrl:    'custom.wallpaperUrl',
  wallpaperOpacity:'custom.wallpaperOpacity',
  pageOverrides:   'custom.pageOverrides',
  savedThemes:     'custom.savedThemes',
};

// Used both to fill the UI when a key is missing from storage AND as the
// factory-reset target. The color values here intentionally match the
// GitHub preset (background/service-worker.js's own DEFAULTS uses `null`
// for these instead, letting dark.css's hardcoded html.se-dark fallback
// values win) — popup color <input type="color"> fields need a real hex
// string and can't render `null`. Keep these hex values in sync with the
// html.se-dark fallback block at the top of content/dark.css if either changes.
/* Per-page override fields: [override key, checkbox id, matching global
   storage key]. Declared here, above every consumer, because the popup runs
   initPageOverrides() during its first storage callback — a `const` sitting
   further down the file is in the temporal dead zone at that point. */
const HIDE_FIELDS = [
  ['nav',     'page-hide-nav',     KEYS.hideNav],
  ['sidebar', 'page-hide-sidebar', KEYS.hideSidebar],
  ['banner',  'page-hide-banner',  KEYS.hideBanner],
  ['footer',  'page-hide-footer',  KEYS.hideFooter],
];

const DEFAULTS = {
  [KEYS.mode]:            'manual',
  [KEYS.dark]:            false,
  [KEYS.timeStart]:       '21:00',
  [KEYS.timeEnd]:         '07:00',
  [KEYS.bgColor]:         '#0d1117',
  [KEYS.bg2Color]:        '#161b22',
  [KEYS.bg3Color]:        '#21262d',
  [KEYS.borderColor]:     '#30363d',
  [KEYS.textColor]:       '#e6edf3',
  [KEYS.mutedColor]:      '#8b949e',
  [KEYS.accentColor]:     '#5522e0',
  [KEYS.fontSize]:        16,
  [KEYS.hideNav]:         false,
  [KEYS.hideSidebar]:     false,
  [KEYS.hideBanner]:      false,
  [KEYS.hideFooter]:      false,
  [KEYS.wallpaperUrl]:    null,
  [KEYS.wallpaperOpacity]:0.15,
  [KEYS.pageOverrides]:   {},
  [KEYS.savedThemes]:     [],
};

// Full palettes — all 7 CSS vars per theme
const PRESETS = {
  github: {
    bg: '#0d1117', bg2: '#161b22', bg3: '#21262d',
    border: '#30363d', text: '#e6edf3', muted: '#8b949e', accent: '#5522e0',
  },
  // True OLED black: every surface is #000 so unlit pixels stay unlit.
  // Depth comes entirely from the border colour — keep it in sync with the
  // copy in content.js PRESETS.
  amoled: {
    bg: '#000000', bg2: '#000000', bg3: '#000000',
    border: '#242424', text: '#f0f0f0', muted: '#9a9a9a', accent: '#5522e0',
  },
  nord: {
    bg: '#2e3440', bg2: '#3b4252', bg3: '#434c5e',
    border: '#4c566a', text: '#eceff4', muted: '#d8dee9', accent: '#88c0d0',
  },
  dracula: {
    bg: '#282a36', bg2: '#1e1f29', bg3: '#44475a',
    border: '#6272a4', text: '#f8f8f2', muted: '#b2bade', accent: '#bd93f9',
  },
  catppuccin: {
    bg: '#1e1e2e', bg2: '#181825', bg3: '#313244',
    border: '#45475a', text: '#cdd6f4', muted: '#a6adc8', accent: '#cba6f7',
  },
  tokyonight: {
    bg: '#1a1b26', bg2: '#16161e', bg3: '#24283b',
    border: '#292e42', text: '#c0caf5', muted: '#9aa5ce', accent: '#7aa2f7',
  },
  gruvbox: {
    bg: '#282828', bg2: '#1d2021', bg3: '#3c3836',
    border: '#504945', text: '#ebdbb2', muted: '#b5a68f', accent: '#d3869b',
  },
  onedark: {
    bg: '#282c34', bg2: '#21252b', bg3: '#2c313c',
    border: '#3e4451', text: '#abb2bf', muted: '#a0a8b5', accent: '#61afef',
  },
};

// Mirrors the 7 currently-active palette values (only bg/text/accent are
// independently editable via pickers — bg2/bg3/border/muted come from
// whichever preset/theme was last applied). Used so "Save Current as Theme"
// can snapshot the full palette, not just the 3 visible pickers.
let currentPalette = {};

/* ── In-popup dialogs ──────────────────────────────────────────
   Chrome suppresses window.prompt/confirm/alert in an extension action
   popup (the popup's host returns true from ShouldSuppressDialogs), so
   prompt() resolved to null and confirm() to false without ever showing
   anything — naming/renaming/deleting a theme and the factory reset were
   all dead buttons. These promise-based equivalents drive the markup in
   popup.html instead. Both resolve to null / false on cancel, matching
   the shape of the calls they replace. */
function openDialog({ message, withInput, defaultValue = '', okLabel = 'OK' }) {
  const backdrop = $('dialog');
  const input    = $('dialog-input');
  const ok       = $('dialog-ok');
  const cancel   = $('dialog-cancel');

  $('dialog-message').textContent = message;
  input.hidden = !withInput;
  input.value  = withInput ? defaultValue : '';
  ok.textContent = okLabel;
  backdrop.hidden = false;
  (withInput ? input : ok).focus();
  if (withInput) input.select();

  return new Promise(resolve => {
    const done = result => {
      backdrop.hidden = true;
      ok.removeEventListener('click', onOk);
      cancel.removeEventListener('click', onCancel);
      backdrop.removeEventListener('click', onBackdrop);
      document.removeEventListener('keydown', onKey);
      resolve(result);
    };
    const onOk      = () => done(withInput ? input.value : true);
    const onCancel  = () => done(withInput ? null : false);
    const onBackdrop = e => { if (e.target === backdrop) onCancel(); };
    const onKey = e => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter' && withInput) onOk();
    };
    ok.addEventListener('click', onOk);
    cancel.addEventListener('click', onCancel);
    backdrop.addEventListener('click', onBackdrop);
    document.addEventListener('keydown', onKey);
  });
}

const askText    = (message, defaultValue) => openDialog({ message, withInput: true, defaultValue, okLabel: 'Save' });
const askConfirm = (message, okLabel = 'OK') => openDialog({ message, withInput: false, okLabel });

const debounceTimers = {};
function debouncedSave(key, value, delay = 150) {
  clearTimeout(debounceTimers[key]);
  debounceTimers[key] = setTimeout(() => saveAndNotify({ [key]: value }), delay);
}

function notifyTabs() {
  chrome.tabs.query({}, tabs => {
    for (const t of tabs) {
      if (t.url && t.url.includes('superteam.fun')) {
        chrome.tabs.sendMessage(t.id, { type: 'SE_APPLY' }).catch(() => {});
      }
    }
  });
}

function saveAndNotify(obj) {
  chrome.storage.local.set(obj)
    .then(() => notifyTabs())
    .catch(err => console.error('[EarnDark] storage write failed:', err));
}

function compressImage(dataUrl, maxW, maxH, quality) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      let { width: w, height: h } = img;
      if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
      if (h > maxH) { w = Math.round(w * maxH / h); h = maxH; }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

function previewColor(cssVar, value) {
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    for (const t of tabs) {
      if (t.url && t.url.includes('superteam.fun')) {
        chrome.tabs.sendMessage(t.id, { type: 'SE_PREVIEW_COLOR', key: cssVar, value }).catch(() => {});
      }
    }
  });
}

function previewFullPreset(p) {
  previewColor('--se-bg',          p.bg);
  previewColor('--se-bg2',         p.bg2);
  previewColor('--se-bg3',         p.bg3);
  previewColor('--se-border',      p.border);
  previewColor('--se-text',        p.text);
  previewColor('--se-text-muted',  p.muted);
  // --se-link is derived from the accent by the content script (it lifts
  // it for contrast against --se-bg), so pushing the raw accent here
  // would land last and clobber that correction.
  previewColor('--se-accent',      p.accent);
}

/* ── Tabs ──────────────────────────────────────────────────── */
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    $(`tab-${btn.dataset.tab}`).classList.add('active');
  });
});

/* ── Populate UI from storage ──────────────────────────────── */
function populateUI(stored) {
  const v = k => stored[k] ?? DEFAULTS[k];

  // Theme tab
  $('toggle-dark').checked = v(KEYS.dark);
  $(`mode-${v(KEYS.mode)}`).checked = true;
  updateToggleDisabled(v(KEYS.mode));

  // Customize tab — full 7-slot palette, every layer directly editable
  const bg     = v(KEYS.bgColor);
  const bg2    = v(KEYS.bg2Color);
  const bg3    = v(KEYS.bg3Color);
  const border = v(KEYS.borderColor);
  const tx     = v(KEYS.textColor);
  const muted  = v(KEYS.mutedColor);
  const ac     = v(KEYS.accentColor);
  $('color-bg').value      = bg;     $('color-bg-text').value      = bg;
  $('color-bg2').value     = bg2;    $('color-bg2-text').value     = bg2;
  $('color-bg3').value     = bg3;    $('color-bg3-text').value     = bg3;
  $('color-border').value  = border; $('color-border-text').value = border;
  $('color-text').value    = tx;     $('color-text-text').value   = tx;
  $('color-muted').value   = muted;  $('color-muted-text').value  = muted;
  $('color-accent').value  = ac;     $('color-accent-text').value = ac;

  currentPalette = { bg, bg2, bg3, border, text: tx, muted, accent: ac };

  // Font size
  const fs = v(KEYS.fontSize);
  $('font-size').value = fs;
  $('font-size-label').textContent = `${fs}px`;

  // Hide sections
  $('hide-nav').checked     = v(KEYS.hideNav);
  $('hide-sidebar').checked = v(KEYS.hideSidebar);
  $('hide-banner').checked  = v(KEYS.hideBanner);
  $('hide-footer').checked  = v(KEYS.hideFooter);

  // Wallpaper — always synced (not just when a wallpaper is set), so a
  // cleared/reset wallpaper doesn't leave a stale URL/opacity displayed
  // from earlier in the same popup session (e.g. right after Factory Reset).
  const wpUrl = v(KEYS.wallpaperUrl);
  const wpOp  = v(KEYS.wallpaperOpacity);
  $('wallpaper-url').value = wpUrl || '';
  const pct = Math.round((wpOp ?? DEFAULTS[KEYS.wallpaperOpacity]) * 100);
  $('wallpaper-opacity').value = pct;
  $('wallpaper-opacity-label').textContent = `${pct}%`;

  // Settings tab
  $('time-start').value = v(KEYS.timeStart);
  $('time-end').value   = v(KEYS.timeEnd);

  syncPresetIndicator(bg, tx, ac);
}

chrome.storage.local.get(Object.values(KEYS), stored => {
  populateUI(stored);
  initPageOverrides(stored);
});

chrome.storage.local.get([KEYS.savedThemes], stored => {
  renderCustomThemes(stored[KEYS.savedThemes] || []);
});

/* ── Dark toggle (auto-saves) ──────────────────────────────── */
$('toggle-dark').addEventListener('change', e => {
  saveAndNotify({ [KEYS.dark]: e.target.checked });
});

/* ── Mode radio (auto-saves) ───────────────────────────────── */
document.querySelectorAll('input[name="mode"]').forEach(radio => {
  radio.addEventListener('change', e => {
    updateToggleDisabled(e.target.value);
    saveAndNotify({ [KEYS.mode]: e.target.value });
  });
});

function updateToggleDisabled(mode) {
  const toggle = $('toggle-dark');
  const isManual = mode === 'manual';
  toggle.disabled = !isManual;
  toggle.closest('.toggle').style.opacity = isManual ? '1' : '0.4';
}

/* ── Color pickers -- live-saving (debounced) + instant preview ── */
function wireColor(pickerId, textId, storageKey, cssVar, paletteKey) {
  const picker = $(pickerId);
  const text   = $(textId);

  const onUpdate = val => {
    text.value   = val;
    picker.value = val;
    currentPalette[paletteKey] = val;
    previewColor(cssVar, val);
    debouncedSave(storageKey, val);
    syncPresetIndicator($('color-bg').value, $('color-text').value, $('color-accent').value);
  };

  picker.addEventListener('input', e => onUpdate(e.target.value));
  text.addEventListener('input', e => {
    const val = e.target.value;
    if (/^#[0-9a-fA-F]{6}$/.test(val)) onUpdate(val);
  });
}

wireColor('color-bg',     'color-bg-text',     KEYS.bgColor,     '--se-bg',         'bg');
wireColor('color-bg2',    'color-bg2-text',    KEYS.bg2Color,    '--se-bg2',        'bg2');
wireColor('color-bg3',    'color-bg3-text',    KEYS.bg3Color,    '--se-bg3',        'bg3');
wireColor('color-border', 'color-border-text', KEYS.borderColor, '--se-border',     'border');
wireColor('color-text',   'color-text-text',   KEYS.textColor,   '--se-text',       'text');
wireColor('color-muted',  'color-muted-text',  KEYS.mutedColor,  '--se-text-muted', 'muted');
wireColor('color-accent', 'color-accent-text', KEYS.accentColor, '--se-accent',     'accent');

/* ── Font size -- live-saving (debounced) ──────────────────── */
$('font-size').addEventListener('input', e => {
  const val = Number(e.target.value);
  $('font-size-label').textContent = `${val}px`;
  previewColor('--se-font-size', `${val}px`);
  debouncedSave(KEYS.fontSize, val);
});

/* ── Hide section toggles -- auto-saves ────────────────────── */
function wireHide(id, storageKey) {
  $(id).addEventListener('change', e => {
    saveAndNotify({ [storageKey]: e.target.checked });
  });
}
wireHide('hide-nav',     KEYS.hideNav);
wireHide('hide-sidebar', KEYS.hideSidebar);
wireHide('hide-banner',  KEYS.hideBanner);
wireHide('hide-footer',  KEYS.hideFooter);

/* ── Wallpaper URL -- live save + preview ──────────────────── */
// Earn serves `img-src 'self' blob: data: <a few CDNs>`, and content-script
// CSS obeys the page's CSP, so most pasted URLs are refused by the browser
// and the wallpaper silently never appears. Ask the content script to load
// the URL in the page — the only context where that policy applies — and
// surface the result instead of leaving the user guessing. Uploads take the
// data: path, which the policy always allows.
function probeWallpaper(url) {
  if (/^(data|blob):/i.test(url)) { $('wallpaper-warning').hidden = true; return; }
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    const tab = tabs[0];
    if (!tab || !tab.url || !tab.url.includes('superteam.fun')) return;
    chrome.tabs.sendMessage(tab.id, { type: 'SE_PROBE_WALLPAPER', url })
      .then(res => {
        const el = $('wallpaper-warning');
        if (!res || res.ok !== false) { el.hidden = true; return; }
        el.textContent = res.reason === 'load'
          ? 'That image URL could not be loaded. Check the link, or use File below to upload the image instead.'
          : 'Earn blocked that image URL. Its security policy only allows images it hosts itself — use File below to upload instead.';
        el.hidden = false;
      })
      .catch(() => {});
  });
}

$('wallpaper-url-set').addEventListener('click', () => {
  const url = $('wallpaper-url').value.trim();
  if (!url) return;
  previewColor('--se-wallpaper-url', `url("${url}")`);
  const currentOp = Number($('wallpaper-opacity').value) / 100;
  previewColor('--se-wallpaper-opacity', String(currentOp));
  saveAndNotify({ [KEYS.wallpaperUrl]: url });
  probeWallpaper(url);
});

/* ── Wallpaper file -- live save, compressed ───────────────── */
$('wallpaper-upload').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async ev => {
    const compressed = await compressImage(ev.target.result, 1920, 1080, 0.65);
    previewColor('--se-wallpaper-url', `url("${compressed}")`);
    const currentOp = Number($('wallpaper-opacity').value) / 100;
    previewColor('--se-wallpaper-opacity', String(currentOp));
    $('wallpaper-warning').hidden = true;
    saveAndNotify({ [KEYS.wallpaperUrl]: compressed });
  };
  reader.readAsDataURL(file);
});

/* ── Wallpaper opacity -- live save + preview ──────────────── */
$('wallpaper-opacity').addEventListener('input', e => {
  const pct = Number(e.target.value);
  const val = pct / 100;
  $('wallpaper-opacity-label').textContent = `${pct}%`;
  previewColor('--se-wallpaper-opacity', String(val));
  debouncedSave(KEYS.wallpaperOpacity, val);
});

/* ── Wallpaper clear -- immediate ───────────────────────────── */
$('wallpaper-clear').addEventListener('click', () => {
  $('wallpaper-url').value = '';
  $('wallpaper-warning').hidden = true;
  saveAndNotify({ [KEYS.wallpaperUrl]: null });
});

/* ── Preset themes ─────────────────────────────────────────── */
function applyPaletteLive(p) {
  $('color-bg').value     = p.bg;     $('color-bg-text').value     = p.bg;
  $('color-bg2').value    = p.bg2;    $('color-bg2-text').value    = p.bg2;
  $('color-bg3').value    = p.bg3;    $('color-bg3-text').value    = p.bg3;
  $('color-border').value = p.border; $('color-border-text').value = p.border;
  $('color-text').value   = p.text;   $('color-text-text').value   = p.text;
  $('color-muted').value  = p.muted;  $('color-muted-text').value  = p.muted;
  $('color-accent').value = p.accent; $('color-accent-text').value = p.accent;

  currentPalette = { bg: p.bg, bg2: p.bg2, bg3: p.bg3, border: p.border, text: p.text, muted: p.muted, accent: p.accent };

  previewFullPreset(p);

  saveAndNotify({
    [KEYS.bgColor]:     p.bg,
    [KEYS.bg2Color]:    p.bg2,
    [KEYS.bg3Color]:    p.bg3,
    [KEYS.borderColor]: p.border,
    [KEYS.textColor]:   p.text,
    [KEYS.mutedColor]:  p.muted,
    [KEYS.accentColor]: p.accent,
  });

  syncPresetIndicator(p.bg, p.text, p.accent);
}

document.querySelectorAll('.preset-btn').forEach(btn => {
  btn.addEventListener('click', () => applyPaletteLive(PRESETS[btn.dataset.preset]));
});

function syncPresetIndicator(bg, text, accent) {
  document.querySelectorAll('.preset-btn, .custom-theme-btn').forEach(btn => {
    const p = btn.dataset.preset ? PRESETS[btn.dataset.preset] : customThemesById[btn.dataset.themeId];
    if (!p) return;
    btn.classList.toggle('active', p.bg === bg && p.text === text && p.accent === accent);
  });
}

/* ── Custom themes ─────────────────────────────────────────── */
function renderCustomThemes(themes) {
  customThemesById = {};
  const row = $('custom-theme-row');
  row.innerHTML = '';
  themes.forEach(t => {
    customThemesById[t.id] = t;
    const btn = document.createElement('button');
    btn.className = 'preset-btn custom-theme-btn';
    btn.dataset.themeId = t.id;
    btn.title = t.name;
    btn.style.setProperty('--preset-bg', t.bg);
    btn.style.setProperty('--preset-swatch', t.accent);

    const label = document.createElement('span');
    label.textContent = t.name;
    btn.appendChild(label);

    const rename = document.createElement('span');
    rename.className = 'custom-theme-rename';
    rename.textContent = '✎';
    rename.title = 'Rename theme';
    rename.addEventListener('click', async e => {
      e.stopPropagation();
      const name = await askText('Rename theme', t.name);
      if (!name || !name.trim() || name.trim() === t.name) return;
      chrome.storage.local.get([KEYS.savedThemes], stored => {
        const all = (stored[KEYS.savedThemes] || []).map(x => x.id === t.id ? { ...x, name: name.trim() } : x);
        chrome.storage.local.set({ [KEYS.savedThemes]: all });
        renderCustomThemes(all);
      });
    });
    btn.appendChild(rename);

    const del = document.createElement('span');
    del.className = 'custom-theme-delete';
    del.textContent = '×';
    del.title = 'Delete theme';
    del.addEventListener('click', async e => {
      e.stopPropagation();
      if (!await askConfirm(`Delete theme "${t.name}"?`, 'Delete')) return;
      chrome.storage.local.get([KEYS.savedThemes], stored => {
        const remaining = (stored[KEYS.savedThemes] || []).filter(x => x.id !== t.id);
        chrome.storage.local.set({ [KEYS.savedThemes]: remaining });
        renderCustomThemes(remaining);
      });
    });
    btn.appendChild(del);

    btn.addEventListener('click', () => applyPaletteLive(t));
    row.appendChild(btn);
  });
  row.style.display = themes.length ? 'flex' : 'none';
}

$('save-custom-theme').addEventListener('click', async () => {
  const name = await askText('Name this theme', 'My Theme');
  if (!name || !name.trim()) return;
  const theme = { id: 'ct-' + Date.now().toString(36), name: name.trim(), ...currentPalette };
  chrome.storage.local.get([KEYS.savedThemes], stored => {
    const all = [...(stored[KEYS.savedThemes] || []), theme];
    chrome.storage.local.set({ [KEYS.savedThemes]: all });
    renderCustomThemes(all);
  });
});

/* ── Refresh-page button ───────────────────────────────────────
   Re-syncs the popup UI from storage AND force-reloads the active
   Earn tab, so it's a genuine fallback even if the live-apply path
   (storage.onChanged in content.js) somehow hasn't caught up — hide
   sections / page overrides are meant to apply instantly without
   this, but this button now actually does what its label says. ── */
$('reload-settings').addEventListener('click', () => {
  const btn = $('reload-settings');
  chrome.storage.local.get(Object.values(KEYS), stored => {
    populateUI(stored);
    notifyTabs();
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      const tab = tabs[0];
      if (tab && tab.url && tab.url.includes('superteam.fun')) chrome.tabs.reload(tab.id);
    });
    btn.textContent = 'Refreshed';
    setTimeout(() => { btn.textContent = '↺ Refresh page'; }, 1000);
  });
});

/* ── Reset colors ──────────────────────────────────────────── */
$('reset-colors').addEventListener('click', () => {
  applyPaletteLive(PRESETS.github);
  const fs = DEFAULTS[KEYS.fontSize];
  $('font-size').value = fs;
  $('font-size-label').textContent = `${fs}px`;
  previewColor('--se-font-size', `${fs}px`);
  saveAndNotify({ [KEYS.fontSize]: fs });
});

/* ── Factory reset ──────────────────────────────────────────── */
$('factory-reset').addEventListener('click', async () => {
  const ok = await askConfirm(
    'Factory reset Superteam Earn Dark?\nThis erases all settings, custom themes, and the wallpaper.',
    'Reset');
  if (!ok) return;
  chrome.storage.local.clear(() => {
    chrome.storage.local.set(DEFAULTS, () => {
      populateUI(DEFAULTS);
      renderCustomThemes([]);
      initPageOverrides(DEFAULTS);
      notifyTabs();
    });
  });
});

/* ── Time inputs (auto-saves) ──────────────────────────────── */
$('time-start').addEventListener('change', e => {
  saveAndNotify({ [KEYS.timeStart]: e.target.value });
});

$('time-end').addEventListener('change', e => {
  saveAndNotify({ [KEYS.timeEnd]: e.target.value });
});

/* ── Per-page overrides ────────────────────────────────────── */

function getPageGroupFromUrl(url) {
  try {
    const path = new URL(url).pathname;
    if (path.includes('/bounties'))    return 'bounties';
    if (path.includes('/projects'))    return 'projects';
    if (path.includes('/grants'))      return 'grants';
    if (path.includes('/leaderboard')) return 'leaderboard';
    if (path.includes('/feed'))        return 'feed';
    if (path.includes('/t/'))          return 'profile';
    if (path.includes('/s/'))          return 'sponsor';
    return 'home';
  } catch { return null; }
}

function initPageOverrides(stored) {
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    const tab = tabs[0];
    const label = $('page-group-label');
    if (tab && tab.url && tab.url.includes('superteam.fun')) {
      currentPageGroup = getPageGroupFromUrl(tab.url);
      label.textContent = currentPageGroup;
      label.style.display = 'inline';
      $('page-override-section').style.display = '';
    } else {
      label.textContent = '';
      $('page-override-section').style.display = 'none';
    }
    renderPageOverrides(stored[KEYS.pageOverrides] || {}, stored);
  });
}

/* A per-page box shows the global value unless this page group actually
   overrides it, so an unedited page tracks the global toggles. */
function renderPageOverrides(overrides, globals) {
  if (!currentPageGroup) return;
  const hs = (overrides[currentPageGroup] || {}).hideSections || {};
  HIDE_FIELDS.forEach(([key, id, globalKey]) => {
    $(id).checked = hs[key] ?? !!(globals || {})[globalKey];
  });
}

/* Only genuine DIFFERENCES from the global setting are stored, and a group
   that matches the globals everywhere is deleted outright.
   Storing all four keys unconditionally (what this used to do) meant the
   first touch of any per-page toggle froze that page group against the
   global switches forever: content.js merges the override over the globals,
   so a stored `nav: false` kept beating a later global "hide nav" and the
   global toggle looked broken on every page the user had ever visited. */
function savePageOverride() {
  if (!currentPageGroup) return;
  chrome.storage.local.get([KEYS.pageOverrides, ...HIDE_FIELDS.map(f => f[2])], stored => {
    const all = stored[KEYS.pageOverrides] || {};
    const hideSections = {};
    HIDE_FIELDS.forEach(([key, id, globalKey]) => {
      const checked = $(id).checked;
      if (checked !== !!stored[globalKey]) hideSections[key] = checked;
    });
    if (Object.keys(hideSections).length) all[currentPageGroup] = { hideSections };
    else delete all[currentPageGroup];
    saveAndNotify({ [KEYS.pageOverrides]: all });
  });
}

['page-hide-nav', 'page-hide-sidebar', 'page-hide-banner', 'page-hide-footer'].forEach(id => {
  $(id).addEventListener('change', savePageOverride);
});

$('clear-page-override').addEventListener('click', () => {
  if (!currentPageGroup) return;
  chrome.storage.local.get([KEYS.pageOverrides], stored => {
    const all = stored[KEYS.pageOverrides] || {};
    delete all[currentPageGroup];
    saveAndNotify({ [KEYS.pageOverrides]: all });
    chrome.storage.local.get(HIDE_FIELDS.map(f => f[2]), globals => renderPageOverrides(all, globals));
  });
});
