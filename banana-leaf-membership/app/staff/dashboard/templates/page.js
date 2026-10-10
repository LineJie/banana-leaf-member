"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { renderTemplate, findVars, needsValidity } from "@/lib/template";
import { formatLongDate } from "@/lib/time";

const SAMPLE = { nama: "Budi", poin: 120, hari: 5, kode_voucher: "BL-X7K2MQ" };

function formatUpdated(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function TemplateCard({ template, varHelp, maxLength, onSaved }) {
  const [body, setBody] = useState(template.body);
  const [validUntil, setValidUntil] = useState(template.valid_until || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const dirty = body !== template.body || validUntil !== (template.valid_until || "");
  const usesValidity = needsValidity(body);
  const unknownVars = findVars(body).filter((v) => !template.allowedVars.includes(v));

  const preview = renderTemplate(body, {
    ...SAMPLE,
    berlaku_sampai: validUntil ? formatLongDate(validUntil) : "(tanggal belum diisi)",
  });

  function insertVar(name) {
    setBody((b) => `${b}{${name}}`);
    setSaved(false);
  }

  async function handleSave() {
    setError("");
    setSaved(false);
    setSaving(true);
    try {
      const res = await fetch(`/api/templates/${template.key}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, validUntil: validUntil || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Gagal menyimpan.");
        return;
      }
      setSaved(true);
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-xl border border-ink/10 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
        <h2 className="font-display text-lg text-ink">{template.title}</h2>
        {template.updated_by && (
          <p className="font-body text-xs text-ink/40">
            Terakhir diubah {formatUpdated(template.updated_at)} oleh {template.updated_by}
          </p>
        )}
      </div>

      {template.problem && (
        <p className="rounded-lg border border-gold-300 bg-gold-50 px-3 py-2 font-body text-xs text-gold-800 my-2">
          Belum bisa dikirim: {template.problem}
        </p>
      )}

      <label className="block font-body text-xs text-ink/60 mt-3 mb-1">Isi pesan</label>
      <textarea
        value={body}
        onChange={(e) => {
          setBody(e.target.value);
          setSaved(false);
        }}
        rows={8}
        className="focus-ring w-full rounded-lg border border-ink/15 px-3 py-2 font-body text-sm"
      />
      <div className="flex justify-between font-body text-xs text-ink/40 mt-1">
        <span>
          {body.length}/{maxLength} karakter
        </span>
      </div>

      <div className="mt-2">
        <p className="font-body text-xs text-ink/60 mb-1">
          Variabel (klik untuk menambahkan di akhir pesan):
        </p>
        <div className="flex flex-wrap gap-2">
          {template.allowedVars.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => insertVar(v)}
              title={varHelp[v] || ""}
              className="focus-ring rounded-md border border-ink/15 bg-ink/5 px-2 py-1 font-body text-xs text-ink/70 hover:bg-ink/10"
            >
              {`{${v}}`}
            </button>
          ))}
        </div>
        <ul className="font-body text-xs text-ink/40 mt-2 space-y-0.5">
          {template.allowedVars.map((v) => (
            <li key={v}>
              <span className="text-ink/60">{`{${v}}`}</span> = {varHelp[v]}
            </li>
          ))}
        </ul>
      </div>

      {unknownVars.length > 0 && (
        <p className="font-body text-xs text-red-600 mt-2">
          Variabel tidak dikenal: {unknownVars.map((v) => `{${v}}`).join(", ")}. Pesan tidak bisa
          disimpan sampai diperbaiki.
        </p>
      )}

      <div className="mt-4">
        <label className="block font-body text-xs text-ink/60 mb-1">
          Berlaku sampai {usesValidity ? "(wajib, karena pesan memakai tanggal/voucher)" : "(tidak dipakai di pesan ini)"}
        </label>
        <input
          type="date"
          value={validUntil}
          onChange={(e) => {
            setValidUntil(e.target.value);
            setSaved(false);
          }}
          className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-body text-sm"
        />
        <p className="font-body text-xs text-ink/40 mt-1">
          Pesan otomatis tidak bisa dikirim kalau tanggal ini kosong atau sudah lewat, supaya
          member tidak dijanjikan promo yang sudah berakhir. Voucher yang dibuat ikut berlaku sampai
          tanggal ini.
        </p>
      </div>

      <div className="mt-4">
        <p className="font-body text-xs text-ink/60 mb-1">Pratinjau (contoh data)</p>
        <pre className="whitespace-pre-wrap rounded-lg bg-leaf-50 border border-leaf-200 px-3 py-2 font-body text-sm text-ink">
          {preview}
        </pre>
      </div>

      {error && <p className="font-body text-xs text-red-600 mt-3">{error}</p>}
      {saved && !dirty && <p className="font-body text-xs text-leaf-700 mt-3">Tersimpan.</p>}

      <button
        onClick={handleSave}
        disabled={saving || !dirty || unknownVars.length > 0}
        className="focus-ring mt-3 rounded-lg bg-leaf-700 hover:bg-leaf-800 text-white font-body text-sm font-medium px-4 py-2 disabled:opacity-40"
      >
        {saving ? "Menyimpan..." : "Simpan"}
      </button>
    </section>
  );
}

export default function TemplatesPage() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    const res = await fetch("/api/templates");
    if (res.status === 401) {
      router.push("/staff/login");
      return;
    }
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Gagal memuat template.");
      setLoading(false);
      return;
    }
    setData(json);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="min-h-screen bg-[#fbf9f4] px-4 py-6 sm:px-6 sm:py-10">
      <div className="max-w-3xl mx-auto">
        <div className="flex flex-col gap-3 mb-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-body text-xs text-ink/40 uppercase tracking-wide">
              Banana Leaf Membership
            </p>
            <h1 className="font-display text-2xl text-ink">Kelola Pesan WA</h1>
          </div>
          <Link
            href="/staff/dashboard"
            className="focus-ring font-body text-sm text-ink/50 hover:text-ink"
          >
            &larr; Kembali ke Dashboard
          </Link>
        </div>

        <p className="font-body text-sm text-ink/60 mb-6">
          Teks di sini yang dipakai saat staf menekan tombol &quot;Chat WA&quot; di halaman Member
          Perlu Diperhatikan. Perubahan langsung berlaku untuk pesan berikutnya.
        </p>

        {loading && <p className="font-body text-sm text-ink/50">Memuat...</p>}
        {!loading && error && <p className="font-body text-sm text-red-600">{error}</p>}

        {!loading && data && (
          <div className="flex flex-col gap-6">
            {data.templates.map((t) => (
              <TemplateCard
                key={t.key}
                template={t}
                varHelp={data.varHelp}
                maxLength={data.maxLength}
                onSaved={load}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
