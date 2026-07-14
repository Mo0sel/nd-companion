import { useState } from 'react'

const emergencies = [
  {
    type: "Unexpected NPC Arrival",
    description: "Lyra Voss, a bounty hunter hired by the councilors, enters the archive with a warrant — she isn't hostile yet, but she's watching. She knows more than she lets on and could become an ally or enemy depending on how the party handles the next 60 seconds.",
    tags: ["NPC", "Social", "Faction"],
  },
  {
    type: "Environmental Complication",
    description: "A hidden cistern beneath the archive floor cracks — cold water begins flooding the lower stacks. The enforcers lose their footing (disadvantage on Athletics). The party has 10 minutes before the ground floor is knee-deep and documents begin floating away.",
    tags: ["Environment", "Time Pressure"],
  },
  {
    type: "Plot Twist",
    description: "Maren Ashveil drops her archivist act. She's been an operative for the Crown Intelligence Bureau the entire time. The 'ledger' the party found is bait — the real ledger is hidden behind the false bookshelf she's now sliding open.",
    tags: ["Revelation", "Ally Shift"],
  },
  {
    type: "Faction Intervention",
    description: "The Thornwood Accord sends two cloaked emissaries through the roof — they want the ledger burned. They're not here to fight, but they will if pressed. They know about the secret passage and offer to guide the party out in exchange for the ledger.",
    tags: ["Faction", "Negotiation"],
  },
  {
    type: "Magical Anomaly",
    description: "A warding sigil on the archive's third sub-level activates — all magical items in the building pulse hot, then cold. Spells of 3rd level and below fizzle. A voice echoes from the sealed door below: 'The contract is broken. Come and collect.'",
    tags: ["Magic", "Mystery", "Door"],
  },
  {
    type: "Random Encounter",
    description: "A pair of city ratcatchers burst through the side door chasing a massive, glowing rat — it bolts past the party and vanishes into a gap in the wall. One ratcatcher trips, scatters his bag, and a vial of alchemist's fire rolls toward the nearest candle.",
    tags: ["Chaos", "Comedy", "Danger"],
  },
]

interface Props {
  onClose: () => void
}

export default function OhShitModal({ onClose }: Props) {
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * emergencies.length))
  const [sliding, setSliding] = useState(false)
  const event = emergencies[idx]

  const generateAnother = () => {
    setSliding(true)
    setTimeout(() => {
      setIdx(i => (i + 1) % emergencies.length)
      setSliding(false)
    }, 180)
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.72)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        backdropFilter: 'blur(4px)',
        padding: 24,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--card)',
          border: '1px solid rgba(239,68,68,0.35)',
          borderRadius: 16,
          width: '100%',
          maxWidth: 540,
          overflow: 'hidden',
          boxShadow: '0 0 0 1px rgba(239,68,68,0.1), 0 32px 80px rgba(0,0,0,0.6)',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '18px 24px 16px',
          borderBottom: '1px solid var(--border)',
          background: 'rgba(239,68,68,0.05)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>⚠</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#ef4444', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Emergency DM Idea</div>
              <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 1, fontFamily: 'JetBrains Mono, monospace' }}>Session #14 · The Shattered Crown</div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', fontSize: 20, lineHeight: 1, padding: 4 }}
          >×</button>
        </div>

        {/* Content */}
        <div style={{
          padding: '24px',
          transition: 'opacity 0.18s ease',
          opacity: sliding ? 0 : 1,
        }}>
          <div style={{
            fontSize: 11,
            fontWeight: 600,
            fontFamily: 'JetBrains Mono, monospace',
            color: '#ef4444',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            marginBottom: 10,
          }}>{event.type}</div>

          <p style={{
            margin: '0 0 18px',
            fontSize: 15,
            lineHeight: 1.7,
            color: 'var(--foreground)',
          }}>{event.description}</p>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {event.tags.map(tag => (
              <span key={tag} style={{
                fontSize: 11,
                padding: '3px 8px',
                borderRadius: 5,
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.2)',
                color: '#ef4444',
                fontWeight: 500,
              }}>{tag}</span>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          gap: 10,
          justifyContent: 'flex-end',
        }}>
          <button
            onClick={generateAnother}
            style={{
              padding: '9px 18px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--foreground)',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.12s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
          >
            Generate Another
          </button>
          <button
            onClick={onClose}
            style={{
              padding: '9px 22px',
              borderRadius: 8,
              border: 'none',
              background: 'var(--primary)',
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.12s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.88' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1' }}
          >
            Use This
          </button>
        </div>
      </div>
    </div>
  )
}
