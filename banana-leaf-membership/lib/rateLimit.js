// Proteksi brute-force sederhana buat login staff & member. Nyimpen hitungan
// gagal login per identifier (nomor WA atau username staff) di tabel
// login_attempts. Setelah beberapa kali gagal berturut-turut, dikunci
// sementara.

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

export async function checkLoginLock(supabase, identifier) {
  const { data } = await supabase
    .from("login_attempts")
    .select("*")
    .eq("identifier", identifier)
    .maybeSingle();

  if (data && data.locked_until && new Date(data.locked_until) > new Date()) {
    const minutesLeft = Math.ceil(
      (new Date(data.locked_until).getTime() - Date.now()) / 60000
    );
    return {
      locked: true,
      message: `Terlalu banyak percobaan gagal. Coba lagi dalam ${minutesLeft} menit.`,
    };
  }

  return { locked: false };
}

export async function recordFailedAttempt(supabase, identifier) {
  const { data: existing } = await supabase
    .from("login_attempts")
    .select("*")
    .eq("identifier", identifier)
    .maybeSingle();

  const failedCount = (existing?.failed_count || 0) + 1;
  const lockedUntil =
    failedCount >= MAX_ATTEMPTS
      ? new Date(Date.now() + LOCK_MINUTES * 60000).toISOString()
      : existing?.locked_until || null;

  await supabase.from("login_attempts").upsert(
    {
      identifier,
      failed_count: failedCount,
      locked_until: lockedUntil,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "identifier" }
  );
}

export async function resetAttempts(supabase, identifier) {
  await supabase.from("login_attempts").delete().eq("identifier", identifier);
}
