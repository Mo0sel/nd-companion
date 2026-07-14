interface Props {
  onOhShit: () => void
}

const openThreads = [
  { id: 1, text: "Investigate who burned the Millhaven granary", done: false },
  { id: 2, text: "Track down the Pale Merchant's ledger", done: false },
  { id: 3, text: "Return the stolen sextant to Captain Voss", done: true },
  { id: 4, text: "Discover why the Thornwood has gone silent", done: false },
  { id: 5, text: "Deliver the letter to Sister Elara in Ashfeld", done: false },
]

const todayNPCs = [
  { name: "Maren Ashveil", role: "City Archivist", note: "Knows where the ledger was last seen. Will barter for it." },
  { name: "Edric 'Twice-Dead' Suun", role: "Crime Lord, Dockside", note: "Antagonist. Expects tribute from the party." },
  { name: "Sister Elara", role: "Healer, Ashfeld Temple", note: "Grateful if party delivers the letter. Has vital intel." },
]

const todayLocations = [
  { name: "The Pale Archive", type: "Library / Dungeon", desc: "Labyrinthine stacks beneath the city. Third sub-level is sealed." },
  { name: "Edric's Counting House", type: "Faction HQ", desc: "Front operation for the Dockside Crew. Guards rotate at dusk." },
  { name: "Ashfeld Village", type: "Town", desc: "Half a day's ride east. Population 300. Cleric hub." },
]

export default function Dashboard({ onOhShit }: Props) {
  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '32px 36px', display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Header */}
      <header style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
              <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--foreground)' }}>
                The Shattered Crown
              </h1>
              <span style={{
                fontSize: 11,
                fontWeight: 600,
                padding: '3px 9px',
                borderRadius: 20,
                background: 'rgba(91,142,255,0.12)',
                color: 'var(--primary)',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                fontFamily: 'JetBrains Mono, monospace',
              }}>Live</span>
            </div>
            <div style={{ display: 'flex', gap: 20, color: 'var(--muted-foreground)', fontSize: 13 }}>
              <span>Session <strong style={{ color: 'var(--foreground)' }}>#14</strong></span>
              <span style={{ color: 'var(--border)' }}>|</span>
              <span>In-game: <strong style={{ color: 'var(--foreground)' }}>14th of Harvestmoon, Year 847</strong></span>
              <span style={{ color: 'var(--border)' }}>|</span>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>IRL 2026-07-13</span>
            </div>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 12,
            color: 'var(--muted-foreground)',
            background: 'var(--secondary)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '6px 12px',
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--success)', display: 'inline-block', boxShadow: '0 0 6px var(--success)' }} />
            Session active
          </div>
        </div>
      </header>

      {/* Top row: Current Beat + Next Scene */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <Card label="Current Beat" accent="var(--primary)">
          <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.65, color: 'var(--foreground)' }}>
            The party has just discovered that the Pale Merchant's ledger implicates three city councilors in a grain-price conspiracy. Edric Suun knows they have it and sent enforcers to retrieve it. The players are cornered in the Archivist's back office.
          </p>
          <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
            <Tag color="var(--primary)">Investigation</Tag>
            <Tag color="var(--warning)">Tension high</Tag>
          </div>
        </Card>

        <Card label="Next Scene" accent="#a78bfa">
          <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.65, color: 'var(--foreground)' }}>
            Edric's enforcers breach the archive front door — the party must choose: fight their way out, negotiate, or use the secret passage Maren hinted at (DC 14 Investigation to find it in time).
          </p>
          <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
            <Tag color="#a78bfa">Encounter</Tag>
            <Tag color="var(--danger)">Combat possible</Tag>
          </div>
        </Card>
      </div>

      {/* Bottom row: Threads + NPCs + Locations */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1.2fr', gap: 16, marginBottom: 24 }}>
        {/* Open Threads */}
        <Card label="Open Threads" accent="var(--warning)">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {openThreads.map(t => (
              <label key={t.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 9, cursor: 'pointer' }}>
                <div style={{
                  width: 16,
                  height: 16,
                  borderRadius: 4,
                  border: t.done ? 'none' : '1.5px solid var(--border)',
                  background: t.done ? 'var(--success)' : 'transparent',
                  flexShrink: 0,
                  marginTop: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 10,
                  color: '#fff',
                }}>
                  {t.done && '✓'}
                </div>
                <span style={{
                  fontSize: 13,
                  lineHeight: 1.5,
                  color: t.done ? 'var(--muted-foreground)' : 'var(--foreground)',
                  textDecoration: t.done ? 'line-through' : 'none',
                }}>
                  {t.text}
                </span>
              </label>
            ))}
          </div>
        </Card>

        {/* Today's NPCs */}
        <Card label="Today's NPCs" accent="var(--success)">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {todayNPCs.map(npc => (
              <div key={npc.name} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 26,
                    height: 26,
                    borderRadius: '50%',
                    background: 'rgba(91,142,255,0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    fontWeight: 700,
                    color: 'var(--primary)',
                    flexShrink: 0,
                  }}>
                    {npc.name[0]}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)', lineHeight: 1 }}>{npc.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 1 }}>{npc.role}</div>
                  </div>
                </div>
                <p style={{ margin: '0 0 0 34px', fontSize: 12.5, color: 'var(--muted-foreground)', lineHeight: 1.5 }}>{npc.note}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* Today's Locations */}
        <Card label="Today's Locations" accent="#f97316">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {todayLocations.map(loc => (
              <div key={loc.name} style={{
                padding: '10px 12px',
                background: 'rgba(255,255,255,0.03)',
                borderRadius: 7,
                border: '1px solid var(--border)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>{loc.name}</div>
                  <span style={{
                    fontSize: 10,
                    fontFamily: 'JetBrains Mono, monospace',
                    color: '#f97316',
                    background: 'rgba(249,115,22,0.1)',
                    padding: '2px 6px',
                    borderRadius: 4,
                  }}>{loc.type}</span>
                </div>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--muted-foreground)', lineHeight: 1.5 }}>{loc.desc}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* OH SHIT Button */}
      <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: 8 }}>
        <button
          onClick={onOhShit}
          style={{
            padding: '16px 48px',
            borderRadius: 12,
            border: '1px solid rgba(239,68,68,0.4)',
            background: 'rgba(239,68,68,0.08)',
            color: '#ef4444',
            fontSize: 16,
            fontWeight: 700,
            letterSpacing: '0.04em',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
          onMouseEnter={e => {
            const el = e.currentTarget as HTMLButtonElement
            el.style.background = 'rgba(239,68,68,0.16)'
            el.style.borderColor = 'rgba(239,68,68,0.7)'
            el.style.transform = 'scale(1.02)'
          }}
          onMouseLeave={e => {
            const el = e.currentTarget as HTMLButtonElement
            el.style.background = 'rgba(239,68,68,0.08)'
            el.style.borderColor = 'rgba(239,68,68,0.4)'
            el.style.transform = 'scale(1)'
          }}
        >
          <span style={{ fontSize: 18 }}>⚠</span>
          OH SHIT!
        </button>
      </div>
    </div>
  )
}

function Card({ label, accent, children }: { label: string; accent: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--card)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: '16px 18px',
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 3, height: 14, borderRadius: 2, background: accent, flexShrink: 0 }} />
        <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted-foreground)' }}>{label}</span>
      </div>
      {children}
    </div>
  )
}

function Tag({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span style={{
      fontSize: 11,
      fontWeight: 500,
      padding: '2px 8px',
      borderRadius: 5,
      border: `1px solid ${color}33`,
      color,
      background: `${color}12`,
    }}>{children}</span>
  )
}
