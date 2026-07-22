import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSession, STAFF_COOKIE } from "@/lib/session";
import { hashSecret } from "@/lib/hash";

export async function PATCH(request, { params }) {
  const session = await getSession(request, STAFF_COOKIE);
  if (!session || session.role !== "staff" || session.staffRole !== "owner") {
    return NextResponse.json({ error: "Cuma owner yang bisa edit akun staff." }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const patch = {};

    if (body.active !== undefined) {
      if (id === session.staffId && body.active === false) {
        return NextResponse.json(
          { error: "Gak bisa nonaktifkan akun sendiri yang lagi dipakai login." },
          { status: 400 }
        );
      }
      patch.active = Boolean(body.active);
    }

    if (body.role !== undefined) {
      if (id === session.staffId && body.role !== "owner") {
        return NextResponse.json(
          { error: "Gak bisa turunkan role akun sendiri." },
          { status: 400 }
        );
      }
      patch.role = body.role === "owner" ? "owner" : "staff";
    }

    if (body.newPassword) {
      if (String(body.newPassword).length < 6) {
        return NextResponse.json({ error: "Password minimal 6 karakter." }, { status: 400 });
      }
      patch.password_hash = await hashSecret(body.newPassword);
    }

    if (body.name !== undefined) {
      if (!body.name.trim()) {
        return NextResponse.json({ error: "Nama tidak boleh kosong." }, { status: 400 });
      }
      patch.name = body.name.trim();
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "Gak ada yang diubah." }, { status: 400 });
    }

    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("staff")
      .update(patch)
      .eq("id", id)
      .select("id, username, name, role, active, created_at")
      .single();

    if (error) throw error;

    return NextResponse.json({ ok: true, staff: data });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
