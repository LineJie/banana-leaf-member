// Logika bersama untuk pesan WA (template, voucher). Hanya dipakai di server.
import { randomInt } from "crypto";
import { needsValidity } from "@/lib/template";
import { todayWib } from "@/lib/time";

export const RESEND_COOLDOWN_DAYS = 14;
export const EXPIRY_WARNING_DAYS = 10;

// Kalau template belum siap dikirim (mis. tanggal berlaku kosong/sudah lewat),
// kembalikan pesan alasannya; kalau siap, kembalikan null.
export function templateProblem(template) {
  if (!template) return "Template pesan tidak ditemukan.";
  if (needsValidity(template.body)) {
    if (!template.valid_until) {
      return "Tanggal 'Berlaku sampai' belum diisi. Minta owner mengisinya di Kelola Pesan WA.";
    }
    if (String(template.valid_until) < todayWib()) {
      return "Promo di template ini sudah lewat masa berlakunya. Minta owner memperbarui tanggalnya di Kelola Pesan WA.";
    }
  }
  return null;
}

// Tanpa huruf/angka yang mudah tertukar (0/O, 1/I).
const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export function generateVoucherCode() {
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return `BL-${out}`;
}

// Pakai ulang voucher yang masih aktif untuk member & template yang sama,
// supaya kirim ulang pesan tidak menghasilkan banyak voucher.
export async function getOrCreateVoucher({ supabase, memberId, templateKey, validUntil }) {
  const { data: existing, error: findErr } = await supabase
    .from("vouchers")
    .select("code, valid_until")
    .eq("member_id", memberId)
    .eq("template_key", templateKey)
    .eq("valid_until", validUntil)
    .is("claimed_at", null)
    .limit(1)
    .maybeSingle();
  if (findErr) throw findErr;
  if (existing) return existing.code;

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateVoucherCode();
    const { error } = await supabase.from("vouchers").insert({
      code,
      member_id: memberId,
      template_key: templateKey,
      valid_until: validUntil,
    });
    if (!error) return code;
    if (error.code !== "23505") throw error; // bukan bentrok kode unik
  }
  throw new Error("Gagal membuat kode voucher unik. Coba lagi.");
}

// "k7m2qx", "BL K7M2QX", "BL-K7M2QX" -> "BL-K7M2QX"
export function normalizeVoucherCode(raw) {
  const cleaned = String(raw || "").trim().toUpperCase().replace(/\s+/g, "");
  if (!cleaned) return "";
  const body = cleaned.replace(/^BL-?/, "");
  return body ? `BL-${body}` : "";
}

// Kode buatan owner (mis. "BANANA10"). Awalan "BL-" ditambahkan otomatis, jadi
// owner menulis kodenya TANPA "BL". Badan kode yang diawali "BL" ditolak karena
// normalisasi membuang awalan "BL" (mis. "BLUE10" akan terbaca "BL-UE10").
// Mengembalikan { code } kalau valid, atau { error } kalau tidak.
export function parseCustomCode(raw) {
  const body = String(raw || "").trim().toUpperCase().replace(/\s+/g, "");
  if (!body) return { error: "Kode kosong." };
  if (body.startsWith("BL")) {
    return { error: "Tulis kode tanpa awalan BL (contoh: BANANA10). Awalan BL- ditambahkan otomatis." };
  }
  if (!/^[A-Z0-9]{3,20}$/.test(body)) {
    return { error: "Kode hanya boleh huruf dan angka, 3-20 karakter (tanpa spasi atau simbol)." };
  }
  return { code: `BL-${body}` };
}
