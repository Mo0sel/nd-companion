import type { Thread } from '../../data/campaign'

interface NPC { name: string; role: string; note: string }

interface Props {
  threads: Thread[]
  npcs: NPC[]
  onToggle: (id: number) => void
}

const AVATAR_PALETTE = ['#3d5a8a', '#3d6b5a', '#6b4a7a', '#7a5a3d', '#3d6b7a', '#7a3d4a']

function avatarColor(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length]
}

function ThreadRow({ thread, onToggle }: { thread: Thread; onToggle: (id: number) => void }) {
  return (
    <button
      onClick={() => onToggle(thread.id)}
      aria-pressed={thread.done}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '4px 6px',
        margin: '0 -6px',
        textAlign: 'left',
        width: 'calc(100% + 12px)',
        borderRadius: 'var(--nd-radius-sm)',
        transition: 'background var(--nd-transition-fast)',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.03)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none' }}
    >
      {/* Checkbox */}
      <div style={{
        width: 15,
        height: 15,
        borderRadius: 4,
        border: thread.done ? 'none' : '1.5px solid rgba(255,255,255,0.14)',
        background: thread.done ? 'var(--nd-success)' : 'transparent',
        flexShrink: 0,
        marginTop: 2,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all var(--nd-transition-fast)',
      }}>
        {thread.done && (
          <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
            <path d="M1 3L3 5L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>

      <span style={{
        fontSize: 'var(--nd-text-body-sm)',
        lineHeight: 'var(--nd-leading-snug)',
        color: thread.done ? 'var(--nd-text-3)' : 'var(--nd-text-1)',
        textDecoration: thread.done ? 'line-through' : 'none',
        textDecorationColor: 'var(--nd-text-3)',
        transition: 'color var(--nd-transition-fast)',
      }}>
        {thread.text}
      </span>
    </button>
  )
}

function NPCRow({ npc }: { npc: NPC }) {
  const bg = avatarColor(npc.name)
  const ini = npc.name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()

  return (
    <div style={{
      display: 'flex',
      gap: 9,
      alignItems: 'flex-start',
      padding: '4px 6px',
      margin: '0 -6px',
      borderRadius: 'var(--nd-radius-sm)',
      cursor: 'default',
      transition: 'background var(--nd-transition-fast)',
    }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.03)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'none' }}
    >
      {/* Avatar */}
      <div style={{
        width: 24,
        height: 24,
        borderRadius: 'var(--nd-radius-full)',
        background: bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 9,
        fontWeight: 700,
        color: 'rgba(255,255,255,0.88)',
        flexShrink: 0,
        marginTop: 1,
        letterSpacing: '0.03em',
      }}>{ini}</div>

      <div style={{ minWidth: 0 }}>
        <div style={{
          fontSize: 'var(--nd-text-caption)',
          fontWeight: 600,
          color: 'var(--nd-text-1)',
          lineHeight: 'var(--nd-leading-snug)',
        }}>
          {npc.name}
          <span style={{
            fontWeight: 400,
            color: 'var(--nd-text-3)',
            marginLeft: 6,
          }}>
            {npc.role}
          </span>
        </div>
        <div style={{
          fontSize: 11.5,
          color: 'var(--nd-text-3)',
          lineHeight: 'var(--nd-leading-snug)',
          marginTop: 1,
        }}>
          {npc.note}
        </div>
      </div>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 'var(--nd-text-micro)',
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: '0.07em',
      color: 'var(--nd-text-3)',
      marginBottom: 7,
    }}>
      {children}
    </div>
  )
}

export default function CompanionMemory({ threads, npcs, onToggle }: Props) {
  const open = threads.filter(t => !t.done)
  const done = threads.filter(t => t.done)

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
          Companion Memory
        </span>
        <span style={{
          fontSize: 'var(--nd-text-mono)',
          fontFamily: 'var(--nd-font-mono)',
          color: 'var(--nd-text-3)',
        }}>
          {open.length} open
        </span>
      </div>

      {/* Body */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '10px var(--nd-card-pad)',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        minHeight: 0,
      }}>
        {/* Threads */}
        <div>
          <SectionLabel>Open Threads</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {open.map(t => <ThreadRow key={t.id} thread={t} onToggle={onToggle} />)}
            {done.map(t => <ThreadRow key={t.id} thread={t} onToggle={onToggle} />)}
          </div>
        </div>

        {/* NPCs */}
        <div>
          <SectionLabel>Session NPCs</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {npcs.map(npc => <NPCRow key={npc.name} npc={npc} />)}
          </div>
        </div>
      </div>
    </div>
  )
}
