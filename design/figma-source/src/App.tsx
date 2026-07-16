import { useState } from 'react'
import { initialBeats, initialThreads } from './data/campaign'
import type { Beat, Thread } from './data/campaign'
import PlayWorkspace from './components/play/PlayWorkspace'
import PrepareWorkspace from './components/prepare/PrepareWorkspace'

export type Workspace = 'play' | 'prepare'

export default function App() {
  const [workspace, setWorkspace] = useState<Workspace>('play')
  const [beats, setBeats] = useState<Beat[]>(initialBeats)
  const [threads, setThreads] = useState<Thread[]>(initialThreads)
  const [activeBeatId, setActiveBeatId] = useState<string>('b2')

  const activeIndex = beats.findIndex(b => b.id === activeBeatId)

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: 'var(--nd-bg)',
      overflow: 'hidden',
    }}>
      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 var(--nd-page-x)',
        height: 'var(--nd-header-h)',
        borderBottom: '1px solid var(--nd-border)',
        background: 'var(--nd-surface)',
        flexShrink: 0,
      }}>

        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{
            width: 24,
            height: 24,
            borderRadius: 6,
            background: 'var(--nd-blue)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            fontWeight: 800,
            color: '#fff',
            letterSpacing: '-0.02em',
            flexShrink: 0,
          }}>N</div>
          <span style={{
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--nd-text-1)',
            letterSpacing: '-0.01em',
          }}>N&amp;D Companion</span>
          <span style={{ fontSize: 12, color: 'var(--nd-border)', userSelect: 'none' }}>·</span>
          <span style={{
            fontSize: 12,
            color: 'var(--nd-text-3)',
            fontFamily: 'var(--nd-font-mono)',
          }}>
            The Shattered Crown
          </span>
        </div>

        {/* Workspace toggle */}
        <div style={{
          display: 'flex',
          background: 'var(--nd-surface-2)',
          border: '1px solid var(--nd-border)',
          borderRadius: 'var(--nd-radius-md)',
          padding: 3,
          gap: 2,
        }}>
          {(['play', 'prepare'] as Workspace[]).map(ws => (
            <button
              key={ws}
              onClick={() => setWorkspace(ws)}
              aria-pressed={workspace === ws}
              style={{
                padding: '5px 20px',
                borderRadius: 'var(--nd-radius-sm)',
                border: 'none',
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                fontFamily: 'var(--nd-font-sans)',
                background: workspace === ws ? 'var(--nd-bg)' : 'transparent',
                color: workspace === ws ? 'var(--nd-text-1)' : 'var(--nd-text-3)',
                boxShadow: workspace === ws ? 'var(--nd-shadow-sm)' : 'none',
                transition: 'var(--nd-transition-fast)',
              }}
            >
              {ws}
            </button>
          ))}
        </div>

        {/* Session status */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 'var(--nd-text-caption)',
          color: 'var(--nd-text-3)',
        }}>
          <span style={{
            width: 6,
            height: 6,
            borderRadius: 'var(--nd-radius-full)',
            background: 'var(--nd-success)',
            display: 'inline-block',
            boxShadow: '0 0 5px rgba(34,197,94,0.55)',
          }} />
          Session #14 · Live
        </div>
      </header>

      {/* ── Workspace ────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
        {workspace === 'play' ? (
          <PlayWorkspace
            beats={beats}
            threads={threads}
            activeBeatId={activeBeatId}
            activeIndex={activeIndex}
            onNavigate={setActiveBeatId}
            onThreadToggle={id => setThreads(ts => ts.map(t => t.id === id ? { ...t, done: !t.done } : t))}
            onBeatStatusChange={(id, status) => setBeats(bs => bs.map(b => b.id === id ? { ...b, status } : b))}
          />
        ) : (
          <PrepareWorkspace
            beats={beats}
            activeBeatId={activeBeatId}
            onSelect={setActiveBeatId}
            onUpdate={(id, changes) => setBeats(bs => bs.map(b => b.id === id ? { ...b, ...changes } : b))}
            onAdd={() => {
              const id = `b${Date.now()}`
              setBeats(bs => [...bs, { id, title: 'New Beat', objective: '', gmNotes: '', entities: [], status: 'planned' }])
              setActiveBeatId(id)
            }}
            onReorder={setBeats}
            onDelete={id => setBeats(bs => {
              const next = bs.filter(b => b.id !== id)
              if (activeBeatId === id && next.length > 0) setActiveBeatId(next[0].id)
              return next
            })}
          />
        )}
      </div>
    </div>
  )
}
