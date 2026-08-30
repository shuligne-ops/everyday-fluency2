// lib/transfer-prompt.ts
// Системный промпт TRANSFER переехал в public.rubrics (move_id, kind='transfer').
// Вместе с ним из промпта вырезан абзац с описанием новой сцены: он дублировал
// сценарий и расходился с ним по фактам — студенту говорилось «вы обещали»,
// модели «команда обещала». Теперь сцена приходит одна, из scenarios, и
// подставляется параметром, как в buildRetryUserMessage.

export function buildTransferUserMessage(params: {
  situation: string
  transcript: string
}): string {
  return `Новая ситуация, на которую отвечал студент:
"${params.situation}"

Ответ студента на новую ситуацию:
"${params.transcript}"

Оцени перенос и верни JSON.`
}
