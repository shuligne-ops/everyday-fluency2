# Retrieval Lab — UX principles

These principles are the design baseline for future Retrieval Lab versions and for any outsourced UI pass.

1. **The interface must feel friendly, calm and pleasant to stay in.** It should not look like a developer prototype, admin panel or exam system.
2. **Comfort matters as much as correctness.** Visual rhythm, spacing, typography and hierarchy should reduce tension and make repeated practice feel easy.
3. **Voice is a compact control, not the visual hero.** The “Ответить голосом” button should be about 44–56 px high, never a giant vertical slab. Its size must remain stable across states.
4. **Microphone state is always obvious.** Use clear states: “Подключаю микрофон…” → “Слушаю — говори”. Change color immediately when listening starts.
5. **Transcript is always visible after speaking.** The learner must see exactly what the system heard, so STT errors are distinguishable from learner errors.
6. **Fast feedback is part of UX.** Normal responses should feel near-instant; long AI evaluation must not break practice rhythm. Prefer a fast deterministic layer and use deeper evaluation only when needed.
7. **One main action per screen.** Avoid oversized controls, competing CTAs and technical jargon.
8. **No internal pedagogy jargon in the UI.** Terms such as retrieval, delayed probe, transfer, cold probe, latency should stay in code/analytics unless translated into plain learner language.
9. **Cards and controls should look clickable.** Compact height, obvious affordance, hover/focus state, sensible density. Several choices should fit on one screen when possible.
10. **Feedback should be concise and humane.** Typical visible outcomes: “Принято”, “Принято. Небольшая правка…”, “Исправь вот это и повтори”, “Не уверена, что правильно расслышала”.
11. **Do not punish natural variation.** Alternative wording, synonyms, anaphora and ellipsis should not trigger correction merely for differing from the model answer.
12. **Real language errors should be corrected clearly.** Show the exact problem, a minimal correction and, when pedagogically justified, one retry.
13. **Target visibility and task expectations must be explicit.** In direct-training mode, show the construction before the learner answers; do not force them to guess the pedagogical target.
14. **A polished design pass is required before production.** If necessary, hand the interface to a dedicated design/UI tool or designer, but preserve these interaction rules.
15. **Speech endpointing must tolerate a normal breath and short hesitation.** Do not submit on the first short silence or first final ASR chunk. Keep listening for roughly **2–3 seconds after the last detected speech** before treating the utterance as finished. A brief pause for breathing must not trigger evaluation. The learner should also be able to end the turn manually when desired.

## Acceptance test

A first-time learner should understand within a few seconds:
- what to say,
- whether the microphone is ready,
- what the system heard,
- whether the answer was accepted,
- what exactly needs correction,
- and what to do next.

The page should feel inviting enough that a user is willing to spend 10–20 minutes practicing without visual fatigue or friction.
