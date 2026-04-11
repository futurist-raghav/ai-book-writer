'use client';

import React, { useState } from 'react';
import { RewriteWithDiff } from './rewrite-with-diff';
import { VoiceNoteModal } from './voice-note-modal';

interface AIToolsPanelProps {
  chapterId: string;
  onInsertContent?: (content: string) => void;
}

export function AIToolsPanel({ chapterId, onInsertContent }: AIToolsPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [showRewrite, setShowRewrite] = useState(false);
  const [showVoice, setShowVoice] = useState(false);

  // Listen for text selection
  React.useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection();
      const text = selection?.toString().trim() || '';
      if (text && text.length > 10) {
        setSelectedText(text);
      }
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, []);

  const tools = [
    {
      id: 'rewrite',
      label: 'Rewrite Text',
      icon: '✨',
      tooltip: 'Generate alternative versions with diff comparison',
      disabled: !selectedText,
      onClick: () => setShowRewrite(true),
    },
    {
      id: 'voice',
      label: 'Voice to Draft',
      icon: '🎤',
      tooltip: 'Convert voice notes to prose draft',
      onClick: () => setShowVoice(true),
    },
  ];

  return (
    <>
      {/* Floating AI Tools Button */}
      <div className="fixed bottom-8 right-8 z-40">
        {isExpanded && (
          <div className="absolute bottom-16 right-0 bg-white rounded-lg shadow-xl border border-outline-variant/30 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div className="p-2 space-y-1">
              {tools.map((tool) => (
                <button
                  key={tool.id}
                  onClick={() => {
                    tool.onClick();
                    setIsExpanded(false);
                  }}
                  disabled={tool.disabled}
                  title={tool.tooltip}
                  className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    tool.disabled
                      ? 'text-on-surface-variant/50 cursor-not-allowed'
                      : 'text-on-surface hover:bg-surface-container active:bg-surface-container'
                  }`}
                >
                  <span className="text-lg">{tool.icon}</span>
                  <span>{tool.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Main Button */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="h-14 w-14 rounded-full bg-primary text-on-primary shadow-lg hover:bg-primary/90 flex items-center justify-center font-bold text-xl transition-all duration-200 hover:scale-110"
          title="AI Writing Tools (Rewrite, Voice Notes)"
        >
          {isExpanded ? '✕' : '✨'}
        </button>
      </div>

      {/* Modals */}
      {showRewrite && selectedText && (
        <RewriteWithDiff
          chapterId={chapterId}
          selectedText={selectedText}
          onApply={(rewrittenText) => {
            if (onInsertContent) {
              onInsertContent(rewrittenText);
            }
            setShowRewrite(false);
            setSelectedText('');
          }}
          onCancel={() => setShowRewrite(false)}
        />
      )}

      {showVoice && (
        <VoiceNoteModal
          chapterId={chapterId}
          onApply={(content) => {
            if (onInsertContent) {
              onInsertContent(content);
            }
            setShowVoice(false);
          }}
          onCancel={() => setShowVoice(false)}
        />
      )}
    </>
  );
}
