import { useState } from 'react'
import type { Thread } from '../../data/campaign'

const DEFAULT_NOTES = `Session 6 — The Ravnica Files
21st of Zuun, Year of the Guildpact 10078

---

OPENING
Players arrive at Moon Market after the tip from Dasha. Agatha's contact hasn't appeared yet.

KEY DECISIONS THIS SESSION
— Do they hand the oil to the Dimir, the Orzhov, or neither?
— How do they handle Syndic Harvas? He's not a villain.
— The child witness on the rooftop. Do they acknowledge her?

REMEMBER
— Zevryn speaks very quietly. Play this as deliberate, not timid.
— Shadow (Zevryn's backup) is DC 16 Perception. Don't telegraph it.
— Agatha follows them to the safehouse. She's impressed, not angry.

IMPROVISED
—
—
—`

interface Props {
  threads: Thread[]
  onToggle: (id: number) => void
}

export default function NotesWorkspace({ threads, onToggle }: Props) {
  const [notes, setNotes] = useState(DEFAULT_NOTES)

  return (
    <div style={{ height: '100%', display: 'flex', overflow: 'hidden', background: 'var(--bg)' }}>
      {/* Main notes area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '32px 40px', minWidth: 0 }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
          paddingBottom: 14,
          borderBottom: '1px solid var(--sep)',
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-3)' }}>Session Notes</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-3)' }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#3d8a5e' }} />
            auto-saved
          </div>
        </div>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          spellCheck={false}
          style={{
            flex: 1,
            background: 'none',
            border: 'none',
            outline: 'none',
            resize: 'none',
            color: 'var(--text-1)',
            fontSize: 13.5,
            lineHeight: 1.75,
            fontFamily: 'JetBrains Mono, monospace',
            padding: 0,
          }}
        />
      </div>

      {/* Right sidebar: open threads */}
      <div style={{
        width: 240,
        borderLeft: '1px solid var(--sep)',
        background: 'var(--surface)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        flexShrink: 0,
      }}>
        <div style={{ padding: '20px 18px 12px' }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-3)' }}>Open Threads</div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 12px 16px' }}>
          {threads.map(thread => (
            <button
              key={thread.id}
              onClick={() => onToggle(thread.id)}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 9,
                width: '100%',
                background: 'none',
                border: 'none',
                padding: '6px 6px',
                cursor: 'pointer',
                textAlign: 'left',
                borderRadius: 'var(--r-sm)',
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-hover)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none' }}
            >
              <div style={{
                width: 14,
                height: 14,
                borderRadius: 3.5,
                border: '1.5px solid ' + (thread.done ? 'transparent' : 'var(--border)'),
                background: thread.done ? 'var(--accent)' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                marginTop: 1,
                transition: 'all 0.12s',
              }}>
                {thread.done && <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1.5 4L3.5 6L6.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </div>
              <span style={{
                fontSize: 12.5,
                lineHeight: 1.45,
                color: thread.done ? 'var(--text-3)' : 'var(--text-2)',
                textDecoration: thread.done ? 'line-through' : 'none',
              }}>{thread.text}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
