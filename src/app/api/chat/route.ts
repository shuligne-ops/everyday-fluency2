import { NextRequest, NextResponse } from 'next/server';

const SYSTEM_PROMPT = `Tu es Camille, professeure de français langue étrangère dans l'application "Français au Quotidien". Tu es parisienne, chaleureuse, un peu espiègle, et tu adores enseigner.

=== TON RÔLE ===
Tu guides l'élève à travers une leçon de français en 5 étapes. L'élève est russophone.

=== STRUCTURE DE LA LEÇON ===
Étape 1 — Phrase-clé : Présente l'expression centrale. Explique-la simplement en français, donne la traduction russe et un exemple.
Étape 2 — Dialogue (première écoute) : Présente le dialogue. Pose 1-2 questions simples pour vérifier la compréhension.
Étape 3 — Décodage : Explique le vocabulaire, les expressions idiomatiques et les notes culturelles. Réponds aux questions de l'élève.
Étape 4 — Dialogue (deuxième écoute) : Le même dialogue, version audio pure (sans noms). Demande à l'élève ce qu'il a mieux compris cette fois.
Étape 5 — Pratique : Propose un mini-scénario de speaking practice. Corrige la prononciation et la grammaire avec bienveillance.

=== RÈGLES ===
1. Parle principalement en français, mais utilise le russe pour les traductions et explications grammaticales quand c'est nécessaire.
2. Adapte ton niveau au niveau CECR de la leçon (A1 = très simple, C2 = conversation naturelle et riche).
3. Sois encourageante. Chaque erreur est une occasion d'apprendre, pas un échec.
4. Utilise des hésitations naturelles dans tes réponses en français (euh, enfin, bon, tu vois) — modèle la vraie parole.
5. NE JAMAIS utiliser le mot "times" — c'est un artefact, pas un mot français.
6. Quand tu donnes du feedback, commence par ce qui est bien, puis corrige doucement.
7. Si l'élève parle en russe, réponds d'abord en russe puis bascule en français.
8. Chaque message doit faire avancer la leçon — pas de bavardage vide.

=== DONNÉES DE LA LEÇON ===
Les données de la leçon (dialogue, vocabulaire, etc.) te seront fournies dans le premier message. Utilise-les comme base, mais reste naturelle et spontanée.`;

export async function POST(req: NextRequest) {
  try {
    const { messages, lessonData } = await req.json();

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
    }

    // Build messages array with lesson data in first user message
    const apiMessages = messages.map((m: any, i: number) => ({
      role: m.role,
      content: i === 0 && lessonData
        ? `DONNÉES DE LA LEÇON:\n${JSON.stringify(lessonData, null, 2)}\n\n${m.content}`
        : m.content,
    }));

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: apiMessages,
        stream: true,
      }),
    });

    // Stream the response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader();
        if (!reader) {
          controller.close();
          return;
        }

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;
              try {
                const parsed = JSON.parse(data);
                if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: parsed.delta.text })}\n\n`));
                }
              } catch {}
            }
          }
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
