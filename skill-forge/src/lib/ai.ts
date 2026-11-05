/**
 * Client AI su OpenRouter (gateway OpenAI-compatibile).
 * Base URL: https://openrouter.ai/api/v1
 * Auth: Bearer sk-or-v1-...
 *
 * Chiamiamo la REST API con la fetch nativa di Workers invece dell'SDK OpenAI:
 * su workerd l'SDK sceglie il runtime "node" (node-fetch + agentkeepalive) e
 * gli http.Agent non esistono, quindi ogni chiamata finisce in "Connection
 * error". La chiave resta solo lato server, mai nel bundle client.
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatResult {
  content: string;
  usage: unknown;
}

export async function chatCompletion(
  model: string,
  messages: ChatMessage[],
  temperature = 0.4,
  maxTokens?: number,
): Promise<ChatResult> {
  const base = (process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1').replace(/\/+$/, '');
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY ?? ''}`,
      // OpenRouter li usa per attribuire l'app nella dashboard.
      'HTTP-Referer':
        process.env.OPENROUTER_SITE_URL ?? 'https://github.com/ciao22king/redesigned-funicular',
      'X-Title': 'Skill Forge',
    },
    body: JSON.stringify({
      model,
      temperature,
      messages,
      ...(maxTokens ? { max_tokens: maxTokens } : {}),
    }),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
  }

  let data: { choices?: { message?: { content?: string } }[]; usage?: unknown };
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`risposta non JSON: ${text.slice(0, 200)}`);
  }

  return {
    content: data.choices?.[0]?.message?.content ?? '',
    usage: data.usage ?? null,
  };
}

/**
 * Modelli free di OpenRouter, dal più potente al meno.
 * Se un modello risponde con errore o risposta vuota, la generazione passa al
 * successivo. La lista si può sostituire con OPENROUTER_MODELS (id separati da
 * virgola) senza toccare il codice.
 */
export const MODELS: string[] = (
  process.env.OPENROUTER_MODELS ??
  [
    'nvidia/nemotron-3-ultra-550b-a55b:free', // 550B, il più grande
    'nvidia/nemotron-3.5-super-vl:free',
    'nvidia/nemotron-3.5-lightning:free',
    'dots-studio/dots-3-note-preview:free',
    'google/gemma-4-31b-it:free',
    'recursive/flint-v1.0:free',
    'google/gemma-4-26b-a4b-it:free',
    'xingchen-agi/xing4.0-29b-a4b:free',
    'cohere/north-mini-code:free',
    'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
    'liquid/lfm-2.5-2.6b:free', // il più piccolo, ultima spiaggia
  ].join(',')
)
  .split(',')
  .map((m) => m.trim())
  .filter(Boolean);

/** Primo modello della scala: usato come etichetta quando il fallback non parte. */
export const MODEL = MODELS[0];

export const SYSTEM_PROMPT = `Sei Skill Forge, un motore che trasforma materiale grezzo in skill complete per agenti AI.

Una "skill" è un documento Markdown operativo, scritto per essere eseguito da un agente. Deve contenere istruzioni verificabili, non consigli generici.

## Struttura obbligatoria dell'output

Produci SEMPRE un documento Markdown con questa struttura esatta, senza preamboli, senza commenti tuoi:

---
name: <slug-kebab-case>
description: <una frase, max 30 parole, che dice quando usare la skill>
---

# <Titolo della skill>

## Quando usarla
Trigger espliciti: frasi, contesti, richieste dell'utente che attivano la skill.

## Quando NON usarla
Casi limite, richieste che sembrano simili ma appartengono a un'altra skill.

## Prerequisiti
Strumenti, accessi, conoscenze necessari. Se non serve nulla, scrivi "Nessuno".

## Procedura
Passi numerati. Ogni passo deve essere azionabile e verificabile. Niente "considera di...".

## Regole e vincoli
Cosa è obbligatorio, cosa è vietato. Sii netto.

## Esempi

### Input
<un input realistico>

### Output atteso
<l'output corretto, concreto>

## Errori comuni
Cosa sbagliano tipicamente gli agenti su questo compito, e come evitarlo.

## Checklist finale
- [ ] voce verificabile
- [ ] voce verificabile

## Regole di scrittura
- Nessun em dash. Usa virgole, due punti, parentesi.
- Niente riempitivi: "elevate", "seamless", "unleash", "delve", "robusto" senza contenuto.
- Ogni affermazione deve poter essere verificata da chi legge.
- Lunghezza: abbastanza dettagliata da essere eseguibile senza contesto esterno. Non abbreiviare la procedura.
- Scrivi in italiano, salvo che il materiale sorgente sia in un'altra lingua: in quel caso usa la lingua del materiale.`;
