import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSession, MEMBER_COOKIE } from "@/lib/session";
import { compareSecret, hashSecret } from "@/lib/hash";

export async function POST(request) {
  try {
    const session = await getSession(request, MEMBER_COOKIE);
    if (!session || session.role !== "member") {
      return NextResponse.json({ error: "Harus login sebagai member." }, { status: 401 });
    }

    const { currentPin, newPin } = await request.json();
    if (!currentPin || !newPin) {
      return NextResponse.json({ error: "PIN lama dan PIN baru wajib diisi." }, { status: 400 });
    }
    if (!/^[0-9]{4,6}$/.test(String(newPin))) {
      return NextResponse.json({ error: "PIN baru harus 4-6 digit angka." }, { status: 400 });
    }

    const supabase = supabaseAdmin();
    const { data: member } = await supabase
      .from("members")
      .select("id, pin_hash, whatsapp_number")
      .eq("id", session.memberId)
      .maybeSingle();

    if (!member) {
      return NextResponse.json({ error: "Member tidak ditemukan." }, { status: 404 });
    }

    if (String(newPin) === String(currentPin)) {
      return NextResponse.json({ error: "PIN baru harus berbeda dari PIN lama." }, { status: 400 });
    }
    // 4 digit terakhir nomor WA = PIN default yang diketahui staff, jadi tidak boleh dipakai lagi.
    if (String(newPin) === String(member.whatsapp_number).slice(-4)) {
      return NextResponse.json(
        { error: "PIN baru tidak boleh sama dengan 4 digit terakhir nomor WhatsApp." },
        { status: 400 }
      );
    }

    const valid = await compareSecret(String(currentPin), member.pin_hash);
    if (!valid) {
      return NextResponse.json({ error: "PIN lama salah." }, { status: 401 });
    }

    const newHash = await hashSecret(String(newPin));
    const { error } = await supabase
      .from("members")
      .update({ pin_hash: newHash, must_change_pin: false })
      .eq("id", member.id);

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
