"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatRupiah, formatDate } from "@/lib/format";

export default function StaffDashboard() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [showRegister, setShowRegister] = useState(false);
  const [registerNotice, setRegisterNotice] = useState(null);
  const [me, setMe] = useState(null);
  const [showPasswordForm, setShowPasswordForm] = useState(false);

  useEffect(() => {
    fetch("/api/staff/me")
      .then((r) => r.json())
      .then(setMe)
      .catch(() => {});
  }, []);

  async function runSearch(q) {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    const res = await fetch(`/api/member/search?q=${encodeURIComponent(q)}`);
    if (res.status === 401) {
      router.push("/staff/login");
      return;
    }
    const data = await res.json();
    setResults(data.members || []);
  }

  useEffect(() => {
    const t = setTimeout(() => runSearch(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  async function loadDetail(id) {
    setSelectedId(id);
    setRegisterNotice(null);
    const res = await fetch(`/api/member/${id}`);
    const data = await res.json();
    setDetail(data);
  }

  async function handleLogout() {
    await fetch("/api/staff/logout", { method: "POST" });
    router.push("/");
  }

  return (
    <main className="min-h-screen bg-[#fbf9f4] px-4 py-6 sm:px-6 sm:py-10">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col gap-3 mb-6 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-body text-xs text-ink/40 uppercase tracking-wide">
              Banana Leaf Membership
            </p>
            <h1 className="font-display text-2xl text-ink">
              Dashboard {me?.staffRole === "owner" ? "Owner" : "Staff"}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Link
              href="/staff/dashboard/insights"
              className="focus-ring font-body text-sm text-ink/50 hover:text-ink"
            >
              Perlu Diperhatikan
            </Link>
            <Link
              href="/staff/dashboard/today"
              className="focus-ring font-body text-sm text-ink/50 hover:text-ink"
            >
              Input Hari Ini
            </Link>
            {me?.staffRole === "owner" && (
              <Link
                href="/staff/dashboard/rewards"
                className="focus-ring font-body text-sm text-gold-600 hover:text-gold-700"
              >
                Kelola Hadiah
              </Link>
            )}
            {me?.staffRole === "owner" && (
              <Link
                href="/staff/dashboard/staff"
                className="focus-ring font-body text-sm text-ink/50 hover:text-ink"
              >
                Kelola Staff
              </Link>
            )}
            <button
              onClick={() => setShowPasswordForm((s) => !s)}
              className="focus-ring font-body text-sm text-ink/50 hover:text-ink"
            >
              Ganti Password
            </button>
            <button
              onClick={handleLogout}
              className="focus-ring font-body text-sm text-ink/50 hover:text-ink"
            >
              Keluar
            </button>
          </div>
        </div>

        {showPasswordForm && (
          <ChangePasswordForm onDone={() => setShowPasswordForm(false)} />
        )}

        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="font-body text-sm font-medium text-ink/60">
                Cari member (nomor WA / nama)
              </label>
              <button
                onClick={() => setShowRegister((s) => !s)}
                className="focus-ring font-body text-xs text-gold-600 hover:text-gold-700"
              >
                {showRegister ? "Tutup" : "+ Member baru"}
              </button>
            </div>

            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="08xxxxxxxxxx atau nama"
              className="focus-ring w-full rounded-lg border border-ink/15 bg-white px-4 py-2.5 font-body text-ink mb-3"
            />

            {showRegister && (
              <RegisterMemberForm
                onRegistered={(res) => {
                  setRegisterNotice(res);
                  setShowRegister(false);
                  setQuery(res.member.whatsapp_number);
                }}
              />
            )}

            {registerNotice && (
              <div className="rounded-lg border border-leaf-300 bg-leaf-50 px-4 py-3 mb-3 font-body text-sm text-leaf-800">
                Member <strong>{registerNotice.member.name}</strong> berhasil didaftarkan.
                PIN default: <strong>{registerNotice.defaultPin}</strong> (kasih tau member ya).
              </div>
            )}

            <div className="rounded-xl border border-ink/10 bg-white divide-y divide-ink/10">
              {results.length === 0 && (
                <p className="font-body text-sm text-ink/40 px-4 py-4">
                  {query ? "Tidak ada member ditemukan." : "Ketik buat cari member."}
                </p>
              )}
              {results.map((m) => (
                <button
                  key={m.id}
                  onClick={() => loadDetail(m.id)}
                  className={
                    "focus-ring w-full text-left px-4 py-3 hover:bg-leaf-50 transition-colors " +
                    (selectedId === m.id ? "bg-leaf-50" : "")
                  }
                >
                  <p className="font-body text-sm text-ink">{m.name}</p>
                  <p className="font-body text-xs text-ink/40">{m.whatsapp_number}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            {!detail && (
              <div className="rounded-xl border border-dashed border-ink/15 h-full min-h-[200px] flex items-center justify-center">
                <p className="font-body text-sm text-ink/40 text-center px-6">
                  Pilih member dari hasil pencarian buat lihat detail &amp; catat transaksi.
                </p>
              </div>
            )}
            {detail && detail.error && (
              <p className="font-body text-sm text-red-600">{detail.error}</p>
            )}
            {detail && detail.member && (
              <MemberDetail
                detail={detail}
                onRefresh={() => loadDetail(selectedId)}
                isOwner={me?.staffRole === "owner"}
              />
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

function ChangePasswordForm({ onDone }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setMsg("");
    const res = await fetch("/api/staff/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Gagal ganti password.");
      return;
    }
    setMsg("Password berhasil diganti.");
    setCurrentPassword("");
    setNewPassword("");
    setTimeout(onDone, 1200);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-6 max-w-sm space-y-3 rounded-xl border border-ink/10 bg-white p-4"
    >
      <div>
        <label className="block font-body text-xs text-ink/60 mb-1">Password saat ini</label>
        <input
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
          className="focus-ring w-full rounded-lg border border-ink/15 px-3 py-2 font-body text-sm"
        />
      </div>
      <div>
        <label className="block font-body text-xs text-ink/60 mb-1">Password baru (min. 6 karakter)</label>
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
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
        Simpan password baru
      </button>
    </form>
  );
}

function RegisterMemberForm({ onRegistered }) {
  const [whatsapp, setWhatsapp] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/member/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ whatsapp, name }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Gagal daftar member.");
        return;
      }
      onRegistered(data);
      setWhatsapp("");
      setName("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-ink/10 bg-white p-4 mb-3 space-y-3"
    >
      <div>
        <label className="block font-body text-xs text-ink/60 mb-1">Nomor WhatsApp</label>
        <input
          type="tel"
          value={whatsapp}
          onChange={(e) => setWhatsapp(e.target.value)}
          required
          placeholder="08xxxxxxxxxx"
          className="focus-ring w-full rounded-lg border border-ink/15 px-3 py-2 font-body text-sm"
        />
      </div>
      <div>
        <label className="block font-body text-xs text-ink/60 mb-1">Nama</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="focus-ring w-full rounded-lg border border-ink/15 px-3 py-2 font-body text-sm"
        />
      </div>
      {error && <p className="font-body text-xs text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="focus-ring rounded-lg bg-gold-600 hover:bg-gold-700 disabled:opacity-60 text-white font-body text-sm font-medium px-4 py-2"
      >
        {loading ? "Mendaftarkan..." : "Daftarkan member"}
      </button>
    </form>
  );
}

function MemberDetail({ detail, onRefresh, isOwner }) {
  const [mode, setMode] = useState(null); // 'earn' | 'redeem' | 'edit' | null
  const [resettingPin, setResettingPin] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetResult, setResetResult] = useState(null);

  async function handleResetPin() {
    setResettingPin(true);
    try {
      const res = await fetch(`/api/member/${detail.member.id}/reset-pin`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Gagal reset PIN.");
        return;
      }
      setResetResult(data.newPin);
      setConfirmReset(false);
    } finally {
      setResettingPin(false);
    }
  }

  return (
    <div>
      <div className="rounded-xl border border-ink/10 bg-white p-5 mb-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-display text-xl text-ink">{detail.member.name}</p>
            <p className="font-body text-sm text-ink/50 mb-3">{detail.member.whatsapp_number}</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => {
                setConfirmReset(true);
                setResetResult(null);
              }}
              className="focus-ring font-body text-xs text-ink/40 hover:text-ink whitespace-nowrap"
            >
              Reset PIN
            </button>
            {isOwner && (
              <button
                onClick={() => setMode(mode === "edit" ? null : "edit")}
                className="focus-ring font-body text-xs text-ink/40 hover:text-ink"
              >
                Edit
              </button>
            )}
          </div>
        </div>

        {confirmReset && (
          <div className="rounded-lg border border-gold-300 bg-gold-50 px-4 py-3 mb-3 font-body text-sm text-gold-800">
            <p className="mb-2">PIN lama member ini bakal langsung gak berlaku. Yakin reset?</p>
            <div className="flex gap-2">
              <button
                onClick={handleResetPin}
                disabled={resettingPin}
                className="focus-ring rounded-lg bg-gold-600 hover:bg-gold-700 disabled:opacity-60 text-white text-xs font-medium px-3 py-1.5"
              >
                {resettingPin ? "Memproses..." : "Ya, reset"}
              </button>
              <button
                onClick={() => setConfirmReset(false)}
                className="focus-ring rounded-lg border border-gold-300 text-gold-700 text-xs font-medium px-3 py-1.5"
              >
                Batal
              </button>
            </div>
          </div>
        )}

        {resetResult && (
          <div className="rounded-lg border border-leaf-300 bg-leaf-50 px-4 py-3 mb-3 font-body text-sm text-leaf-800">
            PIN baru: <strong className="text-base">{resetResult}</strong>
            <br />
            Kasih tau member sekarang — cuma ditampilkan sekali ini aja.
          </div>
        )}

        <div className="flex items-baseline gap-2">
          <span className="font-display text-3xl text-leaf-700">{detail.totalPoints}</span>
          <span className="font-body text-sm text-ink/50">poin valid</span>
        </div>
        {detail.expiringSoonPoints > 0 && (
          <p className="font-body text-xs text-gold-600 mt-1">
            {detail.expiringSoonPoints} poin hangus {formatDate(detail.expiringSoonDate)}
          </p>
        )}

        {mode === "edit" && (
          <EditMemberForm
            member={detail.member}
            onDone={() => {
              setMode(null);
              onRefresh();
            }}
          />
        )}

        <div className="flex gap-2 mt-4">
          <button
            onClick={() => setMode(mode === "earn" ? null : "earn")}
            className="focus-ring flex-1 rounded-lg bg-leaf-700 hover:bg-leaf-800 text-white font-body text-sm font-medium py-2"
          >
            Catat belanja
          </button>
          <button
            onClick={() => setMode(mode === "redeem" ? null : "redeem")}
            className="focus-ring flex-1 rounded-lg border border-gold-500 text-gold-700 hover:bg-gold-50 font-body text-sm font-medium py-2"
          >
            Redeem poin
          </button>
        </div>

        {mode === "earn" && (
          <EarnForm
            memberId={detail.member.id}
            onDone={() => {
              setMode(null);
              onRefresh();
            }}
          />
        )}
        {mode === "redeem" && (
          <RedeemForm
            memberId={detail.member.id}
            availablePoints={detail.totalPoints}
            onDone={() => {
              setMode(null);
              onRefresh();
            }}
          />
        )}
      </div>

      <h2 className="font-body text-sm font-medium text-ink/60 mb-2">Riwayat</h2>
      <div className="rounded-xl border border-ink/10 bg-white divide-y divide-ink/10 max-h-80 overflow-y-auto">
        {detail.history.length === 0 && (
          <p className="font-body text-sm text-ink/40 px-4 py-4">Belum ada transaksi.</p>
        )}
        {detail.history.map((t) => (
          <div key={t.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="font-body text-sm text-ink truncate">
                {t.type === "earn"
                  ? `Belanja ${formatRupiah(t.amount_spent)}`
                  : t.description || "Redeem poin"}
              </p>
              <p className="font-body text-xs text-ink/40">
                {formatDate(t.created_at)}
                {t.created_by ? ` · ${t.created_by}` : ""}
              </p>
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
  );
}

function EditMemberForm({ member, onDone }) {
  const [name, setName] = useState(member.name);
  const [whatsapp, setWhatsapp] = useState(member.whatsapp_number);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`/api/member/${member.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, whatsapp }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Gagal simpan perubahan.");
        return;
      }
      onDone();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-3 border-t border-ink/10 pt-4">
      <div>
        <label className="block font-body text-xs text-ink/60 mb-1">Nama</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="focus-ring w-full rounded-lg border border-ink/15 px-3 py-2 font-body text-sm"
        />
      </div>
      <div>
        <label className="block font-body text-xs text-ink/60 mb-1">Nomor WhatsApp</label>
        <input
          type="tel"
          value={whatsapp}
          onChange={(e) => setWhatsapp(e.target.value)}
          required
          className="focus-ring w-full rounded-lg border border-ink/15 px-3 py-2 font-body text-sm"
        />
        <p className="font-body text-xs text-ink/40 mt-1">
          Ganti nomor ini juga mengganti nomor login member.
        </p>
      </div>
      {error && <p className="font-body text-xs text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="focus-ring rounded-lg bg-ink hover:bg-ink/80 disabled:opacity-60 text-white font-body text-sm font-medium px-4 py-2"
      >
        {loading ? "Menyimpan..." : "Simpan perubahan"}
      </button>
    </form>
  );
}

function EarnForm({ memberId, onDone }) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const previewPoints = Math.floor((Number(amount) || 0) / 100000);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/transactions/earn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId, amountSpent: Number(amount), note }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Gagal catat belanja.");
        return;
      }
      onDone();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-3 border-t border-ink/10 pt-4">
      <div>
        <label className="block font-body text-xs text-ink/60 mb-1">Nominal belanja (Rp)</label>
        <input
          type="number"
          min="1"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
          className="focus-ring w-full rounded-lg border border-ink/15 px-3 py-2 font-body text-sm"
        />
        <p className="font-body text-xs text-ink/40 mt-1">= {previewPoints} poin</p>
      </div>
      <div>
        <label className="block font-body text-xs text-ink/60 mb-1">Catatan (opsional)</label>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="focus-ring w-full rounded-lg border border-ink/15 px-3 py-2 font-body text-sm"
        />
      </div>
      {error && <p className="font-body text-xs text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="focus-ring rounded-lg bg-leaf-700 hover:bg-leaf-800 disabled:opacity-60 text-white font-body text-sm font-medium px-4 py-2"
      >
        {loading ? "Menyimpan..." : "Simpan"}
      </button>
    </form>
  );
}

function RedeemForm({ memberId, availablePoints, onDone }) {
  const [rewards, setRewards] = useState([]);
  const [selectedRewardId, setSelectedRewardId] = useState("custom");
  const [points, setPoints] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/rewards")
      .then((r) => r.json())
      .then((data) => setRewards(data.rewards || []))
      .catch(() => {});
  }, []);

  function handleSelectReward(id) {
    setSelectedRewardId(id);
    if (id === "custom") return;
    const reward = rewards.find((r) => r.id === id);
    if (reward) {
      setPoints(String(reward.points_cost));
      setDescription(reward.name);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/transactions/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId, points: Number(points), description }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Gagal proses redeem.");
        return;
      }
      onDone();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-3 border-t border-ink/10 pt-4">
      {rewards.length > 0 && (
        <div>
          <label className="block font-body text-xs text-ink/60 mb-1">Pilih hadiah</label>
          <select
            value={selectedRewardId}
            onChange={(e) => handleSelectReward(e.target.value)}
            className="focus-ring w-full rounded-lg border border-ink/15 px-3 py-2 font-body text-sm bg-white"
          >
            {rewards.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} — {r.points_cost} poin
              </option>
            ))}
            <option value="custom">Lainnya (isi manual)</option>
          </select>
        </div>
      )}
      <div>
        <label className="block font-body text-xs text-ink/60 mb-1">
          Jumlah poin ditukar (tersedia: {availablePoints})
        </label>
        <input
          type="number"
          min="1"
          max={availablePoints}
          value={points}
          onChange={(e) => setPoints(e.target.value)}
          required
          className="focus-ring w-full rounded-lg border border-ink/15 px-3 py-2 font-body text-sm"
        />
      </div>
      <div>
        <label className="block font-body text-xs text-ink/60 mb-1">Ditukar untuk apa</label>
        <input
          type="text"
          placeholder="mis. Diskon 20rb, free snack, dll"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          className="focus-ring w-full rounded-lg border border-ink/15 px-3 py-2 font-body text-sm"
        />
      </div>
      {error && <p className="font-body text-xs text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="focus-ring rounded-lg bg-gold-600 hover:bg-gold-700 disabled:opacity-60 text-white font-body text-sm font-medium px-4 py-2"
      >
        {loading ? "Memproses..." : "Proses redeem"}
      </button>
    </form>
  );
}
