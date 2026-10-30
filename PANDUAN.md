# PANDUAN — Membangun "High Noon" (Bang! 3D) dengan Claude Code

Paket ini berisi semua dokumen yang dibaca Claude Code supaya ia paham apa yang mau dibangun, plus prompt per fase
yang tinggal kamu tempel. Dokumen teknis ditulis dalam bahasa Inggris karena itu paling presisi untuk Claude Code;
panduan ini dan catatan di roadmap dalam bahasa Indonesia. Tampilan game nanti tetap berbahasa Indonesia.

## Isi paket
| File | Untuk apa |
|---|---|
| `CLAUDE.md` | "Aturan main" project yang otomatis dibaca Claude Code tiap sesi: stack, struktur folder, aturan emas. |
| `docs/01-PRD.md` | Apa yang dibangun: mode, fitur, prioritas, alur layar. |
| `docs/02-GAME-RULES.md` | Aturan Bang! base game lengkap + keputusan untuk kasus ambigu + daftar 51 test. |
| `docs/03-ARCHITECTURE.md` | Cara kerja sistem: engine aturan, AI, alur online, sinkronisasi, keamanan. |
| `docs/04-DATABASE.md` | Skema Supabase lengkap (SQL), RLS, setup dashboard. |
| `docs/05-3D-WORLD-AND-ANIMATION.md` | Kota, kamera, kartu 3D, karakter, daftar adegan sinematik tiap kartu. |
| `docs/06-AI-NPC.md` | Cara NPC easy/medium/hard berpikir + simulator bot. |
| `docs/07-ASSETS-GUIDE.md` | Daftar aset 3D/gambar/suara yang dibutuhkan, sumbernya, dan cara optimasinya. |
| `docs/08-ROADMAP-AND-PROMPTS.md` | 15 fase pengerjaan + prompt siap tempel + template laporan bug. |

## Yang perlu disiapkan
- Node.js LTS, **pnpm**, Git, akun GitHub
- **Claude Code** terpasang dan login
- **Docker Desktop** + **Supabase CLI** (untuk database lokal mulai Fase 9)
- Akun **Supabase** dan **Vercel** (gratis cukup untuk main bareng teman)
- Nanti untuk aset: akun Adobe (Mixamo), Sketchfab/Fab, dan Blender

## Langkah mulai
1. Buat folder kosong, misal `high-noon/`.
2. Salin `CLAUDE.md` dan folder `docs/` ke dalamnya (PANDUAN.md boleh ikut, boleh tidak).
3. Buka terminal di folder itu, jalankan `claude`.
4. Buka `docs/08-ROADMAP-AND-PROMPTS.md`, salin prompt **Fase 0**, tempel.
5. Claude Code akan mengusulkan rencana. Baca, koreksi kalau perlu, lalu setujui.
6. Setelah selesai, coba hasilnya sendiri (jalankan `pnpm dev`, lihat test-nya hijau).
7. Commit, ketik `/clear`, lanjut fase berikutnya.

## Tips supaya hasilnya bagus
- **Satu fase per sesi.** Konteks yang bersih membuat Claude Code lebih fokus dan jarang ngawur.
- **Gunakan plan mode** untuk fase besar, supaya kamu melihat rencananya sebelum ada kode yang ditulis.
- **Jangan lompat ke 3D sebelum Fase 6 lancar.** Kalau aturan sudah benar di meja 2D, sisa pekerjaan jauh lebih mudah.
- **Kalau ada aturan yang terasa salah,** pakai template "Laporan bug aturan". Claude Code akan menulis test dulu,
  baru memperbaiki, jadi bug yang sama tidak kembali.
- **Review diff penting** (database, keamanan, `src/server`). Kamu sudah paham Next.js, jadi bagian ini akan terasa familiar.
- Kalau Claude Code ingin mengubah arsitektur, biarkan ia memperbarui dokumen di `docs/` juga.

## Pekerjaan yang harus kamu lakukan sendiri
- **Verifikasi suit/rank kartu** (`src/engine/cards/deck.ts`) dengan kartu fisik Bang! milikmu. Ini penting untuk
  Barrel, Jail, Dynamite, dan Black Jack.
- **Mencari dan mengunduh aset 3D**, terutama 16 karakter, animasi Mixamo, kuda, dan bangunan kota. Claude Code bisa
  menulis kode dan skrip Blender, tapi tidak bisa membuat model 3D realistis atau mengunduh dari akunmu.
- **Membuat artwork kartu sendiri** (ilustrasi atau AI image) dengan gaya yang konsisten.
- Setting dashboard Supabase, Google Cloud (untuk login Google), dan Vercel. Claude Code akan memberi langkah klik-per-klik.

## Soal hak cipta
Mekanik permainan pada umumnya bukan objek hak cipta, tapi nama "Bang!", logo, dan ilustrasi kartunya milik dV Giochi.
Karena itu dokumen ini memakai judul kerja **"High Noon"** (bisa diganti lewat `NEXT_PUBLIC_GAME_TITLE`), artwork
buatan sendiri, situs `noindex`, dan opsi password bersama (`SITE_PASSWORD`) supaya hanya kamu dan teman yang bisa
masuk. Aku bukan pengacara; kalau suatu saat ingin merilis publik, sebaiknya cek dulu ke ahlinya.

## Perkiraan waktu (kalau dikerjakan rutin beberapa jam per hari)
- Fase 0–6 (aturan + bot + main 2D): 1–2 minggu
- Fase 7–8 (3D placeholder + sinematik): 1–2 minggu
- Fase 9–11 (online): 1 minggu
- Fase 12–13 (aset asli, polish): sangat tergantung aset, 2–4 minggu
- Fase 14 (deploy): 1 hari
