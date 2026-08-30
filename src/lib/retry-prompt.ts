// lib/retry-prompt.ts
// Системный промпт RETRY переехал в public.rubrics (move_id, kind='retry').
// Здесь осталась только сборка user-сообщения.

export function buildRetryUserMessage(params: {
  situation: string
  tryTranscript: string
  retryTranscript: string
}): string {
  return `Ситуация:
"${params.situation}"

Первая попытка TRY:
"${params.tryTranscript}"

Вторая попытка RETRY:
"${params.retryTranscript}"

Сравни сдвиг между попытками и верни JSON.`
}
