// Helper server-side untuk fitur "Info Member" (pengumuman + 1 foto).
// Hanya diimpor dari API routes — memakai service role lewat supabaseAdmin.

import { todayWib } from "@/lib/time";

export const BUCKET = "announcements";
export const MAX_TITLE = 80;
export const MAX_BODY = 1000;
export const MAX_BUTTON_LABEL = 30;
export const MAX_IMAGE_BYTES = 1024 * 1024; // 1 MB — sama dengan batas bucket

export const COLUMNS =
  "id, title, body, image_path, button_label, button_url, starts_on, ends_on, active, created_at, updated_at, updated_by";

function isDateStr(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
}

// Cek tipe file dari isi aslinya (magic bytes), bukan dari nama/mime kiriman
// browser. Return { ext, contentType } atau null kalau bukan webp/jpeg/png.
export function sniffImage(bytes) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { ext: "jpg", contentType: "image/jpeg" };
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
  ) {
    return { ext: "png", contentType: "image/png" };
  }
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) {
    return { ext: "webp", contentType: "image/webp" };
  }
  return null;
}

// Validasi + rapikan field teks dari FormData. Return { error } atau { fields }.
export function parseFields(form) {
  const title = String(form.get("title") || "").trim();
  const body = String(form.get("body") || "").trim();
  const buttonLabel = String(form.get("buttonLabel") || "").trim();
  const buttonUrl = String(form.get("buttonUrl") || "").trim();
  const startsOn = String(form.get("startsOn") || "").trim();
  const endsOn = String(form.get("endsOn") || "").trim();
  const active = String(form.get("active") ?? "true") !== "false";

  if (!title) return { error: "Judul wajib diisi." };
  if (title.length > MAX_TITLE) return { error: `Judul maksimal ${MAX_TITLE} karakter.` };
  if (body.length > MAX_BODY) return { error: `Isi maksimal ${MAX_BODY} karakter.` };

  if (!!buttonLabel !== !!buttonUrl) {
    return { error: "Tombol: label dan link harus diisi dua-duanya, atau kosongkan dua-duanya." };
  }
  if (buttonLabel.length > MAX_BUTTON_LABEL) {
    return { error: `Label tombol maksimal ${MAX_BUTTON_LABEL} karakter.` };
  }
  if (buttonUrl) {
    // Hanya https — mencegah link javascript: atau data: di kartu member.
    let u;
    try {
      u = new URL(buttonUrl);
    } catch {
      return { error: "Link tombol tidak valid. Contoh: https://wa.me/628xxxxxxxxxx" };
    }
    if (u.protocol !== "https:") return { error: "Link tombol harus diawali https://" };
  }

  if (startsOn && !isDateStr(startsOn)) return { error: "Tanggal mulai tidak valid." };
  if (endsOn && !isDateStr(endsOn)) return { error: "Tanggal selesai tidak valid." };
  if (startsOn && endsOn && endsOn < startsOn) {
    return { error: "Tanggal selesai tidak boleh sebelum tanggal mulai." };
  }

  return {
    fields: {
      title,
      body,
      button_label: buttonLabel || null,
      button_url: buttonUrl || null,
      starts_on: startsOn || null,
      ends_on: endsOn || null,
      active,
    },
  };
}

// Baca file dari FormData (opsional). Return { file: null } kalau tidak ada,
// { error } kalau tidak valid, atau { file: { bytes, ext, contentType } }.
export async function readImage(form) {
  const f = form.get("image");
  if (!f || typeof f === "string" || f.size === 0) return { file: null };
  if (f.size > MAX_IMAGE_BYTES) {
    return { error: "Foto terlalu besar (maksimal 1 MB). Coba pilih ulang — foto biasanya diperkecil otomatis." };
  }
  const bytes = new Uint8Array(await f.arrayBuffer());
  const type = sniffImage(bytes);
  if (!type) return { error: "Format foto harus JPG, PNG, atau WebP." };
  return { file: { bytes, ...type } };
}

export async function uploadImage(supabase, file) {
  const path = `${crypto.randomUUID()}.${file.ext}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file.bytes, { contentType: file.contentType, upsert: false });
  if (error) throw new Error(`Gagal upload foto: ${error.message}`);
  return path;
}

// Hapus file lama dari Storage. Gagal menghapus tidak boleh menggagalkan
// request (file yatim lebih baik daripada data tidak tersimpan).
export async function removeImage(supabase, path) {
  if (!path) return;
  try {
    await supabase.storage.from(BUCKET).remove([path]);
  } catch {
    /* abaikan */
  }
}

export function imageUrl(supabase, path) {
  if (!path) return null;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

// Status tampil untuk halaman owner (hari ini versi WIB).
export function announcementStatus(a, today = todayWib()) {
  if (!a.active) return "nonaktif";
  if (a.starts_on && a.starts_on > today) return "dijadwalkan";
  if (a.ends_on && a.ends_on < today) return "berakhir";
  return "tayang";
}

export function toOwnerShape(supabase, a) {
  return {
    id: a.id,
    title: a.title,
    body: a.body,
    imageUrl: imageUrl(supabase, a.image_path),
    buttonLabel: a.button_label,
    buttonUrl: a.button_url,
    startsOn: a.starts_on,
    endsOn: a.ends_on,
    active: a.active,
    status: announcementStatus(a),
    updatedAt: a.updated_at,
    updatedBy: a.updated_by,
  };
}
