import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSession, STAFF_COOKIE } from "@/lib/session";
import { getMemberPointsSummary } from "@/lib/points";
import { findVars, renderTemplate, TEMPLATE_KEYS } from "@/lib/template";
import { formatLongDate } from "@/lib/time";
import {
  templateProblem,
  getOrCreateVoucher,
  RESEND_COOLDOWN_DAYS,
  EXPIRY_WARNING_DAYS,
} from "@/lib/promo";

const DAY_MS = 24 * 60 * 60 * 1000;

// Menyiapkan 1 pesan WA untuk 1 member (mode semi-manual): server mengisi
// variabel, membuat voucher kalau perlu, mencatat ke log, lalu mengembalikan
// link wa.me yang dibuka staff. Pesan dikirim staff sendiri dari WhatsApp-nya.
export async function POST(request) {
  try {
    const session = await getSession(request, STAFF_COOKIE);
    if (!session || session.role !== "staff") {
      return NextResponse.json({ error: "Harus login sebagai staff." }, { status: 401 });
    }

    const { templateKey, memberId, force } = await request.json();
    if (!TEMPLATE_KEYS.includes(templateKey) || !memberId) {
      return NextResponse.json({ error: "Data pesan tidak lengkap." }, { status: 400 });
    }

    const supabase = supabaseAdmin();

    const { data: template, error: tplErr } = await supabase
      .from("message_templates")
      .select("key, body, valid_until")
      .eq("key", templateKey)
      .maybeSingle();
    if (tplErr) throw tplErr;

    const problem = templateProblem(template);
    if (problem) return NextResponse.json({ error: problem }, { status: 400 });

    const { data: member, error: memberErr } = await supabase
      .from("members")
      .select("id, name, whatsapp_number, promo_opt_out")
      .eq("id", memberId)
      .maybeSingle();
    if (memberErr) throw memberErr;
    if (!member) return NextResponse.json({ error: "Member tidak ditemukan." }, { status: 404 });
    if (member.promo_opt_out) {
      return NextResponse.json(
        { error: "Member ini meminta berhenti dikirimi pesan WA." },
        { status: 400 }
      );
    }

    const values = { nama: member.name };

    if (templateKey === "expiring") {
      const summary = await getMemberPointsSummary({ supabase, memberId: member.id });
      const limit = Date.now() + EXPIRY_WARNING_DAYS * DAY_MS;
      const soon = summary.batches.filter((b) => new Date(b.expiry_date).getTime() <= limit);
      if (soon.length === 0) {
        return NextResponse.json(
          { error: `Member ini tidak punya poin yang akan hangus dalam ${EXPIRY_WARNING_DAYS} hari.` },
          { status: 400 }
        );
      }
      values.poin = soon.reduce((sum, b) => sum + b.points_remaining, 0);
      const nearest = Math.min(...soon.map((b) => new Date(b.expiry_date).getTime()));
      values.hari = Math.max(0, Math.ceil((nearest - Date.now()) / DAY_MS));
    }

    // Cegah kirim dobel: kalau pesan jenis ini sudah dikirim ke member yang sama
    // dalam beberapa hari terakhir, minta konfirmasi dulu.
    if (!force) {
      const since = new Date(Date.now() - RESEND_COOLDOWN_DAYS * DAY_MS).toISOString();
      const { data: recent } = await supabase
        .from("campaign_log")
        .select("sent_at, sent_by")
        .eq("template_key", templateKey)
        .eq("member_id", member.id)
        .gte("sent_at", since)
        .order("sent_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (recent) {
        return NextResponse.json(
          {
            error: `Pesan ini sudah dikirim ke ${member.name} pada ${new Date(recent.sent_at).toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "short" })}${recent.sent_by ? ` oleh ${recent.sent_by}` : ""}.`,
            needConfirm: true,
            sentAt: recent.sent_at,
          },
          { status: 409 }
        );
      }
    }

    const vars = findVars(template.body);
    let voucherCode = null;
    if (vars.includes("berlaku_sampai")) {
      values.berlaku_sampai = formatLongDate(template.valid_until);
    }
    if (vars.includes("kode_voucher")) {
      voucherCode = await getOrCreateVoucher({
        supabase,
        memberId: member.id,
        templateKey,
        validUntil: template.valid_until,
      });
      values.kode_voucher = voucherCode;
    }

    const message = renderTemplate(template.body, values);

    const { error: logErr } = await supabase.from("campaign_log").insert({
      template_key: templateKey,
      member_id: member.id,
      whatsapp_number: member.whatsapp_number,
      voucher_code: voucherCode,
      sent_by: session.username,
    });
    if (logErr) throw logErr;

    return NextResponse.json({
      ok: true,
      message,
      voucherCode,
      waUrl: `https://wa.me/${member.whatsapp_number}?text=${encodeURIComponent(message)}`,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Terjadi kesalahan." }, { status: 500 });
  }
}
