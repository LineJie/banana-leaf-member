"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatDate } from "@/lib/format";
import SendButton from "@/components/WaSendButton";

const AUDIENCES = [
  { value: "all", label: "Semua member" },
  { value: "inactive", label: "Lama tidak belanja" },
];

const DAY_MS = 24 * 60 * 60 * 1000;
// Sama dengan jeda cegah-kirim-dobel di server (RESEND_COOLDOWN_DAYS = 14).
const DONE_WINDOW_DAYS = 14;

export default function BroadcastPage() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [templateKey, setTemplateKey] = useState("promo");
  const [audience, setAudience] = useState("all");
  const [onlyPending, setOnlyPending] = useState(true);
  const [search, setSearch] = useState("");

  async function load() {
    const res = await fetch("/api/staff/broadcast");
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
  }, []);

  const template = data?.templates.find((t) => t.key === templateKey);

  function isDone(m) {
    const s = m.lastSent?.[templateKey];
    return Boolean(s) && Date.now() - new Date(s.sentAt).getTime() < DONE_WINDOW_DAYS * DAY_MS;
  }

  const audienceRows = useMemo(() => {
    if (!data) return [];
    return data.members.filter((m) => (audience === "inactive" ? m.inactive : true));
  }, [data, audience]);

  const doneCount = audienceRows.filter(isDone).length;

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return audienceRows.filter((m) => {
      if (onlyPending && isDone(m)) return false;
      if (!q) return true;
      return m.name.toLowerCase().includes(q) || m.whatsappNumber.includes(q.replace(/\D/g, "") || "~");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audienceRows, onlyPending, search, templateKey]);

  function jumpToNext() {
    const el = document.querySelector("[data-pending-row='true']");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <main className="min-h-screen bg-[#fbf9f4] px-4 py-6 sm:px-6 sm:py-10">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col gap-3 mb-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-body text-xs text-ink/40 uppercase tracking-wide">
              Banana Leaf Membership
            </p>
            <h1 className="font-display text-2xl text-ink">Broadcast WhatsApp</h1>
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
          <>
            <div className="rounded-xl border border-ink/10 bg-white p-4 mb-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block font-body text-xs text-ink/60 mb-1">Pesan yang dikirim</label>
                  <select
                    value={templateKey}
                    onChange={(e) => setTemplateKey(e.target.value)}
                    className="focus-ring w-full rounded-lg border border-ink/15 bg-white px-3 py-2.5 font-body text-sm text-ink"
                  >
                    {data.templates.map((t) => (
                      <option key={t.key} value={t.key}>
                        {t.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-body text-xs text-ink/60 mb-1">Kirim ke</label>
                  <select
                    value={audience}
                    onChange={(e) => setAudience(e.target.value)}
                    className="focus-ring w-full rounded-lg border border-ink/15 bg-white px-3 py-2.5 font-body text-sm text-ink"
                  >
                    {AUDIENCES.map((a) => (
                      <option key={a.value} value={a.value}>
                        {a.value === "inactive" ? `${a.label} (${data.inactiveDays}+ hari)` : a.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari nama atau nomor member..."
                className="focus-ring w-full mt-3 rounded-lg border border-ink/15 bg-white px-3 py-2.5 font-body text-sm text-ink"
              />

              <label className="flex items-center gap-2 mt-3 font-body text-sm text-ink/70">
                <input
                  type="checkbox"
                  checked={onlyPending}
                  onChange={(e) => setOnlyPending(e.target.checked)}
                />
                Sembunyikan yang sudah dikirim ({DONE_WINDOW_DAYS} hari terakhir)
              </label>

              <p className="font-body text-xs text-ink/50 mt-3">
                Isi pesan &amp; tanggal berlaku diatur owner di <strong>Kelola Pesan WA</strong>. Tiap
                member mendapat kode voucher sendiri.
              </p>
            </div>

            {template?.problem && (
              <p className="rounded-lg border border-gold-300 bg-gold-50 px-3 py-2 font-body text-xs text-gold-800 mb-4">
                Pesan ini belum bisa dikirim: {template.problem}
              </p>
            )}

            <div className="sticky top-0 z-10 -mx-4 px-4 py-3 mb-3 bg-[#fbf9f4]/95 backdrop-blur border-b border-ink/10 flex items-center justify-between gap-3 sm:mx-0 sm:px-0">
              <p className="font-body text-sm text-ink">
                <strong>{doneCount}</strong> dari {audienceRows.length} sudah dikirim
              </p>
              <button
                onClick={jumpToNext}
                className="focus-ring rounded-lg bg-leaf-700 hover:bg-leaf-800 text-white font-body text-sm font-medium px-4 py-2 whitespace-nowrap"
              >
                Ke berikutnya ↓
              </button>
            </div>

            {rows.length === 0 && (
              <p className="font-body text-sm text-ink/40">
                {audienceRows.length > 0 && onlyPending && doneCount === audienceRows.length
                  ? "Semua member di daftar ini sudah dikirimi. 🎉"
                  : "Tidak ada member yang cocok."}
              </p>
            )}

            <div className="flex flex-col gap-2">
              {(() => {
                let firstPendingMarked = false;
                return rows.map((m) => {
                  const done = isDone(m);
                  const isFirstPending = !done && !firstPendingMarked;
                  if (isFirstPending) firstPendingMarked = true;
                  return (
                    <div
                      key={m.memberId}
                      data-pending-row={isFirstPending ? "true" : undefined}
                      className={
                        "rounded-xl border bg-white px-4 py-3 flex items-center justify-between gap-3 " +
                        (done ? "border-ink/10 opacity-60" : isFirstPending ? "border-leaf-700" : "border-ink/10")
                      }
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-body text-sm text-ink">{m.name}</p>
                        <p className="font-body text-xs text-ink/40">
                          {m.whatsappNumber}
                          {" · "}
                          {m.lastTransactionDate
                            ? `belanja terakhir ${formatDate(m.lastTransactionDate)}`
                            : "belum pernah belanja"}
                        </p>
                      </div>
                      <SendButton
                        templateKey={templateKey}
                        memberId={m.memberId}
                        problem={template?.problem}
                        lastSent={m.lastSent?.[templateKey] || null}
                        onSent={load}
                      />
                    </div>
                  );
                });
              })()}
            </div>

            {data.optedOutCount > 0 && (
              <p className="font-body text-xs text-ink/40 mt-6">
                {data.optedOutCount} member disembunyikan karena minta berhenti dikirimi pesan.
              </p>
            )}
          </>
        )}
      </div>
    </main>
  );
}
