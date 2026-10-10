// Helper tanggal untuk zona waktu WIB (UTC+7, Indonesia tidak pakai DST).
// Server (Netlify) jalan di UTC, jadi batas "hari/minggu/bulan" harus dihitung
// manual supaya jam 00:00-07:00 WIB tidak masuk ke hari sebelumnya.

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export const MONTHS_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

// Tanggal/jam WIB dari sebuah Date, dipecah per bagian.
function wibParts(date) {
  const d = new Date(date.getTime() + WIB_OFFSET_MS);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth(), // 0-11
    day: d.getUTCDate(),
    weekday: d.getUTCDay(), // 0 = Minggu
  };
}

// Tengah malam WIB pada tanggal tsb, dalam bentuk Date (UTC).
function wibMidnight(year, month, day) {
  return new Date(Date.UTC(year, month, day) - WIB_OFFSET_MS);
}

function pad(n) {
  return String(n).padStart(2, "0");
}

// "YYYY-MM-DD" untuk hari ini di WIB.
export function todayWib(now = new Date()) {
  const p = wibParts(now);
  return `${p.year}-${pad(p.month + 1)}-${pad(p.day)}`;
}

// "15 September 2026" dari "YYYY-MM-DD".
export function formatLongDate(dateStr) {
  if (!dateStr) return "";
  const [y, m, d] = String(dateStr).split("-").map(Number);
  if (!y || !m || !d) return String(dateStr);
  return `${d} ${MONTHS_ID[m - 1]} ${y}`;
}

function formatShort(date) {
  const p = wibParts(date);
  return `${p.day} ${MONTHS_ID[p.month].slice(0, 3)} ${p.year}`;
}

function parseDateStr(str) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(str || ""));
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]) - 1;
  const day = Number(m[3]);
  const check = new Date(Date.UTC(year, month, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month || check.getUTCDate() !== day) {
    return null;
  }
  return { year, month, day };
}

export const RANGE_OPTIONS = [
  { value: "week", label: "Minggu ini" },
  { value: "month", label: "Bulan ini" },
  { value: "last30", label: "30 hari terakhir" },
  { value: "lastmonth", label: "Bulan lalu" },
  { value: "custom", label: "Pilih tanggal" },
];

// Mengubah pilihan rentang jadi batas waktu [start, end) dalam ISO (UTC).
// - week      : Senin 00:00 WIB s/d Minggu 24:00 WIB pekan ini
// - month     : tanggal 1 s/d akhir bulan ini
// - last30    : 30 hari terakhir termasuk hari ini
// - lastmonth : bulan kalender sebelumnya
// - custom    : from..to (dua-duanya inklusif), maksimal 366 hari
// Mengembalikan { error } kalau input tidak valid.
export function resolveRange(range, from, to, now = new Date()) {
  const t = wibParts(now);
  const todayStart = wibMidnight(t.year, t.month, t.day);
  let start;
  let end;

  if (range === "week") {
    const sinceMonday = (t.weekday + 6) % 7; // Senin = 0
    start = new Date(todayStart.getTime() - sinceMonday * DAY_MS);
    end = new Date(start.getTime() + 7 * DAY_MS);
  } else if (range === "month") {
    start = wibMidnight(t.year, t.month, 1);
    end = wibMidnight(t.year, t.month + 1, 1);
  } else if (range === "last30") {
    start = new Date(todayStart.getTime() - 29 * DAY_MS);
    end = new Date(todayStart.getTime() + DAY_MS);
  } else if (range === "lastmonth") {
    start = wibMidnight(t.year, t.month - 1, 1);
    end = wibMidnight(t.year, t.month, 1);
  } else if (range === "custom") {
    const f = parseDateStr(from);
    const u = parseDateStr(to);
    if (!f || !u) {
      return { error: "Tanggal tidak valid. Pilih tanggal mulai dan tanggal akhir." };
    }
    start = wibMidnight(f.year, f.month, f.day);
    end = new Date(wibMidnight(u.year, u.month, u.day).getTime() + DAY_MS);
    if (end <= start) {
      return { error: "Tanggal akhir tidak boleh sebelum tanggal mulai." };
    }
    if ((end.getTime() - start.getTime()) / DAY_MS > 366) {
      return { error: "Rentang maksimal 366 hari." };
    }
  } else {
    return { error: "Rentang waktu tidak dikenal." };
  }

  const lastDay = new Date(end.getTime() - DAY_MS);
  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    label: `${formatShort(start)} – ${formatShort(lastDay)}`,
  };
}

// Bulan (0-11) dan tanggal untuk hari ini di WIB — dipakai segmen ulang tahun.
export function wibMonthDay(now = new Date()) {
  const p = wibParts(now);
  return { month: p.month, day: p.day };
}
