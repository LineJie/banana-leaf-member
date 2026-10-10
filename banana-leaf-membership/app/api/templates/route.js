import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSession, STAFF_COOKIE } from "@/lib/session";
import { ALLOWED_VARS, VAR_HELP, MAX_BODY_LENGTH } from "@/lib/template";
import { templateProblem } from "@/lib/promo";

export async function GET(request) {
  try {
    const session = await getSession(request, STAFF_COOKIE);
    if (!session || session.role !== "staff" || session.staffRole !== "owner") {
      return NextResponse.json({ error: "Cuma owner yang bisa kelola pesan WA." }, { status: 403 });
    }

    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("message_templates")
      .select("key, title, body, valid_until, updated_at, updated_by")
      .order("key", { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const templates = (data || []).map((t) => ({
      ...t,
      allowedVars: ALLOWED_VARS[t.key] || [],
      problem: templateProblem(t),
    }));

    return NextResponse.json({ ok: true, templates, varHelp: VAR_HELP, maxLength: MAX_BODY_LENGTH });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
