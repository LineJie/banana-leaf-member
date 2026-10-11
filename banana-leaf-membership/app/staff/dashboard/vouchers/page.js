"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatLongDate } from "@/lib/time";

const TABS = [
  { value: "active", label: "Aktif" },
  { value: "claimed", label: "Sudah dipakai / habis" },
  { value: "expired", label: "Kedaluwarsa" },
];

const STATUS_LABEL = {
  active: { text: "Aktif", cls: "text-leaf-700" },
  claimed: { text: "Sudah dipakai", cls: "text-ink/50" },
  expired: { text: "Kedaluwarsa", cls: "text-red-600" },
};

function statusText(v) {
  if (v.kind === "shared" && v.status === "claimed") return { text: "Habis", cls: STATUS_LABEL.claimed.cls };
  return STATUS_LABEL[v.status];
}

function kindText(v) {
  if (v.kind === "shared") {
    return `Banyak orang · dipakai ${v.usedCount}${v.maxUses != null ? `/${v.maxUses}` : ""}x`;
  }
  return `1 orang · ${v.memberName || "-"}`;
}

function formatDateTime(iso) {
  return new Date(iso).toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Cari member berdasarkan nama / nomor WA, lalu pilih satu.
function MemberPicker({ selected, onPick, onUnauthorized }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/member/search?q=${encodeURIComponent(term)}`);
        if (res.status === 401) {
          onUnauthorized?.();
          return;
        }
        const json = await res.json();
        setResults(res.ok ? json.members || [] : []);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  if (selected) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-leaf-700 bg-white px-3 py-2">
        <p className="font-body text-sm text-ink">
          <strong>{selected.name}</strong> <span className="text-ink/40">· {selected.whatsapp_number}</span>
        </p>
        <button
          type="button"
          onClick={() => onPick(null)}
          className="focus-ring font-body text-xs text-ink/50 hover:text-ink"
        >
          Ganti
        </button>
      </div>
    );
  }

  return (
    <div>
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Cari nama atau nomor WA member..."
        className="focus-ring w-full rounded-lg border border-ink/15 bg-white px-3 py-2.5 font-body text-sm text-ink"
      />
      {searching && <p className="font-body text-xs text-ink/40 mt-1">Mencari...</p>}
      {results.length > 0 && (
        <div className="mt-1 rounded-lg border border-ink/10 bg-white divide-y divide-ink/10 max-h-48 overflow-y-auto">
          {results.map((m) => (
            <button
              type="button"
              key={m.id}
              onClick={() => {
                onPick(m);
                setQ("");
                setResults([]);
              }}
              className="focus-ring block w-full text-left px-3 py-2 font-body text-sm text-ink hover:bg-ink/5"
            >
              {m.name} <span className="text-ink/40">· {m.whatsapp_number}</span>
            </button>
          ))}
        </div>
      )}
      {!searching && q.trim().length >= 2 && results.length === 0 && (
        <p className="font-body text-xs text-ink/40 mt-1">Member tidak ditemukan.</p>
      )}
    </div>
  );
}

// Riwayat pemakaian satu voucher 'banyak orang' (dimuat saat dibuka).
function RedemptionHistory({ voucherId, onUnauthorized }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (!next) return;
    setError("");
    const res = await fetch(`/api/vouchers/redemptions?voucherId=${encodeURIComponent(voucherId)}`);
    if (res.status === 401) {
      onUnauthorized?.();
      return;
    }
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Gagal memuat riwayat.");
      return;
    }
    setRows(json.redemptions || []);
  }

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={toggle}
        className="focus-ring font-body text-xs text-leaf-700 hover:text-leaf-800 underline"
      >
        {open ? "Tutup riwayat" : "Lihat riwayat pemakaian"}
      </button>
      {open && (
        <div className="mt-2 rounded-lg border border-ink/10 bg-[#fbf9f4]">
          {error && <p className="font-body text-xs text-red-600 px-3 py-2">{error}</p>}
          {!error && rows === null && <p className="font-body text-xs text-ink/50 px-3 py-2">Memuat...</p>}
          {!error && rows && rows.length === 0 && (
            <p className="font-body text-xs text-ink/40 px-3 py-2">Belum ada yang memakai.</p>
          )}
          {!error && rows && rows.length > 0 && (
            <div className="divide-y divide-ink/10 max-h-60 overflow-y-auto">
              {rows.map((r) => (
                <p key={r.id} className="font-body text-xs text-ink px-3 py-2">
                  <strong>{r.memberName}</strong> <span className="text-ink/40">· {r.whatsappNumber}</span>
                  <span className="text-ink/50">
                    {" · "}
                    {formatDateTime(r.redeemedAt)}
                    {r.redeemedBy ? ` · dicatat ${r.redeemedBy}` : ""}
                  </span>
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Form buat voucher (khusus owner).
function CreateVoucher({ onCreated, onUnauthorized }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState("single");
  const [member, setMember] = useState(null);
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState(null);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setCreated(null);
    setCopied(false);
    setSaving(true);
    try {
      const res = await fetch("/api/vouchers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          memberId: kind === "single" ? member?.id : undefined,
          code: code.trim() || undefined,
          description,
          validUntil,
          maxUses: kind === "shared" ? maxUses : undefined,
        }),
      });
      if (res.status === 401) {
        onUnauthorized?.();
        return;
      }
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Gagal membuat voucher.");
        return;
      }
      setCreated({ ...json.voucher, memberName: kind === "single" ? member?.name : null });
      setCode("");
      setDescription("");
      setMaxUses("");
      setMember(null);
      onCreated();
    } finally {
      setSaving(false);
    }
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(created.code);
      setCopied(true);
    } catch {
      window.prompt("Salin kode ini:", created.code);
    }
  }

  return (
    <div className="rounded-xl border border-gold-300 bg-white p-4 mb-6">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="focus-ring w-full flex items-center justify-between font-body text-sm font-medium text-ink"
      >
        <span>+ Buat voucher baru (owner)</span>
        <span className="text-ink/40">{open ? "−" : "+"}</span>
      </button>

      {open && (
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              { value: "single", title: "Khusus 1 orang", desc: "Kode untuk satu member saja, sekali pakai." },
              { value: "shared", title: "Untuk banyak orang", desc: "Satu kode dipakai banyak member, masing-masing 1x." },
            ].map((o) => (
              <label
                key={o.value}
                className={
                  "cursor-pointer rounded-lg border px-3 py-2.5 " +
                  (kind === o.value ? "border-leaf-700 bg-leaf-700/5" : "border-ink/15")
                }
              >
                <input
                  type="radio"
                  name="kind"
                  value={o.value}
                  checked={kind === o.value}
                  onChange={() => setKind(o.value)}
                  className="mr-2"
                />
                <span className="font-body text-sm font-medium text-ink">{o.title}</span>
                <span className="block font-body text-xs text-ink/50 mt-0.5 ml-5">{o.desc}</span>
              </label>
            ))}
          </div>

          {kind === "single" && (
            <div>
              <label className="block font-body text-xs text-ink/60 mb-1">Member penerima</label>
              <MemberPicker selected={member} onPick={setMember} onUnauthorized={onUnauthorized} />
            </div>
          )}

          <div>
            <label className="block font-body text-xs text-ink/60 mb-1">
              Isi / keterangan voucher (opsional, tampil saat kasir mengecek kode)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={200}
              placeholder="Contoh: Gratis 1 Jamur Enoki Cabe Garam"
              className="focus-ring w-full rounded-lg border border-ink/15 bg-white px-3 py-2.5 font-body text-sm text-ink"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block font-body text-xs text-ink/60 mb-1">Berlaku sampai (wajib)</label>
              <input
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                required
                className="focus-ring w-full rounded-lg border border-ink/15 bg-white px-3 py-2.5 font-body text-sm text-ink"
              />
            </div>
            <div>
              <label className="block font-body text-xs text-ink/60 mb-1">
                Kode (kosongkan = dibuat otomatis)
              </label>
              <div className="flex items-center gap-1">
                <span className="font-body text-sm text-ink/50">BL-</span>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder={kind === "shared" ? "BANANA10" : "otomatis"}
                  autoCapitalize="characters"
                  className="focus-ring w-full rounded-lg border border-ink/15 bg-white px-3 py-2.5 font-body text-sm text-ink uppercase"
                />
              </div>
            </div>
          </div>

          {kind === "shared" && (
            <div>
              <label className="block font-body text-xs text-ink/60 mb-1">
                Batas total pemakaian (opsional, kosong = tanpa batas)
              </label>
              <input
                type="number"
                min="1"
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value)}
                placeholder="Contoh: 50"
                className="focus-ring w-full sm:w-48 rounded-lg border border-ink/15 bg-white px-3 py-2.5 font-body text-sm text-ink"
              />
            </div>
          )}

          {error && <p className="font-body text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={saving || (kind === "single" && !member)}
            className="focus-ring self-start rounded-lg bg-leaf-700 hover:bg-leaf-800 disabled:opacity-50 text-white font-body text-sm font-medium px-4 py-2"
          >
            {saving ? "Menyimpan..." : "Buat voucher"}
          </button>

          {created && (
            <div className="rounded-lg border border-leaf-700 bg-leaf-700/5 px-4 py-3">
              <p className="font-body text-xs text-ink/60">Voucher berhasil dibuat</p>
              <p className="font-display text-xl text-ink mt-0.5">{created.code}</p>
              <p className="font-body text-xs text-ink/60 mt-1">
                {created.kind === "shared"
                  ? `Untuk banyak orang${created.maxUses ? ` · maksimal ${created.maxUses}x` : ""}`
                  : `Khusus ${created.memberName}`}
                {" · berlaku sampai "}
                {formatLongDate(created.validUntil)}
                {created.description ? ` · ${created.description}` : ""}
              </p>
              <button
                type="button"
                onClick={copyCode}
                className="focus-ring mt-2 rounded-lg border border-ink/15 bg-white px-3 py-1.5 font-body text-xs text-ink hover:bg-ink/5"
              >
                {copied ? "Tersalin ✓" : "Salin kode"}
              </button>
            </div>
          )}
        </form>
      )}
    </div>
  );
}

export default function VouchersPage() {
  const router = useRouter();
  const [isOwner, setIsOwner] = useState(false);
  const [code, setCode] = useState("");
  const [found, setFound] = useState(null);
  const [claimMember, setClaimMember] = useState(null);
  const [checkMsg, setCheckMsg] = useState("");
  const [claiming, setClaiming] = useState(false);

  const [tab, setTab] = useState("active");
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const goLogin = useCallback(() => router.push("/staff/login"), [router]);

  useEffect(() => {
    fetch("/api/staff/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setIsOwner(j?.staffRole === "owner"))
      .catch(() => {});
  }, []);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError("");
    const res = await fetch(`/api/vouchers?status=${tab}`);
    if (res.status === 401) {
      goLogin();
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
  }, [tab, goLogin]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  async function handleCheck(e) {
    e.preventDefault();
    setCheckMsg("");
    setFound(null);
    setClaimMember(null);
    if (!code.trim()) return;
    const res = await fetch(`/api/vouchers?code=${encodeURIComponent(code.trim())}`);
    if (res.status === 401) {
      goLogin();
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
    const shared = found.kind === "shared";
    if (shared && !claimMember) {
      setCheckMsg("Pilih member yang memakai voucher ini dulu.");
      return;
    }
    const who = shared ? claimMember.name : found.memberName;
    if (!window.confirm(`Tandai voucher ${found.code} dipakai oleh ${who}? Ini tidak bisa dibatalkan.`)) {
      return;
    }
    setClaiming(true);
    setCheckMsg("");
    const res = await fetch("/api/vouchers/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: found.code, memberId: shared ? claimMember.id : undefined }),
    });
    const json = await res.json();
    setClaiming(false);
    if (!res.ok) {
      setCheckMsg(json.error || "Gagal menandai voucher.");
      return;
    }
    setCheckMsg(`Voucher ${json.code} berhasil ditandai sudah dipakai${shared ? ` oleh ${json.memberName}` : ""}.`);
    setFound(null);
    setClaimMember(null);
    setCode("");
    loadList();
  }

  const foundStatus = found ? statusText(found) : null;

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
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Link
              href="/staff/dashboard/voucher-report"
              className="focus-ring font-body text-sm text-gold-600 hover:text-gold-700"
            >
              Laporan Voucher
            </Link>
            <Link
              href="/staff/dashboard"
              className="focus-ring font-body text-sm text-ink/50 hover:text-ink"
            >
              &larr; Kembali ke Dashboard
            </Link>
          </div>
        </div>

        {isOwner && <CreateVoucher onCreated={loadList} onUnauthorized={goLogin} />}

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
                <strong>{found.code}</strong> · {kindText(found)}
              </p>
              {found.description && (
                <p className="font-body text-sm text-ink mt-1">🎁 {found.description}</p>
              )}
              <p className="font-body text-xs text-ink/50 mt-0.5">
                Berlaku sampai {formatLongDate(found.validUntil)}
              </p>
              <p className={"font-body text-sm mt-1 " + foundStatus.cls}>
                {foundStatus.text}
                {found.kind === "single" && found.status === "claimed" && found.claimedAt
                  ? ` · ${formatDateTime(found.claimedAt)}${found.claimedBy ? ` oleh ${found.claimedBy}` : ""}`
                  : ""}
              </p>

              {found.status === "active" && found.kind === "shared" && (
                <div className="mt-3">
                  <label className="block font-body text-xs text-ink/60 mb-1">
                    Dipakai oleh member (tiap member hanya bisa 1x)
                  </label>
                  <MemberPicker selected={claimMember} onPick={setClaimMember} onUnauthorized={goLogin} />
                </div>
              )}

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
            {list.map((v) => {
              const st = statusText(v);
              return (
                <div key={v.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-body text-sm text-ink">
                      <strong>{v.code}</strong> · {kindText(v)}
                      {v.kind === "single" && v.whatsappNumber && (
                        <span className="text-ink/40"> · {v.whatsappNumber}</span>
                      )}
                    </p>
                    {v.description && (
                      <p className="font-body text-xs text-ink/70">🎁 {v.description}</p>
                    )}
                    <p className="font-body text-xs text-ink/50">
                      Dibuat {formatDateTime(v.issuedAt)} · berlaku sampai {formatLongDate(v.validUntil)}
                      {v.kind === "single" && v.claimedAt ? ` · dipakai ${formatDateTime(v.claimedAt)}` : ""}
                      {v.kind === "single" && v.claimedBy ? ` oleh ${v.claimedBy}` : ""}
                    </p>
                    {v.kind === "shared" && v.usedCount > 0 && (
                      <RedemptionHistory voucherId={v.id} onUnauthorized={goLogin} />
                    )}
                  </div>
                  <p className={"font-body text-xs shrink-0 " + st.cls}>{st.text}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
