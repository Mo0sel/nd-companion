const quests = [
  {
    title: "The Pale Merchant's Ledger",
    type: "Main Quest",
    typeColor: "var(--primary)",
    status: "Active",
    statusColor: "#22c55e",
    urgency: "Critical",
    urgencyColor: "#ef4444",
    progress: 80,
    summary: "Recover and protect the ledger implicating the city councilors. Edric's enforcers are closing in.",
    threads: [
      { text: "Ledger is in the party's possession", done: true },
      { text: "Identify all three implicated councilors", done: true },
      { text: "Deliver evidence to the Crown Bureau (Maren?)", done: false },
      { text: "Neutralize Edric's enforcement arm", done: false },
    ],
    givenBy: "Maren Ashveil",
    reward: "Bureau protection + 1,200 gp",
  },
  {
    title: "Return the Stolen Sextant",
    type: "Side Quest",
    typeColor: "#a78bfa",
    status: "Resolved",
    statusColor: "#6b6b7e",
    urgency: "Complete",
    urgencyColor: "#6b6b7e",
    progress: 100,
    summary: "Captain Voss's navigational sextant was stolen by the Dockside Crew. Returned in Session 12.",
    threads: [
      { text: "Locate the sextant", done: true },
      { text: "Return to Captain Voss", done: true },
    ],
    givenBy: "Captain Voss",
    reward: "200 gp + Voss contact",
  },
  {
    title: "The Thornwood Silence",
    type: "Mystery",
    typeColor: "#a78bfa",
    status: "Active",
    statusColor: "#22c55e",
    urgency: "High",
    urgencyColor: "#f59e0b",
    progress: 10,
    summary: "The Thornwood Accord has gone dark. Something killed their sentinels. No communication in 6 days.",
    threads: [
      { text: "Receive Accord distress signal", done: true },
      { text: "Travel to Thornwood border", done: false },
      { text: "Discover what ended the silence", done: false },
      { text: "Report findings to the Accord", done: false },
    ],
    givenBy: "Accord Messenger (S13)",
    reward: "Unknown",
  },
  {
    title: "Ashfeld Water Crisis",
    type: "Faction Quest",
    typeColor: "#f97316",
    status: "Pending",
    statusColor: "#f59e0b",
    urgency: "Medium",
    urgencyColor: "#f59e0b",
    progress: 0,
    summary: "Sister Elara suspects upstream contamination. The village water supply will fail within a month.",
    threads: [
      { text: "Deliver Sister Elara's letter", done: false },
      { text: "Investigate Millhaven aqueduct source", done: false },
      { text: "Identify contamination cause", done: false },
    ],
    givenBy: "Sister Elara",
    reward: "Temple blessing + local goodwill",
  },
]

export default function Quests() {
  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '28px 36px' }}>
      <div style={{ maxWidth: 800 }}>
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' }}>Quests</h2>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--muted-foreground)' }}>{quests.filter(q => q.status === 'Active').length} active · {quests.filter(q => q.status === 'Resolved').length} resolved</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {quests.map(q => (
            <div key={q.title} style={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: '18px 20px',
              opacity: q.status === 'Resolved' ? 0.55 : 1,
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                    <span style={{
                      fontSize: 10.5,
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: 5,
                      background: `${q.typeColor}15`,
                      color: q.typeColor,
                      border: `1px solid ${q.typeColor}30`,
                    }}>{q.type}</span>
                    <span style={{
                      fontSize: 10.5,
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: 5,
                      background: `${q.urgencyColor}10`,
                      color: q.urgencyColor,
                    }}>{q.urgency}</span>
                  </div>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--foreground)' }}>{q.title}</h3>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 12, color: q.statusColor, fontWeight: 600 }}>{q.status}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 2 }}>by {q.givenBy}</div>
                </div>
              </div>

              <p style={{ margin: '0 0 12px', fontSize: 13.5, color: 'var(--muted-foreground)', lineHeight: 1.55 }}>{q.summary}</p>

              {/* Progress bar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'var(--secondary)' }}>
                  <div style={{ width: `${q.progress}%`, height: '100%', borderRadius: 2, background: q.typeColor, transition: 'width 0.3s ease' }} />
                </div>
                <span style={{ fontSize: 11, color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace', flexShrink: 0 }}>{q.progress}%</span>
              </div>

              {/* Threads */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {q.threads.map(t => (
                  <div key={t.text} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{
                      width: 15,
                      height: 15,
                      borderRadius: 3.5,
                      border: t.done ? 'none' : '1.5px solid var(--border)',
                      background: t.done ? 'var(--success)' : 'transparent',
                      flexShrink: 0,
                      marginTop: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 9,
                      color: '#fff',
                    }}>{t.done && '✓'}</div>
                    <span style={{ fontSize: 12.5, color: t.done ? 'var(--muted-foreground)' : 'var(--foreground)', textDecoration: t.done ? 'line-through' : 'none', lineHeight: 1.4 }}>{t.text}</span>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--muted-foreground)' }}>
                <span>Reward</span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#22c55e' }}>{q.reward}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
