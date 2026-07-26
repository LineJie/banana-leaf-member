import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSession, STAFF_COOKIE } from "@/lib/session";

export async function GET(request) {
  try {
    const session = await getSession(request, STAFF_COOKIE);
    if (!session || session.role !== "staff") {
      return NextResponse.json({ error: "Harus login sebagai staff." }, { status: 401 });
    }

    const supabase = supabaseAdmin();
    const now = new Date();
    const startOfDay = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0)
    );
    const startOfDayIso = startOfDay.toISOString();

    const { data: newMembers, error: memberError } = await supabase
      .from("members")
      .select("id, name, whatsapp_number, created_at")
      .gte("created_at", startOfDayIso)
      .order("created_at", { ascending: false });
    if (memberError) {
      return NextResponse.json({ error: memberError.message }, { status: 500 });
    }

    const { data: txns, error: txnError } = await supabase
      .from("transactions")
      .select("id, member_id, type, points, amount_spent, description, created_by, created_at")
      .gte("created_at", startOfDayIso)
      .order("created_at", { ascending: false });
    if (txnError) {
      return NextResponse.json({ error: txnError.message }, { status: 500 });
    }

    const memberIds = Array.from(
      new Set((txns || []).map((t) => t.member_id).filter(Boolean))
    );

    let memberMap = new Map();
    if (memberIds.length > 0) {
      const { data: relatedMembers, error: relatedError } = await supabase
        .from("members")
        .select("id, name, whatsapp_number")
        .in("id", memberIds);
      if (relatedError) {
        return NextResponse.json({ error: relatedError.message }, { status: 500 });
      }
      memberMap = new Map((relatedMembers || []).map((m) => [m.id, m]));
    }

    const todayTransactions = (txns || []).map((t) => {
      const m = memberMap.get(t.member_id);
      return {
        id: t.id,
        memberId: t.member_id,
        name: m?.name ?? "-",
        whatsappNumber: m?.whatsapp_number ?? "-",
        type: t.type,
        points: t.points,
        amountSpent: t.amount_spent,
        description: t.description,
        createdBy: t.created_by,
        createdAt: t.created_at,
      };
    });

    return NextResponse.json({
      newMembers: newMembers || [],
      todayTransactions,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Terjadi kesalahan." }, { status: 500 });
  }
}
