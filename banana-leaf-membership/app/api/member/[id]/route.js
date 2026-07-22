import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSession, normalizeWhatsapp, STAFF_COOKIE } from "@/lib/session";
import { getMemberPointsSummary } from "@/lib/points";

export async function GET(request, { params }) {
  try {
    const session = await getSession(request, STAFF_COOKIE);
    if (!session || session.role !== "staff") {
      return NextResponse.json({ error: "Harus login sebagai staff." }, { status: 401 });
    }

    const { id } = await params;
    const supabase = supabaseAdmin();
    const { data: member, error } = await supabase
      .from("members")
      .select("id, whatsapp_number, name, created_at")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    if (!member) {
      return NextResponse.json({ error: "Member tidak ditemukan." }, { status: 404 });
    }

    const summary = await getMemberPointsSummary({ supabase, memberId: member.id });

    const { data: history } = await supabase
      .from("transactions")
      .select("*")
      .eq("member_id", member.id)
      .order("created_at", { ascending: false })
      .limit(50);

    return NextResponse.json({
      ok: true,
      member,
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

export async function PATCH(request, { params }) {
  try {
    const session = await getSession(request, STAFF_COOKIE);
    if (!session || session.role !== "staff" || session.staffRole !== "owner") {
      return NextResponse.json({ error: "Cuma owner yang bisa edit data customer." }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const patch = {};

    if (body.name !== undefined) {
      if (!body.name.trim()) {
        return NextResponse.json({ error: "Nama tidak boleh kosong." }, { status: 400 });
      }
      patch.name = body.name.trim();
    }

    // Nomor WhatsApp adalah unique identifier & login username — gak boleh diubah.
    // Kalau member butuh ganti nomor, harus daftar akun baru.
    if (body.whatsapp !== undefined) {
      return NextResponse.json(
        { error: "Nomor WhatsApp tidak bisa diubah. Kalau member butuh ganti nomor, harus daftar ulang jadi member baru." },
        { status: 403 }
      );
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "Gak ada yang diubah." }, { status: 400 });
    }

    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("members")
      .update(patch)
      .eq("id", id)
      .select("id, whatsapp_number, name, created_at")
      .single();

    if (error) throw error;

    return NextResponse.json({ ok: true, member: data });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
