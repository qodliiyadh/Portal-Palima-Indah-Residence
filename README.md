# Portal Palima Indah Residence

Frontend statis untuk GitHub Pages. Supabase menangani akun dan data; GitHub hanya menyimpan kode, bukan data warga.

## Coba mode demo

Biarkan `config.js` kosong. Jalankan `npx serve .` dari folder ini, lalu buka alamat HTTP yang ditampilkan. Masuk dengan `admin@demo.com` atau `warga@demo.com` dan kata sandi contoh apa pun yang tidak kosong. Data demo tersimpan di browser dan tidak dikirim ke Supabase. Jangan gunakan data pribadi nyata dalam demo. Ekspor Excel menyematkan `logo.svg` dan memerlukan akses CDN serta halaman HTTP/HTTPS, bukan `file://`.

## Pasang Supabase dan buat admin

1. Gunakan proyek Supabase baru atau cadangkan database lama terlebih dulu. Jalankan `supabase/01_schema.sql` di SQL Editor. Skrip ini skema baru, bukan migrasi aplikasi lama.
2. Nonaktifkan pendaftaran publik bila portal khusus warga. Dari **Authentication → Users**, buat akun admin dan konfirmasi email. Salin UUID akun tersebut, isi `initial_admin_id` di `supabase/02_initial_admin.sql`, lalu jalankan skrip. Jangan menaruh kata sandi atau `service_role`/secret key di GitHub.
3. Isi `supabaseUrl` dan `supabaseAnonKey` di `config.js` dengan Project URL dan **publishable key** (atau anon key lama). Keduanya merupakan konfigurasi publik; hak akses ditentukan database.
4. Untuk akun warga, buat akun di **Authentication → Users**. Profil baru berperan `warga`. Promosi ke `pengurus` dilakukan oleh operator database melalui SQL Editor. Admin/Pengurus dapat mengubah profil melalui **Pengguna**; penghapusan profil menonaktifkan akses portal, tetapi akun Auth hanya dapat dicabut/dihapus dari Supabase.
5. Isi nama, alamat dan nomor kontak di **Pengaturan** untuk kop laporan. Ganti `logo.svg` dengan logo resmi bila tersedia. Cetakan pengajuan disetujui masih berupa draf sampai diverifikasi dan ditandatangani.

Data lama di localStorage tidak ikut pindah otomatis. Gunakan proyek uji terlebih dahulu dan verifikasi bahwa warga tidak dapat melihat iuran, surat atau pengaduan milik akun lain.

## GitHub Pages

Salin **isi** folder ini, termasuk `.github/workflows/pages.yml`, ke root repository GitHub. Push ke branch `main`, lalu pilih **Settings → Pages → Source → GitHub Actions**. Workflow menerbitkan frontend saja; file SQL dijalankan terpisah di Supabase. Atur Site URL pada Authentication Supabase ke alamat Pages.

## Laman publik dan jadwal salat

Jalankan `supabase/03_public_announcements.sql` di SQL Editor. Di menu **Pengumuman**, centang **Tampilkan tanpa login** hanya untuk informasi yang aman dibaca siapa pun. Pengumuman lama tetap privat sampai ditandai publik.

Jalankan juga `supabase/04_public_prayer_location.sql`. Admin dapat mengatur lokasi bersama dari **Pengaturan → Lokasi Jadwal Salat**. Landing page dan beranda dashboard menampilkan jadwal hari ini secara otomatis, tanpa filter bagi pengunjung. Tema dapat dipilih di landing page dan Pengaturan, dan disimpan di browser.

Untuk menampilkan jadwal salat resmi di dalam portal, deploy fungsi `kemenag-prayer` sesuai [panduan jadwal salat](PRAYER.md). Lokasi awal adalah Banten → Kota Serang. Kecamatan Curug ditampilkan sebagai konteks lokasi; jadwal Kemenag tersedia pada tingkat kota/kabupaten. Tanpa fungsi tersebut, portal memberikan tautan resmi Kemenag dan tidak menampilkan jam perkiraan.

## Jadwal ronda

Sabtu malam (WIB), bergilir menurut urutan kelompok. Pengurus dapat mengubah anggota dan jam, menugaskan kelompok berbeda pada tanggal tertentu, atau meniadakan jadwal. Ekspor mengikuti bulan yang sedang tampil. Perubahan susunan kelompok menghitung ulang rotasi otomatis, termasuk untuk bulan yang lalu.
