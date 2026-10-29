# AMS Python

A Python coding environment for students. It runs Python 3.14 in the browser
(Pyodide) and stores accounts and files in Firebase.

- Friendly error messages ("Oops! Looks like you forgot a closing quote on line 5"),
  with a toggle to show the real Python error
- `input()`, `time.sleep()` and the standard library work; Stop button plus a
  30-second automatic stop
- Auto-indent toggle; no autocomplete; pasting and drag-and-drop are blocked
- Save, open, rename and delete files; share links show the latest saved version

## Running it locally

You need Node.js and Java 21+ (for the Firebase emulators). If Java isn't
installed, a copy can live in `.tools/jre` (ignored by git).

```bash
npm install
```

In one terminal, start the local Firebase emulators:

```bash
PATH="$PWD/.tools/jre/Contents/Home/bin:$PATH" npm run emulators
```

In another terminal, create test accounts, then start the app:

```bash
node scripts/create-accounts.mjs students.example.csv --password test123 --emulator
```

```bash
npm run dev
```

Open http://localhost:5173 and sign in as `asmith2029` / `test123`.
Emulator data is wiped every time the emulators stop.

## Student accounts

Make a `students.csv` (ignored by git so names stay private):

```
first,last,year,role
Jane,Doe,2026,admin
Ava,Smith,2029,
```

Usernames are first initial + last name + graduating year (`asmith2029`).
Check the list first with `--dry-run`. The script refuses to run if two students
would get the same username. Running it again skips existing accounts, so it's
safe to rerun when adding students.

## Project layout

| Path | What it does |
| --- | --- |
| `public/python-worker.js` | Runs Pyodide in a background thread; handles input, sleep, stop |
| `public/python/ams_runner.py` | Runs student code and reports errors |
| `src/python/friendlyErrors.js` | Turns Python errors into beginner-friendly messages |
| `src/python/usePythonRunner.js` | Connects the page to the worker; time limit and Stop |
| `src/editor/CodeEditor.jsx` | CodeMirror editor: auto-indent toggle, paste blocking |
| `src/pages/` | Login, workspace and share pages |
| `firestore.rules` | Who can read and write what |
| `scripts/create-accounts.mjs` | Bulk-creates student accounts |

## Live site

Live at **https://ams-python.web.app** (Firebase project `buzzer-trivia-game`,
hosting site `ams-python`). Production settings live in `.env.production`.

Deploy changes:

```bash
npx vite build && npx firebase deploy --only hosting,firestore:rules
```

Create real accounts (needs `service-account.json` from Project settings →
Service accounts, which must never be shared or committed):

```bash
GOOGLE_APPLICATION_CREDENTIALS=service-account.json node scripts/create-accounts.mjs students.csv --project buzzer-trivia-game --password 'STUDENT_PASSWORD' --admin-password 'ADMIN_PASSWORD'
```

Add `--update-passwords` to the same command to change the passwords of
accounts that already exist.
