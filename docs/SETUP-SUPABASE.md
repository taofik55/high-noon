# Setup Supabase & Google (panduan pemilik)

Panduan klik-per-klik untuk hal yang hanya bisa kamu lakukan sendiri. Nama menu ditulis persis seperti di dashboard
(bahasa Inggris); dashboard Supabase/Google kadang memindahkan menu, jadi kalau sedikit berbeda, cari nama yang sama.

## A. Development lokal (sudah jalan, tanpa akun apa pun)

1. Nyalakan **Docker Desktop**.
2. `pnpm db:start` — menyalakan Supabase lokal di port **553xx** (55321 API, 55322 database, 55323 Studio).
   Port ini sengaja beda dari default (543xx) supaya tidak bentrok dengan project Supabase lokal lain (mis. formpulse).
3. Isi `.env.local` dari output `pnpm exec supabase status -o env` (lihat `.env.example`):
   - `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:55321`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=` nilai `PUBLISHABLE_KEY`
   - `SUPABASE_SECRET_KEY=` nilai `SECRET_KEY` (jangan pernah diawali `NEXT_PUBLIC_`)
4. `pnpm dev` → http://localhost:3000. Studio database: http://127.0.0.1:55323.
5. Perintah lain: `pnpm db:stop`, `pnpm db:reset` (hapus data + jalankan ulang migration), `pnpm db:types`
   (generate ulang `src/lib/supabase/types.ts` setelah migration baru), `pnpm test:db` (test keamanan RLS).

Login Google **tidak wajib** untuk development; tombol Google baru muncul kalau `NEXT_PUBLIC_GOOGLE_AUTH=true`.
Deploy production: lihat `docs/DEPLOY.md`.

## B. Google Cloud (OAuth client untuk "Masuk dengan Google")

1. Buka https://console.cloud.google.com → pilih/buat project, mis. **High Noon**.
2. **APIs & Services → OAuth consent screen** (di konsol baru: **Google Auth Platform → Branding / Audience**):
   - User type / Audience: **External**.
   - App name: `High Noon`, User support email: email kamu, Developer contact: email kamu.
   - **Authorized domains**: `supabase.co` dan domain Vercel kamu (mis. `vercel.app` atau domain sendiri).
   - Scopes: biarkan default (`openid`, `email`, `profile`) — tidak perlu verifikasi Google.
   - Publishing status: **Testing** lalu tambahkan email teman-temanmu di **Test users**, *atau* klik **Publish app**
     (untuk scope dasar ini tidak butuh review).
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type: **Web application**, Name: `High Noon Web`.
   - **Authorized JavaScript origins**: `http://localhost:3000` dan `https://<domain-vercel-kamu>`.
   - **Authorized redirect URIs** (ini ke Supabase, bukan ke app):
     - Production: `https://<project-ref>.supabase.co/auth/v1/callback` (salin dari langkah C.3)
     - Lokal (opsional): `http://127.0.0.1:55321/auth/v1/callback`
4. Simpan **Client ID** dan **Client secret**.

## C. Supabase (project production — paling lambat di Fase 14)

1. https://supabase.com/dashboard → **New project**: region terdekat dengan pemain (mis. **Southeast Asia
   (Singapore)**), simpan database password di tempat aman.
2. **Authentication → Sign In / Providers**:
   - **Allow anonymous sign-ins**: ON (nickname tanpa akun).
   - **Allow manual linking**: ON (akun tamu → Google dengan user id yang sama).
3. **Authentication → Sign In / Providers → Google**: Enable, tempel Client ID + Client secret dari B.4, lalu salin
   **Callback URL (for OAuth)** ke Google (B.3).
4. **Authentication → URL Configuration**:
   - **Site URL**: URL production Vercel (sementara boleh `http://localhost:3000`).
   - **Redirect URLs**: `http://localhost:3000/**`, `https://<domain-vercel-kamu>/**`, dan pola preview Vercel
     `https://*-<nama-tim-vercel>.vercel.app/**`.
5. **Project Settings → API Keys**: salin **Publishable key** dan **Secret key** → env Vercel (Fase 14) atau
   `.env.local` kalau mau mencoba dengan project online.
6. Schema: `pnpm exec supabase link --project-ref <project-ref>` lalu `pnpm exec supabase db push` (dikerjakan bersama
   di Fase 14).
7. Opsional kalau ada spam akun tamu: **Authentication → Attack Protection → CAPTCHA** (Turnstile).

## D. Google di Supabase lokal (opsional)

1. Buat file `supabase/.env` (sudah di-gitignore) berisi:
   ```
   SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=...
   SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=...
   ```
2. Di `supabase/config.toml`, bagian `[auth.external.google]`, ubah `enabled = false` → `true`.
3. Pastikan redirect URI lokal (B.3) sudah ditambahkan, lalu `pnpm db:stop && pnpm db:start`.

## E. Gerbang password situs (opsional)

Isi `SITE_PASSWORD` (di `.env.local` atau env Vercel). Semua halaman lalu meminta kata sandi itu sekali per browser
(cookie 30 hari). Kosongkan untuk mematikan.
