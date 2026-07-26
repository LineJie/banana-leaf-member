"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatDate } from "@/lib/format";

export default function StaffInsights() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
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
    load();
  }, [router]);

  function daysUntil(dateStr) {
    const diff = new Date(dateStr).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (24 * 60 * 60 * 1000)));
  }

  function daysSince(dateStr) {
    if (!dateStr) return null;
    const diff = Date.now() - new Date(dateStr).getTime();
    return Math.floor(diff / (24 * 60 * 60 * 1000));
  }

  function waLink(m) {
      const message = `Halo ${m.name}, poin Banana Leaf kamu sebanyak ${m.points} akan hangus dalam ${daysUntil(m.nearestExpiry)} hari. Yuk tukarkan sebelum hangus! Cek & tukar poin kamu di https://bananaleaf-member.netlify.app/member/login (login pakai nomor WhatsApp ini + PIN kamu).`;
      return `https://wa.me/${m.whatsappNumber}?text=${encodeURIComponent(message)}`;
  }

  function waLinkInactive(m) { const message = `Hi ${m.name}! Jujur deh, kami kangen banget liat kamu makan di sini 😋🍃\n\nMakanya, ada Welcome Back Bonus khusus buat kamu: 1 Jamur Enoki Cabe Garam GRATIS! 🍄🔥\n\nTinggal tunjukin chat ini ke staf kami pas kamu dine-in. Jangan sampai ketinggalan ya, voucher ini cuma bisa diklaim sampai 15 Agustus 2026!\n\nCatatan: Khusus dine-in & tidak bisa digabung dengan promo lainnya.\n\nSee you soon di Banana Leaf! 🍽️`; return `https://wa.me/${m.whatsappNumber}?text=${encodeURIComponent(message)}`; }

  return (
    <main className="min-h-screen bg-[#fbf9f4] px-4 py-6 sm:px-6 sm:py-10">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col gap-3 mb-6 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-body text-xs text-ink/40 uppercase tracking-wide">
              Banana Leaf Membership
            </p>
            <h1 className="font-display text-2xl text-ink">
              Member Perlu Diperhatikan
            </h1>
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
                Poin akan hangus ({data.expiryWarningDays} hari ke depan)
              </h2>
              <p className="font-body text-xs text-ink/50 mb-4">
                {data.expiringSoon.length} member dengan poin yang akan hangus.
              </p>
              {data.expiringSoon.length === 0 && (
                <p className="font-body text-sm text-ink/40">
                  Tidak ada poin yang akan hangus dalam waktu dekat.
                </p>
              )}
              <div className="flex flex-col gap-2">
                {data.expiringSoon.map((m) => (
                  <div
                    key={m.memberId}
                    className="rounded-xl border border-ink/10 bg-white px-4 py-3 flex items-center justify-between"
                  >
                    <div>
                      <p className="font-body text-sm text-ink">{m.name}</p>
                      <p className="font-body text-xs text-ink/40">
                        {m.whatsappNumber}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-body text-sm text-gold-600">
                        {m.points} poin
                      </p>
                      <p className="font-body text-xs text-ink/40">
                        hangus {daysUntil(m.nearestExpiry)} hari lagi
                      </p>
                    </div>
                      <a href={waLink(m)} target="_blank" rel="noopener noreferrer" className="focus-ring rounded-lg bg-green-600 px-3 py-2 font-body text-xs text-white hover:bg-green-700 whitespace-nowrap">Chat WA</a>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2 className="font-display text-lg text-ink mb-1">
                Lama tidak belanja ({data.inactiveDays}+ hari)
              </h2>
              <p className="font-body text-xs text-ink/50 mb-4">
                {data.inactive.length} member belum belanja lagi dalam {data.inactiveDays} hari terakhir.
              </p>
              {data.inactive.length === 0 && (
                <p className="font-body text-sm text-ink/40">
                  Semua member masih aktif belanja.
                </p>
              )}
              <div className="flex flex-col gap-2">
                {data.inactive.map((m) => (
                  <div
                    key={m.memberId}
                    className="rounded-xl border border-ink/10 bg-white px-4 py-3 flex items-center justify-between"
                  >
                    <div>
                      <p className="font-body text-sm text-ink">{m.name}</p>
                      <p className="font-body text-xs text-ink/40">
                        {m.whatsappNumber}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-body text-sm text-ink/70">
                        {m.lastTransactionDate
                          ? formatDate(m.lastTransactionDate)
                          : "Belum pernah belanja"}
                      </p>
                      <p className="font-body text-xs text-ink/40">
                        {m.lastTransactionDate
                          ? `${daysSince(m.lastTransactionDate)} hari lalu`
                          : ""}
                      </p>
                    </div>
                        <a href={waLinkInactive(m)} target="_blank" rel="noopener noreferrer" className="focus-ring rounded-lg bg-green-600 px-3 py-2 font-body text-xs text-white hover:bg-green-700 whitespace-nowrap">Chat WA</a>
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
