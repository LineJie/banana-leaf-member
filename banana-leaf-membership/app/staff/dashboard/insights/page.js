"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatDate } from "@/lib/format";
import { MONTHS_ID } from "@/lib/time";

function daysUntil(dateStr) {
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (24 * 60 * 60 * 1000)));
}

function daysSince(dateStr) {
  if (!dateStr) return null;
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diff / (24 * 60 * 60 * 1000));
}

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

// Tombol "Chat WA": server menyiapkan pesan dari template (isi variabel, buat
// voucher, catat ke log), lalu WhatsApp dibuka dengan pesan siap kirim.
function SendButton({ templateKey, memberId, problem, lastSent, onSent }) {
  const [busy, setBusy] = useState(false);

  async function send(force) {
    // Jendela dibuka sekarang (saat klik) supaya tidak diblokir browser HP,
    // lalu diarahkan ke WhatsApp setelah pesan siap.
    const popup = window.open("about:blank", "_blank");
    setBusy(true);
    try {
      const res = await fetch("/api/campaigns/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateKey, memberId, force }),
      });
      const data = await res.json();
      if (res.status === 409 && data.needConfirm && !force) {
        if (popup) popup.close();
        setBusy(false);
        if (window.confirm(`${data.error}\n\nKirim lagi?`)) {
          await send(true);
        }
        return;
      }
      if (!res.ok) {
        if (popup) popup.close();
        window.alert(data.error || "Gagal menyiapkan pesan.");
        return;
      }
      if (popup) popup.location.href = data.waUrl;
      else window.location.href = data.waUrl;
      onSent();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={() => send(false)}
        disabled={busy || Boolean(problem)}
        title={problem || ""}
        className="focus-ring rounded-lg bg-green-600 px-3 py-2 font-body text-xs text-white hover:bg-green-700 disabled:opacity-40 whitespace-nowrap"
      >
        {busy ? "Menyiapkan..." : lastSent ? "Chat WA lagi" : "Chat WA"}
      </button>
      {lastSent && (
        <span className="font-body text-[11px] text-ink/40 text-right">{sentLabel(lastSent)}</span>
      )}
    </div>
  );
}

function ProblemNotice({ problem }) {
  if (!problem) return null;
  return (
    <p className="rounded-lg border border-gold-300 bg-gold-50 px-3 py-2 font-body text-xs text-gold-800 mb-3">
      Pesan di bagian ini belum bisa dikirim: {problem}
    </p>
  );
}

export default function StaffInsights() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function load() {
    const res = await fetch("/api/staff/insights");
    if (res.status === 401) {
      router.push("/staff/login");
      return;
    }
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Gagal memuat data.");
      setLoading(false);
      return;
    }
    setData(json);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const problems = data?.templateProblems || {};
  const monthName = MONTHS_ID[new Date().getMonth()];

  return (
    <main className="min-h-screen bg-[#fbf9f4] px-4 py-6 sm:px-6 sm:py-10">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col gap-3 mb-6 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-body text-xs text-ink/40 uppercase tracking-wide">
              Banana Leaf Membership
            </p>
            <h1 className="font-display text-2xl text-ink">Member Perlu Diperhatikan</h1>
          </div>
          <Link
            href="/staff/dashboard"
            className="focus-ring font-body text-sm text-ink/50 hover:text-ink"
          >
            &larr; Kembali ke Dashboard
          </Link>
        </div>

        {loading && <p className="font-body text-sm text-ink/50">Memuat data...</p>}

        {!loading && error && <p className="font-body text-sm text-red-600">{error}</p>}

        {!loading && data && (
          <div className="flex flex-col gap-8">
            <section>
              <h2 className="font-display text-lg text-ink mb-1">
                Poin akan hangus ({data.expiryWarningDays} hari ke depan)
              </h2>
              <p className="font-body text-xs text-ink/50 mb-4">
                {data.expiringSoon.length} member dengan poin yang akan hangus.
              </p>
              <ProblemNotice problem={problems.expiring} />
              {data.expiringSoon.length === 0 && (
                <p className="font-body text-sm text-ink/40">
                  Tidak ada poin yang akan hangus dalam waktu dekat.
                </p>
              )}
              <div className="flex flex-col gap-2">
                {data.expiringSoon.map((m) => (
                  <div
                    key={m.memberId}
                    className="rounded-xl border border-ink/10 bg-white px-4 py-3 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-body text-sm text-ink">{m.name}</p>
                      <p className="font-body text-xs text-ink/40">{m.whatsappNumber}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-body text-sm text-gold-600">{m.points} poin</p>
                      <p className="font-body text-xs text-ink/40">
                        hangus {daysUntil(m.nearestExpiry)} hari lagi
                      </p>
                    </div>
                    <SendButton
                      templateKey="expiring"
                      memberId={m.memberId}
                      problem={problems.expiring}
                      lastSent={m.lastSent}
                      onSent={load}
                    />
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2 className="font-display text-lg text-ink mb-1">
                Ulang tahun bulan {monthName}
              </h2>
              <p className="font-body text-xs text-ink/50 mb-4">
                {data.birthdays.length} member berulang tahun bulan ini (hanya yang tanggal
                lahirnya sudah diisi).
              </p>
              <ProblemNotice problem={problems.birthday} />
              {data.birthdays.length === 0 && (
                <p className="font-body text-sm text-ink/40">
                  Belum ada data ulang tahun bulan ini. Tanggal lahir bisa diisi saat daftar
                  member atau lewat Edit (owner).
                </p>
              )}
              <div className="flex flex-col gap-2">
                {data.birthdays.map((m) => (
                  <div
                    key={m.memberId}
                    className={
                      "rounded-xl border bg-white px-4 py-3 flex items-center justify-between gap-3 " +
                      (m.isToday ? "border-gold-400" : "border-ink/10") +
                      (m.passed ? " opacity-60" : "")
                    }
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-body text-sm text-ink">{m.name}</p>
                      <p className="font-body text-xs text-ink/40">{m.whatsappNumber}</p>
                    </div>
                    <p className="font-body text-sm text-ink/70">
                      {m.isToday ? "Hari ini 🎂" : `${m.day} ${monthName}`}
                    </p>
                    <SendButton
                      templateKey="birthday"
                      memberId={m.memberId}
                      problem={problems.birthday}
                      lastSent={m.lastSent}
                      onSent={load}
                    />
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2 className="font-display text-lg text-ink mb-1">
                Lama tidak belanja ({data.inactiveDays}+ hari)
              </h2>
              <p className="font-body text-xs text-ink/50 mb-4">
                {data.inactive.length} member belum belanja lagi dalam {data.inactiveDays} hari
                terakhir.
              </p>
              <ProblemNotice problem={problems.inactive} />
              {data.inactive.length === 0 && (
                <p className="font-body text-sm text-ink/40">Semua member masih aktif belanja.</p>
              )}
              <div className="flex flex-col gap-2">
                {data.inactive.map((m) => (
                  <div
                    key={m.memberId}
                    className="rounded-xl border border-ink/10 bg-white px-4 py-3 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-body text-sm text-ink">{m.name}</p>
                      <p className="font-body text-xs text-ink/40">{m.whatsappNumber}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-body text-sm text-ink/70">
                        {m.lastTransactionDate
                          ? formatDate(m.lastTransactionDate)
                          : "Belum pernah belanja"}
                      </p>
                      <p className="font-body text-xs text-ink/40">
                        {m.lastTransactionDate ? `${daysSince(m.lastTransactionDate)} hari lalu` : ""}
                      </p>
                    </div>
                    <SendButton
                      templateKey="inactive"
                      memberId={m.memberId}
                      problem={problems.inactive}
                      lastSent={m.lastSent}
                      onSent={load}
                    />
                  </div>
                ))}
              </div>
            </section>

            {data.optedOutCount > 0 && (
              <p className="font-body text-xs text-ink/40">
                {data.optedOutCount} member disembunyikan karena minta berhenti dikirimi pesan.
              </p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
