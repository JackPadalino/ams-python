// Creates student accounts from a CSV file.
//
//   node scripts/create-accounts.mjs students.csv --password <student password> --admin-password <admin password> [--emulator] [--dry-run]
//
// CSV columns: first,last,year[,role][,username]
//   role is "admin" or blank. username is optional; leave it blank to build it
//   from first initial + last name + year, e.g. Jane Doe, class of 2026 -> jdoe2026.
//
// --emulator  creates accounts in the local Firebase emulators.
// Otherwise it uses the real project; see README.md for the service-account setup.
// Running it again is safe: existing accounts are skipped (and their role updated).
// --update-passwords  also sets existing accounts to the passwords given.

import { readFileSync } from "node:fs";
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

// Must match src/lib/usernames.js.
const USERNAME_EMAIL_DOMAIN = "students.ams-python.example.com";

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const csvPath = args.find((a, i) => !a.startsWith("--") && !args[i - 1]?.match(/^--(password|admin-password|project)$/));
const password = option("--password");
const adminPassword = option("--admin-password");
const emulator = flag("--emulator");
const dryRun = flag("--dry-run");
const updatePasswords = flag("--update-passwords");

if (!csvPath || (!password && !dryRun)) {
  console.error("Usage: node scripts/create-accounts.mjs students.csv --password <student password> [--admin-password <admin password>] [--emulator] [--dry-run] [--project <id>]");
  process.exit(1);
}
if ([password, adminPassword].some((p) => p !== undefined && p.length < 6)) {
  console.error("Passwords must be at least 6 characters (a Firebase rule).");
  process.exit(1);
}

function makeUsername(first, last, year) {
  const clean = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]/g, "");
  const yearDigits = String(year).replace(/\D/g, "");
  if (!clean(first) || !clean(last) || !yearDigits) return null;
  return `${clean(first)[0]}${clean(last)}${yearDigits}`;
}

function parseCsv(text) {
  const rows = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => l.split(",").map((c) => c.trim()));
  if (rows[0]?.[0]?.toLowerCase() === "first") rows.shift();
  return rows.map(([first = "", last = "", year = "", role = "", username = ""], i) => ({
    line: i + 2,
    first,
    last,
    year,
    role: role.toLowerCase() === "admin" ? "admin" : "student",
    username: username ? (/^[a-z0-9]+$/.test(username.toLowerCase()) ? username.toLowerCase() : null) : makeUsername(first, last, year),
  }));
}

const people = parseCsv(readFileSync(csvPath, "utf8"));

const bad = people.filter((p) => !p.username);
const counts = {};
for (const p of people) if (p.username) counts[p.username] = (counts[p.username] || 0) + 1;
const duplicates = people.filter((p) => p.username && counts[p.username] > 1);

if (bad.length || duplicates.length) {
  for (const p of bad) console.error(`Line ${p.line}: missing first name, last name, or year (or the username has characters other than letters and numbers).`);
  for (const p of duplicates) console.error(`Line ${p.line}: ${p.first} ${p.last} would be "${p.username}", which someone else also gets.`);
  console.error("\nFix these in the CSV (for example, use a middle initial in the first name column) and run again. Nothing was created.");
  process.exit(1);
}

if (!dryRun && people.some((p) => p.role === "admin") && !adminPassword) {
  console.error("The CSV has admin accounts, so --admin-password is required.");
  process.exit(1);
}

if (dryRun) {
  for (const p of people) console.log(`${p.username.padEnd(24)} ${p.first} ${p.last}${p.role === "admin" ? "  (admin)" : ""}`);
  console.log(`\n${people.length} accounts would be created. Nothing was changed (dry run).`);
  process.exit(0);
}

if (emulator) {
  process.env.FIREBASE_AUTH_EMULATOR_HOST ??= "127.0.0.1:9099";
  process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
  initializeApp({ projectId: "demo-ams-python" });
} else {
  initializeApp({ credential: applicationDefault(), projectId: option("--project") });
}

const auth = getAuth();
const db = getFirestore();
let created = 0;
let existing = 0;
let updated = 0;

for (const p of people) {
  const email = `${p.username}@${USERNAME_EMAIL_DOMAIN}`;
  const accountPassword = p.role === "admin" ? adminPassword : password;
  let uid;
  try {
    uid = (await auth.createUser({ email, password: accountPassword, displayName: p.username })).uid;
    created++;
    console.log(`created   ${p.username}${p.role === "admin" ? " (admin)" : ""}`);
  } catch (err) {
    if (err.code !== "auth/email-already-exists") throw err;
    uid = (await auth.getUserByEmail(email)).uid;
    if (updatePasswords) {
      await auth.updateUser(uid, { password: accountPassword });
      updated++;
      console.log(`updated   ${p.username}${p.role === "admin" ? " (admin)" : ""}`);
    } else {
      existing++;
      console.log(`exists    ${p.username}`);
    }
  }
  await db.doc(`users/${uid}`).set({ username: p.username, role: p.role }, { merge: true });
}

console.log(`\nDone: ${created} created, ${updated} passwords updated, ${existing} already existed (unchanged).`);
