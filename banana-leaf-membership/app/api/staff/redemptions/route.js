import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSession, STAFF_COOKIE } from "@/lib/session";
import { resolveRange } from "@/lib/time";

// Daftar penukaran hadiah (redeem) dalam rentang waktu tertentu.
// Batas hari/minggu/bulan dihitung dalam WIB. Transaksi yang sudah dibatalkan
// (void) tetap ditampilkan tapi diberi tanda dan TIDAK dihitung di ringkasan.
export async function GET(request) {
  try {
    const session = await getSession(request, STAFF_COOKIE);
    if (!session || session.role !== "staff") {
      return NextResponse.json({ error: "Harus login sebagai staff." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const range = resolveRange(
      searchParams.get("range") || "month",
      searchParams.get("from"),
      searchParams.get("to")
    );
    if (range.error) {
      return NextResponse.json({ error: range.error }, { status: 400 });
    }

    const supabase = supabaseAdmin();

    const { data: txns, error } = await supabase
      .from("transactions")
      .select("id, member_id, points, description, created_by, created_at, voided")
      .eq("type", "redeem")
      .gte("created_at", range.startIso)
      .lt("created_at", range.endIso)
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const memberIds = Array.from(new Set((txns || []).map((t) => t.member_id).filter(Boolean)));
    const memberMap = new Map();
    for (let i = 0; i < memberIds.length; i += 100) {
      const chunk = memberIds.slice(i, i + 100);
      const { data: members, error: memberError } = await supabase
        .from("members")
        .select("id, name, whatsapp_number")
        .in("id", chunk);
      if (memberError) {
        return NextResponse.json({ error: memberError.message }, { status: 500 });
      }
      for (const m of members || []) memberMap.set(m.id, m);
    }

    const items = (txns || []).map((t) => {
      const m = memberMap.get(t.member_id);
      return {
        id: t.id,
        memberId: t.member_id,
        name: m?.name ?? "-",
        whatsappNumber: m?.whatsapp_number ?? "-",
        reward: t.description || "Redeem poin",
        points: Math.abs(t.points),
        createdBy: t.created_by,
        createdAt: t.created_at,
        voided: Boolean(t.voided),
      };
    });

    const valid = items.filter((i) => !i.voided);
    const byRewardMap = new Map();
    for (const i of valid) {
      const key = i.reward.trim().toLowerCase();
      const entry = byRewardMap.get(key) || { reward: i.reward.trim(), count: 0, points: 0 };
      entry.count += 1;
      entry.points += i.points;
      byRewardMap.set(key, entry);
    }

    return NextResponse.json({
      range: { label: range.label, startIso: range.startIso, endIso: range.endIso },
      totalRedemptions: valid.length,
      totalPoints: valid.reduce((sum, i) => sum + i.points, 0),
      uniqueMembers: new Set(valid.map((i) => i.memberId)).size,
      voidedCount: items.length - valid.length,
      byReward: Array.from(byRewardMap.values()).sort((a, b) => b.count - a.count),
      items,
      truncated: (txns || []).length >= 1000,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Terjadi kesalahan." }, { status: 500 });
  }
}
