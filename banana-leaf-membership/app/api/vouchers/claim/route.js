import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSession, STAFF_COOKIE } from "@/lib/session";
import { todayWib } from "@/lib/time";
import { normalizeVoucherCode } from "@/lib/promo";

// Tandai voucher sudah dipakai. Satu perintah UPDATE bersyarat (belum dipakai &
// belum kedaluwarsa) supaya dua kasir yang menekan bersamaan tidak sama-sama berhasil.
export async function POST(request) {
  try {
    const session = await getSession(request, STAFF_COOKIE);
    if (!session || session.role !== "staff") {
      return NextResponse.json({ error: "Harus login sebagai staff." }, { status: 401 });
    }

    const { code: rawCode } = await request.json();
    const code = normalizeVoucherCode(rawCode);
    if (!code) return NextResponse.json({ error: "Kode voucher wajib diisi." }, { status: 400 });

    const supabase = supabaseAdmin();
    const { data: claimed, error } = await supabase
      .from("vouchers")
      .update({ claimed_at: new Date().toISOString(), claimed_by: session.username })
      .eq("code", code)
      .is("claimed_at", null)
      .gte("valid_until", todayWib())
      .select("code")
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    if (!claimed) {
      const { data: v } = await supabase
        .from("vouchers")
        .select("claimed_at, claimed_by, valid_until")
        .eq("code", code)
        .maybeSingle();
      if (!v) return NextResponse.json({ error: "Kode voucher tidak ditemukan." }, { status: 404 });
      if (v.claimed_at) {
        return NextResponse.json(
          { error: `Voucher ini sudah dipakai${v.claimed_by ? ` (dicatat oleh ${v.claimed_by})` : ""}.` },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: "Voucher ini sudah kedaluwarsa." }, { status: 409 });
    }

    return NextResponse.json({ ok: true, code: claimed.code });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
