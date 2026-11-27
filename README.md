# Portal Palima Indah Residence (RT 04 / RW 08 Serang)

Aplikasi WebApp & Landing Page terpadu dengan dukungan **Supabase** dan **GitHub Pages**.

## Langkah Penerapan ke Supabase
1. Buat project baru di [Supabase](https://supabase.com).
2. Buka menu **SQL Editor**, salin isi file `supabase/schema.sql`, lalu klik **Run**.
3. Buat akun pengurus di **Authentication > Users** (misal `admin@palimaindah.id`).
4. Salin **Project URL** dan **anon public key** ke menu **5. Pengaturan Umum** di dalam WebApp.

## Langkah Penerapan ke GitHub Pages
1. Unggah `index.html`, `README.md`, `supabase/schema.sql`, dan `.github/workflows/deploy-pages.yml` ke repository GitHub Anda.
2. Buka **Settings > Pages > Source**, pilih **GitHub Actions**.
3. Setiap push ke branch `main` otomatis mempublikasikan portal Anda.
