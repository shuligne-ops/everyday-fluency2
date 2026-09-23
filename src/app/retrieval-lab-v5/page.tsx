import Link from 'next/link'
import type { CSSProperties } from 'react'

export const metadata = {
  title: 'Retrieval Lab V5 — сравнение',
  description: 'Две экспериментальные архитектуры тренажёра',
}

const box: CSSProperties = {
  background: '#fff',
  border: '1px solid #e8dece',
  borderRadius: 18,
  padding: 22,
}

export default function Page() {
  return (
    <main style={{ minHeight: '100vh', background: '#fff8ed', color: '#14213d', fontFamily: 'system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif' }}>
      <div style={{ maxWidth: 1050, margin: '0 auto', padding: '42px 22px 80px' }}>
        <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 1.3, textTransform: 'uppercase', color: '#f59e0b' }}>Everyday Fluency · V5 comparison</div>
        <h1 style={{ fontSize: 'clamp(42px,7vw,70px)', lineHeight: 1.03, margin: '10px 0 16px', color: '#101c3f' }}>Две версии одного тренировочного ядра.</h1>
        <p style={{ maxWidth: 850, color: '#68758d', fontSize: 19, lineHeight: 1.6 }}>
          Контент почти один и тот же: 30 конструкций A2–B2 из трёх разделов. Разница — в педагогической архитектуре. Пройди по 2–3 блока в каждой версии и сравни ощущение темпа, ясности и реального навыка.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 16, marginTop: 28 }}>
          <section style={box}>
            <div style={{ fontWeight: 900, color: '#f59e0b', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>Версия A · моя</div>
            <h2 style={{ color: '#101c3f', fontSize: 29, marginBottom: 8 }}>Visible target · 30 отдельных конструкций</h2>
            <p style={{ color: '#68758d', lineHeight: 1.55 }}>Формула всегда видна. Цель — быстро и правильно собирать разные фразы через заданный языковой инструмент. Реальная ошибка исправляется; максимум один обязательный повтор.</p>
            <ul style={{ color: '#334155', lineHeight: 1.7 }}>
              <li>10 времён/aspect</li>
              <li>10 модальных конструкций</li>
              <li>10 разговорных паттернов</li>
              <li>до 10 ситуаций на target</li>
            </ul>
            <Link href="/retrieval-lab-v5/ours" style={{ display: 'inline-block', marginTop: 10, background: '#f59e0b', color: '#101c3f', padding: '14px 18px', borderRadius: 12, fontWeight: 900, textDecoration: 'none' }}>Открыть версию A →</Link>
          </section>

          <section style={box}>
            <div style={{ fontWeight: 900, color: '#2563eb', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>Версия B · по логике коллеги</div>
            <h2 style={{ color: '#101c3f', fontSize: 29, marginBottom: 8 }}>Contrastive Activation Ladder</h2>
            <p style={{ color: '#68758d', lineHeight: 1.55 }}>Те же 30 targets собраны в 10 contrast sets. Target сначала скрыт, затем показывается, потом исчезает; дальше соседние конструкции смешиваются.</p>
            <ul style={{ color: '#334155', lineHeight: 1.7 }}>
              <li>cold probe без штрафа</li>
              <li>anchor + visible build</li>
              <li>fade</li>
              <li>contrast / выбор формы</li>
              <li>delayed hidden check</li>
            </ul>
            <Link href="/retrieval-lab-v5/colleague" style={{ display: 'inline-block', marginTop: 10, background: '#101c3f', color: '#fff', padding: '14px 18px', borderRadius: 12, fontWeight: 900, textDecoration: 'none' }}>Открыть версию B →</Link>
          </section>
        </div>
      </div>
    </main>
  )
}
