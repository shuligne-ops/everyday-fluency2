export type Phase = 'cold' | 'runway' | 'varied' | 'contrast' | 'transfer' | 'delayed' | 'free'

export type Drill = {
  id: string
  phase: Phase
  scenario: string
  prompt: string
  models: string[]
  meaningGroups: string[][]
  meaningHint: string
}

export type Pattern = {
  id: string
  level: 'A2' | 'B1' | 'B2'
  name: string
  form: string
  meaning: string
  starterHint: string
  formHint: string
  targetFull: RegExp
  targetPartial: RegExp
  drills: Drill[]
  freePrompt: string
}

export type EvalOutcome =
  | 'TARGET_INDEPENDENT'
  | 'TARGET_SUPPORTED'
  | 'TARGET_NEEDS_REPAIR'
  | 'MEANING_ALTERNATIVE'
  | 'MEANING_PARTIAL'
  | 'MEANING_MISS'

export type Attempt = {
  drillId: string
  phase: Phase
  transcript: string
  firstAttempt: boolean
  hintLevel: number
  latencyMs: number
  meaningScore: 0 | 1 | 2
  targetScore: 0 | 1 | 2
  outcome: EvalOutcome
  countsForMastery: boolean
}

export type Progress = {
  sessions: number
  nextDueAt: string
  delayedSuccesses: number
  lastOutcome: EvalOutcome | null
  lastValidProbeAt: string | null
}
