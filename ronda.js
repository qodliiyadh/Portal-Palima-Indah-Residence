(() => {
  const now = new Date(Date.now() + 7 * 3600000);
  let month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const key = d => d.toISOString().slice(0, 10);
  const fmt = options => new Intl.DateTimeFormat('id-ID', { timeZone: 'UTC', ...options });
  const groups = () => DDB.ronda.filter(r => !r.date).sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')) || a.id.localeCompare(b.id));
  const slots = () => {
    const list = groups(), out = [];
    for (let d = new Date(month); d.getUTCMonth() === month.getUTCMonth(); d.setUTCDate(d.getUTCDate() + 1)) {
      if (d.getUTCDay() !== 6) continue;
      const date = key(d), exception = DDB.ronda.find(r => r.date === date);
      const week = Math.floor((d.getTime() - Date.UTC(2024, 0, 6)) / 604800000);
      const team = exception ? list.find(r => r.id === exception.group_id) : list[((week % list.length) + list.length) % list.length];
      out.push({date, exception, team, time: exception?.time || team?.time || '22:00 – 05:00'});
    }
    return out;
  };
  const label = s => s.team?.group || (s.exception?.cancelled ? 'Ditiadakan' : 'Belum ditugaskan');
  window.rondaExportRows = () => slots().map(s => ({Tanggal:s.date, Kelompok:label(s), Anggota:s.team?.members || '—', Waktu:s.team ? s.time : '—'}));
  window.shiftRonda = n => { month = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth()+n, 1)); nav('ronda'); };
  pgRonda = () => {
    const byDate = new Map(slots().map(s => [s.date,s]));
    const cells = Array.from({length:(month.getUTCDay()+6)%7}, () => '<div class="ronda-empty"></div>');
    for (let d = new Date(month); d.getUTCMonth() === month.getUTCMonth(); d.setUTCDate(d.getUTCDate()+1)) {
      const s = byDate.get(key(d));
      cells.push(`<div class="ronda-cell ${s?'ronda-night':''}"><span>${d.getUTCDate()}</span>${s ? `<strong>${esc(label(s))}</strong>${s.team ? `<small>${esc(s.time)}</small>` : ''}${isStaff()?`<button class="btn btn-o btn-sm" onclick="editRondaDate(${jsArg(s.date)})" aria-label="Edit ronda ${s.date}">Edit</button>`:''}` : ''}</div>`);
    }
    return `<section class="card"><div class="card-body"><div class="ronda-heading"><div><h2>Kalender Ronda</h2><p>Setiap Sabtu malam hingga Minggu pagi (WIB). Kelompok bergiliran otomatis; pengurus dapat mengubah penugasan per tanggal.</p></div><div class="btn-group"><button class="btn btn-o" onclick="exportData('ronda')">Ekspor Excel</button><button class="btn btn-o" onclick="exportRondaPDF()">Ekspor PDF</button></div></div><div class="ronda-month"><button class="btn btn-o" onclick="shiftRonda(-1)" aria-label="Bulan sebelumnya">‹</button><h3>${fmt({month:'long',year:'numeric'}).format(month)}</h3><button class="btn btn-o" onclick="shiftRonda(1)" aria-label="Bulan berikutnya">›</button></div><div class="ronda-scroll"><div class="ronda-grid">${['Sen','Sel','Rab','Kam','Jum','Sab','Min'].map(d=>`<div class="ronda-day">${d}</div>`).join('')}${cells.join('')}</div></div></div></section>
    <section class="card ronda-groups"><div class="card-header"><h3>Kelompok Ronda</h3>${isStaff()?'<button class="btn btn-p btn-sm" onclick="modalAddRonda()">+ Kelompok</button>':''}</div><div class="card-body"><div class="ronda-teams">${groups().map(r => `<article><h4>${esc(r.group)}</h4><p>${esc(r.members)}</p><small>${esc(r.time)}</small>${isStaff()?`<div class="btn-group"><button class="btn btn-o btn-sm" onclick="modalAddRonda(${jsArg(r.id)})">Edit</button><button class="btn btn-d btn-sm" onclick="deleteRonda(${jsArg(r.id)})">Hapus</button></div>`:''}</article>`).join('') || '<p>Belum ada kelompok ronda.</p>'}</div></div></section>`;
  };
  modalAddRonda = id => {
    if (!isStaff()) return;
    const r = groups().find(x=>x.id===id);
    openModal(r?'Edit Kelompok Ronda':'Tambah Kelompok Ronda', `<div class="form-grid"><div class="fg"><label for="mRdGroup">Nama kelompok</label><input id="mRdGroup" maxlength="80" value="${esc(r?.group)}"></div><div class="fg"><label for="mRdMembers">Anggota</label><textarea id="mRdMembers" maxlength="600">${esc(r?.members)}</textarea></div><div class="fg"><label for="mRdTime">Jam (WIB)</label><input id="mRdTime" maxlength="40" value="${esc(r?.time || '22:00 – 05:00')}"></div></div>`, `<button class="btn btn-p" onclick="saveRonda(${jsArg(r?.id)})">Simpan</button>`);
  };
  saveRonda = id => {
    if (!isStaff()) return;
    const [group,members,time] = ['#mRdGroup','#mRdMembers','#mRdTime'].map(q=>$(q).value.trim());
    if (!group || !members || !time) return toast('Nama, anggota, dan jam wajib diisi.', 'error');
    const data = {group,members,time,day:'Sabtu malam'};
    if (id) DDB.update('ronda',id,data); else DDB.add('ronda',data);
    closeModal(); nav('ronda');
  };
  deleteRonda = id => {
    if (!isStaff() || !groups().some(r=>r.id===id) || !confirm('Hapus kelompok ini? Rotasi otomatis akan dihitung ulang.')) return;
    DDB.ronda.filter(r=>r.group_id===id).forEach(r=>DDB.remove('ronda',r.id));
    DDB.remove('ronda',id); nav('ronda');
  };
  window.editRondaDate = date => {
    if (!isStaff()) return;
    const s = slots().find(r=>r.date===date);
    if (!s) return;
    const opt = (id,name) => `<option value="${esc(id)}" ${s.exception && (s.exception.cancelled ? id==='cancel' : id===s.exception.group_id)?'selected':''}>${esc(name)}</option>`;
    openModal(`Jadwal Ronda · ${fd(date)}`, `<div class="fg"><label for="rondaGroup">Penugasan</label><select id="rondaGroup">${opt('','Ikuti rotasi otomatis')}${opt('cancel','Ditiadakan')}${groups().map(r=>opt(r.id,r.group)).join('')}</select></div><div class="fg"><label for="rondaTime">Jam khusus (opsional)</label><input id="rondaTime" maxlength="40" value="${esc(s.exception?.time)}" placeholder="Gunakan jam kelompok"></div>`, `<button class="btn btn-p" onclick="saveRondaDate(${jsArg(date)})">Simpan</button>`);
  };
  window.saveRondaDate = date => {
    if (!isStaff()) return;
    const s = slots().find(r=>r.date===date);
    if (!s) return;
    const group_id = $('#rondaGroup').value, time = $('#rondaTime').value.trim();
    if (!group_id) { if (s.exception) DDB.remove('ronda',s.exception.id); }
    else if (group_id==='cancel' || groups().some(r=>r.id===group_id)) {
      const data = {date,group_id:group_id==='cancel'?'':group_id,cancelled:group_id==='cancel',time};
      if (s.exception) DDB.update('ronda',s.exception.id,data); else DDB.add('ronda',data);
    }
    closeModal(); nav('ronda');
  };
  exportRondaPDF = () => exportPDF(['Tanggal','Kelompok','Anggota','Waktu'],window.rondaExportRows().map(r=>Object.values(r)),'Kalender Ronda','jadwal-ronda');
  const getNavBeforeRonda = getNavItems;
  getNavItems = () => {
    const items = getNavBeforeRonda();
    if (!items.some(i=>i.id==='ronda')) items.push({id:'ronda',label:'Jadwal Ronda',icon:'🛡️',group:'Lingkungan'});
    return items;
  };
})();
