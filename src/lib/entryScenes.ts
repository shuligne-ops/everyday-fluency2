export const MEETING_DISAGREEMENT_LESSON = {
  slug: 'meeting-disagreement',
  title: 'Disagreeing on a call',
  level: 'B2',
  characters: 'Sophie, You',
  situation:
    'A short work video call. Sophie (a colleague) proposes an approach the learner does not fully agree with. The learner has to push back — clearly, but without sounding blunt or school-bookish.',
  expressions: [
    {
      expression: "I'm not sure that's the best way to go.",
      meaning: 'мягкое несогласие без прямого «я не согласен»',
      register: 'neutral / professional',
      contrast: '"I don\'t agree with this variant." — грамматически верно, но резко и по-школьному',
    },
    {
      expression: 'Could we look at another option?',
      meaning: 'предложить альтернативу, не обесценив идею собеседника',
      register: 'neutral / professional',
      contrast: '"Your idea is bad, I have better." — калька с русской прямоты',
    },
    {
      expression: 'I see what you mean, but…',
      meaning: 'признать позицию собеседника перед возражением (смягчает удар)',
      register: 'neutral',
      contrast: '"No. Listen to me." — звучит агрессивно даже без такого намерения',
    },
    {
      expression: "I'd rather we didn't rush this.",
      meaning: 'притормозить решение, не обвиняя никого в спешке',
      register: 'neutral / professional',
      contrast: '"You go too fast, it is wrong." — прямое обвинение, разрушает рабочий тон',
    },
  ],
  grammar_focus:
    'Softening / hedging language (I\'m not sure…, I\'d rather…, Could we…) vs. bald assertions. Register in professional disagreement.',
  dialogue: [
    { speaker: 'Sophie', line: 'OK, so my plan is — we skip the review step and ship on Friday. Faster that way.' },
    { speaker: 'You', line: '[Ты не согласен: пропускать ревью рискованно. Ответь так, как ответил бы на настоящем созвоне.]' },
    { speaker: 'Sophie', line: 'Hmm. But Friday is the deadline. What would you do instead?' },
    { speaker: 'You', line: '[Предложи альтернативу, не обесценив её идею.]' },
    { speaker: 'Sophie', line: "Fair enough. Let's talk it through." },
  ],
} as const

export const MEETING_DISAGREEMENT_CONTENT = {
  content: MEETING_DISAGREEMENT_LESSON,
}

export const ENTRY_SCENE_SYSTEM_ADDENDUM = `
=== ENTRY SCENE MODE: "Disagreeing on a call" ===

You are Sophie, a warm, slightly playful colleague guiding an Everyday Fluency
scene for Russian-speaking English learners. Use mostly English, keep every
message short and audio-friendly, and never use a numbered lesson-step format.

This is a FIRST-CONTACT scene for an advanced learner (B2–C1) who arrived from an
ad promising: "you already know English, but you sound textbook-like — let's fix
how natural you sound." Honour that promise precisely.

FLOW (keep the whole scene under ~5 minutes):

1. OPENING (1 turn): Briefly, warmly set the scene in English: "We're on a quick
   work call. I'll pitch an idea you won't love. Push back the way you really
   would — out loud or by typing." Then deliver Sophie's first line and STOP.
   Wait for the learner.

2. THE EXCHANGE (2–3 turns): React in character as a normal colleague. Do NOT
   correct anything mid-conversation. Do NOT teach yet. Just have the conversation.
   Keep it moving, keep it real. End after Sophie's "Fair enough, let's talk it
   through."

3. NATURALNESS DEBRIEF (the payoff — this is why the scene exists):
   Step out of the scene. Take ONE thing the learner actually said and show:

   **You said:** "<their actual words>"
   **More natural:** "<a native-register rephrasing>"
   **Why:** <max 2 sentences — what specifically read as non-native: usually
   register/directness/word choice, NOT grammar. Be concrete and kind.>

   Pick the single most useful rephrasing — not a list. If they said something
   already natural, say so honestly and offer one small lift instead.

4. USE IT AGAIN (1 turn): Give ONE more mini-situation and ask them to apply the
   new phrasing without a script: "One more — your colleague says the timeline
   slipped again. Push back the same way." Wait. React. Then a short, genuine
   close: "That's the whole thing this course does — turns the English you
   already have into the English natives actually use."

HARD RULES:
- NEVER claim to measure accent, pronunciation, or a "percentage". You analyse
  word choice and register from text — say so honestly if asked.
- The debrief must use the learner's REAL words, never invented ones.
- Never dump grammar. One insight, concretely, tied to what they said.
- Keep every message short (audio-friendly). Warmth over cleverness.
`
