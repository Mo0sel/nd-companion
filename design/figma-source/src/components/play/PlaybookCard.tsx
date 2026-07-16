import type { Beat, BeatStatus } from '../../data/campaign'
import { STATUS_META } from '../../data/campaign'

interface Props {
  beat: Beat
  index: number
  total: number
  canPrev: boolean
  canNext: boolean
  onPrev: () => void
  onNext: () => void
  onStatusChange: (s: BeatStatus) => void
}

const STATUSES: BeatStatus[] = ['planned', 'active', 'done', 'skipped']

// ── Sub-components ────────────────────────────────────────────────────────────

function NavArrow({ dir, enabled, onClick }: {
  dir: 'prev' | 'next'
  enabled: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={!enabled}
      aria-label={dir === 'prev' ? 'Previous beat' : 'Next beat'}
      style={{
        width: 32,
        height: 32,
        borderRadius: 'var(--nd-radius-sm)',
        border: '1px solid var(--nd-border)',
        background: enabled ? 'var(--nd-surface-2)' : 'transparent',
        color: enabled ? 'var(--nd-text-1)' : 'var(--nd-border)',
        fontSize: 14,
        cursor: enabled ? 'pointer' : 'default',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        transition: 'var(--nd-transition-fast)',
        opacity: enabled ? 1 : 0.3,
      }}
      onMouseEnter={e => {
        if (enabled) (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--nd-blue)'
      }}
      onMouseLeave={e => {
        if (enabled) (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--nd-border)'
      }}
    >
      {dir === 'prev' ? '←' : '→'}
    </button>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PlaybookCard({
  beat, index, total, canPrev, canNext, onPrev, onNext, onStatusChange,
}: Props) {
  const meta = STATUS_META[beat.status]

  return (
    <div style={{
      background: 'var(--nd-surface)',
      border: '1px solid var(--nd-border)',
      borderRadius: 'var(--nd-radius-2xl)',
      overflow: 'hidden',
    }}>
      {/* Status accent line */}
      <div style={{ height: 2, background: meta.color, opacity: 0.65 }} />

      <div style={{ padding: '14px 18px 16px' }}>

        {/* Header: nav ← | counter | title | status pills | nav → */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 14,
        }}>
          <NavArrow dir="prev" enabled={canPrev} onClick={onPrev} />

          {/* Beat counter */}
          <div style={{
            fontFamily: 'var(--nd-font-mono)',
            fontSize: 'var(--nd-text-mono)',
            color: 'var(--nd-text-3)',
            flexShrink: 0,
            letterSpacing: '0.04em',
          }}>
            <span style={{ color: 'var(--nd-text-1)', fontWeight: 600, fontSize: 13 }}>{index + 1}</span>
            <span style={{ margin: '0 3px' }}>/</span>
            <span>{total}</span>
          </div>

          {/* Title block */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 'var(--nd-text-micro)',
              fontFamily: 'var(--nd-font-mono)',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--nd-purple)',
              marginBottom: 3,
            }}>
              Playbook · Current Beat
            </div>
            <h2 style={{
              margin: 0,
              fontSize: 'var(--nd-text-h1)',
              fontWeight: 700,
              letterSpacing: '-0.02em',
              lineHeight: 'var(--nd-leading-tight)',
              color: 'var(--nd-text-1)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {beat.title}
            </h2>
          </div>

          {/* Status pills */}
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            {STATUSES.map(s => {
              const m = STATUS_META[s]
              const active = beat.status === s
              return (
                <button
                  key={s}
                  onClick={() => onStatusChange(s)}
                  title={m.label}
                  aria-pressed={active}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 'var(--nd-radius-sm)',
                    border: `1px solid ${active ? m.color : 'var(--nd-border)'}`,
                    background: active ? m.bg : 'transparent',
                    color: active ? m.color : 'var(--nd-text-3)',
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'var(--nd-transition-fast)',
                    letterSpacing: '0.02em',
                  }}
                  onMouseEnter={e => {
                    if (!active) {
                      const el = e.currentTarget as HTMLButtonElement
                      el.style.borderColor = m.color
                      el.style.color = m.color
                    }
                  }}
                  onMouseLeave={e => {
                    if (!active) {
                      const el = e.currentTarget as HTMLButtonElement
                      el.style.borderColor = 'var(--nd-border)'
                      el.style.color = 'var(--nd-text-3)'
                    }
                  }}
                >
                  {m.label}
                </button>
              )
            })}
          </div>

          <NavArrow dir="next" enabled={canNext} onClick={onNext} />
        </div>

        {/* Content panels */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 10,
          marginBottom: beat.entities.length > 0 ? 12 : 0,
        }}>
          {/* Objective */}
          <div style={{
            padding: '11px 14px',
            background: 'var(--nd-blue-tint)',
            border: '1px solid var(--nd-blue-border)',
            borderRadius: 'var(--nd-radius-lg)',
          }}>
            <div style={{
              fontSize: 'var(--nd-text-micro)',
              fontFamily: 'var(--nd-font-mono)',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--nd-blue)',
              marginBottom: 7,
            }}>
              Objective
            </div>
            <p style={{
              margin: 0,
              fontSize: 'var(--nd-text-body)',
              lineHeight: 'var(--nd-leading-normal)',
              color: 'var(--nd-text-1)',
            }}>
              {beat.objective}
            </p>
          </div>

          {/* GM Notes */}
          <div style={{
            padding: '11px 14px',
            background: 'rgba(245,158,11,0.04)',
            border: '1px solid rgba(245,158,11,0.14)',
            borderRadius: 'var(--nd-radius-lg)',
          }}>
            <div style={{
              fontSize: 'var(--nd-text-micro)',
              fontFamily: 'var(--nd-font-mono)',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--nd-warning)',
              marginBottom: 7,
            }}>
              GM Notes
            </div>
            <p style={{
              margin: 0,
              fontSize: 'var(--nd-text-body-sm)',
              lineHeight: 'var(--nd-leading-normal)',
              color: 'var(--nd-text-1)',
            }}>
              {beat.gmNotes}
            </p>
          </div>
        </div>

        {/* Related entities */}
        {beat.entities.length > 0 && (
          <div>
            <div style={{
              fontSize: 'var(--nd-text-micro)',
              fontFamily: 'var(--nd-font-mono)',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--nd-purple)',
              marginBottom: 8,
            }}>
              Related
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {beat.entities.map(entity => (
                <EntityChip key={entity.id} entity={entity} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Entity chip ───────────────────────────────────────────────────────────────

type EntityType = import('../../data/campaign').EntityType

const ENTITY_COLORS: Record<EntityType, { color: string; bg: string; border: string }> = {
  actor:     { color: 'var(--nd-actor-color)',     bg: 'var(--nd-actor-bg)',     border: 'var(--nd-actor-border)'     },
  scene:     { color: 'var(--nd-scene-color)',     bg: 'var(--nd-scene-bg)',     border: 'var(--nd-scene-border)'     },
  journal:   { color: 'var(--nd-journal-color)',   bg: 'var(--nd-journal-bg)',   border: 'var(--nd-journal-border)'   },
  rolltable: { color: 'var(--nd-rolltable-color)', bg: 'var(--nd-rolltable-bg)', border: 'var(--nd-rolltable-border)' },
}

function EntityChip({ entity }: { entity: { id: string; type: EntityType; name: string } }) {
  const s = ENTITY_COLORS[entity.type]
  return (
    <button
      title={`Open ${entity.name} in Foundry`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '4px 10px',
        borderRadius: 'var(--nd-radius-sm)',
        border: `1px solid ${s.border}`,
        background: s.bg,
        color: s.color,
        fontSize: 'var(--nd-text-caption)',
        fontWeight: 500,
        cursor: 'pointer',
        transition: 'var(--nd-transition-fast)',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.72' }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1' }}
    >
      {entity.name}
    </button>
  )
}
