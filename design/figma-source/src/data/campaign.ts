export type BeatStatus = 'planned' | 'active' | 'done' | 'skipped'
export type EntityType = 'actor' | 'scene' | 'journal' | 'rolltable'

export interface Entity {
  id: string
  type: EntityType
  name: string
}

export interface Beat {
  id: string
  title: string
  objective: string
  gmNotes: string
  entities: Entity[]
  status: BeatStatus
}

export interface Thread {
  id: number
  text: string
  done: boolean
}

export const ENTITY_ICONS: Record<EntityType, string> = {
  actor: '👤',
  scene: '🗺',
  journal: '📖',
  rolltable: '🎲',
}

export const STATUS_META: Record<BeatStatus, { label: string; color: string; bg: string }> = {
  planned: { label: 'Planned', color: '#6b6b7e', bg: 'rgba(107,107,126,0.1)' },
  active:  { label: 'Active',  color: '#5b8eff', bg: 'rgba(91,142,255,0.12)' },
  done:    { label: 'Done',    color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
  skipped: { label: 'Skipped', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
}

export const initialBeats: Beat[] = [
  {
    id: 'b1',
    title: 'Cold Open — The Granary Ruins',
    objective: 'Establish that something big happened here. Let players find the first clue.',
    gmNotes: 'Start in medias res — smoke still rising. Maren is already on site, pretending to be a city inspector. Don\'t introduce her by name yet. Let players ask. The foreman (Aldric) is nervous and lying.',
    entities: [
      { id: 'e1', type: 'actor', name: 'Maren Ashveil' },
      { id: 'e2', type: 'actor', name: 'Aldric the Foreman' },
      { id: 'e3', type: 'scene', name: 'Millhaven Granary' },
      { id: 'e4', type: 'journal', name: 'Granary Fire Notes' },
    ],
    status: 'done',
  },
  {
    id: 'b2',
    title: 'The Archivist\'s Gambit',
    objective: 'Party enters the Pale Archive. Ledger is found. Maren reveals partial allegiance.',
    gmNotes: 'Maren will NOT reveal she\'s Bureau until the enforcers breach the door — that\'s her leverage. If players push her before then, she deflects with bureaucratic vagueness. The secret passage is behind the bookshelf marked with a crescent moon — DC 14 Investigation.',
    entities: [
      { id: 'e5', type: 'actor', name: 'Maren Ashveil' },
      { id: 'e6', type: 'scene', name: 'The Pale Archive' },
      { id: 'e7', type: 'journal', name: 'The Pale Merchant\'s Ledger' },
      { id: 'e8', type: 'rolltable', name: 'Archive Complications' },
    ],
    status: 'active',
  },
  {
    id: 'b3',
    title: 'Enforcers at the Door',
    objective: 'Create pressure. Force a decision: fight, negotiate, or flee.',
    gmNotes: 'Lieutenant Sera leads 6 enforcers. She is NOT loyal to Edric — she wants out. If a player succeeds DC 12 Insight they sense hesitation. She will stand down if offered a way out that doesn\'t humiliate her. Don\'t let this become a straight fight if avoidable — the drama is in the choice.',
    entities: [
      { id: 'e9', type: 'actor', name: 'Lieutenant Sera' },
      { id: 'e10', type: 'actor', name: 'Edric\'s Enforcers' },
      { id: 'e11', type: 'rolltable', name: 'Enforcer Tactics' },
    ],
    status: 'planned',
  },
  {
    id: 'b4',
    title: 'Escape Through the Cistern',
    objective: 'Dynamic escape sequence. Environmental storytelling.',
    gmNotes: 'The secret passage leads to a flooded cistern — knee-deep by now. Torch goes out in the water. One enforcer follows and gets separated. The exit surfaces at pier 3. Voss is waiting there — she tracked them.',
    entities: [
      { id: 'e12', type: 'scene', name: 'Archive Cistern' },
      { id: 'e13', type: 'actor', name: 'Captain Lyra Voss' },
    ],
    status: 'planned',
  },
  {
    id: 'b5',
    title: 'Voss Makes an Offer',
    objective: 'Introduce Voss as a wildcard. New alliance or new enemy.',
    gmNotes: 'Voss has a contract on the ledger — but not from Edric. She won\'t say who hired her. She offers the party a deal: let her copy two pages, and she walks away. If refused she doesn\'t fight — she says "your choice" and leaves. She knows more than she admits.',
    entities: [
      { id: 'e14', type: 'actor', name: 'Captain Lyra Voss' },
      { id: 'e15', type: 'journal', name: 'Voss\'s Contract (sealed)' },
    ],
    status: 'planned',
  },
  {
    id: 'b6',
    title: 'The Counting House Endgame',
    objective: 'Confront Edric. The ledger changes hands — or doesn\'t.',
    gmNotes: 'Edric knows he\'s dying. He\'s not afraid. He wants the ledger burned — not for himself, but because what it reveals about the councilors would destabilize the city in a way that hurts people he actually cares about. He is the unexpected moral complication.',
    entities: [
      { id: 'e16', type: 'actor', name: 'Edric \'Twice-Dead\' Suun' },
      { id: 'e17', type: 'scene', name: 'Edric\'s Counting House' },
      { id: 'e18', type: 'rolltable', name: 'Counting House Guards' },
    ],
    status: 'planned',
  },
  {
    id: 'b7',
    title: 'Resolution — What the Ledger Costs',
    objective: 'Consequence scene. Players decide what to do with what they know.',
    gmNotes: 'No combat. Just choices. Who gets the ledger? What do the players reveal publicly? Maren will accept any outcome that keeps the Bureau clean — she\'s pragmatic. The councilors\' fates ripple into next arc. Close on the Thornwood Silence thread as a hook.',
    entities: [
      { id: 'e19', type: 'actor', name: 'Maren Ashveil' },
      { id: 'e20', type: 'journal', name: 'Session Epilogue Notes' },
    ],
    status: 'planned',
  },
]

export const initialThreads: Thread[] = [
  { id: 1, text: 'Who burned the Millhaven granary?', done: false },
  { id: 2, text: "Track down the Pale Merchant's ledger", done: true },
  { id: 3, text: "Discover why the Thornwood has gone silent", done: false },
  { id: 4, text: "Deliver the letter to Sister Elara", done: false },
  { id: 5, text: "Neutralize Edric's enforcement arm", done: false },
]

export const sessionNPCs = [
  { name: 'Maren Ashveil', role: 'Crown Operative', note: 'Reveal Bureau allegiance when door breaches' },
  { name: 'Lieutenant Sera', role: 'Edric\'s enforcer', note: 'Wants out — DC 12 Insight reveals hesitation' },
  { name: 'Captain Lyra Voss', role: 'Bounty hunter', note: 'Appears at pier 3. Has sealed contract.' },
  { name: "Edric 'Twice-Dead' Suun", role: 'Crime lord', note: 'Dying. Morally complex. Doesn\'t want chaos.' },
]
