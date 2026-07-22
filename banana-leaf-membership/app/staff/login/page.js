"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function StaffLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/staff/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Login gagal.");
        return;
      }
      router.push("/staff/dashboard");
    } catch {
      setError("Gagal terhubung ke server. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#fbf9f4] flex items-center justify-center px-4 py-10 sm:px-6 sm:py-16">
      <div className="w-full max-w-sm">
        <Link href="/" className="font-body text-sm text-leaf-700 hover:text-leaf-900">
          ← Kembali
        </Link>

        <h1 className="font-display text-3xl text-ink mt-6 mb-1">Login Staff</h1>
        <p className="font-body text-sm text-ink/60 mb-8">
          Buat catat transaksi &amp; kelola member.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block font-body text-sm text-ink/70 mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="focus-ring w-full rounded-lg border border-ink/15 bg-white px-4 py-2.5 font-body text-ink"
            />
          </div>
          <div>
            <label className="block font-body text-sm text-ink/70 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="focus-ring w-full rounded-lg border border-ink/15 bg-white px-4 py-2.5 font-body text-ink"
            />
          </div>

          {error && (
            <p className="font-body text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="focus-ring w-full rounded-lg bg-leaf-700 hover:bg-leaf-800 disabled:opacity-60 text-white font-body font-medium py-2.5 transition-colors"
          >
            {loading ? "Masuk..." : "Masuk"}
          </button>
        </form>
      </div>
    </main>
  );
}
