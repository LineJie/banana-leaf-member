"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AnnouncementCard from "@/components/AnnouncementCard";
import { shrinkImage } from "@/lib/imageResize";
import { formatLongDate } from "@/lib/time";

const STATUS_STYLE = {
  tayang: { label: "Tayang", cls: "bg-leaf-100 text-leaf-800" },
  dijadwalkan: { label: "Dijadwalkan", cls: "bg-gold-100 text-gold-800" },
  berakhir: { label: "Berakhir", cls: "bg-ink/10 text-ink/60" },
  nonaktif: { label: "Nonaktif", cls: "bg-ink/10 text-ink/60" },
};

const EMPTY = {
  title: "",
  body: "",
  buttonLabel: "",
  buttonUrl: "",
  startsOn: "",
  endsOn: "",
  active: true,
};

function Editor({ editing, limits, onSaved, onCancel }) {
  const [f, setF] = useState(EMPTY);
  const [file, setFile] = useState(null); // foto baru (sudah diperkecil)
  const [removeImage, setRemoveImage] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileInput = useRef(null);
  const [localPreview, setLocalPreview] = useState("");

  // Isi form saat masuk mode edit / reset saat batal.
  useEffect(() => {
    setF(
      editing
        ? {
            title: editing.title,
            body: editing.body || "",
            buttonLabel: editing.buttonLabel || "",
            buttonUrl: editing.buttonUrl || "",
            startsOn: editing.startsOn || "",
            endsOn: editing.endsOn || "",
            active: editing.active,
          }
        : EMPTY
    );
    setFile(null);
    setRemoveImage(false);
    setError("");
    if (fileInput.current) fileInput.current.value = "";
  }, [editing]);

  useEffect(() => {
    if (!file) {
      setLocalPreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setLocalPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function set(k, v) {
    setF((p) => ({ ...p, [k]: v }));
  }

  async function pickFile(e) {
    const picked = e.target.files?.[0];
    if (!picked) return;
    setError("");
    try {
      setFile(await shrinkImage(picked));
      setRemoveImage(false);
    } catch (err) {
      setFile(null);
      setError(err.message || "Gagal memproses foto.");
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function save(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("title", f.title);
      fd.set("body", f.body);
      fd.set("buttonLabel", f.buttonLabel);
      fd.set("buttonUrl", f.buttonUrl);
      fd.set("startsOn", f.startsOn);
      fd.set("endsOn", f.endsOn);
      fd.set("active", String(f.active));
      if (file) fd.set("image", file);
      if (editing && removeImage && !file) fd.set("removeImage", "true");

      const res = await fetch(editing ? `/api/announcements/${editing.id}` : "/api/announcements", {
        method: editing ? "PUT" : "POST",
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Gagal menyimpan.");
        return;
      }
      onSaved();
    } catch {
      setError("Koneksi bermasalah. Coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  const shownImage = localPreview || (!removeImage && editing?.imageUrl) || "";
  const input = "focus-ring w-full rounded-lg border border-ink/15 px-3 py-2 font-body text-sm";

  return (
    <section className="rounded-xl border border-ink/10 bg-white p-4 sm:p-5 mb-8">
      <h2 className="font-display text-lg text-ink mb-3">
        {editing ? "Ubah pengumuman" : "Pengumuman baru"}
      </h2>

      <form onSubmit={save} className="space-y-4">
        <div>
          <label className="block font-body text-xs text-ink/60 mb-1">Judul</label>
          <input
            value={f.title}
            onChange={(e) => set("title", e.target.value)}
            maxLength={limits.title}
            required
            className={input}
            placeholder="mis. Promo Oktober"
          />
        </div>

        <div>
          <label className="block font-body text-xs text-ink/60 mb-1">Isi (opsional)</label>
          <textarea
            value={f.body}
            onChange={(e) => set("body", e.target.value)}
            maxLength={limits.body}
            rows={5}
            className={input}
          />
          <p className="font-body text-xs text-ink/40 mt-1">
            {f.body.length}/{limits.body} karakter. Baris baru ikut tampil.
          </p>
        </div>

        <div>
          <label className="block font-body text-xs text-ink/60 mb-1">Foto (opsional)</label>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            onChange={pickFile}
            className="block w-full font-body text-sm text-ink/70"
          />
          <p className="font-body text-xs text-ink/40 mt-1">
            Foto otomatis diperkecil supaya ringan dibuka member. Satu pengumuman satu foto.
          </p>
          {editing?.imageUrl && !file && (
            <label className="mt-2 flex items-center gap-2 font-body text-sm text-ink/70">
              <input
                type="checkbox"
                checked={removeImage}
                onChange={(e) => setRemoveImage(e.target.checked)}
              />
              Hapus foto yang sekarang
            </label>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block font-body text-xs text-ink/60 mb-1">Label tombol (opsional)</label>
            <input
              value={f.buttonLabel}
              onChange={(e) => set("buttonLabel", e.target.value)}
              maxLength={limits.buttonLabel}
              className={input}
              placeholder="mis. Chat WA"
            />
          </div>
          <div>
            <label className="block font-body text-xs text-ink/60 mb-1">Link tombol (https://…)</label>
            <input
              value={f.buttonUrl}
              onChange={(e) => set("buttonUrl", e.target.value)}
              className={input}
              placeholder="https://wa.me/628…"
              inputMode="url"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block font-body text-xs text-ink/60 mb-1">Mulai tayang (opsional)</label>
            <input
              type="date"
              value={f.startsOn}
              onChange={(e) => set("startsOn", e.target.value)}
              className={input}
            />
          </div>
          <div>
            <label className="block font-body text-xs text-ink/60 mb-1">Selesai tayang (opsional)</label>
            <input
              type="date"
              value={f.endsOn}
              onChange={(e) => set("endsOn", e.target.value)}
              className={input}
            />
          </div>
        </div>
        <p className="font-body text-xs text-ink/40 -mt-2">
          Tanggal kosong = tidak dibatasi. Setelah tanggal selesai, pengumuman hilang sendiri dari
          dashboard member.
        </p>

        <label className="flex items-center gap-2 font-body text-sm text-ink/70">
          <input type="checkbox" checked={f.active} onChange={(e) => set("active", e.target.checked)} />
          Aktif (tampil ke member sesuai tanggal di atas)
        </label>

        {f.title.trim() && (
          <div>
            <p className="font-body text-xs text-ink/60 mb-1">Pratinjau di dashboard member</p>
            <div className="max-w-sm">
              <AnnouncementCard
                title={f.title.trim()}
                body={f.body.trim()}
                imageUrl={shownImage}
                buttonLabel={f.buttonLabel.trim()}
                buttonUrl={f.buttonUrl.trim()}
              />
            </div>
          </div>
        )}

        {error && <p className="font-body text-xs text-red-600">{error}</p>}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={busy || !f.title.trim()}
            className="focus-ring rounded-lg bg-leaf-700 hover:bg-leaf-800 text-white font-body text-sm font-medium px-4 py-2 disabled:opacity-40"
          >
            {busy ? "Menyimpan..." : editing ? "Simpan perubahan" : "Simpan pengumuman"}
          </button>
          {editing && (
            <button
              type="button"
              onClick={onCancel}
              className="focus-ring font-body text-sm text-ink/50 hover:text-ink"
            >
              Batal
            </button>
          )}
        </div>
      </form>
    </section>
  );
}

function periodText(a) {
  if (a.startsOn && a.endsOn) return `${formatLongDate(a.startsOn)} – ${formatLongDate(a.endsOn)}`;
  if (a.startsOn) return `Mulai ${formatLongDate(a.startsOn)}`;
  if (a.endsOn) return `Sampai ${formatLongDate(a.endsOn)}`;
  return "Tanpa batas tanggal";
}

export default function InfoMemberPage() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null);
  const [busyId, setBusyId] = useState(null);

  async function load() {
    const res = await fetch("/api/announcements");
    if (res.status === 401) {
      router.push("/staff/login");
      return;
    }
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Gagal memuat.");
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

  function afterSave() {
    setEditing(null);
    load();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function toggleActive(a) {
    setBusyId(a.id);
    try {
      const fd = new FormData();
      fd.set("title", a.title);
      fd.set("body", a.body || "");
      fd.set("buttonLabel", a.buttonLabel || "");
      fd.set("buttonUrl", a.buttonUrl || "");
      fd.set("startsOn", a.startsOn || "");
      fd.set("endsOn", a.endsOn || "");
      fd.set("active", String(!a.active));
      const res = await fetch(`/api/announcements/${a.id}`, { method: "PUT", body: fd });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j.error || "Gagal mengubah status.");
      }
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function remove(a) {
    if (!window.confirm(`Hapus "${a.title}"? Fotonya ikut terhapus dan tidak bisa dikembalikan.`)) return;
    setBusyId(a.id);
    try {
      const res = await fetch(`/api/announcements/${a.id}`, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j.error || "Gagal menghapus.");
      }
      if (editing?.id === a.id) setEditing(null);
      await load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#fbf9f4] px-4 py-6 sm:px-6 sm:py-10">
      <div className="max-w-3xl mx-auto">
        <div className="flex flex-col gap-3 mb-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-body text-xs text-ink/40 uppercase tracking-wide">
              Banana Leaf Membership
            </p>
            <h1 className="font-display text-2xl text-ink">Kelola Info Member</h1>
          </div>
          <Link
            href="/staff/dashboard"
            className="focus-ring font-body text-sm text-ink/50 hover:text-ink"
          >
            &larr; Kembali ke Dashboard
          </Link>
        </div>

        <p className="font-body text-sm text-ink/60 mb-6">
          Pengumuman dan promo yang tampil di dashboard member setelah mereka login (maksimal 5
          terbaru yang sedang tayang). Atur tanggal selesai supaya info lama hilang sendiri.
        </p>

        {loading && <p className="font-body text-sm text-ink/50">Memuat...</p>}
        {!loading && error && <p className="font-body text-sm text-red-600">{error}</p>}

        {!loading && data && (
          <>
            <Editor
              editing={editing}
              limits={data.limits}
              onSaved={afterSave}
              onCancel={() => setEditing(null)}
            />

            <h2 className="font-display text-lg text-ink mb-3">Daftar pengumuman</h2>
            {data.announcements.length === 0 && (
              <p className="font-body text-sm text-ink/40">Belum ada pengumuman.</p>
            )}
            <div className="flex flex-col gap-3">
              {data.announcements.map((a) => {
                const st = STATUS_STYLE[a.status] || STATUS_STYLE.nonaktif;
                return (
                  <div key={a.id} className="rounded-xl border border-ink/10 bg-white p-4 flex gap-3">
                    {a.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={a.imageUrl}
                        alt=""
                        loading="lazy"
                        className="w-16 h-16 rounded-lg object-cover shrink-0"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-body text-sm font-medium text-ink break-words">{a.title}</p>
                        <span className={`rounded-full px-2 py-0.5 font-body text-xs ${st.cls}`}>
                          {st.label}
                        </span>
                      </div>
                      <p className="font-body text-xs text-ink/40 mt-0.5">{periodText(a)}</p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                        <button
                          onClick={() => {
                            setEditing(a);
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                          className="focus-ring font-body text-sm text-leaf-700 hover:text-leaf-900"
                        >
                          Ubah
                        </button>
                        <button
                          onClick={() => toggleActive(a)}
                          disabled={busyId === a.id}
                          className="focus-ring font-body text-sm text-ink/60 hover:text-ink disabled:opacity-40"
                        >
                          {a.active ? "Nonaktifkan" : "Aktifkan"}
                        </button>
                        <button
                          onClick={() => remove(a)}
                          disabled={busyId === a.id}
                          className="focus-ring font-body text-sm text-red-600 hover:text-red-700 disabled:opacity-40"
                        >
                          Hapus
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
