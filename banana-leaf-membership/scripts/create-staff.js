// Script buat generate perintah SQL untuk bikin akun staff pertama kamu.
// Cara pakai (di terminal, folder project ini, setelah `npm install`):
//   node scripts/create-staff.js username_kamu password_kamu "Nama Kamu"
//
// Nanti keluar perintah SQL, tinggal copy-paste ke Supabase SQL Editor lalu Run.

const bcrypt = require("bcryptjs");

const [, , username, password, name] = process.argv;

if (!username || !password) {
  console.log("Cara pakai: node scripts/create-staff.js <username> <password> \"<Nama>\"");
  process.exit(1);
}

const hash = bcrypt.hashSync(password, 10);
const safeName = (name || username).replace(/'/g, "''");

console.log("\nCopy-paste perintah di bawah ini ke Supabase SQL Editor lalu klik Run:\n");
console.log(
  `insert into staff (username, password_hash, name) values ('${username}', '${hash}', '${safeName}');`
);
console.log("");
