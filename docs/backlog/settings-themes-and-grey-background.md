---
priority: p1
components: [frontend, macos]
---

# Themes in Settings and a softer default background

Alex (2026-11-20): "in settings, I also want themes. And I want the default theme to have a more gray background, with the slightest touch of blue."

## Requirements
- Themes are chosen from **Settings** (the account menu in the sidebar).
- The default (Inertia) theme's page is grey with the slightest touch of blue instead of white, in light and dark.
- Someone who prefers the old white page can still pick it.
- Follows Volta tokens and the Global/App/View style layers; the Mac palette stays in step with `_theme.scss`.

## Acceptance criteria
- The account menu shows **Settings**, which opens Mode and Theme.
- The default page background is grey-blue; cards, menus and dialogs stand off it.
- A Classic theme restores the earlier white page.
- Status-colour contrast tests still pass.
