# Appearance settings

## What it does
Account menu (click your name in the sidebar) → **Settings** opens a dialog with:
- **Mode**: System (follow the OS, the default), Light or Dark, in the shared `Select` dropdown.
- **Theme**, picked from preview cards as in Slack: each card shows the theme's sidebar beside its page with its accent. Inertia (the default: blue accent, plain sidebar, and a soft grey page with the slightest touch of blue; cards, menus and dialogs stay white), Midnight (blue accent, deep navy sidebar), Harbor (blue), Plum (purple), Rose (pink), Crimson (red), Ember (orange), Moss (green), Graphite (blue accent, grey sidebar) and Classic (Inertia's look before 2026-11-20: white page in light mode, navy in dark). Every theme but Inertia tints the whole sidebar a deep colour with light text, a little deeper in dark mode; menus that open inside the sidebar keep the page's colours.
- **Reset** returns to System and Inertia. Changes apply immediately and are remembered.
Light and Dark set `data-theme` on `<html>`; System removes it so the OS preference decides. A theme other than Inertia overrides Volta's `--v-accent`, `--v-accent-hover` and `--v-accent-subtle` as inline custom properties, using the same lightness steps as `_theme.scss` for light and dark. A theme with its own page (Classic) sets the page tokens `--v-color-base`, `--v-color-base-subtle`, `--v-color-base-less-subtle`, `--v-color-base-more-subtle` and `--card` the same way. A tinting theme also sets `--sidebar-*` properties and `data-sidebar="tinted"` on `<html>`, which `Sidebar.scss` reads to redefine the sidebar's tokens. Both follow an OS scheme change while System is chosen.

## API and models
None: the choice is stored in `localStorage` (`inertia-appearance`) on this device and is not sent to the server. Code: `data/appearance.ts` (`COLOR_THEMES`, `isDark`, `surfaceProperties`, `pageColor`, `themeAttribute`, `accentProperties`, `sidebarColor`, `sidebarProperties`), `store/appearance.ts` (persisted as version 1; a version 0 `accent` becomes the colour theme with the same id, so earlier choices keep their colour), `components/AppearanceEffect.tsx` (mounted in `App.tsx`), `components/AppearanceDialog.tsx`.

## Who can view and change
Each person for themselves, per device.

## Tests
`frontend/src/data/appearance.test.ts`, `store/appearance.test.ts`, `components/AppearanceEffect.test.tsx`, `components/AppearanceDialog.test.tsx`.

## Known limits
- Not synced between devices or the Mac app (the Mac shell has its own localStorage); a server-stored preference would follow the person.
- Only preset themes, no custom colour picker (Slack has one). Accent text on tinted backgrounds (`--accent-foreground`) keeps the default blue value, so contrast with other accents was not checked.
- The first paint uses the default theme until the app mounts (a brief flash is possible for a saved Dark choice with a light OS).
- Status colours (`docs/features/status_colors.md`) follow light and dark but deliberately not the accent: a red status stays red in every colour theme.

## History
- 2026-11-20 (Alex): the default page changed from white to a soft grey with a hint of blue (light `hsl(216 14% 95%)`, borders and muted fills a step darker; dark mode greyer too, `hsl(220 12% 11%)` instead of navy), with cards and dialogs kept white in light mode. Classic keeps the old page. The account-menu entry is now **Settings** and the picker is labelled **Theme**. The Mac palette (`VoltaPalette.swift`) and its test were updated to match.
- 2026-11-03: the default accent (Inertia and Midnight) changed from teal (hue 174) to blue (hue 217). The theme id stays `teal`.
- Implemented 2026-10-19 on branch `backlog/appearance-settings`. Not merged or deployed.
- Not verified: lint, type-check, tests and the browser (colours in light and dark) were not run (no node_modules).

- Merged to main 2026-11-02 after running, merged with main: `rails db:migrate` (schema diff clean), `rails test`, `npm run lint`, `tsc -b`, Jest, and the collab-server tests, all passing. Not checked in a browser.
- Colour themes added 2026-11-02 (Slack-style cards, tinted sidebar, Mode select). Lint, `tsc -b` and Jest pass; checked in a browser (Chromium, against a mocked API) in light and dark at 1280px and 375px. Not committed or deployed.
