import { useState } from 'react'

const pastNotes = [
  {
    session: 13,
    date: "2026-07-06",
    title: "The Thornwood Messenger",
    highlights: ["Party returned from Ashfeld", "Accord messenger arrived with sealed note", "Edric's men spotted near the inn — party avoided contact"],
    cliffhanger: "Message contents: 'The Wood has gone silent. Do not send scouts. — Warden Kel'",
  },
  {
    session: 12,
    date: "2026-06-29",
    title: "Captain Voss Paid",
    highlights: ["Sextant returned to Voss", "Voss revealed Edric once employed her", "Party got tip about Counting House guard rotation"],
    cliffhanger: "Maren sent a one-line message: 'The ledger moves tonight.'",
  },
]

const currentNotes = `Session 14 — Running Notes

OPENING
— Party is in Maren's back office, ledger in hand
— Edric's crew (6 enforcers + 1 lieutenant) approaching from the front
— Maren acting nervous — she's waiting for something

KEY DECISIONS THIS SESSION
— Do they trust Maren? She hasn't revealed Bureau allegiance yet
— Will they use the passage or fight through?
— Does Edric's lieutenant (Sera) defect if things go badly for Edric?

THINGS TO REMEMBER
— Sera (lieutenant) has a SCAR on left hand — player asked about this in S11, I forgot
— The warding sigil activates at midnight — IRL it's ~10pm when session starts
— Don't forget: Sister Elara's letter is still in Rune's pack

IMPROVISED STUFF (live)
—
—
—`

export default function SessionNotes() {
  const [text, setText] = useState(currentNotes)
  const [activeTab, setActiveTab] = useState<'current' | 'history'>('current')

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: 0,
        borderBottom: '1px solid var(--border)',
        padding: '0 32px',
        background: 'var(--card)',
      }}>
        {([['current', 'Session 14 — Live'], ['history', 'Past Sessions']] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            style={{
              padding: '14px 16px',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: activeTab === id ? 600 : 400,
              color: activeTab === id ? 'var(--foreground)' : 'var(--muted-foreground)',
              borderBottom: activeTab === id ? '2px solid var(--primary)' : '2px solid transparent',
              marginBottom: -1,
              transition: 'color 0.12s',
            }}
          >{label}</button>
        ))}
        {activeTab === 'current' && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace' }}>Auto-saved</span>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)' }} />
          </div>
        )}
      </div>

      {activeTab === 'current' ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '24px 32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h2 style={{ margin: '0 0 3px', fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em' }}>Session 14 Notes</h2>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--muted-foreground)' }}>2026-07-13 · The Shattered Crown</p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <span style={{
                fontSize: 11,
                padding: '4px 10px',
                borderRadius: 6,
                background: 'rgba(91,142,255,0.08)',
                color: 'var(--primary)',
                border: '1px solid rgba(91,142,255,0.2)',
                fontWeight: 500,
              }}>Markdown supported</span>
            </div>
          </div>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            style={{
              flex: 1,
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: '18px 20px',
              color: 'var(--foreground)',
              fontSize: 13.5,
              lineHeight: 1.7,
              fontFamily: 'JetBrains Mono, monospace',
              resize: 'none',
              outline: 'none',
              transition: 'border-color 0.15s',
            }}
            onFocus={e => { e.target.style.borderColor = 'rgba(91,142,255,0.4)' }}
            onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
          />
        </div>
      ) : (
        <div style={{ flex: 1, overflow: 'auto', padding: '24px 32px' }}>
          <div style={{ maxWidth: 680, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {pastNotes.map(note => (
              <div key={note.session} style={{
                background: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                padding: '18px 20px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: 'var(--primary)', marginBottom: 4 }}>Session #{note.session}</div>
                    <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{note.title}</h3>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace' }}>{note.date}</span>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted-foreground)', marginBottom: 6 }}>Highlights</div>
                  {note.highlights.map(h => (
                    <div key={h} style={{ fontSize: 13, color: 'var(--foreground)', marginBottom: 3, display: 'flex', gap: 6 }}>
                      <span style={{ color: 'var(--primary)' }}>·</span>
                      {h}
                    </div>
                  ))}
                </div>

                <div style={{
                  padding: '10px 12px',
                  borderRadius: 7,
                  background: 'rgba(91,142,255,0.05)',
                  border: '1px solid rgba(91,142,255,0.15)',
                }}>
                  <div style={{ fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--primary)', marginBottom: 5, fontFamily: 'JetBrains Mono, monospace' }}>Cliffhanger</div>
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--foreground)', fontStyle: 'italic', lineHeight: 1.55 }}>{note.cliffhanger}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
