import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSession, STAFF_COOKIE } from "@/lib/session";
import { todayWib } from "@/lib/time";
import { normalizeVoucherCode } from "@/lib/promo";

// Tandai voucher sudah dipakai.
//  - 'single': satu perintah UPDATE bersyarat (belum dipakai & belum kedaluwarsa)
//    supaya dua kasir yang menekan bersamaan tidak sama-sama berhasil.
//  - 'shared': butuh memberId. Satu member hanya bisa memakai 1x (dijaga unique
//    constraint di database); batas total (max_uses) dicek setelah insert.
export async function POST(request) {
  try {
    const session = await getSession(request, STAFF_COOKIE);
    if (!session || session.role !== "staff") {
      return NextResponse.json({ error: "Harus login sebagai staff." }, { status: 401 });
    }

    const { code: rawCode, memberId } = await request.json();
    const code = normalizeVoucherCode(rawCode);
    if (!code) return NextResponse.json({ error: "Kode voucher wajib diisi." }, { status: 400 });

    const supabase = supabaseAdmin();
    const { data: voucher, error: findErr } = await supabase
      .from("vouchers")
      .select("id, code, kind, max_uses, valid_until, claimed_at, claimed_by")
      .eq("code", code)
      .maybeSingle();
    if (findErr) return NextResponse.json({ error: findErr.message }, { status: 500 });
    if (!voucher) return NextResponse.json({ error: "Kode voucher tidak ditemukan." }, { status: 404 });

    if (voucher.kind === "shared") {
      return await claimShared({ supabase, voucher, memberId, session });
    }

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

async function claimShared({ supabase, voucher, memberId, session }) {
  if (String(voucher.valid_until) < todayWib()) {
    return NextResponse.json({ error: "Voucher ini sudah kedaluwarsa." }, { status: 409 });
  }
  if (!memberId) {
    return NextResponse.json(
      { error: "Pilih member yang memakai voucher ini (voucher ini untuk banyak orang)." },
      { status: 400 }
    );
  }

  const { data: member, error: memberErr } = await supabase
    .from("members")
    .select("id, name")
    .eq("id", memberId)
    .maybeSingle();
  if (memberErr) return NextResponse.json({ error: memberErr.message }, { status: 500 });
  if (!member) return NextResponse.json({ error: "Member tidak ditemukan." }, { status: 404 });

  const { data: inserted, error: insErr } = await supabase
    .from("voucher_redemptions")
    .insert({ voucher_id: voucher.id, member_id: member.id, redeemed_by: session.username })
    .select("id")
    .single();
  if (insErr) {
    if (insErr.code === "23505") {
      return NextResponse.json({ error: `${member.name} sudah pernah memakai voucher ini.` }, { status: 409 });
    }
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  const { count, error: countErr } = await supabase
    .from("voucher_redemptions")
    .select("id", { count: "exact", head: true })
    .eq("voucher_id", voucher.id);
  if (countErr) return NextResponse.json({ error: countErr.message }, { status: 500 });

  // Batas total terlewati (mis. dua kasir menekan bersamaan di pemakaian terakhir): batalkan yang ini.
  if (voucher.max_uses != null && count > voucher.max_uses) {
    await supabase.from("voucher_redemptions").delete().eq("id", inserted.id);
    return NextResponse.json({ error: "Voucher ini sudah habis (batas pemakaian tercapai)." }, { status: 409 });
  }

  return NextResponse.json({ ok: true, code: voucher.code, memberName: member.name, usedCount: count });
}
