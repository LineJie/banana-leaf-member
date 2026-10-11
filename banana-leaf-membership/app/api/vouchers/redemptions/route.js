import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSession, STAFF_COOKIE } from "@/lib/session";

// Riwayat pemakaian satu voucher 'banyak orang': siapa, kapan, dicatat staff siapa.
export async function GET(request) {
  try {
    const session = await getSession(request, STAFF_COOKIE);
    if (!session || session.role !== "staff") {
      return NextResponse.json({ error: "Harus login sebagai staff." }, { status: 401 });
    }

    const voucherId = new URL(request.url).searchParams.get("voucherId");
    if (!voucherId) {
      return NextResponse.json({ error: "voucherId wajib diisi." }, { status: 400 });
    }

    const supabase = supabaseAdmin();
    const { data: rows, error } = await supabase
      .from("voucher_redemptions")
      .select("id, member_id, redeemed_at, redeemed_by")
      .eq("voucher_id", voucherId)
      .order("redeemed_at", { ascending: false })
      .limit(1000);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const memberIds = Array.from(new Set((rows || []).map((r) => r.member_id)));
    const memberMap = new Map();
    for (let i = 0; i < memberIds.length; i += 100) {
      const { data: members, error: memberErr } = await supabase
        .from("members")
        .select("id, name, whatsapp_number")
        .in("id", memberIds.slice(i, i + 100));
      if (memberErr) return NextResponse.json({ error: memberErr.message }, { status: 500 });
      for (const m of members || []) memberMap.set(m.id, m);
    }

    const redemptions = (rows || []).map((r) => ({
      id: r.id,
      memberName: memberMap.get(r.member_id)?.name ?? "-",
      whatsappNumber: memberMap.get(r.member_id)?.whatsapp_number ?? "-",
      redeemedAt: r.redeemed_at,
      redeemedBy: r.redeemed_by,
    }));

    return NextResponse.json({ ok: true, redemptions, truncated: (rows || []).length >= 1000 });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Terjadi kesalahan." }, { status: 500 });
  }
}
