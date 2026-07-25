"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function StaffAccountsPage() {
  const router = useRouter();
  const [staffList, setStaffList] = useState(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("staff");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [passwordEdits, setPasswordEdits] = useState({});
  const [rowError, setRowError] = useState({});
  const [rowMsg, setRowMsg] = useState({});

  async function load() {
    const res = await fetch("/api/staff-accounts");
    if (res.status === 401 || res.status === 403) {
      router.push("/staff/dashboard");
      return;
    }
    const data = await res.json();
    setStaffList(data.staff || []);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleAdd(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/staff-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, name, role }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Gagal nambah akun staff.");
        return;
      }
      setUsername("");
      setPassword("");
      setName("");
      setRole("staff");
      load();
    } finally {
      setLoading(false);
    }
  }

  async function toggleActive(s) {
    await fetch(`/api/staff-accounts/${s.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !s.active }),
    });
    load();
  }

  async function handleChangePassword(s) {
    const newPassword = passwordEdits[s.id] || "";
    if (newPassword.length < 6) {
      setRowError((prev) => ({ ...prev, [s.id]: "Password minimal 6 karakter." }));
      return;
    }
    const res = await fetch(`/api/staff-accounts/${s.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newPassword }),
    });
    const data = await res.json();
    if (!res.ok) {
      setRowError((prev) => ({ ...prev, [s.id]: data.error || "Gagal ganti password." }));
      return;
    }
    setRowError((prev) => ({ ...prev, [s.id]: "" }));
    setRowMsg((prev) => ({ ...prev, [s.id]: "Password berhasil diganti." }));
    setPasswordEdits((prev) => ({ ...prev, [s.id]: "" }));
  }

  if (!staffList) {
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

        <h1 className="font-display text-2xl text-ink mt-4 mb-1">Kelola Staff</h1>
        <p className="font-body text-sm text-ink/60 mb-6">
          Tambah akun staff baru, ganti password, atau nonaktifkan akun staff yang sudah tidak bekerja lagi.
        </p>

        <form
          onSubmit={handleAdd}
          className="rounded-xl border border-ink/10 bg-white p-4 mb-6 space-y-3"
        >
          <p className="font-body text-sm font-medium text-ink/70">Tambah staff baru</p>
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className="focus-ring w-full rounded-lg border border-ink/15 px-3 py-2 font-body text-sm"
          />
          <input
            type="text"
            placeholder="Nama"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="focus-ring w-full rounded-lg border border-ink/15 px-3 py-2 font-body text-sm"
          />
          <input
            type="password"
            placeholder="Password (min. 6 karakter)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="focus-ring w-full rounded-lg border border-ink/15 px-3 py-2 font-body text-sm"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="focus-ring w-full rounded-lg border border-ink/15 px-3 py-2 font-body text-sm"
          >
            <option value="staff">Staff biasa</option>
            <option value="owner">Owner</option>
          </select>
          {error && <p className="font-body text-xs text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="focus-ring w-full sm:w-auto rounded-lg bg-gold-600 hover:bg-gold-700 disabled:opacity-60 text-white font-body text-sm font-medium px-4 py-2"
          >
            {loading ? "Menambah..." : "Tambah staff"}
          </button>
        </form>

        <div className="rounded-xl border border-ink/10 bg-white divide-y divide-ink/10">
          {staffList.length === 0 && (
            <p className="font-body text-sm text-ink/40 px-4 py-4">Belum ada akun staff.</p>
          )}
          {staffList.map((s) => (
            <div key={s.id} className="px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className={!s.active ? "opacity-40" : ""}>
                  <p className="font-body text-sm text-ink">
                    {s.name} <span className="text-ink/40">({s.username})</span>
                  </p>
                  <p className="font-body text-xs text-ink/40">
                    {s.role === "owner" ? "Owner" : "Staff"} · {s.active ? "Aktif" : "Nonaktif"}
                  </p>
                </div>
                <button
                  onClick={() => toggleActive(s)}
                  className={
                    "focus-ring font-body text-xs px-3 py-1.5 rounded-lg border whitespace-nowrap " +
                    (s.active
                      ? "border-ink/15 text-ink/60 hover:bg-ink/5"
                      : "border-leaf-600 text-leaf-700 hover:bg-leaf-50")
                  }
                >
                  {s.active ? "Nonaktifkan" : "Aktifkan"}
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <input
                  type="password"
                  placeholder="Password baru"
                  value={passwordEdits[s.id] || ""}
                  onChange={(e) =>
                    setPasswordEdits((prev) => ({ ...prev, [s.id]: e.target.value }))
                  }
                  className="focus-ring flex-1 min-w-[140px] rounded-lg border border-ink/15 px-3 py-1.5 font-body text-sm"
                />
                <button
                  onClick={() => handleChangePassword(s)}
                  className="focus-ring font-body text-xs px-3 py-1.5 rounded-lg border border-ink/15 text-ink/60 hover:bg-ink/5 whitespace-nowrap"
                >
                  Ganti password
                </button>
              </div>
              {rowError[s.id] && (
                <p className="font-body text-xs text-red-600 mt-1">{rowError[s.id]}</p>
              )}
              {rowMsg[s.id] && !rowError[s.id] && (
                <p className="font-body text-xs text-leaf-700 mt-1">{rowMsg[s.id]}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
