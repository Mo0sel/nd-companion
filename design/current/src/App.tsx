import { useState } from 'react'
import { initialEntries, initialQuests, campaignInfo } from './data/nd'
import type { Entry, Quest } from './data/nd'
import PlayWorkspace from './components/play/PlayWorkspace'
import PrepareWorkspace from './components/prepare/PrepareWorkspace'
import CampaignWorkspace from './components/campaign/CampaignWorkspace'
import ActorsWorkspace from './components/actors/ActorsWorkspace'

export type Tab = 'play' | 'prepare' | 'campaign' | 'actors'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'play',     label: 'Play',     icon: '▶' },
  { id: 'prepare',  label: 'Prepare',  icon: '✦' },
  { id: 'campaign', label: 'Campaign', icon: '⬡' },
  { id: 'actors',   label: 'Actors',   icon: '◎' },
]

export default function App() {
  const [tab, setTab] = useState<Tab>('play')
  const [entries, setEntries] = useState<Entry[]>(initialEntries)
  const [quests, setQuests] = useState<Quest[]>(initialQuests)
  const [activeEntryId, setActiveEntryId] = useState<string>('e2')

  const activeIndex = entries.findIndex(e => e.id === activeEntryId)

  const updateEntry = (id: string, changes: Partial<Entry>) =>
    setEntries(es => es.map(e => e.id === id ? { ...e, ...changes } : e))

  const addEntry = () => {
    const id = `e${Date.now()}`
    const newEntry: Entry = {
      id, title: 'New Entry', status: 'planned',
      speechNotes: '', objective: '', setup: '', twist: '',
      possibleOutcomes: '', reward: '', scene: '', characters: [],
      notes: '', sessionNotes: '', sessionSummary: '',
      objectives: [], experience: '', references: [],
    }
    setEntries(es => [...es, newEntry])
    setActiveEntryId(id)
  }

  const deleteEntry = (id: string) => {
    setEntries(es => {
      const next = es.filter(e => e.id !== id)
      if (activeEntryId === id && next.length > 0) setActiveEntryId(next[0].id)
      return next
    })
  }

  const reorderEntries = (next: Entry[]) => setEntries(next)

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100vh',
      background: 'var(--nd-bg)', overflow: 'hidden',
      fontFamily: 'var(--nd-font-sans)',
    }}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center',
        padding: '0 20px', height: 56,
        background: 'var(--nd-surface)',
        borderBottom: '1px solid var(--nd-border)',
        flexShrink: 0, gap: 0,
      }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          {/* Logo mark */}
          <div style={{
            width: 32, height: 32, borderRadius: 9,
            background: 'linear-gradient(145deg, #5b8eff 0%, #a78bfa 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 10px rgba(91,142,255,0.4), inset 0 1px 0 rgba(255,255,255,0.15)',
            flexShrink: 0,
          }}>
            <span style={{ fontSize: 13, fontWeight: 900, color: '#fff', letterSpacing: '-0.03em' }}>N</span>
          </div>
          {/* Brand text */}
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--nd-text-1)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              N&amp;D Companion
            </div>
            <div style={{ fontSize: 10, color: 'var(--nd-text-3)', marginTop: 1, letterSpacing: '0.01em' }}>
              Foundry VTT · GM Tools
            </div>
          </div>
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: 28, background: 'var(--nd-border)', margin: '0 20px', flexShrink: 0 }} />

        {/* Search */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, width: 260,
          background: 'var(--nd-surface-2)', border: '1px solid var(--nd-border)',
          borderRadius: 8, padding: '7px 12px', cursor: 'text',
          transition: 'border-color 0.12s',
        }}
          onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(91,142,255,0.35)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--nd-border)' }}
        >
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, color: 'var(--nd-text-3)' }}>
            <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M10 10L13 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span style={{ flex: 1, fontSize: 12.5, color: 'var(--nd-text-3)' }}>Search campaign…</span>
          <kbd style={{
            display: 'flex', alignItems: 'center', gap: 1,
            fontSize: 10, color: 'var(--nd-text-3)',
            background: 'rgba(255,255,255,0.05)', border: '1px solid var(--nd-border)',
            borderRadius: 5, padding: '2px 6px', fontFamily: 'var(--nd-font-mono)',
            letterSpacing: '-0.01em',
          }}>⌘K</kbd>
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Session badge */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 12px', borderRadius: 8,
          background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)',
        }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--nd-success)', boxShadow: '0 0 5px rgba(34,197,94,0.6)' }} />
          <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--nd-success)', letterSpacing: '0.01em' }}>
            Session 1 · Live
          </span>
        </div>
      </div>

      {/* ── Tab bar ──────────────────────────────────────────────────────────── */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
        background: 'var(--nd-surface)',
        borderBottom: '1px solid var(--nd-border)',
        flexShrink: 0, padding: '6px 8px', gap: 4,
      }}>
        {TABS.map(({ id, label, icon }) => {
          const active = tab === id
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                padding: '9px 0', borderRadius: 8,
                border: `1px solid ${active ? 'var(--nd-blue)' : 'transparent'}`,
                background: active
                  ? 'linear-gradient(135deg, rgba(91,142,255,0.18) 0%, rgba(91,142,255,0.08) 100%)'
                  : 'transparent',
                color: active ? 'var(--nd-blue)' : 'var(--nd-text-3)',
                fontSize: 12.5, fontWeight: 600, letterSpacing: '0.01em',
                cursor: 'pointer', transition: 'all 0.15s',
                fontFamily: 'var(--nd-font-sans)',
                boxShadow: active ? 'inset 0 1px 0 rgba(91,142,255,0.2)' : 'none',
              }}
              onMouseEnter={e => {
                if (!active) {
                  (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)'
                  ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--nd-text-1)'
                }
              }}
              onMouseLeave={e => {
                if (!active) {
                  (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                  ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--nd-text-3)'
                }
              }}
            >
              <span style={{ fontSize: 11, opacity: active ? 0.9 : 0.5, lineHeight: 1 }}>{icon}</span>
              {label}
            </button>
          )
        })}
      </div>

      {/* ── Workspace ────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
        {tab === 'play' && (
          <PlayWorkspace
            entries={entries}
            activeEntryId={activeEntryId}
            activeIndex={activeIndex}
            onNavigate={setActiveEntryId}
            onUpdateEntry={updateEntry}
            campaignInfo={campaignInfo}
          />
        )}
        {tab === 'prepare' && (
          <PrepareWorkspace
            entries={entries}
            activeEntryId={activeEntryId}
            onSelect={setActiveEntryId}
            onUpdate={updateEntry}
            onAdd={addEntry}
            onDelete={deleteEntry}
            onReorder={reorderEntries}
          />
        )}
        {tab === 'campaign' && (
          <CampaignWorkspace
            quests={quests}
            onUpdateQuests={setQuests}
            currentSession={campaignInfo.currentSession}
          />
        )}
        {tab === 'actors' && (
          <ActorsWorkspace />
        )}
      </div>
    </div>
  )
}
