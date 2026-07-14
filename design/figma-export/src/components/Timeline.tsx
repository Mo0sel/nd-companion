const events = [
  { session: 1, date: "1st Harvestmoon", title: "Arrival in Millhaven", desc: "Party discovers the granary fire. Maren gives first contact. Edric's men watching.", type: "story" },
  { session: 3, date: "3rd Harvestmoon", title: "The Pale Merchant's Trail", desc: "Party traces grain ledger to the Archive district. Sister Elara's letter received.", type: "story" },
  { session: 6, date: "5th Harvestmoon", title: "Dockside Ambush", desc: "Edric's crew attacks party at the harbor. First blood. Party learns Edric's name.", type: "combat" },
  { session: 9, date: "8th Harvestmoon", title: "Ashfeld Detour", desc: "Party escorts refugees. Sister Elara met in person. Water supply concern revealed.", type: "story" },
  { session: 11, date: "10th Harvestmoon", title: "Council Chamber Infiltration", desc: "Party steals councilor's seal. Discovers three names in Edric's payroll.", type: "story" },
  { session: 13, date: "13th Harvestmoon", title: "The Thornwood Silence", desc: "Scouts return — something has killed the Thornwood sentinels. Accord sends no reply.", type: "mystery" },
  { session: 14, date: "14th Harvestmoon", title: "Current: The Archive Confrontation", desc: "Ledger found. Edric's enforcers incoming. Maren's allegiance uncertain.", type: "current" },
]

const typeColor: Record<string, string> = {
  story: 'var(--primary)',
  combat: '#ef4444',
  mystery: '#a78bfa',
  current: '#22c55e',
}

const typeLabel: Record<string, string> = {
  story: 'Story',
  combat: 'Combat',
  mystery: 'Mystery',
  current: 'NOW',
}

export default function Timeline() {
  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '28px 40px' }}>
      <div style={{ maxWidth: 680 }}>
        <div style={{ marginBottom: 28 }}>
          <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' }}>Campaign Timeline</h2>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--muted-foreground)' }}>The Shattered Crown · Sessions 1–14</p>
        </div>

        <div style={{ position: 'relative' }}>
          {/* Vertical line */}
          <div style={{
            position: 'absolute',
            left: 14,
            top: 8,
            bottom: 8,
            width: 1.5,
            background: 'var(--border)',
          }} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {events.map((ev, i) => {
              const color = typeColor[ev.type]
              const isCurrent = ev.type === 'current'
              return (
                <div key={i} style={{ display: 'flex', gap: 20, paddingBottom: 24, position: 'relative' }}>
                  {/* Dot */}
                  <div style={{
                    width: 29,
                    height: 29,
                    borderRadius: '50%',
                    background: isCurrent ? color : 'var(--card)',
                    border: `2px solid ${color}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    zIndex: 1,
                    boxShadow: isCurrent ? `0 0 10px ${color}66` : 'none',
                  }}>
                    {isCurrent && <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#fff' }} />}
                  </div>

                  {/* Content */}
                  <div style={{
                    flex: 1,
                    padding: '10px 14px',
                    borderRadius: 10,
                    background: isCurrent ? 'rgba(34,197,94,0.05)' : 'var(--card)',
                    border: `1px solid ${isCurrent ? 'rgba(34,197,94,0.25)' : 'var(--border)'}`,
                    marginTop: -2,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <span style={{
                        fontSize: 10,
                        fontFamily: 'JetBrains Mono, monospace',
                        fontWeight: 600,
                        padding: '2px 7px',
                        borderRadius: 4,
                        background: `${color}15`,
                        color,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                      }}>{typeLabel[ev.type]}</span>
                      <span style={{ fontSize: 11, color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace' }}>S{ev.session} · {ev.date}</span>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)', marginBottom: 4 }}>{ev.title}</div>
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--muted-foreground)', lineHeight: 1.55 }}>{ev.desc}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
