(() => {
  const node = $('#publicPage');
  const official = 'https://bimasislam.kemenag.go.id/jadwal-sholat';
  const examples = [
    {title:'Kerja Bakti Lingkungan',content:'Contoh kegiatan: Minggu pukul 07.00 WIB. Titik kumpul di taman Blok A. Bawa sarung tangan dan alat kebersihan bila tersedia.',priority:'medium'},
    {title:'Pembaruan Iuran Warga',content:'Contoh informasi: rincian iuran dan bukti pembayaran dapat diperiksa di menu Iuran setelah masuk.',priority:'high'},
    {title:'Posyandu dan Pemeriksaan Kesehatan',content:'Contoh agenda: Rabu minggu kedua pukul 09.00 WIB di balai warga.',priority:'medium'}
  ];
  const services = [['💳','Iuran Warga','Lihat tagihan dan unggah bukti pembayaran.'],['💬','Pengaduan','Laporkan masalah dan pantau tanggapan pengurus.'],['📄','Pengajuan Surat','Ajukan surat dan cetak draf yang disetujui.'],['🛡️','Ronda & Kegiatan','Lihat rotasi ronda dan kegiatan lingkungan.']];
  node.innerHTML = `<div class="public-nav"><a class="public-brand" href="#beranda"><img src="logo.svg" width="42" height="42" alt=""><span><strong>Palima Indah</strong><small>Portal Warga</small></span></a><nav class="public-links" aria-label="Menu Beranda"><a href="#pengumuman">Pengumuman</a><a href="#jadwal-sholat">Jadwal salat</a></nav><button class="public-button" data-public-login>Masuk Portal</button></div>
    <header class="public-hero" id="beranda"><div class="hero-copy"><span class="eyebrow">● CURUG · KOTA SERANG</span><h1>Selamat datang,<br>warga Palima Indah!</h1><p>Temukan kabar lingkungan dan jadwal salat tanpa login. Masuk untuk mengurus iuran, pengaduan, dan surat warga.</p><div class="public-actions"><a class="public-button" href="#pengumuman">Lihat Pengumuman</a><a class="public-button secondary" href="#jadwal-sholat">Jadwal Salat</a></div></div><img class="hero-art" src="neighborhood.svg" alt="Ilustrasi rumah dan pepohonan di lingkungan Palima Indah"></header>
    <section class="public-section" id="pengumuman"><div class="section-heading"><span class="eyebrow">KABAR LINGKUNGAN</span><h2>Pengumuman</h2><p id="publicNewsStatus" role="status"></p></div><div class="public-grid" id="publicNews"></div></section>
    <section class="public-section" id="jadwal-sholat"><div class="section-heading"><span class="eyebrow">WAKTU IBADAH</span><h2>Jadwal Salat</h2></div><div id="publicPrayer"></div></section>
    <section class="public-section public-services"><div class="section-heading"><span class="eyebrow">AKSES WARGA</span><h2>Layanan Portal</h2><p>Masuk dengan akun Anda untuk menggunakan layanan di bawah ini.</p></div><div class="public-grid">${services.map(([icon,title,text])=>`<article class="service-card"><span aria-hidden="true">${icon}</span><h3>${title}</h3><p>${text}</p></article>`).join('')}</div></section>
    <footer class="public-footer"><strong>Palima Indah Residence</strong><span>Curug · Kota Serang · Banten</span><button class="public-button secondary" data-public-login>Masuk Portal</button></footer>`;
  let prayerReady = false, newsRevision = 0;
  async function news() {
    const revision = ++newsRevision;
    const status = $('#publicNewsStatus'), list = $('#publicNews');
    list.replaceChildren();
    try {
      let rows;
      if (DEMO) {
        const enabled = DDB.announcements?.filter(a=>a.public === true);
        rows = enabled?.length ? enabled.slice().reverse().slice(0,12) : examples;
        status.textContent = 'Contoh pengumuman · mode demo';
      } else {
        status.textContent = 'Memuat pengumuman publik…';
        const { supabaseUrl, supabaseAnonKey } = window.PALIMA_CONFIG;
        const res = await fetch(`${supabaseUrl.trim().replace(/\/$/,'')}/rest/v1/rpc/portal_public_announcements`, {method:'POST',headers:{apikey:supabaseAnonKey.trim(),'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(12000)});
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        rows = await res.json();
        if (revision !== newsRevision) return;
        status.textContent = rows.length ? 'Informasi yang dipublikasikan pengurus.' : 'Belum ada pengumuman publik.';
      }
      list.innerHTML = rows.map(a=>`<article class="public-announcement"><span class="eyebrow">${a.priority==='high'?'PENTING':'INFO WARGA'}</span><h3>${esc(a.title)}</h3><p>${esc(a.content)}</p>${a.created_at?`<small>${esc(fd(a.created_at))}</small>`:''}</article>`).join('');
    } catch { if(revision===newsRevision) status.textContent = 'Pengumuman publik tidak dapat dimuat. Silakan coba lagi nanti.'; }
  }
  function showPublic() {
    $('#app').style.display = 'none'; $('#loginPage').style.display = 'none'; node.hidden = false;
    updateReturn();
    news();
    if (!prayerReady) {
      prayerReady = true;
      if (window.mountPrayer) window.mountPrayer($('#publicPrayer'));
      else $('#publicPrayer').innerHTML = `<p><a href="${official}" target="_blank" rel="noopener">Lihat jadwal resmi di Bimas Islam Kemenag</a></p>`;
    }
  }
  const login = showLogin, app = showApp;
  showLogin = showPublic;
  showApp = () => { node.hidden = true; app(); };
  node.addEventListener('click', e=>{
    if (!e.target.closest('[data-public-login]')) return;
    if (S.profile) { showApp(); return; }
    node.hidden = true; login(); window.scrollTo(0,0); $('#loginEmail').focus();
  });
  $('#backPublic').addEventListener('click',showPublic);
  $('#showPublicSchedule').addEventListener('click',()=>{
    showPublic(); $('#jadwal-sholat').scrollIntoView();
    $('.public-nav').querySelector('a[href="#jadwal-sholat"]').focus({preventScroll:true});
  });
  const updateReturn = () => node.querySelectorAll('[data-public-login]').forEach(b=>{ b.textContent = S.profile ? 'Kembali ke Dashboard' : 'Masuk Portal'; });
})();
