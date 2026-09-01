(() => {
  const ROOT = document.documentElement;

  // Prevent flash of light mode: apply dark class immediately from session cache.
  // Session cache is set synchronously in applyDark/removeDark so the next
  // hard navigation within the same tab picks it up before the async storage
  // read completes.
  const _cached = sessionStorage.getItem('se-dark');
  if (_cached === '1') ROOT.classList.add('se-dark');

  // Palette that dark.css falls back to when no custom colours are set.
  // Matches the html.se-dark block at the top of dark.css and the GitHub
  // preset below; used to resolve derived colours and menu highlighting
  // on a fresh install, where no --se-* variables are set inline yet.
  const DEFAULT_BG  = '#0d1117';
  const DEFAULT_BG2 = '#161b22';
  const DEFAULT_BG3 = '#21262d';

  // Shared preset palettes — keep in sync with popup.js PRESETS.
  const PRESETS = {
    github:     { name: 'GitHub',     bg: '#0d1117', bg2: '#161b22', bg3: '#21262d', border: '#30363d', text: '#e6edf3', muted: '#8b949e', accent: '#5522e0' },
    amoled:     { name: 'AMOLED',     bg: '#000000', bg2: '#000000', bg3: '#000000', border: '#242424', text: '#f0f0f0', muted: '#9a9a9a', accent: '#5522e0' },
    nord:       { name: 'Nord',       bg: '#2e3440', bg2: '#3b4252', bg3: '#434c5e', border: '#4c566a', text: '#eceff4', muted: '#d8dee9', accent: '#88c0d0' },
    dracula:    { name: 'Dracula',    bg: '#282a36', bg2: '#1e1f29', bg3: '#44475a', border: '#6272a4', text: '#f8f8f2', muted: '#b2bade', accent: '#bd93f9' },
    catppuccin: { name: 'Catppuccin', bg: '#1e1e2e', bg2: '#181825', bg3: '#313244', border: '#45475a', text: '#cdd6f4', muted: '#a6adc8', accent: '#cba6f7' },
    tokyonight: { name: 'Tokyo Night',bg: '#1a1b26', bg2: '#16161e', bg3: '#24283b', border: '#292e42', text: '#c0caf5', muted: '#9aa5ce', accent: '#7aa2f7' },
    gruvbox:    { name: 'Gruvbox',    bg: '#282828', bg2: '#1d2021', bg3: '#3c3836', border: '#504945', text: '#ebdbb2', muted: '#b5a68f', accent: '#d3869b' },
    onedark:    { name: 'One Dark',   bg: '#282c34', bg2: '#21252b', bg3: '#2c313c', border: '#3e4451', text: '#abb2bf', muted: '#a0a8b5', accent: '#61afef' },
  };

  function applyThemeColors(p) {
    chrome.storage.local.set({
      mode: 'manual',
      darkEnabled: true,
      'custom.bgColor':     p.bg,
      'custom.bg2Color':    p.bg2,
      'custom.bg3Color':    p.bg3,
      'custom.borderColor': p.border,
      'custom.textColor':   p.text,
      'custom.mutedColor':  p.muted,
      'custom.accentColor': p.accent,
    });
  }

  let state = {
    darkEnabled: false,
    custom: {
      bgColor: null, bg2Color: null, bg3Color: null, borderColor: null,
      textColor: null, mutedColor: null, accentColor: null,
      fontSize: 16,
      hideSections: { nav: false, sidebar: false, banner: false, footer: false },
      wallpaperUrl: null,
      wallpaperOpacity: 0.15,
      savedThemes: [],
    },
  };

  /* ── Colour maths for derived accent variables ────────────────
     The palette lets users pick any accent, including light ones
     (Dracula's #bd93f9, Nord's #88c0d0). Two things then break if the
     accent is used raw:
       • accent-filled CTAs hardcoded `color: #fff` become white-on-
         lavender, and
       • accent-coloured TEXT on the page background drops to ~1.4:1.
     So derive two companions from the accent + background and let the
     CSS consume those instead. Both are recomputed on every palette
     change; dark.css carries static fallbacks for the default theme. */
  function parseHex(hex) {
    if (typeof hex !== 'string') return null;
    const m = hex.trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (!m) return null;
    let h = m[1];
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
  }

  const toHex = rgb => '#' + rgb.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');

  // WCAG relative luminance.
  function relLum([r, g, b]) {
    const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  }

  const contrast = (a, b) => {
    const [hi, lo] = relLum(a) > relLum(b) ? [relLum(a), relLum(b)] : [relLum(b), relLum(a)];
    return (hi + 0.05) / (lo + 0.05);
  };

  const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

  // Readable foreground for text sitting ON an accent-filled surface.
  function accentForeground(accent) {
    const rgb = parseHex(accent);
    if (!rgb) return null;
    return contrast(rgb, [255, 255, 255]) >= contrast(rgb, [13, 17, 23]) ? '#ffffff' : '#0d1117';
  }

  // Accent nudged toward the background's opposite until accent-coloured
  // TEXT clears 4.5:1 against EVERY surface it can land on — the page
  // background, panels and the hover/input layer. Measuring against the
  // page background alone wasn't enough: the AI-agent announcement bar
  // and the active filter pill sit on the lighter surfaces, where an
  // accent that passed on --se-bg still measured ~2:1. Returns the accent
  // untouched when it already passes everywhere, so brand colour is
  // preserved wherever it is already legible.
  function accentText(accent, surfaces) {
    const a = parseHex(accent);
    const bgs = surfaces.map(parseHex).filter(Boolean);
    if (!a || !bgs.length) return null;
    const worst = rgb => Math.min(...bgs.map(b => contrast(rgb, b)));
    // Lightest surface decides the direction, so one accent works on all.
    const lightest = bgs.reduce((m, b) => (relLum(b) > relLum(m) ? b : m), bgs[0]);
    const target = relLum(lightest) > 0.45 ? [0, 0, 0] : [255, 255, 255];
    let best = a;
    for (let t = 0; t <= 1.0001; t += 0.05) {
      best = mix(a, target, t);
      if (worst(best) >= 4.5) break;
    }
    return toHex(best);
  }

  // Recompute --se-accent-fg / --se-accent-text from whatever accent and
  // background are currently live on ROOT (inline first, then the
  // dark.css defaults). Shared by the storage path and live preview.
  function refreshDerivedAccentVars() {
    const read = k => ROOT.style.getPropertyValue(k).trim();
    const accent = read('--se-accent') || state.custom.accentColor;
    if (!accent) return;
    const surf = [
      read('--se-bg')  || state.custom.bgColor  || DEFAULT_BG,
      read('--se-bg2') || state.custom.bg2Color || DEFAULT_BG2,
      read('--se-bg3') || state.custom.bg3Color || DEFAULT_BG3,
    ];
    const fg   = accentForeground(accent);
    const text = accentText(accent, surf);
    if (fg)   ROOT.style.setProperty('--se-accent-fg', fg);
    if (text) {
      ROOT.style.setProperty('--se-accent-text', text);
      ROOT.style.setProperty('--se-link', text);
    }
  }

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
      const fg   = accentForeground(c.accentColor);
      const text = accentText(c.accentColor, [
        c.bgColor  || DEFAULT_BG,
        c.bg2Color || DEFAULT_BG2,
        c.bg3Color || DEFAULT_BG3,
      ]);
      ROOT.style.setProperty('--se-accent', c.accentColor);
      set('--se-accent-fg',   fg);
      set('--se-accent-text', text);
      set('--se-link',        text);
    } else {
      ['--se-accent', '--se-accent-fg', '--se-accent-text', '--se-link']
        .forEach(v => ROOT.style.removeProperty(v));
    }
    /* Font size ships as BOTH an absolute px value and a scale factor.
       The px var alone only ever moved elements that inherit from body —
       on Earn that is almost nothing, because every text node carries a
       Tailwind text-* utility with a hardcoded rem size, which wins. The
       scale factor lets dark.css re-express each of those utilities as
       `calc(<its rem> * var(--se-font-scale))`, so the slider moves the
       whole page instead of just the welcome banner. */
    const fontPx = c.fontSize || 16;
    ROOT.style.setProperty('--se-font-size', `${fontPx}px`);
    ROOT.style.setProperty('--se-font-scale', String(fontPx / 16));

    // The wallpaper needs the page's own opaque surfaces switched off
    // (see the .se-wallpaper block in dark.css), so it's a class, not
    // just a variable.
    if (c.wallpaperUrl) {
      ROOT.style.setProperty('--se-wallpaper-url', `url("${c.wallpaperUrl}")`);
      ROOT.style.setProperty('--se-wallpaper-opacity', String(c.wallpaperOpacity ?? 0.15));
      ROOT.classList.add('se-wallpaper');
    } else {
      ROOT.style.removeProperty('--se-wallpaper-url');
      ROOT.style.removeProperty('--se-wallpaper-opacity');
      ROOT.classList.remove('se-wallpaper');
    }
  }

  function clearCustomVars() {
    ['--se-bg', '--se-bg2', '--se-bg3', '--se-border', '--se-text', '--se-text-muted',
     '--se-accent', '--se-accent-fg', '--se-accent-text', '--se-link', '--se-font-size',
     '--se-font-scale', '--se-wallpaper-url', '--se-wallpaper-opacity'].forEach(v => ROOT.style.removeProperty(v));
    ROOT.classList.remove('se-wallpaper');
  }

  // The dark "Powered by Solana" badge lives in the extension bundle, and
  // a relative URL in an injected content-script stylesheet resolves
  // against the PAGE, not the stylesheet — so dark.css can't name the file
  // itself. Hand it an absolute chrome-extension:// URL once at startup
  // (assets/* is declared web_accessible_resources, which also exempts it
  // from the page's img-src policy).
  function setBundledAssetVars() {
    try {
      ROOT.style.setProperty(
        '--se-solana-logo',
        `url("${chrome.runtime.getURL('assets/solana-dark-logo.svg')}")`);
    } catch (e) { /* extension context torn down — badge just stays light */ }
  }

  /* ── Section hide classes ─────────────────────────────────────── */
  function applySectionClasses() {
    const { nav, sidebar, banner, footer } = state.custom.hideSections;
    ROOT.classList.toggle('se-hide-nav',     !!nav);
    ROOT.classList.toggle('se-hide-sidebar', !!sidebar);
    ROOT.classList.toggle('se-hide-banner',  !!banner);
    ROOT.classList.toggle('se-hide-footer',  !!footer);
    syncFloatingToolbar(!!nav);
  }

  // Hiding the nav hides the toolbar with it, which would leave no in-page
  // way back to light mode. So when nav-hiding is on, keep one toolbar
  // pinned to the viewport instead.
  function syncFloatingToolbar(navHidden) {
    const existing = document.querySelector('.se-toolbar-floating');
    if (!navHidden) { if (existing) existing.remove(); return; }
    if (existing || !document.body) return;
    const cluster = buildToolbar();
    cluster.classList.add('se-toolbar-floating');
    document.body.appendChild(cluster);
    updateToolbar();
  }

  /* ── Master apply / remove ───────────────────────────────────── */
  function applyDark() {
    sessionStorage.setItem('se-dark', '1');
    ROOT.classList.add('se-dark');
    applyCustomVars();
    updateToolbar();
  }

  function removeDark() {
    sessionStorage.setItem('se-dark', '0');
    ROOT.classList.remove('se-dark');
    clearCustomVars();
    updateToolbar();
  }

  // Hide-sections is a declutter feature independent of the color theme
  // (see the .se-hide-* rules in dark.css, which aren't scoped to
  // html.se-dark), so it's applied unconditionally here rather than
  // inside applyDark()/removeDark() — it must keep working, live, with
  // dark mode off and without needing a page reload.
  function decide(s) {
    state = s;
    applySectionClasses();
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

    // Only keys the override actually carries are merged. The popup now
    // stores just the differences from the globals (see savePageOverride),
    // so an absent key means "follow the global switch" rather than "off".
    const overrides = stored['custom.pageOverrides'] || {};
    const pageOv = overrides[getPageGroup()];
    if (pageOv && pageOv.hideSections) {
      for (const [k, val] of Object.entries(pageOv.hideSections)) {
        if (typeof val === 'boolean' && k in globalHide) globalHide[k] = val;
      }
    }

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
        wallpaperUrl:     stored['custom.wallpaperUrl']     || null,
        wallpaperOpacity: stored['custom.wallpaperOpacity'] ?? 0.15,
        savedThemes:      stored['custom.savedThemes'] || [],
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
  /* Theme button glyph — three stacked horizontal bars in a live accent
     gradient, staggered in width. The previous glyph was three vertical
     paint chips, which at 18px read as three grey blobs of no particular
     shape and looked bolted on next to Earn's flat line icons. Bars in a
     gradient read as "theme sliders" instantly, and because the stops are
     the palette's own --se-accent / --se-accent-text, the button restains
     itself the moment a preset is applied — no repaint code needed.
     Every instance needs its OWN gradient id: two toolbars (desktop +
     mobile) sharing one id is a duplicate-id document, and the second
     fill would resolve against the first toolbar's def, which breaks the
     moment that toolbar is removed on an SPA re-render. */
  let themeIconSeq = 0;
  function themeIcon() {
    const id = `se-tb-grad-${++themeIconSeq}`;
    return (
      `<svg viewBox="0 0 24 24" fill="none">` +
        `<defs>` +
          `<linearGradient id="${id}" x1="3" y1="0" x2="21" y2="0" gradientUnits="userSpaceOnUse">` +
            `<stop offset="0" stop-color="var(--se-accent, #5522e0)"/>` +
            `<stop offset="1" stop-color="var(--se-accent-text, #a78bfa)"/>` +
          `</linearGradient>` +
        `</defs>` +
        `<rect x="3" y="4.75"  width="18"   height="3.5" rx="1.75" fill="url(#${id})"/>` +
        `<rect x="3" y="10.25" width="13.5" height="3.5" rx="1.75" fill="url(#${id})" opacity=".85"/>` +
        `<rect x="3" y="15.75" width="9"    height="3.5" rx="1.75" fill="url(#${id})" opacity=".7"/>` +
      `</svg>`
    );
  }

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
    menuBtn.innerHTML = themeIcon();

    const menu = document.createElement('div');
    menu.className = 'se-tb-menu';

    const presetsGrid = document.createElement('div');
    presetsGrid.className = 'se-tb-menu-grid';
    Object.entries(PRESETS).forEach(([key, p]) => {
      const item = document.createElement('button');
      item.className = 'se-tb-menu-item';
      item.type = 'button';
      item.dataset.preset = key;
      item.innerHTML =
        `<span class="se-tb-swatch" style="--sw-bg:${p.bg};--sw-accent:${p.accent}"></span>` +
        `<span class="se-tb-name">${p.name}</span>`;
      item.addEventListener('click', (e) => { e.stopPropagation(); applyPreset(key); closeAllMenus(); });
      presetsGrid.appendChild(item);
    });
    menu.appendChild(presetsGrid);

    const customLabel = document.createElement('div');
    customLabel.className = 'se-tb-menu-label';
    customLabel.textContent = 'YOUR THEMES';
    menu.appendChild(customLabel);

    const customGrid = document.createElement('div');
    customGrid.className = 'se-tb-menu-grid se-tb-menu-custom-grid';
    menu.appendChild(customGrid);

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
      // The right-hand slot is a plain wrapper on the desktop navbar but a
      // bare <button> on the mobile one. Appending into it would nest a
      // button inside a button — invalid markup, and every click on our
      // toggle would also activate the host control. Appending to the flex
      // row instead is no good either: the row is justify-between, so a
      // third child makes the site's own Login button drift to the centre.
      // So slip a wrapper around the host control and share it, which
      // leaves the row at two children and the site's layout untouched.
      const host = target.closest('button, a, [role="button"]');
      if (host && host.parentElement) {
        target = host.parentElement.classList.contains('se-tb-slot')
          ? host.parentElement
          : (() => {
              const slot = document.createElement('div');
              slot.className = 'se-tb-slot';
              host.parentElement.insertBefore(slot, host);
              slot.appendChild(host);
              return slot;
            })();
      }
      target.appendChild(buildToolbar());
      mounted = true;
    });
    if (state.custom.hideSections.nav) syncFloatingToolbar(true);
    if (mounted) updateToolbar();
  }

  // Both handlers below use the cached `state` only for the dialog's
  // default text (harmless if briefly stale) — the actual read-modify-write
  // re-reads storage fresh right before saving, so two tabs editing themes
  // within the same ~50ms debounce window can't clobber each other via a
  // stale full-array overwrite.
  function renameSavedTheme(id) {
    const cached = (state.custom.savedThemes || []).find(x => x.id === id);
    if (!cached) return;
    const name = prompt('Rename theme:', cached.name);
    if (!name || !name.trim()) return;
    chrome.storage.local.get(['custom.savedThemes'], stored => {
      const themes = stored['custom.savedThemes'] || [];
      const theme = themes.find(x => x.id === id);
      if (!theme || name.trim() === theme.name) return;
      const updated = themes.map(x => x.id === id ? { ...x, name: name.trim() } : x);
      chrome.storage.local.set({ 'custom.savedThemes': updated });
    });
  }

  function deleteSavedTheme(id) {
    const cached = (state.custom.savedThemes || []).find(x => x.id === id);
    if (!cached || !confirm(`Delete theme "${cached.name}"?`)) return;
    chrome.storage.local.get(['custom.savedThemes'], stored => {
      const themes = stored['custom.savedThemes'] || [];
      chrome.storage.local.set({ 'custom.savedThemes': themes.filter(x => x.id !== id) });
    });
  }

  function refreshCustomThemesMenu() {
    document.querySelectorAll('.se-tb-menu-custom-grid').forEach(grid => {
      grid.innerHTML = '';
      const themes = state.custom.savedThemes || [];
      const label = grid.previousElementSibling;
      if (label && label.classList.contains('se-tb-menu-label')) {
        label.style.display = themes.length ? '' : 'none';
      }
      themes.forEach(t => {
        const item = document.createElement('button');
        item.className = 'se-tb-menu-item';
        item.type = 'button';
        item.dataset.themeId = t.id;

        // Built via textContent/createElement rather than innerHTML
        // interpolation — theme names are free-form user text (from a
        // prompt()), so this avoids ever parsing user-entered text as HTML.
        const swatch = document.createElement('span');
        swatch.className = 'se-tb-swatch';
        swatch.style.setProperty('--sw-bg', t.bg);
        swatch.style.setProperty('--sw-accent', t.accent);

        const nameEl = document.createElement('span');
        nameEl.className = 'se-tb-name';
        nameEl.textContent = t.name;

        const row = document.createElement('span');
        row.className = 'se-tb-menu-item-row';
        const editEl = document.createElement('span');
        editEl.className = 'se-tb-menu-edit';
        editEl.title = 'Rename';
        editEl.textContent = '✎';
        const deleteEl = document.createElement('span');
        deleteEl.className = 'se-tb-menu-delete';
        deleteEl.title = 'Delete';
        deleteEl.textContent = '×';
        row.append(editEl, deleteEl);

        item.append(swatch, nameEl, row);

        item.addEventListener('click', (e) => { e.stopPropagation(); applyThemeColors(t); closeAllMenus(); });
        editEl.addEventListener('click', (e) => { e.stopPropagation(); renameSavedTheme(t.id); });
        deleteEl.addEventListener('click', (e) => { e.stopPropagation(); deleteSavedTheme(t.id); });
        grid.appendChild(item);
      });
    });
  }

  function updateToolbar() {
    const on = ROOT.classList.contains('se-dark');
    document.querySelectorAll('.se-toolbar').forEach(cluster => {
      cluster.classList.toggle('se-on', on);
      const toggleBtn = cluster.querySelector('.se-tb-toggle');
      if (toggleBtn) toggleBtn.innerHTML = on ? MOON_ICON : SUN_ICON;
    });
    refreshCustomThemesMenu();
    // Falls back to DEFAULT_BG so the preset actually in effect on a
    // fresh install (GitHub, via dark.css's own variable block) is
    // highlighted, rather than the menu showing nothing as active.
    const bg = (ROOT.style.getPropertyValue('--se-bg').trim() || state.custom.bgColor || DEFAULT_BG).toLowerCase();
    document.querySelectorAll('.se-tb-menu-item').forEach(item => {
      const p = item.dataset.preset ? PRESETS[item.dataset.preset]
              : item.dataset.themeId ? state.custom.savedThemes.find(t => t.id === item.dataset.themeId)
              : null;
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
    applyThemeColors(p);
  }

  /* ── CSP violation record ─────────────────────────────────────
     The page reports every resource its own policy refuses. Watching
     img-src violations is the only reliable way to know a wallpaper URL
     was rejected, since the refusal happens inside the page's styling
     and produces no error the extension would otherwise observe. */
  const cspBlockedImages = new Set();
  document.addEventListener('securitypolicyviolation', (e) => {
    const directive = e.effectiveDirective || e.violatedDirective || '';
    if (directive.startsWith('img-src') && e.blockedURI) cspBlockedImages.add(e.blockedURI);
  });

  // blockedURI is sometimes reported stripped of its query string, so
  // compare on the path-and-origin portion rather than requiring equality.
  function isImageBlockedByCsp(url) {
    const base = u => String(u).split('?')[0].replace(/\/$/, '');
    const target = base(url);
    for (const blocked of cspBlockedImages) {
      const b = base(blocked);
      if (b === target || target.startsWith(b) || b.startsWith(target)) return true;
    }
    return false;
  }

  /* ── Storage change listener — self-updates without messaging ── */
  let storageTimer = null;
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    clearTimeout(storageTimer);
    storageTimer = setTimeout(loadAndApply, 50);
  });

  /* ── Message listener — live preview from popup ──────────────── */
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    // A wallpaper URL can fail two different ways, and the user sees the
    // same nothing either way, so report which one it was.
    //   'csp'  — Earn sends `img-src 'self' blob: data: <a few CDNs>` and
    //            the stylesheet's load is refused. Detected from the
    //            securitypolicyviolation record below, NOT by loading the
    //            image here: a content script fetches under the isolated
    //            world's CSP, not the page's, so new Image() happily
    //            succeeds on a URL the page will refuse.
    //   'load' — the URL is permitted but broken (404, bad host, not an
    //            image). Here new Image() IS the right test.
    if (msg.type === 'SE_PROBE_WALLPAPER') {
      const url = msg.url;
      setTimeout(() => {
        if (isImageBlockedByCsp(url)) { sendResponse({ ok: false, reason: 'csp' }); return; }
        const img = new Image();
        img.onload  = () => sendResponse({ ok: true });
        img.onerror = () => sendResponse({ ok: false, reason: 'load' });
        img.src = url;
      }, 700);  // let the just-applied stylesheet attempt its load first
      return true;  // keep the message channel open for the async reply
    }
    if (msg.type === 'SE_APPLY') loadAndApply();
    if (msg.type === 'SE_PREVIEW_COLOR') {
      ROOT.style.setProperty(msg.key, msg.value);
      // --se-accent-fg / --se-accent-text are derived, so a live preview
      // that only pushed the raw accent would leave CTAs and accent text
      // showing the previous palette's contrast correction until save.
      if (msg.key === '--se-accent' || msg.key === '--se-bg') refreshDerivedAccentVars();
      // --se-font-scale is what actually moves Tailwind's text-* utilities
      // (see applyCustomVars), so a preview that only pushed the px var
      // would leave the page size unchanged until the debounced save.
      if (msg.key === '--se-font-size') {
        ROOT.style.setProperty('--se-font-scale', String((parseFloat(msg.value) || 16) / 16));
      }
      // Wallpaper visibility is gated on the class, not just the URL var
      // (it has to switch the page's opaque surfaces off), so a previewed
      // wallpaper needs the class toggled here too or nothing shows until
      // the value is saved.
      if (msg.key === '--se-wallpaper-url') {
        ROOT.classList.toggle('se-wallpaper', !!msg.value && msg.value !== 'none');
      }
    }
    if (msg.type === 'SE_TOGGLE') { msg.dark ? applyDark() : removeDark(); }
  });

  /* ── System theme watcher ────────────────────────────────────── */
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', loadAndApply);

  /* ── MutationObserver — re-apply + re-mount after SPA nav ──────
     Earn is a client-side-routed SPA, so a path change fires no
     navigation event we can hook. Section-hiding is configurable
     per page group, which means the cached `state` built for the
     previous group is wrong the moment the path changes — reapplying
     it would both miss the new page's overrides AND leave the old
     page's hidden nav/sidebar in place. So watch the pathname and
     rebuild state from storage (which re-reads getPageGroup()) when
     it moves; otherwise just re-mount and re-apply cheaply. */
  let navTimer = null;
  let lastPath = window.location.pathname;
  const observer = new MutationObserver(() => {
    clearTimeout(navTimer);
    navTimer = setTimeout(() => {
      mountToolbar();
      if (window.location.pathname !== lastPath) {
        lastPath = window.location.pathname;
        loadAndApply();
      } else {
        applySectionClasses();
      }
    }, 250);
  });

  function startObserver() {
    observer.observe(document.body || document.documentElement, { childList: true, subtree: true });
  }

  setBundledAssetVars();

  if (document.body) { startObserver(); mountToolbar(); }
  else document.addEventListener('DOMContentLoaded', () => { startObserver(); mountToolbar(); });

  loadAndApply();
})();
