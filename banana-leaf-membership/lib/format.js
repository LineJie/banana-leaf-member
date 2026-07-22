export function formatRupiah(amount) {
  const n = Number(amount) || 0;
  return "Rp" + n.toLocaleString("id-ID");
}

export function formatDate(isoString) {
  if (!isoString) return "-";
  return new Date(isoString).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function daysUntil(isoString) {
  const diff = new Date(isoString).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
