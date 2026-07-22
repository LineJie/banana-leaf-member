-- Banana Leaf Membership - schema database
-- Cara pakai: buka Supabase Dashboard > SQL Editor > New query, paste semua isi file ini, lalu Run.

create extension if not exists "pgcrypto";

-- Akun staff/kasir yang bisa login ke dashboard admin
create table if not exists staff (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  password_hash text not null,
  name text not null,
  created_at timestamptz not null default now()
);

-- Member. Kode unik member = nomor WhatsApp (format 62xxxxxxxxxx)
create table if not exists members (
  id uuid primary key default gen_random_uuid(),
  whatsapp_number text unique not null,
  name text not null,
  pin_hash text not null,
  created_at timestamptz not null default now()
);

-- Riwayat semua transaksi (belanja & redeem) buat ditampilkan sebagai histori
create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members(id) on delete cascade,
  type text not null check (type in ('earn', 'redeem')),
  points integer not null, -- positif utk earn, negatif utk redeem
  amount_spent numeric, -- diisi kalau type = earn
  description text, -- diisi kalau type = redeem (nama reward/diskon)
  created_by text, -- username staff yang input
  created_at timestamptz not null default now()
);

-- Batch poin. Tiap transaksi earn bikin 1 baris di sini dengan tanggal kadaluarsanya
-- sendiri (90 hari). Redeem motong points_remaining dari batch yang paling cepat
-- kadaluarsa dulu (FIFO), supaya poin lama gak sia-sia hangus.
create table if not exists point_batches (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members(id) on delete cascade,
  points_earned integer not null,
  points_remaining integer not null,
  earned_date timestamptz not null default now(),
  expiry_date timestamptz not null,
  source_transaction_id uuid references transactions(id)
);

create index if not exists idx_point_batches_member on point_batches(member_id);
create index if not exists idx_point_batches_expiry on point_batches(expiry_date);
create index if not exists idx_transactions_member on transactions(member_id);
create index if not exists idx_members_whatsapp on members(whatsapp_number);

-- Row Level Security: dinyalain tapi TANPA policy sama sekali, artinya cuma bisa
-- diakses lewat service role key (dipakai server-side di API routes kita).
-- Browser tidak pernah akses tabel ini langsung, jadi ini aman.
alter table staff enable row level security;
alter table members enable row level security;
alter table transactions enable row level security;
alter table point_batches enable row level security;
