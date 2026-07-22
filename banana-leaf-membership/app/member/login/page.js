"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function MemberLoginPage() {
  const router = useRouter();
  const [whatsapp, setWhatsapp] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/member/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ whatsapp, pin }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Login gagal.");
        return;
      }
      router.push("/member/dashboard");
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

        <h1 className="font-display text-3xl text-ink mt-6 mb-1">Cek Poin Kamu</h1>
        <p className="font-body text-sm text-ink/60 mb-8">
          Login pakai nomor WhatsApp yang didaftarkan di kasir.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block font-body text-sm text-ink/70 mb-1">
              Nomor WhatsApp <span className="text-ink/40 font-normal">(ex: 0812xxxxxxx)</span>
            </label>
            <input
              type="tel"
              inputMode="numeric"
              placeholder="0812xxxxxxx"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              required
              className="focus-ring w-full rounded-lg border border-ink/15 bg-white px-4 py-2.5 font-body text-ink"
            />
          </div>
          <div>
            <label className="block font-body text-sm text-ink/70 mb-1">PIN</label>
            <input
              type="password"
              inputMode="numeric"
              placeholder="4-6 digit"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              required
              className="focus-ring w-full rounded-lg border border-ink/15 bg-white px-4 py-2.5 font-body text-ink"
            />
            <p className="font-body text-xs text-ink/40 mt-1">
              Belum punya PIN? Tanya staff pas daftar jadi member.
            </p>
          </div>

          {error && (
            <p className="font-body text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="focus-ring w-full rounded-lg bg-gold-600 hover:bg-gold-700 disabled:opacity-60 text-white font-body font-medium py-2.5 transition-colors"
          >
            {loading ? "Masuk..." : "Masuk"}
          </button>
        </form>
      </div>
    </main>
  );
}
