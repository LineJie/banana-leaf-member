import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSession, STAFF_COOKIE } from "@/lib/session";
import { hashSecret } from "@/lib/hash";

export async function GET(request) {
  const session = await getSession(request, STAFF_COOKIE);
  if (!session || session.role !== "staff" || session.staffRole !== "owner") {
    return NextResponse.json({ error: "Cuma owner yang bisa lihat daftar staff." }, { status: 403 });
  }

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("staff")
    .select("id, username, name, role, active, created_at")
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, staff: data || [] });
}

export async function POST(request) {
  const session = await getSession(request, STAFF_COOKIE);
  if (!session || session.role !== "staff" || session.staffRole !== "owner") {
    return NextResponse.json({ error: "Cuma owner yang bisa nambah akun staff." }, { status: 403 });
  }

  try {
    const { username, password, name, role } = await request.json();

    if (!username || !password || !name) {
      return NextResponse.json(
        { error: "Username, password, dan nama wajib diisi." },
        { status: 400 }
      );
    }
    if (String(password).length < 6) {
      return NextResponse.json({ error: "Password minimal 6 karakter." }, { status: 400 });
    }
    const finalRole = role === "owner" ? "owner" : "staff";
    const cleanUsername = username.trim().toLowerCase();

    const supabase = supabaseAdmin();

    const { data: existing } = await supabase
      .from("staff")
      .select("id")
      .eq("username", cleanUsername)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: "Username ini sudah dipakai." }, { status: 409 });
    }

    const passwordHash = await hashSecret(password);
    const { data, error } = await supabase
      .from("staff")
      .insert({
        username: cleanUsername,
        password_hash: passwordHash,
        name: name.trim(),
        role: finalRole,
      })
      .select("id, username, name, role, active, created_at")
      .single();

    if (error) throw error;

    return NextResponse.json({ ok: true, staff: data });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
