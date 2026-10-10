import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSession, STAFF_COOKIE } from "@/lib/session";
import { wibMonthDay } from "@/lib/time";
import { templateProblem } from "@/lib/promo";

// Threshold aturan (sesuai kesepakatan owner):
// - Poin dianggap "akan hangus" kalau sisa masa berlakunya <= 10 hari lagi
// - Member dianggap "lama tidak belanja" kalau transaksi earn terakhirnya
//   lebih dari 99 hari yang lalu (atau belum pernah belanja sama sekali)
const EXPIRY_WARNING_DAYS = 10;
const INACTIVE_DAYS = 99;

export async function GET(request) {
  try {
    const session = await getSession(request, STAFF_COOKIE);
    if (!session || session.role !== "staff") {
      return NextResponse.json({ error: "Harus login sebagai staff." }, { status: 401 });
    }

    const supabase = supabaseAdmin();
    const now = new Date();
    const nowIso = now.toISOString();
    const soonIso = new Date(now.getTime() + EXPIRY_WARNING_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const inactiveCutoffIso = new Date(now.getTime() - INACTIVE_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const { data: members, error: memberError } = await supabase
      .from("members")
      .select("id, name, whatsapp_number, birth_date, promo_opt_out");
    if (memberError) {
      return NextResponse.json({ error: memberError.message }, { status: 500 });
    }
    // Member yang minta berhenti dikirimi pesan tidak ditampilkan di daftar kirim pesan.
    const allMembers = members || [];
    const optedOutCount = allMembers.filter((m) => m.promo_opt_out).length;
    const activeMembers = allMembers.filter((m) => !m.promo_opt_out);
    const memberMap = new Map(activeMembers.map((m) => [m.id, m]));

    // Kapan terakhir pesan jenis tertentu dikirim ke tiap member (60 hari terakhir).
    const logSince = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString();
    const { data: logRows, error: logError } = await supabase
      .from("campaign_log")
      .select("template_key, member_id, sent_at, sent_by")
      .gte("sent_at", logSince)
      .order("sent_at", { ascending: false });
    if (logError) {
      return NextResponse.json({ error: logError.message }, { status: 500 });
    }
    const lastSent = new Map();
    for (const row of logRows || []) {
      const k = `${row.template_key}:${row.member_id}`;
      if (!lastSent.has(k)) lastSent.set(k, { sentAt: row.sent_at, sentBy: row.sent_by });
    }
    const sentInfo = (key, memberId) => lastSent.get(`${key}:${memberId}`) || null;

    const { data: tplRows, error: tplError } = await supabase
      .from("message_templates")
      .select("key, body, valid_until");
    if (tplError) {
      return NextResponse.json({ error: tplError.message }, { status: 500 });
    }
    const templateProblems = {};
    for (const t of tplRows || []) templateProblems[t.key] = templateProblem(t);

    const { data: batches, error: batchError } = await supabase
      .from("point_batches")
      .select("member_id, points_remaining, expiry_date")
      .gt("points_remaining", 0)
      .gt("expiry_date", nowIso)
      .lte("expiry_date", soonIso)
      .order("expiry_date", { ascending: true });
    if (batchError) {
      return NextResponse.json({ error: batchError.message }, { status: 500 });
    }

    const expiringMap = new Map();
    for (const b of batches || []) {
      const m = memberMap.get(b.member_id);
      if (!m) continue; // member tidak ada atau berhenti menerima pesan
      if (!expiringMap.has(b.member_id)) {
        expiringMap.set(b.member_id, {
          memberId: b.member_id,
          name: m?.name ?? "-",
          whatsappNumber: m?.whatsapp_number ?? "-",
          points: 0,
          nearestExpiry: b.expiry_date,
          lastSent: sentInfo("expiring", b.member_id),
        });
      }
      const entry = expiringMap.get(b.member_id);
      entry.points += b.points_remaining;
      if (new Date(b.expiry_date) < new Date(entry.nearestExpiry)) {
        entry.nearestExpiry = b.expiry_date;
      }
    }
    const expiringSoon = Array.from(expiringMap.values()).sort(
      (a, b) => new Date(a.nearestExpiry) - new Date(b.nearestExpiry)
    );

    const { data: earnTxns, error: txnError } = await supabase
      .from("transactions")
      .select("member_id, created_at")
      .eq("type", "earn")
      .order("created_at", { ascending: false });
    if (txnError) {
      return NextResponse.json({ error: txnError.message }, { status: 500 });
    }

    const lastTxnMap = new Map();
    for (const txn of earnTxns || []) {
      if (!lastTxnMap.has(txn.member_id)) {
        lastTxnMap.set(txn.member_id, txn.created_at);
      }
    }

    const inactive = activeMembers
      .map((m) => ({
        memberId: m.id,
        name: m.name,
        whatsappNumber: m.whatsapp_number,
        lastTransactionDate: lastTxnMap.get(m.id) || null,
        lastSent: sentInfo("inactive", m.id),
      }))
      .filter(
        (m) =>
          !m.lastTransactionDate ||
          new Date(m.lastTransactionDate) < new Date(inactiveCutoffIso)
      )
      .sort((a, b) => {
        const aTime = a.lastTransactionDate ? new Date(a.lastTransactionDate).getTime() : 0;
        const bTime = b.lastTransactionDate ? new Date(b.lastTransactionDate).getTime() : 0;
        return aTime - bTime;
      });

    // Ulang tahun bulan ini (WIB), diurutkan menurut tanggal.
    const today = wibMonthDay(now);
    const birthdays = activeMembers
      .filter((m) => m.birth_date)
      .map((m) => {
        const [, mm, dd] = String(m.birth_date).split("-").map(Number);
        return { m, month: mm - 1, day: dd };
      })
      .filter((x) => x.month === today.month)
      .sort((a, b) => a.day - b.day)
      .map(({ m, day }) => ({
        memberId: m.id,
        name: m.name,
        whatsappNumber: m.whatsapp_number,
        day,
        isToday: day === today.day,
        passed: day < today.day,
        lastSent: sentInfo("birthday", m.id),
      }));

    return NextResponse.json({
      expiringSoon,
      inactive,
      birthdays,
      optedOutCount,
      templateProblems,
      expiryWarningDays: EXPIRY_WARNING_DAYS,
      inactiveDays: INACTIVE_DAYS,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Terjadi kesalahan." }, { status: 500 });
  }
}
