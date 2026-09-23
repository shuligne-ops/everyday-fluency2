import { TIMES_PATTERNS } from '../retrieval-lab/catalogTimes'
import { MODALITY_PATTERNS } from '../retrieval-lab/catalogModality'
import { CONVERSATION_PATTERNS } from '../retrieval-lab/catalogConversation'
import type { Pattern } from '../retrieval-lab/retrievalTypes'

export const ALL_PATTERNS: Pattern[] = [
  ...TIMES_PATTERNS,
  ...MODALITY_PATTERNS,
  ...CONVERSATION_PATTERNS,
]

export type ContrastSet = {
  id: string
  title: string
  subtitle: string
  patternIds: [string, string, string]
}

export const CONTRAST_SETS: ContrastSet[] = [
  {
    id: 'past-habits',
    title: 'Раньше, просто прошлое, привыкание',
    subtitle: 'used to · Past Simple · get used to',
    patternIds: ['used_to', 'past_simple', 'get_used_to'],
  },
  {
    id: 'regret-counterfactual',
    title: 'Сожаление и последствия',
    subtitle: 'wish + past perfect · should have · mixed conditional',
    patternIds: ['wish_past', 'should_have', 'mixed_conditional'],
  },
  {
    id: 'past-alternatives',
    title: 'Что могло / должно было произойти',
    subtitle: 'could have · must have · past continuous',
    patternIds: ['could_have', 'must_have', 'past_continuous_interrupted'],
  },
  {
    id: 'obligation-rules',
    title: 'Обязанность, запрет, ожидание',
    subtitle: 'have to · must / mustn’t · be supposed to',
    patternIds: ['have_to', 'must_mustnt', 'supposed_to'],
  },
  {
    id: 'possibility-choice',
    title: 'Возможность и практический выбор',
    subtitle: 'can / can’t · may / might · might as well',
    patternIds: ['can_cant', 'may_might', 'might_as_well'],
  },
  {
    id: 'present-time',
    title: 'Привычка, сейчас, процесс до настоящего',
    subtitle: 'Present Simple · Present Continuous · Present Perfect Continuous',
    patternIds: ['present_simple_habit', 'present_continuous_now', 'present_perfect_continuous'],
  },
  {
    id: 'time-and-future',
    title: 'Опыт, будущее и ближайшее действие',
    subtitle: 'Present Perfect · future time clause · be about to',
    patternIds: ['present_perfect_experience', 'future_time_clause', 'about_to'],
  },
  {
    id: 'wants-preferences',
    title: 'Желание и предпочтение',
    subtitle: 'would like · feel like · would rather',
    patternIds: ['would_like', 'feel_like', 'would_rather'],
  },
  {
    id: 'suggestions-context',
    title: 'Предложение, условие, ожидание',
    subtitle: 'How about…? · It depends on… · look forward to',
    patternIds: ['how_about', 'it_depends_on', 'look_forward_to'],
  },
  {
    id: 'outcome-achievement',
    title: 'Результат, усилие и бессмысленность действия',
    subtitle: 'end up · manage to · there’s no point in',
    patternIds: ['end_up', 'managed_to', 'no_point_in'],
  },
]

export function getPattern(id: string): Pattern {
  const pattern = ALL_PATTERNS.find((item) => item.id === id)
  if (!pattern) throw new Error(`Pattern not found: ${id}`)
  return pattern
}
