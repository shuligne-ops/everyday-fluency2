export type Category = 'Времена и aspect' | 'Модальность' | 'Разговорные конструкции'

export type Drill = {
  cue: string
  models: string[]
}

export type Pattern = {
  id: string
  name: string
  category: Category
  level: string
  form: string
  meaning: string
  repair: string
  full: RegExp
  partial: RegExp
  drills: Drill[]
}
