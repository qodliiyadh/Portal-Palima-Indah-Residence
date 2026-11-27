/* Record management; loaded after the portal's inline script. */
(() => {
  'use strict';
  const contactFields = [
    ['name', 'Nama lengkap'], ['address', 'Alamat', 'text', false],
    ['phone', 'No. WhatsApp', 'tel', false], ['ktp', 'No. KTP', 'text', false],
  ];
  const letterTypes = ['Surat Keterangan Domisili', 'Surat Pengantar KTP', 'Surat Pengantar KK', 'Surat Keterangan Tidak Mampu', 'Surat Keterangan Usaha', 'Surat Pengantar Nikah', 'Surat Keterangan Belum Menikah'];
  const records = {
    profiles: ['Profil pengguna', ['users-manage'], [...contactFields, ['verified', 'Terverifikasi', 'checkbox']]],
    residents: ['Data warga', ['residents'], contactFields],
    announcements: ['Pengumuman', ['announcements'], [
      ['title', 'Judul'], ['content', 'Isi', 'textarea'], ['priority', 'Prioritas', {medium: 'Info Biasa', high: 'Penting'}],
    ]],
    bills: ['Tagihan', ['bills-manage'], [['month', 'Bulan']]],
    complaints: ['Pengaduan', ['complaints-manage', 'my-complaints'], [['title', 'Judul'], ['description', 'Deskripsi', 'textarea']]],
    letters: ['Pengajuan surat', ['letters-manage', 'my-letters'], [['type', 'Jenis surat', Object.fromEntries(letterTypes.map(t => [t, t]))], ['purpose', 'Keperluan', 'textarea']]],
    transactions: ['Transaksi kas', ['cashbook'], [
      ['type', 'Jenis', {income: 'Pemasukan', expense: 'Pengeluaran'}], ['title', 'Keterangan'],
      ['amount', 'Jumlah (Rp)', 'number'], ['date', 'Tanggal', 'date'],
    ]],
    schedules: ['Jadwal kegiatan', ['schedules'], [
      ['title', 'Kegiatan'], ['day', 'Hari'], ['time', 'Waktu'], ['icon', 'Ikon', 'text', false],
    ]],
  };
  const config = table => Object.hasOwn(records, table) ? records[table] : null;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[c]);
  const find = (table, id) => config(table) && (DDB[table] || []).find(row => String(row.id) === String(id));

  function canManage(table, row, page) {
    if (!row || !S.profile?.id || !config(table)?.[1].includes(page)) return false;
    if (table === 'profiles') return isStaff() && String(row.id) !== String(S.profile.id) && (
      row.role === 'warga' || (S.profile.role === 'admin' && row.role === 'pengurus')
    );
    if (page === 'my-complaints' || page === 'my-letters') {
      return S.profile.role === 'warga' && row.user_id === S.profile.id && row.status === 'pending';
    }
    if (table === 'bills') return isStaff() && row.status === 'pending' && !row.proof && !row.paid_at;
    if (table === 'letters' && row.status === 'approved') return false;
    return isStaff();
  }

  window.manageActions = (table, row, page) => {
    if (!canManage(table, row, page)) return '';
    const attrs = `data-manage-table="${escape(table)}" data-manage-id="${escape(row.id)}" data-manage-page="${escape(page)}"`;
    return `<button type="button" class="btn btn-o btn-sm" data-manage-action="edit" ${attrs}>Edit</button>
      <button type="button" class="btn btn-d btn-sm" data-manage-action="delete" ${attrs}>Hapus</button>`;
  };

  window.pgUsersManage = () => {
    if (!isStaff()) return '';
    const rows = (DDB.profiles || []).map(p => `<tr>
      <td>${escape(p.name || '—')}</td><td>${escape(p.email || '—')}</td><td>${escape(p.phone || '—')}</td>
      <td>${escape(p.role || '—')}</td><td>${p.verified ? 'Terverifikasi' : 'Belum'}</td>
      <td><div class="btn-group">${window.manageActions('profiles', p, 'users-manage') || '—'}</div></td>
    </tr>`).join('');
    return `<div class="card"><div class="card-body">
      <p>Buat akun, ubah email atau peran, dan cabut akses login melalui dasbor Supabase. Menu ini hanya mengelola profil portal.</p>
    </div></div>
    <div class="card"><div class="card-body np"><div class="tbl-wrap"><table>
      <thead><tr><th>Nama</th><th>Email</th><th>No. WhatsApp</th><th>Peran</th><th>Status</th><th>Aksi</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="6">Belum ada profil pengguna.</td></tr>'}</tbody>
    </table></div></div></div>`;
  };

  const field = ([key, label, type = 'text', required = true], value) => {
    const attrs = `id="manage-${key}" name="${key}"${required && type !== 'checkbox' ? ' required' : ''}`;
    let input;
    if (typeof type === 'object') {
      const options = Object.entries(type);
      if (value && !Object.hasOwn(type, value)) options.unshift([value, value]);
      input = `<select ${attrs}>${options.map(([v, text]) => `<option value="${escape(v)}"${v === value ? ' selected' : ''}>${escape(text)}</option>`).join('')}</select>`;
    } else if (type === 'textarea') input = `<textarea ${attrs}>\n${escape(value)}</textarea>`;
    else if (type === 'checkbox') input = `<input ${attrs} type="checkbox"${value ? ' checked' : ''}>`;
    else input = `<input ${attrs} type="${type}" value="${escape(type === 'date' ? String(value || '').slice(0, 10) : value)}"${type === 'number' ? ' min="1" step="1"' : ''}>`;
    return `<div class="fg" style="margin-bottom:10px"><label for="manage-${key}">${label}</label>${input}</div>`;
  };

  function billItem(item = {}) {
    return `<div class="form-grid" style="margin-bottom:8px">
      <div class="fg"><input data-item-name aria-label="Nama item" placeholder="Nama item" value="${escape(item.name)}"></div>
      <div class="fg"><input data-item-amount type="number" min="1" step="1" aria-label="Jumlah item" placeholder="Jumlah (Rp)" value="${escape(item.amount)}"></div>
    </div>`;
  }

  function edit(table, id, page, row) {
    const [label, , fields] = config(table);
    const actor = S.profile.id;
    const items = Array.isArray(row.items) ? row.items : [];
    openModal(`Edit ${label.toLowerCase()}`, `<form id="manageEditForm">
      ${fields.map(f => field(f, row[f[0]])).join('')}
      ${table === 'bills' ? `<fieldset><legend>Item tagihan</legend><p>Kosongkan kedua kolom untuk menghapus item.</p>
      <div id="manageBillItems">${(items.length ? items : [{}]).map(billItem).join('')}</div>
      <button type="button" class="btn btn-o btn-sm" id="manageAddItem">+ Tambah item</button></fieldset>` : ''}
    </form>`, '<button type="submit" form="manageEditForm" class="btn btn-p">Simpan</button>');
    const form = document.getElementById('manageEditForm');
    form.querySelector('#manageAddItem')?.addEventListener('click', () => {
      form.querySelector('#manageBillItems').insertAdjacentHTML('beforeend', billItem());
    });
    form.addEventListener('submit', event => {
      event.preventDefault();
      if (actor !== S.profile?.id || S.page !== page || !canManage(table, find(table, id), page)) {
        closeModal();
        return toast('Data ini tidak dapat diubah.', 'error');
      }
      const patch = {};
      for (const [key, label, type, required = true] of fields) {
        const input = form.elements.namedItem(key);
        if (type === 'checkbox') patch[key] = input.checked;
        else {
          const val = input.value.trim();
          if (required && !val) return toast(`${label} wajib diisi.`, 'error');
          if (type === 'number' && (!Number.isSafeInteger(Number(val)) || Number(val) < 1)) return toast(`${label} harus berupa rupiah bulat positif.`, 'error');
          patch[key] = type === 'number' ? Number(val) : val;
        }
      }
      if (table === 'bills') {
        patch.items = [];
        for (const input of form.querySelectorAll('[data-item-name]')) {
          const name = input.value.trim();
          const raw = input.closest('.form-grid').querySelector('[data-item-amount]').value;
          if (!name && !raw) continue;
          const amount = Number(raw);
          if (!name || !Number.isSafeInteger(amount) || amount < 1) return toast('Setiap item wajib memiliki nama dan jumlah rupiah bulat positif.', 'error');
          patch.items.push({name, amount});
        }
        patch.total = patch.items.reduce((total, item) => total + item.amount, 0);
        if (!patch.items.length || !Number.isSafeInteger(patch.total)) return toast('Isi minimal satu item dengan total yang valid.', 'error');
      }
      DDB.update(table, id, patch);
      addLog(label, `Diubah: ${id}`);
      closeModal();
      nav(page);
      toast('Perubahan disimpan.');
    });
  }

  function remove(table, id, page) {
    const row = find(table, id);
    if (!canManage(table, row, page) || S.page !== page) return;
    const [label] = config(table);
    const prompt = table === 'profiles'
      ? `Hapus profil ${row.name || row.email || 'ini'}? Akun login Supabase tidak ikut terhapus.`
      : `Hapus ${label.toLowerCase()} ini?`;
    if (!confirm(prompt) || !canManage(table, find(table, id), page)) return;
    DDB.remove(table, row.id);
    addLog(label, `Dihapus: ${row.id}`);
    nav(page);
    toast('Data dihapus.');
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('button[data-manage-action]');
    if (!button || !button.closest('#pageContent')) return;
    const {manageTable: table, manageId: id, managePage: page, manageAction: action} = button.dataset;
    const row = find(table, id);
    if (!canManage(table, row, page) || S.page !== page) return;
    if (action === 'edit') edit(table, row.id, page, row);
    if (action === 'delete') remove(table, row.id, page);
  });

  // Keep old handlers guarded if an old template still invokes them.
  window.deleteAnnouncement = id => remove('announcements', id, 'announcements');
  window.deleteResident = id => remove('residents', id, 'residents');
  window.deleteTransaction = id => remove('transactions', id, 'cashbook');
  window.deleteSchedule = id => remove('schedules', id, 'schedules');
})();
