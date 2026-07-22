"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatRupiah, formatDate, daysUntil } from "@/lib/format";

export default function MemberDashboard() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [showPinForm, setShowPinForm] = useState(false);

  async function load() {
    const res = await fetch("/api/member/me");
    if (!res.ok) {
      router.push("/member/login");
      return;
    }
    setData(await res.json());
  }

  useEffect(() => {
    load();
  }, []);

  async function handleLogout() {
    await fetch("/api/member/logout", { method: "POST" });
    router.push("/");
  }

  if (!data) {
    return (
      <main className="min-h-screen bg-[#fbf9f4] flex items-center justify-center">
        <p className="font-body text-ink/50">Memuat...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#fbf9f4] px-4 py-6 sm:px-6 sm:py-10">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-6 sm:mb-8">
          <div>
            <p className="font-body text-xs text-ink/40 uppercase tracking-wide">
              Banana Leaf Membership
            </p>
            <h1 className="font-display text-2xl text-ink">{data.member.name}</h1>
          </div>
          <button
            onClick={handleLogout}
            className="focus-ring font-body text-sm text-ink/50 hover:text-ink"
          >
            Keluar
          </button>
        </div>

        <div className="rounded-2xl bg-leaf-800 p-7 text-center mb-6">
          <p className="font-body text-leaf-200/70 text-sm mb-1">Total poin kamu</p>
          <p className="font-display text-5xl text-leaf-50">{data.totalPoints}</p>
          {data.expiringSoonPoints > 0 && (
            <p className="font-body text-gold-200 text-xs mt-3">
              {data.expiringSoonPoints} poin akan hangus{" "}
              {formatDate(data.expiringSoonDate)}
            </p>
          )}
        </div>

        {data.batches.length > 0 && (
          <div className="mb-6">
            <h2 className="font-body text-sm font-medium text-ink/60 mb-2">Rincian kadaluarsa poin</h2>
            <div className="rounded-xl border border-ink/10 divide-y divide-ink/10 bg-white">
              {data.batches.map((b) => (
                <div key={b.id} className="flex items-center justify-between px-4 py-3">
                  <span className="font-body text-sm text-ink">
                    {b.points_remaining} poin
                  </span>
                  <span
                    className={
                      "font-body text-xs " +
                      (daysUntil(b.expiry_date) <= 14 ? "text-gold-600" : "text-ink/40")
                    }
                  >
                    hangus {formatDate(b.expiry_date)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mb-6">
          <h2 className="font-body text-sm font-medium text-ink/60 mb-2">Riwayat</h2>
          <div className="rounded-xl border border-ink/10 divide-y divide-ink/10 bg-white">
            {data.history.length === 0 && (
              <p className="font-body text-sm text-ink/40 px-4 py-4">Belum ada transaksi.</p>
            )}
            {data.history.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-body text-sm text-ink truncate">
                    {t.type === "earn"
                      ? `Belanja ${formatRupiah(t.amount_spent)}`
                      : t.description || "Redeem poin"}
                  </p>
                  <p className="font-body text-xs text-ink/40">{formatDate(t.created_at)}</p>
                </div>
                <span
                  className={
                    "font-body text-sm font-medium shrink-0 " +
                    (t.points > 0 ? "text-leaf-700" : "text-gold-600")
                  }
                >
                  {t.points > 0 ? "+" : ""}
                  {t.points}
                </span>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={() => setShowPinForm((s) => !s)}
          className="focus-ring font-body text-sm text-leaf-700 hover:text-leaf-900"
        >
          {showPinForm ? "Tutup" : "Ganti PIN"}
        </button>

        {showPinForm && <ChangePinForm onDone={() => setShowPinForm(false)} />}
      </div>
    </main>
  );
}

function ChangePinForm({ onDone }) {
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setMsg("");
    const res = await fetch("/api/member/change-pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPin, newPin }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Gagal ganti PIN.");
      return;
    }
    setMsg("PIN berhasil diganti.");
    setCurrentPin("");
    setNewPin("");
    setTimeout(onDone, 1200);
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-3 rounded-xl border border-ink/10 bg-white p-4">
      <div>
        <label className="block font-body text-xs text-ink/60 mb-1">PIN saat ini</label>
        <input
          type="password"
          inputMode="numeric"
          value={currentPin}
          onChange={(e) => setCurrentPin(e.target.value)}
          required
          className="focus-ring w-full rounded-lg border border-ink/15 px-3 py-2 font-body text-sm"
        />
      </div>
      <div>
        <label className="block font-body text-xs text-ink/60 mb-1">PIN baru (4-6 digit)</label>
        <input
          type="password"
          inputMode="numeric"
          value={newPin}
          onChange={(e) => setNewPin(e.target.value)}
          required
          className="focus-ring w-full rounded-lg border border-ink/15 px-3 py-2 font-body text-sm"
        />
      </div>
      {error && <p className="font-body text-xs text-red-600">{error}</p>}
      {msg && <p className="font-body text-xs text-leaf-700">{msg}</p>}
      <button
        type="submit"
        className="focus-ring rounded-lg bg-leaf-700 hover:bg-leaf-800 text-white font-body text-sm font-medium px-4 py-2"
      >
        Simpan PIN baru
      </button>
    </form>
  );
}
