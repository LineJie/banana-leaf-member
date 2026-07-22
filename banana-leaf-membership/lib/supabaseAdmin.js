import { createClient } from "@supabase/supabase-js";

// PENTING: file ini hanya boleh dipakai di server (API routes / server components).
// Service role key bisa baca-tulis semua data tanpa batasan, jadi jangan pernah
// diimpor di komponen client atau dikirim ke browser.
let cachedClient = null;

export function supabaseAdmin() {
  if (cachedClient) return cachedClient;

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Supabase belum dikonfigurasi. Pastikan SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY sudah diisi di environment variables."
    );
  }

  cachedClient = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return cachedClient;
}
