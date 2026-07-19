import { useState } from 'react'
import type { Entry } from '../../data/nd'

interface Props {
  entries: Entry[]
  activeEntryId: string
  onSelect: (id: string) => void
  onUpdate: (id: string, changes: Partial<Entry>) => void
  onAdd: () => void
  onDelete: (id: string) => void
  onReorder: (entries: Entry[]) => void
}

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'var(--nd-surface-2)',
  border: '1px solid var(--nd-border)', borderRadius: 'var(--nd-radius-md)',
  padding: '9px 12px', color: 'var(--nd-text-1)', fontSize: 13,
  lineHeight: 1.55, outline: 'none', fontFamily: 'var(--nd-font-sans)',
  transition: 'border-color 0.12s', boxSizing: 'border-box',
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 14 }}>
      <div style={{ width: 2, height: 11, borderRadius: 1, background: 'var(--nd-purple)' }} />
      <span style={{
        fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.09em', color: 'var(--nd-purple)',
        fontFamily: 'var(--nd-font-mono)',
      }}>{children}</span>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <p style={{
        margin: '0 0 6px',
        fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.09em', color: 'var(--nd-text-3)',
        fontFamily: 'var(--nd-font-mono)',
      }}>{label}</p>
      {children}
    </div>
  )
}

function IconBtn({ children, onClick, disabled, danger }: {
  children: React.ReactNode
  onClick: (e: React.MouseEvent) => void
  disabled?: boolean
  danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 20, height: 20, borderRadius: 4,
        border: '1px solid var(--nd-border)',
        background: 'transparent',
        color: 'var(--nd-text-3)',
        fontSize: 12, cursor: disabled ? 'default' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.1s', padding: 0, lineHeight: 1, opacity: disabled ? 0.3 : 1,
      }}
      onMouseEnter={e => {
        if (!disabled) {
          ;(e.currentTarget as HTMLButtonElement).style.color = danger ? 'var(--nd-danger)' : 'var(--nd-text-1)'
          ;(e.currentTarget as HTMLButtonElement).style.borderColor = danger ? 'var(--nd-danger)' : 'var(--nd-text-1)'
        }
      }}
      onMouseLeave={e => {
        if (!disabled) {
          ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--nd-text-3)'
          ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--nd-border)'
        }
      }}
    >{children}</button>
  )
}

export default function PrepareWorkspace({ entries, activeEntryId, onSelect, onUpdate, onAdd, onDelete, onReorder }: Props) {
  const entry = entries.find(e => e.id === activeEntryId) ?? entries[0]
  const [newChar, setNewChar] = useState('')

  const addCharacter = () => {
    if (!entry || !newChar.trim()) return
    onUpdate(entry.id, { characters: [...entry.characters, newChar.trim()] })
    setNewChar('')
  }

  const removeCharacter = (name: string) => {
    if (!entry) return
    onUpdate(entry.id, { characters: entry.characters.filter(c => c !== name) })
  }

  const moveEntry = (fromIdx: number, dir: 'up' | 'down') => {
    const toIdx = dir === 'up' ? fromIdx - 1 : fromIdx + 1
    if (toIdx < 0 || toIdx >= entries.length) return
    const next = [...entries]
    const [moved] = next.splice(fromIdx, 1)
    next.splice(toIdx, 0, moved)
    onReorder(next)
  }

  const focus = (e: React.FocusEvent<HTMLTextAreaElement | HTMLInputElement>, color: string) => {
    e.target.style.borderColor = color
  }
  const blur = (e: React.FocusEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    e.target.style.borderColor = 'var(--nd-border)'
  }

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>

      {/* ── Left: Entry form ─────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px' }}>

        {entry ? (
          <>
            <div style={{ marginBottom: 22 }}>
              <SectionLabel>Session Builder</SectionLabel>
              <input
                value={entry.title}
                onChange={e => onUpdate(entry.id, { title: e.target.value })}
                style={{
                  ...inputStyle, fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em',
                  background: 'transparent',
                  borderTop: 'none', borderRight: 'none', borderLeft: 'none',
                  borderBottom: '1px solid transparent',
                  borderRadius: 0, padding: '4px 0',
                }}
                onFocus={e => { e.target.style.borderBottomColor = 'var(--nd-border)' }}
                onBlur={e => { e.target.style.borderBottomColor = 'transparent' }}
                placeholder="Entry title"
              />
            </div>

            <Field label="Speech Notes">
              <textarea
                value={entry.speechNotes}
                onChange={e => onUpdate(entry.id, { speechNotes: e.target.value })}
                placeholder="Dialogue, read-aloud text, and talking points…"
                rows={3}
                style={{ ...inputStyle, resize: 'vertical' }}
                onFocus={e => focus(e, 'rgba(91,142,255,0.4)')}
                onBlur={blur}
              />
            </Field>

            <Field label="Objective">
              <textarea
                value={entry.objective}
                onChange={e => onUpdate(entry.id, { objective: e.target.value })}
                placeholder="What needs to happen…"
                rows={2}
                style={{ ...inputStyle, resize: 'vertical' }}
                onFocus={e => focus(e, 'rgba(91,142,255,0.4)')}
                onBlur={blur}
              />
            </Field>

            <Field label="Setup">
              <textarea
                value={entry.setup}
                onChange={e => onUpdate(entry.id, { setup: e.target.value })}
                placeholder="Scene context, hidden information, GM instructions…"
                rows={4}
                style={{ ...inputStyle, resize: 'vertical' }}
                onFocus={e => focus(e, 'rgba(91,142,255,0.4)')}
                onBlur={blur}
              />
            </Field>

            <Field label="Twist">
              <textarea
                value={entry.twist}
                onChange={e => onUpdate(entry.id, { twist: e.target.value })}
                placeholder="Potential twist or complication…"
                rows={2}
                style={{ ...inputStyle, resize: 'vertical', borderLeftColor: 'rgba(245,158,11,0.3)' }}
                onFocus={e => focus(e, 'rgba(245,158,11,0.5)')}
                onBlur={blur}
              />
            </Field>

            <Field label="Possible Outcomes">
              <textarea
                value={entry.possibleOutcomes}
                onChange={e => onUpdate(entry.id, { possibleOutcomes: e.target.value })}
                placeholder="Likely outcomes and consequences…"
                rows={3}
                style={{ ...inputStyle, resize: 'vertical' }}
                onFocus={e => focus(e, 'rgba(91,142,255,0.4)')}
                onBlur={blur}
              />
            </Field>

            <Field label="Reward">
              <textarea
                value={entry.reward}
                onChange={e => onUpdate(entry.id, { reward: e.target.value })}
                placeholder="XP, items, story rewards…"
                rows={2}
                style={{ ...inputStyle, resize: 'vertical', borderLeftColor: 'rgba(34,197,94,0.3)' }}
                onFocus={e => focus(e, 'rgba(34,197,94,0.4)')}
                onBlur={blur}
              />
            </Field>

            <Field label="Scene">
              <input
                value={entry.scene}
                onChange={e => onUpdate(entry.id, { scene: e.target.value })}
                placeholder="Scene name or Foundry scene reference…"
                style={{ ...inputStyle }}
                onFocus={e => focus(e, 'rgba(249,115,22,0.4)')}
                onBlur={blur}
              />
              {entry.scene && (
                <div style={{ marginTop: 6 }}>
                  <span style={{
                    padding: '3px 9px', borderRadius: 'var(--nd-radius-sm)',
                    background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.25)',
                    color: '#f97316', fontSize: 11.5, fontWeight: 500,
                  }}>{entry.scene.split(/[_ (]/)[0]}</span>
                </div>
              )}
            </Field>

            <Field label="Characters">
              {entry.characters.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
                  {entry.characters.map(c => (
                    <span key={c} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      padding: '3px 8px', borderRadius: 'var(--nd-radius-sm)',
                      background: 'var(--nd-blue-dim)', border: '1px solid var(--nd-blue-border)',
                      color: 'var(--nd-blue)', fontSize: 12, fontWeight: 500,
                    }}>
                      {c}
                      <button
                        onClick={() => removeCharacter(c)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--nd-blue)', opacity: 0.5, padding: 0, fontSize: 13, lineHeight: 1 }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.5' }}
                      >×</button>
                    </span>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', gap: 7 }}>
                <input
                  value={newChar}
                  onChange={e => setNewChar(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addCharacter() }}
                  placeholder="Add character…"
                  style={{ ...inputStyle, flex: 1 }}
                  onFocus={e => focus(e, 'rgba(91,142,255,0.4)')}
                  onBlur={blur}
                />
                <button
                  onClick={addCharacter}
                  style={{
                    padding: '0 16px', borderRadius: 'var(--nd-radius-md)',
                    border: '1px solid var(--nd-blue)', background: 'var(--nd-blue-dim)',
                    color: 'var(--nd-blue)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >Add</button>
              </div>
            </Field>
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--nd-text-3)', fontSize: 13 }}>
            No entry selected
          </div>
        )}
      </div>

      {/* ── Right: Prepared entries sidebar ──────────────────────────────── */}
      <div style={{
        width: 260, minWidth: 260,
        borderLeft: '1px solid var(--nd-border)',
        display: 'flex', flexDirection: 'column',
        background: 'var(--nd-surface)', overflow: 'hidden',
      }}>
        <div style={{ padding: '16px 14px 10px', borderBottom: '1px solid var(--nd-border)', flexShrink: 0 }}>
          <SectionLabel>Prepared Entries</SectionLabel>
          <button
            style={{
              width: '100%', padding: '8px', borderRadius: 'var(--nd-radius-md)',
              border: 'none', background: 'var(--nd-blue)',
              color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', marginBottom: 6,
            }}
          >Import from Campaign</button>
          <button
            onClick={onAdd}
            style={{
              width: '100%', padding: '7px', borderRadius: 'var(--nd-radius-md)',
              border: '1px solid var(--nd-border)', background: 'transparent',
              color: 'var(--nd-text-2)', fontSize: 12, fontWeight: 500, cursor: 'pointer',
              transition: 'all 0.12s',
            }}
            onMouseEnter={e => {
              ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--nd-blue)'
              ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--nd-blue)'
            }}
            onMouseLeave={e => {
              ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--nd-border)'
              ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--nd-text-2)'
            }}
          >+ Add Entry</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '6px' }}>
          {entries.map((e, i) => {
            const isActive = e.id === activeEntryId
            const statusColor = e.status === 'active' ? 'var(--nd-blue)' : e.status === 'completed' ? 'var(--nd-success)' : 'var(--nd-text-3)'
            return (
              <div
                key={e.id}
                onClick={() => onSelect(e.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '7px 8px', borderRadius: 'var(--nd-radius-md)',
                  cursor: 'pointer', marginBottom: 2,
                  background: isActive ? 'rgba(91,142,255,0.08)' : 'transparent',
                  border: isActive ? '1px solid rgba(91,142,255,0.2)' : '1px solid transparent',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={ev => { if (!isActive) (ev.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.025)' }}
                onMouseLeave={ev => { if (!isActive) (ev.currentTarget as HTMLDivElement).style.background = 'transparent' }}
              >
                <div style={{
                  width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
                  background: statusColor,
                }} />
                <span style={{
                  fontSize: 10, fontFamily: 'var(--nd-font-mono)',
                  color: 'var(--nd-text-3)', flexShrink: 0, width: 14, textAlign: 'right',
                }}>{i + 1}.</span>
                <span style={{
                  flex: 1, minWidth: 0, fontSize: 12,
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? 'var(--nd-text-1)' : 'var(--nd-text-2)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{e.title}</span>
                <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                  <IconBtn onClick={ev => { ev.stopPropagation(); moveEntry(i, 'up') }} disabled={i === 0}>↑</IconBtn>
                  <IconBtn onClick={ev => { ev.stopPropagation(); moveEntry(i, 'down') }} disabled={i === entries.length - 1}>↓</IconBtn>
                  <IconBtn onClick={ev => { ev.stopPropagation(); onDelete(e.id) }} danger>×</IconBtn>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
