import { cleanForTTS } from '../src/lib/clean-for-tts.ts'

const cases = [
  // Имя должно исчезнуть
  { in: '**Sophie:** "I missed the bus this morning."', out: '"I missed the bus this morning."' },
  { in: '**Marie:** Again?', out: 'Again?' },
  { in: '**Mr Patel:** Good afternoon. How can I help?', out: 'Good afternoon. How can I help?' },
  { in: "**Anna's Mum:** Sit down, love.", out: 'Sit down, love.' },
  { in: '**Eleanor (email 1):** Dear Sophie, I am writing to confirm.', out: 'Dear Sophie, I am writing to confirm.' },
  { in: '**Sophie (text — typed, deleted, retyped):** Are you free later?', out: 'Are you free later?' },
  { in: '**Audience 2:** Could you clarify the second point?', out: 'Could you clarify the second point?' },
  { in: '**Þórir:** We say it differently up north.', out: 'We say it differently up north.' },
  { in: '**Narrator:** Three weeks passed.', out: 'Three weeks passed.' },
  { in: '- **Tom:** Are you coming or not?', out: 'Are you coming or not?' },
  {
    in: [
      'Bank clerk: Good morning, how can I help?',
      'Sophie: I need to open an account.',
      'Taxi driver: Where to?',
      'Stallholder: Two pounds a bag.',
    ].join('\n'),
    out: [
      'Good morning, how can I help?',
      'I need to open an account.',
      'Where to?',
      'Two pounds a bag.',
    ].join('\n'),
  },
  // Текст должен остаться нетронутым
  { in: 'London: a city of contrasts.', out: 'London: a city of contrasts.' },
  { in: 'I told her: it was never about the money.', out: 'I told her: it was never about the money.' },
  { in: 'Note: this expression is informal.', out: 'Note: this expression is informal.' },
  { in: 'Grammar focus: Present Perfect for recent events.', out: 'Grammar focus: Present Perfect for recent events.' },
  { in: '**Sophie:** I said: "no", and I meant it.', out: 'I said: "no", and I meant it.' },
]

let failed = 0

for (const c of cases) {
  const got = cleanForTTS(c.in)
  if (got !== c.out) {
    failed++
    console.error('FAIL')
    console.error('  input:    ' + JSON.stringify(c.in))
    console.error('  expected: ' + JSON.stringify(c.out))
    console.error('  got:      ' + JSON.stringify(got))
  }
}

if (failed > 0) {
  console.error(`\n${failed}/${cases.length} case(s) failed`)
  process.exit(1)
} else {
  console.log(`All ${cases.length} cases passed`)
}
