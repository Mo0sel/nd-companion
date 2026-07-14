import type { NavSection } from '../App'

interface Props {
  active: NavSection
  onNavigate: (s: NavSection) => void
}

const items: { id: NavSection; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '⌘' },
  { id: 'npcs', label: 'NPC Brain', icon: '👤' },
  { id: 'timeline', label: 'Timeline', icon: '◎' },
  { id: 'quests', label: 'Quests', icon: '◈' },
  { id: 'locations', label: 'Locations', icon: '◉' },
  { id: 'notes', label: 'Session Notes', icon: '◻' },
]

export default function Sidebar({ active, onNavigate }: Props) {
  return (
    <aside style={{
      width: 220,
      minWidth: 220,
      height: '100vh',
      background: 'var(--card)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      padding: '0',
      flexShrink: 0,
    }}>
      {/* Brand */}
      <div style={{
        padding: '24px 20px 20px',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 28,
            height: 28,
            borderRadius: 7,
            background: 'var(--primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 13,
            fontWeight: 700,
            color: '#fff',
            flexShrink: 0,
          }}>N</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)', letterSpacing: '-0.01em' }}>N&amp;D Companion</div>
            <div style={{ fontSize: 10.5, color: 'var(--muted-foreground)', marginTop: 1, fontFamily: 'JetBrains Mono, monospace' }}>DM MODE</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ padding: '12px 10px', flex: 1 }}>
        {items.map(item => {
          const isActive = item.id === active
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                padding: '8px 10px',
                borderRadius: 7,
                border: 'none',
                cursor: 'pointer',
                background: isActive ? 'rgba(91,142,255,0.1)' : 'transparent',
                color: isActive ? 'var(--primary)' : 'var(--muted-foreground)',
                fontSize: 13,
                fontWeight: isActive ? 500 : 400,
                textAlign: 'left',
                transition: 'all 0.12s ease',
                marginBottom: 2,
              }}
              onMouseEnter={e => {
                if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)'
              }}
              onMouseLeave={e => {
                if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
              }}
            >
              <span style={{ fontSize: 14, width: 18, textAlign: 'center', flexShrink: 0 }}>{item.icon}</span>
              {item.label}
              {isActive && (
                <div style={{
                  marginLeft: 'auto',
                  width: 5,
                  height: 5,
                  borderRadius: '50%',
                  background: 'var(--primary)',
                }} />
              )}
            </button>
          )
        })}
      </nav>

      {/* Campaign info */}
      <div style={{
        padding: '14px 16px',
        borderTop: '1px solid var(--border)',
        background: 'rgba(0,0,0,0.2)',
      }}>
        <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500 }}>Campaign</div>
        <div style={{ fontSize: 12.5, color: 'var(--foreground)', fontWeight: 500 }}>The Shattered Crown</div>
        <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 2, fontFamily: 'JetBrains Mono, monospace' }}>Session #14</div>
      </div>
    </aside>
  )
}
