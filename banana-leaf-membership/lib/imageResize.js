// Dipakai di browser (halaman owner Info Member): perkecil foto sebelum upload
// supaya ringan dibuka member di data seluler, dan muat di batas 1 MB server.
// Foto HP bisa 4-8 MB; setelah ini biasanya 100-400 KB.

const MAX_SIDE = 1280;
const MAX_BYTES = 1024 * 1024 - 16 * 1024; // sisakan sedikit ruang di bawah batas 1 MB server

async function loadBitmap(file) {
  // imageOrientation "from-image" supaya foto HP yang diputar via EXIF tidak miring.
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      /* lanjut ke fallback */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function toBlob(canvas, type, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

// Return File (webp, atau jpeg kalau browser tidak bisa encode webp).
export async function shrinkImage(file) {
  if (!file.type.startsWith("image/")) throw new Error("File yang dipilih bukan gambar.");

  const bmp = await loadBitmap(file);
  const w = bmp.width;
  const h = bmp.height;
  const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
  const cw = Math.max(1, Math.round(w * scale));
  const ch = Math.max(1, Math.round(h * scale));

  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d");
  // Latar putih supaya PNG transparan tidak jadi hitam saat jadi JPEG.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, cw, ch);
  ctx.drawImage(bmp, 0, 0, cw, ch);
  if (typeof bmp.close === "function") bmp.close();

  // Beberapa browser (Safari lama) diam-diam menghasilkan PNG kalau webp tidak
  // didukung — kita cek blob.type dan jatuh ke JPEG.
  let type = "image/webp";
  let blob = await toBlob(canvas, type, 0.82);
  if (!blob || blob.type !== "image/webp") {
    type = "image/jpeg";
    blob = await toBlob(canvas, type, 0.82);
  }
  for (const q of [0.7, 0.58, 0.45]) {
    if (blob && blob.size <= MAX_BYTES) break;
    blob = await toBlob(canvas, type, q);
  }
  if (!blob) throw new Error("Gagal memproses foto.");
  if (blob.size > MAX_BYTES) throw new Error("Foto masih terlalu besar setelah diperkecil. Coba foto lain.");

  const ext = type === "image/webp" ? "webp" : "jpg";
  return new File([blob], `info.${ext}`, { type });
}
