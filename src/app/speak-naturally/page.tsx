'use client'

import { useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

function SpeakNaturallyContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const utms = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content']
    const data: Record<string, string> = {}
    utms.forEach((k) => {
      const v = searchParams.get(k)
      if (v) data[k] = v
    })
    data.entry = 'speak_naturally'
    try {
      data.first_seen_at = new Date().toISOString()
      localStorage.setItem('ef_attribution', JSON.stringify(data))
    } catch {}
  }, [searchParams])

  function startScene() {
    router.push('/?lesson=meeting-disagreement')
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #0a1628 0%, #0d1d35 100%)', color: '#f5f0e0', fontFamily: 'var(--font-sans, system-ui)' }}>
      <section style={{ maxWidth: '720px', margin: '0 auto', padding: '56px 20px 32px', textAlign: 'center' }}>
        <div style={{ display: 'inline-block', padding: '6px 14px', background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', borderRadius: '20px', fontSize: '13px', fontWeight: 600, marginBottom: '24px', letterSpacing: '0.5px' }}>EVERYDAY FLUENCY · ДЛЯ ТЕХ, КТО УЖЕ ГОВОРИТ</div>
        <h1 style={{ fontFamily: 'var(--font-display, Georgia, serif)', fontSize: 'clamp(30px, 6vw, 46px)', fontWeight: 700, lineHeight: 1.15, margin: '0 0 20px', color: '#f5f0e0' }}>Ты уже знаешь английский.<br /><span style={{ color: '#f59e0b' }}>Но говоришь на нём как по учебнику.</span></h1>
        <p style={{ fontSize: 'clamp(16px, 3vw, 19px)', lineHeight: 1.6, color: '#b8c5d6', maxWidth: '580px', margin: '0 auto 16px' }}>Грамматика правильная. Слова на месте. И всё равно на созвоне слышно, что ты не свой. Не потому что ошибаешься — потому что говоришь то, что <em>верно</em>, а не то, что сказал бы носитель.</p>
        <p style={{ fontSize: 'clamp(16px, 3vw, 19px)', lineHeight: 1.6, color: '#f5f0e0', maxWidth: '580px', margin: '0 auto 36px', fontWeight: 600 }}>Проверь это прямо сейчас — на одной реальной рабочей сцене.</p>
        <Cta onClick={startScene}>Пройти сцену «несогласие на созвоне» →</Cta>
        <p style={{ marginTop: '14px', fontSize: '13px', color: '#8896aa' }}>Одна сцена · 5 минут · бесплатно</p>
      </section>
      <section style={{ maxWidth: '640px', margin: '0 auto', padding: '28px 20px' }}>
        <Label>ВОТ КАК ЭТО ВЫГЛЯДИТ</Label>
        <GapRow context="Не согласиться с идеей коллеги на созвоне" school={'"I don\'t agree with this variant."'} schoolNote="Грамматически верно. Но звучит резко и по-школьному — носитель слышит «стоп, спор»." real={'"I\'m not sure that\'s the best way to go."'} realNote="То же несогласие — но мягко, профессионально, как говорят в реальном офисе." />
        <GapRow context="Объяснить, что задерживаешь задачу" school={'"I could not finish because I had many tasks."'} schoolNote="Понятно, но звучит как оправдание школьника у доски." real={'"I\'m a bit behind — I\'d rather get it right than rush it."'} realNote="Та же мысль — но как взрослый, который владеет ситуацией, а не извиняется." />
        <GapRow context="Закончить small talk и перейти к делу" school={'"OK. Now let\'s talk about our topic."'} schoolNote="Работает, но переход резкий — будто выключил вежливость рубильником." real={'"Anyway — shall we get into it?"'} realNote="Естественный шов между болтовнёй и делом. Носители делают это одной фразой." />
        <p style={{ textAlign: 'center', fontSize: '15px', color: '#b8c5d6', marginTop: '24px', fontStyle: 'italic', lineHeight: 1.6 }}>Разница не в словах, которых ты не знаешь.<br />Разница в том, <strong style={{ color: '#f59e0b', fontStyle: 'normal' }}>какие из знакомых слов выбирает носитель</strong> — и в каком регистре.</p>
      </section>
      <section style={{ maxWidth: '640px', margin: '0 auto', padding: '32px 20px' }}><div style={{ background: 'rgba(245, 240, 224, 0.04)', borderRadius: '16px', padding: '28px 24px', border: '1px solid rgba(245, 158, 11, 0.15)' }}><Label>ЧТО ПРОИЗОЙДЁТ В СЦЕНЕ</Label><Step n="1" text="Sophie — твой коллега на созвоне — предложит идею, с которой ты не согласен. Ты ответишь так, как ответил бы по-настоящему. Голосом или текстом." /><Step n="2" text="Никаких исправлений посреди разговора. Сначала ты просто говоришь — как в жизни." /><Step n="3" text="В конце — короткий разбор: что ты сказал, как это звучит для носителя, и как сказать естественнее. Одна фраза, которую можно забрать с собой." /><p style={{ fontSize: '14px', color: '#7a869a', marginTop: '20px', lineHeight: 1.6, borderTop: '1px solid rgba(245, 240, 224, 0.08)', paddingTop: '16px' }}>Мы не оцениваем твой акцент и не ставим проценты. Мы работаем с тем, что реально выдаёт неноситель — с выбором слов и регистром. Именно это слышно на созвоне.</p></div></section>
      <section style={{ maxWidth: '640px', margin: '0 auto', padding: '24px 20px' }}><Label>«А ЧЕМ ЭТО ЛУЧШЕ, ЧЕМ ПРОСТО ПОГОВОРИТЬ С ИИ?»</Label><div style={{ display: 'grid', gap: '10px' }}><ContrastRow them="Обычный голосовой ИИ болтает обо всём и правит хаотично" us="Sophie ведёт по сцене и разделяет разговор и разбор" /><ContrastRow them="Разговор закончился — и ничего не осталось" us="После сцены остаётся конкретная фраза, которую ты унёс" /><ContrastRow them="Сам придумываешь, о чём говорить" us="Ситуация и задача уже поставлены — как в жизни" /></div></section>
      <section style={{ maxWidth: '600px', margin: '0 auto', padding: '36px 20px 56px', textAlign: 'center' }}><h2 style={{ fontFamily: 'var(--font-display, Georgia, serif)', fontSize: '24px', fontWeight: 700, marginBottom: '12px', color: '#f5f0e0' }}>Одна сцена скажет о твоём английском больше,<br />чем тест на уровень</h2><p style={{ fontSize: '15px', color: '#b8c5d6', marginBottom: '28px', lineHeight: 1.5 }}>Пять минут. Без регистрации, чтобы начать.</p><Cta onClick={startScene}>Начать сцену →</Cta><p style={{ marginTop: '16px', fontSize: '13px', color: '#8896aa' }}>Если понравится — внутри ждут ещё 180 сцен по всем уровням.</p></section>
    </div>
  )
}

function Cta({ children, onClick }: { children: React.ReactNode; onClick: () => void }) { return <button onClick={onClick} style={{ background: '#f59e0b', color: '#0a1628', border: 'none', padding: '16px 40px', borderRadius: '12px', fontSize: '17px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 8px 24px rgba(245, 158, 11, 0.3)' }}>{children}</button> }
function Label({ children }: { children: React.ReactNode }) { return <p style={{ textAlign: 'center', color: '#8896aa', fontSize: '13px', letterSpacing: '1.5px', marginBottom: '24px' }}>{children}</p> }
function GapRow({ context, school, schoolNote, real, realNote }: { context: string; school: string; schoolNote: string; real: string; realNote: string }) { return <div style={{ background: 'rgba(245, 240, 224, 0.03)', borderRadius: '12px', padding: '18px 20px', marginBottom: '14px', border: '1px solid rgba(245, 240, 224, 0.06)' }}><p style={{ fontSize: '13px', color: '#8896aa', marginBottom: '14px', fontWeight: 600 }}>{context}</p><div style={{ marginBottom: '4px' }}><p style={{ fontSize: '11px', color: '#7a869a', letterSpacing: '1px', marginBottom: '4px' }}>ТЫ ГОВОРИШЬ</p><p style={{ fontSize: '17px', color: '#a8b5c8', fontStyle: 'italic', marginBottom: '4px' }}>{school}</p><p style={{ fontSize: '13px', color: '#7a869a', lineHeight: 1.5 }}>{schoolNote}</p></div><div style={{ height: '1px', background: 'rgba(245, 158, 11, 0.15)', margin: '14px 0' }} /><div><p style={{ fontSize: '11px', color: '#f59e0b', letterSpacing: '1px', marginBottom: '4px' }}>НОСИТЕЛЬ ГОВОРИТ</p><p style={{ fontSize: '19px', color: '#f5f0e0', fontWeight: 700, fontStyle: 'italic', marginBottom: '4px' }}>{real}</p><p style={{ fontSize: '13px', color: '#fcd34d', lineHeight: 1.5 }}>{realNote}</p></div></div> }
function Step({ n, text }: { n: string; text: string }) { return <div style={{ display: 'flex', gap: '14px', marginBottom: '16px' }}><div style={{ flexShrink: 0, width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 700 }}>{n}</div><p style={{ fontSize: '15px', color: '#d6dde8', lineHeight: 1.6, margin: 0 }}>{text}</p></div> }
function ContrastRow({ them, us }: { them: string; us: string }) { return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}><div style={{ background: 'rgba(245, 240, 224, 0.03)', borderRadius: '10px', padding: '12px 14px', fontSize: '13px', color: '#8896aa', lineHeight: 1.5 }}>{them}</div><div style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: '10px', padding: '12px 14px', fontSize: '13px', color: '#f5f0e0', lineHeight: 1.5 }}>{us}</div></div> }

export default function SpeakNaturallyPage() { return <Suspense fallback={<div style={{ minHeight: '100vh', background: '#0a1628' }} />}><SpeakNaturallyContent /></Suspense> }
