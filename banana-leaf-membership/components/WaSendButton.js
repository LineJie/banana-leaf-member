"use client";

import { useState } from "react";

function sentLabel(lastSent) {
  if (!lastSent) return null;
  const d = new Date(lastSent.sentAt);
  const label = d.toLocaleDateString("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "numeric",
    month: "short",
  });
  return `Sudah dikirim ${label}${lastSent.sentBy ? ` oleh ${lastSent.sentBy}` : ""}`;
}

// Tombol WA dua langkah:
//   1) "Chat WA"      -> server menyiapkan pesan (isi variabel, buat voucher, catat log)
//   2) "Buka WhatsApp" -> link asli (<a>) yang diketuk staff.
// Kenapa dua langkah: browser HP/PWA sering memblokir window.open / redirect yang
// dipanggil SETELAH proses async (fetch). Link yang diketuk langsung oleh staff tidak
// pernah diblokir, jadi pasti terbuka ke WhatsApp.
export default function WaSendButton({ templateKey, memberId, problem, lastSent, onSent }) {
  const [busy, setBusy] = useState(false);
  const [waUrl, setWaUrl] = useState("");
  const [opened, setOpened] = useState(false);
  const [error, setError] = useState("");

  async function prepare(force) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/campaigns/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateKey, memberId, force }),
      });
      const data = await res.json();
      if (res.status === 409 && data.needConfirm && !force) {
        setBusy(false);
        if (window.confirm(`${data.error}\n\nKirim lagi?`)) {
          await prepare(true);
        }
        return;
      }
      if (!res.ok) {
        setError(data.error || "Gagal menyiapkan pesan.");
        return;
      }
      setOpened(false);
      setWaUrl(data.waUrl);
    } catch {
      setError("Koneksi bermasalah. Coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  function handleOpened() {
    setOpened(true);
    // Beri jeda singkat supaya link sempat terbuka sebelum daftar dimuat ulang.
    setTimeout(() => {
      setWaUrl("");
      if (onSent) onSent();
    }, 600);
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {waUrl ? (
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleOpened}
          className="focus-ring rounded-lg bg-green-700 px-3 py-2 font-body text-xs font-medium text-white hover:bg-green-800 whitespace-nowrap"
        >
          {opened ? "Membuka..." : "Buka WhatsApp ↗"}
        </a>
      ) : (
        <button
          onClick={() => prepare(false)}
          disabled={busy || Boolean(problem)}
          title={problem || ""}
          className="focus-ring rounded-lg bg-green-600 px-3 py-2 font-body text-xs text-white hover:bg-green-700 disabled:opacity-40 whitespace-nowrap"
        >
          {busy ? "Menyiapkan..." : lastSent ? "Chat WA lagi" : "Chat WA"}
        </button>
      )}
      {error && <span className="font-body text-[11px] text-red-600 text-right max-w-[180px]">{error}</span>}
      {!waUrl && lastSent && (
        <span className="font-body text-[11px] text-ink/40 text-right">{sentLabel(lastSent)}</span>
      )}
    </div>
  );
}
