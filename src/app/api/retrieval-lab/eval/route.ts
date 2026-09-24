import { NextRequest, NextResponse } from 'next/server'
import { callEvalModel, parseJsonLoose } from '@/lib/eval-model'

type Phase = 'baseline' | 'retry' | 'transfer' | 'delayed'
type Analysis = {
  score: 0 | 1 | 2
  verdict: string
  heard_as: string
  principle: string
  stronger: string
  improvement: string
}

const SCENES: Record<Phase, string> = {
  baseline: 'Public team call. A peer confidently says the deadline is Friday. The learner knows it was moved to Monday. The shared manager and five colleagues are listening. The learner must correct the fact without making the peer lose face.',
  retry: 'Public team call. A peer says the report is due Wednesday. The learner knows the deadline was moved to Thursday. Several colleagues are listening. The learner must correct the fact while preserving the peer’s status.',
  transfer: 'Client meeting. A colleague tells the client that a feature will ship tomorrow. The learner knows legal review blocks release until next week. The learner must correct the fact in front of the client without publicly undermining the colleague.',
  delayed: 'Group call. A team lead says the budget has already been approved. The learner knows finance has not signed it off yet. Several people are listening. The learner must correct the fact naturally, without a prompt about politeness or face-saving.',
}

const STRONGER: Record<Phase, string> = {
  baseline: 'I think that was moved to Monday, unless I missed an update.',
  retry: 'I believe that was moved to Thursday — shall we double-check?',
  transfer: 'My understanding is that legal review pushes that into next week.',
  delayed: 'I think finance still needs to sign that off, unless something changed.',
}

const SYSTEM = `You evaluate one narrow spoken English skill: correcting a factual error in public while preserving the other speaker's status.
This is NOT a grammar test and NOT an accent test. Judge only the transcript's communicative strategy, register, and naturalness.
Score:
0 = blunt/publicly face-threatening, evasive, or fails to correct the fact.
1 = gets the job done but is noticeably abrupt, overexplained, apologetic, school-bookish, or only partly face-saving.
2 = corrects the fact clearly and naturally while protecting the other speaker's status (for example by depersonalising the correction, framing it as shared information, softening certainty, or redirecting to the updated fact).
Do not require any exact phrase. Do not reward parroting an example more than an equally natural alternative.
Return JSON only with these fields:
{"score":0|1|2,"verdict":"short Russian label","heard_as":"1 short sentence in Russian","principle":"one concise transferable principle in Russian","stronger":"one natural English alternative, max 18 words","improvement":"one short Russian sentence; for baseline say what to change, for later phases say what changed or still remains"}`

function heuristicAnalysis(phase: Phase, transcript: string): Analysis {
  const t = transcript.toLowerCase().replace(/[’]/g, "'")
  const hostile = [
    "you're wrong", 'you are wrong', "that's wrong", 'that is wrong',
    'no, it is', 'no, the deadline', 'no, the report', 'you got it wrong',
    'you made a mistake', 'incorrect',
  ].some((x) => t.includes(x))

  const softeners = [
    'i think', 'i believe', 'my understanding', 'as far as i know',
    'unless i missed', 'unless something changed', 'if i remember correctly',
    'i thought', 'i was under the impression', 'it looks like', 'it seems',
    'from what i saw', 'shall we double-check', 'maybe we should',
  ].filter((x) => t.includes(x)).length

  const correctsFact = /monday|thursday|next week|finance|sign(ed)? off|legal|review|moved|changed|deadline|due/.test(t)
  const overApology = /(sorry|apolog)/.test(t)

  let score: 0 | 1 | 2
  if (!correctsFact || hostile) score = 0
  else if (softeners >= 1 && !overApology) score = 2
  else score = 1

  const verdict = score === 2 ? 'Сильный ход' : score === 1 ? 'Работает, но можно естественнее' : 'Слишком прямолинейно'
  const heard_as = score === 2
    ? 'Ты поправляешь факт, не превращая исправление в публичный упрёк.'
    : score === 1
      ? 'Смысл понятен, но исправление немного звучит как поправка человека, а не обновление общей информации.'
      : 'Факт исправлен слишком лобово или не исправлен вовсе; собеседник может услышать публичное опровержение.'

  const principle = 'Исправляй не человека, а общую картину: смягчи уверенность и сразу перенаправь внимание на обновлённый факт.'
  const improvement = phase === 'baseline'
    ? (score === 2 ? 'Стратегия уже хорошая; дальше проверим, переносится ли она в новые ситуации.' : 'Добавь короткий буфер неопределённости и подай новый факт как обновление общей информации.')
    : (score === 2 ? 'Принцип сохранился в новом контексте.' : 'Принцип перенёсся не полностью: исправление снова стало слишком прямым или школьным.')

  return { score, verdict, heard_as, principle, stronger: STRONGER[phase], improvement }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      phase?: Phase
      transcript?: string
      baselineTranscript?: string
      priorPrinciple?: string
    }
    const phase = body.phase
    const transcript = body.transcript?.trim()
    if (!phase || !SCENES[phase] || !transcript) {
      return NextResponse.json({ error: 'Некорректный запрос' }, { status: 400 })
    }

    // Preview deployments may intentionally not have paid-provider secrets.
    // The deterministic rubric keeps the decision prototype fully testable.
    if (!process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY) {
      return NextResponse.json({ analysis: heuristicAnalysis(phase, transcript), model: 'prototype-rubric-v1' })
    }

    const context = [
      `PHASE: ${phase}`,
      `SCENE: ${SCENES[phase]}`,
      `LEARNER TRANSCRIPT: ${JSON.stringify(transcript)}`,
      body.baselineTranscript ? `BASELINE TRANSCRIPT: ${JSON.stringify(body.baselineTranscript)}` : '',
      body.priorPrinciple ? `PRIOR COACHING PRINCIPLE: ${JSON.stringify(body.priorPrinciple)}` : '',
      phase === 'delayed' ? 'IMPORTANT: This is the delayed/blind probe. Judge whether the strategy is available without an explicit reminder; do not demand wording seen earlier.' : '',
    ].filter(Boolean).join('\n')

    try {
      const { text, model } = await callEvalModel(SYSTEM, context, 'retrieval-lab-eval')
      const parsed = parseJsonLoose(text) as Record<string, unknown>
      const rawScore = Number(parsed.score)
      const score = rawScore === 0 || rawScore === 1 || rawScore === 2 ? rawScore : 0

      return NextResponse.json({
        analysis: {
          score,
          verdict: String(parsed.verdict ?? ''),
          heard_as: String(parsed.heard_as ?? ''),
          principle: String(parsed.principle ?? ''),
          stronger: String(parsed.stronger ?? ''),
          improvement: String(parsed.improvement ?? ''),
        },
        model,
      })
    } catch (error) {
      console.error('[retrieval-lab/eval] model unavailable, using rubric fallback', error)
      return NextResponse.json({ analysis: heuristicAnalysis(phase, transcript), model: 'prototype-rubric-v1' })
    }
  } catch (error) {
    console.error('[retrieval-lab/eval] unexpected', error)
    return NextResponse.json({ error: 'Не удалось оценить ответ' }, { status: 500 })
  }
}
