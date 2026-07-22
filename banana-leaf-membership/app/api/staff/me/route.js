import { NextResponse } from "next/server";
import { getSession, STAFF_COOKIE } from "@/lib/session";

export async function GET(request) {
  const session = await getSession(request, STAFF_COOKIE);
  if (!session || session.role !== "staff") {
    return NextResponse.json({ error: "Belum login." }, { status: 401 });
  }
  return NextResponse.json({
    ok: true,
    username: session.username,
    name: session.name,
    staffRole: session.staffRole || "staff",
  });
}
