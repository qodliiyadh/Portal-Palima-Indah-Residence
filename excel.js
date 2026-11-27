(() => {
  const original = window.exportData;
  window.exportData = type => {
    if (type === 'ronda') return exportExcel(rondaExportRows(), 'jadwal-ronda');
    if (type === 'transactions') {
      let saldo = 0;
      return exportExcel([...DDB.transactions].sort((a,b)=>a.date.localeCompare(b.date)).map(t=>{
        const amount = Number(t.amount), masuk = t.type==='income' ? amount : 0, keluar = t.type==='expense' ? amount : 0;
        saldo += masuk-keluar;
        return {Tanggal:t.date,Keterangan:t.title,Pemasukan:masuk,Pengeluaran:keluar,Saldo:saldo};
      }), 'buku-kas');
    }
    return original(type);
  };
  async function pngLogo() {
    const img = new Image(); img.src = './logo.svg'; await img.decode();
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 160;
    canvas.getContext('2d').drawImage(img, 0, 0, 160, 160);
    return canvas.toDataURL('image/png');
  }
  window.exportExcel = async (data, filename, name='Data') => {
    try {
      const book = new ExcelJS.Workbook();
      const cols = [...new Set(data.flatMap(Object.keys))];
      const sheet = book.addWorksheet(name, {views:[{state:'frozen',ySplit:1}]});
      sheet.columns = (cols.length ? cols : ['Tidak ada data']).map(c=>({header:c,width:Math.min(50,Math.max(17,c.length+4,...data.slice(0,100).map(r=>String(r[c]??'').length+2)))}));
      for (const r of data) sheet.addRow(cols.map(c=>r[c] && typeof r[c]==='object' ? JSON.stringify(r[c]) : r[c]??''));
      if (cols.length) sheet.autoFilter = {from:{row:1,column:1},to:{row:1,column:cols.length}};
      const fill = color => ({type:'pattern',pattern:'solid',fgColor:{argb:'FF'+color}});
      sheet.eachRow((row,i)=>{
        row.height = i===1?25:30;
        row.eachCell({includeEmpty:true},(cell,j)=>{
          cell.fill=fill(i===1?'12463E':i%2===0?'EAF6F0':'FFFFFF');
          cell.font={bold:i===1,color:{argb:i===1?'FFFFFFFF':'FF17352F'}};
          cell.alignment={vertical:'middle',wrapText:true};
          if (i>1 && typeof cell.value==='number' && /total|jumlah|amount|saldo|pemasukan|pengeluaran/i.test(cols[j-1])) cell.numFmt='"Rp" #,##0;[Red]-"Rp" #,##0';
        });
      });
      const cover = book.addWorksheet('Kop Laporan');
      cover.columns=[{width:15},{width:22},{width:28},{width:24}];
      cover.mergeCells('B1:D1');cover.mergeCells('B2:D2');cover.mergeCells('B3:D3');
      cover.getCell('B1').value=S.settings.name||'Palima Indah Residence';
      cover.getCell('B2').value='PENGURUS RT • PORTAL WARGA';
      cover.getCell('B3').value=[S.settings.address,S.settings.phone&&'WA '+S.settings.phone].filter(Boolean).join(' · ');
      cover.getRow(1).height=28;cover.getCell('B1').font={bold:true,size:17,color:{argb:'FF12463E'}};
      cover.getCell('B2').fill=fill('F3CB78');
      const image=book.addImage({base64:await pngLogo(),extension:'png'});
      cover.addImage(image,{tl:{col:0.15,row:0.1},ext:{width:74,height:74}});
      cover.getCell('B5').value=filename.replaceAll('-',' ').toUpperCase();
      cover.getCell('B6').value=`Tanggal ekspor: ${new Date().toLocaleDateString('id-ID')}`;
      cover.getCell('B7').value=`Jumlah data: ${data.length}`;
      const url=URL.createObjectURL(new Blob([await book.xlsx.writeBuffer()],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
      const a=document.createElement('a');a.href=url;a.download=filename+'.xlsx';a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);
      toast('File Excel siap diunduh.');
    } catch(e) { console.error(e);toast('Ekspor Excel gagal. Pastikan aplikasi dibuka melalui server HTTP dan library termuat.', 'error'); }
  };
})();
