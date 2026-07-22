-- Migration 2: role owner + katalog hadiah
-- Cara pakai: Supabase Dashboard > SQL Editor > New query, paste semua isi file ini, Run.
-- (Jalankan ini SETELAH sql/schema.sql sudah pernah dijalankan sebelumnya)

-- Tambah kolom role ke tabel staff. Nilai: 'staff' (default) atau 'owner'.
alter table staff add column if not exists role text not null default 'staff';

-- Katalog hadiah/reward yang bisa ditukar poin. Dikelola owner, dipakai staff
-- pas proses redeem biar gak salah ketik nama/harga hadiah.
create table if not exists rewards (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  points_cost integer not null check (points_cost > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table rewards enable row level security;

-- Buat proteksi brute-force di login staff & member (lihat lib/rateLimit.js)
create table if not exists login_attempts (
  identifier text primary key,
  failed_count integer not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

alter table login_attempts enable row level security;

-- Akun owner buat Tere. Password: 808808 (sudah di-hash, bukan disimpan polos).
-- Kalau username 'tere' udah ada, baris ini otomatis di-skip (gak dobel).
insert into staff (username, password_hash, name, role)
values ('tere', '$2a$10$2tckgl2X1CZ5/E7ezGwbMeLlSi2EZpoI4XF6d.SU25Oem17iYRqKq', 'Tere', 'owner')
on conflict (username) do nothing;
