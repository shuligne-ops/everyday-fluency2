# Retrieval Lab V5 — known issues

## Critical: evaluator outage must never award a pass

Observed 2026-09-23 in V5 version A.

Example task: «Если бы я не пропустил поезд, я бы сейчас уже был дома.»
Target: `If + had + V3, would/could + V now`
Recognized learner answer: `If I hadn't missed the train, I wouldn't be at my place now.`

The answer contains the target structure but reverses the intended result meaning. The UI nevertheless showed «Принято» because the AI evaluator was unavailable and the client fallback checked only the target structure while defaulting `meaning_ok` and `language_ok` to true.

### Required rule

An unavailable semantic/language evaluator must NEVER produce a learner pass, mastery update, green success state, or positive metric.

Use a separate technical outcome instead:

- title: `Не удалось проверить ответ`
- do not classify the learner response as correct or incorrect
- do not update mastery or success metrics
- keep the recognized transcript visible
- primary action: `Проверить ещё раз` using the same transcript (no need to speak again)
- secondary action: `Продолжить без зачёта`
- if speech recognition itself is uncertain, offer `Записать заново`

The local structural recognizer may confirm only that the requested form appears; it must not infer semantic success or grammatical correctness.

### General invariant

`target structure detected` != `answer accepted`.

A scored pass requires reliable evaluation of at least target + meaning + language according to the exercise policy.
