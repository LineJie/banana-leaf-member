import bcrypt from "bcryptjs";

// File ini pakai bcrypt (Node.js API), jadi HANYA boleh diimpor di API routes
// (Node.js runtime), jangan pernah diimpor di middleware.js (Edge runtime).

export async function hashSecret(plain) {
  return await bcrypt.hash(plain, 10);
}

export async function compareSecret(plain, hash) {
  return await bcrypt.compare(plain, hash);
}
