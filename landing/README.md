# FleetGrid — landing page

AI-powered infrastructure for logistics networks that don't stop when things go wrong.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-checks (tsc) then builds to dist/
npm run preview
```

## Routes

| Path   | What                                                     |
|--------|----------------------------------------------------------|
| `/`    | Landing page (`src/pages/LandingPage.tsx`)               |
| `/app` | Placeholder for the FleetGrid app (`src/pages/AppPlaceholder.tsx`) |

Every "Enter FleetGrid / Enter Control Tower / Sign In" link uses `APP_URL` in `src/components/Navbar.tsx`.

**Connecting the real app later**
- Same repo: replace `AppPlaceholder` in `src/main.tsx` with your app root (or add React Router).
- Separate deployment: set `APP_URL` to the app's URL, or add a rewrite/redirect for `/app` in `vercel.json`.

## Design tokens

All colors and fonts live in the `@theme` block at the top of `src/index.css`
(`--color-base`, `--color-signal`, `--color-caution`, `--color-fault`, `--font-sans`, …).
The SVG network visual reads the same CSS variables. Fonts (Geist / Geist Mono) load from Google Fonts in `index.html`.

## Demo data

All numbers, vehicles (FG-027, FG-041…), shipments and timestamps are illustrative and hard-coded in each component.
