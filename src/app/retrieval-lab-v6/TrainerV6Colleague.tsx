'use client'

import { useRef, useState } from 'react'
import type { Pattern } from '../retrieval-lab/retrievalTypes'
import { CONTRAST_SETS, getPattern, type ContrastSet } from '../retrieval-lab-v5/contrastSets'

type ErrorItem = {
  span?: string
  correction?: string
  severity?: 'minor' | 'important' | 'blocking'
  target_relevance?: 'inside_target' | 'off_target'
  message_ru?: string
}

type JudgeResult = {
  meaning_ok: boolean
  target_ok: boolean
  language_ok: boolean
  naturalness: 'natural' | 'acceptable' | 'marked' | 'unacceptable'
  errors: ErrorItem[]
  corrected_utterance?: string
  evaluator_available: boolean
}

type Phase = 'first' | 'anchor' | 'build' | 'fade' | 'contrast' | 'final'

type Step = {
  pattern: Pattern
  drillIndex: number
  phase: Phase
  showTarget: boolean
  candidatePatterns?: Pattern[]
  anchorExample?: string
  selectionStep?: boolean
}

type RecordItem = {
  stepIndex: number
  retryCount: number
  meaningOk: boolean
  targetOk: boolean
  languageOk: boolean
  selectionStep: boolean
}

type Feedback = {
  kind: 'accept' | 'note' | 'retry' | 'technical'
  title: string
  body: string
  correction?: string
  retryRequired?: boolean
}

type VoiceState = 'idle' | 'requesting' | 'listening' | 'transcribing'

const SILENCE_MS = 1800
const VOICE_THRESHOLD = 0.025

const css = `
:root{--ink:#12203f;--muted:#68758a;--cream:#fffaf1;--paper:#fffdf8;--amber:#f3a313;--blue:#2d6cdf;--green:#17824a;--red:#b42318;--line:#e8dfd2;--shadow:0 12px 35px rgba(31,42,68,.07)}*{box-sizing:border-box}.lab{min-height:100vh;background:radial-gradient(circle at 10% 0%,#fff4d9 0,transparent 32%),linear-gradient(180deg,#fffaf2 0%,#fffdf9 100%);color:var(--ink);font-family:Inter,ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif}.wrap{max-width:980px;margin:0 auto;padding:26px 20px 70px}.hero{padding:14px 0 8px}.eyebrow{font-size:12px;font-weight:900;letter-spacing:1.25px;text-transform:uppercase;color:#cc7900}.hero h1{font-size:clamp(38px,6.5vw,66px);line-height:1.02;margin:8px 0 12px;letter-spacing:-1.4px}.lead{max-width:800px;color:var(--muted);font-size:18px;line-height:1.55;margin:0}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;margin-top:24px}.card{appearance:none;text-align:left;background:rgba(255,255,255,.92);border:1px solid var(--line);border-radius:18px;padding:17px;min-height:132px;cursor:pointer;box-shadow:0 3px 12px rgba(30,40,65,.035);transition:.16s ease}.card:hover,.card:focus-visible{transform:translateY(-2px);box-shadow:var(--shadow);outline:none;border-color:#d9c9ab}.chip{display:inline-flex;align-items:center;font-size:11px;font-weight:900;background:#edf3ff;padding:5px 9px;border-radius:999px}.card strong{display:block;font-size:18px;margin-top:10px}.small{font-size:13px;line-height:1.45;color:var(--muted)}.card .small{margin-top:6px}.top{display:flex;align-items:center;justify-content:space-between;gap:12px}.btn{font:inherit;font-weight:800;border:0;cursor:pointer;height:50px;min-height:50px;padding:0 17px;border-radius:14px;display:inline-flex;align-items:center;justify-content:center;gap:8px;white-space:nowrap}.btn.primary{background:var(--amber);color:var(--ink)}.btn.voice{background:var(--ink);color:#fff}.btn.voice.live{background:var(--green)}.btn.ghost{background:#fff;border:1px solid var(--line);color:var(--muted)}.btn:disabled{opacity:.5;cursor:default}.badge{font-size:13px;font-weight:900;background:#edf3ff;padding:8px 12px;border-radius:999px}.progress{height:7px;border-radius:999px;background:#eae2d5;margin:20px 0 28px;overflow:hidden}.progress span{display:block;height:100%;background:linear-gradient(90deg,#f7a612,#ffbd3b);transition:width .25s}.stage{font-size:12px;letter-spacing:1.2px;text-transform:uppercase;font-weight:900;color:#c97800}.cue{font-size:clamp(21px,4vw,29px);line-height:1.35;color:#747f92;margin-top:17px}.prompt{font-size:clamp(32px,6vw,55px);line-height:1.03;letter-spacing:-1.1px;margin:9px 0 22px}.target{background:linear-gradient(135deg,#fff6dc,#fff2c9);border:1px solid #f2d079;border-radius:19px;padding:18px 20px;margin:12px 0}.target b{font-size:17px}.mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}.target .mono{font-size:21px;margin:9px 0 5px}.candidates{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.candidate{background:#fff;border:1px solid #ead59d;border-radius:999px;padding:7px 10px;font-size:13px}.transcript{background:#f2f6ff;border:1px solid #c8d8ff;border-left:5px solid var(--blue);border-radius:19px;padding:18px 20px;margin-top:15px;min-height:108px}.transcript b{font-size:16px}.heard{font-size:21px;line-height:1.45;margin-top:8px}.placeholder{font-size:16px;line-height:1.5;color:#8590a4;margin-top:8px}.actions{display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin-top:14px}.status{font-size:14px;font-weight:750;color:var(--muted);margin-top:9px}.processing{background:#fff;border:1px solid var(--line);border-radius:17px;padding:16px 18px;margin-top:14px}.spinner{display:inline-block;width:16px;height:16px;border:2px solid #d9dfe9;border-top-color:var(--blue);border-radius:50%;animation:spin .7s linear infinite;vertical-align:-3px;margin-right:8px}@keyframes spin{to{transform:rotate(360deg)}}.feedback{background:#fff;border:1px solid var(--line);border-radius:19px;padding:18px 20px;margin-top:14px}.feedback.accept{border-left:5px solid var(--green);background:linear-gradient(90deg,#ecf8f0,#fff 28%)}.feedback.note{border-left:5px solid var(--blue)}.feedback.retry{border-left:5px solid var(--amber)}.feedback.technical{border-left:5px solid var(--red)}.feedback h3{font-size:22px;margin:0 0 6px}.models{background:#fff7de;border:1px solid #f2d17d;border-radius:17px;padding:16px 18px;margin-top:12px}.model{font-size:18px;line-height:1.45;margin-top:6px}.typing{margin-top:13px}.typing textarea{width:100%;min-height:105px;border:1px solid #d9d4cc;border-radius:14px;padding:13px;font:inherit;font-size:17px;background:#fff;resize:vertical}.dark{min-height:100vh;background:linear-gradient(160deg,#101d42,#172c61);color:white}.dark .wrap{max-width:800px}.dark h1{font-size:clamp(38px,7vw,64px);margin:10px 0 22px}.score{border:1px solid rgba(255,255,255,.14);border-radius:22px;background:rgba(255,255,255,.045);overflow:hidden}.row{display:flex;justify-content:space-between;gap:18px;padding:18px 20px;border-bottom:1px solid rgba(255,255,255,.11)}.row:last-child{border-bottom:0}.row strong{font-size:25px}.desc{font-size:13px;color:#cbd5e1;line-height:1.4;margin-top:4px}.summary{margin-top:15px;border:1px solid rgba(255,255,255,.14);border-radius:18px;padding:17px;color:#dce5f4;line-height:1.55}@media(max-width:640px){.wrap{padding:20px 16px 54px}.hero h1{font-size:39px}.lead{font-size:16px}.grid{grid-template-columns:1fr}.card{min-height:112px;padding:14px;border-radius:15px}.prompt{font-size:40px}.cue{font-size:22px}.target,.transcript,.feedback{padding:15px 16px;border-radius:16px}.target .mono{font-size:19px}.heard{font-size:19px}.btn{height:48px;min-height:48px;padding:0 14px;border-radius:13px}.row{padding:16px}.row strong{font-size:22px}}
`

function clean(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function norm(value: string) {
  return value.toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z0-9' ]/g, ' ').replace(/\s+/g, ' ').trim()
}

function buildSteps(set: ContrastSet): Step[] {
  const [a,b,c] = set.patternIds.map(getPattern)
  const candidates = [a,b,c]
  return [
    { pattern:a, drillIndex:0, phase:'first', showTarget:false, selectionStep:true },
    { pattern:a, drillIndex:1, phase:'anchor', showTarget:true, anchorExample:a.drills[0].models[0] },
    { pattern:a, drillIndex:2, phase:'build', showTarget:true },
    { pattern:a, drillIndex:3, phase:'fade', showTarget:false, selectionStep:true },
    { pattern:b, drillIndex:0, phase:'contrast', showTarget:false, selectionStep:true, candidatePatterns:candidates },
    { pattern:c, drillIndex:0, phase:'contrast', showTarget:false, selectionStep:true, candidatePatterns:candidates },
    { pattern:b, drillIndex:1, phase:'contrast', showTarget:false, selectionStep:true, candidatePatterns:candidates },
    { pattern:a, drillIndex:4, phase:'final', showTarget:false, selectionStep:true },
  ]
}

function phaseLabel(phase: Phase) {
  if (phase==='first') return 'Сначала попробуй сам'
  if (phase==='anchor') return 'Связываем форму со смыслом'
  if (phase==='build') return 'Собираем фразу с опорой'
  if (phase==='fade') return 'Теперь без видимой формулы'
  if (phase==='contrast') return 'Выбери подходящую форму'
  return 'Последняя проверка без подсказки'
}

function parseJudge(text: string): JudgeResult | null {
  try {
    const stripped = text.replace(/```json/gi,'').replace(/```/g,'').trim()
    const start = stripped.indexOf('{')
    const end = stripped.lastIndexOf('}')
    if (start < 0 || end < start) return null
    const data = JSON.parse(stripped.slice(start,end+1))
    return {
      meaning_ok:Boolean(data.meaning_ok),
      target_ok:Boolean(data.target_ok),
      language_ok:Boolean(data.language_ok),
      naturalness:['natural','acceptable','marked','unacceptable'].includes(data.naturalness)?data.naturalness:'acceptable',
      errors:Array.isArray(data.errors)?data.errors:[],
      corrected_utterance:typeof data.corrected_utterance==='string'?data.corrected_utterance:'',
      evaluator_available:true,
    }
  } catch { return null }
}

async function evaluate(pattern: Pattern, cue: string, models: string[], answer: string): Promise<JudgeResult> {
  const n = norm(answer)
  if (models.some((m)=>norm(m)===n)) return { meaning_ok:true,target_ok:true,language_ok:true,naturalness:'natural',errors:[],evaluator_available:true }
  const system = `You are a strict but fair evaluator of spoken English. Return JSON only. Check independently: meaning, requested target structure, and real English correctness. A wrong negation or reversed meaning fails meaning_ok. Accept natural synonyms, pronouns, anaphora, ellipsis and rephrasing. Never reject a correct sentence merely because it differs from the model. If there is a real grammar/lexical error, explain it briefly in Russian. Return exactly: {"meaning_ok":true,"target_ok":true,"language_ok":true,"naturalness":"natural|acceptable|marked|unacceptable","errors":[{"span":"...","correction":"...","severity":"minor|important|blocking","target_relevance":"inside_target|off_target","message_ru":"..."}],"corrected_utterance":"..."}`
  const user = `TASK: ${cue}\nTARGET: ${pattern.form}\nFUNCTION: ${pattern.meaning}\nGOOD EXAMPLES: ${models.join(' | ')}\nANSWER: ${answer}`
  try {
    const res = await fetch('/api/retrieval-lab-v6-eval',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({system,user})})
    if(!res.ok) throw new Error('eval failed')
    const data = await res.json()
    const parsed = parseJudge(String(data.text||''))
    if(parsed) return parsed
  } catch {}
  return {meaning_ok:false,target_ok:false,language_ok:false,naturalness:'acceptable',errors:[],evaluator_available:false}
}

function severity(errors: ErrorItem[]) {
  if (errors.some((e)=>e.severity==='blocking')) return 'blocking'
  if (errors.some((e)=>e.severity==='important')) return 'important'
  if (errors.some((e)=>e.severity==='minor')) return 'minor'
  return null
}

export default function TrainerV6Colleague() {
  const [set,setSet] = useState<ContrastSet|null>(null)
  const [steps,setSteps] = useState<Step[]>([])
  const [stepIndex,setStepIndex] = useState(0)
  const [retryCount,setRetryCount] = useState(0)
  const [records,setRecords] = useState<RecordItem[]>([])
  const [feedback,setFeedback] = useState<Feedback|null>(null)
  const [transcript,setTranscript] = useState('')
  const [voiceState,setVoiceState] = useState<VoiceState>('idle')
  const [checking,setChecking] = useState(false)
  const [voiceMessage,setVoiceMessage] = useState('')
  const [typing,setTyping] = useState(false)
  const [typed,setTyped] = useState('')
  const [reveal,setReveal] = useState(false)
  const [finished,setFinished] = useState(false)

  const recorderRef = useRef<MediaRecorder|null>(null)
  const streamRef = useRef<MediaStream|null>(null)
  const ctxRef = useRef<AudioContext|null>(null)
  const analyserRef = useRef<AnalyserNode|null>(null)
  const rafRef = useRef<number|null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const speechStartedRef = useRef(false)
  const lastVoiceAtRef = useRef(0)
  const stoppingRef = useRef(false)

  const currentStep = steps[stepIndex]
  const current = currentStep?.pattern.drills[currentStep.drillIndex]

  function releaseMedia(){if(rafRef.current!==null)cancelAnimationFrame(rafRef.current);rafRef.current=null;streamRef.current?.getTracks().forEach((t)=>t.stop());streamRef.current=null;try{void ctxRef.current?.close()}catch{}ctxRef.current=null;analyserRef.current=null}
  function resetVoice(){stoppingRef.current=true;try{if(recorderRef.current?.state==='recording')recorderRef.current.stop()}catch{}recorderRef.current=null;releaseMedia();chunksRef.current=[];speechStartedRef.current=false;lastVoiceAtRef.current=0;setVoiceState('idle');setVoiceMessage('')}
  function startSet(s:ContrastSet){resetVoice();setSet(s);setSteps(buildSteps(s));setStepIndex(0);setRetryCount(0);setRecords([]);setFeedback(null);setTranscript('');setTyped('');setTyping(false);setReveal(false);setFinished(false)}
  function toLibrary(){resetVoice();setSet(null);setSteps([]);setFinished(false);setFeedback(null);setTranscript('');setRecords([])}
  function next(){resetVoice();setFeedback(null);setTranscript('');setTyped('');setTyping(false);setRetryCount(0);setReveal(false);if(stepIndex>=steps.length-1)setFinished(true);else setStepIndex((n)=>n+1)}
  function retry(){resetVoice();setFeedback(null);setTranscript('');setTyped('');setTyping(false);setRetryCount((n)=>n+1);if(currentStep&&!currentStep.showTarget)setReveal(true)}

  function makeFeedback(j:JudgeResult,targetOk:boolean):Feedback{
    const err=j.errors[0]
    const correction=j.corrected_utterance||err?.correction||''
    const sev=severity(j.errors)
    if(!j.meaning_ok)return{kind:retryCount===0?'retry':'note',title:retryCount===0?'Поправим смысл':'Идём дальше',body:err?.message_ru||'Фраза пока не передаёт нужную мысль полностью.',correction,retryRequired:retryCount===0}
    const visible=currentStep?.phase==='anchor'||currentStep?.phase==='build'
    if(visible&&!targetOk)return{kind:retryCount===0?'retry':'note',title:retryCount===0?'Собери именно эту форму':'Идём дальше',body:`На этом шаге тренируем: ${currentStep?.pattern.form}.`,correction,retryRequired:retryCount===0}
    const inside=j.errors.some((e)=>e.target_relevance==='inside_target')
    if(!j.language_ok&&(sev==='blocking'||sev==='important'||inside))return{kind:retryCount===0?'retry':'note',title:retryCount===0?'Исправь это и повтори один раз':'Идём дальше',body:err?.message_ru||'Есть важная языковая ошибка.',correction,retryRequired:retryCount===0}
    if(!j.language_ok&&sev==='minor')return{kind:'note',title:'Принято. Небольшая правка',body:err?.message_ru||'Есть небольшая ошибка, но повторять всю реплику не нужно.',correction}
    if(currentStep?.selectionStep&&!targetOk)return{kind:'note',title:'Смысл передан',body:'Фраза работает, но именно эта конструкция сама не активировалась. Повторять нормальный английский только ради формы не нужно.'}
    return{kind:'accept',title:'Принято',body:currentStep?.selectionStep?'Смысл передан, и нужная форма появилась без показа.':'Смысл, форма и английский — всё в порядке.'}
  }

  async function judgeTranscript(raw:string){if(!currentStep||!current)return;const answer=clean(raw);if(!answer)return;setChecking(true);const structural=currentStep.pattern.full.test(answer);const j=await evaluate(currentStep.pattern,current.cue,current.models,answer);setChecking(false);if(!j.evaluator_available){setFeedback({kind:'technical',title:'Проверка не ответила',body:'Транскрипция сохранена. Можно проверить ещё раз — говорить заново не нужно. Этот ответ пока не засчитывается.'});return}const targetOk=structural||j.target_ok;const fb=makeFeedback(j,targetOk);setRecords((r)=>[...r,{stepIndex,retryCount,meaningOk:j.meaning_ok,targetOk,languageOk:j.language_ok,selectionStep:Boolean(currentStep.selectionStep)}]);setFeedback(fb)}

  async function transcribe(blob:Blob){setVoiceState('transcribing');setVoiceMessage('');const form=new FormData();form.append('audio',blob,blob.type.includes('webm')?'answer.webm':'answer.audio');try{const res=await fetch('/api/retrieval-lab-v6-stt',{method:'POST',body:form});if(!res.ok)throw new Error('stt');const data=await res.json();const text=clean(String(data.transcript||''));if(!text)throw new Error('empty');setTranscript(text);setVoiceState('idle');await judgeTranscript(text)}catch{setVoiceState('idle');setVoiceMessage('Не удалось распознать запись. Попробуй ещё раз или напечатай ответ.')}}

  function stopVoice(){const recorder=recorderRef.current;if(!recorder||recorder.state!=='recording'||stoppingRef.current)return;stoppingRef.current=true;setVoiceState('transcribing');if(rafRef.current!==null)cancelAnimationFrame(rafRef.current);rafRef.current=null;try{recorder.stop()}catch{}}

  async function startVoice(){if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined'){setVoiceMessage('Этот браузер не поддерживает запись голоса. Используй ввод текста.');setTyping(true);return}resetVoice();stoppingRef.current=false;setVoiceState('requesting');setVoiceMessage('');setTranscript('');setFeedback(null);try{const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});streamRef.current=stream;const mime=MediaRecorder.isTypeSupported('audio/webm;codecs=opus')?'audio/webm;codecs=opus':'';const recorder=mime?new MediaRecorder(stream,{mimeType:mime}):new MediaRecorder(stream);recorderRef.current=recorder;chunksRef.current=[];speechStartedRef.current=false;lastVoiceAtRef.current=0;recorder.ondataavailable=(e)=>{if(e.data.size)chunksRef.current.push(e.data)};recorder.onstop=()=>{const type=recorder.mimeType||'audio/webm';const blob=new Blob(chunksRef.current,{type});chunksRef.current=[];recorderRef.current=null;releaseMedia();if(blob.size>500)void transcribe(blob);else{setVoiceState('idle');setVoiceMessage('Запись получилась слишком короткой. Попробуй ещё раз.')}};const AudioCtx=window.AudioContext||(window as unknown as {webkitAudioContext:typeof AudioContext}).webkitAudioContext;const ctx=new AudioCtx();ctxRef.current=ctx;const source=ctx.createMediaStreamSource(stream);const analyser=ctx.createAnalyser();analyser.fftSize=1024;analyser.smoothingTimeConstant=.2;source.connect(analyser);analyserRef.current=analyser;const data=new Float32Array(analyser.fftSize);recorder.start(250);setVoiceState('listening');const watch=()=>{if(stoppingRef.current||!analyserRef.current)return;analyser.getFloatTimeDomainData(data);let sum=0;for(let i=0;i<data.length;i++)sum+=data[i]*data[i];const rms=Math.sqrt(sum/data.length);const now=performance.now();if(rms>VOICE_THRESHOLD){speechStartedRef.current=true;lastVoiceAtRef.current=now}else if(speechStartedRef.current&&now-lastVoiceAtRef.current>=SILENCE_MS){stopVoice();return}rafRef.current=requestAnimationFrame(watch)};rafRef.current=requestAnimationFrame(watch)}catch{releaseMedia();setVoiceState('idle');setVoiceMessage('Не удалось открыть микрофон. Проверь разрешение для сайта.')}}

  function recheck(){if(!transcript||checking)return;setFeedback(null);void judgeTranscript(transcript)}

  if(!set&&!finished)return <div className="lab"><style>{css}</style><div className="wrap"><div className="hero"><div className="eyebrow">Версия B · логика Ultra GPT</div><h1>10 наборов близких конструкций.</h1><p className="lead">Сначала пробуешь подобрать форму сам, затем получаешь опору, а после нескольких примеров она снова исчезает. Здесь отдельно тренируются правильное построение фразы и выбор конструкции по смыслу.</p></div><div className="grid">{CONTRAST_SETS.map((s)=><button className="card" key={s.id} onClick={()=>startSet(s)}><span className="chip">3 формы · 8 шагов</span><strong>{s.title}</strong><div className="small">{s.subtitle}</div></button>)}</div></div></div>

  if(finished&&set){const first=steps.map((_,i)=>records.find((r)=>r.stepIndex===i&&r.retryCount===0)).filter(Boolean) as RecordItem[];const checked=first.length;const denom=checked||1;const all=first.filter((r)=>r.meaningOk&&r.targetOk&&r.languageOk).length;const meaning=first.filter((r)=>r.meaningOk).length;const lang=first.filter((r)=>r.languageOk).length;const hidden=first.filter((r)=>r.selectionStep);const selected=hidden.filter((r)=>r.targetOk).length;return <div className="dark"><style>{css}</style><div className="wrap"><div className="eyebrow">Готово</div><h1>{set.title}</h1><div className="score"><div className="row"><div>Полностью с первого раза<div className="desc">смысл, нужная форма и английский сразу без исправления</div></div><strong>{all}/{denom}</strong></div><div className="row"><div>Смысл с первого раза<div className="desc">коммуникативная задача была выполнена сразу</div></div><strong>{meaning}/{denom}</strong></div><div className="row"><div>Без языковой ошибки с первого раза<div className="desc">первая фраза не требовала грамматической или лексической правки</div></div><strong>{lang}/{denom}</strong></div><div className="row"><div>Нужная форма выбрана без показа<div className="desc">в заданиях без готовой формулы конструкция активировалась сама</div></div><strong>{selected}/{hidden.length||1}</strong></div></div><div className="summary">Исправленный повтор не переписывает первую попытку. Отдельно видно: удалось ли выразить смысл и удалось ли самостоятельно выбрать нужный языковой инструмент.</div><div className="actions"><button className="btn primary" onClick={toLibrary}>Выбрать другой набор</button></div></div></div>}

  if(!currentStep||!current)return null
  const progress=((stepIndex+1)/steps.length)*100
  const busy=voiceState==='transcribing'||checking
  const showTarget=currentStep.showTarget||reveal
  const voiceLabel=voiceState==='requesting'?'Подключаю микрофон…':voiceState==='listening'?'■ Закончить':'🎙 Ответить голосом'

  return <div className="lab"><style>{css}</style><div className="wrap"><div className="top"><button className="btn ghost" onClick={toLibrary}>← Наборы</button><span className="badge">{stepIndex+1}/{steps.length}</span></div><div className="progress"><span style={{width:`${progress}%`}}/></div><div className="stage">{phaseLabel(currentStep.phase)}</div><div className="cue">{current.cue}</div><div className="prompt">Скажи это по-английски.</div>

  {currentStep.phase==='anchor'&&<div className="target"><b>Опора</b><div className="mono">{currentStep.pattern.form}</div><div className="small">Пример: {currentStep.anchorExample}</div></div>}
  {currentStep.phase==='build'&&<div className="target"><b>Используй в ответе</b><div className="mono">{currentStep.pattern.form}</div><div className="small">{currentStep.pattern.meaning}</div></div>}
  {currentStep.phase==='contrast'&&currentStep.candidatePatterns&&<div className="target"><b>Выбери форму по смыслу</b><div className="candidates">{currentStep.candidatePatterns.map((p)=><span className="candidate" key={p.id}>{p.form}</span>)}</div></div>}
  {!currentStep.showTarget&&!currentStep.candidatePatterns&&!reveal&&<div className="actions"><button className="btn ghost" onClick={()=>setReveal(true)}>Показать конструкцию</button></div>}
  {showTarget&&!currentStep.showTarget&&<div className="target"><b>Подсказка</b><div className="mono">{currentStep.pattern.form}</div></div>}

  <div className="transcript"><b>Что распознала система</b>{transcript?<div className="heard">“{transcript}”</div>:<div className="placeholder">{voiceState==='requesting'?'Открываю микрофон…':voiceState==='listening'?'Слушаю. Короткий вдох или пауза не завершат ответ.':voiceState==='transcribing'?'Распознаю запись…':'После ответа здесь появится транскрипция.'}</div>}</div>
  {voiceState==='transcribing'&&<div className="processing"><span className="spinner"/>Распознаю речь…</div>}
  {checking&&<div className="processing"><span className="spinner"/>Проверяю смысл и английский…</div>}

  {!busy&&feedback?<><div className={`feedback ${feedback.kind}`}><h3>{feedback.title}</h3><div>{feedback.body}</div>{feedback.correction&&<div style={{marginTop:9}}><b>Правильно:</b> {feedback.correction}</div>}</div>{feedback.kind==='technical'?<div className="actions"><button className="btn primary" onClick={recheck}>Проверить ещё раз</button><button className="btn ghost" onClick={next}>Продолжить без зачёта</button></div>:feedback.retryRequired?<div className="actions"><button className="btn primary" onClick={retry}>Исправить и сказать ещё раз</button></div>:<><div className="models"><b>Один хороший вариант</b><div className="model">{current.models[0]}</div></div><div className="actions"><button className="btn primary" onClick={next}>{stepIndex===steps.length-1?'Показать итог':'Дальше →'}</button><button className="btn ghost" onClick={retry}>Распознано неверно? Записать заново</button></div></>}
  </>:!busy?<><div className="actions"><button className={`btn voice ${voiceState==='listening'?'live':''}`} onClick={()=>voiceState==='listening'?stopVoice():void startVoice()} disabled={voiceState==='requesting'}>{voiceLabel}</button><button className="btn ghost" onClick={()=>setTyping((v)=>!v)}>Или напечатать</button></div>{voiceState==='listening'&&<div className="status">После последней речи ждём 1,8 секунды. Дальше всё происходит в тишине.</div>}{voiceMessage&&<div className="status">{voiceMessage}</div>}{typing&&<div className="typing"><textarea value={typed} onChange={(e)=>setTyped(e.target.value)} placeholder="Your answer…"/><div className="actions"><button className="btn primary" onClick={()=>{setTranscript(clean(typed));void judgeTranscript(typed)}}>Проверить</button></div></div>}</>:null}
  </div></div>
}
