# Banana Leaf Membership

Sistem poin membership buat Banana Leaf. Menggantikan pencatatan spreadsheet manual.

**Aturan poin (sesuai yang kamu kasih):**
- Setiap belanja Rp100.000 = 1 poin, dibulatkan ke bawah (Rp350.000 = 3 poin, bukan 3.5)
- Setiap poin berlaku 90 hari sejak didapat, lalu hangus otomatis
- Kode unik member = nomor WhatsApp
- Redeem poin dipotong dari poin yang paling cepat kadaluarsa dulu (FIFO), biar poin lama gak sia-sia hangus

**Yang bisa dilakukan:**
- Member login pakai nomor WhatsApp + PIN, bisa cek poin & riwayat sendiri, bisa ganti PIN
- Staff login terpisah, bisa daftar member baru, catat belanja (poin otomatis kehitung), dan proses redeem poin buat reward/diskon
- **Owner** (kamu, Tere) punya login sendiri dengan kemampuan tambahan: kelola daftar hadiah yang bisa ditukar poin, dan edit data customer (nama/nomor WA)

---

## 1. Setup database (Supabase) — gratis

1. Buka [supabase.com](https://supabase.com), daftar/login, klik **New Project**. Pilih region Singapore biar paling deket & cepat.
2. Setelah project jadi, buka menu **SQL Editor** > **New query**.
3. Copy semua isi file `sql/schema.sql` dari folder ini, paste, klik **Run**. Ini bikin semua tabel yang dibutuhkan.
4. Buka query baru lagi, copy semua isi `sql/migration-002-owner-rewards.sql`, paste, klik **Run**. Ini nambahin fitur role owner + katalog hadiah, dan otomatis bikinin akun owner kamu (lihat bagian bawah).
5. Buka **Project Settings > API**. Kamu bakal butuh 2 nilai ini buat langkah 3 nanti:
   - **Project URL** (contoh: `https://xxxxx.supabase.co`)
   - **service_role key** (di bagian "Project API keys" — klik reveal). **Jangan pernah share key ini ke siapapun atau taruh di kode yang di-push ke GitHub**, karena ini kunci yang bisa akses semua data.

## 2. Push kode ke GitHub

1. Buka [github.com](https://github.com), klik **New repository**. Kasih nama misalnya `banana-leaf-membership`, set **Private** (biar gak publik), klik **Create repository**.
2. Di komputer kamu, buka Terminal, masuk ke folder project ini, lalu jalankan:
   ```
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/USERNAME-KAMU/banana-leaf-membership.git
   git push -u origin main
   ```
   (Ganti `USERNAME-KAMU` dengan username GitHub kamu. File `.env` gak akan ikut ke-push karena sudah ada di `.gitignore` — aman.)

## 3. Deploy ke Vercel — gratis

1. Buka [vercel.com](https://vercel.com), sign up/login pakai akun GitHub kamu.
2. Klik **Add New > Project**, pilih repo `banana-leaf-membership` yang tadi kamu push.
3. Sebelum klik Deploy, buka bagian **Environment Variables**, isi 3 ini:
   - `SUPABASE_URL` = Project URL dari Supabase (langkah 1.4)
   - `SUPABASE_SERVICE_ROLE_KEY` = service_role key dari Supabase (langkah 1.4)
   - `SESSION_SECRET` = string acak bebas, minimal 32 karakter (contoh: buka [randomkeygen.com](https://randomkeygen.com) dan copy salah satu)
4. Klik **Deploy**. Tunggu 1-2 menit, nanti dikasih link websitenya (contoh: `banana-leaf-membership.vercel.app`).

Setelah ini, tiap kali kamu (atau aku) update kode dan `git push`, Vercel otomatis deploy ulang — gak perlu drag-and-drop manual kayak Netlify lagi.

## 4. Login owner (kamu) & bikin akun staff lain

Akun owner kamu **sudah otomatis dibuat** waktu kamu jalanin `sql/migration-002-owner-rewards.sql` di langkah 1.4:
- Login di `https://situs-kamu.vercel.app/staff/login`
- Username: `tere`
- Password: `808808`

**Penting:** password ini sempat kamu ketik di chat, jadi begitu situsnya jalan, langsung login lalu klik **Ganti Password** di pojok kanan atas dashboard buat gantiin dengan password baru yang cuma kamu tau.

Buat nambah akun staff biasa (bukan owner) buat kasir:
1. Di komputer kamu, di folder project, jalankan `npm install` sekali (buat install dependency).
2. Jalankan:
   ```
   node scripts/create-staff.js username_kasir password_kasir "Nama Kasir"
   ```
3. Script bakal keluarin 1 baris perintah SQL. Copy, paste ke Supabase SQL Editor, klik Run.

Akun yang dibuat lewat script ini otomatis role biasa (bukan owner), jadi gak bisa akses "Kelola Hadiah" atau edit data customer — cuma kamu (owner) yang bisa.

---

## Cara pakai sehari-hari

**Staff:**
- Daftar member baru: masukin nomor WA + nama. Sistem generate PIN acak 6 digit, ditampilkan sekali di layar — langsung kasih tau ke membernya (verbal/WhatsApp) saat itu juga.
- **Member lupa PIN:** buka detail membernya, klik "Reset PIN". Sistem generate PIN acak baru (PIN lama otomatis gak berlaku), tampil sekali di layar — kasih tau ke member. Gak ada cara buat "lihat lagi" PIN lama, karena memang disimpan ter-enkripsi (bukan teks biasa) demi keamanan.
- Catat belanja: cari member, klik "Catat belanja", masukin nominal. Poin kehitung otomatis (dibulatkan ke bawah).
- Redeem: cari member, klik "Redeem poin", masukin jumlah poin + buat apa (misal "diskon 20rb").

**Member:**
- Login pakai nomor WA + PIN di halaman member.
- Bisa lihat total poin, kapan poin bakal hangus, dan riwayat transaksi.
- Bisa ganti PIN sendiri.

**Owner (kamu):**
- Punya semua kemampuan staff, plus:
- **Kelola Hadiah** (link di pojok kanan atas dashboard): tambah hadiah baru (nama + biaya poin), ubah biaya poin, atau nonaktifkan hadiah yang udah gak berlaku. Hadiah aktif otomatis muncul sebagai pilihan pas staff proses redeem.
- **Edit customer**: buka detail member, klik "Edit" buat ubah nama atau nomor WhatsApp-nya.

## Catatan & batasan yang perlu kamu tahu

- Redeem poin sengaja cuma bisa diproses staff (bukan member sendiri), soalnya reward-nya ditukar langsung di venue — biar gak disalahgunakan.
- Ganti nomor WhatsApp member lewat fitur edit owner juga otomatis ganti nomor yang dipakai member itu buat login.
- Login staff & member sekarang otomatis terkunci 15 menit setelah 5 kali salah berturut-turut (proteksi brute-force).
- PIN default member sekarang acak (bukan dari nomor WA-nya), jadi wajib dikasih tau manual oleh staff pas daftar — sistem nunjukkin PIN-nya sekali doang pas member baru didaftarkan, dicatat/di-screenshot dulu sebelum ditutup.
- Belum ada notifikasi WhatsApp otomatis (misal reminder "poin kamu mau hangus"). Ini bisa ditambah belakangan pakai WhatsApp Business API, tapi biasanya berbayar.
- Belum ada fitur "batalkan transaksi" kalau staff salah input nominal/redeem. Kalau kejadian, sementara cara koreksinya manual: catat transaksi kebalikan (mis. redeem ulang poin yang salah ditambah).
- Belum ada halaman kelola akun staff dari dashboard — nambah/nonaktifkan akun staff masih lewat script `scripts/create-staff.js` + Supabase SQL Editor.
- Satu akun staff dipakai bareng-bareng di kasir juga bisa, tapi kalau mau tau siapa yang input tiap transaksi, sebaiknya tiap staff punya username sendiri.

## Kalau ada error pas deploy

Kirim screenshot error-nya (biasanya muncul di halaman Vercel pas build gagal, atau di kolom "Function Logs"), nanti kubantu debug.
