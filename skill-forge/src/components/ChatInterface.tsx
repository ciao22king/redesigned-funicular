'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { initializeEngine, generateChatStream, getModelLabel, isEngineReady, getInitError } from '@/lib/webllm';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isModelLoading, setIsModelLoading] = useState(!isEngineReady());
  const [loadProgress, setLoadProgress] = useState<{ progress: number; text: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEngineReady()) {
      setIsModelLoading(false);
      return;
    }

    let cancelled = false;

    initializeEngine((report) => {
      if (cancelled) return;
      setLoadProgress(report);
      if (report.progress >= 1) {
        setIsModelLoading(false);
        setLoadProgress(null);
      }
    }).catch((err) => {
      if (!cancelled) {
        setError(err.message);
        setIsModelLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isGenerating || isModelLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: input.trim(),
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsGenerating(true);
    setError(null);

    try {
      const systemPrompt = `You are Skiller, a helpful AI assistant running locally in the browser via WebLLM.
You are the model "skiller-0.5B" (based on Qwen2.5-0.5B-Instruct).
Answer questions directly and concisely. You have no access to external tools or the internet.`;

      const chatMessages = [
        { role: 'system' as const, content: systemPrompt },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
        { role: 'user' as const, content: userMessage.content },
      ];

      const stream = await generateChatStream(chatMessages);

      let assistantContent = '';
      const assistantMessage: Message = {
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      for await (const token of stream) {
        assistantContent += token;
        setMessages((prev) =>
          prev.map((m, i) =>
            i === prev.length - 1 ? { ...m, content: assistantContent } : m
          )
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore durante la generazione');
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const initError = getInitError();
  const displayError = error || (initError ? initError.message : null);

  return (
    <>
      <Nav />
      <main id="contenuto" className="mx-auto max-w-3xl px-6 py-8">
        <header className="mb-8">
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-[--accent]">
            Chat locale · {getModelLabel()}
          </p>
          <h1 className="font-display text-3xl font-semibold leading-tight text-[--ink]">
            Chiedi a Skiller
          </h1>
          <p className="mt-2 text-[--ink-muted]">
            Modello Qwen2.5-0.5B-Instruct in esecuzione nel browser via WebLLM. Nessun dato lascia il tuo dispositivo.
          </p>
        </header>

        {isModelLoading && loadProgress && (
          <div className="mb-6 rounded-xl border border-[--line] bg-[--surface-raised] p-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-[--ink]">Caricamento modello...</span>
              <span className="font-mono text-[--accent]">{Math.round(loadProgress.progress * 100)}%</span>
            </div>
            <div className="h-2 rounded-full bg-[--surface-sunken] overflow-hidden">
              <div
                className="h-full bg-[--accent] transition-all duration-300"
                style={{ width: `${loadProgress.progress * 100}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-[--ink-muted]">{loadProgress.text}</p>
          </div>
        )}

        {displayError && !isModelLoading && (
          <div className="mb-6 rounded-xl border border-[oklch(70%_0.14_28)] bg-[oklch(95%_0.04_30)] px-4 py-3 text-sm text-[oklch(38%_0.13_28)]">
            {displayError}
          </div>
        )}

        <div className="space-y-6 mb-8" role="log" aria-live="polite">
          {messages.length === 0 && !isModelLoading && (
            <div className="text-center py-12 text-[--ink-muted]">
              <p className="text-lg">Inizia una conversazione</p>
              <p className="mt-2 text-sm">Scrivi un messaggio qui sotto per iniziare a chattare con Skiller.</p>
            </div>
          )}
          {messages.map((msg, idx) => (
            <div
              key={`${msg.timestamp}-${idx}`}
              className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div
                className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-mono text-xs ${
                  msg.role === 'user'
                    ? 'bg-[--accent] text-white'
                    : 'bg-[--surface-raised] border border-[--line] text-[--accent]'
                }`}
              >
                {msg.role === 'user' ? 'U' : 'S'}
              </div>
              <div
                className={`max-w-[85%] ${
                  msg.role === 'user' ? 'text-right' : ''
                }`}
              >
                <div
                  className={`inline-block px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-[--accent] text-white rounded-tr-sm'
                      : 'bg-[--surface-raised] border border-[--line] text-[--ink] rounded-tl-sm'
                  }`}
                >
                  {msg.content}
                </div>
                <time
                  className="mt-1 block text-xs text-[--ink-muted]"
                  dateTime={new Date(msg.timestamp).toISOString()}
                >
                  {new Date(msg.timestamp).toLocaleTimeString('it-IT', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </time>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSubmit} className="border-t border-[--line] pt-6">
          <div className="flex gap-3">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isGenerating || isModelLoading}
              placeholder={
                isModelLoading
                  ? 'Attendi il caricamento del modello...'
                  : isGenerating
                  ? 'Skiller sta rispondendo...'
                  : 'Scrivi un messaggio... (Invio per inviare, Shift+Invio per nuova riga)'
              }
              rows={1}
              className="flex-1 resize-none rounded-xl border border-[--line] bg-[--surface-raised] px-4 py-3 text-sm text-[--ink] outline-none transition-colors placeholder:text-[--ink-muted]/60 focus:border-[--accent] disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ minHeight: '48px', maxHeight: '200px' }}
            />
            <button
              type="submit"
              disabled={!input.trim() || isGenerating || isModelLoading}
              className="shrink-0 rounded-xl bg-[--accent] px-6 py-3 font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Invia messaggio"
            >
              {isGenerating ? (
                <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                'Invia'
              )}
            </button>
          </div>
          <p className="mt-3 text-center text-xs text-[--ink-muted]">
            Esecuzione 100% locale · Nessuna chiave API · Privacy completa
          </p>
        </form>
      </main>
      <Footer />
    </>
  );
}