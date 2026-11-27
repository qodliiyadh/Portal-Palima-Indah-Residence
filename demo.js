(() => {
  const init = DDB.init.bind(DDB);
  DDB.init = () => {
    init();
    if (localStorage.getItem('pir_showcase_v1')) return;
    const now = new Date().toISOString();
    const seed = (table, rows) => { if (!DDB[table].length) { DDB[table] = rows.map(row=>({created_at:now,...row})); DDB.save(table); } };
    seed('complaints', [
      {id:'dc1',user_id:'u1',user_name:'Budi Santoso',title:'Lampu jalan Blok A padam',description:'Lampu di dekat taman tidak menyala sejak tadi malam.',status:'inprogress',response:'Teknisi dijadwalkan memeriksa panel jalan.'},
      {id:'dc2',user_id:'u1',user_name:'Budi Santoso',title:'Saluran air perlu dibersihkan',description:'Daun menumpuk di saluran dekat pos satpam.',status:'pending'}
    ]);
    seed('letters', [
      {id:'dl1',user_id:'u1',user_name:'Budi Santoso',type:'Surat Keterangan Domisili',purpose:'Kelengkapan administrasi pekerjaan.',status:'approved'},
      {id:'dl2',user_id:'u1',user_name:'Budi Santoso',type:'Surat Pengantar KK',purpose:'Pembaruan data keluarga.',status:'pending'}
    ]);
    seed('logs',[{id:'dlog1',time:now,user:'Pengurus Demo',action:'Contoh aktivitas',detail:'Data fiktif tersedia untuk mencoba portal.'}]);
    if (!localStorage.getItem('appSettings')) {
      S.settings = {...S.settings,name:'Palima Indah Residence',address:'Kecamatan Curug, Kota Serang, Banten (contoh)'};
      localStorage.setItem('appSettings',JSON.stringify(S.settings));
    }
    localStorage.setItem('pir_showcase_v1','1');
  };
  const cctv = pgCCTV;
  pgCCTV = () => DEMO && !S.settings.cctv_url ? `<div class="card"><div class="card-header"><h3>📹 CCTV Lingkungan</h3></div><div class="card-body"><p>Contoh daftar kamera — bukan tayangan langsung.</p><div class="quick-grid" style="margin-top:16px"><div class="quick-card"><h4>Gerbang Utama</h4><p>Contoh · akses masuk</p></div><div class="quick-card"><h4>Taman Blok A</h4><p>Contoh · ruang publik</p></div></div><p style="margin-top:16px">Pengurus dapat mengatur tautan dashboard di menu Pengaturan.</p></div></div>` : cctv();
})();
