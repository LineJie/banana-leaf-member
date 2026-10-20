import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSession, MEMBER_COOKIE } from "@/lib/session";
import { todayWib } from "@/lib/time";
import { imageUrl } from "@/lib/announcements";

// Pengumuman yang sedang tayang untuk member yang login: aktif, sudah lewat
// tanggal mulai, dan belum lewat tanggal selesai (hari ini versi WIB).
// Endpoint terpisah dari /api/member/me supaya kalau ini gagal, poin dan riwayat
// member tetap tampil normal.
export async function GET(request) {
  try {
    const session = await getSession(request, MEMBER_COOKIE);
    if (!session || session.role !== "member") {
      return NextResponse.json({ error: "Harus login sebagai member." }, { status: 401 });
    }

    const today = todayWib();
    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("member_announcements")
      .select("id, title, body, image_path, button_label, button_url")
      .eq("active", true)
      .or(`starts_on.is.null,starts_on.lte.${today}`)
      .or(`ends_on.is.null,ends_on.gte.${today}`)
      .order("created_at", { ascending: false })
      .limit(5);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json(
      {
        ok: true,
        announcements: (data || []).map((a) => ({
          id: a.id,
          title: a.title,
          body: a.body,
          imageUrl: imageUrl(supabase, a.image_path),
          buttonLabel: a.button_label,
          buttonUrl: a.button_url,
        })),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
