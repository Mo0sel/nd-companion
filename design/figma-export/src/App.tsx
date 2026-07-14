import { useState } from 'react'
import Sidebar from './components/Sidebar'
import Dashboard from './components/Dashboard'
import NPCBrain from './components/NPCBrain'
import Timeline from './components/Timeline'
import Quests from './components/Quests'
import Locations from './components/Locations'
import SessionNotes from './components/SessionNotes'
import OhShitModal from './components/OhShitModal'

export type NavSection = 'dashboard' | 'npcs' | 'timeline' | 'quests' | 'locations' | 'notes'

export default function App() {
  const [section, setSection] = useState<NavSection>('dashboard')
  const [ohShitOpen, setOhShitOpen] = useState(false)

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100%', overflow: 'hidden', background: 'var(--background)' }}>
      <Sidebar active={section} onNavigate={setSection} />
      <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {section === 'dashboard' && <Dashboard onOhShit={() => setOhShitOpen(true)} />}
        {section === 'npcs' && <NPCBrain />}
        {section === 'timeline' && <Timeline />}
        {section === 'quests' && <Quests />}
        {section === 'locations' && <Locations />}
        {section === 'notes' && <SessionNotes />}
      </main>
      {ohShitOpen && <OhShitModal onClose={() => setOhShitOpen(false)} />}
    </div>
  )
}
