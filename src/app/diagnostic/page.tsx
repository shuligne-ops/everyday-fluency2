// Серверная обёртка диагностики. Сцены грузятся здесь, а не в браузере, по двум
// причинам: страница должна работать сразу с нужным ходом (без мигания пустым
// экраном), и модельный текст сценария не должен попадать в клиентский бандл.

import DiagnosticFlow from './DiagnosticFlow'
import { DEFAULT_MOVE, loadClientScenarios } from '@/lib/speaking-engine'

export const dynamic = 'force-dynamic'

const REQUIRED_KINDS = ['try', 'retry', 'transfer'] as const

export default async function DiagnosticPage({
  searchParams,
}: {
  searchParams: Promise<{ move?: string | string[] }>
}) {
  const params = await searchParams
  const requested = Array.isArray(params.move) ? params.move[0] : params.move
  const move = requested?.trim() || DEFAULT_MOVE

  const scenarios = await loadClientScenarios(move)
  const missing = REQUIRED_KINDS.filter((kind) => !scenarios[kind])

  if (missing.length > 0) {
    return (
      <main style={{ maxWidth: 640, margin: '0 auto', padding: '56px 24px', fontFamily: 'system-ui, sans-serif', color: '#0f1b3d' }}>
        <h1 style={{ fontSize: 24, lineHeight: 1.3, fontWeight: 700, margin: '0 0 16px' }}>Этот ход пока не настроен</h1>
        <p style={{ fontSize: 17, lineHeight: 1.6, color: '#1f2b4d', margin: 0 }}>
          Для хода «{move}» не хватает сценариев: {missing.join(', ')}.
        </p>
      </main>
    )
  }

  return (
    <DiagnosticFlow
      move={move}
      scenarios={{
        try: scenarios.try!,
        retry: scenarios.retry!,
        transfer: scenarios.transfer!,
      }}
    />
  )
}
