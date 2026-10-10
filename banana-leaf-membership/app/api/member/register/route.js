import { NextResponse } from "next/server";
import { randomInt } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  getSession,
  normalizeWhatsapp,
  isValidWhatsapp,
  WHATSAPP_FORMAT_ERROR,
  STAFF_COOKIE,
} from "@/lib/session";
import { hashSecret } from "@/lib/hash";

export async function POST(request) {
  try {
    const session = await getSession(request, STAFF_COOKIE);
    if (!session || session.role !== "staff") {
      return NextResponse.json({ error: "Harus login sebagai staff." }, { status: 401 });
    }

    const { whatsapp, name, birthDate } = await request.json();
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
    // Validasi: format 62xxxxxxxxx; nomor seluler Indonesia bisa sampai 12 digit setelah 62 (mis. 0895xxxxxxxxx)
    if (!isValidWhatsapp(waNumber)) {
      return NextResponse.json({ error: WHATSAPP_FORMAT_ERROR }, { status: 400 });
    }

    // Tanggal lahir opsional (YYYY-MM-DD), dipakai untuk pesan ulang tahun.
    let birthDateValue = null;
    if (birthDate) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(birthDate)) || Number.isNaN(Date.parse(birthDate))) {
        return NextResponse.json({ error: "Tanggal lahir tidak valid." }, { status: 400 });
      }
      birthDateValue = String(birthDate);
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
      .insert({
        whatsapp_number: waNumber,
        name: name.trim(),
        pin_hash: pinHash,
        must_change_pin: true,
        birth_date: birthDateValue,
      })
      .select()
      .single();

    if (error) throw error;

    // Jangan kirim hash PIN ke browser.
    const { pin_hash: _pinHash, ...safeMember } = member;

    return NextResponse.json({
      ok: true,
      member: safeMember,
      defaultPin,
      note: "Kasih tau member: login pakai nomor WhatsApp ini + PIN default (4 digit terakhir nomor WA) di atas. Saat login pertama, member WAJIB mengganti PIN.",
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
