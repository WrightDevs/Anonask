# AnonAsk — Setup Guide

AnonAsk is an anonymous messaging app. A user registers, gets a link like
`send.html?u=righteous`, shares it, and anyone can drop them an
**anonymous** message. Only the owner can read their inbox — and the
sender's identity is never stored.

Built with plain **HTML + CSS + JS** on the front end and **Supabase**
(hosted Postgres + auth) as the backend.

---

## What you need

- A free Supabase account → https://app.supabase.com
- Any static way to open the files (see **Running it** below)

---

## Step 1 — Create / open your Supabase project

1. Go to https://app.supabase.com and open your project
   (or **New project**, pick a name + database password, wait ~1 min).

## Step 2 — Run the database schema

1. In Supabase, open **SQL Editor → New query**.
2. Open `schema.sql` from this folder, copy everything, paste it in.
3. Click **Run**. This creates the `profiles` and `messages` tables and
   all the security rules that make the app truly anonymous.

## Step 3 — Turn OFF email confirmation (for a smooth demo)

So new sign-ups log in instantly with nothing to click in an inbox:

1. **Authentication → Sign In / Providers → Email**.
2. Turn **off** "Confirm email" and save.

> Skip this only if you want the realistic flow where users must click a
> confirmation link before logging in.

## Step 4 — Paste your keys

1. In Supabase: **Project Settings (gear) → API**.
2. Copy the **Project URL** and the **anon / public** key.
3. Open `js/supabase-config.js` and paste them:

   ```js
   const SUPABASE_URL = "https://YOUR-PROJECT.supabase.co";
   const SUPABASE_ANON_KEY = "eyJ...your-anon-key...";
   ```

   The **anon key is meant to be public** — the security rules from
   Step 2 are what actually protect the data. Never paste the
   `service_role` key here.

---

## Running it

The app is static files, but browsers restrict some features on
`file://`, so serve it over `http://`:

```bash
# from this folder, pick one:
python -m http.server 5500
# or, if you have Node:
npx serve .
```

Then open `http://localhost:5500` (or the port shown).
VS Code users: the **Live Server** extension works too.

---

## Try the full flow

1. **Register** at `/register.html` — pick a handle (e.g. `righteous`).
2. You land on your **dashboard** with your link:
   `…/send.html?u=righteous`. Hit **Copy**.
3. Open that link in a **different browser or your phone** (or an
   incognito window) — no login needed.
4. Send a message. It appears in your dashboard inbox, marked only as
   **Anonymous**. With realtime on, it shows up instantly; otherwise hit ↻.

---

## Files

| File | Role |
|------|------|
| `index.html` | Landing page |
| `register.html` / `login.html` | Account owner sign-up / sign-in |
| `dashboard.html` | Private inbox (read / delete / report) |
| `send.html` | Public anonymous message page (`?u=handle`) |
| `schema.sql` | Tables + Row Level Security — run in Supabase |
| `js/supabase-config.js` | Your URL + anon key |
| `js/auth.js` | Register / login / session guard |
| `js/dashboard.js` | Inbox logic |
| `js/send.js` | Anonymous send + rate limit |
| `js/ui.js` | Shared helpers (toast, veil mark, time) |
| `css/*` | Styles (`theme.css` is the design system) |

---

## How anonymity is enforced (good to explain in a presentation)

- The `messages` table has **no sender column** — not a name, email or
  id. There is literally nothing to leak.
- **Row Level Security** allows anyone to `INSERT` a message, but only
  the row's `recipient_id` owner can `SELECT` it. So no one — not even
  another logged-in user — can read someone else's inbox.
- `profiles` exposes only `username` + `display_name` publicly; emails
  live in Supabase's `auth.users`, which the app never exposes.

## Known limits (fair to mention)

- The send-page **rate limit is client-side** — a deterrent, not a hard
  guarantee. A robust limit would need a Supabase Edge Function.
- **Report** flags a note and hides it from the inbox; there's no
  separate moderator view in this MVP.
- No replies — anonymous senders have no account to receive one.
