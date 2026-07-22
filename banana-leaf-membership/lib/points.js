// Aturan poin Banana Leaf Membership:
// - Tiap belanja Rp100.000 = 1 poin, dibulatkan ke bawah (Rp250rb = 2 poin, bukan 2.5)
// - Tiap poin berlaku 90 hari sejak tanggal didapat, lalu hangus
// - Redeem memotong dari poin yang paling dekat kadaluarsa dulu (FIFO), biar poin
//   member gak sia-sia hangus padahal masih ada poin baru yang lebih "awet"

export const RUPIAH_PER_POINT = 100000;
export const EXPIRY_DAYS = 90;

export function calcPointsFromAmount(amountSpent) {
  const amount = Number(amountSpent) || 0;
  return Math.floor(amount / RUPIAH_PER_POINT);
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// Catat transaksi belanja & tambahkan batch poin baru (kalau amount menghasilkan >=1 poin)
export async function earnPoints({ supabase, memberId, amountSpent, staffUsername, note }) {
  const points = calcPointsFromAmount(amountSpent);

  const { data: txn, error: txnError } = await supabase
    .from("transactions")
    .insert({
      member_id: memberId,
      type: "earn",
      points: points,
      amount_spent: amountSpent,
      description: note || null,
      created_by: staffUsername || null,
    })
    .select()
    .single();

  if (txnError) throw txnError;

  if (points > 0) {
    const now = new Date();
    const { error: batchError } = await supabase.from("point_batches").insert({
      member_id: memberId,
      points_earned: points,
      points_remaining: points,
      earned_date: now.toISOString(),
      expiry_date: addDays(now, EXPIRY_DAYS).toISOString(),
      source_transaction_id: txn.id,
    });
    if (batchError) throw batchError;
  }

  return { points, transaction: txn };
}

// Total poin valid (belum hangus) milik member, plus rincian batch buat ditampilkan
export async function getMemberPointsSummary({ supabase, memberId }) {
  const nowIso = new Date().toISOString();

  const { data: batches, error } = await supabase
    .from("point_batches")
    .select("*")
    .eq("member_id", memberId)
    .gt("points_remaining", 0)
    .gt("expiry_date", nowIso)
    .order("expiry_date", { ascending: true });

  if (error) throw error;

  const totalPoints = (batches || []).reduce((sum, b) => sum + b.points_remaining, 0);

  const soonThreshold = addDays(new Date(), 14).toISOString();
  const expiringSoon = (batches || []).filter((b) => b.expiry_date <= soonThreshold);
  const expiringSoonPoints = expiringSoon.reduce((sum, b) => sum + b.points_remaining, 0);

  return {
    totalPoints,
    batches: batches || [],
    expiringSoonPoints,
    expiringSoonDate: expiringSoon[0]?.expiry_date || null,
  };
}

// Motong poin secara FIFO (batch paling cepat kadaluarsa dipotong duluan).
// Gak throw kalau saldo kurang dari amount — motong sebanyak yang tersedia
// dan balikin jumlah yang beneran kepotong (dipakai juga buat void/koreksi).
async function deductFifo({ supabase, memberId, amount }) {
  const { batches } = await getMemberPointsSummary({ supabase, memberId });
  let remaining = amount;
  const updates = [];

  for (const batch of batches) {
    if (remaining <= 0) break;
    const deduct = Math.min(batch.points_remaining, remaining);
    updates.push({ id: batch.id, newRemaining: batch.points_remaining - deduct });
    remaining -= deduct;
  }

  for (const u of updates) {
    const { error } = await supabase
      .from("point_batches")
      .update({ points_remaining: u.newRemaining })
      .eq("id", u.id);
    if (error) throw error;
  }

  return amount - remaining; // jumlah yang beneran kepotong
}

// Tukar poin. Motong dari batch yang paling cepat kadaluarsa dulu.
export async function redeemPoints({ supabase, memberId, pointsToRedeem, description, staffUsername }) {
  const requested = Number(pointsToRedeem) || 0;
  if (requested <= 0) {
    throw new Error("Jumlah poin yang ditukar harus lebih dari 0.");
  }

  const { totalPoints } = await getMemberPointsSummary({ supabase, memberId });

  if (totalPoints < requested) {
    const err = new Error(
      `Poin tidak cukup. Poin member saat ini: ${totalPoints}, diminta: ${requested}.`
    );
    err.code = "INSUFFICIENT_POINTS";
    throw err;
  }

  await deductFifo({ supabase, memberId, amount: requested });

  const { data: txn, error: txnError } = await supabase
    .from("transactions")
    .insert({
      member_id: memberId,
      type: "redeem",
      points: -requested,
      description: description || null,
      created_by: staffUsername || null,
    })
    .select()
    .single();

  if (txnError) throw txnError;

  return { redeemed: requested, transaction: txn };
}

// Batalkan/koreksi transaksi yang sudah tercatat. TIDAK menghapus/mengubah
// transaksi asli — dicatat sebagai transaksi baru tipe 'void' yang
// menyeimbangkan, biar riwayat pembukuan tetap utuh & bisa diaudit.
//
// - Void 'earn': motong balik poin dari transaksi itu (FIFO, sebanyak yang
//   masih tersedia — kalau sebagian udah kepakai buat redeem lain, cuma sisa
//   yang belum dipakai yang bisa ditarik balik).
// - Void 'redeem': kasih balik poinnya sebagai batch baru dengan expiry 90
//   hari dari sekarang (bukan expiry batch aslinya — batch asli mungkin udah
//   bercampur/terpotong ke transaksi lain).
export async function voidTransaction({ supabase, transactionId, staffUsername, voidReason }) {
  const { data: original, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("id", transactionId)
    .maybeSingle();

  if (error) throw error;
  if (!original) throw new Error("Transaksi tidak ditemukan.");
  if (original.voided) throw new Error("Transaksi ini sudah pernah dibatalkan.");
  if (original.type === "void") {
    throw new Error("Transaksi koreksi gak bisa dibatalkan lagi.");
  }

  let voidTxn;

  if (original.type === "earn") {
    // Cari batch spesifik yang dibuat transaksi earn ini (bukan potong FIFO
    // global — biar gak kesenggol poin dari batch lain yang gak ada hubungannya).
    const { data: batch, error: batchFindErr } = await supabase
      .from("point_batches")
      .select("*")
      .eq("source_transaction_id", original.id)
      .maybeSingle();
    if (batchFindErr) throw batchFindErr;

    const stillAvailable = batch ? batch.points_remaining : 0;

    if (batch && stillAvailable > 0) {
      const { error: updErr } = await supabase
        .from("point_batches")
        .update({ points_remaining: 0 })
        .eq("id", batch.id);
      if (updErr) throw updErr;
    }

    const partialNote =
      stillAvailable < original.points
        ? ` (cuma ${stillAvailable}/${original.points} poin yang bisa ditarik, sisanya udah kepakai)`
        : "";

    const reasonLabel = {
      staff_salah_input: "staff salah input",
      cancel_customer: "cancel customer",
      system_error: "error sistem",
      duplicate_entry: "entry duplikat",
      other: "alasan lain",
    }[voidReason] || voidReason;

    const { data, error: insErr } = await supabase
      .from("transactions")
      .insert({
        member_id: original.member_id,
        type: "void",
        points: -stillAvailable,
        description: `Koreksi belanja${
          original.amount_spent ? ` Rp${Number(original.amount_spent).toLocaleString("id-ID")}` : ""
        }${partialNote} — Alasan: ${reasonLabel}`,
        created_by: staffUsername || null,
        related_transaction_id: original.id,
      })
      .select()
      .single();

    if (insErr) throw insErr;
    voidTxn = data;
  } else if (original.type === "redeem") {
    const restoreAmount = Math.abs(original.points);
    const now = new Date();

    const { error: batchErr } = await supabase.from("point_batches").insert({
      member_id: original.member_id,
      points_earned: restoreAmount,
      points_remaining: restoreAmount,
      earned_date: now.toISOString(),
      expiry_date: addDays(now, EXPIRY_DAYS).toISOString(),
      source_transaction_id: null,
    });
    if (batchErr) throw batchErr;

    const reasonLabel = {
      staff_salah_input: "staff salah input",
      cancel_customer: "cancel customer",
      system_error: "error sistem",
      duplicate_entry: "entry duplikat",
      other: "alasan lain",
    }[voidReason] || voidReason;

    const { data, error: insErr } = await supabase
      .from("transactions")
      .insert({
        member_id: original.member_id,
        type: "void",
        points: restoreAmount,
        description: `Koreksi redeem "${original.description || "-"}" — Alasan: ${reasonLabel}`,
        created_by: staffUsername || null,
        related_transaction_id: original.id,
      })
      .select()
      .single();

    if (insErr) throw insErr;
    voidTxn = data;
  } else {
    throw new Error("Tipe transaksi ini gak bisa dibatalkan.");
  }

  const { error: markErr } = await supabase
    .from("transactions")
    .update({
      voided: true,
      voided_at: new Date().toISOString(),
      voided_by: staffUsername || null,
    })
    .eq("id", original.id);

  if (markErr) throw markErr;

  return { voidTransaction: voidTxn };
}
