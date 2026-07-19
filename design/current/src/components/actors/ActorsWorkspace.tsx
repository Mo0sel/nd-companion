import { useState } from 'react'

interface NPC {
  id: string
  name: string
  faction: string
  attitude: 'friendly' | 'neutral' | 'hostile' | 'unknown'
  notes: string
}

interface Thread {
  id: string
  npcId: string
  summary: string
  session: string
}

const INITIAL_NPCS: NPC[] = [
  { id: 'n1', name: 'Agata Karlov', faction: 'Orzhov', attitude: 'hostile', notes: 'Head of the Karlov family. Powerful. Calculating.' },
  { id: 'n2', name: 'Vesk', faction: 'Orzhov', attitude: 'neutral', notes: 'Orzhov collector. Assigned the party\'s punishment branding.' },
  { id: 'n3', name: 'Prof. Mizzix', faction: 'Izzet', attitude: 'friendly', notes: 'Studying resonance abnormalities. Friendly after the house clearance.' },
]

const INITIAL_THREADS: Thread[] = [
  { id: 't1', npcId: 'n1', summary: 'Confiscated party items at Karlov Manor after the fire.', session: 'Session 6' },
  { id: 't2', npcId: 'n2', summary: 'Branded the party with 5 Debt Tokens.', session: 'Session 6' },
  { id: 't3', npcId: 'n3', summary: 'Party helped clear his house. Will study for 7 days.', session: 'Session 1' },
]

const AVATAR_PALETTE = ['#3d5a8a', '#3d6b5a', '#6b4a7a', '#7a5a3d', '#3d6b7a', '#7a3d4a', '#5a3d7a', '#7a6b3d']

function avatarColor(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length]
}

function initials(name: string): string {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

const ATTITUDE_META = {
  friendly: { label: 'Friendly', color: 'var(--nd-success)', bg: 'rgba(34,197,94,0.1)' },
  neutral:  { label: 'Neutral',  color: 'var(--nd-text-2)',  bg: 'rgba(160,160,176,0.1)' },
  hostile:  { label: 'Hostile',  color: 'var(--nd-danger)',  bg: 'rgba(239,68,68,0.1)'   },
  unknown:  { label: 'Unknown',  color: 'var(--nd-text-3)',  bg: 'rgba(107,107,126,0.1)' },
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
      <div style={{ width: 2, height: 11, borderRadius: 1, background: 'var(--nd-purple)' }} />
      <span style={{
        fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.09em', color: 'var(--nd-purple)',
        fontFamily: 'var(--nd-font-mono)',
      }}>{children}</span>
    </div>
  )
}

export default function ActorsWorkspace() {
  const [npcs, setNpcs] = useState<NPC[]>(INITIAL_NPCS)
  const [threads] = useState<Thread[]>(INITIAL_THREADS)
  const [activeNpcId, setActiveNpcId] = useState<string>('n1')

  const activeNpc = npcs.find(n => n.id === activeNpcId)
  const npcThreads = threads.filter(t => t.npcId === activeNpcId)

  const updateNpc = (changes: Partial<NPC>) => {
    setNpcs(ns => ns.map(n => n.id === activeNpcId ? { ...n, ...changes } : n))
  }

  const addNpc = () => {
    const id = `n${Date.now()}`
    setNpcs(ns => [...ns, { id, name: 'New NPC', faction: '', attitude: 'unknown', notes: '' }])
    setActiveNpcId(id)
  }

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>

      {/* ── Left: NPC roster ─────────────────────────────────────────────── */}
      <div style={{
        width: 240, minWidth: 240,
        borderRight: '1px solid var(--nd-border)',
        display: 'flex', flexDirection: 'column',
        background: 'var(--nd-surface)', overflow: 'hidden',
      }}>
        <div style={{ padding: '16px 14px 10px', borderBottom: '1px solid var(--nd-border)', flexShrink: 0 }}>
          <SectionLabel>Companion Memory</SectionLabel>
          <p style={{ margin: '2px 0 8px', fontSize: 11, color: 'var(--nd-text-3)', fontFamily: 'var(--nd-font-mono)' }}>
            Focused Actor: Party
          </p>
          <button
            onClick={addNpc}
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
          >+ Add NPC</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '6px' }}>
          {npcs.map(npc => {
            const isActive = npc.id === activeNpcId
            const meta = ATTITUDE_META[npc.attitude]
            return (
              <div
                key={npc.id}
                onClick={() => setActiveNpcId(npc.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 9,
                  padding: '8px 10px', borderRadius: 'var(--nd-radius-md)',
                  cursor: 'pointer', marginBottom: 2,
                  background: isActive ? 'rgba(91,142,255,0.08)' : 'transparent',
                  border: isActive ? '1px solid rgba(91,142,255,0.2)' : '1px solid transparent',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={ev => { if (!isActive) (ev.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.025)' }}
                onMouseLeave={ev => { if (!isActive) (ev.currentTarget as HTMLDivElement).style.background = 'transparent' }}
              >
                <div style={{
                  width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                  background: avatarColor(npc.name),
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, color: '#fff',
                  fontFamily: 'var(--nd-font-sans)',
                }}>{initials(npc.name)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    margin: 0, fontSize: 12.5,
                    fontWeight: isActive ? 600 : 400,
                    color: isActive ? 'var(--nd-text-1)' : 'var(--nd-text-2)',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>{npc.name}</p>
                  {npc.faction && (
                    <p style={{
                      margin: 0, fontSize: 10.5, color: 'var(--nd-text-3)',
                      fontFamily: 'var(--nd-font-mono)',
                    }}>{npc.faction}</p>
                  )}
                </div>
                <div style={{
                  width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                  background: meta.color,
                }} />
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Right: NPC detail + Reputation ───────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
        {activeNpc ? (
          <>
            {/* NPC header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
              <div style={{
                width: 52, height: 52, borderRadius: '50%', flexShrink: 0,
                background: avatarColor(activeNpc.name),
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, fontWeight: 700, color: '#fff',
                fontFamily: 'var(--nd-font-sans)',
              }}>{initials(activeNpc.name)}</div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <input
                  value={activeNpc.name}
                  onChange={e => updateNpc({ name: e.target.value })}
                  style={{
                    width: '100%', background: 'transparent',
                    borderTop: 'none', borderRight: 'none', borderLeft: 'none',
                    borderBottom: '1px solid transparent', borderRadius: 0, padding: '4px 0',
                    color: 'var(--nd-text-1)', fontSize: 22, fontWeight: 700,
                    letterSpacing: '-0.02em', outline: 'none',
                    fontFamily: 'var(--nd-font-sans)', boxSizing: 'border-box',
                    transition: 'border-color 0.12s',
                  }}
                  onFocus={e => { e.target.style.borderBottomColor = 'var(--nd-border)' }}
                  onBlur={e => { e.target.style.borderBottomColor = 'transparent' }}
                />
                <input
                  value={activeNpc.faction}
                  onChange={e => updateNpc({ faction: e.target.value })}
                  placeholder="Faction or guild…"
                  style={{
                    width: '100%', background: 'transparent',
                    borderTop: 'none', borderRight: 'none', borderLeft: 'none',
                    borderBottom: '1px solid transparent', borderRadius: 0, padding: '3px 0',
                    color: 'var(--nd-text-3)', fontSize: 12.5, outline: 'none',
                    fontFamily: 'var(--nd-font-mono)', boxSizing: 'border-box',
                    transition: 'border-color 0.12s', textTransform: 'uppercase', letterSpacing: '0.06em',
                  }}
                  onFocus={e => { e.target.style.borderBottomColor = 'var(--nd-border)' }}
                  onBlur={e => { e.target.style.borderBottomColor = 'transparent' }}
                />
              </div>

              {/* Attitude selector */}
              <div style={{ display: 'flex', gap: 4, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: 200 }}>
                {(Object.keys(ATTITUDE_META) as Array<NPC['attitude']>).map(att => {
                  const meta = ATTITUDE_META[att]
                  const isActive = activeNpc.attitude === att
                  return (
                    <button
                      key={att}
                      onClick={() => updateNpc({ attitude: att })}
                      style={{
                        padding: '4px 10px', borderRadius: 'var(--nd-radius-full)',
                        border: '1px solid',
                        borderColor: isActive ? meta.color : 'var(--nd-border)',
                        background: isActive ? meta.bg : 'transparent',
                        color: isActive ? meta.color : 'var(--nd-text-3)',
                        fontSize: 10.5, fontWeight: 600, cursor: 'pointer',
                        textTransform: 'uppercase', letterSpacing: '0.07em',
                        fontFamily: 'var(--nd-font-mono)', transition: 'all 0.12s',
                      }}
                    >{meta.label}</button>
                  )
                })}
              </div>
            </div>

            {/* Notes */}
            <div style={{ marginBottom: 28 }}>
              <p style={{
                margin: '0 0 8px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.09em', color: 'var(--nd-text-3)', fontFamily: 'var(--nd-font-mono)',
              }}>Notes</p>
              <textarea
                value={activeNpc.notes}
                onChange={e => updateNpc({ notes: e.target.value })}
                placeholder="Personality, secrets, relationships…"
                rows={4}
                style={{
                  width: '100%', background: 'var(--nd-surface-2)',
                  border: '1px solid var(--nd-border)', borderRadius: 'var(--nd-radius-md)',
                  padding: '12px 14px', color: 'var(--nd-text-1)', fontSize: 13.5,
                  lineHeight: 1.65, outline: 'none', fontFamily: 'var(--nd-font-sans)',
                  transition: 'border-color 0.12s', boxSizing: 'border-box', resize: 'vertical',
                }}
                onFocus={e => { e.target.style.borderColor = 'rgba(91,142,255,0.4)' }}
                onBlur={e => { e.target.style.borderColor = 'var(--nd-border)' }}
              />
            </div>

            {/* Interaction threads */}
            <div>
              <SectionLabel>Interaction History</SectionLabel>
              {npcThreads.length === 0 ? (
                <div style={{
                  padding: '20px', borderRadius: 'var(--nd-radius-lg)',
                  border: '1px dashed var(--nd-border)', textAlign: 'center',
                }}>
                  <p style={{ margin: 0, fontSize: 12.5, color: 'var(--nd-text-3)' }}>
                    No interactions recorded yet.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {npcThreads.map(thread => (
                    <div
                      key={thread.id}
                      style={{
                        padding: '12px 14px', borderRadius: 'var(--nd-radius-lg)',
                        background: 'var(--nd-surface)', border: '1px solid var(--nd-border)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{
                          fontSize: 10.5, fontFamily: 'var(--nd-font-mono)',
                          color: 'var(--nd-blue)', fontWeight: 500,
                        }}>{thread.session}</span>
                      </div>
                      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: 'var(--nd-text-2)', fontFamily: 'var(--nd-font-sans)' }}>
                        {thread.summary}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--nd-text-3)', fontSize: 13 }}>
            Select an NPC to view details
          </div>
        )}
      </div>
    </div>
  )
}
