import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  getSession,
  normalizeWhatsapp,
  isValidWhatsapp,
  WHATSAPP_FORMAT_ERROR,
  STAFF_COOKIE,
} from "@/lib/session";
import { getMemberPointsSummary } from "@/lib/points";
import { hashSecret } from "@/lib/hash";
import { resetAttempts } from "@/lib/rateLimit";
import { randomInt } from "crypto";

export async function GET(request, { params }) {
  try {
    const session = await getSession(request, STAFF_COOKIE);
    if (!session || session.role !== "staff") {
      return NextResponse.json({ error: "Harus login sebagai staff." }, { status: 401 });
    }

    const { id } = await params;
    const supabase = supabaseAdmin();
    const { data: member, error } = await supabase
      .from("members")
      .select("id, whatsapp_number, name, created_at, birth_date, promo_opt_out")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    if (!member) {
      return NextResponse.json({ error: "Member tidak ditemukan." }, { status: 404 });
    }

    const summary = await getMemberPointsSummary({ supabase, memberId: member.id });

    const { data: history } = await supabase
      .from("transactions")
      .select("*")
      .eq("member_id", member.id)
      .order("created_at", { ascending: false })
      .limit(50);

    return NextResponse.json({
      ok: true,
      member,
      totalPoints: summary.totalPoints,
      expiringSoonPoints: summary.expiringSoonPoints,
      expiringSoonDate: summary.expiringSoonDate,
      batches: summary.batches,
      history: history || [],
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const session = await getSession(request, STAFF_COOKIE);
    if (!session || session.role !== "staff" || session.staffRole !== "owner") {
      return NextResponse.json({ error: "Cuma owner yang bisa edit data customer." }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const supabase = supabaseAdmin();

    const { data: current, error: currentErr } = await supabase
      .from("members")
      .select("id, whatsapp_number, name, birth_date, promo_opt_out")
      .eq("id", id)
      .maybeSingle();
    if (currentErr) throw currentErr;
    if (!current) {
      return NextResponse.json({ error: "Member tidak ditemukan." }, { status: 404 });
    }

    const patch = {};
    const audit = []; // { field, old, new }
    let newPin = null;
    let oldWhatsapp = null;

    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (!name) {
        return NextResponse.json({ error: "Nama tidak boleh kosong." }, { status: 400 });
      }
      if (name !== current.name) {
        patch.name = name;
        audit.push({ field: "name", old: current.name, new: name });
      }
    }

    // Nomor WhatsApp = kode member & username login. Poin dan riwayat melekat ke
    // id member (bukan ke nomor), jadi koreksi nomor aman: poin tidak ikut hilang.
    if (body.whatsapp !== undefined) {
      const wa = normalizeWhatsapp(body.whatsapp);
      if (wa !== current.whatsapp_number) {
        if (!isValidWhatsapp(wa)) {
          return NextResponse.json({ error: WHATSAPP_FORMAT_ERROR }, { status: 400 });
        }

        const { data: taken, error: takenErr } = await supabase
          .from("members")
          .select("id, name")
          .eq("whatsapp_number", wa)
          .neq("id", id)
          .maybeSingle();
        if (takenErr) throw takenErr;
        if (taken) {
          return NextResponse.json(
            { error: `Nomor ini sudah dipakai member lain: ${taken.name}. Cek dulu apakah ada pendaftaran ganda.` },
            { status: 409 }
          );
        }

        patch.whatsapp_number = wa;
        oldWhatsapp = current.whatsapp_number;
        audit.push({ field: "whatsapp_number", old: current.whatsapp_number, new: wa });

        // PIN lama dibuat dari nomor yang salah (4 digit terakhir), jadi member tidak
        // akan bisa login dengan nomor yang benar. Default: buat PIN baru.
        if (body.resetPin !== false) {
          newPin = String(randomInt(100000, 999999));
          patch.pin_hash = await hashSecret(newPin);
          patch.must_change_pin = true;
          audit.push({ field: "pin", old: null, new: "direset karena nomor diganti" });
        }
      }
    }

    if (body.birthDate !== undefined) {
      const raw = body.birthDate === null ? "" : String(body.birthDate).trim();
      let value = null;
      if (raw) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || Number.isNaN(Date.parse(raw))) {
          return NextResponse.json({ error: "Tanggal lahir tidak valid." }, { status: 400 });
        }
        value = raw;
      }
      if (value !== (current.birth_date || null)) {
        patch.birth_date = value;
        audit.push({ field: "birth_date", old: current.birth_date || null, new: value });
      }
    }

    if (body.promoOptOut !== undefined) {
      const value = Boolean(body.promoOptOut);
      if (value !== Boolean(current.promo_opt_out)) {
        patch.promo_opt_out = value;
        audit.push({ field: "promo_opt_out", old: String(Boolean(current.promo_opt_out)), new: String(value) });
      }
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "Gak ada yang diubah." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("members")
      .update(patch)
      .eq("id", id)
      .select("id, whatsapp_number, name, created_at, birth_date, promo_opt_out")
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "Nomor ini sudah dipakai member lain." }, { status: 409 });
      }
      throw error;
    }

    // Catatan audit: kalau gagal tersimpan, perubahan utama tetap berhasil.
    const { error: auditErr } = await supabase.from("member_audit").insert(
      audit.map((a) => ({
        member_id: id,
        field: a.field,
        old_value: a.old,
        new_value: a.new,
        changed_by: session.username,
      }))
    );
    if (auditErr) console.error("Gagal simpan audit member:", auditErr.message);

    // Buka kunci login untuk kedua nomor (kalau sempat terkunci karena salah PIN).
    if (oldWhatsapp) {
      await resetAttempts(supabase, `member:${oldWhatsapp}`);
      await resetAttempts(supabase, `member:${data.whatsapp_number}`);
    }

    return NextResponse.json({ ok: true, member: data, newPin });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
