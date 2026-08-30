// src/lib/speaking-engine.ts
// ─────────────────────────────────────────────────────────────────────────────
// Единственный источник сценариев и рубрик. Раньше и ситуации, и системные
// промпты лежали константами в коде: добавить второй ход было нельзя без правки
// файлов и деплоя. Теперь ход целиком описывается данными.
//
// У сцены ДВА текста, и это не дублирование:
//   situation_ru       — то, что читает студент (короткая сцена, второе лицо);
//   situation_model_ru — то, что уходит в промпт (та же сцена + конфигурация
//                        власти, третье лицо).
// Модельный текст в браузер не отдаётся: по нему оценивают ответ. На уровне БД
// это закрыто колоночным grant, здесь — раздельными типами Scenario/ClientScenario.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export const DEFAULT_MOVE = 'face_saving_correction'

export type ScenarioKind = 'try' | 'retry' | 'transfer' | 'test_a' | 'test_b'

/** Поля сценария, которые безопасно отдать в браузер. */
export type ClientScenario = {
  id: string
  kind: ScenarioKind
  screenTitle: string | null
  /** Абзацы через пустую строку: первый — заголовок сцены, остальные — тело. */
  situation: string
  instruction: string | null
}

/** Сценарий целиком — только для сервера. */
export type Scenario = ClientScenario & {
  situationModel: string
  powerNote: string | null
}

export type Rubric = {
  id: string
  kind: ScenarioKind
  channel: 'transcript' | 'audio_features' | 'both'
  systemPrompt: string
}

const CLIENT_COLUMNS = 'id, kind, version, screen_title_ru, situation_ru, instruction_ru'
const SERVER_COLUMNS = `${CLIENT_COLUMNS}, situation_model_ru, power_note`

type ScenarioRow = {
  id: string
  kind: ScenarioKind
  version: number
  screen_title_ru: string | null
  situation_ru: string
  instruction_ru: string | null
  situation_model_ru?: string
  power_note?: string | null
}

export function createServiceClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

function toClientScenario(row: ScenarioRow): ClientScenario {
  return {
    id: row.id,
    kind: row.kind,
    screenTitle: row.screen_title_ru,
    situation: row.situation_ru,
    instruction: row.instruction_ru,
  }
}

/**
 * Активный сценарий старшей версии. Версия растёт при перекалибровке: старая
 * строка гасится is_active, историческая попытка остаётся привязанной к тексту,
 * который человек действительно слышал.
 */
export async function loadScenario(
  supabase: SupabaseClient,
  moveId: string,
  kind: ScenarioKind
): Promise<Scenario | null> {
  const { data, error } = await supabase
    .from('scenarios')
    .select(SERVER_COLUMNS)
    .eq('move_id', moveId)
    .eq('kind', kind)
    .eq('is_active', true)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('[speaking-engine] loadScenario failed:', moveId, kind, error)
    return null
  }
  if (!data) return null

  const row = data as ScenarioRow
  return {
    ...toClientScenario(row),
    situationModel: row.situation_model_ru ?? '',
    powerNote: row.power_note ?? null,
  }
}

/** Клиентские поля всех шагов одного хода — для серверного рендера страницы. */
export async function loadClientScenarios(
  moveId: string
): Promise<Partial<Record<ScenarioKind, ClientScenario>>> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('scenarios')
    .select(CLIENT_COLUMNS)
    .eq('move_id', moveId)
    .eq('is_active', true)
    .order('version', { ascending: true })

  if (error) {
    console.error('[speaking-engine] loadClientScenarios failed:', moveId, error)
    return {}
  }

  // Порядок по возрастанию версии: последняя запись в map — старшая версия.
  const byKind: Partial<Record<ScenarioKind, ClientScenario>> = {}
  for (const row of (data ?? []) as ScenarioRow[]) {
    byKind[row.kind] = toClientScenario(row)
  }
  return byKind
}

/**
 * Активная рубрика старшей версии. На один ход приходится три рубрики — по одной
 * на шаг, у каждой своя схема ответа. Читается только сервером: клиенту незачем
 * знать инструкцию, по которой его оценивают.
 */
export async function loadRubric(
  supabase: SupabaseClient,
  moveId: string,
  kind: ScenarioKind
): Promise<Rubric | null> {
  const { data, error } = await supabase
    .from('rubrics')
    .select('id, kind, channel, system_prompt')
    .eq('move_id', moveId)
    .eq('kind', kind)
    .eq('is_active', true)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('[speaking-engine] loadRubric failed:', moveId, kind, error)
    return null
  }
  if (!data) return null

  const row = data as { id: string; kind: ScenarioKind; channel: Rubric['channel']; system_prompt: string }
  return { id: row.id, kind: row.kind, channel: row.channel, systemPrompt: row.system_prompt }
}
