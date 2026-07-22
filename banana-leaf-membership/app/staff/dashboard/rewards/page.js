"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RewardsPage() {
  const router = useRouter();
  const [rewards, setRewards] = useState(null);
  const [name, setName] = useState("");
  const [pointsCost, setPointsCost] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    const res = await fetch("/api/rewards?includeInactive=true");
    if (res.status === 401 || res.status === 403) {
      router.push("/staff/dashboard");
      return;
    }
    const data = await res.json();
    setRewards(data.rewards || []);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleAdd(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/rewards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, pointsCost: Number(pointsCost) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Gagal nambah hadiah.");
        return;
      }
      setName("");
      setPointsCost("");
      load();
    } finally {
      setLoading(false);
    }
  }

  async function toggleActive(reward) {
    await fetch(`/api/rewards/${reward.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !reward.active }),
    });
    load();
  }

  async function updateCost(reward, newCost) {
    const cost = Number(newCost);
    if (!cost || cost <= 0) return;
    await fetch(`/api/rewards/${reward.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pointsCost: cost }),
    });
    load();
  }

  if (!rewards) {
    return (
      <main className="min-h-screen bg-[#fbf9f4] flex items-center justify-center">
        <p className="font-body text-ink/50">Memuat...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#fbf9f4] px-4 py-6 sm:px-6 sm:py-10">
      <div className="max-w-lg mx-auto">
        <Link href="/staff/dashboard" className="font-body text-sm text-leaf-700 hover:text-leaf-900">
          ← Kembali ke dashboard
        </Link>

        <h1 className="font-display text-2xl text-ink mt-4 mb-1">Kelola Hadiah</h1>
        <p className="font-body text-sm text-ink/60 mb-6">
          Daftar hadiah ini muncul sebagai pilihan pas staff proses redeem poin member.
        </p>

        <form
          onSubmit={handleAdd}
          className="rounded-xl border border-ink/10 bg-white p-4 mb-6 space-y-3"
        >
          <p className="font-body text-sm font-medium text-ink/70">Tambah hadiah baru</p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              placeholder="Nama hadiah, mis. Diskon 20rb"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="focus-ring flex-1 rounded-lg border border-ink/15 px-3 py-2 font-body text-sm"
            />
            <input
              type="number"
              min="1"
              placeholder="Poin"
              value={pointsCost}
              onChange={(e) => setPointsCost(e.target.value)}
              required
              className="focus-ring sm:w-24 rounded-lg border border-ink/15 px-3 py-2 font-body text-sm"
            />
          </div>
          {error && <p className="font-body text-xs text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="focus-ring w-full sm:w-auto rounded-lg bg-gold-600 hover:bg-gold-700 disabled:opacity-60 text-white font-body text-sm font-medium px-4 py-2"
          >
            {loading ? "Menambah..." : "Tambah hadiah"}
          </button>
        </form>

        <div className="rounded-xl border border-ink/10 bg-white divide-y divide-ink/10">
          {rewards.length === 0 && (
            <p className="font-body text-sm text-ink/40 px-4 py-4">Belum ada hadiah.</p>
          )}
          {rewards.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <p className={"font-body text-sm text-ink flex-1 min-w-[120px] " + (!r.active ? "opacity-40" : "")}>
                {r.name}
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  defaultValue={r.points_cost}
                  onBlur={(e) => updateCost(r, e.target.value)}
                  className="focus-ring w-16 rounded-lg border border-ink/15 px-2 py-1 font-body text-sm text-center"
                />
                <button
                  onClick={() => toggleActive(r)}
                  className={
                    "focus-ring font-body text-xs px-3 py-1.5 rounded-lg border whitespace-nowrap " +
                    (r.active
                      ? "border-ink/15 text-ink/60 hover:bg-ink/5"
                      : "border-leaf-600 text-leaf-700 hover:bg-leaf-50")
                  }
                >
                  {r.active ? "Nonaktifkan" : "Aktifkan"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
