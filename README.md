# Portal Palima Indah Residence (RT 04 / RW 08 - Serang, Banten)

WebApp Dashboard & Landing Page Manajemen Lingkungan Terpadu berbasis HTML5, Tailwind CSS, Supabase, dan GitHub Pages.

## Panduan Penerapan Manual ke Supabase & GitHub Pages
1. Buka dashboard [supabase.com](https://supabase.com) dan buat project baru.
2. Masuk ke **SQL Editor**, unggah atau tempel file `supabase/schema.sql`, lalu klik **Run**.
3. Ambil **Project URL** dan **Anon Public Key** di *Project Settings -> API*.
4. Unggah `index.html`, `README.md`, dan `.github/workflows/deploy-pages.yml` ke repository GitHub Anda (branch `main`).
5. Buka **Settings -> Pages** pada repository GitHub Anda, pilih **Source: GitHub Actions**.
6. Buka WebApp yang sudah online, masuk ke menu **Pengaturan Umum**, dan hubungkan Supabase URL & Anon Key.