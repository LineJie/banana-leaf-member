"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatLongDate } from "@/lib/time";

const TABS = [
  { value: "active", label: "Aktif" },
  { value: "claimed", label: "Sudah dipakai" },
  { value: "expired", label: "Kedaluwarsa" },
];

const STATUS_LABEL = {
  active: { text: "Aktif", cls: "text-leaf-700" },
  claimed: { text: "Sudah dipakai", cls: "text-ink/50" },
  expired: { text: "Kedaluwarsa", cls: "text-red-600" },
};

function formatDateTime(iso) {
  return new Date(iso).toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function VouchersPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [found, setFound] = useState(null);
  const [checkMsg, setCheckMsg] = useState("");
  const [claiming, setClaiming] = useState(false);

  const [tab, setTab] = useState("active");
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadList = useCallback(async () => {
    setLoading(true);
    setError("");
    const res = await fetch(`/api/vouchers?status=${tab}`);
    if (res.status === 401) {
      router.push("/staff/login");
      return;
    }
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Gagal memuat voucher.");
      setList([]);
    } else {
      setList(json.vouchers || []);
    }
    setLoading(false);
  }, [tab, router]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  async function handleCheck(e) {
    e.preventDefault();
    setCheckMsg("");
    setFound(null);
    if (!code.trim()) return;
    const res = await fetch(`/api/vouchers?code=${encodeURIComponent(code.trim())}`);
    if (res.status === 401) {
      router.push("/staff/login");
      return;
    }
    const json = await res.json();
    if (!res.ok) {
      setCheckMsg(json.error || "Gagal mengecek voucher.");
      return;
    }
    setFound(json.vouchers?.[0] || null);
  }

  async function handleClaim() {
    if (!found) return;
    if (!window.confirm(`Tandai voucher ${found.code} milik ${found.memberName} sebagai SUDAH DIPAKAI? Ini tidak bisa dibatalkan.`)) {
      return;
    }
    setClaiming(true);
    setCheckMsg("");
    const res = await fetch("/api/vouchers/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: found.code }),
    });
    const json = await res.json();
    setClaiming(false);
    if (!res.ok) {
      setCheckMsg(json.error || "Gagal menandai voucher.");
      return;
    }
    setCheckMsg(`Voucher ${json.code} berhasil ditandai sudah dipakai.`);
    setFound(null);
    setCode("");
    loadList();
  }

  return (
    <main className="min-h-screen bg-[#fbf9f4] px-4 py-6 sm:px-6 sm:py-10">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col gap-3 mb-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-body text-xs text-ink/40 uppercase tracking-wide">
              Banana Leaf Membership
            </p>
            <h1 className="font-display text-2xl text-ink">Voucher</h1>
          </div>
          <Link
            href="/staff/dashboard"
            className="focus-ring font-body text-sm text-ink/50 hover:text-ink"
          >
            &larr; Kembali ke Dashboard
          </Link>
        </div>

        <form onSubmit={handleCheck} className="rounded-xl border border-ink/10 bg-white p-4 mb-6">
          <label className="block font-body text-xs text-ink/60 mb-1">
            Cek kode voucher dari tamu
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="BL-XXXXXX"
              autoCapitalize="characters"
              className="focus-ring flex-1 rounded-lg border border-ink/15 bg-white px-4 py-2.5 font-body text-ink uppercase"
            />
            <button
              type="submit"
              className="focus-ring rounded-lg bg-leaf-700 hover:bg-leaf-800 text-white font-body text-sm font-medium px-4 py-2"
            >
              Cek
            </button>
          </div>

          {checkMsg && <p className="font-body text-sm text-ink/70 mt-3">{checkMsg}</p>}

          {found && (
            <div className="mt-3 rounded-lg border border-ink/10 px-4 py-3">
              <p className="font-body text-sm text-ink">
                <strong>{found.code}</strong> · {found.memberName}
              </p>
              <p className="font-body text-xs text-ink/50 mt-0.5">
                Berlaku sampai {formatLongDate(found.validUntil)}
              </p>
              <p className={"font-body text-sm mt-1 " + STATUS_LABEL[found.status].cls}>
                {STATUS_LABEL[found.status].text}
                {found.status === "claimed" && found.claimedAt
                  ? ` · ${formatDateTime(found.claimedAt)}${found.claimedBy ? ` oleh ${found.claimedBy}` : ""}`
                  : ""}
              </p>
              {found.status === "active" && (
                <button
                  type="button"
                  onClick={handleClaim}
                  disabled={claiming}
                  className="focus-ring mt-3 rounded-lg bg-gold-600 hover:bg-gold-700 disabled:opacity-60 text-white font-body text-sm font-medium px-4 py-2"
                >
                  {claiming ? "Memproses..." : "Tandai sudah dipakai"}
                </button>
              )}
            </div>
          )}
        </form>

        <div className="flex flex-wrap gap-2 mb-3">
          {TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={
                "focus-ring rounded-lg border px-3 py-1.5 font-body text-sm " +
                (tab === t.value
                  ? "border-leaf-700 bg-leaf-700 text-white"
                  : "border-ink/15 bg-white text-ink/70 hover:bg-ink/5")
              }
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading && <p className="font-body text-sm text-ink/50">Memuat voucher...</p>}
        {!loading && error && <p className="font-body text-sm text-red-600">{error}</p>}

        {!loading && !error && (
          <div className="rounded-xl border border-ink/10 bg-white divide-y divide-ink/10">
            {list.length === 0 && (
              <p className="font-body text-sm text-ink/40 px-4 py-4">Tidak ada voucher.</p>
            )}
            {list.map((v) => (
              <div key={v.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-body text-sm text-ink">
                    <strong>{v.code}</strong> · {v.memberName}{" "}
                    <span className="text-ink/40">· {v.whatsappNumber}</span>
                  </p>
                  <p className="font-body text-xs text-ink/50">
                    Dikirim {formatDateTime(v.issuedAt)} · berlaku sampai {formatLongDate(v.validUntil)}
                    {v.claimedAt ? ` · dipakai ${formatDateTime(v.claimedAt)}` : ""}
                    {v.claimedBy ? ` oleh ${v.claimedBy}` : ""}
                  </p>
                </div>
                <p className={"font-body text-xs shrink-0 " + STATUS_LABEL[v.status].cls}>
                  {STATUS_LABEL[v.status].text}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
