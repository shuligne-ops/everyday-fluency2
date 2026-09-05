const NON_SPEAKER = new Set([
  'note','notes','tip','tips','grammar','grammar focus','vocabulary','vocab','step','task',
  'practice','example','examples','translation','answer','answers','question','questions',
  'hint','focus','warning','goal','context','situation','key phrase','cultural note',
  'remember','listen','repeat','next','level','lesson','http','https','pratique','expression',
  'expressions','meaning','register','tone','why','what','how',
])

// префикс говорящего никогда не начинается с местоимения, артикля или союза —
// именно это защищает обычную прозу вида "I told her: ..."
const NOT_A_NAME_START = new Set([
  'i','we','you','he','she','they','it','the','a','an','but','and','so','then','this',
  'that','there','here','my','his','her','our','their','one','two','first','second',
])

// 1–3 слова, первое с заглавной, опциональная (ремарка), затем двоеточие
// tsconfig target — es5 (не трогаем); флаг /u нужен для \p{Lu} и валиден в рантайме,
// просто tsc не даёт его использовать в regex-литерале при target < es6.
const SPEAKER_RE =
  // @ts-expect-error — regex flag 'u' requires target es6+, not touching tsconfig
  /^\s*(?:[-–—•]\s*)?((?:\p{Lu}[\p{L}'’.\-]{0,19})(?:\s+[\p{L}'’.\-]{1,20}){0,2})(\s*\([^)]{0,80}\))?\s*:[ \t]+(?=\S)/u

function matchSpeaker(line: string): string | null {
  const m = line.match(SPEAKER_RE)
  if (!m) return null
  const name = m[1].trim()
  if (name.length > 45) return null
  if (NOT_A_NAME_START.has(name.split(/\s+/)[0].toLowerCase())) return null
  if (NON_SPEAKER.has(name.toLowerCase())) return null
  const rest = line.slice(m[0].length)
  if (!rest.trim()) return null
  return rest
}

function stripMarkdown(t: string): string {
  t = t.replace(/```[\s\S]*?```/g, ' ')
  t = t.replace(/^#{1,6}[ \t]*/gm, '')
  t = t.replace(/\*{1,3}([^*\n]+)\*{1,3}/g, '$1')
  t = t.replace(/`([^`\n]+)`/g, '$1')
  t = t.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
  t = t.replace(/^[ \t]*[-–—_]{3,}[ \t]*$/gm, '')
  return t
}

export function cleanForTTS(text: string): string {
  let lines = text.split('\n')

  // ПРОХОД 1 — жирный префикс **Имя:** / **Имя (ремарка):** — это всегда говорящий
  const boldRe =
    // @ts-expect-error — regex flag 'u' requires target es6+, not touching tsconfig
    /^\s*(?:[-–—•]\s*)?\*{2,3}\s*([^*\n]{1,45}?)\s*:?\s*\*{2,3}\s*:?[ \t]*(?=\S)/u
  lines = lines.map((l) => {
    const m = l.match(boldRe)
    if (m && !NON_SPEAKER.has(m[1].trim().toLowerCase())) return l.slice(m[0].length)
    return l
  })

  let t = stripMarkdown(lines.join('\n'))

  // ПРОХОД 2 — plain "Имя: реплика", только если это похоже на диалог
  // (две и более подряд идущие строки с префиксом)
  const plain = t.split('\n')
  let run = 0
  let maxRun = 0
  for (const l of plain) {
    if (matchSpeaker(l) !== null) { run++; maxRun = Math.max(maxRun, run) }
    else if (l.trim()) run = 0
  }
  if (maxRun >= 2) t = plain.map((l) => matchSpeaker(l) ?? l).join('\n')

  // русский текст и остаточный мусор — как было
  t = t.replace(/\([^)]*[\u0400-\u04FF][^)]*\)/g, '')
  t = t.replace(/[\u0400-\u04FF][\u0400-\u04FF\s,.!?;:'"()-]*[.!?\n]/g, '')
  t = t.replace(/[\u0400-\u04FF]+/g, '')
  t = t.replace(/[*#_~`>|]/g, '')
  t = t.replace(/[ \t]{2,}/g, ' ')
  t = t.replace(/^[ \t]*[-–—][ \t]*$/gm, '')
  t = t.replace(/\n{3,}/g, '\n\n')
  return t.trim()
}
