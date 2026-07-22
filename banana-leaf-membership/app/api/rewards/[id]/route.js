import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSession, STAFF_COOKIE } from "@/lib/session";

export async function PATCH(request, { params }) {
  const session = await getSession(request, STAFF_COOKIE);
  if (!session || session.role !== "staff" || session.staffRole !== "owner") {
    return NextResponse.json({ error: "Cuma owner yang bisa edit hadiah." }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const patch = {};

    if (body.name !== undefined) patch.name = String(body.name).trim();
    if (body.pointsCost !== undefined) {
      const cost = Number(body.pointsCost);
      if (!cost || cost <= 0) {
        return NextResponse.json({ error: "Jumlah poin harus lebih dari 0." }, { status: 400 });
      }
      patch.points_cost = cost;
    }
    if (body.active !== undefined) patch.active = Boolean(body.active);
    patch.updated_at = new Date().toISOString();

    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("rewards")
      .update(patch)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ ok: true, reward: data });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
