import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { chatCompletion, MODELS, SYSTEM_PROMPT } from '@/lib/ai';
import { stripFences } from '@/lib/skill';

export const runtime = 'nodejs';
export const maxDuration = 60;

type Mode = 'from-skills' | 'from-scratch';

interface Body {
  mode: Mode;
  /** Modalità from-skills: materiale sorgente, già concatenato lato client. */
  sourceMaterial?: string;
  /** Modalità from-scratch: campi del wizard. */
  name?: string;
  domain?: string;
  goal?: string;
  tone?: string;
  constraints?: string;
  examples?: string;
}

function buildUserPrompt(body: Body): string {
  if (body.mode === 'from-skills') {
    return `Trasforma il materiale seguente in UNA skill completa e ultra-dettagliata.

Regole:
- Fondi tutto il materiale ricevuto in un unico documento coerente.
- Dove il materiale è incompleto, colma i buchi con passi concreti e verificabili, senza inventare strumenti o fatti specifici.
- Conserva ogni dettaglio tecnico utile presente nel materiale.
- Se materiali diversi si contraddicono, scegli l'approccio più specifico e annota la scelta in "Regole e vincoli".

MATERIALE SORGENTE:
---
${body.sourceMaterial?.slice(0, 60_000) ?? ''}
---`;
  }

  return `Crea da zero una skill completa e dettagliata con questi parametri.

- Nome: ${body.name}
- Dominio o ambito: ${body.domain}
- Obiettivo che la skill deve far raggiungere: ${body.goal}
- Tono e stile attesi: ${body.tone || 'professionale e diretto'}
- Vincoli: ${body.constraints || 'nessuno dichiarato'}
- Esempi o casi d'uso: ${body.examples || 'nessuno fornito'}

La procedura deve essere abbastanza dettagliata da essere eseguita senza contesto esterno.`;
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Devi accedere con GitHub.' }, { status: 401 });
  }

  if (!process.env.OPENROUTER_API_KEY) {
    return NextResponse.json(
      { error: 'OPENROUTER_API_KEY non configurata sul server.' },
      { status: 500 },
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'Corpo della richiesta non valido.' }, { status: 400 });
  }

  if (body.mode === 'from-skills' && !body.sourceMaterial?.trim()) {
    return NextResponse.json({ error: 'Nessun materiale fornito.' }, { status: 400 });
  }
  if (body.mode === 'from-scratch' && (!body.name || !body.domain || !body.goal)) {
    return NextResponse.json(
      { error: 'Servono nome, dominio e obiettivo.' },
      { status: 400 },
    );
  }

  const errors: string[] = [];
  for (const model of MODELS) {
    try {
      const { content: raw, usage } = await chatCompletion(model, [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(body) },
      ]);

      const markdown = stripFences(raw);
      if (!markdown) {
        errors.push(`${model}: risposta vuota`);
        continue;
      }

      return NextResponse.json({ markdown, usage, model, fallbacks: errors });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'errore sconosciuto';
      errors.push(`${model}: ${message}`);
    }
  }

  return NextResponse.json(
    {
      error: `Nessun modello free ha risposto. Dettagli: ${errors.join('; ')}`,
    },
    { status: 502 },
  );
}
