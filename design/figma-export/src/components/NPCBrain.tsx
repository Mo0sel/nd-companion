import { useState } from 'react'

const npcs = [
  {
    name: "Maren Ashveil",
    role: "City Archivist / Crown Operative",
    faction: "Crown Intelligence Bureau",
    status: "Ally (conditional)",
    statusColor: "#22c55e",
    disposition: 72,
    voice: "Clipped, precise. Uses 'quite' as filler. Never makes eye contact when lying.",
    motivation: "Protect the Bureau's operation. The ledger is her mission.",
    secret: "She's been running the councilors as double agents for three years.",
    lastSeen: "Pale Archive, back office",
    tags: ["Key NPC", "Session 14"],
  },
  {
    name: "Edric 'Twice-Dead' Suun",
    role: "Crime Lord, Dockside Crew",
    faction: "Dockside Crew",
    status: "Antagonist",
    statusColor: "#ef4444",
    disposition: 15,
    voice: "Slow, deliberate. Long pauses. Laughs at the wrong moments.",
    motivation: "Retrieve the ledger. Consolidate power before the grain shortage hits.",
    secret: "He has a terminal curse — he knows he's dying and wants one clean legacy.",
    lastSeen: "Dockside Counting House",
    tags: ["Antagonist", "Session 14"],
  },
  {
    name: "Sister Elara",
    role: "Healer, Ashfeld Temple of the Ember",
    faction: "Temple of the Ember",
    status: "Allied",
    statusColor: "#22c55e",
    disposition: 88,
    voice: "Warm, unhurried. Ends sentences with questions to draw people out.",
    motivation: "Serve her community. Deeply worried about Ashfeld's water supply.",
    secret: "She's been funding local militia using temple donations without sanctioning.",
    lastSeen: "Ashfeld, 3 sessions ago",
    tags: ["Ally", "Recurring"],
  },
  {
    name: "Captain Lyra Voss",
    role: "Bounty Hunter",
    faction: "Independent",
    status: "Neutral",
    statusColor: "#f59e0b",
    disposition: 50,
    voice: "Terse. Answers questions with questions. Doesn't offer name first.",
    motivation: "Get paid, stay alive, maintain her reputation for clean work.",
    secret: "She worked for Edric three years ago and owes him a debt she hates.",
    lastSeen: "Not yet introduced",
    tags: ["Latent", "Session 14"],
  },
]

export default function NPCBrain() {
  const [selected, setSelected] = useState(npcs[0])
  const [query, setQuery] = useState('')

  const filtered = npcs.filter(n =>
    n.name.toLowerCase().includes(query.toLowerCase()) ||
    n.role.toLowerCase().includes(query.toLowerCase())
  )

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      {/* List */}
      <div style={{
        width: 280,
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
      }}>
        <div style={{ padding: '24px 20px 12px', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em' }}>NPC Brain</h2>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search NPCs..."
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--secondary)',
              color: 'var(--foreground)',
              fontSize: 13,
              outline: 'none',
            }}
          />
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '8px 10px' }}>
          {filtered.map(npc => (
            <button
              key={npc.name}
              onClick={() => setSelected(npc)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                width: '100%',
                padding: '10px 10px',
                borderRadius: 8,
                border: 'none',
                background: selected.name === npc.name ? 'rgba(91,142,255,0.08)' : 'transparent',
                cursor: 'pointer',
                textAlign: 'left',
                marginBottom: 2,
                transition: 'background 0.1s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                <div style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: 'rgba(91,142,255,0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  fontWeight: 700,
                  color: 'var(--primary)',
                  flexShrink: 0,
                }}>{npc.name[0]}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>{npc.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 1 }}>{npc.faction}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 36 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: npc.statusColor, flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: npc.statusColor }}>{npc.status}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Detail */}
      <div style={{ flex: 1, overflow: 'auto', padding: '28px 32px' }}>
        <div style={{ maxWidth: 640 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <div style={{
                width: 52,
                height: 52,
                borderRadius: '50%',
                background: 'rgba(91,142,255,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 20,
                fontWeight: 700,
                color: 'var(--primary)',
                flexShrink: 0,
              }}>{selected.name[0]}</div>
              <div>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>{selected.name}</h2>
                <div style={{ fontSize: 13, color: 'var(--muted-foreground)', marginTop: 3 }}>{selected.role}</div>
                <div style={{ marginTop: 6, display: 'flex', gap: 6 }}>
                  {selected.tags.map(t => (
                    <span key={t} style={{ fontSize: 10.5, padding: '2px 7px', borderRadius: 4, background: 'var(--secondary)', color: 'var(--muted-foreground)', border: '1px solid var(--border)' }}>{t}</span>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
              <span style={{ fontSize: 12, color: selected.statusColor, fontWeight: 600 }}>{selected.status}</span>
              <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>Disposition</div>
              <div style={{ width: 100, height: 5, borderRadius: 3, background: 'var(--secondary)' }}>
                <div style={{ width: `${selected.disposition}%`, height: '100%', borderRadius: 3, background: selected.statusColor }} />
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gap: 12 }}>
            <InfoBlock label="Voice &amp; Mannerism" value={selected.voice} />
            <InfoBlock label="Motivation" value={selected.motivation} />
            <InfoBlock label="Last Seen" value={selected.lastSeen} />
            <div style={{
              padding: '14px 16px',
              borderRadius: 10,
              background: 'rgba(239,68,68,0.04)',
              border: '1px solid rgba(239,68,68,0.15)',
            }}>
              <div style={{ fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#ef4444', marginBottom: 7, fontFamily: 'JetBrains Mono, monospace' }}>Secret (DM Only)</div>
              <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: 'var(--foreground)' }}>{selected.secret}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: '12px 14px', borderRadius: 9, background: 'var(--card)', border: '1px solid var(--border)' }}>
      <div style={{ fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted-foreground)', marginBottom: 6 }}
        dangerouslySetInnerHTML={{ __html: label }}
      />
      <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: 'var(--foreground)' }}>{value}</p>
    </div>
  )
}
