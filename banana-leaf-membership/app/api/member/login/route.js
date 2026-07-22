import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { signSession, normalizeWhatsapp, MEMBER_COOKIE } from "@/lib/session";
import { compareSecret } from "@/lib/hash";
import { checkLoginLock, recordFailedAttempt, resetAttempts } from "@/lib/rateLimit";

export async function POST(request) {
  try {
    const { whatsapp, pin } = await request.json();

    if (!whatsapp || !pin) {
      return NextResponse.json(
        { error: "Nomor WhatsApp dan PIN wajib diisi." },
        { status: 400 }
      );
    }

    const waNumber = normalizeWhatsapp(whatsapp);
    const supabase = supabaseAdmin();
    const identifier = `member:${waNumber}`;

    const lock = await checkLoginLock(supabase, identifier);
    if (lock.locked) {
      return NextResponse.json({ error: lock.message }, { status: 429 });
    }

    const { data: member } = await supabase
      .from("members")
      .select("*")
      .eq("whatsapp_number", waNumber)
      .maybeSingle();

    if (!member) {
      await recordFailedAttempt(supabase, identifier);
      return NextResponse.json(
        { error: "Nomor WhatsApp tidak terdaftar sebagai member." },
        { status: 401 }
      );
    }

    const valid = await compareSecret(String(pin), member.pin_hash);
    if (!valid) {
      await recordFailedAttempt(supabase, identifier);
      return NextResponse.json({ error: "PIN salah." }, { status: 401 });
    }

    await resetAttempts(supabase, identifier);

    const token = await signSession(
      { role: "member", memberId: member.id },
      "30d"
    );

    const res = NextResponse.json({ ok: true, name: member.name });
    res.cookies.set(MEMBER_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return res;
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
