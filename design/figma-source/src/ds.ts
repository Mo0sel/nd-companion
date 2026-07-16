/**
 * N&D Companion — Design System
 *
 * Single source of truth for all visual tokens and component style objects.
 * All values are extracted from the approved baseline UI.
 *
 * Usage:
 *   import { color, space, radius, type, chip, button, card } from '../ds'
 *   style={card.base}
 *   style={{ ...chip.actor, ...ds.focus }}
 */

import type React from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// COLOR
// ─────────────────────────────────────────────────────────────────────────────

export const color = {
  // Surfaces
  background:  'var(--background)',   // #0d0d0f  — page bg
  card:        'var(--card)',         // #131316  — primary surface
  secondary:   'var(--secondary)',    // #1a1a20  — raised surface / input bg
  muted:       'var(--muted)',        // #18181e  — subtler surface

  // Text
  foreground:        'var(--foreground)',         // #e4e4eb
  mutedForeground:   'var(--muted-foreground)',   // #6b6b7e
  secondaryForeground: 'var(--secondary-foreground)', // #a0a0b0

  // Accent
  primary:     'var(--primary)',      // #5b8eff  — blue
  purple:      '#a78bfa',            // card header labels
  ring:        'var(--ring)',         // #5b8eff  — focus ring

  // Borders / separators
  border:      'var(--border)',       // #1e1e26

  // Semantic
  danger:      'var(--danger)',       // #ef4444
  dangerMuted: 'var(--danger-muted)', // #2a1010
  success:     'var(--success)',      // #22c55e
  warning:     'var(--warning)',      // #f59e0b

  // Tinted panel backgrounds (used in PlaybookCard)
  blueTint:    'rgba(91,142,255,0.05)',
  amberTint:   'rgba(245,158,11,0.04)',

  // Tinted panel borders
  blueTintBorder:  'rgba(91,142,255,0.15)',
  amberTintBorder: 'rgba(245,158,11,0.15)',
} as const

// ─────────────────────────────────────────────────────────────────────────────
// SPACING  (4 / 8 pt grid)
// ─────────────────────────────────────────────────────────────────────────────

export const space = {
  1:  4,
  2:  8,
  3:  12,
  3.5: 14,
  4:  16,
  5:  20,
  6:  24,
  7:  28,
  8:  32,
} as const

// ─────────────────────────────────────────────────────────────────────────────
// CORNER RADIUS
// ─────────────────────────────────────────────────────────────────────────────

export const radius = {
  sm:   6,   // status pills, small buttons
  md:   7,   // inputs, quick-stat boxes, list items
  lg:   9,   // tinted panels inside cards
  xl:   10,  // standard cards (--radius)
  '2xl': 12, // PlaybookCard hero
  full: 9999, // avatars, dots
} as const

// ─────────────────────────────────────────────────────────────────────────────
// TYPOGRAPHY
// ─────────────────────────────────────────────────────────────────────────────

const fontSans = 'Inter, system-ui, sans-serif'
const fontMono = 'JetBrains Mono, monospace'

export const type = {
  // Display — beat editor title input
  display: {
    fontFamily: fontSans,
    fontSize: 22,
    fontWeight: 700,
    letterSpacing: '-0.025em',
    lineHeight: 1.2,
    color: color.foreground,
  },

  // H1 — playbook card beat title
  h1: {
    fontFamily: fontSans,
    fontSize: 18,
    fontWeight: 700,
    letterSpacing: '-0.02em',
    lineHeight: 1.3,
    color: color.foreground,
    margin: 0,
  },

  // H2 — campaign name
  h2: {
    fontFamily: fontSans,
    fontSize: 16,
    fontWeight: 700,
    letterSpacing: '-0.02em',
    color: color.foreground,
  },

  // H3 — stat values, quick numbers
  h3: {
    fontFamily: fontSans,
    fontSize: 15,
    fontWeight: 700,
    color: color.foreground,
  },

  // Body — primary readable text (objectives, gm notes body)
  body: {
    fontFamily: fontSans,
    fontSize: 13.5,
    lineHeight: 1.6,
    color: color.foreground,
    margin: 0,
  },

  // Body SM — secondary readable text
  bodySm: {
    fontFamily: fontSans,
    fontSize: 13,
    lineHeight: 1.6,
    color: color.foreground,
  },

  // Caption — role labels, note text
  caption: {
    fontFamily: fontSans,
    fontSize: 12,
    lineHeight: 1.45,
    color: color.mutedForeground,
  },

  // Label — section headers (COMPANION MEMORY, SESSION NOTES)
  label: {
    fontFamily: fontSans,
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
    color: color.mutedForeground,
  },

  // Micro — field labels (OBJECTIVE, GM NOTES)
  micro: {
    fontFamily: fontMono,
    fontSize: 10,
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
    color: color.mutedForeground,
    margin: 0,
  },

  // Mono — counters, timestamps, beat numbers
  mono: {
    fontFamily: fontMono,
    fontSize: 11,
    color: color.mutedForeground,
    letterSpacing: '0.04em',
  },

  // Mono body — session notes textarea, any long mono content
  monoBody: {
    fontFamily: fontMono,
    fontSize: 12.5,
    lineHeight: 1.7,
    color: color.foreground,
  },
} as const

// ─────────────────────────────────────────────────────────────────────────────
// BORDERS
// ─────────────────────────────────────────────────────────────────────────────

export const border = {
  default:  `1px solid ${color.border}`,
  subtle:   `1px solid rgba(255,255,255,0.04)`,
  accent:   `1px solid rgba(91,142,255,0.2)`,
  accentDim: `1px solid rgba(91,142,255,0.15)`,
  dashed:   `1px dashed rgba(91,142,255,0.3)`,
  dashedHover: `1px dashed rgba(91,142,255,0.6)`,
} as const

// ─────────────────────────────────────────────────────────────────────────────
// ELEVATION / SHADOW
// ─────────────────────────────────────────────────────────────────────────────
// The app uses layered backgrounds rather than drop shadows for elevation.
// Layer 0 = background, Layer 1 = card, Layer 2 = secondary/raised, Layer 3 = overlay

export const elevation = {
  0: { background: color.background },
  1: { background: color.card,      border: border.default },
  2: { background: color.secondary, border: border.default },
  3: { background: color.card,      border: border.default, boxShadow: '0 8px 32px rgba(0,0,0,0.6)' },
} as const

// ─────────────────────────────────────────────────────────────────────────────
// ICON SIZING
// ─────────────────────────────────────────────────────────────────────────────

export const iconSize = {
  xs:  12,
  sm:  14,
  md:  16,
  lg:  20,
  xl:  24,
} as const

// ─────────────────────────────────────────────────────────────────────────────
// STATUS COLORS
// ─────────────────────────────────────────────────────────────────────────────

export const status = {
  planned: { color: '#6b6b7e', bg: 'rgba(107,107,126,0.10)', border: 'rgba(107,107,126,0.25)', label: 'Planned' },
  active:  { color: '#5b8eff', bg: 'rgba(91,142,255,0.12)',  border: 'rgba(91,142,255,0.30)',  label: 'Active'  },
  done:    { color: '#22c55e', bg: 'rgba(34,197,94,0.10)',   border: 'rgba(34,197,94,0.25)',   label: 'Done'    },
  skipped: { color: '#f59e0b', bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.25)',  label: 'Skipped' },
} as const

// ─────────────────────────────────────────────────────────────────────────────
// ENTITY CHIP COLORS
// ─────────────────────────────────────────────────────────────────────────────

export const entityColor = {
  actor:     { color: '#5b8eff', bg: 'rgba(91,142,255,0.08)',  border: 'rgba(91,142,255,0.20)'  },
  scene:     { color: '#f97316', bg: 'rgba(249,115,22,0.08)',  border: 'rgba(249,115,22,0.20)'  },
  journal:   { color: '#a78bfa', bg: 'rgba(167,139,250,0.08)', border: 'rgba(167,139,250,0.20)' },
  rolltable: { color: '#22c55e', bg: 'rgba(34,197,94,0.08)',   border: 'rgba(34,197,94,0.20)'   },
} as const

// ─────────────────────────────────────────────────────────────────────────────
// AVATAR PALETTE  (deterministic color per name)
// ─────────────────────────────────────────────────────────────────────────────

const AVATAR_PALETTE = ['#3d5a8a', '#3d6b5a', '#6b4a7a', '#7a5a3d', '#3d6b7a', '#7a3d4a']

export function avatarColor(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length]
}

export function initials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

// ─────────────────────────────────────────────────────────────────────────────
// CARD VARIANTS
// ─────────────────────────────────────────────────────────────────────────────

export const card: Record<string, React.CSSProperties> = {
  // Standard card — panels, companion memory, live notes
  base: {
    background: color.card,
    border:     border.default,
    borderRadius: radius.xl,
  },

  // Hero card — PlaybookCard (slightly larger radius, overflow hidden for accent line)
  hero: {
    background:   color.card,
    border:       border.default,
    borderRadius: radius['2xl'],
    overflow:     'hidden',
  },

  // Raised — quick-stat boxes, workspace toggle active
  raised: {
    background:   color.secondary,
    border:       border.default,
    borderRadius: radius.md,
  },

  // Tinted blue — Objective panel
  tintedBlue: {
    padding:      '12px 14px',
    background:   color.blueTint,
    border:       `1px solid ${color.blueTintBorder}`,
    borderRadius: radius.lg,
    boxSizing:    'border-box',
  } as React.CSSProperties,

  // Tinted amber — GM Notes panel
  tintedAmber: {
    padding:      '12px 14px',
    background:   color.amberTint,
    border:       `1px solid ${color.amberTintBorder}`,
    borderRadius: radius.lg,
    boxSizing:    'border-box',
  } as React.CSSProperties,
}

// ─────────────────────────────────────────────────────────────────────────────
// BUTTON VARIANTS
// ─────────────────────────────────────────────────────────────────────────────

const buttonBase: React.CSSProperties = {
  display:        'inline-flex',
  alignItems:     'center',
  justifyContent: 'center',
  fontFamily:     'Inter, system-ui, sans-serif',
  fontWeight:     600,
  cursor:         'pointer',
  transition:     'all 0.12s',
  border:         'none',
  outline:        'none',
}

export const button: Record<string, React.CSSProperties> = {
  // Ghost — transparent, border appears on hover (nav arrows, "Set current")
  ghost: {
    ...buttonBase,
    padding:      '5px 10px',
    borderRadius: radius.sm,
    fontSize:     11.5,
    background:   'transparent',
    border:       border.default,
    color:        color.mutedForeground,
  },

  // Secondary — filled muted bg (Add button, inputs, selects)
  secondary: {
    ...buttonBase,
    padding:      '7px 16px',
    borderRadius: radius.md,
    fontSize:     12.5,
    background:   color.secondary,
    border:       border.default,
    color:        color.foreground,
  },

  // Primary — blue fill (primary actions)
  primary: {
    ...buttonBase,
    padding:      '7px 16px',
    borderRadius: radius.md,
    fontSize:     12.5,
    background:   color.primary,
    border:       `1px solid ${color.primary}`,
    color:        '#ffffff',
  },

  // Danger — red fill (destructive)
  danger: {
    ...buttonBase,
    padding:      '7px 16px',
    borderRadius: radius.md,
    fontSize:     12.5,
    background:   color.dangerMuted,
    border:       `1px solid ${color.danger}`,
    color:        color.danger,
  },

  // Nav arrow — square icon button (prev/next beat)
  navArrow: {
    ...buttonBase,
    width:        34,
    height:       34,
    borderRadius: radius.sm,
    fontSize:     16,
    background:   color.secondary,
    border:       border.default,
    color:        color.foreground,
    flexShrink:   0,
  },

  // Add — full-width dashed (+ Add Beat)
  addDashed: {
    ...buttonBase,
    width:        '100%',
    padding:      '9px',
    borderRadius: radius.md,
    fontSize:     12.5,
    background:   'rgba(91,142,255,0.05)',
    border:       border.dashed,
    color:        color.primary,
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// CHIP VARIANTS
// ─────────────────────────────────────────────────────────────────────────────

const chipBase: React.CSSProperties = {
  display:     'inline-flex',
  alignItems:  'center',
  gap:         5,
  padding:     '5px 10px',
  borderRadius: radius.sm,
  fontSize:    12,
  fontWeight:  500,
  whiteSpace:  'nowrap',
  cursor:      'pointer',
  transition:  'all 0.12s',
}

export const chip: Record<string, React.CSSProperties> = {
  actor: {
    ...chipBase,
    color:      entityColor.actor.color,
    background: entityColor.actor.bg,
    border:     `1px solid ${entityColor.actor.border}`,
  },
  scene: {
    ...chipBase,
    color:      entityColor.scene.color,
    background: entityColor.scene.bg,
    border:     `1px solid ${entityColor.scene.border}`,
  },
  journal: {
    ...chipBase,
    color:      entityColor.journal.color,
    background: entityColor.journal.bg,
    border:     `1px solid ${entityColor.journal.border}`,
  },
  rolltable: {
    ...chipBase,
    color:      entityColor.rolltable.color,
    background: entityColor.rolltable.bg,
    border:     `1px solid ${entityColor.rolltable.border}`,
  },

  // Status pill (Planned / Active / Done / Skipped) — inactive state
  statusInactive: {
    ...chipBase,
    padding:    '4px 10px',
    borderRadius: radius.sm,
    background: 'transparent',
    border:     border.default,
    color:      color.mutedForeground,
    cursor:     'pointer',
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// INPUT / FIELD STYLES
// ─────────────────────────────────────────────────────────────────────────────

export const input: Record<string, React.CSSProperties> = {
  base: {
    width:        '100%',
    padding:      '7px 12px',
    borderRadius: radius.md,
    border:       border.default,
    background:   color.secondary,
    color:        color.foreground,
    fontSize:     12.5,
    outline:      'none',
    fontFamily:   'Inter, system-ui, sans-serif',
    transition:   'border-color 0.15s',
    boxSizing:    'border-box' as const,
  },

  textarea: {
    width:        '100%',
    padding:      '10px 12px',
    borderRadius: radius.md,
    border:       border.default,
    background:   color.card,
    color:        color.foreground,
    fontSize:     13.5,
    lineHeight:   1.65,
    resize:       'vertical' as const,
    outline:      'none',
    fontFamily:   'Inter, system-ui, sans-serif',
    transition:   'border-color 0.15s',
    boxSizing:    'border-box' as const,
  },

  // Bare — used for the beat editor title
  bare: {
    width:           '100%',
    background:      'transparent',
    border:          'none',
    borderBottom:    '1px solid transparent',
    outline:         'none',
    padding:         0,
    fontFamily:      'Inter, system-ui, sans-serif',
    fontSize:        22,
    fontWeight:      700,
    letterSpacing:   '-0.025em',
    color:           color.foreground,
    transition:      'border-color 0.15s',
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERACTION STATES
// ─────────────────────────────────────────────────────────────────────────────

export const interact = {
  // Applied on hover to list items / beat rows
  hoverSurface: { background: 'rgba(255,255,255,0.03)' },

  // Applied on hover to accent-bordered elements
  hoverAccentBorder: { borderColor: 'rgba(91,142,255,0.5)' },

  // Active / selected beat row in sidebar
  selectedRow: {
    background:   'rgba(91,142,255,0.08)',
    borderRadius: radius.md,
  },

  // Pressed state (scale down slightly)
  pressed: { transform: 'scale(0.97)' },

  // Disabled
  disabled: { opacity: 0.35, pointerEvents: 'none' as const },

  // Focus ring (for keyboard navigation)
  focusRing: { outline: `2px solid ${color.primary}`, outlineOffset: 2 },

  // Drag-over target
  dragOver: {
    background: 'rgba(255,255,255,0.04)',
    border:     border.dashed,
    borderRadius: radius.md,
  },

  // Dragging source
  dragging: { opacity: 0.4 },
} as const

// ─────────────────────────────────────────────────────────────────────────────
// LAYOUT CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

export const layout = {
  headerHeight:    48,   // top bar
  sidebarWidth:    260,  // prepare playbook sidebar
  pagePaddingX:    28,   // horizontal page padding
  pagePaddingY:    16,   // vertical section padding
  cardGap:         16,   // gap between cards in a grid
  innerPadding:    14,   // padding inside cards
} as const
