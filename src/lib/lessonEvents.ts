import { supabase } from './supabase'

export type LessonEventName = 'lesson_start' | 'lesson_50'

type RecordLessonEventInput = {
  userId: string | null
  lessonId: number | string
  level: string
  event: LessonEventName
}

export function recordLessonEvent({
  userId,
  lessonId,
  level,
  event,
}: RecordLessonEventInput) {
  if (!userId) return

  const numericLessonId = typeof lessonId === 'number' ? lessonId : Number(lessonId)
  if (!Number.isSafeInteger(numericLessonId)) return

  try {
    const request = supabase.from('lesson_events').upsert({
      user_id: userId,
      lesson_id: numericLessonId,
      level,
      event,
    }, {
      onConflict: 'user_id,lesson_id,event',
      ignoreDuplicates: true,
    })

    void Promise.resolve(request).then(({ error }) => {
      if (error) console.warn('[lessonEvents] Failed to record lesson event:', error)
    }, (error) => {
      console.warn('[lessonEvents] Failed to record lesson event:', error)
    })
  } catch (error) {
    console.warn('[lessonEvents] Failed to record lesson event:', error)
  }
}
