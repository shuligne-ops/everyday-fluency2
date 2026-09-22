'use client'

import { useEffect } from 'react'

function describeScore(value: string, end = false) {
  if (value.startsWith('2/')) return end ? ['Получилось самостоятельно', 'целевая форма появилась без подсказки'] : ['Получилось сразу', 'целевая форма уже была доступна']
  if (value.startsWith('1/')) return ['Почти получилось', 'форма узнаваема, но ещё неустойчива']
  return end ? ['Пока не закрепилось', 'в последнем примере форма ещё не появилась'] : ['Не получилось с первого раза', 'до тренировки целевая форма не извлеклась']
}

function describeStrength(value: string) {
  const n = Number(value.split('/')[0])
  if (n >= 5) return ['Очень хорошее', 'форма держится уверенно в разных примерах']
  if (n >= 4) return ['Хорошее', 'форма уже появляется в большинстве новых примеров']
  if (n >= 3) return ['Среднее', 'форма появляется, но пока не каждый раз']
  if (n >= 2) return ['Пока слабое', 'нужны ещё повторения в разных контекстах']
  return ['Пока не закрепилось', 'конструкция всё ещё требует заметной поддержки']
}

function describeLatency(value: string) {
  const seconds = Number.parseFloat(value.replace(',', '.'))
  if (!Number.isFinite(seconds)) return 'сколько обычно проходит до начала ответа'
  if (seconds < 3) return 'ответ обычно начинается почти сразу'
  if (seconds < 6) return 'есть небольшая пауза перед ответом'
  return 'пока есть заметная пауза перед ответом'
}

function addNote(card: HTMLElement, text: string) {
  let note = card.querySelector<HTMLElement>('[data-clarity-note]')
  if (!note) {
    note = document.createElement('span')
    note.dataset.clarityNote = 'true'
    note.style.fontSize = '13px'
    note.style.lineHeight = '1.4'
    note.style.color = '#cbd5e1'
    card.appendChild(note)
  }
  note.textContent = text
}

function applyClarity() {
  const smalls = Array.from(document.querySelectorAll('small'))
  const wanted = ['Начало', 'Последний пример', 'Медиана latency', 'Устойчивость']
  if (!wanted.every((label) => smalls.some((node) => node.textContent?.trim() === label))) return

  const findCard = (label: string) => {
    const small = smalls.find((node) => node.textContent?.trim() === label) as HTMLElement | undefined
    return small?.parentElement as HTMLElement | null
  }

  const firstCard = findCard('Начало')
  const lastCard = findCard('Последний пример')
  const latencyCard = findCard('Медиана latency')
  const strengthCard = findCard('Устойчивость')
  if (!firstCard || !lastCard || !latencyCard || !strengthCard) return

  const firstValue = firstCard.querySelector('strong')?.textContent?.trim() || '—'
  const lastValue = lastCard.querySelector('strong')?.textContent?.trim() || '—'
  const latencyValue = latencyCard.querySelector('strong')?.textContent?.trim() || '—'
  const strengthValue = strengthCard.querySelector('strong')?.textContent?.trim() || '—'

  if (!firstCard.dataset.clarityDone) {
    const first = describeScore(firstValue, false)
    const last = describeScore(lastValue, true)
    const strength = describeStrength(strengthValue)

    const firstLabel = firstCard.querySelector('small')
    const firstStrong = firstCard.querySelector('strong')
    if (firstLabel) firstLabel.textContent = 'С первой попытки'
    if (firstStrong) firstStrong.textContent = first[0]
    addNote(firstCard, first[1])

    const lastLabel = lastCard.querySelector('small')
    const lastStrong = lastCard.querySelector('strong')
    if (lastLabel) lastLabel.textContent = 'К концу серии'
    if (lastStrong) lastStrong.textContent = last[0]
    addNote(lastCard, last[1])

    const latencyLabel = latencyCard.querySelector('small')
    if (latencyLabel) latencyLabel.textContent = 'Обычно до начала ответа'
    addNote(latencyCard, describeLatency(latencyValue))

    const strengthLabel = strengthCard.querySelector('small')
    const strengthStrong = strengthCard.querySelector('strong')
    if (strengthLabel) strengthLabel.textContent = 'Насколько закрепилось'
    if (strengthStrong) strengthStrong.textContent = strength[0]
    addNote(strengthCard, `${strength[1]} · внутренняя шкала ${strengthValue}`)

    firstCard.dataset.clarityDone = 'true'
    lastCard.dataset.clarityDone = 'true'
    latencyCard.dataset.clarityDone = 'true'
    strengthCard.dataset.clarityDone = 'true'

    const grid = firstCard.parentElement
    if (grid && !document.querySelector('[data-clarity-summary]')) {
      const summary = document.createElement('div')
      summary.dataset.claritySummary = 'true'
      summary.style.marginTop = '18px'
      summary.style.padding = '18px 20px'
      summary.style.border = '1px solid #334155'
      summary.style.borderRadius = '14px'
      summary.style.background = '#111c3f'
      summary.style.color = '#e2e8f0'
      summary.style.lineHeight = '1.6'
      summary.innerHTML = `<strong style="display:block;color:white;margin-bottom:6px">Что это значит</strong><span>${first[1]}. К концу серии: ${last[1]}. Обычно до начала ответа проходит <b style="color:white">${latencyValue}</b>. ${strength[1]}.</span>`
      grid.insertAdjacentElement('afterend', summary)
    }

    const paragraphs = Array.from(document.querySelectorAll('p')) as HTMLElement[]
    const repeat = paragraphs.find((p) => p.textContent?.trim().startsWith('Следующий повтор:'))
    if (repeat) {
      const match = repeat.textContent?.match(/Следующий повтор:\s*([^\.]+\.?)/)
      const date = match?.[1]?.trim() || ''
      repeat.textContent = date
        ? `Повторить ${date.replace(/\.$/, '')}: не чтобы заново учить правило, а чтобы проверить, всплывает ли конструкция позже без подсказки.`
        : 'Следующий повтор нужен, чтобы проверить, сохраняется ли конструкция без подсказки.'
    }
  }
}

export default function ResultClarityLayer() {
  useEffect(() => {
    applyClarity()
    const observer = new MutationObserver(() => applyClarity())
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])
  return null
}
