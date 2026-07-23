import type { Metadata } from 'next'
import HearingCheck from './HearingCheck'

export const metadata: Metadata = {
  title: 'Проверь, как ты понимаешь английский на слух — Everyday Fluency',
  description: 'Три коротких фрагмента живой английской речи. Все слова знакомые — но услышишь ли ты их в темпе? Проверка за 2 минуты, без регистрации.',
}

export default function HearingCheckPage() {
  return <HearingCheck />
}
