import { NextResponse } from "next/server";
import { randomInt } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSession, STAFF_COOKIE } from "@/lib/session";
import { hashSecret } from "@/lib/hash";
import { resetAttempts } from "@/lib/rateLimit";

export async function POST(request, { params }) {
  try {
    const session = await getSession(request, STAFF_COOKIE);
    if (!session || session.role !== "staff") {
      return NextResponse.json({ error: "Harus login sebagai staff." }, { status: 401 });
    }

    const { id } = await params;
    const supabase = supabaseAdmin();

    const { data: member, error: memberErr } = await supabase
      .from("members")
      .select("id, name, whatsapp_number")
      .eq("id", id)
      .maybeSingle();

    if (memberErr || !member) {
      return NextResponse.json({ error: "Member tidak ditemukan." }, { status: 404 });
    }

    // PIN baru acak (sama seperti pas daftar pertama kali) — bukan staff yang
    // ngetik manual, biar gak ada pola yang gampang ditebak.
    const newPin = String(randomInt(100000, 999999));
    const pinHash = await hashSecret(newPin);

    const { error: updateErr } = await supabase
      .from("members")
      .update({ pin_hash: pinHash })
      .eq("id", id);

    if (updateErr) throw updateErr;

    // Kalau member sempat kekunci gara-gara salah PIN berkali-kali, buka lagi
    // kuncinya sekalian biar bisa langsung login pakai PIN baru.
    await resetAttempts(supabase, `member:${member.whatsapp_number}`);

    return NextResponse.json({
      ok: true,
      newPin,
      memberName: member.name,
      note: "PIN lama otomatis gak berlaku lagi. Kasih tau PIN baru ini ke member sekarang, soalnya cuma ditampilkan sekali. Member yang sedang login akan otomatis keluar.",
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
