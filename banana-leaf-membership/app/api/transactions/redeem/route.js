import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSession, STAFF_COOKIE } from "@/lib/session";
import { redeemPoints } from "@/lib/points";

export async function POST(request) {
  try {
    const session = await getSession(request, STAFF_COOKIE);
    if (!session || session.role !== "staff") {
      return NextResponse.json({ error: "Harus login sebagai staff." }, { status: 401 });
    }

    const { memberId, points, description, rewardId } = await request.json();

    if (!memberId || !points || !description) {
      return NextResponse.json(
        { error: "Member, jumlah poin, dan keterangan reward wajib diisi." },
        { status: 400 }
      );
    }

    const pointsNum = Number(points);
    if (pointsNum < 1 || pointsNum > 100000) {
      return NextResponse.json(
        { error: "Jumlah poin harus antara 1 sampai 100.000." },
        { status: 400 }
      );
    }

    const supabase = supabaseAdmin();

    // Kalau reward preset dipilih, validasi bahwa points harus sesuai reward's points_cost
    // (staff gak boleh edit points kalau udah pilih preset)
    if (rewardId) {
      const { data: reward, error: rewardErr } = await supabase
        .from("rewards")
        .select("points_cost, name")
        .eq("id", rewardId)
        .maybeSingle();

      if (rewardErr || !reward) {
        return NextResponse.json({ error: "Hadiah tidak ditemukan." }, { status: 404 });
      }

      if (reward.points_cost !== pointsNum) {
        return NextResponse.json({
          error: `Jumlah poin harus ${reward.points_cost} (sesuai hadiah "${reward.name}"). Jangan ubah angka kalau pakai preset hadiah.`,
          status: 400,
        });
      }
    }

    const result = await redeemPoints({
      supabase,
      memberId,
      pointsToRedeem: pointsNum,
      description,
      staffUsername: session.username,
    });

    return NextResponse.json({ ok: true, redeemed: result.redeemed });
  } catch (err) {
    const status = err.code === "INSUFFICIENT_POINTS" ? 400 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
