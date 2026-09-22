import { NextRequest, NextResponse } from 'next/server'
import { callEvalModel, parseJsonLoose } from '@/lib/eval-model'

type Phase = 'baseline' | 'retry' | 'transfer' | 'delayed'

const SCENES: Record<Phase, string> = {
  baseline: 'Public team call. A peer confidently says the deadline is Friday. The learner knows it was moved to Monday. The shared manager and five colleagues are listening. The learner must correct the fact without making the peer lose face.',
  retry: 'Public team call. A peer says the report is due Wednesday. The learner knows the deadline was moved to Thursday. Several colleagues are listening. The learner must correct the fact while preserving the peer’s status.',
  transfer: 'Client meeting. A colleague tells the client that a feature will ship tomorrow. The learner knows legal review blocks release until next week. The learner must correct the fact in front of the client without publicly undermining the colleague.',
  delayed: 'Group call. A team lead says the budget has already been approved. The learner knows finance has not signed it off yet. Several people are listening. The learner must correct the fact naturally, without a prompt about politeness or face-saving.',
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

    const context = [
      `PHASE: ${phase}`,
      `SCENE: ${SCENES[phase]}`,
      `LEARNER TRANSCRIPT: ${JSON.stringify(transcript)}`,
      body.baselineTranscript ? `BASELINE TRANSCRIPT: ${JSON.stringify(body.baselineTranscript)}` : '',
      body.priorPrinciple ? `PRIOR COACHING PRINCIPLE: ${JSON.stringify(body.priorPrinciple)}` : '',
      phase === 'delayed' ? 'IMPORTANT: This is the delayed/blind probe. Judge whether the strategy is available without an explicit reminder; do not demand wording seen earlier.' : '',
    ].filter(Boolean).join('\n')

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
    console.error('[retrieval-lab/eval] unexpected', error)
    return NextResponse.json({ error: 'Не удалось оценить ответ' }, { status: 500 })
  }
}
