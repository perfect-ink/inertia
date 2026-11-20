// Appearance choices: a mode (light, dark or follow the system) and a colour
// theme, which sets the accent and can tint the sidebar, as in Slack.
export type ThemeChoice = 'system' | 'light' | 'dark'

export const THEME_CHOICES: { value: ThemeChoice; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

// A sidebar tint: a deep colour the rail and panel are drawn in, with light text.
interface SidebarTint { hue: number; saturation: number; lightness: number }

// Page surfaces a theme can use instead of the default soft grey in _theme.scss.
// 'white' is the page Inertia had before 2026-11-20: white in light mode, navy in dark.
const SURFACES = {
  white: {
    light: {
      '--v-color-base': 'hsl(0deg 0% 100%)',
      '--v-color-base-subtle': 'hsl(217deg 20% 88%)',
      '--v-color-base-less-subtle': 'hsl(217deg 20% 78%)',
      '--v-color-base-more-subtle': 'hsl(217deg 20% 94%)',
      '--card': 'hsl(0deg 0% 100%)',
    },
    dark: {
      '--v-color-base': 'hsl(222deg 32% 10%)',
      '--v-color-base-subtle': 'hsl(222deg 22% 22%)',
      '--v-color-base-less-subtle': 'hsl(222deg 18% 32%)',
      '--v-color-base-more-subtle': 'hsl(222deg 26% 15%)',
      '--card': 'hsl(222deg 28% 13%)',
    },
  },
} as const

type Surface = keyof typeof SURFACES

// The hue of Inertia's own accent, the blue in _theme.scss.
const DEFAULT_HUE = 217

// Colour themes. `hue` is the accent; `sidebar` tints the sidebar, or null for
// the plain one; `surface` replaces the default grey page, or null to keep it. 'teal' is Inertia's own theme (_theme.scss), so choosing it
// applies no override; it is blue now but keeps its id so saved choices load. The ids of the first seven are the earlier accent
// presets, so a saved accent keeps its colour.
export const COLOR_THEMES = [
  { id: 'teal', label: 'Inertia', hue: DEFAULT_HUE, sidebar: null, surface: null },
  { id: 'midnight', label: 'Midnight', hue: DEFAULT_HUE, sidebar: { hue: 224, saturation: 40, lightness: 15 }, surface: null },
  { id: 'blue', label: 'Harbor', hue: 217, sidebar: { hue: 217, saturation: 50, lightness: 24 }, surface: null },
  { id: 'purple', label: 'Plum', hue: 262, sidebar: { hue: 285, saturation: 35, lightness: 24 }, surface: null },
  { id: 'pink', label: 'Rose', hue: 330, sidebar: { hue: 335, saturation: 40, lightness: 26 }, surface: null },
  { id: 'red', label: 'Crimson', hue: 0, sidebar: { hue: 355, saturation: 45, lightness: 25 }, surface: null },
  { id: 'orange', label: 'Ember', hue: 24, sidebar: { hue: 18, saturation: 45, lightness: 24 }, surface: null },
  { id: 'green', label: 'Moss', hue: 142, sidebar: { hue: 150, saturation: 30, lightness: 20 }, surface: null },
  { id: 'graphite', label: 'Graphite', hue: 217, sidebar: { hue: 220, saturation: 8, lightness: 21 }, surface: null },
  { id: 'classic', label: 'Classic', hue: DEFAULT_HUE, sidebar: null, surface: 'white' },
] as const satisfies readonly { id: string; label: string; hue: number; sidebar: SidebarTint | null; surface: Surface | null }[]

export type ColorThemeId = (typeof COLOR_THEMES)[number]['id']

export interface Appearance { theme: ThemeChoice; colorTheme: ColorThemeId }

export const DEFAULT_APPEARANCE: Appearance = { theme: 'system', colorTheme: 'teal' }

function findTheme(id: ColorThemeId) {
  return COLOR_THEMES.find((t) => t.id === id)
}

// Whether the page is dark given the choice and the system preference.
export function isDark(theme: ThemeChoice, systemPrefersDark: boolean): boolean {
  return theme === 'dark' || (theme === 'system' && systemPrefersDark)
}

// The `data-theme` attribute value: unset follows the system (what the CSS does without it).
export function themeAttribute(theme: ThemeChoice): 'light' | 'dark' | null {
  return theme === 'system' ? null : theme
}

// The accent colour itself, for a theme's swatch or preview.
export function accentColor(hue: number, dark: boolean): string {
  return `hsl(${hue}deg 72% ${dark ? 42 : 32}%)`
}

// Volta accent tokens for a theme, using the same lightness steps as _theme.scss
// (light: 32%/27%, dark: 42%/36%). Null for a theme with Inertia's own accent:
// _theme.scss already sets it.
export function accentProperties(id: ColorThemeId, dark: boolean): Record<string, string> | null {
  const hue = findTheme(id)?.hue
  if (hue === undefined || hue === DEFAULT_HUE) return null
  return dark
    ? { '--v-accent': accentColor(hue, true), '--v-accent-hover': `hsl(${hue}deg 72% 36%)`, '--v-accent-subtle': `hsl(${hue}deg 15% 18%)` }
    : { '--v-accent': accentColor(hue, false), '--v-accent-hover': `hsl(${hue}deg 72% 27%)`, '--v-accent-subtle': `hsl(${hue}deg 30% 90%)` }
}

// The sidebar's background for a theme (a little deeper in dark mode), or null
// for the plain sidebar.
export function sidebarColor(id: ColorThemeId, dark: boolean): string | null {
  const tint = findTheme(id)?.sidebar
  if (!tint) return null
  return `hsl(${tint.hue}deg ${tint.saturation}% ${tint.lightness - (dark ? 6 : 0)}%)`
}

// Tokens the tinted sidebar is drawn with (Sidebar.scss reads them when
// <html> has data-sidebar="tinted"). Null for the plain sidebar.
export function sidebarProperties(id: ColorThemeId, dark: boolean): Record<string, string> | null {
  const tint = findTheme(id)?.sidebar
  if (!tint) return null
  const { hue, saturation } = tint
  const lightness = tint.lightness - (dark ? 6 : 0)
  const shade = (l: number) => `hsl(${hue}deg ${saturation}% ${l}%)`
  return {
    '--sidebar-background': shade(lightness),
    '--sidebar-hover': shade(lightness + 10),
    '--sidebar-border': shade(lightness + 8),
    '--sidebar-field': shade(Math.max(lightness - 3, 4)),
    '--sidebar-foreground': `hsl(${hue}deg 20% 96%)`,
    '--sidebar-muted-foreground': `hsl(${hue}deg 15% 76%)`,
  }
}

// Page surface tokens for a theme with its own page colour, or null for the
// default grey page in _theme.scss.
export function surfaceProperties(id: ColorThemeId, dark: boolean): Record<string, string> | null {
  const surface = findTheme(id)?.surface
  if (!surface) return null
  return { ...SURFACES[surface][dark ? 'dark' : 'light'] }
}

// The page colour itself, for a theme's preview card.
export function pageColor(id: ColorThemeId, dark: boolean): string | null {
  return surfaceProperties(id, dark)?.['--v-color-base'] ?? null
}

export const APPEARANCE_PROPERTY_NAMES = [
  '--v-accent', '--v-accent-hover', '--v-accent-subtle',
  '--v-color-base', '--v-color-base-subtle', '--v-color-base-less-subtle', '--v-color-base-more-subtle', '--card',
  '--sidebar-background', '--sidebar-hover', '--sidebar-border', '--sidebar-field',
  '--sidebar-foreground', '--sidebar-muted-foreground',
] as const
