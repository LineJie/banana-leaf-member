import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSession, MEMBER_COOKIE } from "@/lib/session";
import { getMemberPointsSummary } from "@/lib/points";

export async function GET(request) {
  try {
    const session = await getSession(request, MEMBER_COOKIE);
    if (!session || session.role !== "member") {
      return NextResponse.json({ error: "Harus login sebagai member." }, { status: 401 });
    }

    const supabase = supabaseAdmin();
    const { data: member, error } = await supabase
      .from("members")
      .select("*")
      .eq("id", session.memberId)
      .maybeSingle();

    if (error) throw error;
    if (!member) {
      return NextResponse.json({ error: "Member tidak ditemukan." }, { status: 404 });
    }

    const summary = await getMemberPointsSummary({ supabase, memberId: member.id });
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

    const { data: history } = await supabase
      .from("transactions")
      .select("*")
      .eq("member_id", member.id)
      .gte("created_at", ninetyDaysAgo)
      .order("created_at", { ascending: false })
      .limit(50);

    return NextResponse.json({
      ok: true,
      member: {
        id: member.id,
        whatsapp_number: member.whatsapp_number,
        name: member.name,
        created_at: member.created_at,
      },
      mustChangePin: Boolean(member.must_change_pin),
      totalPoints: summary.totalPoints,
      expiringSoonPoints: summary.expiringSoonPoints,
      expiringSoonDate: summary.expiringSoonDate,
      batches: summary.batches,
      history: history || [],
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
