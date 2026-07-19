import { useState } from 'react'
import type { Entry, Objective } from '../../data/nd'

interface Props {
  entries: Entry[]
  activeEntryId: string
  activeIndex: number
  onNavigate: (id: string) => void
  onUpdateEntry: (id: string, changes: Partial<Entry>) => void
  campaignInfo: { name: string; currentLocation: string; focusedCharacter: string; currentSession?: string }
}

// ── Tinted card ───────────────────────────────────────────────────────────────

interface CardProps {
  children: React.ReactNode
  accentColor?: string
  bg?: string
  style?: React.CSSProperties
}

function Card({ children, bg, style }: CardProps) {
  return (
    <div style={{
      background: bg ?? 'rgba(91,142,255,0.045)',
      border: '1px solid var(--nd-border)',
      borderRadius: 'var(--nd-radius-xl)',
      padding: '13px 15px',
      ...style,
    }}>{children}</div>
  )
}

function FieldLabel({ children, color, action }: {
  children: React.ReactNode
  color?: string
  action?: React.ReactNode
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {color && <div style={{ width: 2.5, height: 11, borderRadius: 2, background: color, flexShrink: 0 }} />}
        <span style={{
          fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.09em', color: color ?? 'var(--nd-text-3)',
          fontFamily: 'var(--nd-font-mono)',
        }}>{children}</span>
      </div>
      {action}
    </div>
  )
}

function SectionHeader({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      marginBottom: 10,
    }}>
      <div style={{ width: 2.5, height: 14, borderRadius: 2, background: color, flexShrink: 0 }} />
      <span style={{
        fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.1em', color,
        fontFamily: 'var(--nd-font-mono)',
      }}>{children}</span>
      <div style={{ flex: 1, height: 1, background: 'var(--nd-border)' }} />
    </div>
  )
}

function EmptyText({ children }: { children: React.ReactNode }) {
  return <p style={{ margin: 0, fontSize: 12.5, color: 'var(--nd-text-3)', fontStyle: 'italic' }}>{children}</p>
}

function ContentBlock({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 13, lineHeight: 1.65, color: 'var(--nd-text-1)', whiteSpace: 'pre-wrap' }}>
      {children}
    </div>
  )
}

function AutoSaved() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--nd-text-3)', fontFamily: 'var(--nd-font-mono)' }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--nd-success)', display: 'inline-block', opacity: 0.8 }} />
      auto-saved
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function PlayWorkspace({ entries, activeEntryId, activeIndex, onNavigate, onUpdateEntry, campaignInfo }: Props) {
  const entry = entries.find(e => e.id === activeEntryId) ?? entries[0]
  const [setupCollapsed, setSetupCollapsed] = useState(false)

  if (!entry) return null

  const canPrev = activeIndex > 0
  const canNext = activeIndex < entries.length - 1

  const toggleObjective = (objId: string) => {
    onUpdateEntry(entry.id, {
      objectives: entry.objectives.map(o => o.id === objId ? { ...o, done: !o.done } : o),
    })
  }

  const addObjective = () => {
    const obj: Objective = { id: `obj${Date.now()}`, text: 'New objective', done: false }
    onUpdateEntry(entry.id, { objectives: [...entry.objectives, obj] })
  }

  const STATUS_COLORS = {
    active:    { solid: '#5b8eff', bg: 'rgba(91,142,255,0.12)' },
    completed: { solid: '#22c55e', bg: 'rgba(34,197,94,0.10)' },
    planned:   { solid: '#6b6b7e', bg: 'rgba(107,107,126,0.10)' },
  }

  const navBtn = (enabled: boolean, onClick: () => void, label: string) => (
    <button
      onClick={onClick}
      disabled={!enabled}
      style={{
        width: 28, height: 28, borderRadius: 7,
        border: '1px solid var(--nd-border)',
        background: enabled ? 'var(--nd-surface-2)' : 'transparent',
        color: enabled ? 'var(--nd-text-1)' : 'var(--nd-border)',
        fontSize: 13, cursor: enabled ? 'pointer' : 'default',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, transition: 'all 0.1s', opacity: enabled ? 1 : 0.35,
      }}
      onMouseEnter={e => { if (enabled) (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--nd-blue)' }}
      onMouseLeave={e => { if (enabled) (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--nd-border)' }}
    >{label}</button>
  )

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ── Context bar ─────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center',
        padding: '0 20px', height: 44,
        background: 'var(--nd-surface)', borderBottom: '1px solid var(--nd-border)',
        flexShrink: 0, gap: 0,
      }}>
        {/* Campaign name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginRight: 16 }}>
          <span style={{
            fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.1em', color: 'var(--nd-text-3)', fontFamily: 'var(--nd-font-mono)',
          }}>Campaign</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--nd-text-1)', letterSpacing: '-0.02em' }}>
            {campaignInfo.name}
          </span>
        </div>

        <div style={{ width: 1, height: 18, background: 'var(--nd-border)', marginRight: 16, flexShrink: 0 }} />

        {/* Location chip */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, marginRight: 8,
          padding: '4px 10px', borderRadius: 6,
          background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.2)',
        }}>
          <svg width="9" height="9" viewBox="0 0 10 12" fill="none" style={{ flexShrink: 0 }}>
            <path d="M5 0C2.8 0 1 1.8 1 4c0 3 4 8 4 8s4-5 4-8c0-2.2-1.8-4-4-4zm0 5.5A1.5 1.5 0 1 1 5 2.5a1.5 1.5 0 0 1 0 3z" fill="#f97316" />
          </svg>
          <span style={{ fontSize: 11.5, fontWeight: 600, color: '#f97316', whiteSpace: 'nowrap' }}>
            {campaignInfo.currentLocation}
          </span>
        </div>

        {/* Focus chip */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '4px 10px', borderRadius: 6,
          background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)',
        }}>
          <div style={{
            width: 14, height: 14, borderRadius: '50%', flexShrink: 0,
            background: 'rgba(167,139,250,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 7, fontWeight: 800, color: '#a78bfa',
          }}>
            {campaignInfo.focusedCharacter.split(' ').map((w: string) => w[0]).slice(0, 2).join('')}
          </div>
          <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--nd-purple)', whiteSpace: 'nowrap' }}>
            {campaignInfo.focusedCharacter}
          </span>
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Entry status pills */}
        <div style={{
          display: 'flex', gap: 3,
          background: 'var(--nd-surface-2)', border: '1px solid var(--nd-border)',
          borderRadius: 8, padding: 3,
        }}>
          {(['active', 'completed', 'planned'] as const).map(s => {
            const c = STATUS_COLORS[s]
            const isActive = entry.status === s
            const labels = { active: 'Active', completed: 'Done', planned: 'Planned' }
            return (
              <button
                key={s}
                onClick={() => onUpdateEntry(entry.id, { status: s })}
                style={{
                  padding: '4px 12px', borderRadius: 6,
                  border: 'none',
                  background: isActive ? c.bg : 'transparent',
                  color: isActive ? c.solid : 'var(--nd-text-3)',
                  fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  transition: 'all 0.12s',
                  outline: isActive ? `1px solid ${c.solid}40` : 'none',
                  outlineOffset: '-1px',
                }}
                onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.color = 'var(--nd-text-1)' }}
                onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.color = 'var(--nd-text-3)' }}
              >{labels[s]}</button>
            )
          })}
        </div>
      </div>

      {/* ── Entry navigation ─────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 20px',
        flexShrink: 0, background: 'var(--nd-bg)',
      }}>
        {navBtn(canPrev, () => onNavigate(entries[activeIndex - 1].id), '←')}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flex: 1, minWidth: 0 }}>
          <span style={{ fontFamily: 'var(--nd-font-mono)', fontSize: 10.5, color: 'var(--nd-text-3)', flexShrink: 0 }}>
            <span style={{ color: 'var(--nd-text-1)', fontWeight: 700, fontSize: 12 }}>{activeIndex + 1}</span>{' / '}{entries.length}
          </span>
          <span style={{
            fontSize: 8.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em',
            color: 'var(--nd-text-3)', flexShrink: 0, fontFamily: 'var(--nd-font-mono)',
          }}>Current Entry</span>
          <h2 style={{
            margin: 0, fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em',
            color: 'var(--nd-text-1)', lineHeight: 1.2,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{entry.title}</h2>
        </div>
        {navBtn(canNext, () => onNavigate(entries[activeIndex + 1].id), '→')}
      </div>


      {/* ── Scrollable content ───────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '14px 20px' }}>

        {/* ══ Scene Flow — muted red ════════════════════════════════════════════ */}
        <SectionHeader color="rgba(175,100,100,1)">Scene Flow</SectionHeader>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>

          {/* Speech Notes */}
          <Card accentColor="rgba(175,100,100,0.5)">
            <FieldLabel color="rgba(175,100,100,0.7)">Speech Notes</FieldLabel>
            <textarea
              value={entry.speechNotes}
              onChange={e => onUpdateEntry(entry.id, { speechNotes: e.target.value })}
              placeholder="Dialogue, read-aloud text…"
              rows={4}
              style={{
                width: '100%', background: 'transparent', border: 'none', outline: 'none',
                resize: 'none', color: 'var(--nd-text-1)', fontSize: 13,
                lineHeight: 1.65, fontFamily: 'var(--nd-font-sans)', padding: 0,
                boxSizing: 'border-box',
              }}
            />
          </Card>

          {/* Setup */}
          <Card accentColor="rgba(155,80,80,0.5)">
            <FieldLabel
              color="rgba(175,110,110,0.65)"
              action={
                <button
                  onClick={() => setSetupCollapsed(c => !c)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--nd-text-3)', fontSize: 9.5, fontWeight: 600,
                    fontFamily: 'var(--nd-font-mono)', textTransform: 'uppercase',
                    letterSpacing: '0.06em', padding: 0,
                  }}
                >{setupCollapsed ? 'Expand' : 'Collapse'}</button>
              }
            >Setup</FieldLabel>
            {!setupCollapsed && (
              entry.setup
                ? <ContentBlock>{entry.setup}</ContentBlock>
                : <EmptyText>Not prepared.</EmptyText>
            )}
            {setupCollapsed && entry.setup && (
              <p style={{ margin: 0, fontSize: 12, color: 'var(--nd-text-3)', fontStyle: 'italic' }}>
                {entry.setup.split('\n')[0].slice(0, 70)}…
              </p>
            )}
            {entry.references.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 10 }}>
                {entry.references.map(ref => (
                  <span key={ref.id} style={{
                    padding: '3px 9px', borderRadius: 'var(--nd-radius-sm)',
                    background: ref.color ? `${ref.color}15` : 'var(--nd-surface-2)',
                    border: `1px solid ${ref.color ? `${ref.color}35` : 'var(--nd-border)'}`,
                    color: ref.color ?? 'var(--nd-text-2)', fontSize: 11.5, fontWeight: 500,
                  }}>{ref.label}</span>
                ))}
              </div>
            )}
          </Card>

          {/* Objectives */}
          <Card accentColor="rgba(175,100,100,0.5)">
            <FieldLabel
              color="rgba(175,100,100,0.7)"
              action={
                <button
                  onClick={addObjective}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'rgba(175,100,100,0.7)', fontSize: 9.5, fontWeight: 700,
                    fontFamily: 'var(--nd-font-mono)', textTransform: 'uppercase',
                    letterSpacing: '0.06em', padding: 0,
                  }}
                >+ Add</button>
              }
            >Objectives</FieldLabel>
            {entry.objectives.length === 0
              ? <EmptyText>No objectives yet.</EmptyText>
              : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 2 }}>
                  {entry.objectives.map(obj => (
                    <button
                      key={obj.id}
                      onClick={() => toggleObjective(obj.id)}
                      style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}
                    >
                      <div style={{
                        width: 15, height: 15, borderRadius: 3, flexShrink: 0, marginTop: 2,
                        border: obj.done ? 'none' : '1.5px solid rgba(175,100,100,0.35)',
                        background: obj.done ? '#22c55e' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.12s',
                      }}>
                        {obj.done && (
                          <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                            <path d="M1 3L3 5L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                      <span style={{
                        fontSize: 13, lineHeight: 1.45,
                        color: obj.done ? 'var(--nd-text-3)' : 'var(--nd-text-1)',
                        textDecoration: obj.done ? 'line-through' : 'none',
                        textDecorationColor: 'var(--nd-text-3)',
                      }}>{obj.text}</span>
                    </button>
                  ))}
                </div>
              )
            }
          </Card>

          {/* Experience + Reward */}
          <Card accentColor="rgba(185,120,120,0.45)">
            <FieldLabel color="rgba(185,120,120,0.65)">
              Experience &amp; Reward
            </FieldLabel>
            {entry.experience
              ? <ContentBlock>{entry.experience}{entry.reward && entry.reward !== entry.experience ? '\n' + entry.reward : ''}</ContentBlock>
              : <EmptyText>Not set.</EmptyText>
            }
          </Card>
        </div>

        {/* ══ Response & Notes — muted amber ═══════════════════════════════════ */}
        <SectionHeader color="rgba(180,130,75,1)">Response &amp; Notes</SectionHeader>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>

          {/* Twist */}
          <Card accentColor="rgba(180,130,75,0.5)">
            <FieldLabel color="rgba(180,130,75,0.7)">Twist</FieldLabel>
            {entry.twist
              ? <ContentBlock>{entry.twist}</ContentBlock>
              : <EmptyText>Not prepared.</EmptyText>
            }
          </Card>

          {/* Possible Outcomes */}
          <Card accentColor="rgba(185,145,90,0.45)">
            <FieldLabel color="rgba(185,145,90,0.65)">Possible Outcomes</FieldLabel>
            {entry.possibleOutcomes
              ? <ContentBlock>{entry.possibleOutcomes}</ContentBlock>
              : <EmptyText>Not prepared.</EmptyText>
            }
          </Card>

          {/* GM Notes — editable, full width */}
          <Card accentColor="rgba(180,130,75,0.5)" style={{ gridColumn: '1 / -1' }}>
            <FieldLabel
              color="rgba(180,130,75,0.7)"
              action={<div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(180,130,75,0.6)' }} />}
            >GM Notes</FieldLabel>
            <textarea
              value={entry.notes}
              onChange={e => onUpdateEntry(entry.id, { notes: e.target.value })}
              placeholder="Live GM notes for this entry…"
              rows={4}
              style={{
                width: '100%', background: 'transparent', border: 'none', outline: 'none',
                resize: 'none', color: 'var(--nd-text-1)', fontSize: 13,
                lineHeight: 1.65, fontFamily: 'var(--nd-font-sans)', padding: 0,
                boxSizing: 'border-box',
              }}
            />
          </Card>
        </div>

        {/* ══ Session strip — lime palette ══════════════════════════════════════ */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, paddingBottom: 4 }}>
          <div style={{
            background: 'rgba(91,142,255,0.045)',
            border: '1px solid var(--nd-border)',
            borderRadius: 'var(--nd-radius-xl)', overflow: 'hidden',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 14px', borderBottom: '1px solid var(--nd-border)',
            }}>
              <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'rgba(105,158,65,0.72)', fontFamily: 'var(--nd-font-mono)' }}>
                Session Notes
              </span>
              <AutoSaved />
            </div>
            <textarea
              value={entry.sessionNotes}
              onChange={e => onUpdateEntry(entry.id, { sessionNotes: e.target.value })}
              style={{
                width: '100%', background: 'transparent', border: 'none', outline: 'none',
                resize: 'none', color: 'var(--nd-text-1)', fontSize: 12.5,
                lineHeight: 1.65, fontFamily: 'var(--nd-font-sans)', padding: '10px 14px',
                boxSizing: 'border-box', height: 88,
              }}
            />
          </div>

          <div style={{
            background: 'rgba(91,142,255,0.045)',
            border: '1px solid var(--nd-border)',
            borderRadius: 'var(--nd-radius-xl)', overflow: 'hidden',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 14px', borderBottom: '1px solid var(--nd-border)',
            }}>
              <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'rgba(115,170,70,0.72)', fontFamily: 'var(--nd-font-mono)' }}>
                Session Summary
              </span>
              <AutoSaved />
            </div>
            <textarea
              value={entry.sessionSummary}
              onChange={e => onUpdateEntry(entry.id, { sessionSummary: e.target.value })}
              placeholder="Permanent session summary…"
              style={{
                width: '100%', background: 'transparent', border: 'none', outline: 'none',
                resize: 'none', color: 'var(--nd-text-1)', fontSize: 12.5,
                lineHeight: 1.65, fontFamily: 'var(--nd-font-sans)', padding: '10px 14px',
                boxSizing: 'border-box', height: 88,
              }}
            />
          </div>
        </div>

      </div>
    </div>
  )
}
