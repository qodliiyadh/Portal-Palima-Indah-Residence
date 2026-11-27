(() => {
  'use strict';

  const logo = new URL('./logo.svg', document.currentScript.src).href;
  const statuses = { approved: 'Disetujui', inreview: 'Ditinjau', pending: 'Menunggu' };
  const escapeHtml = esc;
  const brand = () => S.settings?.name || 'Palima Indah Residence';

  window.printLetter = function (id) {
    const profile = S.profile;
    const letter = profile && DDB.letters.find(item => String(item.id) === String(id) &&
      (isStaff() || item.user_id === profile.id));
    if (!letter || letter.status !== 'approved') return toast('Hanya surat yang telah disetujui yang dapat dicetak.', 'error');
    const popup = window.open('', '_blank', 'popup,width=850,height=950');
    if (!popup) return toast('Izinkan popup untuk membuka pratinjau cetak.', 'error');
    popup.opener = null;
    const details = [
      ['Nama pemohon', letter.user_name], ['Nomor kontak', letter.phone],
      ['Tanggal pengajuan', letter.created_at ? fdt(letter.created_at) : ''],
      ['Referensi pengajuan', letter.id], ['Status pengajuan', statuses[letter.status]]
    ];
    const contact = [S.settings?.address, S.settings?.phone ? 'WA: ' + S.settings.phone : ''].filter(Boolean).join(' · ');
    popup.document.open();
    popup.document.write(`<!doctype html><html lang="id"><head><meta charset="utf-8">
      <meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(letter.type || 'Surat Warga')}</title>
      <style>
        @page{size:A4;margin:20mm} *{box-sizing:border-box} body{margin:0;color:#172c27;background:#eaf2ee;font:11pt/1.55 system-ui,sans-serif;overflow-wrap:anywhere}
        main{background:#fff;max-width:210mm;margin:1rem auto;padding:20mm} header{display:flex;align-items:center;gap:16px;border-bottom:4px double #12463e;padding-bottom:12px;break-inside:avoid}
        header img{width:64px;height:64px;flex:none} h1,h2,h3,p{margin:0} h1{font-size:1.45em} header p{color:#345d51} h2{text-align:center;font-size:1.25em;margin:24px 0 4px;text-transform:uppercase}
        .caption{text-align:center;color:#345d51;margin-bottom:24px} .caption strong{border:1px solid #886121;padding:2px 8px;color:#664711}
        dl{margin:16px 0} .field{display:grid;grid-template-columns:minmax(8rem,35%) 1fr;gap:8px;padding:6px 0;border-bottom:1px solid #c8d7d1;break-inside:avoid} dt{font-weight:600} dd{margin:0}
        section{margin:20px 0} section p{white-space:pre-wrap} footer{display:flex;justify-content:flex-end;margin-top:30px;break-inside:avoid} footer div{text-align:center;min-width:12em} .signature{height:55px}
        .actions{text-align:center;margin:16px} button{padding:8px 16px;font:inherit;cursor:pointer} .notice{margin-top:20px;font-size:.88em;color:#345d51}
        @media print{body{background:#fff} main{margin:0;padding:0;max-width:none} .actions{display:none}}
      </style></head><body><div class="actions"><button type="button" id="print">Cetak / Simpan sebagai PDF</button></div>
      <main><header><img src="${escapeHtml(logo)}" width="64" height="64" alt="Logo Palima Indah"><div><p>Pengurus RT</p><h1>${escapeHtml(brand())}</h1>${contact ? `<p>${escapeHtml(contact)}</p>` : ''}</div></header>
      <h2>${escapeHtml(letter.type || 'Surat Warga')}</h2><p class="caption"><strong>Draf untuk ditandatangani</strong></p>
      <p>Pengajuan surat berikut telah disetujui oleh pengurus. Berikut data pemohon dan keperluan pengajuan:</p>
      <dl>${details.map(([label, value]) => `<div class="field"><dt>${label}</dt><dd>${escapeHtml(value || '—')}</dd></div>`).join('')}</dl>
      <section><h3>Keperluan</h3><p>${escapeHtml(letter.purpose || '—')}</p></section>
      <footer><div><p>Tanggal: __________________</p><p>Pengurus RT</p><div class="signature"></div><p>(______________________)</p></div></footer>
      <p class="notice">Cetakan ini belum menjadi surat resmi tanpa verifikasi dan tanda tangan pengurus.</p></main></body></html>`);
    popup.document.close();
    const button = popup.document.getElementById('print');
    const image = popup.document.querySelector('header img');
    button.addEventListener('click', async () => {
      if (image.decode) await image.decode().catch(() => {});
      if (!popup.closed) { popup.focus(); popup.print(); }
    });
    popup.focus();
  };

  document.addEventListener('click', event => {
    const button = event.target.closest?.('button[data-print-letter]');
    if (button) window.printLetter(button.dataset.printLetter);
  });
})();
