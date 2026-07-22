'use client'

/**
 * Итоговый экран diagnostic (EF voice-slice, День 4).
 *
 * НАЗНАЧЕНИЕ. Собирает try/retry/transfer ОДНОГО прохождения в честный профиль по формуле:
 *   паттерн → что изменилось сейчас → что ещё НЕ доказано → зачем 8 недель → оффер.
 *
 * ГИБРИД (осознанное решение, не трогать без причины):
 *   - Каркас, честностные формулировки, ключевая строка и оффер — ХАРДКОД (продающий и
 *     юридически-честный скелет; модели на импровизацию не отдаётся, иначе уплывёт в
 *     «докажем перенос в жизнь»).
 *   - Персонализируется ТОЛЬКО то, что реально про речь человека: имя его паттерна, его
 *     фраза из TRY, сдвиг из RETRY — всё это БЕРЁТСЯ ИЗ УЖЕ ПОЛУЧЕННОГО РАЗБОРА (CONTRAST)
 *     по текущему attempt_id. Экран НЕ зовёт модель заново — никакой новой генерации и
 *     новой точки отказа.
 *
 * ЗАВИСИМОСТЬ ОТ attempt_id (см. CODEX-attempt-id.md): проп `result` должен собираться
 *   строго по одному attempt_id. Если transfer не завершён — прокинуть transferScore=null,
 *   экран честно покажет «перенос не завершён», а НЕ подтянет чужой шаг.
 *
 * ВСТРОЙКА. Компонент самодостаточен (инлайн-стили, как ef_PRICING_page.tsx) — не зависит от
 *   globals.css diagnostic-потока. Бренд EF: фон #0f1b3d, акцент #f59e0b, втор. #f97316,
 *   Playfair Display + Inter. Точное место рендера и имена типов — подтвердить в `main`.
 */

// ── БРЕНД (из README-КАНОН / ef_PRICING_page.tsx) ─────────────────────────────
const NAVY = '#0f1b3d'
const NAVY_CARD = '#16224a'
const AMBER = '#f59e0b'
const ORANGE = '#f97316'
const INK = '#e8ecf5'
const MUTED = '#9aa6c2'
const LINE = 'rgba(245,158,11,0.18)'

// ── ТИПЫ ──────────────────────────────────────────────────────────────────────
// Поля берутся из разбора CONTRAST по текущему attempt_id. Имена — под фактические
// в `main`; при расхождении приоритет у кода, не у этого файла.
export interface DiagnosticResultData {
  /** URL/играбельный источник записи TRY (audio_path из diagnostic_sessions). */
  tryAudioUrl: string | null
  /** Короткое имя приоритетного паттерна из CONTRAST, на русском. Напр. «Извинение-объяснение». */
  patternName: string
  /** Реальная фраза студента из TRY (его слова). */
  userLine: string
  /** Как реплику считывает носитель — из CONTRAST, на русском. Одна фраза. */
  nativeReads: string
  /** Итог TRANSFER: 2 применил сам / 1 частично / 0 не сдвинулось / null — не завершён. */
  transferScore: 0 | 1 | 2 | null
  /**
   * Описание сдвига из RETRY (contrast.shift_note) — ЧТО именно сместилось в формулировке.
   * Это НЕ дословная цитата студента, а разбор сдвига на русском. Подаётся в тексте как
   * описание, не в кавычках. null — если RETRY не было или сдвиг пуст.
   */
  shiftNote?: string | null
}

interface Props {
  result: DiagnosticResultData
  /** Клик по офферу → переход к ЮKassa checkout (план beta_meetings). */
  onStartBeta: () => void
  /** Опционально: сколько мест осталось в потоке (из 10). Не показывать, если undefined. */
  seatsLeft?: number
}

// ── ТЕКСТ БЛОКА 2 ПОД transferScore (три ветки, персонализуются retryLine) ───────
function changeBlock(score: 0 | 1 | 2 | null, shiftNote?: string | null) {
  const s = shiftNote ? `Что сместилось: ${shiftNote}. ` : ''
  switch (score) {
    case 2:
      return {
        head: 'В новой сцене ты сместил реплику сам — без подсказки.',
        body: `${s}Адаптацию под другую ситуацию ты сегодня показал. Это то, что можно было проверить за один разбор. Дальше — вопрос не «получится ли осознанно», а «останется ли, когда не думаешь об этом».`.trim(),
      }
    case 1:
      return {
        head: 'Со второй попытки сдвиг появился, но в новой сцене вернулся частично.',
        body: `${s}Это не сбой — это норма. Один разбор показывает, ГДЕ паттерн; он не делает новую формулировку автоматической. Ровно этот разрыв и закрывают недели, а не минуты.`.trim(),
      }
    case 0:
      return {
        head: 'Паттерн держится и в новой сцене.',
        body: 'Это не провал и не приговор твоему английскому. Ты говоришь правильно — просто одна и та же реплика повторяется независимо от ситуации. Это и есть та точка, ради которой существует программа: осознать паттерн — первый шаг, заменить его под давлением — работа.',
      }
    default:
      return {
        head: 'Перенос сегодня не завершён.',
        body: 'Ты не дошёл до сцены переноса, поэтому честно: показать, сместилась ли реплика в новой ситуации, мы пока не можем. Это можно пройти заново — разбор ждёт на второй сцене.',
      }
  }
}

export default function DiagnosticResult({ result, onStartBeta, seatsLeft }: Props) {
  const { tryAudioUrl, patternName, userLine, nativeReads, transferScore, shiftNote } = result
  const change = changeBlock(transferScore, shiftNote)

  return (
    <div style={{
      minHeight: '100vh', background: NAVY, color: INK,
      fontFamily: 'Inter, system-ui, sans-serif',
      padding: '32px 20px 64px', display: 'flex', justifyContent: 'center',
    }}>
      <div style={{ width: '100%', maxWidth: 640 }}>

        {/* ── БЛОК 0 — Послушай себя ─────────────────────────────────────────── */}
        <p style={{ ...eyebrow, color: AMBER }}>Твоя запись</p>
        <h1 style={{ ...h1, fontFamily: 'Playfair Display, Georgia, serif' }}>
          Сначала — послушай, как ты это сказал.
        </h1>
        <p style={{ ...lead, color: MUTED }}>
          Не оценка в процентах, не балл. Твоя реальная реплика в рабочей ситуации.
          Разбор ниже — про эту запись, не про абстрактный уровень.
        </p>
        {tryAudioUrl ? (
          <audio controls src={tryAudioUrl} style={{ width: '100%', margin: '8px 0 28px' }} />
        ) : (
          <p style={{ ...small, color: MUTED, marginBottom: 28 }}>
            (Запись недоступна — покажем разбор по расшифровке.)
          </p>
        )}

        {/* ── БЛОК 1 — Твой приоритетный паттерн ─────────────────────────────── */}
        <section style={{ ...card, background: NAVY_CARD, borderColor: LINE }}>
          <p style={{ ...eyebrow, color: AMBER }}>Приоритетный паттерн</p>
          <h2 style={h2}>{patternName}</h2>
          <p style={{ ...body, color: INK }}>
            В рабочей ситуации ты сказал: <span style={{ color: AMBER }}>«{userLine}»</span>.
          </p>
          <p style={{ ...eyebrow, color: MUTED, marginTop: 12, marginBottom: 4 }}>Как это считывается</p>
          <p style={{ ...body, color: INK }}>
            <span style={{ color: AMBER }}>{nativeReads}</span>
          </p>
          <p style={{ ...small, color: MUTED, marginTop: 12 }}>
            Мы меряем не вежливость и не «британскость». Мы меряем, как твоя реплика управляет
            социальным эффектом — иногда это про мягче, иногда наоборот: короче, прямее,
            увереннее обозначить границу.
          </p>
        </section>

        {/* ── БЛОК 2 — Что изменилось сейчас (три ветки) ─────────────────────── */}
        <section style={{ ...card, background: NAVY_CARD, borderColor: LINE }}>
          <p style={{ ...eyebrow, color: AMBER }}>Что изменилось сейчас</p>
          <h2 style={h2}>{change.head}</h2>
          <p style={{ ...body, color: INK }}>{change.body}</p>
        </section>

        {/* ── БЛОК 3 — Что сегодня ещё НЕ доказано (ключевой, хардкод) ────────── */}
        <section style={{
          ...card, background: 'transparent',
          border: `1px solid ${AMBER}`,
        }}>
          <p style={{ ...eyebrow, color: AMBER }}>Что сегодня ещё не доказано</p>
          <p style={{ ...body, color: INK, fontSize: 18, lineHeight: 1.55 }}>
            Сегодня мы проверили <b style={{ color: AMBER }}>адаптацию</b> — можешь ли ты
            сместить реплику, когда осознанно пробуешь. Мы <u>не</u> проверяли{' '}
            <b style={{ color: AMBER }}>закрепление</b> — держится ли этот сдвиг через дни,
            в неподсказанной смоделированной ситуации, когда ты о нём не думаешь.
          </p>
          <p style={{ ...body, color: MUTED }}>
            Один разбор показывает паттерн. Он не делает новую реплику автоматической.
            Это разные вещи — и вторая требует не минут, а недель.
          </p>
        </section>

        {/* ── БЛОК 4 — Зачем 8 недель + оффер ────────────────────────────────── */}
        <section style={{ ...card, background: NAVY_CARD, borderColor: LINE }}>
          <p style={{ ...eyebrow, color: AMBER }}>Программа — 8 недель</p>
          <h2 style={h2}>Не «ещё уроки». Контракт на результат.</h2>
          <ol style={{ ...body, color: INK, paddingLeft: 20, margin: '8px 0 16px' }}>
            <li style={li}>входной профиль и <b>3 приоритетных паттерна</b> — твою речь на входе разбираю я сам;</li>
            <li style={li}>разговорные сессии на замену этих паттернов под разным давлением;</li>
            <li style={li}>отложенные проверки (delayed probes) — держится ли сдвиг через дни;</li>
            <li style={li}>слепой ретест в новой смоделированной ситуации;</li>
            <li style={li}>before/after report — что было и что стало, <b>финальный разбор делаю тоже я</b>.</li>
          </ol>
          <p style={{ ...small, color: MUTED }}>
            Честно про доставку: твою речь на входе и на выходе смотрю я лично. Между ними
            работает система. Это не «живое сопровождение каждой сессии» — это закрытый
            экспериментальный поток, где измерение калибруется на живых людях.
          </p>

          <div style={{
            marginTop: 20, paddingTop: 20, borderTop: `1px solid ${LINE}`,
            display: 'flex', flexDirection: 'column', gap: 6,
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <span style={{ fontSize: 30, fontWeight: 700, color: INK }}>4 900 ₽</span>
              <span style={{ ...small, color: MUTED }}>доступ к закрытому потоку · 8 недель · 10 мест</span>
            </div>
            {typeof seatsLeft === 'number' && seatsLeft > 0 && (
              <span style={{ ...small, color: AMBER }}>Осталось мест: {seatsLeft} из 10</span>
            )}
          </div>

          <button
            onClick={onStartBeta}
            style={{
              width: '100%', marginTop: 18, padding: '16px 20px',
              border: 'none', borderRadius: 12, cursor: 'pointer',
              fontSize: 16, fontWeight: 600, color: 'white', fontFamily: 'inherit',
              background: `linear-gradient(135deg, ${AMBER}, ${ORANGE})`,
            }}
          >
            Занять место в потоке
          </button>
          <p style={{ ...small, color: MUTED, textAlign: 'center', marginTop: 10 }}>
            Возврат в течение первой недели, если поймёшь, что формат не твой.
          </p>
        </section>

      </div>
    </div>
  )
}

// ── СТИЛИ ─────────────────────────────────────────────────────────────────────
const eyebrow: React.CSSProperties = { fontSize: 12, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', margin: '0 0 8px' }
const h1: React.CSSProperties = { fontSize: 30, lineHeight: 1.2, fontWeight: 700, margin: '0 0 12px' }
const h2: React.CSSProperties = { fontSize: 22, lineHeight: 1.3, fontWeight: 700, margin: '0 0 12px' }
const lead: React.CSSProperties = { fontSize: 16, lineHeight: 1.55, margin: '0 0 16px' }
const body: React.CSSProperties = { fontSize: 16, lineHeight: 1.6, margin: '0 0 10px' }
const small: React.CSSProperties = { fontSize: 13, lineHeight: 1.5, margin: 0 }
const li: React.CSSProperties = { marginBottom: 6 }
const card: React.CSSProperties = { borderRadius: 16, border: '1px solid', padding: '22px 22px', marginBottom: 18 }
