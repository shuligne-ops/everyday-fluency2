const { test } = require('node:test')
const assert = require('node:assert/strict')
const { parseEvaluation, technical, decision, metrics, schedule, intervals } = require('../work/v7-tests/retrieval-lab-v7/domain.js')
const { library, sessionTasks, reviewTask } = require('../work/v7-tests/retrieval-lab-v7/tasks.js')
const { transcribeAudio } = require('../work/v7-tests/retrieval-lab-v7/voice.js')
const good = () => ({ communication: 'ok', target: 'correct', language: 'ok', naturalness: 'natural', errors: [], corrected_utterance: 'I used to ride my bike to work.', note_ru: 'Смысл передан.' })
const error = (inside = false) => ({ span: 'a', correction: 'the', severity: 'minor', target_relevance: inside ? 'inside_target' : 'off_target', message_ru: 'Небольшая правка.' })
const record = (result, overrides = {}) => ({ taskId: 'used_to:s:2', targetId: 'used_to', phase: 'visible', targetVisible: true, cueType: 'dialogue', answer: '', originalTranscript: '', transcriptEdited: false, retry: 0, firstAttempt: true, timestamp: new Date().toISOString(), result, ...overrides })

test('1. Good paraphrase: judge result is accepted without string matching', () => { assert.equal(decision(parseEvaluation(good()), true), 'accept') })
test('2. Target present but reversed meaning requires retry', () => { assert.equal(decision({ ...good(), communication: 'wrong' }, true), 'retry') })
test('3. Hidden natural alternative accepts communication without forced target', () => { assert.equal(decision({ ...good(), target: 'not_used' }, false), 'note') })
test('4. Minor article error outside target accepts with note', () => { assert.equal(decision(parseEvaluation({ ...good(), language: 'minor', errors: [error()] }), true), 'note') })
test('5. Error breaking target form requires retry even if severity minor', () => { assert.equal(decision({ ...good(), target: 'incorrect', language: 'minor', errors: [error(true)] }, true), 'retry'); assert.equal(decision({ ...good(), language: 'blocking' }, false), 'retry') })
test('6. Contextual there / it / one remain valid: no lexical gate', () => { for (const answer of ['They used to live there.', "I've already done it.", 'I used to own one.']) assert.equal(decision(parseEvaluation({ ...good(), corrected_utterance: answer }), true), 'accept') })
test('7. Malformed AI JSON becomes technical uncertainty; no positive score', () => { for (const value of ['{bad', '```json\n{}\n```', { ...good(), extra: true }, { ...good(), errors: [{}] }, { ...good(), errors: [error()] }]) { assert.equal(parseEvaluation(value), null); const m = metrics([record(technical())]); assert.equal(m.meaning, 0); assert.equal(m.visible, 0); assert.equal(m.technical, 1) } })
test('8. String false can never be coerced into true', () => { assert.equal(parseEvaluation({ ...good(), communication: 'false' }), null); assert.equal(parseEvaluation({ meaning_ok: 'false', target_ok: 'false' }), null) })
test('9. STT failure never sends an English evaluation request', async () => { const original = global.fetch; const urls = []; global.fetch = async url => { urls.push(url); return { ok: false } }; try { await assert.rejects(() => transcribeAudio(new Blob(['audio'], { type: 'audio/webm' }))); assert.deepEqual(urls, ['/api/retrieval-lab-v6-stt']) } finally { global.fetch = original } })
test('10. Successful retry preserves wrong first-attempt metric; flow and queue invariants', () => {
  const m = metrics([record({ ...good(), communication: 'wrong' }), record(good(), { firstAttempt: false, retry: 1, phase: 'learning' })])
  assert.equal(m.meaning, 0); assert.equal(m.visible, 0); assert.equal(m.total, 1)
  for (const p of library) { const tasks = sessionTasks(p.id); assert.equal(tasks.length, 9); assert.equal(new Set(tasks.map(t => t.cueType)).size, 3); assert.deepEqual(tasks.filter(t => t.phase === 'hidden').map(t => tasks.indexOf(t)), [0, 7, 8]); for (let i = 0; i < 4; i++) assert.ok(!tasks.some(t => t.cue === reviewTask(p.id, i).cue)) }
  let due
  for (const days of intervals) { due = schedule(due, 'used_to', true, 0); assert.equal(due.dueAt, days * 86400000) }
  assert.equal(schedule(due, 'used_to', false, 0).stage, 0)
})
