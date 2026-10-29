import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "./firebase";

// Firestore layout:
//   users/{uid}   { username, role: "student" | "admin", autoIndent, theme }
//   files/{id}    { ownerUid, ownerUsername, name, code, createdAt, updatedAt }
// A file's id doubles as its share link, which is why anyone may read a single
// file by id (see firestore.rules).

export const MAX_CODE_LENGTH = 100_000;

export function subscribeToMyFiles(uid, onFiles, onError) {
  const q = query(collection(db, "files"), where("ownerUid", "==", uid));
  return onSnapshot(
    q,
    (snap) => {
      const files = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      files.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
      onFiles(files);
    },
    onError,
  );
}

export async function createFile({ uid, username, name, code = "" }) {
  const ref = await addDoc(collection(db, "files"), {
    ownerUid: uid,
    ownerUsername: username,
    name,
    code,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export function saveFile(id, code) {
  return updateDoc(doc(db, "files", id), { code, updatedAt: serverTimestamp() });
}

export function renameFile(id, name) {
  return updateDoc(doc(db, "files", id), { name, updatedAt: serverTimestamp() });
}

export function deleteFile(id) {
  return deleteDoc(doc(db, "files", id));
}

export async function getSharedFile(id) {
  const snap = await getDoc(doc(db, "files", id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export function setAutoIndentPreference(uid, autoIndent) {
  return updateDoc(doc(db, "users", uid), { autoIndent });
}

export function setThemePreference(uid, theme) {
  return updateDoc(doc(db, "users", uid), { theme });
}

// Turns what a student typed into a clean file name ending in .py.
// Returns { name } or { error }.
export function normalizeFileName(raw, existingFiles, ignoreId) {
  let name = raw.trim().replace(/\.py$/i, "").trim();
  if (!name) return { error: "Please type a name." };
  if (!/^[A-Za-z0-9 _-]+$/.test(name)) {
    return { error: "Use only letters, numbers, spaces, - and _." };
  }
  if (name.length > 40) return { error: "That name is too long (40 characters max)." };
  name = `${name}.py`;
  const taken = existingFiles.some((f) => f.id !== ignoreId && f.name.toLowerCase() === name.toLowerCase());
  if (taken) return { error: `You already have a file called ${name}.` };
  return { name };
}
