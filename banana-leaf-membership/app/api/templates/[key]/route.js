import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSession, STAFF_COOKIE } from "@/lib/session";
import { validateTemplateBody } from "@/lib/template";

export async function PUT(request, { params }) {
  try {
    const session = await getSession(request, STAFF_COOKIE);
    if (!session || session.role !== "staff" || session.staffRole !== "owner") {
      return NextResponse.json({ error: "Cuma owner yang bisa ubah pesan WA." }, { status: 403 });
    }

    const { key } = await params;
    const { body, validUntil } = await request.json();

    const problem = validateTemplateBody(key, body);
    if (problem) return NextResponse.json({ error: problem }, { status: 400 });

    let validUntilValue = null;
    if (validUntil) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(validUntil)) || Number.isNaN(Date.parse(validUntil))) {
        return NextResponse.json({ error: "Tanggal berlaku tidak valid." }, { status: 400 });
      }
      validUntilValue = String(validUntil);
    }

    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("message_templates")
      .update({
        body: String(body),
        valid_until: validUntilValue,
        updated_at: new Date().toISOString(),
        updated_by: session.username,
      })
      .eq("key", key)
      .select("key, title, body, valid_until, updated_at, updated_by")
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "Template tidak ditemukan." }, { status: 404 });

    return NextResponse.json({ ok: true, template: data });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
