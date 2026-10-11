-- Migration 5: template pesan "Promo / Broadcast" untuk halaman Broadcast.
-- Cara pakai: Supabase Dashboard > SQL Editor > New query, paste, Run.
-- Aman dijalankan berulang kali. JALANKAN LEBIH DULU sebelum upload kode barunya.
-- Setelah itu owner mengisi isi pesan & tanggal "Berlaku sampai" di Kelola Pesan WA.

insert into message_templates (key, title, body, valid_until) values
(
  'promo',
  'Promo / Broadcast',
  E'Halo {nama}! 🍃\n\nAda promo spesial dari Banana Leaf buat kamu.\n\nKode voucher kamu: {kode_voucher}\nTunjukkan kode ini ke staf kami saat dine-in. Berlaku sampai {berlaku_sampai}.\n\nSampai ketemu di Banana Leaf! 🍽️',
  null
)
on conflict (key) do nothing;
