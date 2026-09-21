# Backend setup (Supabase) — step by step

The app runs in two modes:

| Mode | When | What you get |
|---|---|---|
| **Local** (default) | no environment variables | Everything works in one browser (data in `localStorage`), friends and votes are simulated. |
| **Online** | `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` are set | Real accounts and guests, lobbies shared between phones, live updates, real votes, friends, clans. |

You don't change any code to switch — you only add two environment variables. Setup takes about 15 minutes and is free.

> **Why Supabase?** It gives you a Postgres database, sign-in (including anonymous guests), realtime updates and security rules in one hosted service, so there is no server for you to run or pay for. Matchup only needs the two keys below.

---

## Step 1 — Create the project

1. Go to <https://supabase.com> → **Start your project** → sign in with GitHub.
2. **New project**. Pick your organization, then:
   - **Name:** `matchup`
   - **Database password:** click *Generate*, and save it somewhere (you rarely need it, but you can't recover it).
   - **Region:** the one closest to your players.
3. Click **Create new project** and wait ~2 minutes until the dashboard says the project is ready.

## Step 2 — Create the tables and security rules

1. In the left sidebar open **SQL Editor** → **New query**.
2. Open `supabase/schema.sql` from this repo, copy **all** of it, paste it in, and click **Run**.
3. You should see *Success. No rows returned.* (It is safe to run again later — it won't delete data.)

> **Updating an existing project?** Whenever `supabase/schema.sql` changes (for example the voting rules below), open the SQL Editor and run the whole file again. It only adds what is missing, so your lobbies, accounts and votes stay untouched. You need this once after pulling the *admin-only voting* update.

This creates the tables (lobbies, members, options, chat, votes, friends, clans) and the **row-level security** rules, so people can only see and change what they should (e.g. only lobby members can read a lobby; only admins can lock it).

To double-check: **Table Editor** should now list `lobbies`, `lobby_members`, `lobby_items`, `lobby_votes`, `friendships`, `clans`, …

## Step 3 — Turn on guest sign-in (required)

Matchup lets people hop in without an account. Behind the scenes each guest gets an *anonymous* account.

1. Sidebar → **Authentication** → **Sign In / Providers** (older dashboards: *Providers*).
2. Find **Anonymous Sign-Ins** and switch it **on**. Save.

If you skip this the app shows *"Guest sign-in is turned off in Supabase"*.

## Step 4 — Email settings (so signing up is smooth)

Still in **Authentication → Sign In / Providers → Email**:

- Leave **Enable Email provider** on.
- For development, turn **off "Confirm email"**. Then signing up just works. (Turn it back on before you launch publicly — see *Going live* below.)

## Step 5 — Allow your website addresses

**Authentication → URL Configuration**

- **Site URL:** your production address, e.g. `https://matchup-yourname.vercel.app` (you can change this later).
- **Redirect URLs:** add both
  - `http://localhost:5173/**`
  - `https://matchup-yourname.vercel.app/**`

This is what makes password-reset links and sign-in redirects come back to your app.

## Step 6 — Copy your two keys

Sidebar → **Project Settings** (gear) → **API** (or **Data API**).

- **Project URL** → looks like `https://abcdxyz.supabase.co`
- **anon / public key** (labelled `anon` `public`, or "Publishable key") → a long string

> The anon key is **meant to be in the browser** — the security rules from Step 2 are what protect your data. **Never** put the `service_role` key in this app or in Vercel.

## Step 7 — Run it on your computer

1. In the project folder, copy `.env.example` to **`.env.local`** and fill it in:

   ```
   VITE_SUPABASE_URL=https://abcdxyz.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOi...your key...
   ```

   (`.env.local` is git-ignored, so your keys are not committed.)
2. `npm install` then `npm run dev`, open <http://localhost:5173>.
3. You should see *Connecting…* for a moment, then the home page. In **Supabase → Authentication → Users** you'll now see an anonymous user — that's you.

### Smoke test (5 minutes, do this once)

Use two different browsers (or one normal + one private window) so you have two people.

1. **Window 1:** create a lobby, add a few options (try typing "pizza" for a photo, and upload one).
2. Copy the invite link (Lobby → *Invite*). **Window 2:** open it, type a nickname, join.
3. Both windows: the lobby should show **2 members** — and each change (a new option, a chat message, a "Ready" tap) should appear in the other window within a second or two.
4. **Only the owner/admins can start voting.** In Window 2 (a plain member) there is no *Start Voting* button — just a note saying so. In Window 1 press **Start Voting**; Window 2 now shows *Voting is open* → **Vote now**.
5. Vote quickly in Window 2 and press *See results*. It should show *Waiting for the group* (with who is still voting) — **not** the ranking — until Window 1 finishes voting. Others' votes stay hidden by the database until everyone is done (an admin can use *Reveal results now* to end the wait early).
6. Window 1 (owner) → **Lock in this pick**. Window 2 should show the decision banner.
7. **Groups → Friends:** in Window 1 sign up with an email; in Window 2 sign up with another; add each other by email → accept the request.

If something is off, see *Troubleshooting* at the bottom.

## Step 8 — Deploy on Vercel

1. Vercel dashboard → your project → **Settings → Environment Variables**.
2. Add the same two variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) for **Production** (and Preview if you use previews).
3. **Deployments → ⋯ → Redeploy** (variables are read at build time, so a redeploy is required).
4. Copy the production URL into **Supabase → Authentication → URL Configuration** (Step 5) if you haven't.

`vercel.json` in this repo makes links like `/join/friday-night-ab12` open the app directly (needed for QR codes and shared links).

---

## How it works (so you can change things confidently)

```
 React screens ──▶ store (instant, optimistic) ──▶ sync engine ──▶ Supabase
        ▲                                             │  (writes)
        └──────────── realtime updates ◀──────────────┘
```

- **Every screen still talks to the local store.** When you tap something, the UI updates immediately.
- `src/backend/sync.ts` watches the store and turns each change into a database write (add option, vote, ready, role change…). If a write is rejected by the security rules, the app shows a small warning and reloads the true state.
- Supabase **Realtime** tells the app when anything changes; the app reloads just that lobby (`src/backend/mapping.ts` converts the database JSON into the app's model).
- Guests are **anonymous accounts**. Signing up **upgrades the same account**, so a guest keeps their lobbies. Logging in to an *existing* account switches to that account (the guest's lobbies stay with the guest account).
- One SQL function, `lobby_bundle(...)`, returns everything about a lobby in one request.

## Going live checklist

- [ ] **Confirm email** turned back **on** (Step 4) and a real **SMTP provider** configured (Authentication → Emails → SMTP Settings). The built-in mailer is rate-limited and meant for testing.
- [ ] Site URL and Redirect URLs point at your real domain.
- [ ] Anonymous sign-ins: keep on, but consider enabling **CAPTCHA** (Authentication → Attack Protection) so bots can't mass-create guests.
- [ ] Free plan note: projects **pause after 7 days of inactivity** (resume from the dashboard) and have storage/bandwidth limits. Upgrade when you have real traffic.
- [ ] Turn on **Point-in-time backups** on a paid plan once real people depend on the data.

## Troubleshooting

| Symptom | Fix |
|---|---|
| "Can't reach the backend" on load | Check both variables are set (restart `npm run dev` after editing `.env.local`; redeploy on Vercel). |
| "Guest sign-in is turned off in Supabase" | Step 3. |
| Lobby created but disappears / "Couldn't save that change" | Step 2 wasn't run fully. Re-run `schema.sql` and read the red error, if any. Check the browser console for `[sync]` messages. |
| Changes only appear after ~30 s in the other window | Realtime isn't publishing tables: re-run `schema.sql` (its last part adds them), or **Database → Publications → supabase_realtime** and make sure the tables are ticked. |
| "An account with this email already exists" when signing up | Log in instead. |
| Reset-password link opens but says "session missing" | Add your address to **Redirect URLs** (Step 5). |
| Friend search finds nobody | Only people with a real account (email) can be found; guests can't. |

## Known limits (good next steps)

- **Photos** are stored inside the option row (small JPEGs). For lots of photos, move them to **Supabase Storage** (create a public bucket `option-photos`, upload in `Composer.tsx`, save the URL instead).
- **Notifications** are generated in the browser from real events; someone who wasn't online won't get a past "Sam joined" alert (invites *are* found on next visit). A `notifications` table + database triggers would fix that.
- **Voting deadline** is shown but not enforced by the server.
- **Deleting an account** removes the person's data, but lobbies they owned stay (without an owner) for the remaining members.
- **Email/push notifications** (the toggles in Settings) are UI only for now.
