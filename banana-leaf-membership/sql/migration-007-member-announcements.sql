-- Migration 7: "Info Member" — pengumuman/promo (teks + 1 foto) yang tampil di
-- dashboard member. Dikelola owner di /staff/dashboard/info.
-- Cara pakai: Supabase Dashboard > SQL Editor > New query, paste, Run.
-- Aman dijalankan berulang kali. JALANKAN LEBIH DULU sebelum upload kode barunya.

create table if not exists member_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null default '',
  -- Path file di bucket Storage "announcements" (bukan URL penuh).
  image_path text,
  -- Tombol opsional di kartu (mis. "Chat WA" / "Lihat menu"). Dua-duanya diisi atau kosong dua-duanya.
  button_label text,
  button_url text,
  -- Rentang tayang (WIB, inklusif). Kosong = tidak dibatasi di sisi itu.
  starts_on date,
  ends_on date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text
);

-- RLS dinyalain tanpa policy: tabel cuma bisa diakses lewat service role dari
-- API route (sama seperti tabel lain). Member tidak bisa query langsung.
alter table member_announcements enable row level security;

create index if not exists member_announcements_active_idx
  on member_announcements (active, starts_on, ends_on);

-- Bucket Storage untuk foto. Publik (baca) supaya <img> di dashboard member bisa
-- menampilkannya tanpa login Supabase; tulis/hapus tetap hanya lewat service role.
-- Batas 1 MB per file — foto sudah diperkecil di browser sebelum upload.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'announcements',
  'announcements',
  true,
  1048576,
  array['image/webp', 'image/jpeg', 'image/png']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
