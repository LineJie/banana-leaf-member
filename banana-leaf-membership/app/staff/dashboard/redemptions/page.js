"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { RANGE_OPTIONS } from "@/lib/time";

function formatDateTime(iso) {
  return new Date(iso).toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function RedemptionsPage() {
  const router = useRouter();
  const [range, setRange] = useState("month");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");

  useEffect(() => {
    if (range === "custom" && (!from || !to)) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      const qs = new URLSearchParams({ range });
      if (range === "custom") {
        qs.set("from", from);
        qs.set("to", to);
      }
      const res = await fetch(`/api/staff/redemptions?${qs.toString()}`);
      if (res.status === 401) {
        router.push("/staff/login");
        return;
      }
      const json = await res.json();
      if (cancelled) return;
      if (!res.ok) {
        setError(json.error || "Gagal memuat data.");
        setData(null);
      } else {
        setData(json);
      }
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [range, from, to, router]);

  const visibleItems = useMemo(() => {
    if (!data) return [];
    const q = filter.trim().toLowerCase();
    if (!q) return data.items;
    let digits = q.replace(/[^0-9]/g, "");
    if (digits.startsWith("0")) digits = "62" + digits.slice(1);
    return data.items.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        (digits.length >= 3 && i.whatsappNumber.includes(digits)) ||
        i.reward.toLowerCase().includes(q)
    );
  }, [data, filter]);

  return (
    <main className="min-h-screen bg-[#fbf9f4] px-4 py-6 sm:px-6 sm:py-10">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col gap-3 mb-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-body text-xs text-ink/40 uppercase tracking-wide">
              Banana Leaf Membership
            </p>
            <h1 className="font-display text-2xl text-ink">Penukaran Hadiah</h1>
          </div>
          <Link
            href="/staff/dashboard"
            className="focus-ring font-body text-sm text-ink/50 hover:text-ink"
          >
            &larr; Kembali ke Dashboard
          </Link>
        </div>

        <div className="flex flex-wrap gap-2 mb-3">
          {RANGE_OPTIONS.map((o) => (
            <button
              key={o.value}
              onClick={() => setRange(o.value)}
              className={
                "focus-ring rounded-lg border px-3 py-1.5 font-body text-sm " +
                (range === o.value
                  ? "border-leaf-700 bg-leaf-700 text-white"
                  : "border-ink/15 bg-white text-ink/70 hover:bg-ink/5")
              }
            >
              {o.label}
            </button>
          ))}
        </div>

        {range === "custom" && (
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="focus-ring rounded-lg border border-ink/15 bg-white px-3 py-1.5 font-body text-sm"
            />
            <span className="font-body text-sm text-ink/50">sampai</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="focus-ring rounded-lg border border-ink/15 bg-white px-3 py-1.5 font-body text-sm"
            />
          </div>
        )}

        {loading && <p className="font-body text-sm text-ink/50">Memuat data...</p>}
        {!loading && error && <p className="font-body text-sm text-red-600">{error}</p>}

        {!loading && data && (
          <div>
            <p className="font-body text-xs text-ink/50 mb-3">Periode: {data.range.label} (WIB)</p>

            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="rounded-xl border border-ink/10 bg-white px-4 py-3">
                <p className="font-display text-2xl text-leaf-700">{data.totalRedemptions}</p>
                <p className="font-body text-xs text-ink/50">penukaran</p>
              </div>
              <div className="rounded-xl border border-ink/10 bg-white px-4 py-3">
                <p className="font-display text-2xl text-leaf-700">{data.uniqueMembers}</p>
                <p className="font-body text-xs text-ink/50">member berbeda</p>
              </div>
              <div className="rounded-xl border border-ink/10 bg-white px-4 py-3">
                <p className="font-display text-2xl text-gold-600">{data.totalPoints}</p>
                <p className="font-body text-xs text-ink/50">poin dipakai</p>
              </div>
            </div>

            {data.byReward.length > 0 && (
              <div className="mb-6">
                <h2 className="font-body text-sm font-medium text-ink/60 mb-2">Per hadiah</h2>
                <div className="rounded-xl border border-ink/10 bg-white divide-y divide-ink/10">
                  {data.byReward.map((r) => (
                    <div key={r.reward} className="flex items-center justify-between px-4 py-2.5">
                      <span className="font-body text-sm text-ink">{r.reward}</span>
                      <span className="font-body text-sm text-ink/60">
                        {r.count}x · {r.points} poin
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between mb-2 gap-3">
              <h2 className="font-body text-sm font-medium text-ink/60">Siapa saja</h2>
              <input
                type="text"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Cari nama / nomor / hadiah"
                className="focus-ring w-56 max-w-full rounded-lg border border-ink/15 bg-white px-3 py-1.5 font-body text-sm"
              />
            </div>

            {data.truncated && (
              <p className="font-body text-xs text-gold-700 mb-2">
                Data sangat banyak, hanya 1000 penukaran terbaru yang ditampilkan. Pilih rentang
                yang lebih pendek.
              </p>
            )}

            <div className="rounded-xl border border-ink/10 bg-white divide-y divide-ink/10">
              {visibleItems.length === 0 && (
                <p className="font-body text-sm text-ink/40 px-4 py-4">
                  {data.items.length === 0
                    ? "Belum ada penukaran hadiah di periode ini."
                    : "Tidak ada yang cocok dengan pencarian."}
                </p>
              )}
              {visibleItems.map((i) => (
                <div key={i.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className={"min-w-0 flex-1 " + (i.voided ? "opacity-50" : "")}>
                    <p className={"font-body text-sm text-ink " + (i.voided ? "line-through" : "")}>
                      {i.name} <span className="text-ink/40">· {i.whatsappNumber}</span>
                    </p>
                    <p className="font-body text-xs text-ink/50">
                      {i.reward} · {formatDateTime(i.createdAt)}
                      {i.createdBy ? ` · oleh ${i.createdBy}` : ""}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-body text-sm text-gold-600">{i.points} poin</p>
                    {i.voided && (
                      <p className="font-body text-xs text-red-600">Dibatalkan</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
