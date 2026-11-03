/**
 * LOADOUT Version 2.0 — Contextual Performance AI Copilot
 *
 * Interactive engineering copilot providing:
 * - Rigorous statistical benchmark interpretation.
 * - Knowledge base retrieval with verifiable citations.
 * - Experiment planning with explicit user approval requirements.
 * - Real-time zero-transmission privacy disclosure.
 */

import { useState, useRef, useEffect } from 'react';
import type { AIMessage, WorkbenchAIContext } from '../../types/ai.ts';
import { createAIProvider } from '../../lib/ai/providers/index.ts';
import { defaultPrivacyGateway } from '../../lib/ai/privacy-gateway.ts';

interface AICopilotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  context: WorkbenchAIContext;
  onNavigateToView?: (view: string) => void;
  onNavigateToStep?: (step: string) => void;
}

const INITIAL_MESSAGES: AIMessage[] = [
  {
    id: 'msg_welcome',
    role: 'assistant',
    content:
      'Hello, I am your **LOADOUT Performance Engineering Copilot**.\n\n' +
      'I interpret controlled benchmark distributions, assess correctness gates, and retrieve verified optimization principles from the local knowledge base.\n\n' +
      'What would you like to analyze?',
    createdAt: new Date().toISOString(),
  },
];

let msgSequence = 0;
function createMessage(
  role: 'user' | 'assistant',
  content: string,
  extra?: { citations?: import('../../types/ai.ts').AICitation[]; suggestedActions?: import('../../types/ai.ts').AISuggestedAction[] },
): AIMessage {
  msgSequence += 1;
  return {
    id: `msg_${msgSequence}_${Date.now()}`,
    role,
    content,
    citations: extra?.citations,
    suggestedActions: extra?.suggestedActions,
    createdAt: new Date().toISOString(),
  };
}

export default function AICopilotDrawer({
  isOpen,
  onClose,
  context,
  onNavigateToStep,
}: AICopilotDrawerProps) {
  const [messages, setMessages] = useState<AIMessage[]>(INITIAL_MESSAGES);
  const [inputQuery, setInputQuery] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPayloadInspection, setShowPayloadInspection] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const provider = createAIProvider('offline');
  const sanitizedContext = defaultPrivacyGateway.sanitizeContext(context);

  useEffect(() => {
    if (typeof messagesEndRef.current?.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  async function handleSendMessage(queryText?: string) {
    const textToSend = queryText || inputQuery;
    if (!textToSend.trim() || isGenerating) return;

    const userMsg = createMessage('user', textToSend.trim());

    setMessages((prev) => [...prev, userMsg]);
    setInputQuery('');
    setIsGenerating(true);

    try {
      const response = await provider.generateResponse(textToSend, sanitizedContext);

      const assistantMsg = createMessage('assistant', response.content, {
        citations: response.citations,
        suggestedActions: response.suggestedActions,
      });

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      const errorMsg = createMessage('assistant', `⚠️ Failed to generate analysis: ${(err as Error).message}`);
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsGenerating(false);
    }
  }

  function handleActionClick(actionType: string, payload?: Record<string, unknown>) {
    if (actionType === 'switch-view' && payload?.step && onNavigateToStep) {
      onNavigateToStep(payload.step as string);
      onClose();
    } else if (actionType === 'export-report') {
      const b = context.activeBenchmark;
      if (!b) return;
      const blob = new Blob([JSON.stringify(b, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `loadout-benchmark-${b.id}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  if (!isOpen) return null;

  return (
    <aside
      aria-label="AI Performance Copilot"
      className="fixed inset-y-0 right-0 w-full sm:w-[480px] bg-slate-950 border-l border-slate-800 shadow-2xl z-50 flex flex-col font-sans"
    >
      {/* Drawer Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
        <div className="flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <div>
            <h3 className="text-sm font-bold text-slate-100 font-mono">Performance Copilot</h3>
            <span className="text-[11px] font-mono text-emerald-400">
              Private Mode: Zero Network Egress
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowPayloadInspection(!showPayloadInspection)}
            title="Inspect sanitized context"
            className="px-2 py-1 text-[10px] font-mono rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          >
            {showPayloadInspection ? 'Hide Context' : 'Inspect Context'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors text-lg leading-none"
            aria-label="Close Copilot"
          >
            ×
          </button>
        </div>
      </div>

      {/* Payload Disclosure Modal */}
      {showPayloadInspection && (
        <div className="p-3 bg-slate-900/90 border-b border-slate-800 text-[11px] font-mono max-h-48 overflow-y-auto space-y-1">
          <div className="text-cyan-300 font-bold">🔒 Sanitized Payload Disclosure:</div>
          <p className="text-slate-400 text-[10px]">
            Zero dataset records or user values leave the workbench. Only structural metadata and
            statistical benchmarks are accessible.
          </p>
          <pre className="text-[10px] text-slate-300 bg-slate-950 p-2 rounded overflow-x-auto">
            {JSON.stringify(sanitizedContext, null, 2)}
          </pre>
        </div>
      )}

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs font-mono">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col space-y-1.5 ${
              msg.role === 'user' ? 'items-end' : 'items-start'
            }`}
          >
            <div className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">
              {msg.role === 'user' ? 'You' : 'Copilot'}
            </div>
            <div
              className={`p-3.5 rounded-lg max-w-[95%] leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-cyan-950/80 text-cyan-100 border border-cyan-800/80'
                  : 'bg-slate-900 text-slate-200 border border-slate-800 whitespace-pre-wrap'
              }`}
            >
              {msg.content}

              {/* Citations */}
              {msg.citations && msg.citations.length > 0 && (
                <div className="mt-3 pt-2.5 border-t border-slate-800/80 space-y-1.5">
                  <span className="text-[10px] text-cyan-400 uppercase font-semibold">
                    Verified Citations:
                  </span>
                  {msg.citations.map((c) => (
                    <div
                      key={c.sourceId}
                      className="p-1.5 rounded bg-slate-950 border border-slate-800 text-[10px] text-slate-300"
                    >
                      <div className="font-bold text-slate-200">
                        {c.title} • {c.section}
                      </div>
                      <div className="text-slate-400 italic mt-0.5">{c.excerpt}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Suggested Actions */}
              {msg.suggestedActions && msg.suggestedActions.length > 0 && (
                <div className="mt-3 pt-2.5 border-t border-slate-800 flex flex-wrap gap-2">
                  {msg.suggestedActions.map((act) => (
                    <button
                      key={act.id}
                      type="button"
                      onClick={() => handleActionClick(act.actionType, act.payload)}
                      className="px-2.5 py-1 text-[11px] font-mono rounded bg-cyan-950 text-cyan-300 border border-cyan-800 hover:bg-cyan-900 transition-colors"
                    >
                      ⚡ {act.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {isGenerating && (
          <div className="flex items-center gap-2 text-cyan-400 font-mono text-xs animate-pulse">
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            Evaluating benchmark telemetry and retrieving citations...
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompts Bar */}
      <div className="px-4 py-2 bg-slate-900/50 border-t border-slate-800 flex items-center gap-2 overflow-x-auto text-[11px] font-mono">
        <button
          type="button"
          onClick={() => handleSendMessage('Interpret active benchmark results')}
          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 whitespace-nowrap transition-colors"
        >
          📊 Interpret Benchmark
        </button>
        <button
          type="button"
          onClick={() => handleSendMessage('Plan optimization experiment')}
          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 whitespace-nowrap transition-colors"
        >
          🧪 Plan Experiment
        </button>
        <button
          type="button"
          onClick={() =>
            handleSendMessage('What are the trade-offs of DOM virtualization?')
          }
          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 whitespace-nowrap transition-colors"
        >
          ⚖️ Virtualization Trade-offs
        </button>
      </div>

      {/* Input Box */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void handleSendMessage();
        }}
        className="p-3 border-t border-slate-800 bg-slate-950 flex items-center gap-2 font-mono"
      >
        <input
          type="text"
          value={inputQuery}
          onChange={(e) => setInputQuery(e.target.value)}
          placeholder="Ask about benchmark results, DOM scaling, or workers..."
          className="flex-1 bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
        />
        <button
          type="submit"
          disabled={!inputQuery.trim() || isGenerating}
          className="px-3 py-2 rounded bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-bold text-xs transition-colors"
        >
          Send
        </button>
      </form>
    </aside>
  );
}
