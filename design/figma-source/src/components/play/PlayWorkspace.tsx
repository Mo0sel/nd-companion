import type { Beat, Thread, BeatStatus } from '../../data/campaign'
import { sessionNPCs } from '../../data/campaign'
import PlaybookCard from './PlaybookCard'
import CompanionMemory from './CompanionMemory'
import LiveNotes from './LiveNotes'

interface Props {
  beats: Beat[]
  threads: Thread[]
  activeBeatId: string
  activeIndex: number
  onNavigate: (id: string) => void
  onThreadToggle: (id: number) => void
  onBeatStatusChange: (id: string, status: BeatStatus) => void
}

// ── Sub-components (defined before export default) ────────────────────────────

function QuickStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      textAlign: 'center',
      padding: '5px 12px',
      background: 'var(--nd-surface-2)',
      borderRadius: 'var(--nd-radius-md)',
      border: '1px solid var(--nd-border)',
      minWidth: 52,
    }}>
      <div style={{
        fontSize: 15,
        fontWeight: 700,
        color: 'var(--nd-text-1)',
        lineHeight: 1.1,
      }}>{value}</div>
      <div style={{
        fontSize: 'var(--nd-text-micro)',
        color: 'var(--nd-text-3)',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        marginTop: 2,
      }}>{label}</div>
    </div>
  )
}

function CampaignContext() {
  return (
    <div style={{
      background: 'var(--nd-surface)',
      border: '1px solid var(--nd-border)',
      borderRadius: 'var(--nd-radius-xl)',
      padding: '11px 16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontSize: 'var(--nd-text-h2)',
          fontWeight: 700,
          letterSpacing: '-0.02em',
          color: 'var(--nd-text-1)',
          marginBottom: 3,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          The Shattered Crown
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 'var(--nd-text-caption)',
          color: 'var(--nd-text-3)',
        }}>
          <span>
            Session{' '}
            <span style={{ color: 'var(--nd-text-1)', fontWeight: 600 }}>#14</span>
          </span>
          <span style={{ color: 'var(--nd-border)', userSelect: 'none' }}>·</span>
          <span style={{ fontFamily: 'var(--nd-font-mono)', fontSize: 11 }}>
            14th Harvestmoon, 847
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        <QuickStat label="Players" value="4" />
        <QuickStat label="Level" value="7" />
      </div>
    </div>
  )
}

function FocusPanel({ beat, beats, activeIndex }: {
  beat: Beat
  beats: Beat[]
  activeIndex: number
}) {
  const nextBeat = beats[activeIndex + 1]
  const donePct = beats.length
    ? Math.round((beats.filter(b => b.status === 'done').length / beats.length) * 100)
    : 0

  return (
    <div style={{
      background: 'var(--nd-surface)',
      border: '1px solid var(--nd-border)',
      borderRadius: 'var(--nd-radius-xl)',
      padding: '11px 16px',
      display: 'flex',
      gap: 14,
      alignItems: 'stretch',
    }}>
      {/* Now */}
      <FocusColumn label="Now" title={beat.title} subtitle={beat.objective} />

      <div style={{ width: 1, background: 'var(--nd-border)', flexShrink: 0, alignSelf: 'stretch' }} />

      {/* Next */}
      <FocusColumn
        label="Next"
        title={nextBeat?.title}
        subtitle={nextBeat?.objective}
        muted
      />

      <div style={{ width: 1, background: 'var(--nd-border)', flexShrink: 0, alignSelf: 'stretch' }} />

      {/* Progress */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        flexShrink: 0,
        minWidth: 44,
      }}>
        <div style={{
          fontSize: 18,
          fontWeight: 700,
          color: 'var(--nd-text-1)',
          lineHeight: 1,
        }}>{donePct}<span style={{ fontSize: 11, fontWeight: 500, color: 'var(--nd-text-3)' }}>%</span></div>
        <div style={{
          fontSize: 'var(--nd-text-micro)',
          color: 'var(--nd-text-3)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}>Done</div>
        <div style={{
          width: 32,
          height: 3,
          borderRadius: 99,
          background: 'var(--nd-surface-2)',
          marginTop: 2,
          overflow: 'hidden',
        }}>
          <div style={{
            width: `${donePct}%`,
            height: '100%',
            borderRadius: 99,
            background: 'var(--nd-success)',
            transition: 'width 0.3s ease',
          }} />
        </div>
      </div>
    </div>
  )
}

function FocusColumn({ label, title, subtitle, muted }: {
  label: string
  title?: string
  subtitle?: string
  muted?: boolean
}) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{
        fontSize: 'var(--nd-text-micro)',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: 'var(--nd-purple)',
        marginBottom: 4,
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 'var(--nd-text-body-sm)',
        fontWeight: muted ? 500 : 600,
        color: 'var(--nd-text-1)',
        opacity: muted ? 0.55 : 1,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        lineHeight: 'var(--nd-leading-snug)',
      }}>
        {title ?? '—'}
      </div>
      {subtitle && (
        <div style={{
          fontSize: 'var(--nd-text-caption)',
          color: 'var(--nd-text-3)',
          marginTop: 2,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          opacity: muted ? 0.6 : 1,
          lineHeight: 'var(--nd-leading-snug)',
        }}>
          {subtitle}
        </div>
      )}
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function PlayWorkspace({
  beats, threads, activeBeatId, activeIndex,
  onNavigate, onThreadToggle, onBeatStatusChange,
}: Props) {
  const beat = beats.find(b => b.id === activeBeatId) ?? beats[0]

  const goNext = () => { if (activeIndex < beats.length - 1) onNavigate(beats[activeIndex + 1].id) }
  const goPrev = () => { if (activeIndex > 0) onNavigate(beats[activeIndex - 1].id) }

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      background: 'var(--nd-bg)',
    }}>
      {/* Row 1: Campaign Context + Focus Panel */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 'var(--nd-card-gap)',
        padding: '16px var(--nd-page-x) 0',
        flexShrink: 0,
      }}>
        <CampaignContext />
        <FocusPanel beat={beat} beats={beats} activeIndex={activeIndex} />
      </div>

      {/* Row 2: Playbook hero */}
      <div style={{
        padding: '12px var(--nd-page-x) 0',
        flexShrink: 0,
      }}>
        <PlaybookCard
          beat={beat}
          index={activeIndex}
          total={beats.length}
          onPrev={goPrev}
          onNext={goNext}
          onStatusChange={status => onBeatStatusChange(beat.id, status)}
          canPrev={activeIndex > 0}
          canNext={activeIndex < beats.length - 1}
        />
      </div>

      {/* Row 3: Companion Memory + Session Notes */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 'var(--nd-card-gap)',
        padding: '12px var(--nd-page-x) 16px',
        flex: 1,
        minHeight: 0,
      }}>
        <CompanionMemory threads={threads} npcs={sessionNPCs} onToggle={onThreadToggle} />
        <LiveNotes />
      </div>
    </div>
  )
}
