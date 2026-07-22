import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSession, STAFF_COOKIE } from "@/lib/session";

export async function GET(request) {
  const session = await getSession(request, STAFF_COOKIE);
  if (!session || session.role !== "staff") {
    return NextResponse.json({ error: "Harus login sebagai staff." }, { status: 401 });
  }

  const includeInactive =
    request.nextUrl.searchParams.get("includeInactive") === "true" &&
    session.staffRole === "owner";

  const supabase = supabaseAdmin();
  let query = supabase.from("rewards").select("*").order("points_cost", { ascending: true });
  if (!includeInactive) {
    query = query.eq("active", true);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, rewards: data || [] });
}

export async function POST(request) {
  const session = await getSession(request, STAFF_COOKIE);
  if (!session || session.role !== "staff" || session.staffRole !== "owner") {
    return NextResponse.json({ error: "Cuma owner yang bisa nambah hadiah." }, { status: 403 });
  }

  try {
    const { name, pointsCost } = await request.json();
    const cost = Number(pointsCost);

    if (!name || !cost || cost <= 0) {
      return NextResponse.json(
        { error: "Nama hadiah dan jumlah poin (>0) wajib diisi." },
        { status: 400 }
      );
    }

    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("rewards")
      .insert({ name: name.trim(), points_cost: cost })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ ok: true, reward: data });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
