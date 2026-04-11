'use client';

import React, { useState } from 'react';
import { GlossaryEntryResponse } from '@/types/glossary';
import { toast } from 'sonner';

interface GlossaryExportModalProps {
  entries: GlossaryEntryResponse[];
  onInsert?: (htmlContent: string) => void;
  onCancel?: () => void;
}

export function GlossaryExportModal({
  entries,
  onInsert,
  onCancel,
}: GlossaryExportModalProps) {
  const [exportFormat, setExportFormat] = useState<'html' | 'markdown' | 'plain'>('html');
  const [includePageNumbers, setIncludePageNumbers] = useState(false);

  const generateHtmlGlossary = () => {
    const sorted = [...entries].sort((a, b) => a.term.localeCompare(b.term));
    
    let html = '<div class="glossary-section">\n';
    html += '<h2>Glossary</h2>\n';
    html += '<dl>\n';
    
    sorted.forEach((entry) => {
      html += `  <dt>${escapeHtml(entry.term)}</dt>\n`;
      html += `  <dd>${escapeHtml(entry.definition || '(undefined)')}</dd>\n`;
    });
    
    html += '</dl>\n';
    html += '</div>';
    
    return html;
  };

  const generateMarkdownGlossary = () => {
    const sorted = [...entries].sort((a, b) => a.term.localeCompare(b.term));
    
    let md = '## Glossary\n\n';
    
    sorted.forEach((entry) => {
      md += `**${entry.term}**\n`;
      md += `: ${entry.definition || '(undefined)'}\n\n`;
    });
    
    return md;
  };

  const generatePlainTextGlossary = () => {
    const sorted = [...entries].sort((a, b) => a.term.localeCompare(b.term));
    
    let text = 'GLOSSARY\n';
    text += '=' .repeat(40) + '\n\n';
    
    sorted.forEach((entry) => {
      text += `${entry.term}\n`;
      text += `${'-'.repeat(entry.term.length)}\n`;
      text += `${entry.definition || '(undefined)'}\n\n`;
    });
    
    return text;
  };

  const escapeHtml = (text: string) => {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  };

  const generateGlossary = () => {
    let content = '';
    switch (exportFormat) {
      case 'markdown':
        content = generateMarkdownGlossary();
        break;
      case 'plain':
        content = generatePlainTextGlossary();
        break;
      case 'html':
      default:
        content = generateHtmlGlossary();
        break;
    }
    return content;
  };

  const handleInsert = () => {
    const content = generateGlossary();
    onInsert?.(content);
    toast.success('Glossary inserted into back matter');
  };

  const handleDownload = () => {
    const content = generateGlossary();
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `glossary.${exportFormat === 'plain' ? 'txt' : exportFormat}`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Glossary downloaded');
  };

  const preview = generateGlossary();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[700px] overflow-y-auto p-6">
        <h2 className="text-2xl font-bold mb-4 text-primary">Export Glossary</h2>

        <div className="space-y-4">
          {/* Format Selector */}
          <div>
            <label className="block text-sm font-bold text-on-surface mb-2">
              Export Format
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['html', 'markdown', 'plain'] as const).map((format) => (
                <button
                  key={format}
                  onClick={() => setExportFormat(format)}
                  className={`rounded-lg px-3 py-2 text-sm font-bold transition-colors ${
                    exportFormat === format
                      ? 'bg-primary text-white'
                      : 'border border-outline-variant/30 text-on-surface hover:bg-surface-container-low'
                  }`}
                >
                  {format === 'html' ? 'HTML' : format === 'markdown' ? 'Markdown' : 'Plain Text'}
                </button>
              ))}
            </div>
          </div>

          {/* Options */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="pageNumbers"
              checked={includePageNumbers}
              onChange={(e) => setIncludePageNumbers(e.target.checked)}
              className="cursor-pointer"
            />
            <label htmlFor="pageNumbers" className="text-sm cursor-pointer">
              Include page numbers (for print layout)
            </label>
          </div>

          {/* Preview */}
          <div>
            <label className="block text-sm font-bold text-on-surface mb-2">
              Preview
            </label>
            <div className="bg-surface-container-lowest rounded-lg border border-outline-variant/10 p-4 max-h-64 overflow-y-auto">
              <pre className="text-xs whitespace-pre-wrap font-mono text-on-surface-variant">
                {preview.substring(0, 500)}
                {preview.length > 500 && '...(truncated)'}
              </pre>
            </div>
          </div>

          {/* Info */}
          <p className="text-xs text-on-surface-variant">
            Total terms: {entries.length}
          </p>

          {/* Actions */}
          <div className="flex gap-2 justify-end">
            <button
              onClick={onCancel}
              className="rounded-lg border border-outline-variant/30 bg-white px-4 py-2 text-sm font-bold text-on-surface hover:bg-surface-container-low"
            >
              Cancel
            </button>
            <button
              onClick={handleDownload}
              className="rounded-lg border border-secondary/30 bg-secondary/10 px-4 py-2 text-sm font-bold text-secondary hover:bg-secondary/20"
            >
              Download
            </button>
            <button
              onClick={handleInsert}
              className="rounded-lg bg-secondary px-4 py-2 text-sm font-bold text-white hover:opacity-90"
            >
              Insert to Book
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
