# Deploy (Vercel + Supabase) — panduan pemilik

Status: live di **https://high-noon-lyart.vercel.app** (Vercel, function region `sin1`), Supabase production dengan
migration `0001_init.sql`. Login: tamu (anonim). Google menyusul (bagian 6).

Jangan pernah menempel key atau password ke chat, issue, atau commit. Tempel langsung ke dashboard / terminal.

## 1. Supabase — login

Dashboard project → **Authentication → Sign In / Providers**:
- **Allow anonymous sign-ins**: ON.
- **Allow manual linking**: ON (akun tamu nanti bisa disambung ke Google tanpa ganti user id).

Catat dari **Project Settings**:
- **General → Project ID** (= `project-ref`).
- **API Keys → Publishable key** (`sb_publishable_…`) dan **Secret key** (`sb_secret_…`).
- **Data API / General → Project URL** (`https://<project-ref>.supabase.co`) dan region project.

## 2. Supabase — database (migration)

Di terminal, folder project:
```
pnpm exec supabase login
pnpm exec supabase link --project-ref <project-ref>     # minta database password
pnpm exec supabase db push                              # jawab Y
```
Lupa database password: **Project Settings → Database → Reset database password**.
Jangan menempel SQL migration ke SQL Editor: riwayat migration tidak tercatat dan `db push` berikutnya bentrok.
Migration baru nanti: buat dengan `pnpm exec supabase migration new <nama>`, uji lokal (`pnpm db:reset`), lalu
`pnpm exec supabase db push` lagi.

## 3. Vercel — project

**Add New… → Project → Import** repo `taofik55/high-noon`. Framework **Next.js** (otomatis), Root Directory `./`,
build/install default (pnpm dari `packageManager`).

**Environment Variables** (centang Production dan Preview):

| Name | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key |
| `SUPABASE_SECRET_KEY` | Secret key — tandai **Sensitive**, **tanpa** awalan `NEXT_PUBLIC_` |
| `NEXT_PUBLIC_GAME_TITLE` | `High Noon` |
| `SITE_PASSWORD` | opsional: password bersama untuk teman; kosong = tanpa gerbang |
| `NEXT_PUBLIC_GOOGLE_AUTH` | jangan diisi dulu; `true` setelah bagian 6 |

Lalu:
- **Settings → Functions → Function Region**: sama dengan region Supabase (Singapore = `sin1`).
- **Settings → Build and Deployment → Node.js Version**: **24.x**.
- **Deploy** (atau **Deployments → ⋯ → Redeploy** setelah mengubah setting).

Env `NEXT_PUBLIC_*` dibaca saat build: setiap kali diubah, **Redeploy**. Setiap push ke `main` di GitHub otomatis
membuat deploy production baru; branch lain jadi preview deploy.

## 4. Supabase — URL Vercel

**Authentication → URL Configuration**:
- **Site URL**: `https://high-noon-lyart.vercel.app`
- **Redirect URLs**:
  ```
  https://high-noon-lyart.vercel.app/**
  https://*-<nama-akun-atau-tim-vercel>.vercel.app/**
  http://localhost:3000/**
  ```

## 5. Smoke test

```
pnpm smoke -- --url https://high-noon-lyart.vercel.app [--password <SITE_PASSWORD>]
```
Mengecek: gerbang password, home (noindex + security headers), robots.txt, halaman solo, `/dev/assets` dan
`/dev/cards` 404, API menolak tanpa sesi. Untuk sekalian mengecek alur online (login anonim → bikin room → keluar),
set dulu di terminal (jangan di-commit):
```
SMOKE_SUPABASE_URL=https://<project-ref>.supabase.co SMOKE_SUPABASE_KEY=<publishable key> pnpm smoke -- --url https://high-noon-lyart.vercel.app
```
Ini meninggalkan satu user anonim "Smoke test" di Authentication → Users (boleh dihapus manual); room-nya dihapus.

Lalu coba main sungguhan: solo sebentar, bikin room online, buka link undangan di HP/incognito, mulai berdua.

Masalah umum:
- **"Anonymous sign-ins are disabled"** → bagian 1.
- **API 401 "site password required"** → buka home dulu dan masukkan password.
- **Bikin room gagal 500** → migration belum di-push (bagian 2) atau `SUPABASE_SECRET_KEY` salah/kosong.
- **Build gagal** → buka log build di Vercel, salin bagian error-nya.

## 6. Google (menyusul)

1. Google Cloud: ikuti `docs/SETUP-SUPABASE.md` bagian **B** (OAuth client). Authorized JavaScript origin:
   `https://high-noon-lyart.vercel.app`; redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`.
2. Supabase: **Authentication → Sign In / Providers → Google** → Enable, tempel Client ID + Client secret.
3. Vercel: tambah env `NEXT_PUBLIC_GOOGLE_AUTH` = `true` (Production + Preview) → **Redeploy**.
   Sebelum env ini diisi, tombol "Masuk dengan Google" / "Sambungkan Google" tidak ditampilkan.

## Yang sudah diatur di kode

- `next.config.ts`: security headers (`nosniff`, `Referrer-Policy`, `X-Frame-Options: DENY`, `Permissions-Policy`)
  untuk semua halaman; `/assets/*` di-cache setahun (`immutable`).
- Route handler dan `src/proxy.ts` jalan di runtime Node (default Next.js 16; tidak ada yang memakai Edge).
- `/dev/assets` dan `/dev/cards` 404 di production (`src/lib/devOnly.ts`); `/dev/table` (meja 2D ringan) tetap ada.
- `robots.txt` + meta `noindex`: situs tidak masuk mesin pencari.
