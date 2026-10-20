import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSession, STAFF_COOKIE } from "@/lib/session";
import {
  COLUMNS,
  parseFields,
  readImage,
  uploadImage,
  removeImage,
  toOwnerShape,
} from "@/lib/announcements";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function requireOwner(request) {
  const session = await getSession(request, STAFF_COOKIE);
  if (!session || session.role !== "staff" || session.staffRole !== "owner") return null;
  return session;
}

// Ubah pengumuman. Body: multipart/form-data. Field "image" (opsional) mengganti
// foto; field "removeImage=true" menghapus foto tanpa menggantinya.
export async function PUT(request, { params }) {
  let uploadedPath = null;
  const supabase = supabaseAdmin();
  try {
    const session = await requireOwner(request);
    if (!session) {
      return NextResponse.json({ error: "Cuma owner yang bisa kelola Info Member." }, { status: 403 });
    }

    const { id } = await params;
    if (!UUID_RE.test(id)) return NextResponse.json({ error: "ID tidak valid." }, { status: 400 });

    const { data: existing, error: findErr } = await supabase
      .from("member_announcements")
      .select("id, image_path")
      .eq("id", id)
      .maybeSingle();
    if (findErr) return NextResponse.json({ error: findErr.message }, { status: 500 });
    if (!existing) return NextResponse.json({ error: "Pengumuman tidak ditemukan." }, { status: 404 });

    const form = await request.formData();
    const parsed = parseFields(form);
    if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const img = await readImage(form);
    if (img.error) return NextResponse.json({ error: img.error }, { status: 400 });

    const update = {
      ...parsed.fields,
      updated_at: new Date().toISOString(),
      updated_by: session.username,
    };

    let oldToDelete = null;
    if (img.file) {
      uploadedPath = await uploadImage(supabase, img.file);
      update.image_path = uploadedPath;
      oldToDelete = existing.image_path;
    } else if (String(form.get("removeImage") || "") === "true") {
      update.image_path = null;
      oldToDelete = existing.image_path;
    }

    const { data, error } = await supabase
      .from("member_announcements")
      .update(update)
      .eq("id", id)
      .select(COLUMNS)
      .maybeSingle();

    if (error || !data) {
      await removeImage(supabase, uploadedPath);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ error: "Pengumuman tidak ditemukan." }, { status: 404 });
    }

    // Foto lama baru dihapus setelah data baru tersimpan.
    await removeImage(supabase, oldToDelete);

    return NextResponse.json({ ok: true, announcement: toOwnerShape(supabase, data) });
  } catch (err) {
    await removeImage(supabase, uploadedPath);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    if (!(await requireOwner(request))) {
      return NextResponse.json({ error: "Cuma owner yang bisa kelola Info Member." }, { status: 403 });
    }

    const { id } = await params;
    if (!UUID_RE.test(id)) return NextResponse.json({ error: "ID tidak valid." }, { status: 400 });

    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("member_announcements")
      .delete()
      .eq("id", id)
      .select("image_path")
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "Pengumuman tidak ditemukan." }, { status: 404 });

    await removeImage(supabase, data.image_path);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
