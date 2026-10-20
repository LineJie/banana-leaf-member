import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSession, STAFF_COOKIE } from "@/lib/session";
import {
  COLUMNS,
  MAX_TITLE,
  MAX_BODY,
  MAX_BUTTON_LABEL,
  MAX_IMAGE_BYTES,
  parseFields,
  readImage,
  uploadImage,
  removeImage,
  toOwnerShape,
} from "@/lib/announcements";

async function requireOwner(request) {
  const session = await getSession(request, STAFF_COOKIE);
  if (!session || session.role !== "staff" || session.staffRole !== "owner") return null;
  return session;
}

// Daftar semua pengumuman (termasuk nonaktif/berakhir) — khusus owner.
export async function GET(request) {
  try {
    if (!(await requireOwner(request))) {
      return NextResponse.json({ error: "Cuma owner yang bisa kelola Info Member." }, { status: 403 });
    }

    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("member_announcements")
      .select(COLUMNS)
      .order("created_at", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      ok: true,
      announcements: (data || []).map((a) => toOwnerShape(supabase, a)),
      limits: {
        title: MAX_TITLE,
        body: MAX_BODY,
        buttonLabel: MAX_BUTTON_LABEL,
        imageBytes: MAX_IMAGE_BYTES,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Buat pengumuman baru. Body: multipart/form-data (teks + file "image" opsional),
// supaya foto dan teks tersimpan dalam satu request (tidak ada foto yatim kalau
// simpan teks gagal).
export async function POST(request) {
  let uploadedPath = null;
  const supabase = supabaseAdmin();
  try {
    const session = await requireOwner(request);
    if (!session) {
      return NextResponse.json({ error: "Cuma owner yang bisa kelola Info Member." }, { status: 403 });
    }

    const form = await request.formData();
    const parsed = parseFields(form);
    if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const img = await readImage(form);
    if (img.error) return NextResponse.json({ error: img.error }, { status: 400 });

    if (img.file) uploadedPath = await uploadImage(supabase, img.file);

    const { data, error } = await supabase
      .from("member_announcements")
      .insert({ ...parsed.fields, image_path: uploadedPath, updated_by: session.username })
      .select(COLUMNS)
      .single();

    if (error) {
      await removeImage(supabase, uploadedPath);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, announcement: toOwnerShape(supabase, data) });
  } catch (err) {
    await removeImage(supabase, uploadedPath);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
