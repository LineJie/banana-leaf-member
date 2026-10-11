// Template pesan WA dengan variabel {nama}, {poin}, dst.
// File ini murni logika (tanpa database) jadi aman dipakai di server maupun browser.

export const TEMPLATE_KEYS = ["expiring", "inactive", "birthday", "promo"];

// Variabel yang boleh dipakai di tiap template. Variabel di luar daftar ini
// ditolak saat disimpan, supaya salah ketik seperti {name} tidak ikut terkirim
// ke member sebagai teks mentah.
export const ALLOWED_VARS = {
  expiring: ["nama", "poin", "hari", "berlaku_sampai", "kode_voucher"],
  inactive: ["nama", "berlaku_sampai", "kode_voucher"],
  birthday: ["nama", "berlaku_sampai", "kode_voucher"],
  promo: ["nama", "berlaku_sampai", "kode_voucher"],
};

export const VAR_HELP = {
  nama: "nama member",
  poin: "jumlah poin yang akan hangus",
  hari: "berapa hari lagi poin hangus",
  berlaku_sampai: "tanggal berlaku (diisi di kolom 'Berlaku sampai')",
  kode_voucher: "kode voucher unik per member (dibuat otomatis saat dikirim)",
};

export const MAX_BODY_LENGTH = 800;

export function findVars(body) {
  const found = new Set();
  for (const m of String(body || "").matchAll(/\{([a-zA-Z_]+)\}/g)) {
    found.add(m[1]);
  }
  return Array.from(found);
}

// Mengembalikan pesan error (string) kalau template tidak valid, atau null kalau OK.
export function validateTemplateBody(key, body) {
  if (!TEMPLATE_KEYS.includes(key)) return "Jenis template tidak dikenal.";
  const text = String(body || "");
  if (!text.trim()) return "Isi pesan tidak boleh kosong.";
  if (text.length > MAX_BODY_LENGTH) {
    return `Isi pesan terlalu panjang (maksimal ${MAX_BODY_LENGTH} karakter).`;
  }
  const allowed = ALLOWED_VARS[key];
  const unknown = findVars(text).filter((v) => !allowed.includes(v));
  if (unknown.length > 0) {
    return `Variabel tidak dikenal: ${unknown.map((v) => `{${v}}`).join(", ")}. Yang boleh dipakai: ${allowed
      .map((v) => `{${v}}`)
      .join(", ")}.`;
  }
  return null;
}

export function renderTemplate(body, values) {
  return String(body || "").replace(/\{([a-zA-Z_]+)\}/g, (whole, name) =>
    Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : whole
  );
}

export function needsValidity(body) {
  const vars = findVars(body);
  return vars.includes("berlaku_sampai") || vars.includes("kode_voucher");
}
