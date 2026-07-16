import { useRef, useState } from 'react'
import type { Beat } from '../../data/campaign'
import { STATUS_META } from '../../data/campaign'

interface Props {
  beats: Beat[]
  activeBeatId: string
  onSelect: (id: string) => void
  onAdd: () => void
  onReorder: (beats: Beat[]) => void
  onDelete: (id: string) => void
}

export default function BeatList({ beats, activeBeatId, onSelect, onAdd, onReorder, onDelete }: Props) {
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [overIdx, setOverIdx] = useState<number | null>(null)
  const dragItem = useRef<number | null>(null)

  const handleDragStart = (i: number) => { dragItem.current = i; setDragIdx(i) }
  const handleDragEnter = (i: number) => { setOverIdx(i) }
  const handleDrop = () => {
    if (dragItem.current !== null && overIdx !== null && dragItem.current !== overIdx) {
      const next = [...beats]
      const [moved] = next.splice(dragItem.current, 1)
      next.splice(overIdx, 0, moved)
      onReorder(next)
    }
    dragItem.current = null
    setDragIdx(null)
    setOverIdx(null)
  }

  return (
    <aside style={{
      width: 'var(--nd-sidebar-w)',
      minWidth: 'var(--nd-sidebar-w)',
      borderRight: '1px solid var(--nd-border)',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--nd-surface)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 16px 11px',
        borderBottom: '1px solid var(--nd-border)',
        flexShrink: 0,
      }}>
        <div style={{
          fontSize: 13,
          fontWeight: 700,
          color: 'var(--nd-text-1)',
          marginBottom: 2,
          letterSpacing: '-0.01em',
        }}>
          Playbook
        </div>
        <div style={{
          fontSize: 'var(--nd-text-micro)',
          color: 'var(--nd-text-3)',
          fontFamily: 'var(--nd-font-mono)',
          letterSpacing: '0.03em',
        }}>
          {beats.length} beats · drag to reorder
        </div>
      </div>

      {/* List */}
      <div
        style={{ flex: 1, overflowY: 'auto', padding: '6px 8px' }}
        onDragOver={e => e.preventDefault()}
        onDrop={handleDrop}
      >
        {beats.map((beat, i) => {
          const meta = STATUS_META[beat.status]
          const isActive = beat.id === activeBeatId
          const isDragging = dragIdx === i
          const isOver = overIdx === i && dragIdx !== i

          return (
            <div
              key={beat.id}
              draggable
              onDragStart={() => handleDragStart(i)}
              onDragEnter={() => handleDragEnter(i)}
              onDragEnd={handleDrop}
              onClick={() => onSelect(beat.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                padding: '7px 9px',
                borderRadius: 'var(--nd-radius-md)',
                cursor: 'grab',
                background: isActive
                  ? 'rgba(91,142,255,0.08)'
                  : isOver
                    ? 'rgba(255,255,255,0.03)'
                    : 'transparent',
                border: isOver
                  ? '1px dashed rgba(91,142,255,0.35)'
                  : '1px solid transparent',
                borderLeft: isActive
                  ? '2px solid var(--nd-blue)'
                  : isOver
                    ? '1px dashed rgba(91,142,255,0.35)'
                    : '2px solid transparent',
                opacity: isDragging ? 0.35 : 1,
                marginBottom: 1,
                transition: 'background 0.1s',
                userSelect: 'none',
                position: 'relative',
              }}
              onMouseEnter={e => {
                if (!isActive && !isOver) (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.025)'
              }}
              onMouseLeave={e => {
                if (!isActive && !isOver) (e.currentTarget as HTMLDivElement).style.background = 'transparent'
              }}
            >
              {/* Drag handle */}
              <div style={{
                fontSize: 11,
                color: 'var(--nd-border)',
                cursor: 'grab',
                flexShrink: 0,
                lineHeight: 1,
                paddingTop: 1,
                opacity: 0.7,
              }}>⠿</div>

              {/* Index */}
              <div style={{
                fontSize: 10,
                fontFamily: 'var(--nd-font-mono)',
                color: 'var(--nd-text-3)',
                width: 14,
                textAlign: 'right',
                flexShrink: 0,
              }}>{i + 1}</div>

              {/* Title */}
              <div style={{
                flex: 1,
                minWidth: 0,
                fontSize: 12.5,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? 'var(--nd-text-1)' : 'var(--nd-text-2)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                lineHeight: 1.35,
                transition: 'color 0.1s',
              }}>
                {beat.title}
              </div>

              {/* Status dot */}
              <div style={{
                width: 6,
                height: 6,
                borderRadius: 'var(--nd-radius-full)',
                background: meta.color,
                flexShrink: 0,
                opacity: 0.85,
              }} title={meta.label} />

              {/* Delete */}
              <button
                onClick={e => { e.stopPropagation(); onDelete(beat.id) }}
                title="Delete beat"
                aria-label={`Delete ${beat.title}`}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--nd-text-3)',
                  fontSize: 15,
                  lineHeight: 1,
                  padding: 0,
                  opacity: 0,
                  flexShrink: 0,
                  transition: 'opacity 0.1s, color 0.1s',
                }}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLButtonElement
                  el.style.opacity = '1'
                  el.style.color = 'var(--nd-danger)'
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLButtonElement
                  el.style.opacity = '0'
                  el.style.color = 'var(--nd-text-3)'
                }}
              >×</button>
            </div>
          )
        })}
      </div>

      {/* Add Beat */}
      <div style={{
        padding: '8px 10px 10px',
        borderTop: '1px solid var(--nd-border)',
        flexShrink: 0,
      }}>
        <button
          onClick={onAdd}
          style={{
            width: '100%',
            padding: '8px',
            borderRadius: 'var(--nd-radius-md)',
            border: '1px dashed rgba(91,142,255,0.28)',
            background: 'transparent',
            color: 'var(--nd-blue)',
            fontSize: 12.5,
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'var(--nd-transition-fast)',
          }}
          onMouseEnter={e => {
            const el = e.currentTarget as HTMLButtonElement
            el.style.borderColor = 'rgba(91,142,255,0.55)'
            el.style.background = 'var(--nd-blue-dim)'
          }}
          onMouseLeave={e => {
            const el = e.currentTarget as HTMLButtonElement
            el.style.borderColor = 'rgba(91,142,255,0.28)'
            el.style.background = 'transparent'
          }}
        >
          + Add Beat
        </button>
      </div>
    </aside>
  )
}
