import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSession, STAFF_COOKIE } from "@/lib/session";
import { compareSecret, hashSecret } from "@/lib/hash";

export async function POST(request) {
  try {
    const session = await getSession(request, STAFF_COOKIE);
    if (!session || session.role !== "staff") {
      return NextResponse.json({ error: "Harus login." }, { status: 401 });
    }

    const { currentPassword, newPassword } = await request.json();
    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: "Password lama dan password baru wajib diisi." },
        { status: 400 }
      );
    }
    if (String(newPassword).length < 6) {
      return NextResponse.json(
        { error: "Password baru minimal 6 karakter." },
        { status: 400 }
      );
    }

    const supabase = supabaseAdmin();
    const { data: staff } = await supabase
      .from("staff")
      .select("id, password_hash")
      .eq("id", session.staffId)
      .maybeSingle();

    if (!staff) {
      return NextResponse.json({ error: "Akun tidak ditemukan." }, { status: 404 });
    }

    const valid = await compareSecret(currentPassword, staff.password_hash);
    if (!valid) {
      return NextResponse.json({ error: "Password lama salah." }, { status: 401 });
    }

    const newHash = await hashSecret(newPassword);
    const { error } = await supabase
      .from("staff")
      .update({ password_hash: newHash })
      .eq("id", staff.id);

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
