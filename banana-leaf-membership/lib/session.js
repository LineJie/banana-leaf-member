import { SignJWT, jwtVerify } from "jose";

export const STAFF_COOKIE = "bl_staff_session";
export const MEMBER_COOKIE = "bl_member_session";

function getSecretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "SESSION_SECRET belum diisi (atau terlalu pendek) di environment variables."
    );
  }
  return new TextEncoder().encode(secret);
}

// payload contoh: { role: "staff", staffId, username } atau { role: "member", memberId }
export async function signSession(payload, expiresIn) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(getSecretKey());
}

export async function verifySession(token) {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return payload;
  } catch {
    return null;
  }
}

export async function getSession(request, cookieName) {
  const token = request.cookies.get(cookieName)?.value;
  if (!token) return null;
  return await verifySession(token);
}

// Normalisasi nomor WhatsApp jadi format konsisten (angka saja, awalan 62)
export function normalizeWhatsapp(raw) {
  let digits = String(raw || "").replace(/[^0-9]/g, "");
  if (digits.startsWith("0")) {
    digits = "62" + digits.slice(1);
  }
  if (digits.startsWith("8")) {
    digits = "62" + digits;
  }
  return digits;
}
