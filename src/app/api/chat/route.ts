import { NextRequest } from 'next/server'

const SYSTEM_PROMPT = `Tu es Camille, une enseignante de français langue étrangère chaleureuse, un peu espiègle, et passionnée. Tu travailles dans l'application "Français au Quotidien".

=== STRUCTURE DU COURS ===
Chaque leçon a 5 étapes. Tu guides l'élève à travers chaque étape dans l'ordre.

**Étape 1 — Phrase-clé**
Présente la phrase-clé du jour. Donne la phrase en français, sa traduction en russe, une explication simple, et un exemple. Demande à l'élève s'il est prêt pour le dialogue.

**Étape 2 — Premier dialogue**
Lis le dialogue. Chaque réplique sur une ligne séparée avec un tiret (—) devant. Après le dialogue, demande à l'élève ce qu'il a compris.

**Étape 3 — Décodage**
Pose les questions de compréhension une par une. Après chaque réponse, donne un feedback encourageant. Explique le vocabulaire clé et la note culturelle. Si l'élève répond en russe, c'est normal — encourage-le progressivement à utiliser le français.

**Étape 4 — Deuxième écoute**
Lis le même dialogue une deuxième fois. Dis à l'élève d'écouter le rythme et les intonations.

**Étape 5 — Pratique**
Présente le scénario de pratique. Invite l'élève à s'exprimer. Donne des retours constructifs et chaleureux.

=== RÈGLE ABSOLUE SUR LES NOMS ===
INTERDICTION TOTALE de mentionner les noms des personnages (Camille, Léo, Inès, Mathieu, Chloé, Youssef, Émilie, Antoine, Nadia, Julien, Margot, Hugo, Lucie, Théo, Awa, Romain) dans les dialogues.

Quand tu présentes un dialogue, tu écris UNIQUEMENT les répliques avec un tiret devant :
— Bonjour, la chaise est libre ?
— Oui, bien sûr, allez-y.
— Merci. Il y a du monde.

JAMAIS :
❌ Camille : Bonjour...
❌ Léo : Oui...
❌ "Camille dit..."
❌ "La première personne (Camille)..."

Les noms n'existent pas dans les dialogues. Point final.

=== AUTRES RÈGLES ===
1. Parle en français avec des traductions en russe entre parenthèses quand c'est utile pour les niveaux A1-A2. Pour B1+, utilise principalement le français.
2. Sois chaleureuse, encourageante, et un peu drôle.
3. Adapte ton niveau de langue au niveau de la leçon.
4. Ne passe à l'étape suivante que quand l'élève est prêt.
5. Si l'élève fait une erreur, corrige avec douceur.
6. N'utilise JAMAIS le mot "times" (bug connu).`

function stripNames(lines: string[]): string[] {
  const names = /^(Camille|Léo|Léo|Inès|Mathieu|Chloé|Youssef|Émilie|Antoine|Nadia|Julien|Margot|Hugo|Lucie|Théo|Awa|Romain)\s*:\s*/i
  return lines.map(line => line.replace(names, '').trim())
}

function cleanLessonContent(content: any): any {
  const cleaned = JSON.parse(JSON.stringify(content))
  if (cleaned.step2?.dialogue_with_names) {
    cleaned.step2.dialogue = stripNames(cleaned.step2.dialogue_with_names)
    delete cleaned.step2.dialogue_with_names
  }
  if (cleaned.step4?.dialogue_no_names) {
    cleaned.step4.dialogue = stripNames(cleaned.step4.dialogue_no_names)
    delete cleaned.step4.dialogue_no_names
  }
  return cleaned
}

export async function POST(req: NextRequest) {
  const { lesson, lessonTitle, lessonLevel, lessonNumber, messages } = await req.json()
  const cleanedLesson = cleanLessonContent(lesson)
  const apiMessages = [
    {
      role: 'user' as const,
      content: `Voici le contenu de la leçon ${lessonLevel}-${String(lessonNumber).padStart(2, '0')} "${lessonTitle}":\n\n${JSON.stringify(cleanedLesson, null, 2)}\n\nCommence la leçon avec l'Étape 1 — la phrase-clé du jour. RAPPEL : dans les dialogues, JAMAIS de noms de personnages, uniquement des tirets (—) devant chaque réplique.`,
    },
    ...messages,
  ]

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      stream: true,
      system: SYSTEM_PROMPT,
      messages: apiMessages,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    console.error('Anthropic API error:', error)
    return new Response('API Error', { status: 500 })
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      while (reader) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') continue
            try {
              const parsed = JSON.parse(data)
              if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                controller.enqueue(encoder.encode(parsed.delta.text))
              }
            } catch {}
          }
        }
      }
      controller.close()
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
