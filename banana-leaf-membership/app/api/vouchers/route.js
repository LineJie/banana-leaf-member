import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSession, STAFF_COOKIE } from "@/lib/session";
import { todayWib } from "@/lib/time";
import { normalizeVoucherCode, parseCustomCode, generateVoucherCode } from "@/lib/promo";

const COLUMNS =
  "id, code, member_id, kind, description, max_uses, template_key, valid_until, issued_at, claimed_at, claimed_by";

// single : aktif -> sudah dipakai (claimed) -> kedaluwarsa
// shared : aktif -> habis (dilabeli "claimed" kalau batas pemakaian tercapai) -> kedaluwarsa
function statusOf(v, today, usedCount) {
  if (v.kind === "shared") {
    if (v.max_uses != null && usedCount >= v.max_uses) return "claimed";
    if (String(v.valid_until) < today) return "expired";
    return "active";
  }
  if (v.claimed_at) return "claimed";
  if (String(v.valid_until) < today) return "expired";
  return "active";
}

// Cek satu kode (?code=BL-XXXXXX) atau lihat daftar voucher terbaru (?status=active|claimed|expired).
export async function GET(request) {
  try {
    const session = await getSession(request, STAFF_COOKIE);
    if (!session || session.role !== "staff") {
      return NextResponse.json({ error: "Harus login sebagai staff." }, { status: 401 });
    }

    const supabase = supabaseAdmin();
    const { searchParams } = new URL(request.url);
    const today = todayWib();
    const codeParam = searchParams.get("code");
    const statusParam = searchParams.get("status");

    let query = supabase.from("vouchers").select(COLUMNS);
    if (codeParam) {
      query = query.eq("code", normalizeVoucherCode(codeParam)).limit(1);
    } else {
      query = query.order("issued_at", { ascending: false }).limit(300);
    }

    const { data: rows, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Jumlah pemakaian untuk voucher 'shared'.
    const sharedIds = (rows || []).filter((v) => v.kind === "shared").map((v) => v.id);
    const usedMap = new Map();
    for (let i = 0; i < sharedIds.length; i += 100) {
      const { data: reds, error: redErr } = await supabase
        .from("voucher_redemptions")
        .select("voucher_id")
        .in("voucher_id", sharedIds.slice(i, i + 100));
      if (redErr) return NextResponse.json({ error: redErr.message }, { status: 500 });
      for (const r of reds || []) usedMap.set(r.voucher_id, (usedMap.get(r.voucher_id) || 0) + 1);
    }

    let shaped = (rows || []).map((v) => {
      const usedCount = usedMap.get(v.id) || 0;
      return { v, usedCount, status: statusOf(v, today, usedCount) };
    });
    if (!codeParam && ["active", "claimed", "expired"].includes(statusParam)) {
      shaped = shaped.filter((x) => x.status === statusParam);
    }
    shaped = shaped.slice(0, 100);

    const memberIds = Array.from(new Set(shaped.map((x) => x.v.member_id).filter(Boolean)));
    const memberMap = new Map();
    for (let i = 0; i < memberIds.length; i += 100) {
      const { data: members } = await supabase
        .from("members")
        .select("id, name, whatsapp_number")
        .in("id", memberIds.slice(i, i + 100));
      for (const m of members || []) memberMap.set(m.id, m);
    }

    const vouchers = shaped.map(({ v, usedCount, status }) => ({
      id: v.id,
      code: v.code,
      kind: v.kind,
      description: v.description,
      maxUses: v.max_uses,
      usedCount,
      templateKey: v.template_key,
      validUntil: v.valid_until,
      issuedAt: v.issued_at,
      claimedAt: v.claimed_at,
      claimedBy: v.claimed_by,
      status,
      memberName: v.member_id ? memberMap.get(v.member_id)?.name ?? "-" : null,
      whatsappNumber: v.member_id ? memberMap.get(v.member_id)?.whatsapp_number ?? "-" : null,
    }));

    if (codeParam && vouchers.length === 0) {
      return NextResponse.json({ error: "Kode voucher tidak ditemukan." }, { status: 404 });
    }

    return NextResponse.json({ ok: true, vouchers });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Owner membuat voucher manual.
//   kind "single": khusus 1 member (memberId wajib), sekali pakai.
//   kind "shared": 1 kode untuk banyak orang, tiap member boleh pakai 1x; maxUses opsional.
export async function POST(request) {
  try {
    const session = await getSession(request, STAFF_COOKIE);
    if (!session || session.role !== "staff" || session.staffRole !== "owner") {
      return NextResponse.json({ error: "Cuma owner yang bisa membuat voucher." }, { status: 403 });
    }

    const body = await request.json();
    const kind = body.kind;
    if (kind !== "single" && kind !== "shared") {
      return NextResponse.json({ error: "Jenis voucher tidak valid." }, { status: 400 });
    }

    const validUntil = String(body.validUntil || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(validUntil) || Number.isNaN(Date.parse(validUntil))) {
      return NextResponse.json({ error: "Tanggal berlaku wajib diisi." }, { status: 400 });
    }
    if (validUntil < todayWib()) {
      return NextResponse.json({ error: "Tanggal berlaku sudah lewat." }, { status: 400 });
    }

    const description = String(body.description || "").trim();
    if (description.length > 200) {
      return NextResponse.json({ error: "Keterangan maksimal 200 karakter." }, { status: 400 });
    }

    const supabase = supabaseAdmin();
    let memberId = null;
    let maxUses = null;

    if (kind === "single") {
      if (!body.memberId) {
        return NextResponse.json({ error: "Pilih member untuk voucher ini." }, { status: 400 });
      }
      const { data: member, error: memberErr } = await supabase
        .from("members")
        .select("id")
        .eq("id", body.memberId)
        .maybeSingle();
      if (memberErr) return NextResponse.json({ error: memberErr.message }, { status: 500 });
      if (!member) return NextResponse.json({ error: "Member tidak ditemukan." }, { status: 404 });
      memberId = member.id;
    } else if (body.maxUses !== undefined && body.maxUses !== null && body.maxUses !== "") {
      maxUses = Number(body.maxUses);
      if (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 100000) {
        return NextResponse.json({ error: "Batas pemakaian harus angka bulat minimal 1." }, { status: 400 });
      }
    }

    const customRaw = String(body.code || "").trim();
    let customCode = null;
    if (customRaw) {
      const parsed = parseCustomCode(customRaw);
      if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: 400 });
      customCode = parsed.code;
    }

    const base = {
      kind,
      member_id: memberId,
      description: description || null,
      max_uses: maxUses,
      valid_until: validUntil,
      template_key: null,
      created_by: session.username,
    };

    for (let attempt = 0; attempt < 5; attempt++) {
      const code = customCode || generateVoucherCode();
      const { data, error } = await supabase
        .from("vouchers")
        .insert({ ...base, code })
        .select(COLUMNS)
        .single();
      if (!error) {
        return NextResponse.json({
          ok: true,
          voucher: {
            code: data.code,
            kind: data.kind,
            description: data.description,
            maxUses: data.max_uses,
            validUntil: data.valid_until,
          },
        });
      }
      if (error.code !== "23505") return NextResponse.json({ error: error.message }, { status: 500 });
      if (customCode) {
        return NextResponse.json({ error: `Kode ${customCode} sudah dipakai. Pilih kode lain.` }, { status: 409 });
      }
    }
    return NextResponse.json({ error: "Gagal membuat kode unik. Coba lagi." }, { status: 500 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
