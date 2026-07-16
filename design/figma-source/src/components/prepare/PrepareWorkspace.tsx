import type { Beat } from '../../data/campaign'
import BeatList from './BeatList'
import BeatEditor from './BeatEditor'

interface Props {
  beats: Beat[]
  activeBeatId: string
  onSelect: (id: string) => void
  onUpdate: (id: string, changes: Partial<Beat>) => void
  onAdd: () => void
  onReorder: (beats: Beat[]) => void
  onDelete: (id: string) => void
}

export default function PrepareWorkspace({ beats, activeBeatId, onSelect, onUpdate, onAdd, onReorder, onDelete }: Props) {
  const beat = beats.find(b => b.id === activeBeatId) ?? beats[0]

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      <BeatList
        beats={beats}
        activeBeatId={activeBeatId}
        onSelect={onSelect}
        onAdd={onAdd}
        onReorder={onReorder}
        onDelete={onDelete}
      />
      {beat && (
        <BeatEditor
          key={beat.id}
          beat={beat}
          onUpdate={changes => onUpdate(beat.id, changes)}
        />
      )}
    </div>
  )
}
