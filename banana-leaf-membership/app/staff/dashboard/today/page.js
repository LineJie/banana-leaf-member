"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatRupiah } from "@/lib/format";

function formatTime(isoString) {
  if (!isoString) return "-";
  return new Date(isoString).toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function typeLabel(type) {
  if (type === "earn") return "Belanja";
  if (type === "redeem") return "Redeem";
  if (type === "void") return "Void";
  return type;
}

export default function StaffToday() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/staff/today");
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
    load();
  }, [router]);

  return (
    <main className="min-h-screen bg-[#fbf9f4] px-4 py-6 sm:px-6 sm:py-10">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col gap-3 mb-6 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-body text-xs text-ink/40 uppercase tracking-wide">
              Banana Leaf Membership
            </p>
            <h1 className="font-display text-2xl text-ink">Input Hari Ini</h1>
          </div>
          <Link
            href="/staff/dashboard"
            className="focus-ring font-body text-sm text-ink/50 hover:text-ink"
          >
            &larr; Kembali ke Dashboard
          </Link>
        </div>

        {loading && (
          <p className="font-body text-sm text-ink/50">Memuat data...</p>
        )}

        {!loading && error && (
          <p className="font-body text-sm text-red-600">{error}</p>
        )}

        {!loading && data && (
          <div className="flex flex-col gap-8">
            <section>
              <h2 className="font-display text-lg text-ink mb-1">
                Member baru hari ini
              </h2>
              <p className="font-body text-xs text-ink/50 mb-4">
                {data.newMembers.length} member baru didaftarkan hari ini.
              </p>
              {data.newMembers.length === 0 && (
                <p className="font-body text-sm text-ink/40">
                  Belum ada member baru yang didaftarkan hari ini.
                </p>
              )}
              <div className="flex flex-col gap-2">
                {data.newMembers.map((m) => (
                  <div
                    key={m.id}
                    className="rounded-xl border border-ink/10 bg-white px-4 py-3 flex items-center justify-between"
                  >
                    <div>
                      <p className="font-body text-sm text-ink">{m.name}</p>
                      <p className="font-body text-xs text-ink/40">
                        {m.whatsapp_number}
                      </p>
                    </div>
                    <p className="font-body text-xs text-ink/40">
                      {formatTime(m.created_at)}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2 className="font-display text-lg text-ink mb-1">
                Transaksi hari ini
              </h2>
              <p className="font-body text-xs text-ink/50 mb-4">
                {data.todayTransactions.length} transaksi tercatat hari ini.
              </p>
              {data.todayTransactions.length === 0 && (
                <p className="font-body text-sm text-ink/40">
                  Belum ada transaksi yang tercatat hari ini.
                </p>
              )}
              <div className="flex flex-col gap-2">
                {data.todayTransactions.map((t) => (
                  <div
                    key={t.id}
                    className="rounded-xl border border-ink/10 bg-white px-4 py-3 flex items-center justify-between"
                  >
                    <div>
                      <p className="font-body text-sm text-ink">{t.name}</p>
                      <p className="font-body text-xs text-ink/40">
                        {t.whatsappNumber} &middot; {typeLabel(t.type)}
                        {t.createdBy ? ` \u00b7 oleh ${t.createdBy}` : ""}
                      </p>
                      {t.description && (
                        <p className="font-body text-xs text-ink/40">
                          {t.description}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-body text-sm text-gold-600">
                        {t.type === "earn"
                          ? formatRupiah(t.amountSpent)
                          : `${t.points > 0 ? "+" : ""}${t.points} poin`}
                      </p>
                      <p className="font-body text-xs text-ink/40">
                        {formatTime(t.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
