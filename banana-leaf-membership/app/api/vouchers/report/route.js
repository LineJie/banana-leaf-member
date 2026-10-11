import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSession, STAFF_COOKIE } from "@/lib/session";
import { resolveRange } from "@/lib/time";

const LIMIT = 2000;
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

// "2026-10-11 14:17" dalam WIB, untuk kolom CSV.
function wibStamp(iso) {
  const d = new Date(new Date(iso).getTime() + WIB_OFFSET_MS);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

// Sel CSV: kutip kalau perlu, dan awali ' kalau diawali = + - @ supaya
// Excel tidak menjalankannya sebagai rumus (nama member berasal dari input pengguna).
function csvCell(value) {
  let s = value == null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function fetchByIds(supabase, table, columns, ids) {
  const out = [];
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await supabase.from(table).select(columns).in("id", ids.slice(i, i + 100));
    if (error) throw error;
    out.push(...(data || []));
  }
  return out;
}

// Laporan voucher dalam rentang waktu: berapa dibuat, berapa dipakai, siapa saja.
// ?format=csv mengunduh rincian pemakaian sebagai file CSV.
export async function GET(request) {
  try {
    const session = await getSession(request, STAFF_COOKIE);
    if (!session || session.role !== "staff") {
      return NextResponse.json({ error: "Harus login sebagai staff." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const range = resolveRange(
      searchParams.get("range") || "month",
      searchParams.get("from"),
      searchParams.get("to")
    );
    if (range.error) return NextResponse.json({ error: range.error }, { status: 400 });

    const supabase = supabaseAdmin();

    // Voucher yang dibuat dalam rentang.
    const { data: created, error: createdErr } = await supabase
      .from("vouchers")
      .select("id, kind")
      .gte("issued_at", range.startIso)
      .lt("issued_at", range.endIso)
      .limit(LIMIT);
    if (createdErr) return NextResponse.json({ error: createdErr.message }, { status: 500 });

    // Pemakaian voucher 'single' (ditandai di kolom claimed_at).
    const { data: singles, error: singleErr } = await supabase
      .from("vouchers")
      .select("id, code, kind, description, member_id, claimed_at, claimed_by")
      .not("claimed_at", "is", null)
      .gte("claimed_at", range.startIso)
      .lt("claimed_at", range.endIso)
      .limit(LIMIT);
    if (singleErr) return NextResponse.json({ error: singleErr.message }, { status: 500 });

    // Pemakaian voucher 'shared' (satu baris per member).
    const { data: shares, error: shareErr } = await supabase
      .from("voucher_redemptions")
      .select("voucher_id, member_id, redeemed_at, redeemed_by")
      .gte("redeemed_at", range.startIso)
      .lt("redeemed_at", range.endIso)
      .limit(LIMIT);
    if (shareErr) return NextResponse.json({ error: shareErr.message }, { status: 500 });

    const sharedVoucherIds = Array.from(new Set((shares || []).map((s) => s.voucher_id)));
    const sharedVouchers = await fetchByIds(supabase, "vouchers", "id, code, kind, description", sharedVoucherIds);
    const voucherMap = new Map(sharedVouchers.map((v) => [v.id, v]));

    const memberIds = Array.from(
      new Set([...(singles || []).map((s) => s.member_id), ...(shares || []).map((s) => s.member_id)].filter(Boolean))
    );
    const members = await fetchByIds(supabase, "members", "id, name, whatsapp_number", memberIds);
    const memberMap = new Map(members.map((m) => [m.id, m]));

    const items = [
      ...(singles || []).map((s) => ({
        voucherId: s.id,
        code: s.code,
        kind: s.kind,
        description: s.description || "",
        memberId: s.member_id,
        name: memberMap.get(s.member_id)?.name ?? "-",
        whatsappNumber: memberMap.get(s.member_id)?.whatsapp_number ?? "-",
        usedAt: s.claimed_at,
        usedBy: s.claimed_by || "",
      })),
      ...(shares || []).map((s) => {
        const v = voucherMap.get(s.voucher_id);
        return {
          voucherId: s.voucher_id,
          code: v?.code ?? "-",
          kind: v?.kind ?? "shared",
          description: v?.description || "",
          memberId: s.member_id,
          name: memberMap.get(s.member_id)?.name ?? "-",
          whatsappNumber: memberMap.get(s.member_id)?.whatsapp_number ?? "-",
          usedAt: s.redeemed_at,
          usedBy: s.redeemed_by || "",
        };
      }),
    ].sort((a, b) => new Date(b.usedAt) - new Date(a.usedAt));

    if (searchParams.get("format") === "csv") {
      const header = ["Waktu (WIB)", "Kode", "Jenis", "Keterangan", "Nama member", "Nomor WA", "Dicatat oleh"];
      const lines = [header.map(csvCell).join(",")];
      for (const i of items) {
        lines.push(
          [
            wibStamp(i.usedAt),
            i.code,
            i.kind === "shared" ? "Banyak orang" : "Khusus 1 orang",
            i.description,
            i.name,
            i.whatsappNumber,
            i.usedBy,
          ]
            .map(csvCell)
            .join(",")
        );
      }
      const stamp = (iso) => wibStamp(iso).slice(0, 10);
      const lastDay = stamp(new Date(new Date(range.endIso).getTime() - 1).toISOString());
      const filename = `voucher-${stamp(range.startIso)}_${lastDay}.csv`;
      // BOM supaya Excel membaca huruf (UTF-8) dengan benar.
      return new NextResponse("﻿" + lines.join("\r\n"), {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Cache-Control": "no-store",
        },
      });
    }

    const byVoucherMap = new Map();
    for (const i of items) {
      const e = byVoucherMap.get(i.voucherId) || {
        voucherId: i.voucherId,
        code: i.code,
        kind: i.kind,
        description: i.description,
        count: 0,
      };
      e.count += 1;
      byVoucherMap.set(i.voucherId, e);
    }

    const createdRows = created || [];
    return NextResponse.json({
      range: { label: range.label, startIso: range.startIso, endIso: range.endIso },
      createdTotal: createdRows.length,
      createdSingle: createdRows.filter((v) => v.kind === "single").length,
      createdShared: createdRows.filter((v) => v.kind === "shared").length,
      totalUses: items.length,
      uniqueMembers: new Set(items.map((i) => i.memberId)).size,
      byVoucher: Array.from(byVoucherMap.values()).sort((a, b) => b.count - a.count),
      items,
      truncated:
        createdRows.length >= LIMIT || (singles || []).length >= LIMIT || (shares || []).length >= LIMIT,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Terjadi kesalahan." }, { status: 500 });
  }
}
