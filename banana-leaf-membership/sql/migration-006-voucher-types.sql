-- Migration 6: dua jenis voucher.
--   'single' = kode khusus 1 member, sekali pakai (seperti sebelumnya)
--   'shared' = 1 kode untuk banyak orang; tiap member boleh pakai 1x, batas total opsional
-- Cara pakai: Supabase Dashboard > SQL Editor > New query, paste, Run.
-- Aman dijalankan berulang kali; voucher lama otomatis jadi 'single'.
-- JALANKAN LEBIH DULU sebelum upload kode barunya ke GitHub.

alter table vouchers add column if not exists kind text not null default 'single';
alter table vouchers add column if not exists description text;   -- isi/keterangan voucher, mis. "Gratis Jamur Enoki"
alter table vouchers add column if not exists max_uses integer;   -- khusus 'shared': batas total pemakaian (kosong = tanpa batas)
alter table vouchers add column if not exists created_by text;    -- username owner yang membuat manual

-- Voucher 'shared' tidak terikat ke satu member.
alter table vouchers alter column member_id drop not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'vouchers_kind_check') then
    alter table vouchers add constraint vouchers_kind_check check (kind in ('single', 'shared'));
  end if;
end $$;

-- Catatan pemakaian voucher 'shared': satu baris per member per voucher.
create table if not exists voucher_redemptions (
  id uuid primary key default gen_random_uuid(),
  voucher_id uuid not null references vouchers(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  redeemed_at timestamptz not null default now(),
  redeemed_by text,
  unique (voucher_id, member_id)
);

create index if not exists idx_voucher_redemptions_voucher on voucher_redemptions(voucher_id);
alter table voucher_redemptions enable row level security;
