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

## Prototype-only behaviour (delete when the backend lands)

- `src/lib/hooks.ts` — pending invites are auto-accepted after a few seconds.
- `Groups.tsx` — friend requests are auto-accepted after a few seconds.
- `Lobby.tsx` — friends "lock in" on a timer and reply in chat.
- `src/lib/deck.ts` — friends' votes are simulated deterministically (`friendLikes`).
- `src/lib/wiki.ts` — option photo lookup; swap for a server endpoint (Places / TMDB / IGDB / Unsplash).
  Wikipedia thumbnails need attribution before a public launch.
- Invite links and codes resolve only in the browser that created the lobby, since data lives in `localStorage`.

## Layout

- `src/styles/` — tokens (light + `[data-theme="dark"]`), base, ui, layout, pages, lobby
- `src/components/ui` — Button, TextField, Toggle, Avatar, Modal, ConfirmCard, CodeInput, Toast
- `src/components/lobby` — Composer (suggestions/upload), Modals (invite+QR, members, settings), item visuals
- `src/components/layout` — Navbar, Footer, BottomNav, AppShell
- `src/lib` — catalog (emoji/kinds), wiki (suggestions), image (upload), perms (roles), deck (voting), url
- `src/store/useStore.ts` — mock data layer (persist version 3)
