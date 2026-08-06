/* ── Helpers ────────────────────────────────────────────────── */
const $ = id => document.getElementById(id);

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
  siteLogo:        'custom.siteLogo',
  logoEnabled:     'custom.logoEnabled',
  wallpaperUrl:    'custom.wallpaperUrl',
  wallpaperOpacity:'custom.wallpaperOpacity',
  readingMode:     'custom.readingMode',
  pageOverrides:   'custom.pageOverrides',
};

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
  [KEYS.siteLogo]:        null,
  [KEYS.logoEnabled]:     false,
  [KEYS.wallpaperUrl]:    null,
  [KEYS.wallpaperOpacity]:0.15,
  [KEYS.readingMode]:     false,
  [KEYS.pageOverrides]:   {},
};

// Full palettes — all 7 CSS vars per theme
const PRESETS = {
  github: {
    bg: '#0d1117', bg2: '#161b22', bg3: '#21262d',
    border: '#30363d', text: '#e6edf3', muted: '#8b949e', accent: '#5522e0',
  },
  amoled: {
    bg: '#000000', bg2: '#0a0a0a', bg3: '#111111',
    border: '#1c1c1c', text: '#f0f0f0', muted: '#777777', accent: '#5522e0',
  },
  nord: {
    bg: '#2e3440', bg2: '#3b4252', bg3: '#434c5e',
    border: '#4c566a', text: '#eceff4', muted: '#d8dee9', accent: '#88c0d0',
  },
  dracula: {
    bg: '#282a36', bg2: '#1e1f29', bg3: '#44475a',
    border: '#6272a4', text: '#f8f8f2', muted: '#6272a4', accent: '#bd93f9',
  },
  catppuccin: {
    bg: '#1e1e2e', bg2: '#181825', bg3: '#313244',
    border: '#45475a', text: '#cdd6f4', muted: '#7f849c', accent: '#cba6f7',
  },
  tokyonight: {
    bg: '#1a1b26', bg2: '#16161e', bg3: '#24283b',
    border: '#292e42', text: '#c0caf5', muted: '#565f89', accent: '#7aa2f7',
  },
  gruvbox: {
    bg: '#282828', bg2: '#1d2021', bg3: '#3c3836',
    border: '#504945', text: '#ebdbb2', muted: '#a89984', accent: '#d3869b',
  },
  onedark: {
    bg: '#282c34', bg2: '#21252b', bg3: '#2c313c',
    border: '#3e4451', text: '#abb2bf', muted: '#5c6370', accent: '#61afef',
  },
};

// Staged changes -- only committed on Save
let pending = {};

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
  previewColor('--se-accent',      p.accent);
  previewColor('--se-link',        p.accent);
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
  $('reading-mode').checked = v(KEYS.readingMode);
  updateToggleDisabled(v(KEYS.mode));

  // Customize tab — visible color pickers (bg, text, accent)
  const bg = v(KEYS.bgColor);
  const tx = v(KEYS.textColor);
  const ac = v(KEYS.accentColor);
  $('color-bg').value    = bg; $('color-bg-text').value    = bg;
  $('color-text').value  = tx; $('color-text-text').value  = tx;
  $('color-accent').value = ac; $('color-accent-text').value = ac;

  // Font size
  const fs = v(KEYS.fontSize);
  $('font-size').value = fs;
  $('font-size-label').textContent = `${fs}px`;

  // Hide sections
  $('hide-nav').checked     = v(KEYS.hideNav);
  $('hide-sidebar').checked = v(KEYS.hideSidebar);
  $('hide-banner').checked  = v(KEYS.hideBanner);
  $('hide-footer').checked  = v(KEYS.hideFooter);

  // Logo
  $('logo-enabled').checked = v(KEYS.logoEnabled);
  const logo = v(KEYS.siteLogo);
  if (logo) $('logo-preview').src = logo;

  // Wallpaper
  const wpUrl = v(KEYS.wallpaperUrl);
  const wpOp  = v(KEYS.wallpaperOpacity);
  if (wpUrl) {
    $('wallpaper-url').value = wpUrl;
    const pct = Math.round(wpOp * 100);
    $('wallpaper-opacity').value = pct;
    $('wallpaper-opacity-label').textContent = `${pct}%`;
  }

  // Settings tab
  $('time-start').value = v(KEYS.timeStart);
  $('time-end').value   = v(KEYS.timeEnd);

  syncPresetIndicator(bg, tx, ac);
  pending = {};
}

chrome.storage.local.get(Object.values(KEYS), stored => {
  populateUI(stored);
  initPageOverrides(stored);
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

/* ── Reading mode (auto-saves) ─────────────────────────────── */
$('reading-mode').addEventListener('change', e => {
  saveAndNotify({ [KEYS.readingMode]: e.target.checked });
});

/* ── Color pickers -- live preview only, staged for Save ───── */
function wireColor(pickerId, textId, storageKey, cssVar) {
  const picker = $(pickerId);
  const text   = $(textId);

  const onUpdate = val => {
    text.value   = val;
    picker.value = val;
    pending[storageKey] = val;
    previewColor(cssVar, val);
    syncPresetIndicator(
      pending[KEYS.bgColor]     || $('color-bg').value,
      pending[KEYS.textColor]   || $('color-text').value,
      pending[KEYS.accentColor] || $('color-accent').value
    );
  };

  picker.addEventListener('input', e => onUpdate(e.target.value));
  text.addEventListener('input', e => {
    const val = e.target.value;
    if (/^#[0-9a-fA-F]{6}$/.test(val)) onUpdate(val);
  });
}

wireColor('color-bg',     'color-bg-text',     KEYS.bgColor,     '--se-bg');
wireColor('color-text',   'color-text-text',   KEYS.textColor,   '--se-text');
wireColor('color-accent', 'color-accent-text', KEYS.accentColor, '--se-accent');

/* ── Font size -- staged ───────────────────────────────────── */
$('font-size').addEventListener('input', e => {
  const val = Number(e.target.value);
  $('font-size-label').textContent = `${val}px`;
  pending[KEYS.fontSize] = val;
  previewColor('--se-font-size', `${val}px`);
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

/* ── Logo enable toggle -- auto-saves ─────────────────────── */
$('logo-enabled').addEventListener('change', e => {
  saveAndNotify({ [KEYS.logoEnabled]: e.target.checked });
});

/* ── Logo upload (file) -- staged, compressed ─────────────── */
$('logo-upload').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async ev => {
    const compressed = await compressImage(ev.target.result, 400, 200, 0.85);
    $('logo-preview').src = compressed;
    pending[KEYS.siteLogo] = compressed;
  };
  reader.readAsDataURL(file);
});

/* ── Logo URL input -- staged ─────────────────────────────── */
$('logo-url-set').addEventListener('click', () => {
  const url = $('logo-url').value.trim();
  if (!url) return;
  $('logo-preview').src = url;
  pending[KEYS.siteLogo] = url;
});

/* ── Logo reset -- immediate ──────────────────────────────── */
$('logo-reset').addEventListener('click', () => {
  $('logo-preview').src = '../assets/earn-logo-dark.png';
  $('logo-url').value = '';
  delete pending[KEYS.siteLogo];
  saveAndNotify({ [KEYS.siteLogo]: null });
});

/* ── Wallpaper URL -- staged + live preview ────────────────── */
$('wallpaper-url-set').addEventListener('click', () => {
  const url = $('wallpaper-url').value.trim();
  if (!url) return;
  pending[KEYS.wallpaperUrl] = url;
  previewColor('--se-wallpaper-url', `url("${url}")`);
  const currentOp = Number($('wallpaper-opacity').value) / 100;
  previewColor('--se-wallpaper-opacity', String(currentOp));
});

/* ── Wallpaper file -- staged, compressed ─────────────────── */
$('wallpaper-upload').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async ev => {
    const compressed = await compressImage(ev.target.result, 1920, 1080, 0.65);
    pending[KEYS.wallpaperUrl] = compressed;
    previewColor('--se-wallpaper-url', `url("${compressed}")`);
    const currentOp = Number($('wallpaper-opacity').value) / 100;
    previewColor('--se-wallpaper-opacity', String(currentOp));
  };
  reader.readAsDataURL(file);
});

/* ── Wallpaper opacity -- staged + live preview ────────────── */
$('wallpaper-opacity').addEventListener('input', e => {
  const pct = Number(e.target.value);
  const val = pct / 100;
  $('wallpaper-opacity-label').textContent = `${pct}%`;
  pending[KEYS.wallpaperOpacity] = val;
  previewColor('--se-wallpaper-opacity', String(val));
});

/* ── Wallpaper clear -- immediate ─────────────────────────── */
$('wallpaper-clear').addEventListener('click', () => {
  $('wallpaper-url').value = '';
  delete pending[KEYS.wallpaperUrl];
  delete pending[KEYS.wallpaperOpacity];
  saveAndNotify({ [KEYS.wallpaperUrl]: null });
});

/* ── Preset themes ─────────────────────────────────────────── */
document.querySelectorAll('.preset-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const p = PRESETS[btn.dataset.preset];
    if (!p) return;

    // Update visible color pickers
    $('color-bg').value     = p.bg;     $('color-bg-text').value     = p.bg;
    $('color-text').value   = p.text;   $('color-text-text').value   = p.text;
    $('color-accent').value = p.accent; $('color-accent-text').value = p.accent;

    // Stage ALL palette colors for Save
    pending[KEYS.bgColor]     = p.bg;
    pending[KEYS.bg2Color]    = p.bg2;
    pending[KEYS.bg3Color]    = p.bg3;
    pending[KEYS.borderColor] = p.border;
    pending[KEYS.textColor]   = p.text;
    pending[KEYS.mutedColor]  = p.muted;
    pending[KEYS.accentColor] = p.accent;

    // Live preview all vars
    previewFullPreset(p);

    document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

function syncPresetIndicator(bg, text, accent) {
  document.querySelectorAll('.preset-btn').forEach(btn => {
    const p = PRESETS[btn.dataset.preset];
    if (!p) return;
    btn.classList.toggle('active', p.bg === bg && p.text === text && p.accent === accent);
  });
}

/* ── Save button ───────────────────────────────────────────── */
$('save-settings').addEventListener('click', () => {
  const btn = $('save-settings');
  const orig = btn.textContent;

  const showFeedback = (ok) => {
    btn.textContent = ok ? 'Saved!' : 'Error!';
    btn.style.background = ok ? '#3fb950' : '#f85149';
    btn.style.borderColor = btn.style.background;
    setTimeout(() => {
      btn.textContent = orig;
      btn.style.background = '';
      btn.style.borderColor = '';
    }, 1400);
  };

  if (Object.keys(pending).length > 0) {
    const toSave = { ...pending };
    pending = {};
    chrome.storage.local.set(toSave)
      .then(() => { notifyTabs(); showFeedback(true); })
      .catch(err => {
        console.error('[EarnDark] save failed:', err);
        showFeedback(false);
      });
  } else {
    notifyTabs();
    showFeedback(true);
  }
});

/* ── Reload button ─────────────────────────────────────────── */
$('reload-settings').addEventListener('click', () => {
  const btn = $('reload-settings');
  chrome.storage.local.get(Object.values(KEYS), stored => {
    populateUI(stored);
    notifyTabs();
    btn.textContent = 'Reloaded';
    setTimeout(() => { btn.textContent = '↺ Reload'; }, 1000);
  });
});

/* ── Reset colors ──────────────────────────────────────────── */
$('reset-colors').addEventListener('click', () => {
  const github = PRESETS.github;

  $('color-bg').value     = github.bg;     $('color-bg-text').value     = github.bg;
  $('color-text').value   = github.text;   $('color-text-text').value   = github.text;
  $('color-accent').value = github.accent; $('color-accent-text').value = github.accent;
  const fs = DEFAULTS[KEYS.fontSize];
  $('font-size').value = fs;
  $('font-size-label').textContent = `${fs}px`;

  pending[KEYS.bgColor]     = github.bg;
  pending[KEYS.bg2Color]    = github.bg2;
  pending[KEYS.bg3Color]    = github.bg3;
  pending[KEYS.borderColor] = github.border;
  pending[KEYS.textColor]   = github.text;
  pending[KEYS.mutedColor]  = github.muted;
  pending[KEYS.accentColor] = github.accent;
  pending[KEYS.fontSize]    = fs;

  previewFullPreset(github);
  previewColor('--se-font-size', `${fs}px`);
  syncPresetIndicator(github.bg, github.text, github.accent);
});

/* ── Time inputs (auto-saves) ──────────────────────────────── */
$('time-start').addEventListener('change', e => {
  saveAndNotify({ [KEYS.timeStart]: e.target.value });
});

$('time-end').addEventListener('change', e => {
  saveAndNotify({ [KEYS.timeEnd]: e.target.value });
});

/* ── Per-page overrides ────────────────────────────────────── */
let currentPageGroup = null;

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
    renderPageOverrides(stored[KEYS.pageOverrides] || {});
  });
}

function renderPageOverrides(overrides) {
  if (!currentPageGroup) return;
  const ov = overrides[currentPageGroup] || {};
  const hs = ov.hideSections || {};
  $('page-hide-nav').checked     = hs.nav     ?? false;
  $('page-hide-sidebar').checked = hs.sidebar  ?? false;
  $('page-hide-banner').checked  = hs.banner   ?? false;
  $('page-hide-footer').checked  = hs.footer   ?? false;
}

function savePageOverride() {
  if (!currentPageGroup) return;
  const ov = {
    hideSections: {
      nav:     $('page-hide-nav').checked,
      sidebar: $('page-hide-sidebar').checked,
      banner:  $('page-hide-banner').checked,
      footer:  $('page-hide-footer').checked,
    },
  };
  chrome.storage.local.get([KEYS.pageOverrides], stored => {
    const all = stored[KEYS.pageOverrides] || {};
    all[currentPageGroup] = ov;
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
    renderPageOverrides(all);
  });
});
