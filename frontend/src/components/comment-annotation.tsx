'use client';

import React, { useState, useCallback, useEffect } from 'react';

interface CommentMark {
  id: string;
  text: string;
  startPos: number;
  endPos: number;
  authorName: string;
  commentCount: number;
  isResolved: boolean;
}

interface CommentAnnotationProps {
  commentMarks: CommentMark[];
  onMarkClick?: (markId: string) => void;
  onSelectText?: (selectedText: string, startPos: number, endPos: number) => void;
}

export function CommentAnnotation({
  commentMarks,
  onMarkClick,
  onSelectText,
}: CommentAnnotationProps) {
  const [selectedRange, setSelectedRange] = useState<{ start: number; end: number } | null>(null);

  const handleMouseUp = useCallback(() => {
    const selection = window.getSelection();
    if (selection && selection.toString().length > 0) {
      const selectedText = selection.toString();
      // Rough estimate of positions - in real implementation would need more precise tracking
      onSelectText?.(selectedText, 0, selectedText.length);
    }
  }, [onSelectText]);

  const renderCommentMarks = (text: string): React.ReactNode[] => {
    if (!text || commentMarks.length === 0) {
      return [text];
    }

    const elements: React.ReactNode[] = [];
    let lastPos = 0;

    // Sort marks by position
    const sortedMarks = [...commentMarks].sort((a, b) => a.startPos - b.startPos);

    sortedMarks.forEach((mark) => {
      if (mark.startPos > lastPos) {
        elements.push(<span key={`text-${lastPos}`}>{text.substring(lastPos, mark.startPos)}</span>);
      }

      const markedText = text.substring(mark.startPos, mark.endPos);
      elements.push(
        <span
          key={mark.id}
          onClick={() => onMarkClick?.(mark.id)}
          className={`relative group cursor-pointer px-1 rounded transition-colors ${
            mark.isResolved
              ? 'bg-green-200 dark:bg-green-800 hover:bg-green-300 dark:hover:bg-green-700'
              : 'bg-yellow-200 dark:bg-yellow-800 hover:bg-yellow-300 dark:hover:bg-yellow-700'
          }`}
          title={`${mark.commentCount} comment${mark.commentCount !== 1 ? 's' : ''} by ${mark.authorName}`}
        >
          {markedText}
          {/* Tooltip */}
          <div className="absolute hidden group-hover:block left-0 bottom-full mb-2 px-2 py-1 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs rounded whitespace-nowrap z-20 pointer-events-none">
            {mark.commentCount} {mark.commentCount === 1 ? 'comment' : 'comments'}
          </div>
        </span>
      );

      lastPos = mark.endPos;
    });

    if (lastPos < text.length) {
      elements.push(<span key={`text-${lastPos}`}>{text.substring(lastPos)}</span>);
    }

    return elements;
  };

  return {
    renderCommentMarks,
    handleMouseUp,
  };
}

/**
 * Utility to render inline comment markers in text.
 * Usage: {renderCommentMarks(editorContent).map((el, i) => <React.Fragment key={i}>{el}</React.Fragment>)}
 */
export function useCommentAnnotation() {
  return {
    renderCommentMarks: (text: string, marks: CommentMark[]): Array<string | { type: 'mark'; id: string; text: string; metadata: CommentMark }> => {
      if (!text || marks.length === 0) return [text];

      const elements: Array<string | { type: 'mark'; id: string; text: string; metadata: CommentMark }> = [];
      let lastPos = 0;

      const sortedMarks = [...marks].sort((a, b) => a.startPos - b.startPos);

      sortedMarks.forEach((mark) => {
        if (mark.startPos > lastPos) {
          elements.push(text.substring(lastPos, mark.startPos));
        }

        const markedText = text.substring(mark.startPos, mark.endPos);
        elements.push({
          type: 'mark',
          id: mark.id,
          text: markedText,
          metadata: mark,
        });

        lastPos = mark.endPos;
      });

      if (lastPos < text.length) {
        elements.push(text.substring(lastPos));
      }

      return elements;
    },
  };
}
