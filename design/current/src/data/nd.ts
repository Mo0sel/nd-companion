// ─────────────────────────────────────────────────────────────────────────────
// N&D Companion — Data Model
// ─────────────────────────────────────────────────────────────────────────────

export type EntryStatus = 'active' | 'completed' | 'planned'
export type QuestCategory = 'main' | 'side' | 'companion'
export type QuestStatus = 'open' | 'closed'

export interface Objective {
  id: string
  text: string
  done: boolean
}

export interface Reference {
  id: string
  label: string
  color?: string
}

export interface Entry {
  id: string
  title: string
  status: EntryStatus
  speechNotes: string
  objective: string
  setup: string
  twist: string
  possibleOutcomes: string
  reward: string
  scene: string
  characters: string[]
  notes: string
  sessionNotes: string
  sessionSummary: string
  objectives: Objective[]
  experience: string
  references: Reference[]
}

export interface Quest {
  id: string
  title: string
  category: QuestCategory
  status: QuestStatus
  overview: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Sample Data
// ─────────────────────────────────────────────────────────────────────────────

export const initialEntries: Entry[] = [
  {
    id: 'e1',
    title: 'Collect an Outstanding Debt',
    status: 'completed',
    speechNotes: '',
    objective: 'Collect the debt from Vesk before he disappears into Dimir custody.',
    setup: 'Vesk receives information that one of Orzhov\'s former operatives has defected to House Dimir.\n\nNot just anyone.\n\nSomeone who knows: Orzhov collection routes, ghost vaults, safe houses, debt ledgers\n\nHe\'s become a strategic liability.\n\nThe Orzhov cannot publicly act against him because that would acknowledge he escaped.',
    twist: 'He\'s supporting two children.\n\nNot his.\n\nThe children belong to another collector executed by Orzhov.\n\nNow the mission becomes morally gray.',
    possibleOutcomes: 'Kill him quietly.\nFake his death.\nConvince him to disappear.\nDeliver him alive.\nBetray Vesk.\n\nEvery solution removes one Brand.',
    reward: '500 XP',
    scene: 'Bastion',
    characters: ['Vesk'],
    notes: 'notes',
    sessionNotes: 'Party helped Prof. Mizzix to clear the house. He\'ll study resonance abnormalities for 7 days. Party owns own a bastion. Granted the bastion\'s meditation-room benefit: advantage on Charisma saving throws until the next long rest there. Friendly toward Nico after the Red Wanes performance. Wants to recruit him for a future spectacle.',
    sessionSummary: '',
    objectives: [
      { id: 'o1', text: 'Collect an Outstanding Debt', done: true },
      { id: 'o2', text: 'Locate the target before sunrise', done: false },
    ],
    experience: '500 XP',
    references: [
      { id: 'r1', label: 'Bastion', color: '#f97316' },
      { id: 'r2', label: 'Vesk', color: '#5b8eff' },
    ],
  },
  {
    id: 'e2',
    title: "The Mask's Memory",
    status: 'active',
    speechNotes: '',
    objective: 'Learn about the mask',
    setup: 'If using Elyxir: DC 13 CON Save for each hour using the mask.\nIf not: straight toxic point.',
    twist: '',
    possibleOutcomes: '',
    reward: '300 XP\n3 Elyxir of protection',
    scene: 'SecretSunhome_30x33 (Precinct One)',
    characters: ['Agata Karlov'],
    notes: "Agatha carefully pours the elixir into three shallow porcelain cups. The liquid shimmers with tiny silver motes that never quite settle.\n\nA faint smile.\n\n\"History disagreed.\"\n\nShe uncorks the silver elixir.",
    sessionNotes: 'Party helped Prof. Mizzix to clear the house. He\'ll study resonance abnormalities for 7 days. Party owns own a bastion. Granted the bastion\'s meditation-room benefit: advantage on Charisma saving throws until the next long rest there.',
    sessionSummary: '',
    objectives: [
      { id: 'o3', text: 'Learn about the mask', done: false },
    ],
    experience: '300 XP',
    references: [
      { id: 'r3', label: 'SecretSunhome_30x33', color: '#f97316' },
      { id: 'r4', label: 'Agata Karlov', color: '#5b8eff' },
    ],
  },
  {
    id: 'e3',
    title: 'Rakdos — The Great Descent',
    status: 'planned',
    speechNotes: '',
    objective: '',
    setup: '',
    twist: '',
    possibleOutcomes: '',
    reward: '',
    scene: '',
    characters: [],
    notes: '',
    sessionNotes: '',
    sessionSummary: '',
    objectives: [],
    experience: '',
    references: [],
  },
  {
    id: 'e4',
    title: 'The Dimir Letter',
    status: 'planned',
    speechNotes: '',
    objective: '',
    setup: '',
    twist: '',
    possibleOutcomes: '',
    reward: '',
    scene: '',
    characters: [],
    notes: '',
    sessionNotes: '',
    sessionSummary: '',
    objectives: [],
    experience: '',
    references: [],
  },
  {
    id: 'e5',
    title: 'test',
    status: 'planned',
    speechNotes: '',
    objective: '',
    setup: '',
    twist: '',
    possibleOutcomes: '',
    reward: '',
    scene: '',
    characters: [],
    notes: '',
    sessionNotes: '',
    sessionSummary: '',
    objectives: [],
    experience: '',
    references: [],
  },
]

export const initialQuests: Quest[] = [
  { id: 'q1', title: 'Untitled Quest',   category: 'main',      status: 'open', overview: '' },
  { id: 'q2', title: 'The Maskee',       category: 'side',      status: 'open', overview: '' },
  { id: 'q3', title: 'The Orzhov Debt',  category: 'side',      status: 'open', overview: 'The part was arrested by Orzhov sentinels on @Session 6 once they put fire to the @Karlov Maze at @Karlov Manor. They had the @Orzhov Crystal, @Mask of Memory, @Mysterious Access Card and @Brownstone Sharp confiscated by @Taysa Karlov. @Vesk was commissioned to set the punishment branding them with 5 Debt Tokens.' },
  { id: 'q4', title: 'Untitled Quest',   category: 'side',      status: 'open', overview: '' },
]

export const campaignInfo = {
  name: 'Ravnica',
  currentLocation: 'Bastion',
  focusedCharacter: 'Frikka The Fuse',
  currentSession: 'Session 1',
}
