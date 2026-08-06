(() => {
  const ROOT = document.documentElement;

  // Prevent flash of light mode: apply dark class immediately from session cache.
  // Session cache is set synchronously in applyDark/removeDark so the next
  // hard navigation within the same tab picks it up before the async storage
  // read completes.
  const _cached = sessionStorage.getItem('se-dark');
  if (_cached === '1') ROOT.classList.add('se-dark');

  // Shared preset palettes — keep in sync with popup.js PRESETS.
  const PRESETS = {
    github:     { name: 'GitHub',     bg: '#0d1117', bg2: '#161b22', bg3: '#21262d', border: '#30363d', text: '#e6edf3', muted: '#8b949e', accent: '#5522e0' },
    amoled:     { name: 'AMOLED',     bg: '#000000', bg2: '#0a0a0a', bg3: '#111111', border: '#1c1c1c', text: '#f0f0f0', muted: '#777777', accent: '#5522e0' },
    nord:       { name: 'Nord',       bg: '#2e3440', bg2: '#3b4252', bg3: '#434c5e', border: '#4c566a', text: '#eceff4', muted: '#d8dee9', accent: '#88c0d0' },
    dracula:    { name: 'Dracula',    bg: '#282a36', bg2: '#1e1f29', bg3: '#44475a', border: '#6272a4', text: '#f8f8f2', muted: '#6272a4', accent: '#bd93f9' },
    catppuccin: { name: 'Catppuccin', bg: '#1e1e2e', bg2: '#181825', bg3: '#313244', border: '#45475a', text: '#cdd6f4', muted: '#7f849c', accent: '#cba6f7' },
    tokyonight: { name: 'Tokyo Night',bg: '#1a1b26', bg2: '#16161e', bg3: '#24283b', border: '#292e42', text: '#c0caf5', muted: '#565f89', accent: '#7aa2f7' },
    gruvbox:    { name: 'Gruvbox',    bg: '#282828', bg2: '#1d2021', bg3: '#3c3836', border: '#504945', text: '#ebdbb2', muted: '#a89984', accent: '#d3869b' },
    onedark:    { name: 'One Dark',   bg: '#282c34', bg2: '#21252b', bg3: '#2c313c', border: '#3e4451', text: '#abb2bf', muted: '#5c6370', accent: '#61afef' },
  };

  // Selectors for the Superteam Earn wordmark logo across desktop/mobile navs.
  // Real DOM uses <div>/<a href="https://superteam.fun/earn"> (not <header>/<nav>)
  // and the logo is an inline-dark SVG (alt="Superteam Earn") that vanishes on
  // dark backgrounds — so we swap the <img src> for a bundled dark-ready logo.
  const LOGO_SELECTORS = [
    'img[alt="Superteam Earn"]',
    'a[href*="superteam.fun/earn"] img[src*="logo"]',
    'a[href$="/earn"] img[src*="logo"]',
    '.sticky img[src*="logo"]',
    'header img[src*="logo"]',
    'nav img[src*="logo"]',
    '[class*="navbar"] img[src*="logo"]',
  ];

  let state = {
    darkEnabled: false,
    custom: {
      bgColor: null, bg2Color: null, bg3Color: null, borderColor: null,
      textColor: null, mutedColor: null, accentColor: null,
      fontSize: 16,
      hideSections: { nav: false, sidebar: false, banner: false, footer: false },
      siteLogo: null,
      logoEnabled: false,
      wallpaperUrl: null,
      wallpaperOpacity: 0.15,
      readingMode: false,
    },
  };

  /* ── CSS variable injection — full 7-colour palette ──────────── */
  function applyCustomVars() {
    const c = state.custom;
    const set = (k, v) => { if (v) ROOT.style.setProperty(k, v); else ROOT.style.removeProperty(k); };

    set('--se-bg',         c.bgColor);
    set('--se-bg2',        c.bg2Color);
    set('--se-bg3',        c.bg3Color);
    set('--se-border',     c.borderColor);
    set('--se-text',       c.textColor);
    set('--se-text-muted', c.mutedColor);
    if (c.accentColor) {
      ROOT.style.setProperty('--se-accent', c.accentColor);
      ROOT.style.setProperty('--se-link',   c.accentColor);
    } else {
      ROOT.style.removeProperty('--se-accent');
      ROOT.style.removeProperty('--se-link');
    }
    ROOT.style.setProperty('--se-font-size', `${c.fontSize || 16}px`);

    if (c.wallpaperUrl) {
      ROOT.style.setProperty('--se-wallpaper-url', `url("${c.wallpaperUrl}")`);
      ROOT.style.setProperty('--se-wallpaper-opacity', String(c.wallpaperOpacity ?? 0.15));
    } else {
      ROOT.style.removeProperty('--se-wallpaper-url');
      ROOT.style.removeProperty('--se-wallpaper-opacity');
    }
  }

  function clearCustomVars() {
    ['--se-bg', '--se-bg2', '--se-bg3', '--se-border', '--se-text', '--se-text-muted',
     '--se-accent', '--se-link', '--se-font-size',
     '--se-wallpaper-url', '--se-wallpaper-opacity'].forEach(v => ROOT.style.removeProperty(v));
  }

  /* ── Section hide classes + reading mode ─────────────────────── */
  function applySectionClasses() {
    const { nav, sidebar, banner, footer } = state.custom.hideSections;
    ROOT.classList.toggle('se-hide-nav',     !!nav);
    ROOT.classList.toggle('se-hide-sidebar', !!sidebar);
    ROOT.classList.toggle('se-hide-banner',  !!banner);
    ROOT.classList.toggle('se-hide-footer',  !!footer);
    ROOT.classList.toggle('se-reading',      !!state.custom.readingMode);
  }

  /* ── Logo swap — automatic in dark mode so the wordmark stays
        visible; custom user logo wins when enabled. ─────────────── */
  function swapLogos(enable) {
    if (!enable) {
      document.querySelectorAll('img[data-se-original]').forEach(img => {
        img.src = img.dataset.seOriginal;
        delete img.dataset.seOriginal;
        delete img.dataset.seDark;
      });
      return;
    }

    const logoUrl = (state.custom.logoEnabled && state.custom.siteLogo)
      ? state.custom.siteLogo
      : chrome.runtime.getURL('assets/earn-logo-dark.png');

    const seen = new Set();
    LOGO_SELECTORS.forEach(sel => {
      let nodes;
      try { nodes = document.querySelectorAll(sel); } catch { return; }
      nodes.forEach(img => {
        if (seen.has(img)) return;
        seen.add(img);
        // Skip the partner "Frontier" mark and other non-Earn imagery.
        if (img.alt && /frontier/i.test(img.alt)) return;
        if (img.src === logoUrl) return;
        if (!img.dataset.seOriginal) img.dataset.seOriginal = img.src;
        img.dataset.seDark = 'true';
        img.src = logoUrl;
      });
    });
  }

  /* ── Master apply / remove ───────────────────────────────────── */
  function applyDark() {
    sessionStorage.setItem('se-dark', '1');
    ROOT.classList.add('se-dark');
    applyCustomVars();
    applySectionClasses();
    swapLogos(true);
    updateToolbar();
  }

  function removeDark() {
    sessionStorage.setItem('se-dark', '0');
    ROOT.classList.remove('se-dark');
    clearCustomVars();
    ROOT.classList.remove('se-hide-nav', 'se-hide-sidebar', 'se-hide-banner', 'se-hide-footer', 'se-reading');
    swapLogos(false);
    updateToolbar();
  }

  function decide(s) {
    state = s;
    if (s.darkEnabled) applyDark();
    else removeDark();
  }

  /* ── Per-page group detection ────────────────────────────────── */
  function getPageGroup() {
    const p = window.location.pathname;
    if (p.includes('/bounties'))    return 'bounties';
    if (p.includes('/projects'))    return 'projects';
    if (p.includes('/grants'))      return 'grants';
    if (p.includes('/leaderboard')) return 'leaderboard';
    if (p.includes('/feed'))        return 'feed';
    if (p.includes('/t/'))          return 'profile';
    if (p.includes('/s/'))          return 'sponsor';
    return 'home';
  }

  /* ── Reload state from storage ───────────────────────────────── */
  function loadAndApply() {
    chrome.storage.local.get(null, stored => {
      const s = buildState(stored);
      const active = isDarkActive(s);
      decide({ ...s, darkEnabled: active });
    });
  }

  function buildState(stored) {
    const globalHide = {
      nav:     stored['custom.hideSections.nav']     ?? false,
      sidebar: stored['custom.hideSections.sidebar'] ?? false,
      banner:  stored['custom.hideSections.banner']  ?? false,
      footer:  stored['custom.hideSections.footer']  ?? false,
    };

    const overrides = stored['custom.pageOverrides'] || {};
    const pageOv = overrides[getPageGroup()];
    if (pageOv && pageOv.hideSections) Object.assign(globalHide, pageOv.hideSections);

    return {
      mode: stored.mode || 'manual',
      darkEnabled: stored.darkEnabled ?? false,
      timeStart: stored.timeStart || '21:00',
      timeEnd: stored.timeEnd || '07:00',
      custom: {
        bgColor:          stored['custom.bgColor']          || null,
        bg2Color:         stored['custom.bg2Color']         || null,
        bg3Color:         stored['custom.bg3Color']         || null,
        borderColor:      stored['custom.borderColor']      || null,
        textColor:        stored['custom.textColor']        || null,
        mutedColor:       stored['custom.mutedColor']       || null,
        accentColor:      stored['custom.accentColor']      || null,
        fontSize:         stored['custom.fontSize']         || 16,
        siteLogo:         stored['custom.siteLogo']         || null,
        logoEnabled:      stored['custom.logoEnabled']      ?? false,
        wallpaperUrl:     stored['custom.wallpaperUrl']     || null,
        wallpaperOpacity: stored['custom.wallpaperOpacity'] ?? 0.15,
        readingMode:      stored['custom.readingMode']      ?? false,
        hideSections:     globalHide,
      },
    };
  }

  function isDarkActive(s) {
    if (s.mode === 'manual') return s.darkEnabled;
    if (s.mode === 'system') return window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (s.mode === 'time')   return isInTimeRange(s.timeStart, s.timeEnd);
    return false;
  }

  function isInTimeRange(start, end) {
    const now = new Date();
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    const nowMin   = now.getHours() * 60 + now.getMinutes();
    const startMin = sh * 60 + sm;
    const endMin   = eh * 60 + em;
    if (startMin <= endMin) return nowMin >= startMin && nowMin < endMin;
    return nowMin >= startMin || nowMin < endMin;
  }

  /* ── In-page toolbar (quick toggle + theme menu) ─────────────── */
  const SUN_ICON  = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>';
  const MOON_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  const PALETTE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r="1.5"/><circle cx="17.5" cy="10.5" r="1.5"/><circle cx="8.5" cy="7.5" r="1.5"/><circle cx="6.5" cy="12.5" r="1.5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.563-2.512 5.563-5.563C22 6.012 17.5 2 12 2z"/></svg>';

  // Build a fresh toolbar cluster. Class-based (no ids) so both the desktop
  // and mobile navbars can each carry their own working instance.
  function buildToolbar() {
    const cluster = document.createElement('div');
    cluster.className = 'se-toolbar';

    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'se-tb-btn se-tb-toggle';
    toggleBtn.type = 'button';
    toggleBtn.title = 'Toggle dark mode';
    toggleBtn.setAttribute('aria-label', 'Toggle dark mode');

    const menuBtn = document.createElement('button');
    menuBtn.className = 'se-tb-btn se-tb-menu-btn';
    menuBtn.type = 'button';
    menuBtn.title = 'Choose theme';
    menuBtn.setAttribute('aria-label', 'Choose theme');
    menuBtn.innerHTML = PALETTE_ICON;

    const menu = document.createElement('div');
    menu.className = 'se-tb-menu';

    Object.entries(PRESETS).forEach(([key, p]) => {
      const item = document.createElement('button');
      item.className = 'se-tb-menu-item';
      item.type = 'button';
      item.dataset.preset = key;
      item.innerHTML =
        `<span class="se-tb-swatch" style="background:${p.bg};border-color:${p.border}">` +
        `<i style="background:${p.accent}"></i></span>` +
        `<span class="se-tb-name">${p.name}</span>`;
      item.addEventListener('click', (e) => { e.stopPropagation(); applyPreset(key); closeAllMenus(); });
      menu.appendChild(item);
    });

    cluster.appendChild(toggleBtn);
    cluster.appendChild(menuBtn);
    cluster.appendChild(menu);

    toggleBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleDark(); });
    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = menu.classList.contains('open');
      closeAllMenus();
      if (!isOpen) { menu.classList.add('open'); updateToolbar(); }
    });

    return cluster;
  }

  function mountToolbar() {
    const stickies = document.querySelectorAll('div.sticky.top-0');
    let mounted = false;
    stickies.forEach(sticky => {
      if (sticky.querySelector('.se-toolbar')) { mounted = true; return; }
      // Slot into the navbar's right-hand action group so the existing
      // justify-between layout isn't disturbed.
      const jb = sticky.querySelector('.justify-between');
      let target;
      if (jb && jb.children.length >= 2) target = jb.lastElementChild;
      else target = jb || sticky.firstElementChild;
      if (!target) return;
      target.appendChild(buildToolbar());
      mounted = true;
    });
    if (mounted) updateToolbar();
  }

  function updateToolbar() {
    const on = ROOT.classList.contains('se-dark');
    document.querySelectorAll('.se-toolbar').forEach(cluster => {
      cluster.classList.toggle('se-on', on);
      const toggleBtn = cluster.querySelector('.se-tb-toggle');
      if (toggleBtn) toggleBtn.innerHTML = on ? MOON_ICON : SUN_ICON;
    });
    const bg = (ROOT.style.getPropertyValue('--se-bg').trim() || state.custom.bgColor || '').toLowerCase();
    document.querySelectorAll('.se-tb-menu-item').forEach(item => {
      const p = PRESETS[item.dataset.preset];
      item.classList.toggle('active', !!p && p.bg.toLowerCase() === bg);
    });
  }

  function closeAllMenus() {
    document.querySelectorAll('.se-tb-menu.open').forEach(m => m.classList.remove('open'));
  }
  // One global outside-click closer for every menu instance.
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.se-toolbar')) closeAllMenus();
  });

  function toggleDark() {
    const turningOn = !ROOT.classList.contains('se-dark');
    // The quick toggle is authoritative — force manual mode so it sticks.
    chrome.storage.local.set({ mode: 'manual', darkEnabled: turningOn });
  }

  function applyPreset(key) {
    const p = PRESETS[key];
    if (!p) return;
    chrome.storage.local.set({
      'mode': 'manual',
      'darkEnabled': true,
      'custom.bgColor':     p.bg,
      'custom.bg2Color':    p.bg2,
      'custom.bg3Color':    p.bg3,
      'custom.borderColor': p.border,
      'custom.textColor':   p.text,
      'custom.mutedColor':  p.muted,
      'custom.accentColor': p.accent,
    });
  }

  /* ── Storage change listener — self-updates without messaging ── */
  let storageTimer = null;
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    clearTimeout(storageTimer);
    storageTimer = setTimeout(loadAndApply, 50);
  });

  /* ── Message listener — live preview from popup ──────────────── */
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'SE_APPLY') loadAndApply();
    if (msg.type === 'SE_PREVIEW_COLOR') ROOT.style.setProperty(msg.key, msg.value);
    if (msg.type === 'SE_TOGGLE') { msg.dark ? applyDark() : removeDark(); }
  });

  /* ── System theme watcher ────────────────────────────────────── */
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', loadAndApply);

  /* ── MutationObserver — re-apply + re-mount after SPA nav ────── */
  let navTimer = null;
  const observer = new MutationObserver(() => {
    clearTimeout(navTimer);
    navTimer = setTimeout(() => {
      mountToolbar();
      if (state.darkEnabled) {
        applyCustomVars();
        applySectionClasses();
        swapLogos(true);
      }
    }, 250);
  });

  function startObserver() {
    observer.observe(document.body || document.documentElement, { childList: true, subtree: true });
  }

  if (document.body) { startObserver(); mountToolbar(); }
  else document.addEventListener('DOMContentLoaded', () => { startObserver(); mountToolbar(); });

  loadAndApply();
})();
