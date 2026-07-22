import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSession, normalizeWhatsapp, STAFF_COOKIE } from "@/lib/session";

export async function GET(request) {
  try {
    const session = await getSession(request, STAFF_COOKIE);
    if (!session || session.role !== "staff") {
      return NextResponse.json({ error: "Harus login sebagai staff." }, { status: 401 });
    }

    const q = (request.nextUrl.searchParams.get("q") || "").trim();
    if (!q) {
      return NextResponse.json({ ok: true, members: [] });
    }

    const supabase = supabaseAdmin();
    const waGuess = normalizeWhatsapp(q);

    // Dua query terpisah & di-parameterkan (bukan string mentah digabung),
    // supaya karakter aneh di input pencarian gak bisa ubah struktur query.
    const [byWhatsapp, byName] = await Promise.all([
      supabase
        .from("members")
        .select("id, whatsapp_number, name, created_at")
        .ilike("whatsapp_number", `%${waGuess || q}%`)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("members")
        .select("id, whatsapp_number, name, created_at")
        .ilike("name", `%${q}%`)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    if (byWhatsapp.error) throw byWhatsapp.error;
    if (byName.error) throw byName.error;

    const seen = new Set();
    const merged = [];
    for (const row of [...(byWhatsapp.data || []), ...(byName.data || [])]) {
      if (!seen.has(row.id)) {
        seen.add(row.id);
        merged.push(row);
      }
    }

    return NextResponse.json({ ok: true, members: merged.slice(0, 20) });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

