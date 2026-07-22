import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSession, STAFF_COOKIE } from "@/lib/session";
import { earnPoints, calcPointsFromAmount } from "@/lib/points";

export async function POST(request) {
  try {
    const session = await getSession(request, STAFF_COOKIE);
    if (!session || session.role !== "staff") {
      return NextResponse.json({ error: "Harus login sebagai staff." }, { status: 401 });
    }

    const { memberId, amountSpent, note } = await request.json();
    const amount = Number(amountSpent);

    if (!memberId || !amount || amount <= 0) {
      return NextResponse.json(
        { error: "Member dan nominal belanja wajib diisi dengan benar." },
        { status: 400 }
      );
    }

    const supabase = supabaseAdmin();
    const result = await earnPoints({
      supabase,
      memberId,
      amountSpent: amount,
      staffUsername: session.username,
      note,
    });

    return NextResponse.json({
      ok: true,
      pointsEarned: result.points,
      preview: calcPointsFromAmount(amount),
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
