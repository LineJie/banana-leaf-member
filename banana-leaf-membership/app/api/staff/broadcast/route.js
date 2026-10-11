import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSession, STAFF_COOKIE } from "@/lib/session";
import { templateProblem } from "@/lib/promo";

const DAY_MS = 24 * 60 * 60 * 1000;
const INACTIVE_DAYS = 99;

// Data untuk halaman Broadcast: semua member yang boleh dikirimi pesan,
// kapan terakhir tiap jenis pesan dikirim ke mereka, dan status tiap template.
export async function GET(request) {
  try {
    const session = await getSession(request, STAFF_COOKIE);
    if (!session || session.role !== "staff") {
      return NextResponse.json({ error: "Harus login sebagai staff." }, { status: 401 });
    }

    const supabase = supabaseAdmin();
    const now = Date.now();

    const { data: members, error: memberErr } = await supabase
      .from("members")
      .select("id, name, whatsapp_number, promo_opt_out");
    if (memberErr) return NextResponse.json({ error: memberErr.message }, { status: 500 });

    const all = members || [];
    const optedOutCount = all.filter((m) => m.promo_opt_out).length;
    const active = all.filter((m) => !m.promo_opt_out);

    const { data: tplRows, error: tplErr } = await supabase
      .from("message_templates")
      .select("key, title, body, valid_until")
      .order("key", { ascending: true });
    if (tplErr) return NextResponse.json({ error: tplErr.message }, { status: 500 });
    const templates = (tplRows || []).map((t) => ({
      key: t.key,
      title: t.title,
      problem: templateProblem(t),
    }));

    const logSince = new Date(now - 60 * DAY_MS).toISOString();
    const { data: logRows, error: logErr } = await supabase
      .from("campaign_log")
      .select("template_key, member_id, sent_at, sent_by")
      .gte("sent_at", logSince)
      .order("sent_at", { ascending: false });
    if (logErr) return NextResponse.json({ error: logErr.message }, { status: 500 });

    const lastSent = new Map(); // memberId -> { templateKey: {sentAt, sentBy} }
    for (const row of logRows || []) {
      if (!lastSent.has(row.member_id)) lastSent.set(row.member_id, {});
      const perMember = lastSent.get(row.member_id);
      if (!perMember[row.template_key]) {
        perMember[row.template_key] = { sentAt: row.sent_at, sentBy: row.sent_by };
      }
    }

    const { data: earnTxns, error: txnErr } = await supabase
      .from("transactions")
      .select("member_id, created_at")
      .eq("type", "earn")
      .order("created_at", { ascending: false });
    if (txnErr) return NextResponse.json({ error: txnErr.message }, { status: 500 });
    const lastTxn = new Map();
    for (const t of earnTxns || []) {
      if (!lastTxn.has(t.member_id)) lastTxn.set(t.member_id, t.created_at);
    }

    const cutoff = now - INACTIVE_DAYS * DAY_MS;
    const list = active
      .map((m) => {
        const last = lastTxn.get(m.id) || null;
        return {
          memberId: m.id,
          name: m.name,
          whatsappNumber: m.whatsapp_number,
          lastTransactionDate: last,
          inactive: !last || new Date(last).getTime() < cutoff,
          lastSent: lastSent.get(m.id) || {},
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, "id"));

    return NextResponse.json({
      ok: true,
      members: list,
      templates,
      optedOutCount,
      inactiveDays: INACTIVE_DAYS,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Terjadi kesalahan." }, { status: 500 });
  }
}
