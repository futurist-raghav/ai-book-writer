'use client';

import { useState, useRef, useEffect } from 'react';
import { useProjectContext } from '@/stores/project-context';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Spinner } from '@/components/ui/spinner';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  context?: {
    chapterId?: string;
    characterIds?: string[];
    worldElementIds?: string[];
  };
}

/**
 * AI ASSISTANT WITH PROJECT CONTEXT
 * 
 * This component provides AI assistance deeply integrated with the entire project.
 * It has access to:
 * - Current project metadata (genre, themes, writing style)
 * - Active chapter content and synopsis
 * - All characters and their relationships
 * - World building elements
 * - Events and their connections
 * - Audio notes and transcriptions
 * 
 * The AI can help with:
 * - Character consistency and development
 * - Plot suggestions and event sequencing
 * - Dialogue writing with character voice
 * - World building coherence
 * - Genre-specific guidance
 * - Cross-chapter continuity
 */

interface AiAssistantProps {
  compact?: boolean; // Show as sidebar vs full panel
  onInsertContent?: (content: string) => void;
  assistanceType?: 'general' | 'character' | 'world' | 'dialogue' | 'plot';
}

export function AiAssistant({ compact = false, onInsertContent, assistanceType = 'general' }: AiAssistantProps) {
  const {
    activeBook,
    activeChapter,
    characters,
    worldElements,
    aiContextMetadata,
    updateAiContext,
    getAiContextString,
  } = useProjectContext();

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isOpen, setIsOpen] = useState(!compact);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /**
   * Call Claude API with rich project context
   * In production, this should call your backend endpoint that handles Claude integration
   */
  const queryAiMutation = useMutation({
    mutationFn: async (userMessage: string) => {
      if (!activeBook || !activeChapter) {
        throw new Error('No active project or chapter');
      }

      // Build the context-aware prompt
      const contextString = getAiContextString();
      const assistancePrompt = getAssistancePrompt(assistanceType, activeChapter, characters);

      const systemPrompt = `You are an expert writing assistant for the book "${activeBook.title}".

GENRE: ${activeBook.metadata.genres.join(', ')}
WRITING STYLE: ${activeBook.metadata.writing_form}
TONE: ${activeBook.metadata.writing_tone}

${assistancePrompt}

PROJECT CONTEXT:
${contextString}

The writer has asked for help with their current chapter. Provide specific, actionable advice that fits the established tone, genre, and existing world.`;

      // Call your backend API that integrates with Claude
      const response = await fetch('/api/v1/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            ...messages.map((m) => ({ role: m.role, content: m.content })),
            { role: 'user', content: userMessage },
          ],
          system: systemPrompt,
          chapter_id: activeChapter.id,
          assistance_type: assistanceType,
        }),
      });

      if (!response.ok) {
        throw new Error(`AI API failed: ${response.statusText}`);
      }

      const data = await response.json();
      return data.response;
    },
    onSuccess: (assistantMessage) => {
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content: assistantMessage,
          timestamp: new Date(),
          context: {
            chapterId: activeChapter?.id,
            characterIds: Array.from(
              new Set(
                messages
                  .filter((m) => m.context?.characterIds)
                  .flatMap((m) => m.context?.characterIds || [])
              )
            ),
          },
        },
      ]);
      setInputValue('');
    },
    onError: (error) => {
      toast.error(`AI Assistant Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    },
  });

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!inputValue.trim() || !activeBook || !activeChapter) {
      return;
    }

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: inputValue,
      timestamp: new Date(),
      context: {
        chapterId: activeChapter.id,
        characterIds: activeChapter.characters_involved,
        worldElementIds: activeChapter.world_elements,
      },
    };

    setMessages((prev) => [...prev, userMessage]);
    updateAiContext({
      chapterId: activeChapter.id,
      characterIds: activeChapter.characters_involved,
    });

    await queryAiMutation.mutateAsync(inputValue);
  };

  const handleInsert = (content: string) => {
    if (onInsertContent) {
      onInsertContent(content);
      toast.success('Content inserted into writer canvas');
    } else {
      // Copy to clipboard if no insert handler
      navigator.clipboard.writeText(content);
      toast.success('Content copied to clipboard');
    }
  };

  if (!activeBook || !activeChapter) {
    return null;
  }

  if (compact && !isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-secondary shadow-lg flex items-center justify-center text-white hover:bg-secondary/90 transition-all active:scale-95 z-40"
        title="Open AI Assistant"
      >
        <span className="material-symbols-outlined">smart_toy</span>
      </button>
    );
  }

  const panelClasses = compact
    ? 'fixed bottom-0 right-0 w-full md:w-96 h-screen md:h-[600px] rounded-t-xl md:rounded-lg shadow-2xl z-50'
    : 'w-full rounded-xl shadow-sm border border-outline-variant/10 bg-white overflow-hidden flex flex-col';

  return (
    <div className={panelClasses}>
      {/* Header */}
      <div className="bg-secondary text-white p-4 flex items-center justify-between">
        <div>
          <h3 className="font-bold text-sm">AI Writing Assistant</h3>
          <p className="text-xs opacity-90">Helping with "{activeChapter.title}"</p>
        </div>
        {compact && (
          <button
            onClick={() => setIsOpen(false)}
            className="text-white hover:bg-white/20 p-2 rounded transition-all"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        )}
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-surface-container-lowest">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <p className="text-xs text-on-surface-variant mb-4">
              💡 AI Assistant is ready to help. Ask about:
            </p>
            <div className="space-y-2 text-[11px] text-on-surface-variant">
              <p>• Character consistency and dialogue</p>
              <p>• Plot suggestions based on your world</p>
              <p>• Writing style and tone refinement</p>
              <p>• Genre-specific guidance</p>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-xs lg:max-w-md px-4 py-3 rounded-lg ${
                msg.role === 'user'
                  ? 'bg-secondary text-white rounded-br-none'
                  : 'bg-surface-container-high text-on-surface rounded-bl-none'
              }`}
            >
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
              {msg.role === 'assistant' && (
                <button
                  onClick={() => handleInsert(msg.content)}
                  className="mt-2 text-xs px-2 py-1 bg-primary text-white rounded opacity-75 hover:opacity-100 transition-opacity"
                >
                  ↓ Insert
                </button>
              )}
            </div>
          </div>
        ))}
        {queryAiMutation.isPending && (
          <div className="flex justify-start">
            <div className="bg-surface-container-high text-on-surface px-4 py-3 rounded-lg rounded-bl-none flex items-center gap-2">
              <Spinner className="w-4 h-4" />
              <p className="text-sm">Thinking...</p>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <form onSubmit={handleSendMessage} className="border-t border-outline-variant/10 p-4 bg-white">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage(e as any);
              }
            }}
            placeholder="Ask the AI for help... (Shift+Enter for new line)"
            className="flex-1 resize-none rounded-lg border border-outline-variant/20 bg-surface-container-lowest px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary/20"
            rows={3}
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || queryAiMutation.isPending}
            className="self-end px-4 py-2 rounded-lg bg-secondary text-white text-sm font-bold hover:bg-secondary/90 disabled:opacity-50 transition-all"
          >
            {queryAiMutation.isPending ? <Spinner className="w-4 h-4" /> : 'Send'}
          </button>
        </div>
      </form>
    </div>
  );
}

/**
 * Generate specialized prompts based on assistance type
 */
function getAssistancePrompt(
  type: string,
  chapter: any,
  characters: any[]
): string {
  switch (type) {
    case 'character':
      return `ASSISTANCE TYPE: CHARACTER DEVELOPMENT
Focus on character consistency, voice, and relationships. Reference established character traits and ensure dialogue matches their personality. Suggest character arcs and development opportunities within this chapter.`;

    case 'world':
      return `ASSISTANCE TYPE: WORLD BUILDING
Ensure world-building elements are consistent with established lore. Reference existing locations, factions, and systems. Suggest how world elements can be naturally woven into the narrative.`;

    case 'dialogue':
      return `ASSISTANCE TYPE: DIALOGUE WRITING
Help craft dialogue that matches character voices established earlier. Ensure conversations advance the plot and reveal character. Consider pacing, subtext, and emotional authenticity.`;

    case 'plot':
      return `ASSISTANCE TYPE: PLOT & PACING
Focus on narrative structure, event sequencing, and pacing. Ensure plot beats align with genre conventions. Consider foreshadowing, tension, and story momentum.`;

    default:
      return `ASSISTANCE TYPE: GENERAL WRITING
Provide comprehensive writing guidance including character consistency, plot coherence, world-building integration, pacing, and genre-specific best practices.`;
  }
}
