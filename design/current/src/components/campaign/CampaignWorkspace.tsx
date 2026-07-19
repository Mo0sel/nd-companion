import { useState } from 'react'
import type { Quest, QuestCategory, QuestStatus } from '../../data/nd'

interface Props {
  quests: Quest[]
  onUpdateQuests: (quests: Quest[]) => void
  currentSession: string
}

const CATEGORY_LABELS: Record<QuestCategory, string> = {
  main: 'Main Quests',
  side: 'Side Quests',
  companion: 'Companion Quests',
}

const CATEGORY_COLOR: Record<QuestCategory, string> = {
  main: 'var(--nd-blue)',
  side: '#a78bfa',
  companion: '#22c55e',
}

function SectionLabel({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
      <div style={{ width: 2, height: 11, borderRadius: 1, background: color ?? 'var(--nd-purple)' }} />
      <span style={{
        fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.09em', color: color ?? 'var(--nd-purple)',
        fontFamily: 'var(--nd-font-mono)',
      }}>{children}</span>
    </div>
  )
}

function QuestRow({ quest, isActive, onClick }: { quest: Quest; isActive: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '7px 10px', borderRadius: 'var(--nd-radius-md)',
        cursor: 'pointer', marginBottom: 2,
        background: isActive ? 'rgba(91,142,255,0.08)' : 'transparent',
        border: isActive ? '1px solid rgba(91,142,255,0.2)' : '1px solid transparent',
        transition: 'background 0.1s',
      }}
      onMouseEnter={ev => { if (!isActive) (ev.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.025)' }}
      onMouseLeave={ev => { if (!isActive) (ev.currentTarget as HTMLDivElement).style.background = 'transparent' }}
    >
      <div style={{
        width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
        background: quest.status === 'open' ? 'var(--nd-blue)' : 'var(--nd-text-3)',
      }} />
      <span style={{
        flex: 1, fontSize: 12.5, color: isActive ? 'var(--nd-text-1)' : 'var(--nd-text-2)',
        fontWeight: isActive ? 600 : 400,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>{quest.title}</span>
    </div>
  )
}

// Parses @mentions in overview text and styles them as chips
function RichOverview({ text }: { text: string }) {
  if (!text) {
    return <span style={{ color: 'var(--nd-text-3)', fontSize: 13 }}>No overview written yet.</span>
  }
  return (
    <p style={{
      margin: 0, fontSize: 13.5, lineHeight: 1.7,
      color: 'var(--nd-text-2)', fontFamily: 'var(--nd-font-sans)',
    }}>
      {text.split(/(@\S+)/g).map((part, i) =>
        part.startsWith('@') ? (
          <span key={i} style={{
            color: 'var(--nd-blue)', fontWeight: 500,
            background: 'rgba(91,142,255,0.08)',
            borderRadius: 4, padding: '0 3px',
          }}>{part}</span>
        ) : part
      )}
    </p>
  )
}

export default function CampaignWorkspace({ quests, onUpdateQuests, currentSession }: Props) {
  const [activeQuestId, setActiveQuestId] = useState<string>(quests[0]?.id ?? '')

  const activeQuest = quests.find(q => q.id === activeQuestId)

  const updateQuest = (changes: Partial<Quest>) => {
    onUpdateQuests(quests.map(q => q.id === activeQuestId ? { ...q, ...changes } : q))
  }

  const addQuest = (category: QuestCategory) => {
    const id = `q${Date.now()}`
    const newQuest: Quest = { id, title: 'New Quest', category, status: 'open', overview: '' }
    onUpdateQuests([...quests, newQuest])
    setActiveQuestId(id)
  }

  const categories: QuestCategory[] = ['main', 'side', 'companion']

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>

      {/* ── Left sidebar: Quest list ─────────────────────────────────────── */}
      <div style={{
        width: 240, minWidth: 240,
        borderRight: '1px solid var(--nd-border)',
        display: 'flex', flexDirection: 'column',
        background: 'var(--nd-surface)', overflow: 'hidden',
      }}>
        <div style={{ padding: '16px 14px 8px', borderBottom: '1px solid var(--nd-border)', flexShrink: 0 }}>
          <SectionLabel>Campaign</SectionLabel>
          <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--nd-text-3)', fontFamily: 'var(--nd-font-mono)' }}>
            {currentSession}
          </p>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 8px' }}>
          {categories.map(cat => {
            const catQuests = quests.filter(q => q.category === cat)
            return (
              <div key={cat} style={{ marginBottom: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2px 6px' }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                    letterSpacing: '0.08em', color: CATEGORY_COLOR[cat],
                    fontFamily: 'var(--nd-font-mono)',
                  }}>{CATEGORY_LABELS[cat]}</span>
                  <button
                    onClick={() => addQuest(cat)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--nd-text-3)', fontSize: 14, lineHeight: 1,
                      padding: '0 2px', transition: 'color 0.1s',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = CATEGORY_COLOR[cat] }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--nd-text-3)' }}
                    title={`Add ${CATEGORY_LABELS[cat]}`}
                  >+</button>
                </div>
                {catQuests.length === 0 ? (
                  <p style={{ margin: '0 2px', fontSize: 11.5, color: 'var(--nd-text-3)', fontStyle: 'italic' }}>None</p>
                ) : (
                  catQuests.map(q => (
                    <QuestRow
                      key={q.id}
                      quest={q}
                      isActive={q.id === activeQuestId}
                      onClick={() => setActiveQuestId(q.id)}
                    />
                  ))
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Right: Quest editor ──────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
        {activeQuest ? (
          <>
            {/* Quest header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <SectionLabel color={CATEGORY_COLOR[activeQuest.category]}>{CATEGORY_LABELS[activeQuest.category]}</SectionLabel>
                <input
                  value={activeQuest.title}
                  onChange={e => updateQuest({ title: e.target.value })}
                  placeholder="Quest title"
                  style={{
                    width: '100%', background: 'transparent',
                    borderTop: 'none', borderRight: 'none', borderLeft: 'none',
                    borderBottom: '1px solid transparent',
                    borderRadius: 0, padding: '4px 0',
                    color: 'var(--nd-text-1)', fontSize: 22, fontWeight: 700,
                    letterSpacing: '-0.02em', outline: 'none',
                    fontFamily: 'var(--nd-font-sans)', boxSizing: 'border-box',
                    transition: 'border-color 0.12s',
                  }}
                  onFocus={e => { e.target.style.borderBottomColor = 'var(--nd-border)' }}
                  onBlur={e => { e.target.style.borderBottomColor = 'transparent' }}
                />
              </div>

              {/* Status + Category pills */}
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                {(['open', 'closed'] as QuestStatus[]).map(s => (
                  <button
                    key={s}
                    onClick={() => updateQuest({ status: s })}
                    style={{
                      padding: '4px 12px', borderRadius: 'var(--nd-radius-full)',
                      border: '1px solid',
                      borderColor: activeQuest.status === s ? 'var(--nd-blue)' : 'var(--nd-border)',
                      background: activeQuest.status === s ? 'var(--nd-blue-dim)' : 'transparent',
                      color: activeQuest.status === s ? 'var(--nd-blue)' : 'var(--nd-text-3)',
                      fontSize: 11, fontWeight: 600, cursor: 'pointer',
                      textTransform: 'uppercase', letterSpacing: '0.07em',
                      fontFamily: 'var(--nd-font-mono)', transition: 'all 0.12s',
                    }}
                  >{s}</button>
                ))}
              </div>
            </div>

            {/* Overview */}
            <div style={{ marginBottom: 24 }}>
              <p style={{
                margin: '0 0 8px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.09em', color: 'var(--nd-text-3)', fontFamily: 'var(--nd-font-mono)',
              }}>Overview</p>
              <textarea
                value={activeQuest.overview}
                onChange={e => updateQuest({ overview: e.target.value })}
                placeholder="Describe the quest. Use @character, @scene, @item to link references…"
                rows={8}
                style={{
                  width: '100%', background: 'var(--nd-surface-2)',
                  border: '1px solid var(--nd-border)', borderRadius: 'var(--nd-radius-md)',
                  padding: '12px 14px', color: 'var(--nd-text-1)', fontSize: 13.5,
                  lineHeight: 1.65, outline: 'none', fontFamily: 'var(--nd-font-sans)',
                  transition: 'border-color 0.12s', boxSizing: 'border-box', resize: 'vertical',
                }}
                onFocus={e => { e.target.style.borderColor = 'rgba(91,142,255,0.4)' }}
                onBlur={e => { e.target.style.borderColor = 'var(--nd-border)' }}
              />
            </div>

            {/* Rendered preview */}
            {activeQuest.overview && (
              <div style={{
                padding: '14px 16px', borderRadius: 'var(--nd-radius-lg)',
                background: 'var(--nd-surface)', border: '1px solid var(--nd-border)',
                marginBottom: 24,
              }}>
                <p style={{
                  margin: '0 0 8px', fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '0.09em', color: 'var(--nd-text-3)', fontFamily: 'var(--nd-font-mono)',
                }}>Preview</p>
                <RichOverview text={activeQuest.overview} />
              </div>
            )}

            {/* Quest entries section placeholder */}
            <div>
              <p style={{
                margin: '0 0 10px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.09em', color: 'var(--nd-text-3)', fontFamily: 'var(--nd-font-mono)',
              }}>Quest Entries</p>
              <div style={{
                padding: '20px', borderRadius: 'var(--nd-radius-lg)',
                border: '1px dashed var(--nd-border)', textAlign: 'center',
              }}>
                <p style={{ margin: 0, fontSize: 12.5, color: 'var(--nd-text-3)' }}>
                  Link session entries to this quest from the Prepare tab.
                </p>
              </div>
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--nd-text-3)', fontSize: 13 }}>
            Select a quest to edit
          </div>
        )}
      </div>
    </div>
  )
}
