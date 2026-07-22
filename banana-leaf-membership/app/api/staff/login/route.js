import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { signSession, STAFF_COOKIE } from "@/lib/session";
import { compareSecret } from "@/lib/hash";
import { checkLoginLock, recordFailedAttempt, resetAttempts } from "@/lib/rateLimit";

export async function POST(request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username dan password wajib diisi." },
        { status: 400 }
      );
    }

    const supabase = supabaseAdmin();
    const identifier = `staff:${username.trim().toLowerCase()}`;

    const lock = await checkLoginLock(supabase, identifier);
    if (lock.locked) {
      return NextResponse.json({ error: lock.message }, { status: 429 });
    }

    const { data: staff } = await supabase
      .from("staff")
      .select("*")
      .eq("username", username.trim())
      .maybeSingle();

    if (!staff) {
      await recordFailedAttempt(supabase, identifier);
      return NextResponse.json(
        { error: "Username atau password salah." },
        { status: 401 }
      );
    }

    const valid = await compareSecret(password, staff.password_hash);
    if (!valid) {
      await recordFailedAttempt(supabase, identifier);
      return NextResponse.json(
        { error: "Username atau password salah." },
        { status: 401 }
      );
    }

    await resetAttempts(supabase, identifier);

    const token = await signSession(
      {
        role: "staff",
        staffId: staff.id,
        username: staff.username,
        name: staff.name,
        staffRole: staff.role || "staff",
      },
      "8h"
    );

    const res = NextResponse.json({ ok: true, name: staff.name, staffRole: staff.role || "staff" });
    res.cookies.set(STAFF_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 8,
    });
    return res;
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
