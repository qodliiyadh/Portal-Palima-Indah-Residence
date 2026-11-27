(() => {
  const palettes = [
    ['light', 'Taman Palima'], ['dark', 'Malam Palima'], ['lagoon', 'Laguna Biru'],
    ['sunset', 'Senja Terakota'], ['orchid', 'Anggrek Ungu'], ['citrus', 'Kebun Jeruk']
  ];
  const root = document.documentElement;
  const ornament = `<aside class="palima-home-ornament" aria-label="Portal warga"><div><span class="eyebrow">CURUG · KOTA SERANG</span><strong>Palima Indah Residence</strong><p>Ruang bersama untuk kabar dan layanan warga.</p></div></aside>`;
  const selector = (compact = false) => `<label class="palima-theme-picker${compact ? ' is-compact' : ''}"><span>Tema</span><select data-palima-theme>${palettes.map(([key, name]) => `<option value="${key}"${S.theme === key ? ' selected' : ''}>${name}</option>`).join('')}</select></label>`;
  const indexOf = key => palettes.findIndex(([id]) => id === key);

  window.applyTheme = () => {
    let index = indexOf(S.theme);
    if (index < 0) { index = 0; S.theme = palettes[0][0]; }
    root.dataset.theme = S.theme;
    const button = document.getElementById('themeBtn');
    if (button) {
      const next = palettes[(index + 1) % palettes.length][1];
      button.textContent = '◐';
      button.title = `Tema: ${palettes[index][1]} · Berikutnya: ${next}`;
      button.setAttribute('aria-label', `Ganti tema ke ${next}`);
    }
    document.querySelectorAll('[data-palima-theme]').forEach(select => { select.value = S.theme; });
  };

  function chooseTheme(key) {
    if (indexOf(key) < 0) return;
    S.theme = key;
    try { localStorage.setItem('theme', key); } catch { /* The current theme still applies. */ }
    window.applyTheme();
  }

  window.toggleTheme = () => chooseTheme(palettes[(indexOf(S.theme) + 1) % palettes.length][0]);
  document.addEventListener('change', event => {
    if (event.target.matches('select[data-palima-theme]')) chooseTheme(event.target.value);
  });

  function homeMarkup(html) {
    return html.includes('palima-home-ornament') ? html : ornament + html;
  }

  function settingsMarkup(html) {
    if (html.includes('data-palima-theme')) return html;
    const legacy = /<div class="setting-row">\s*<div><label>Mode Gelap<\/label>[\s\S]*?<div class="toggle[^>]*onclick="toggleTheme\(\);nav\('settings'\)"[^>]*><\/div>\s*<\/div>/;
    return legacy.test(html) ? html.replace(legacy, selector()) :
      `<div class="card palima-theme-card"><div class="card-header"><h3>Tampilan</h3></div><div class="card-body">${selector()}</div></div>${html}`;
  }

  const wrapped = new WeakSet();
  function wrap(name, decorate) {
    const original = window[name];
    if (typeof original !== 'function' || wrapped.has(original)) return;
    const wrapper = function (...args) { return decorate(original.apply(this, args)); };
    wrapped.add(wrapper);
    window[name] = wrapper;
  }

  function mount() {
    wrap('pgHome', homeMarkup);
    wrap('pgSettings', settingsMarkup);
    const content = document.getElementById('pageContent');
    if (content?.firstElementChild && S.page === 'home' && !content.querySelector('.palima-home-ornament')) {
      content.insertAdjacentHTML('afterbegin', ornament);
    }
    if (content?.firstElementChild && S.page === 'settings' && !content.querySelector('[data-palima-theme]')) {
      const legacy = content.querySelector('.setting-row .toggle[onclick^="toggleTheme()"]')?.closest('.setting-row');
      if (legacy) legacy.outerHTML = selector();
    }
    const nav = document.querySelector('#publicPage .public-nav');
    if (nav && !nav.querySelector('[data-palima-theme]')) {
      nav.querySelector('[data-public-login]')?.insertAdjacentHTML('beforebegin', selector(true));
    }
  }

  mount();
  window.applyTheme();
  const observer = new MutationObserver(mount);
  for (const id of ['pageContent', 'publicPage']) {
    const target = document.getElementById(id);
    if (target) observer.observe(target, { childList: true });
  }
  document.addEventListener('DOMContentLoaded', mount, { once: true });
})();
