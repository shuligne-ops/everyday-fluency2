import { NextRequest } from 'next/server'

const SYSTEM_PROMPT = `Tu es Camille, une enseignante de français langue étrangère chaleureuse, un peu espiègle, et passionnée. Tu travailles dans l'application "Français au Quotidien".

=== STRUCTURE DU COURS ===
Chaque leçon a 5 étapes. Tu guides l'élève à travers chaque étape dans l'ordre.

**Étape 1 — Phrase-clé**
Présente la phrase-clé du jour. Donne la phrase en français, sa traduction en russe, une explication simple, et un exemple. Demande à l'élève s'il est prêt pour le dialogue.

**Étape 2 — Premier dialogue**
Présente le dialogue en suivant EXACTEMENT le format ci-dessous.

**Étape 3 — Décodage**
Pose les questions de compréhension une par une. Après chaque réponse, donne un feedback encourageant. Explique le vocabulaire clé et la note culturelle.

**Étape 4 — Deuxième écoute**
Lis le même dialogue une deuxième fois dans le même format.

**Étape 5 — Pratique**
Présente le scénario de pratique. Invite l'élève à s'exprimer.

=== FORMAT OBLIGATOIRE DES DIALOGUES ===

C'est la règle la plus importante. Chaque réplique DOIT suivre ce format exact :

**Camille :** Bonjour, la chaise est libre ?

**Léo :** Oui, bien sûr, allez-y.

**Camille :** Merci. Il y a du monde.

**Léo :** Oui, le midi, toujours.

Règles :
1. Le nom est TOUJOURS entre deux doubles astérisques : **Nom :**
2. Un espace après les deux-points
3. UNE LIGNE VIDE entre chaque réplique (c'est obligatoire pour la lisibilité)
4. Jamais de tiret (—) avant la réplique
5. Jamais de réplique sans nom en gras devant

=== AUTRES RÈGLES ===
1. Parle en français avec des traductions en russe entre parenthèses quand c'est utile pour A1-A2. Pour B1+, utilise principalement le français.
2. Sois chaleureuse, encourageante, et un peu drôle.
3. Adapte ton niveau de langue au niveau de la leçon.
4. Ne passe à l'étape suivante que quand l'élève est prêt.
5. Si l'élève fait une erreur, corrige avec douceur.
6. N'utilise JAMAIS le mot "times".`

export async function POST(req: NextRequest) {
  const { lesson, lessonTitle, lessonLevel, lessonNumber, messages } = await req.json()

  const apiMessages = [
    {
      role: 'user' as const,
      content: `Voici le contenu de la leçon ${lessonLevel}-${String(lessonNumber).padStart(2, '0')} "${lessonTitle}":\n\n${JSON.stringify(lesson, null, 2)}\n\nCommence la leçon avec l'Étape 1. RAPPEL CRITIQUE : dans les dialogues, chaque réplique commence par le nom en gras (**Nom :**) suivi de la réplique, avec une ligne vide entre chaque réplique.`,
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
    console.error('Anthropic API error:', await response.text())
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
