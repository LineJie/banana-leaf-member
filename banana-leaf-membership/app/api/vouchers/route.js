import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSession, STAFF_COOKIE } from "@/lib/session";
import { todayWib } from "@/lib/time";
import { normalizeVoucherCode } from "@/lib/promo";

function statusOf(v, today) {
  if (v.claimed_at) return "claimed";
  if (String(v.valid_until) < today) return "expired";
  return "active";
}

// Cek satu kode (?code=BL-XXXXXX) atau lihat daftar voucher terbaru (?status=active|claimed|expired).
export async function GET(request) {
  try {
    const session = await getSession(request, STAFF_COOKIE);
    if (!session || session.role !== "staff") {
      return NextResponse.json({ error: "Harus login sebagai staff." }, { status: 401 });
    }

    const supabase = supabaseAdmin();
    const { searchParams } = new URL(request.url);
    const today = todayWib();
    const codeParam = searchParams.get("code");

    let query = supabase
      .from("vouchers")
      .select("id, code, member_id, template_key, valid_until, issued_at, claimed_at, claimed_by")
      .order("issued_at", { ascending: false })
      .limit(100);

    if (codeParam) {
      query = supabase
        .from("vouchers")
        .select("id, code, member_id, template_key, valid_until, issued_at, claimed_at, claimed_by")
        .eq("code", normalizeVoucherCode(codeParam))
        .limit(1);
    } else {
      const status = searchParams.get("status");
      if (status === "claimed") query = query.not("claimed_at", "is", null);
      else if (status === "active") query = query.is("claimed_at", null).gte("valid_until", today);
      else if (status === "expired") query = query.is("claimed_at", null).lt("valid_until", today);
    }

    const { data: rows, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const memberIds = Array.from(new Set((rows || []).map((v) => v.member_id)));
    const memberMap = new Map();
    for (let i = 0; i < memberIds.length; i += 100) {
      const { data: members } = await supabase
        .from("members")
        .select("id, name, whatsapp_number")
        .in("id", memberIds.slice(i, i + 100));
      for (const m of members || []) memberMap.set(m.id, m);
    }

    const vouchers = (rows || []).map((v) => ({
      id: v.id,
      code: v.code,
      templateKey: v.template_key,
      validUntil: v.valid_until,
      issuedAt: v.issued_at,
      claimedAt: v.claimed_at,
      claimedBy: v.claimed_by,
      status: statusOf(v, today),
      memberName: memberMap.get(v.member_id)?.name ?? "-",
      whatsappNumber: memberMap.get(v.member_id)?.whatsapp_number ?? "-",
    }));

    if (codeParam && vouchers.length === 0) {
      return NextResponse.json({ error: "Kode voucher tidak ditemukan." }, { status: 404 });
    }

    return NextResponse.json({ ok: true, vouchers });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
