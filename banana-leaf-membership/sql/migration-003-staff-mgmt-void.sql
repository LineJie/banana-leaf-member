-- Migration 3: kelola akun staff dari dashboard + batalkan/koreksi transaksi
-- Cara pakai: Supabase Dashboard > SQL Editor > New query, paste semua isi file ini, Run.
-- (Jalankan ini SETELAH sql/schema.sql dan sql/migration-002-owner-rewards.sql)

-- Status aktif/nonaktif akun staff. Staff yang dinonaktifkan gak bisa login lagi,
-- tapi riwayat transaksi yang pernah dia input tetap ada (gak dihapus).
alter table staff add column if not exists active boolean not null default true;

-- Penanda transaksi yang sudah dibatalkan/dikoreksi, plus link ke transaksi
-- koreksinya. Transaksi asli TIDAK dihapus/diubah (prinsip pembukuan: catatan asli
-- tetap ada, koreksi dicatat sebagai transaksi baru yang menyeimbangkan).
alter table transactions add column if not exists voided boolean not null default false;
alter table transactions add column if not exists voided_at timestamptz;
alter table transactions add column if not exists voided_by text;
alter table transactions add column if not exists related_transaction_id uuid references transactions(id);

-- 'void' ditambahkan sebagai type transaksi yang valid, di samping 'earn' dan 'redeem'
alter table transactions drop constraint if exists transactions_type_check;
alter table transactions add constraint transactions_type_check
  check (type in ('earn', 'redeem', 'void'));
