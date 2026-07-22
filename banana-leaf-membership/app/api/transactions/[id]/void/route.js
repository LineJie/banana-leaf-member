import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSession, STAFF_COOKIE } from "@/lib/session";
import { voidTransaction } from "@/lib/points";

export async function POST(request, { params }) {
  try {
    const session = await getSession(request, STAFF_COOKIE);
    if (!session || session.role !== "staff" || session.staffRole !== "owner") {
      return NextResponse.json(
        { error: "Cuma owner yang bisa membatalkan transaksi." },
        { status: 403 }
      );
    }

    const { id } = await params;
    const { reason } = await request.json();

    if (!reason || !reason.trim()) {
      return NextResponse.json(
        { error: "Wajib kasih alasan kenapa membatalkan transaksi." },
        { status: 400 }
      );
    }

    const validReasons = [
      "staff_salah_input",
      "cancel_customer",
      "system_error",
      "duplicate_entry",
      "other",
    ];
    if (!validReasons.includes(reason)) {
      return NextResponse.json(
        { error: `Alasan tidak valid. Pilih: ${validReasons.join(", ")}` },
        { status: 400 }
      );
    }

    const supabase = supabaseAdmin();

    const result = await voidTransaction({
      supabase,
      transactionId: id,
      staffUsername: session.username,
      voidReason: reason,
    });

    return NextResponse.json({ ok: true, voidTransaction: result.voidTransaction });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
