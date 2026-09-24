'use client'

import { useEffect } from 'react'

type RecallState = 'yes' | 'partial' | 'no'

function recallState(value: string): RecallState {
  if (value.startsWith('2/')) return 'yes'
  if (value.startsWith('1/')) return 'partial'
  return 'no'
}

function recallCopy(state: RecallState, end = false) {
  if (!end) {
    if (state === 'yes') return ['Да', 'В первом задании нужная конструкция пришла в голову без подсказки.']
    if (state === 'partial') return ['Почти', 'В первом задании ты вспомнил конструкцию не полностью — часть формы уже была доступна.']
    return ['Нет', 'В первом задании нужная конструкция сама не пришла в голову.']
  }

  if (state === 'yes') return ['Да', 'В последнем задании ты использовал нужную конструкцию сам, без подсказки.']
  if (state === 'partial') return ['Почти', 'В последнем задании конструкция уже всплыла, но форма ещё была неполной.']
  return ['Пока нет', 'В последнем задании конструкция всё ещё не появилась без подсказки.']
}

function describeStrength(value: string) {
  const n = Number(value.split('/')[0])
  if (n >= 5) return ['Очень уверенно', 'в серии конструкция стабильно появлялась в новых примерах']
  if (n >= 4) return ['Уверенно', 'в серии конструкция появлялась в большинстве новых примеров']
  if (n >= 3) return ['Неровно', 'в серии конструкция появлялась не каждый раз']
  if (n >= 2) return ['Пока слабо', 'нужны ещё повторения в разных контекстах']
  return ['Пока не закрепилось', 'конструкция всё ещё часто требует поддержки']
}

function describeLatency(value: string) {
  const seconds = Number.parseFloat(value.replace(',', '.'))
  if (!Number.isFinite(seconds)) return 'сколько обычно проходит от задания до начала ответа'
  if (seconds < 3) return 'в среднем ответ начинает формироваться почти сразу'
  if (seconds < 6) return 'перед ответом обычно есть небольшая пауза'
  return 'перед ответом пока обычно есть заметная пауза'
}

function addNote(card: HTMLElement, text: string) {
  let note = card.querySelector<HTMLElement>('[data-clarity-note]')
  if (!note) {
    note = document.createElement('span')
    note.dataset.clarityNote = 'true'
    note.style.fontSize = '13px'
    note.style.lineHeight = '1.45'
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
    const first = recallCopy(recallState(firstValue), false)
    const last = recallCopy(recallState(lastValue), true)
    const strength = describeStrength(strengthValue)

    const grid = firstCard.parentElement
    if (grid && !document.querySelector('[data-clarity-question]')) {
      const question = document.createElement('div')
      question.dataset.clarityQuestion = 'true'
      question.style.gridColumn = '1 / -1'
      question.style.marginBottom = '2px'
      question.style.color = '#e2e8f0'
      question.style.fontSize = '17px'
      question.style.lineHeight = '1.5'
      question.innerHTML = '<strong style="color:white">Главный вопрос:</strong> приходит ли нужная конструкция в голову сама, без подсказки?'
      grid.insertBefore(question, grid.firstChild)
    }

    const firstLabel = firstCard.querySelector('small')
    const firstStrong = firstCard.querySelector('strong')
    if (firstLabel) firstLabel.textContent = 'До тренировки · вспомнил сам?'
    if (firstStrong) firstStrong.textContent = first[0]
    addNote(firstCard, first[1])

    const lastLabel = lastCard.querySelector('small')
    const lastStrong = lastCard.querySelector('strong')
    if (lastLabel) lastLabel.textContent = 'После 10 примеров · всплывает сама?'
    if (lastStrong) lastStrong.textContent = last[0]
    addNote(lastCard, last[1])

    const latencyLabel = latencyCard.querySelector('small')
    if (latencyLabel) latencyLabel.textContent = 'Как быстро начинается ответ'
    addNote(latencyCard, describeLatency(latencyValue))

    const strengthLabel = strengthCard.querySelector('small')
    const strengthStrong = strengthCard.querySelector('strong')
    if (strengthLabel) strengthLabel.textContent = 'Как держалась конструкция по всей серии'
    if (strengthStrong) strengthStrong.textContent = strength[0]
    addNote(strengthCard, strength[1])

    firstCard.dataset.clarityDone = 'true'
    lastCard.dataset.clarityDone = 'true'
    latencyCard.dataset.clarityDone = 'true'
    strengthCard.dataset.clarityDone = 'true'

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
      summary.innerHTML = `<strong style="display:block;color:white;margin-bottom:6px">Итог простыми словами</strong><span>${first[1]} ${last[1]} ${describeLatency(latencyValue)}. ${strength[1]}.</span>`
      grid.insertAdjacentElement('afterend', summary)
    }

    const paragraphs = Array.from(document.querySelectorAll('p')) as HTMLElement[]
    const repeat = paragraphs.find((p) => p.textContent?.trim().startsWith('Следующий повтор:'))
    if (repeat) {
      const raw = repeat.textContent || ''
      const date = raw.replace(/^Следующий повтор:\s*/, '').split('. Это')[0].trim()
      repeat.textContent = date
        ? `Повторить ${date}: проверить, придёт ли эта конструкция в голову сама спустя время.`
        : 'Следующий повтор нужен, чтобы проверить, сохранится ли конструкция без подсказки.'
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
