(() => {
  'use strict';
  const source = 'https://bimasislam.kemenag.go.id/jadwal-sholat';
  const fields = Object.entries({ imsak: 'Imsak', subuh: 'Subuh', terbit: 'Terbit', dhuha: 'Dhuha',
    dzuhur: 'Zuhur', ashar: 'Asar', maghrib: 'Magrib', isya: 'Isya' });
  const mounts = new WeakMap();
  const pad = n => String(n).padStart(2, '0');
  const normalize = name => name.trim().toUpperCase();
  const localDate = zone => {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en', {
      timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(new Date()).map(({ type, value }) => [type, value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
  };
  const zoneFor = name => /MALUKU|PAPUA/.test(name) ? ['Asia/Jayapura', 'WIT'] :
    /BALI|NUSA TENGGARA|KALIMANTAN (SELATAN|TIMUR|UTARA)|SULAWESI|GORONTALO/.test(name) ?
      ['Asia/Makassar', 'WITA'] : ['Asia/Jakarta', 'WIB'];

  window.mountPrayer = container => {
    mounts.get(container)?.();
    const panel = document.createElement('section');
    panel.className = 'prayer-panel';
    panel.innerHTML = `
      <h2>Jadwal Sholat</h2>
      <p>Kecamatan Curug, Kota Serang, Banten. Jadwal resmi tersedia pada tingkat kota/kabupaten, bukan kecamatan.</p>
      <div class="prayer-filters"></div>
      <p class="prayer-status" role="status"></p>
      <button type="button" hidden>Coba lagi</button>
      <div class="prayer-grid"></div>
      <p>Sumber: <a href="${source}" target="_blank" rel="noopener noreferrer">Bimas Islam Kemenag RI (SIHAT)</a></p>`;
    container.replaceChildren(panel);
    const filters = panel.querySelector('.prayer-filters');
    const status = panel.querySelector('.prayer-status');
    const grid = panel.querySelector('.prayer-grid');
    const retry = panel.querySelector('button');
    const select = title => {
      const label = document.createElement('label');
      const input = document.createElement('select');
      label.append(title, input);
      filters.append(label);
      return input;
    };
    const province = select('Provinsi');
    const city = select('Kota/Kabupaten');
    const month = select('Bulan');
    const year = select('Tahun');
    const date = select('Tanggal');
    function options(el, entries, selected) {
      el.replaceChildren(...entries.map(([value, label]) => new Option(label, value)));
      if (selected && entries.some(([value]) => value === selected)) el.value = selected;
      el.disabled = !entries.length;
    }
    const yearMonth = localDate('Asia/Jakarta').split('-');
    options(month, Array.from({ length: 12 }, (_, i) => [pad(i + 1),
      new Intl.DateTimeFormat('id-ID', { month: 'long', timeZone: 'UTC' }).format(Date.UTC(2000, i, 1))]), yearMonth[1]);
    options(year, Array.from({ length: 100 }, (_, i) => [String(2000 + i), String(2000 + i)]), yearMonth[0]);
    options(province, []);
    options(city, []);
    options(date, []);

    let controller, days = [], retryAction;
    const cleanup = () => {
      controller?.abort();
      if (mounts.get(container) === cleanup) {
        mounts.delete(container);
        panel.remove();
      }
    };
    mounts.set(container, cleanup);
    retry.onclick = () => retryAction?.();
    const configuredUrl = window.PALIMA_CONFIG?.supabaseUrl;
    const endpoint = window.PALIMA_PRAYER_ENDPOINT || (configuredUrl &&
      `${configuredUrl.replace(/\/+$/, '')}/functions/v1/kemenag-prayer`);

    async function request(action, params, signal) {
      const url = new URL(endpoint, window.location.href);
      url.searchParams.set('action', action);
      for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
      const timerController = new AbortController();
      const timer = setTimeout(() => timerController.abort(), 15000);
      const abort = () => timerController.abort();
      signal.addEventListener('abort', abort, { once: true });
      try {
        const response = await fetch(url, { signal: timerController.signal, headers: { Accept: 'application/json' } });
        if (!response.ok) throw new Error('Kemenag unavailable');
        return await response.json();
      } finally {
        clearTimeout(timer);
        signal.removeEventListener('abort', abort);
      }
    }

    function clearSchedule() {
      days = [];
      options(date, []);
      grid.replaceChildren();
    }

    async function load(message, error, action, task) {
      controller?.abort();
      const { signal } = (controller = new AbortController());
      status.textContent = message;
      retry.hidden = true;
      try { await task(signal); } catch {
        if (signal.aborted) return;
        status.textContent = error;
        retryAction = action;
        retry.hidden = false;
      }
    }

    function regions(response) {
      if (!Array.isArray(response?.data) || !response.data.length) throw new Error('No regions');
      return response.data.filter(x => typeof x?.id === 'string' && typeof x.name === 'string');
    }

    const regionLabel = select => normalize(select.selectedOptions[0]?.textContent ?? '');
    function renderDate() {
      grid.replaceChildren();
      const [, zoneLabel] = zoneFor(regionLabel(province));
      const row = days.find(([key]) => key === date.value)?.[1];
      if (!row) return;
      status.textContent = `${city.selectedOptions[0].textContent} · ${date.selectedOptions[0].textContent} · ${zoneLabel}`;
      for (const [key, label] of fields) {
        const value = row[key];
        if (typeof value !== 'string' || !/^([01]?\d|2[0-3])[:.][0-5]\d$/.test(value)) continue;
        const item = document.createElement('div');
        item.className = 'prayer-item';
        const name = document.createElement('span');
        const time = document.createElement('strong');
        name.textContent = label;
        time.textContent = value;
        item.append(name, time);
        grid.append(item);
      }
      if (!grid.childElementCount) status.textContent = 'Kemenag tidak mengembalikan jam yang valid untuk tanggal ini.';
    }

    function loadSchedule() {
      clearSchedule();
      if (!city.value) return;
      const prefix = `${year.value}-${month.value}-`;
      return load('Memuat jadwal resmi Kemenag…', 'Jadwal Kemenag gagal dimuat. Coba lagi atau buka situs resmi.', loadSchedule,
        async signal => {
          const data = await request('jadwal', { prov: province.value, kabko: city.value, thn: year.value, bln: month.value }, signal);
          if (signal.aborted) return;
          days = data?.status === 1 && data.data ? Object.entries(data.data)
            .filter(([key, row]) => key.startsWith(prefix) && /^\d{4}-\d{2}-(0[1-9]|[12]\d|3[01])$/.test(key) && row && typeof row === 'object')
            .sort(([a], [b]) => a.localeCompare(b)) : [];
          if (!days.length) {
            status.textContent = 'Kemenag tidak menyediakan jadwal untuk pilihan ini.';
            return;
          }
          const today = localDate(zoneFor(regionLabel(province))[0]);
          options(date, days.map(([key, row]) => [key, `${typeof row.tanggal === 'string' ? row.tanggal : key}${key === today ? ' (Hari ini)' : ''}`]), today);
          renderDate();
        });
    }

    function loadCities(preferred) {
      options(city, []);
      clearSchedule();
      if (!province.value) return;
      return load('Memuat kota/kabupaten…', 'Daftar kota/kabupaten Kemenag gagal dimuat.', () => loadCities(preferred),
        async signal => {
          const rows = regions(await request('kabko', { prov: province.value }, signal));
          if (signal.aborted) return;
          options(city, rows.map(x => [x.id, x.name]), rows.find(x => normalize(x.name) === preferred)?.id);
          if (!city.value) throw new Error('No cities');
          await loadSchedule();
        });
    }

    function loadProvinces() {
      return load('Memuat provinsi…', 'Daftar provinsi Kemenag gagal dimuat.', loadProvinces, async signal => {
        const rows = regions(await request('provinsi', {}, signal)).filter(x => normalize(x.name) !== 'PUSAT');
        if (signal.aborted) return;
        options(province, rows.map(x => [x.id, x.name]), rows.find(x => normalize(x.name) === 'BANTEN')?.id);
        if (!province.value) throw new Error('No provinces');
        await loadCities('KOTA SERANG');
      });
    }

    province.onchange = () => loadCities(regionLabel(province) === 'BANTEN' ? 'KOTA SERANG' : undefined);
    city.onchange = month.onchange = year.onchange = loadSchedule;
    date.onchange = renderDate;
    if (endpoint) loadProvinces();
    else status.textContent = 'Layanan jadwal belum dikonfigurasi. Lihat jadwal di situs resmi Kemenag.';
    return cleanup;
  };
})();
