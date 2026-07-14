import { useState } from 'react'

const locations = [
  {
    name: "The Pale Archive",
    type: "Library / Dungeon",
    typeColor: "var(--primary)",
    district: "Scholar's Quarter, Millhaven",
    active: true,
    desc: "Labyrinthine stacks of municipal records spread across five sub-levels. The third sub-level has been sealed for 30 years. Maren is the only person with a key — and she won't admit it.",
    features: ["Sealed third sub-level", "Hidden Cistern (cracked)", "Back office with secret exit", "Warding sigils on every door"],
    danger: "Medium",
    dangerColor: "#f59e0b",
    npcs: ["Maren Ashveil", "Edric's Enforcers (incoming)"],
    notes: "Secret passage: bookshelf in Maren's office. DC 14 Investigation to find under pressure.",
  },
  {
    name: "Edric's Counting House",
    type: "Faction HQ",
    typeColor: "#ef4444",
    district: "Dockside, Millhaven",
    active: false,
    desc: "A legitimate-looking shipping broker front. Three floors. Bottom floor is public. Second and third are Dockside Crew operations. Guards rotate every 4 hours at dusk and midnight.",
    features: ["Guard rotation: dusk + midnight", "Vault on third floor", "Poison supply in locked desk", "Escape tunnel to pier 7"],
    danger: "High",
    dangerColor: "#ef4444",
    npcs: ["Edric 'Twice-Dead' Suun"],
    notes: "Party hasn't been here yet. If they arrive before dusk, guards are reduced (only 2 on duty).",
  },
  {
    name: "Ashfeld Village",
    type: "Settlement",
    typeColor: "#22c55e",
    district: "Eastern Reach, 12 miles from Millhaven",
    active: false,
    desc: "A prosperous farming community of 300. Home to the Temple of the Ember. The village water mill has been producing discolored water for the past two weeks.",
    features: ["Temple of the Ember (Sister Elara)", "Village council (3 elders)", "Contaminated mill channel", "Surplus grain stores"],
    danger: "None",
    dangerColor: "#22c55e",
    npcs: ["Sister Elara"],
    notes: "Party needs to deliver a letter here. Water contamination source is upstream — unknown so far.",
  },
  {
    name: "Thornwood Border",
    type: "Wilderness",
    typeColor: "#a78bfa",
    district: "Thornwood Accord Territory",
    active: false,
    desc: "Dense, old-growth forest marking the edge of Accord territory. The sentinel posts — usually staffed — are empty. Something moved through here recently. No tracks.",
    features: ["3 empty sentinel posts", "Arcane ward (damaged)", "Silence — no wildlife", "Strange glyphs on tree bark"],
    danger: "Unknown",
    dangerColor: "#a78bfa",
    npcs: [],
    notes: "Mystery in progress. Don't telegraph. The silence is the clue — something large and quiet was here.",
  },
]

export default function Locations() {
  const [selected, setSelected] = useState(locations[0])

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      {/* List */}
      <div style={{
        width: 260,
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
      }}>
        <div style={{ padding: '24px 20px 16px', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em' }}>Locations</h2>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '8px 10px' }}>
          {locations.map(loc => (
            <button
              key={loc.name}
              onClick={() => setSelected(loc)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                width: '100%',
                padding: '10px 10px',
                borderRadius: 8,
                border: 'none',
                background: selected.name === loc.name ? 'rgba(91,142,255,0.08)' : 'transparent',
                cursor: 'pointer',
                textAlign: 'left',
                marginBottom: 2,
                transition: 'background 0.1s',
                gap: 4,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>{loc.name}</span>
                {loc.active && <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', flexShrink: 0, boxShadow: '0 0 5px #22c55e' }} />}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  fontSize: 10.5,
                  padding: '1px 6px',
                  borderRadius: 4,
                  background: `${loc.typeColor}15`,
                  color: loc.typeColor,
                  fontWeight: 500,
                }}>{loc.type}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Detail */}
      <div style={{ flex: 1, overflow: 'auto', padding: '28px 32px' }}>
        <div style={{ maxWidth: 600 }}>
          <div style={{ marginBottom: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>{selected.name}</h2>
              {selected.active && (
                <span style={{
                  fontSize: 10.5,
                  padding: '2px 8px',
                  borderRadius: 10,
                  background: 'rgba(34,197,94,0.1)',
                  color: '#22c55e',
                  fontWeight: 600,
                  border: '1px solid rgba(34,197,94,0.25)',
                }}>Current Location</span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--muted-foreground)' }}>
              <span style={{ color: selected.typeColor, fontWeight: 500 }}>{selected.type}</span>
              <span>·</span>
              <span>{selected.district}</span>
            </div>
          </div>

          <p style={{ margin: '0 0 20px', fontSize: 14, lineHeight: 1.7, color: 'var(--foreground)' }}>{selected.desc}</p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div style={{ padding: '12px 14px', borderRadius: 9, background: 'var(--card)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted-foreground)', marginBottom: 8 }}>Notable Features</div>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 5 }}>
                {selected.features.map(f => (
                  <li key={f} style={{ fontSize: 12.5, color: 'var(--foreground)', display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                    <span style={{ color: selected.typeColor, marginTop: 1 }}>›</span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ padding: '12px 14px', borderRadius: 9, background: 'var(--card)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted-foreground)', marginBottom: 6 }}>Danger Level</div>
                <span style={{ fontSize: 15, fontWeight: 700, color: selected.dangerColor }}>{selected.danger}</span>
              </div>
              {selected.npcs.length > 0 && (
                <div style={{ padding: '12px 14px', borderRadius: 9, background: 'var(--card)', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted-foreground)', marginBottom: 6 }}>NPCs Present</div>
                  {selected.npcs.map(n => (
                    <div key={n} style={{ fontSize: 12.5, color: 'var(--foreground)', marginBottom: 2 }}>· {n}</div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {selected.notes && (
            <div style={{
              padding: '12px 14px',
              borderRadius: 9,
              background: 'rgba(91,142,255,0.04)',
              border: '1px solid rgba(91,142,255,0.15)',
            }}>
              <div style={{ fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--primary)', marginBottom: 6, fontFamily: 'JetBrains Mono, monospace' }}>DM Notes</div>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: 'var(--foreground)' }}>{selected.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
