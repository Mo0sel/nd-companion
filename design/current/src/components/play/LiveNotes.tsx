import { useState } from 'react'

const DEFAULT = `Session 14 — Live Notes

OPENING
— Party in Maren's back office, ledger in hand
— Edric's crew (6 + lieutenant Sera) incoming from front

KEY DECISIONS
— Trust Maren? Bureau allegiance not yet revealed
— Fight / negotiate / flee through passage?
— Does Sera defect if given an out?

REMEMBER
— Sera has a SCAR on left hand (player asked S11)
— Warding sigil activates at midnight
— Sister Elara's letter is in Rune's pack

IMPROVISED
—
—`

export default function LiveNotes() {
  const [text, setText] = useState(DEFAULT)

  return (
    <div style={{
      background: 'var(--nd-surface)',
      border: '1px solid var(--nd-border)',
      borderRadius: 'var(--nd-radius-xl)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      minHeight: 0,
    }}>
      {/* Header */}
      <div style={{
        padding: '9px var(--nd-card-pad)',
        borderBottom: '1px solid var(--nd-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <span style={{
          fontSize: 'var(--nd-text-label)',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'var(--nd-purple)',
        }}>
          Session Notes
        </span>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          fontSize: 11,
          color: 'var(--nd-text-3)',
          fontFamily: 'var(--nd-font-mono)',
        }}>
          <span style={{
            width: 5,
            height: 5,
            borderRadius: 'var(--nd-radius-full)',
            background: 'var(--nd-success)',
            display: 'inline-block',
            opacity: 0.8,
          }} />
          auto-saved
        </div>
      </div>

      {/* Textarea */}
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        spellCheck={false}
        aria-label="Session notes"
        style={{
          flex: 1,
          background: 'transparent',
          border: 'none',
          resize: 'none',
          padding: '11px var(--nd-card-pad)',
          color: 'var(--nd-text-1)',
          fontSize: 'var(--nd-text-body-sm)',
          lineHeight: 'var(--nd-leading-relaxed)',
          fontFamily: 'var(--nd-font-sans)',
          outline: 'none',
          minHeight: 0,
        }}
      />
    </div>
  )
}
