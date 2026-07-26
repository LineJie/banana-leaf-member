import { NextResponse } from "next/server";
import { randomInt } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSession, normalizeWhatsapp, STAFF_COOKIE } from "@/lib/session";
import { hashSecret } from "@/lib/hash";

export async function POST(request) {
  try {
    const session = await getSession(request, STAFF_COOKIE);
    if (!session || session.role !== "staff") {
      return NextResponse.json({ error: "Harus login sebagai staff." }, { status: 401 });
    }

    const { whatsapp, name } = await request.json();
    if (!whatsapp || !name) {
      return NextResponse.json(
        { error: "Nomor WhatsApp dan nama member wajib diisi." },
        { status: 400 }
      );
    }

    if (String(name).trim().length < 2) {
      return NextResponse.json(
        { error: "Nama member minimal 2 karakter." },
        { status: 400 }
      );
    }

    const waNumber = normalizeWhatsapp(whatsapp);
    // Validasi ketat: harus format 62xxxxxxxxxx (11-13 digit total termasuk kode negara)
    const isValidFormat = /^62[0-9]{9,11}$/.test(waNumber);
    if (!isValidFormat || waNumber.length < 11) {
      return NextResponse.json({
        error: "Nomor WhatsApp tidak valid. Gunakan format: 0812xxxxxxxx atau 62812xxxxxxx",
        status: 400,
      });
    }

    const supabase = supabaseAdmin();

    const { data: existing } = await supabase
      .from("members")
      .select("id")
      .eq("whatsapp_number", waNumber)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "Nomor WhatsApp ini sudah terdaftar sebagai member." },
        { status: 409 }
      );
    }

    // PIN default = 4 digit terakhir nomor WhatsApp member (sesuai kesepakatan owner).
    const defaultPin = waNumber.slice(-4);
    const pinHash = await hashSecret(defaultPin);

    const { data: member, error } = await supabase
      .from("members")
      .insert({ whatsapp_number: waNumber, name: name.trim(), pin_hash: pinHash })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      ok: true,
      member,
      defaultPin,
      note: "Kasih tau member: login pakai nomor WhatsApp ini + PIN default (4 digit terakhir nomor WA) di atas. Member bisa ganti PIN sendiri di halaman login member.",
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
