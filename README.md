# Matchup

Front-end recreation of the Matchup Figma file (React + Vite + TypeScript), extended into a working
lobby → invite → vote flow. All data is mocked in the browser (Zustand, persisted to `localStorage`),
so a backend can replace `src/store/useStore.ts` later without touching the UI.

```
npm install
npm run dev      # http://localhost:5173
npm run build
```

**No login required.** The app opens on Home and everyone starts as a guest (initials avatar, no photo). Logging in / signing up is optional: any valid email + a 6+ character password works in this prototype (`alex@example.com` gives the "Alex Rivera" profile). Password & Security is the only page that needs a real account.
Demo join codes: `482913` (Friday Night Social) and `731204` (The Weekend Gamers), plus the code of any lobby you create.

## Two modes

- **Local (default):** no setup. Everything runs in the browser; friends and other voters are simulated.
- **Online:** add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (see `.env.example`) and the same app uses a real Supabase backend: guest + email accounts, shared lobbies, live updates, real votes, friends and clans.
  **Follow [docs/BACKEND_SETUP.md](docs/BACKEND_SETUP.md)** (about 15 minutes, free). The database is `supabase/schema.sql`.

## What you can do

- **Create a lobby** (account menu, mobile bottom nav, Home, Groups): title, icon,
  what you're deciding (food, movies, games, activities, anything), starter options, and rules
  (link joining, member limit, who can add options, deadline, required match %).
- **Invite**: copy link, 6-digit code (admins can regenerate), **QR code** (save PNG / share sheet),
  or invite by email/username. Joining requires a **nickname**.
- **Manage members** (admins/owner): promote/demote admins, remove members, transfer ownership, cancel invites.
  **Lobby settings** (admins): rename, change rules, lock the lobby, leave, or delete (owner).
- **Options with pictures**: type an option and get live suggestions with photos (Wikipedia search),
  an instant emoji guess from a built-in catalog, or upload your own photo (downscaled in the browser).
  Nothing found → a category emoji tile. Swipe cards use whatever the option has.
- **Friends & clans** (Groups → Friends / Clans): add friends by email or username, build clans (saved crews) from them, start a lobby with a whole clan in one tap, or tap-invite friends from the invite sheet.
- **Vote** on the lobby's options (swipe / drag / arrow keys / undo) and see a ranked **result** against the required match %.

## Routes

| Route | Screen |
|---|---|
| `/login`, `/signup` | Auth |
| `/` | Home |
| `/lobby/new` (`?template=` / `?clan=`) | Create lobby |
| `/join`, `/join/:id` | Session code, invite / nickname |
| `/groups` (`?tab=friends` or `clans`) | Your lobbies, friends, clans |
| `/lobby/:id` (`?invite=1`), `/lobby/:id/customize` | Lobby, options |
| `/session/:id/vote`, `/session/:id/result` | Swipe deck, results |
| `/notifications`, `/settings`, `/settings/security`, `/settings/visibility`, `/support` | Account |
| `/activity`, `/about`, `/faq`, `/privacy` | Info |

## Also included

- **Voting rules:** only the owner/admins can *Start Voting* (enforced in the UI and by database rules). Everyone votes on their own; a fast voter sees a waiting room until the whole group has finished (admins can *Reveal results now*), and other people's votes stay hidden until then.
- **Results:** ranked list with who voted for what, copy / share / save-as-image, a runoff between the top two, "lock in" a decision (lobbies then move to *Decided*), round history.
- **Notifications** are generated from real events (someone joined, everyone's ready, a decision, a role change, a friend request).
- **Options:** paste a list, add a link, reorder (admins), photos via search or upload.
- **Groups:** search, sort, Active / Decided views.
- **Phones:** scan a lobby's QR code from the Join page.

## Prototype-only behaviour (local mode only — switched off automatically when the backend is on)

- `src/lib/hooks.ts` — pending invites are auto-accepted after a few seconds.
- `Groups.tsx` — friend requests are auto-accepted after a few seconds.
- `Lobby.tsx` — friends "lock in" on a timer and reply in chat.
- `src/lib/deck.ts` — friends' votes are simulated deterministically (`friendLikes`).
- `src/lib/wiki.ts` — option photo lookup; swap for a server endpoint (Places / TMDB / IGDB / Unsplash).
  Wikipedia thumbnails need attribution before a public launch.
- In local mode, invite links and codes resolve only in the browser that created the lobby (data lives in `localStorage`). Online mode has no such limit.

## Layout

- `src/styles/` — tokens (light + `[data-theme="dark"]`), base, ui, layout, pages, lobby
- `src/components/ui` — Button, TextField, Toggle, Avatar, Modal, ConfirmCard, CodeInput, Toast
- `src/components/lobby` — Composer (suggestions/upload), Modals (invite+QR, members, settings), item visuals
- `src/components/layout` — Navbar, Footer, BottomNav, AppShell
- `src/lib` — catalog (emoji/kinds), wiki (suggestions), image (upload), perms (roles), deck (voting), url
- `src/store/useStore.ts` — app state (persist version 4)
- `src/backend/` — Supabase client, sync engine, auth, mapping (only active in online mode)
- `supabase/schema.sql` — database tables, security rules and functions
- `docs/BACKEND_SETUP.md` — step-by-step backend guide
