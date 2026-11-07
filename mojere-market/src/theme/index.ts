/**
 * Mojere Market design tokens.
 *
 * Every colour, size and spacing value used in the app comes from here,
 * so the look stays consistent and can be changed in one place.
 *
 * Palette: a deep "Ondo green" for trust, a warm market orange for
 * actions that make money (Sell, Declutter), and soft neutrals.
 * Text/background pairs below meet WCAG AA contrast (4.5:1 or better).
 */
export const colors = {
  primary: '#0F7A4A', // deep green — brand, headers, primary buttons
  primaryDark: '#0A5A36',
  primarySoft: '#E3F3EA', // tinted backgrounds, chips
  accent: '#E8730C', // market orange — Sell / Declutter calls to action
  accentDark: '#B85A08',
  accentSoft: '#FDEFE2',

  background: '#F7F8F6',
  surface: '#FFFFFF',
  border: '#E1E5E0',

  text: '#1B2420',
  textMuted: '#5B6760',
  textOnPrimary: '#FFFFFF',

  success: '#1E8E4F',
  warning: '#9A6200',
  warningSoft: '#FFF6DD',
  danger: '#C62828',
  dangerSoft: '#FDECEC',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

export const fontSize = {
  caption: 12,
  small: 14,
  body: 16,
  title: 20,
  heading: 24,
  display: 30,
} as const;

/** Minimum touch target recommended for accessibility (Android & iOS). */
export const MIN_TOUCH = 48;
