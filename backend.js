(() => {
  'use strict';

  const config = window.PALIMA_CONFIG || {};
  const url = (config.supabaseUrl || '').trim();
  const key = (config.supabaseAnonKey || '').trim();
  const tables = ['profiles', 'residents', 'bills', 'payments', 'complaints', 'letters', 'transactions', 'announcements', 'schedules', 'ronda', 'logs', 'settings'];
  const profileFields = ['name', 'role', 'address', 'phone', 'ktp', 'verified'];
  const demo = !url && !key;
  let client;
  let initialized = false;
  let busy = false;
  let generation = 0;
  let tail = Promise.resolve(true);
  let pending = 0;
  let batchOK = true;
  let snapshots = {};

  const errorToast = (prefix, err) => toast(`${prefix}: ${err?.message || err}`, 'error');
  const clone = value => JSON.parse(JSON.stringify(value));
  const isSettingsRow = row => row.id === 'app';
  function unpack(row) {
    const { id, user_id, created_at, data } = row;
    return { ...data, id, ...(user_id == null ? {} : { user_id }), created_at };
  }
  function pack(row) {
    const { id, user_id, created_at, ...data } = row;
    return { id, user_id: user_id || null, data };
  }
  function syncSettings() {
    const row = DDB.settings?.find(isSettingsRow);
    if (!row) { S.settings = {}; return; }
    const { id, created_at, user_id, ...fields } = row;
    S.settings = fields;
  }
  function purge() {
    initialized = false;
    ++generation;
    S.user = S.profile = null;
    S.settings = {};
    snapshots = {};
    tables.forEach(t => { DDB[t] = []; });
    // Hide and discard rendered private rows/modals on sign-out, including a cross-tab sign-out.
    closeModal();
    for (const selector of ['#pageContent', '#modalBody', '#modalFoot']) {
      $(selector)?.replaceChildren();
    }
    showLogin();
  }

  async function fetchTable(t) {
    const rows = [];
    const size = 100;
    for (let i = 0; ;) {
      const { data, count, error } = await client.from(t).select('*', { count: 'exact' })
        .order('created_at', { ascending: t === 'logs' }).order('id').range(i, i + size - 1);
      if (error) throw error;
      rows.push(...(t === 'profiles' ? data : data.map(unpack)));
      i += data.length;
      if (!data.length || (count !== null && count !== undefined ? i >= count : data.length < size)) return rows;
    }
  }
  async function hydrate(user, epoch) {
    const all = await Promise.all(tables.map(fetchTable));
    if (epoch !== generation) return false;
    const profile = all[0].find(row => row.id === user.id);
    if (!profile) throw new Error('Profil akun tidak aktif. Hubungi pengurus.');
    S.user = user;
    S.profile = profile;
    tables.forEach((t, i) => { DDB[t] = all[i]; snapshots[t] = clone(all[i]); });
    syncSettings();
    initialized = true;
    return true;
  }
  async function change(t, before, after) {
    const id = (after || before).id;
    if (t === 'logs') {
      if (before || !after) throw new Error('Log hanya dapat ditambahkan');
      const { error } = await client.rpc('portal_add_log', { p_id: id, p_data: pack(after).data });
      if (error) throw error;
      return;
    }
    let request;
    if (!after) request = client.from(t).delete().eq('id', id);
    else if (t === 'profiles') {
      if (!before) throw new Error('Buat akun baru melalui Supabase Authentication');
      const patch = Object.fromEntries(profileFields.filter(f => before[f] !== after[f]).map(f => [f, after[f]]));
      if (Object.keys(patch).length === 0) throw new Error('Tidak ada perubahan profil yang diizinkan');
      request = client.from(t).update(patch).eq('id', id);
    } else if (!before) request = client.from(t).insert(pack(after));
    else {
      const { id, ...patch } = pack(after);
      request = client.from(t).update(patch).eq('id', id);
    }
    const { data, error } = await request.select('*').maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('Data tidak ditemukan atau perubahan tidak diizinkan');
    return t === 'profiles' ? data : unpack(data);
  }

  function installRealDDB() {
    // Diff the last queued snapshot, not the whole server table. This also handles legacy push()+save().
    DDB.init = () => {};
    DDB._get = t => DDB[t];
    DDB._set = (t, rows) => { DDB[t] = rows; return DDB.save(t); };
    DDB.save = function(t) {
      if (!initialized || !tables.includes(t)) {
        toast('Penyimpanan tidak siap. Masuk kembali.', 'error');
        return Promise.resolve(false);
      }
      const next = clone(this[t]);
      const prior = new Map(snapshots[t].map(row => [row.id, row]));
      const changes = [];
      const ids = new Set();
      for (const row of next) {
        if (!row.id || ids.has(row.id)) {
          this[t] = clone(snapshots[t]);
          toast('ID data kosong atau ganda. Perubahan dibatalkan.', 'error');
          return Promise.resolve(false);
        }
        ids.add(row.id);
        const before = prior.get(row.id);
        prior.delete(row.id);
        if (!before || JSON.stringify(before) !== JSON.stringify(row)) changes.push([before, row]);
      }
      for (const row of prior.values()) changes.push([row, null]);
      if (!changes.length) return tail;
      snapshots[t] = next;
      const epoch = generation;
      if (!pending++) batchOK = true;
      tail = tail.then(async () => {
        try {
          if (!batchOK || epoch !== generation) return false;
          for (const [before, after] of changes) {
            if (epoch !== generation) return false;
            const stored = await change(t, before, after);
            if (epoch !== generation) return false;
            if (after && stored) {
              const expected = JSON.stringify(after);
              const i = DDB[t].findIndex(row => row.id === after.id && JSON.stringify(row) === expected);
              const j = snapshots[t].findIndex(row => row.id === after.id && JSON.stringify(row) === expected);
              // Keep optimistic fields if a later edit for this row is already queued.
              if (i >= 0) Object.assign(DDB[t][i], stored);
              if (j >= 0) snapshots[t][j] = clone(stored);
              if (t === 'profiles' && stored.id === S.user?.id) S.profile = stored;
            }
          }
          return true;
        } catch (err) {
          batchOK = false;
          if (epoch === generation) errorToast(`Gagal menyimpan ${t}`, err);
          return false;
        } finally {
          if (!--pending && !batchOK && epoch === generation && S.user) {
            initialized = false;
            try {
              if (await hydrate(S.user, epoch)) { renderNav(); renderPage(); }
            } catch (err) {
              purge();
              errorToast('Gagal memuat ulang data; masuk kembali', err);
            }
          }
        }
      });
      return tail;
    };
    DDB.flush = () => tail;

    // Unlike the demo, a settings change is shared and only acknowledged after persistence.
    saveSetting = async (name, value) => {
      if (!initialized) return toast('Penyimpanan tidak siap', 'error');
      if (['wa_api_key', 'sb_key', 'service_role_key', 'supabase_service_role_key'].includes(name)) {
        return toast('Jangan menyimpan kunci rahasia di portal', 'error');
      }
      if (DDB.settings.some(isSettingsRow)) DDB.update('settings', 'app', { [name]: value });
      else DDB.add('settings', { id: 'app', [name]: value });
      syncSettings();
      if (await DDB.flush()) toast('Pengaturan disimpan');
    };
  }

  function markBusy(value) {
    busy = value;
    const button = $('#loginForm button[type="submit"]');
    if (button) button.disabled = value;
  }
  async function openSession(user) {
    if (!user) { purge(); return; }
    const epoch = ++generation;
    if (await hydrate(user, epoch)) showApp();
  }

  if (!demo) {
    DEMO = false;
    handleLogin = async e => {
      e.preventDefault();
      if (busy) return false;
      if (!client) { toast('Konfigurasi Supabase tidak siap', 'error'); return false; }
      const email = $('#loginEmail').value.trim();
      const password = $('#loginPass').value;
      if (!email || !password) { toast('Isi email dan password', 'error'); return false; }
      markBusy(true);
      try {
        const { data, error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await openSession(data.user);
        if (initialized) { $('#loginPass').value = ''; addLog('Login', `${S.profile.name} masuk`); }
      } catch (err) {
        purge();
        errorToast('Tidak dapat masuk', err);
      } finally { markBusy(false); }
      return false;
    };
    doLogout = async () => {
      if (busy || !client) return;
      markBusy(true);
      try {
        if (initialized) addLog('Logout', 'Pengguna keluar');
        await DDB.flush();
        const { error } = await client.auth.signOut({ scope: 'local' });
        if (error) throw error;
        purge();
      } catch (err) { errorToast('Tidak dapat keluar', err); }
      finally { markBusy(false); }
    };
    restoreSession = () => false;
    installRealDDB();
  } else {
    DDB.flush = async () => true;
    DDB.settings ||= [];
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const hint = $('#demoHint');
    if (hint) hint.hidden = !demo;
    try {
      if (demo) {
        DEMO = true;
        DDB.init();
        if (restoreSession()) showApp(); else showLogin();
      } else {
        purge();
        markBusy(true);
        if (!url || !key) throw new Error('Isi URL dan publishable/anon key di config.js');
        if (/^sb_secret_/i.test(key) || (key.split('.').length === 3 && JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role !== 'anon')) {
          throw new Error('Gunakan publishable/anon key, bukan kunci rahasia');
        }
        client = window.supabase.createClient(url, key);
        sb = client;
        client.auth.onAuthStateChange((event, session) => {
          if (event === 'SIGNED_OUT') purge();
          else if (event === 'SIGNED_IN' && initialized && session?.user?.id !== S.user?.id) {
            purge();
            toast('Akun berubah di tab lain. Muat ulang halaman untuk melanjutkan.', 'error');
          }
        });
        const { data, error } = await client.auth.getSession();
        if (error) throw error;
        if (data.session) await openSession(data.session.user);
      }
    } catch (err) { if (!demo) purge(); errorToast('Portal gagal dimuat', err); }
    finally {
      markBusy(false);
      const splash = $('#splash');
      if (splash) { splash.classList.add('hide'); setTimeout(() => splash.remove(), 500); }
    }
  });
})();
