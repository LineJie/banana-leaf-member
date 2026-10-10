-- Migration 4: template pesan WA editable, log kampanye, voucher berkode,
-- ulang tahun, paksa ganti PIN, dan audit perubahan data member.
-- Cara pakai: Supabase Dashboard > SQL Editor > New query, paste semua isi file ini, Run.
-- (Jalankan SETELAH schema.sql, migration-002 dan migration-003.)
-- Aman dijalankan berulang kali (tidak menimpa data yang sudah ada).
--
-- PENTING: jalankan file ini LEBIH DULU sebelum upload kode barunya ke GitHub.

-- ---------------------------------------------------------------------------
-- Kolom tambahan di members
-- ---------------------------------------------------------------------------
-- must_change_pin: true = member wajib ganti PIN saat login berikutnya.
-- Otomatis diisi true untuk member baru & setelah reset PIN (lihat kode API).
alter table members add column if not exists must_change_pin boolean not null default false;

-- Tanggal lahir (opsional) buat pesan ulang tahun.
alter table members add column if not exists birth_date date;

-- true = member minta berhenti dikirimi pesan promo/pengingat lewat WA.
alter table members add column if not exists promo_opt_out boolean not null default false;

-- OPSIONAL: kalau mau SEMUA member yang sudah ada juga dipaksa ganti PIN
-- saat login berikutnya, hapus tanda "--" di baris bawah ini lalu Run.
-- update members set must_change_pin = true;

-- ---------------------------------------------------------------------------
-- Template pesan WA (diedit owner dari dashboard)
-- ---------------------------------------------------------------------------
create table if not exists message_templates (
  key text primary key,            -- 'expiring' | 'inactive' | 'birthday'
  title text not null,
  body text not null,
  valid_until date,                -- tanggal berlaku promo (dipakai variabel {berlaku_sampai})
  updated_at timestamptz not null default now(),
  updated_by text
);

alter table message_templates enable row level security;

insert into message_templates (key, title, body, valid_until) values
(
  'expiring',
  'Poin akan hangus',
  'Halo {nama}, poin Banana Leaf kamu sebanyak {poin} akan hangus dalam {hari} hari. Yuk tukarkan sebelum hangus! Cek & tukar poin kamu di https://bananaleaf.biz.id/member/login (login pakai nomor WhatsApp ini + PIN kamu).',
  null
),
(
  'inactive',
  'Member lama tidak belanja',
  E'Hi {nama}! Jujur deh, kami kangen banget liat kamu makan di sini 😋🍃\n\nMakanya, ada Welcome Back Bonus khusus buat kamu: 1 Jamur Enoki Cabe Garam GRATIS! 🍄🔥\n\nKode voucher kamu: {kode_voucher}\nTunjukkan kode ini ke staf kami pas kamu dine-in. Berlaku sampai {berlaku_sampai}.\n\nCatatan: Khusus dine-in & tidak bisa digabung dengan promo lainnya.\n\nSee you soon di Banana Leaf! 🍽️',
  null  -- WAJIB diisi dari menu Kelola Pesan sebelum pesan ini bisa dikirim
),
(
  'birthday',
  'Ulang tahun member',
  E'Halo {nama}, selamat ulang tahun! 🎂🍃\n\nSemua tim Banana Leaf mengucapkan selamat. Kami tunggu kamu merayakannya di sini ya!',
  null
)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Log kampanye: dicatat saat staff menekan tombol Chat WA
-- (artinya "WhatsApp-nya dibuka", bukan konfirmasi pesan benar-benar terkirim)
-- ---------------------------------------------------------------------------
create table if not exists campaign_log (
  id uuid primary key default gen_random_uuid(),
  template_key text not null,
  member_id uuid not null references members(id) on delete cascade,
  whatsapp_number text not null,
  voucher_code text,
  sent_by text,
  sent_at timestamptz not null default now()
);

create index if not exists idx_campaign_log_lookup on campaign_log(template_key, member_id, sent_at desc);
alter table campaign_log enable row level security;

-- ---------------------------------------------------------------------------
-- Voucher berkode (satu kode = satu kali pakai)
-- ---------------------------------------------------------------------------
create table if not exists vouchers (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  member_id uuid not null references members(id) on delete cascade,
  template_key text,
  valid_until date not null,
  issued_at timestamptz not null default now(),
  claimed_at timestamptz,
  claimed_by text
);

create index if not exists idx_vouchers_member on vouchers(member_id);
create index if not exists idx_vouchers_issued on vouchers(issued_at desc);
alter table vouchers enable row level security;

-- ---------------------------------------------------------------------------
-- Audit perubahan data member (siapa mengubah apa, kapan)
-- ---------------------------------------------------------------------------
create table if not exists member_audit (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members(id) on delete cascade,
  field text not null,
  old_value text,
  new_value text,
  changed_by text,
  changed_at timestamptz not null default now()
);

create index if not exists idx_member_audit_member on member_audit(member_id, changed_at desc);
alter table member_audit enable row level security;
