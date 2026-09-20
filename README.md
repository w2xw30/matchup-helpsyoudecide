# Matchup

Front-end recreation of the Matchup Figma file (React + Vite + TypeScript). All data is mocked
in the browser (Zustand, persisted to `localStorage`) so a backend can replace `src/store/useStore.ts`
later without touching the UI.

```
npm install
npm run dev      # http://localhost:5173
npm run build
```

Demo login: any valid email + a password of 6+ characters (`alex@example.com` gives the "Alex Rivera" profile).
Demo join code: any 6 digits except `000000` (e.g. `482913`).

## Routes

| Route | Screen |
|---|---|
| `/login`, `/signup` | Auth |
| `/` | Home (theme toggle = dark home) |
| `/join`, `/join/:id` | Session code, invite / nickname |
| `/groups` | Groups list |
| `/lobby/:id`, `/lobby/:id/customize` | Lobby, Customize Lobby |
| `/session/:id/vote`, `/session/:id/result` | Swipe deck (+ celebration modal), result |
| `/notifications`, `/settings` | Notifications, Settings |
| `/settings/security`, `/settings/visibility`, `/support` | Extra screens (not in Figma) |
| `/activity`, `/about`, `/faq`, `/privacy` | Extra screens (not in Figma) |

Phone layouts are CSS-only (≤700px): bottom nav replaces the navbar tabs.

## Layout

- `src/styles/tokens.css` — design tokens (light + `[data-theme="dark"]`)
- `src/components/ui` — Button, TextField, Toggle, Avatar, Modal, ConfirmCard, CodeInput, Toast
- `src/components/layout` — Navbar, Footer, BottomNav, AppShell
- `src/pages` — one file per screen group
- `src/store/useStore.ts` — mock data layer
