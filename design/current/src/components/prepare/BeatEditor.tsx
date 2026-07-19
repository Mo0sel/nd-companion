import { useState } from 'react'
import type { Beat, Entity, EntityType, BeatStatus } from '../../data/campaign'
import { ENTITY_ICONS, STATUS_META } from '../../data/campaign'

interface Props {
  beat: Beat
  onUpdate: (changes: Partial<Beat>) => void
}

const ENTITY_TYPES: { type: EntityType; label: string }[] = [
  { type: 'actor',     label: 'Actor'      },
  { type: 'scene',     label: 'Scene'      },
  { type: 'journal',   label: 'Journal'    },
  { type: 'rolltable', label: 'Roll Table' },
]

const STATUSES: BeatStatus[] = ['planned', 'active', 'done', 'skipped']

const ENTITY_COLORS: Record<EntityType, { color: string; bg: string; border: string }> = {
  actor:     { color: 'var(--nd-actor-color)',     bg: 'var(--nd-actor-bg)',     border: 'var(--nd-actor-border)'     },
  scene:     { color: 'var(--nd-scene-color)',     bg: 'var(--nd-scene-bg)',     border: 'var(--nd-scene-border)'     },
  journal:   { color: 'var(--nd-journal-color)',   bg: 'var(--nd-journal-bg)',   border: 'var(--nd-journal-border)'   },
  rolltable: { color: 'var(--nd-rolltable-color)', bg: 'var(--nd-rolltable-bg)', border: 'var(--nd-rolltable-border)' },
}

// ── Field wrapper ─────────────────────────────────────────────────────────────

function Field({ label, accent, children }: {
  label: string
  accent: string
  children: React.ReactNode
}) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
        <div style={{ width: 2.5, height: 13, borderRadius: 2, background: accent, flexShrink: 0 }} />
        <span style={{
          fontSize: 'var(--nd-text-micro)',
          fontFamily: 'var(--nd-font-mono)',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'var(--nd-text-3)',
        }}>
          {label}
        </span>
      </div>
      {children}
    </div>
  )
}

// ── Shared input style ────────────────────────────────────────────────────────

const textareaStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--nd-surface)',
  border: '1px solid var(--nd-border)',
  borderRadius: 'var(--nd-radius-md)',
  padding: '10px 12px',
  color: 'var(--nd-text-1)',
  fontSize: 'var(--nd-text-body)',
  lineHeight: 'var(--nd-leading-normal)',
  resize: 'vertical',
  outline: 'none',
  fontFamily: 'var(--nd-font-sans)',
  transition: 'border-color var(--nd-transition-fast)',
  boxSizing: 'border-box',
}

// ── Main component ────────────────────────────────────────────────────────────

export default function BeatEditor({ beat, onUpdate }: Props) {
  const [newEntityType, setNewEntityType] = useState<EntityType>('actor')
  const [newEntityName, setNewEntityName] = useState('')

  const addEntity = () => {
    if (!newEntityName.trim()) return
    const entity: Entity = { id: `e${Date.now()}`, type: newEntityType, name: newEntityName.trim() }
    onUpdate({ entities: [...beat.entities, entity] })
    setNewEntityName('')
  }

  const removeEntity = (id: string) => {
    onUpdate({ entities: beat.entities.filter(e => e.id !== id) })
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
      <div style={{ maxWidth: 680 }}>

        {/* Title */}
        <input
          value={beat.title}
          onChange={e => onUpdate({ title: e.target.value })}
          placeholder="Beat title…"
          style={{
            width: '100%',
            background: 'transparent',
            borderTop: 'none', borderRight: 'none', borderLeft: 'none',
            borderBottom: '1px solid transparent',
            outline: 'none',
            padding: '0 0 6px',
            fontSize: 'var(--nd-text-display)',
            fontWeight: 700,
            letterSpacing: '-0.025em',
            color: 'var(--nd-text-1)',
            fontFamily: 'var(--nd-font-sans)',
            transition: 'border-color var(--nd-transition-base)',
            boxSizing: 'border-box',
          }}
          onFocus={e => { e.target.style.borderBottomColor = 'var(--nd-border)' }}
          onBlur={e => { e.target.style.borderBottomColor = 'transparent' }}
        />

        {/* Status row */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          margin: '12px 0 28px',
        }}>
          <span style={{
            fontSize: 11,
            color: 'var(--nd-text-3)',
            marginRight: 2,
            flexShrink: 0,
          }}>Status</span>
          {STATUSES.map(s => {
            const m = STATUS_META[s]
            const active = beat.status === s
            return (
              <button
                key={s}
                onClick={() => onUpdate({ status: s })}
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

        {/* Objective */}
        <Field label="Objective" accent="var(--nd-blue)">
          <textarea
            value={beat.objective}
            onChange={e => onUpdate({ objective: e.target.value })}
            placeholder="What needs to happen for this beat to succeed?"
            rows={3}
            style={textareaStyle}
            onFocus={e => { e.target.style.borderColor = 'rgba(91,142,255,0.4)' }}
            onBlur={e => { e.target.style.borderColor = 'var(--nd-border)' }}
          />
        </Field>

        {/* GM Notes */}
        <Field label="GM Notes" accent="var(--nd-warning)">
          <textarea
            value={beat.gmNotes}
            onChange={e => onUpdate({ gmNotes: e.target.value })}
            placeholder="How to run this beat. What the players don't know. Hidden rolls, NPC tells, exits."
            rows={6}
            style={textareaStyle}
            onFocus={e => { e.target.style.borderColor = 'rgba(245,158,11,0.4)' }}
            onBlur={e => { e.target.style.borderColor = 'var(--nd-border)' }}
          />
        </Field>

        {/* Related Entities */}
        <Field label="Related Entities" accent="var(--nd-text-3)">
          {/* Existing chips */}
          {beat.entities.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
              {beat.entities.map(entity => {
                const s = ENTITY_COLORS[entity.type]
                return (
                  <div key={entity.id} style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 8px 4px 10px',
                    borderRadius: 'var(--nd-radius-sm)',
                    border: `1px solid ${s.border}`,
                    background: s.bg,
                    color: s.color,
                    fontSize: 'var(--nd-text-caption)',
                    fontWeight: 500,
                  }}>
                    <span style={{ fontSize: 12 }}>{ENTITY_ICONS[entity.type]}</span>
                    {entity.name}
                    <button
                      onClick={() => removeEntity(entity.id)}
                      aria-label={`Remove ${entity.name}`}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: s.color,
                        opacity: 0.45,
                        padding: 0,
                        fontSize: 14,
                        lineHeight: 1,
                        marginLeft: 2,
                        transition: 'opacity var(--nd-transition-fast)',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.45' }}
                    >×</button>
                  </div>
                )
              })}
            </div>
          )}

          {/* Add entity row */}
          <div style={{ display: 'flex', gap: 7 }}>
            <select
              value={newEntityType}
              onChange={e => setNewEntityType(e.target.value as EntityType)}
              style={{
                padding: '7px 10px',
                borderRadius: 'var(--nd-radius-md)',
                border: '1px solid var(--nd-border)',
                background: 'var(--nd-surface-2)',
                color: 'var(--nd-text-1)',
                fontSize: 'var(--nd-text-caption)',
                outline: 'none',
                cursor: 'pointer',
                flexShrink: 0,
                fontFamily: 'var(--nd-font-sans)',
                transition: 'border-color var(--nd-transition-fast)',
              }}
              onFocus={e => { e.target.style.borderColor = 'rgba(91,142,255,0.4)' }}
              onBlur={e => { e.target.style.borderColor = 'var(--nd-border)' }}
            >
              {ENTITY_TYPES.map(et => (
                <option key={et.type} value={et.type}>{et.label}</option>
              ))}
            </select>

            <input
              value={newEntityName}
              onChange={e => setNewEntityName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addEntity() }}
              placeholder="Entity name…"
              style={{
                flex: 1,
                padding: '7px 12px',
                borderRadius: 'var(--nd-radius-md)',
                border: '1px solid var(--nd-border)',
                background: 'var(--nd-surface-2)',
                color: 'var(--nd-text-1)',
                fontSize: 12.5,
                outline: 'none',
                fontFamily: 'var(--nd-font-sans)',
                transition: 'border-color var(--nd-transition-fast)',
              }}
              onFocus={e => { e.target.style.borderColor = 'rgba(91,142,255,0.4)' }}
              onBlur={e => { e.target.style.borderColor = 'var(--nd-border)' }}
            />

            <button
              onClick={addEntity}
              style={{
                padding: '7px 16px',
                borderRadius: 'var(--nd-radius-md)',
                border: '1px solid var(--nd-border)',
                background: 'var(--nd-surface-2)',
                color: 'var(--nd-text-1)',
                fontSize: 12.5,
                fontWeight: 500,
                cursor: 'pointer',
                flexShrink: 0,
                fontFamily: 'var(--nd-font-sans)',
                transition: 'var(--nd-transition-fast)',
              }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLButtonElement
                el.style.borderColor = 'rgba(91,142,255,0.4)'
                el.style.color = 'var(--nd-blue)'
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLButtonElement
                el.style.borderColor = 'var(--nd-border)'
                el.style.color = 'var(--nd-text-1)'
              }}
            >
              Add
            </button>
          </div>
        </Field>

      </div>
    </div>
  )
}
