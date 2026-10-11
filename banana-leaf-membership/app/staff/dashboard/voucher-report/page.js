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

const KIND_LABEL = { single: "1 orang", shared: "Banyak orang" };

export default function VoucherReportPage() {
  const router = useRouter();
  const [range, setRange] = useState("month");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");

  const qs = useMemo(() => {
    const p = new URLSearchParams({ range });
    if (range === "custom") {
      p.set("from", from);
      p.set("to", to);
    }
    return p;
  }, [range, from, to]);

  useEffect(() => {
    if (range === "custom" && (!from || !to)) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      const res = await fetch(`/api/vouchers/report?${qs.toString()}`);
      if (res.status === 401) {
        router.push("/staff/login");
        return;
      }
      const json = await res.json();
      if (cancelled) return;
      if (!res.ok) {
        setError(json.error || "Gagal memuat laporan.");
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
  }, [qs, range, from, to, router]);

  const visibleItems = useMemo(() => {
    if (!data) return [];
    const q = filter.trim().toLowerCase();
    if (!q) return data.items;
    let digits = q.replace(/[^0-9]/g, "");
    if (digits.startsWith("0")) digits = "62" + digits.slice(1);
    return data.items.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        i.code.toLowerCase().includes(q) ||
        (i.description || "").toLowerCase().includes(q) ||
        (digits.length >= 3 && i.whatsappNumber.includes(digits))
    );
  }, [data, filter]);

  const csvHref = `/api/vouchers/report?${new URLSearchParams([...qs.entries(), ["format", "csv"]]).toString()}`;
  const canDownload = !(range === "custom" && (!from || !to));

  return (
    <main className="min-h-screen bg-[#fbf9f4] px-4 py-6 sm:px-6 sm:py-10">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col gap-3 mb-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-body text-xs text-ink/40 uppercase tracking-wide">
              Banana Leaf Membership
            </p>
            <h1 className="font-display text-2xl text-ink">Laporan Voucher</h1>
          </div>
          <Link
            href="/staff/dashboard/vouchers"
            className="focus-ring font-body text-sm text-ink/50 hover:text-ink"
          >
            &larr; Kembali ke Voucher
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-4">
          {RANGE_OPTIONS.map((r) => (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              className={
                "focus-ring rounded-lg border px-3 py-1.5 font-body text-sm " +
                (range === r.value
                  ? "border-leaf-700 bg-leaf-700 text-white"
                  : "border-ink/15 bg-white text-ink/70 hover:bg-ink/5")
              }
            >
              {r.label}
            </button>
          ))}
        </div>

        {range === "custom" && (
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="focus-ring rounded-lg border border-ink/15 bg-white px-3 py-2 font-body text-sm text-ink"
            />
            <span className="font-body text-sm text-ink/50">s/d</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="focus-ring rounded-lg border border-ink/15 bg-white px-3 py-2 font-body text-sm text-ink"
            />
          </div>
        )}

        {loading && <p className="font-body text-sm text-ink/50">Memuat laporan...</p>}
        {!loading && error && <p className="font-body text-sm text-red-600">{error}</p>}
        {!loading && !error && range === "custom" && (!from || !to) && (
          <p className="font-body text-sm text-ink/50">Pilih tanggal mulai dan tanggal akhir.</p>
        )}

        {!loading && data && (
          <>
            <p className="font-body text-xs text-ink/50 mb-3">Periode: {data.range.label}</p>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-6">
              {[
                { label: "Voucher dipakai", value: data.totalUses },
                { label: "Member berbeda", value: data.uniqueMembers },
                {
                  label: "Voucher dibuat",
                  value: data.createdTotal,
                  sub: `${data.createdSingle} untuk 1 orang · ${data.createdShared} banyak orang`,
                },
              ].map((c) => (
                <div key={c.label} className="rounded-xl border border-ink/10 bg-white px-4 py-3">
                  <p className="font-body text-xs text-ink/50">{c.label}</p>
                  <p className="font-display text-2xl text-ink mt-0.5">{c.value}</p>
                  {c.sub && <p className="font-body text-[11px] text-ink/40 mt-0.5">{c.sub}</p>}
                </div>
              ))}
            </div>

            {data.truncated && (
              <p className="rounded-lg border border-gold-300 bg-gold-50 px-3 py-2 font-body text-xs text-gold-800 mb-4">
                Data terlalu banyak, hanya sebagian yang dimuat. Persempit periode supaya lengkap.
              </p>
            )}

            <h2 className="font-display text-lg text-ink mb-2">Per voucher</h2>
            <div className="rounded-xl border border-ink/10 bg-white divide-y divide-ink/10 mb-6">
              {data.byVoucher.length === 0 && (
                <p className="font-body text-sm text-ink/40 px-4 py-4">
                  Belum ada voucher yang dipakai di periode ini.
                </p>
              )}
              {data.byVoucher.map((v) => (
                <div key={v.voucherId} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="font-body text-sm text-ink">
                      <strong>{v.code}</strong>{" "}
                      <span className="text-ink/40">· {KIND_LABEL[v.kind] || v.kind}</span>
                    </p>
                    {v.description && <p className="font-body text-xs text-ink/60">🎁 {v.description}</p>}
                  </div>
                  <p className="font-body text-sm text-ink shrink-0">{v.count}x</p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <h2 className="font-display text-lg text-ink">Rincian pemakaian</h2>
              {canDownload && data.items.length > 0 && (
                <a
                  href={csvHref}
                  className="focus-ring rounded-lg border border-ink/15 bg-white px-3 py-1.5 font-body text-sm text-ink hover:bg-ink/5"
                >
                  Unduh CSV
                </a>
              )}
            </div>

            {data.items.length > 0 && (
              <input
                type="search"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Cari nama, nomor WA, atau kode..."
                className="focus-ring w-full mb-3 rounded-lg border border-ink/15 bg-white px-3 py-2.5 font-body text-sm text-ink"
              />
            )}

            <div className="rounded-xl border border-ink/10 bg-white divide-y divide-ink/10">
              {visibleItems.length === 0 && (
                <p className="font-body text-sm text-ink/40 px-4 py-4">Tidak ada data.</p>
              )}
              {visibleItems.map((i, idx) => (
                <div key={`${i.voucherId}-${i.memberId}-${idx}`} className="px-4 py-3">
                  <p className="font-body text-sm text-ink">
                    <strong>{i.name}</strong> <span className="text-ink/40">· {i.whatsappNumber}</span>
                  </p>
                  <p className="font-body text-xs text-ink/50">
                    {i.code}
                    {i.description ? ` · ${i.description}` : ""} · {formatDateTime(i.usedAt)}
                    {i.usedBy ? ` · dicatat ${i.usedBy}` : ""}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
