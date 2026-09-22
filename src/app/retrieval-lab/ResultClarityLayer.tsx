'use client'

import { useEffect } from 'react'

function scoreMeaning(value: string) {
  if (value.startsWith('2/')) return ['целевая конструкция появилась полностью', 'Полностью']
  if (value.startsWith('1/')) return ['целевая конструкция появилась частично', 'Частично']
  return ['целевая конструкция не появилась', 'Не появилась']
}

function describeStrength(value: string) {
  const n = Number(value.split('/')[0])
  if (n >= 5) return ['Очень уверенно', 'форма держится уверенно в разных примерах']
  if (n >= 4) return ['Уверенно', 'форма уже появляется в большинстве новых примеров']
  if (n >= 3) return ['Неровно', 'форма появляется, но пока не каждый раз']
  if (n >= 2) return ['Пока слабо', 'нужны ещё повторения в разных контекстах']
  return ['Пока не закрепилось', 'конструкция всё ещё требует заметной поддержки']
}

function describeLatency(value: string) {
  const seconds = Number.parseFloat(value.replace(',', '.'))
  if (!Number.isFinite(seconds)) return 'медианное время от показа задания до начала ответа по всей серии'
  if (seconds < 3) return 'медианное время до начала ответа по всей серии · ответ обычно начинается почти сразу'
  if (seconds < 6) return 'медианное время до начала ответа по всей серии · есть небольшая пауза'
  return 'медианное время до начала ответа по всей серии · пока есть заметная пауза'
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
    const first = scoreMeaning(firstValue)
    const last = scoreMeaning(lastValue)
    const strength = describeStrength(strengthValue)

    const firstLabel = firstCard.querySelector('small')
    const firstStrong = firstCard.querySelector('strong')
    if (firstLabel) firstLabel.textContent = '1-й пример · точность конструкции'
    if (firstStrong) firstStrong.textContent = `${firstValue} · ${first[1]}`
    addNote(firstCard, `${first[0]}. Шкала: 0 = нет, 1 = частично, 2 = полностью.`)

    const lastLabel = lastCard.querySelector('small')
    const lastStrong = lastCard.querySelector('strong')
    if (lastLabel) lastLabel.textContent = '10-й пример · точность конструкции'
    if (lastStrong) lastStrong.textContent = `${lastValue} · ${last[1]}`
    addNote(lastCard, `${last[0]}. Это тот же показатель, что и в первом примере.`)

    const latencyLabel = latencyCard.querySelector('small')
    if (latencyLabel) latencyLabel.textContent = 'Скорость извлечения'
    addNote(latencyCard, describeLatency(latencyValue))

    const strengthLabel = strengthCard.querySelector('small')
    const strengthStrong = strengthCard.querySelector('strong')
    if (strengthLabel) strengthLabel.textContent = 'Итог по всей серии'
    if (strengthStrong) strengthStrong.textContent = strength[0]
    addNote(strengthCard, `${strength[1]}. Внутренняя шкала ${strengthValue}; она учитывает всю серию и сильнее — последние примеры.`)

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
      summary.innerHTML = `<strong style="display:block;color:white;margin-bottom:6px">Что именно сравниваем</strong><span>В первом и десятом примере измеряется одно и то же: появилась ли <b style="color:white">целевая конструкция</b> в ответе. Начало серии: <b style="color:white">${firstValue}</b> — ${first[0]}. Конец серии: <b style="color:white">${lastValue}</b> — ${last[0]}. Скорость извлечения по всей серии: <b style="color:white">${latencyValue}</b>.</span>`
      grid.insertAdjacentElement('afterend', summary)
    }

    const paragraphs = Array.from(document.querySelectorAll('p')) as HTMLElement[]
    const repeat = paragraphs.find((p) => p.textContent?.trim().startsWith('Следующий повтор:'))
    if (repeat) {
      const raw = repeat.textContent || ''
      const date = raw.replace(/^Следующий повтор:\s*/, '').split('. Это')[0].trim()
      repeat.textContent = date
        ? `Повторить ${date}: не чтобы заново учить правило, а чтобы проверить, всплывает ли конструкция позже без подсказки.`
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
