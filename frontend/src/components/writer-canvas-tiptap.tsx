'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import CharacterCount from '@tiptap/extension-character-count';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { Spinner } from '@/components/ui/spinner';
import { toast } from 'sonner';
import { useProjectContext } from '@/stores/project-context';
import { useTerminology } from '@/lib/terminology';
import type { ProjectType } from '@/lib/project-types';

interface WriterCanvasProps {
  chapterId: string;
  initialContent?: string;
  onSave?: (content: string) => Promise<void>;
  onContentChange?: (content: string) => void;
  readOnly?: boolean;
  showAiAssistant?: boolean;
  compactMode?: boolean;
  wordCountTarget?: number;
  onFullScreenToggle?: (isFullScreen: boolean) => void;
  projectType?: ProjectType | string;
}

export function WriterCanvas({
  chapterId,
  initialContent = '',
  onSave,
  onContentChange,
  readOnly = false,
  showAiAssistant = true,
  compactMode = false,
  wordCountTarget,
  onFullScreenToggle,
  projectType,
}: WriterCanvasProps) {
  const { updateChapterContent, updateChapterEditorState } = useProjectContext();
  const terminology = useTerminology(projectType);
  const [isSaving, setIsSaving] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [isZenMode, setIsZenMode] = useState(false);
  const [isTypewriterMode, setIsTypewriterMode] = useState(false);
  const [isTrackingChanges, setIsTrackingChanges] = useState(false);
  const [trackedChanges, setTrackedChanges] = useState<Array<{
    id: string;
    type: 'insert' | 'delete' | 'modify';
    content: string;
    position: number;
    timestamp: Date;
    author: string;
    accepted: boolean;
  }>>([]);
  const [fontSize, setFontSize] = useState('16');
  const [fontFamily, setFontFamily] = useState('serif');
  const [lineSpacing, setLineSpacing] = useState('1.6');
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [lastSaveTime, setLastSaveTime] = useState<Date | null>(null);
  const [showCitationPanel, setShowCitationPanel] = useState(false);
  const [citationUrl, setCitationUrl] = useState('');
  const [showLatexInput, setShowLatexInput] = useState(false);
  const [latexCode, setLatexCode] = useState('');
  const [grammarIssues, setGrammarIssues] = useState<Array<{
    id: string;
    message: string;
    suggestion: string;
    position: number;
  }>>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const previousContentRef = useRef<string>(initialContent);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Highlight.configure({ multicolor: true }),
      Subscript,
      Superscript,
      CharacterCount,
      Placeholder.configure({
        placeholder: 'Start writing your chapter draft here...',
      }),
    ],
    content: initialContent,
    editable: !readOnly,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'writer-prosemirror',
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      
      onContentChange?.(html);
      updateChapterContent(chapterId, html);
      
      // Auto-save the editor state (DOM structure, selections, etc.)
      updateChapterEditorState(chapterId, editor.getJSON());
    },
  });

  // Handle keyboard shortcuts for zen mode and other modes
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Shift+Z or Cmd+Shift+Z for zen mode
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'Z') {
        e.preventDefault();
        setIsZenMode(!isZenMode);
        toast.success(isZenMode ? 'Zen mode disabled' : 'Zen mode enabled. Press Ctrl+Shift+Z to exit.');
      }
      
      // Esc to exit zen mode
      if (e.key === 'Escape' && isZenMode) {
        e.preventDefault();
        setIsZenMode(false);
        toast.success('Zen mode disabled');
      }

      // Ctrl+Shift+T or Cmd+Shift+T for typewriter mode
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'T') {
        e.preventDefault();
        setIsTypewriterMode(!isTypewriterMode);
        toast.success(isTypewriterMode ? 'Typewriter mode disabled' : 'Typewriter mode enabled. Current line stays centered.');
      }

      // Ctrl+Shift+C or Cmd+Shift+C for track changes
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'C') {
        e.preventDefault();
        setIsTrackingChanges(!isTrackingChanges);
        toast.success(isTrackingChanges ? 'Change tracking disabled' : 'Change tracking enabled. All edits will be marked.');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isZenMode, isTypewriterMode, isTrackingChanges]);

  // Handle typewriter mode scrolling - keeps cursor centered
  useEffect(() => {
    if (!isTypewriterMode || !editorContainerRef.current || !editor) return;

    const container = editorContainerRef.current;
    const handleUpdate = () => {
      // Scroll cursor to screen center
      setTimeout(() => {
        const editorDiv = container.querySelector('.writer-editor') as HTMLElement;
        if (!editorDiv) return;

        const containerHeight = container.clientHeight;
        const containerRect = container.getBoundingClientRect();
        const editorRect = editorDiv.getBoundingClientRect();
        
        // Get cursor coordinates relative to editor
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;

        const range = selection.getRangeAt(0);
        const rects = range.getClientRects();
        if (rects.length === 0) return;

        const cursorRect = rects[0];
        const cursorTopRelativeToContainer = cursorRect.top - containerRect.top + container.scrollTop;
        const targetScroll = Math.max(0, cursorTopRelativeToContainer - (containerHeight / 2));

        // Smooth animation
        const currentScroll = container.scrollTop;
        const diff = targetScroll - currentScroll;
        if (Math.abs(diff) > 1) {
          container.scrollTop += diff * 0.12;
        }
      }, 0);
    };

    // Update on any editor change
    if (editor) {
      editor.on('update', handleUpdate);
      editor.on('selectionUpdate', handleUpdate);
    }

    return () => {
      if (editor) {
        editor.off('update', handleUpdate);
        editor.off('selectionUpdate', handleUpdate);
      }
    };
  }, [isTypewriterMode, editor]);

  // Detect changes when editor updates
  const detectChanges = useCallback((newContent: string) => {
    if (!isTrackingChanges) return;

    const oldContent = previousContentRef.current;
    
    // Simple change detection - mark as generic modification for now
    if (oldContent !== newContent) {
      const changeId = `change-${Date.now()}`;
      setTrackedChanges(prev => [...prev, {
        id: changeId,
        type: 'modify',
        content: newContent,
        position: 0,
        timestamp: new Date(),
        author: 'You',
        accepted: false,
      }]);
    }
    
    previousContentRef.current = newContent;
  }, [isTrackingChanges]);
  // Track changes when enabled
  useEffect(() => {
    if (!isTrackingChanges || !editor) return;

    const handleUpdate = () => {
      const content = editor.getHTML();
      detectChanges(content);
    };

    editor.on('update', handleUpdate);
    return () => { editor.off('update', handleUpdate); };
  }, [isTrackingChanges, editor, detectChanges]);

  const handleSave = useCallback(async () => {
    if (!editor) return;

    setIsSaving(true);
    try {
      const content = editor.getHTML();
      await onSave?.(content);
      setLastSaveTime(new Date());
      toast.success('Chapter saved successfully');
    } catch (error) {
      toast.error('Failed to save chapter');
    } finally {
      setIsSaving(false);
    }
  }, [editor, onSave]);

  const handleFind = useCallback(() => {
    if (!editor || !findText) return;
    const { view, state } = editor;
    const searchReg = new RegExp(findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const { doc } = state;
    let found = false;
    
    doc.descendants((node, pos) => {
      if (node.isText && node.text && searchReg.test(node.text)) {
        view.dispatch(state.tr.setSelection(state.selection));
        found = true;
      }
    });
    
    if (found) toast.success(`Found "${findText}"`);
    else toast.info('No matches found');
  }, [editor, findText]);

  const handleReplace = useCallback(() => {
    if (!editor || !findText) return;
    const { view, state } = editor;
    let tr = state.tr;
    const searchReg = new RegExp(findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    let replaceCount = 0;
    
    state.doc.descendants((node, pos) => {
      if (node.isText && node.text && searchReg.test(node.text)) {
        const newText = node.text.replace(searchReg, replaceText);
        tr.replaceWith(pos, pos + node.text.length, editor.schema.text(newText));
        replaceCount++;
      }
    });
    
    if (replaceCount > 0) {
      view.dispatch(tr);
      toast.success(`Replaced ${replaceCount} occurrence(s)`);
    } else {
      toast.info('No matches to replace');
    }
  }, [editor, findText, replaceText]);

  const toggleFullScreen = useCallback(() => {
    const newState = !isFullScreen;
    setIsFullScreen(newState);
    onFullScreenToggle?.(newState);
    
    if (newState) {
      containerRef.current?.requestFullscreen?.();
      toast.success('Full-screen mode enabled. Press Esc to exit.');
    } else {
      document.exitFullscreen?.();
    }
  }, [isFullScreen, onFullScreenToggle]);

  const toggleFocusMode = useCallback(() => {
    setIsFocusMode(!isFocusMode);
    if (!isFocusMode) {
      toast.success('Focus mode enabled. Only the current paragraph is visible.');
    }
  }, [isFocusMode]);

  const toggleZenMode = useCallback(() => {
    setIsZenMode(!isZenMode);
    if (!isZenMode) {
      toast.success('Zen mode enabled. Press Ctrl+Shift+Z or Esc to exit.');
    } else {
      toast.success('Zen mode disabled');
    }
  }, [isZenMode]);

  const toggleTypewriterMode = useCallback(() => {
    setIsTypewriterMode(!isTypewriterMode);
    if (!isTypewriterMode) {
      toast.success('Typewriter mode enabled. Current line stays centered.');
    } else {
      toast.success('Typewriter mode disabled');
    }
  }, [isTypewriterMode]);

  const toggleTrackingChanges = useCallback(() => {
    if (!isTrackingChanges) {
      // Starting track changes
      setIsTrackingChanges(true);
      setTrackedChanges([]);
      previousContentRef.current = editor?.getHTML() || '';
      toast.success('Change tracking enabled. All edits will be marked.');
    } else {
      // Stopping track changes
      setIsTrackingChanges(false);
      toast.success('Change tracking disabled');
    }
  }, [isTrackingChanges, editor]);


  // Basic grammar check
  const performGrammarCheck = useCallback(() => {
    if (!editor) return;
    
    const content = editor.getText();
    const issues: any[] = [];

    // Simple pattern-based grammar checks
    const patterns = [
      {
        regex: /\ba\s+([aeiou])/gi,
        message: 'Use "an" before vowels',
        suggestion: 'an',
      },
      {
        regex: /\s{2,}/g,
        message: 'Multiple spaces detected',
        suggestion: ' ',
      },
      {
        regex: /[.!?]\s+[a-z]/g,
        message: 'Sentence should start with capital letter',
        suggestion: 'Capitalize',
      },
    ];

    patterns.forEach((pattern) => {
      let match;
      while ((match = pattern.regex.exec(content)) !== null) {
        issues.push({
          id: `grammar-${Date.now()}-${match.index}`,
          message: pattern.message,
          suggestion: pattern.suggestion,
          position: match.index,
        });
      }
    });

    setGrammarIssues(issues);
    if (issues.length > 0) {
      toast.info(`Found ${issues.length} grammar issue${issues.length !== 1 ? 's' : ''}`);
    } else {
      toast.success('No grammar issues found');
    }
  }, [editor]);

  // Insert citation
  const insertCitation = useCallback(() => {
    if (!citationUrl || !editor) return;

    const title = prompt('Enter citation title:');
    if (!title) return;

    const citation = `<sup><a href="${citationUrl}" target="_blank" rel="noopener noreferrer" data-citation="true" title="${title}">[${title}]</a></sup>`;
    
    editor.chain().focus().insertContent(citation).run();
    setCitationUrl('');
    setShowCitationPanel(false);
    toast.success('Citation inserted');
  }, [citationUrl, editor]);

  // Insert LaTeX
  const insertLatex = useCallback(() => {
    if (!latexCode || !editor) return;

    editor
      .chain()
      .focus()
      .insertContent(`<code data-type="latex" class="latex-block">${latexCode}</code>`)
      .run();
    
    setLatexCode('');
    setShowLatexInput(false);
    toast.success('LaTeX equation inserted');
  }, [latexCode, editor]);

  const toggleBulletList = () => editor?.chain().focus().toggleBulletList().run();
  const toggleOrderedList = () => editor?.chain().focus().toggleOrderedList().run();
  const setParagraph = () => editor?.chain().focus().setParagraph().run();
  const toggleBlockquote = () => editor?.chain().focus().toggleBlockquote().run();
  const toggleCodeBlock = () => editor?.chain().focus().toggleCodeBlock().run();
  const insertHorizontalRule = () => editor?.chain().focus().setHorizontalRule().run();
  const toggleHighlight = () => editor?.chain().focus().toggleHighlight().run();
  const toggleSubscript = () => editor?.chain().focus().toggleSubscript().run();
  const toggleSuperscript = () => editor?.chain().focus().toggleSuperscript().run();
  const insertLink = () => {
    const url = prompt('Enter URL:');
    if (url) {
      editor?.chain().focus().setLink({ href: url }).run();
    }
  };

  const wordCount = editor?.storage.characterCount.words() || 0;
  const charCount = editor?.storage.characterCount.characters() || 0;
  const readingMinutes = useMemo(() => Math.max(1, Math.ceil(wordCount / 220)), [wordCount]);

  if (!editor) {
    return <div className="p-8 flex justify-center"><Spinner className="w-6 h-6" /></div>;
  }

  return (
    <div 
      ref={containerRef}
      className={`flex flex-col overflow-hidden bg-white ${
        isFullScreen 
          ? 'fixed inset-0 z-[999] rounded-none border-none' 
          : `rounded-xl border border-outline-variant/10 ${compactMode ? 'max-h-[760px]' : 'min-h-[78vh]'}`
      } ${isZenMode ? 'zen-mode' : ''}`}
    >
      {!isZenMode && (
        <div className="flex flex-col gap-2 border-b border-outline-variant/10 bg-surface-container-lowest px-6 py-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-primary">{terminology.editorLabel}</h2>
            <p className="mt-1 text-xs text-on-surface-variant">{terminology.editorPlaceholder}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-outline-variant/20 bg-white px-3 py-1 text-[11px] font-bold text-primary">
                {wordCount.toLocaleString()} words
              </span>
              <span className="rounded-full border border-outline-variant/20 bg-white px-3 py-1 text-[11px] font-bold text-primary">
                {charCount.toLocaleString()} chars
              </span>
              <span className="rounded-full border border-outline-variant/20 bg-white px-3 py-1 text-[11px] font-bold text-primary">
                {readingMinutes} min read
              </span>
            </div>
            {lastSaveTime && (
              <span className="text-[11px] text-on-surface-variant flex items-center gap-1">
                <span className="material-symbols-outlined text-xs">check_circle</span>
                Saved {Math.round((Date.now() - lastSaveTime.getTime()) / 1000)}s ago
              </span>
            )}
          </div>
        </div>
      )}

      {/* Word Count Progress Bar */}
      {!isZenMode && wordCountTarget && (
        <div className="border-b border-outline-variant/10 bg-surface-container-lowest px-6 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-primary uppercase tracking-wider">Chapter Target</span>
            <span className="text-xs font-bold text-primary">{wordCount.toLocaleString()} / {wordCountTarget.toLocaleString()} words</span>
          </div>
          <div className="w-full h-2 rounded-full bg-outline-variant/20 overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-primary to-secondary transition-all duration-500"
              style={{ width: `${Math.min(100, (wordCount / wordCountTarget) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {!isZenMode && (
        <div className="sticky top-0 z-20 flex flex-col space-y-3 border-b border-outline-variant/10 bg-surface/95 px-4 py-3 backdrop-blur-sm">
          {/* Main Toolbar */}
          <div className="overflow-x-auto">
            <div className="flex min-w-max flex-wrap items-center gap-3">
            {/* Text Formatting */}
            <div className="toolbar-group">
              <button onClick={setParagraph} className={`toolbar-btn ${editor.isActive('paragraph') ? 'toolbar-btn-active' : ''}`} title="Paragraph">P</button>
              <button onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={`toolbar-btn text-sm ${editor.isActive('heading', { level: 1 }) ? 'toolbar-btn-active' : ''}`} title="Heading 1">H1</button>
              <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={`toolbar-btn text-sm ${editor.isActive('heading', { level: 2 }) ? 'toolbar-btn-active' : ''}`} title="Heading 2">H2</button>
              <button onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={`toolbar-btn text-sm ${editor.isActive('heading', { level: 3 }) ? 'toolbar-btn-active' : ''}`} title="Heading 3">H3</button>
            </div>

            {/* Font Styling */}
            <div className="toolbar-group">
              <button onClick={() => editor.chain().focus().toggleBold().run()} disabled={!editor.can().toggleBold()} className={`toolbar-btn ${editor.isActive('bold') ? 'toolbar-btn-active' : ''}`} title="Bold (Ctrl+B)">
                <span className="material-symbols-outlined text-sm">format_bold</span>
              </button>
              <button onClick={() => editor.chain().focus().toggleItalic().run()} disabled={!editor.can().toggleItalic()} className={`toolbar-btn ${editor.isActive('italic') ? 'toolbar-btn-active' : ''}`} title="Italic (Ctrl+I)">
                <span className="material-symbols-outlined text-sm">format_italic</span>
              </button>
              <button onClick={() => editor.chain().focus().toggleStrike().run()} disabled={!editor.can().toggleStrike()} className={`toolbar-btn ${editor.isActive('strike') ? 'toolbar-btn-active' : ''}`} title="Strikethrough">
                <span className="material-symbols-outlined text-sm">format_strikethrough</span>
              </button>
              <button onClick={toggleHighlight} className={`toolbar-btn ${editor.isActive('highlight') ? 'toolbar-btn-active' : ''}`} title="Highlight">
                <span className="material-symbols-outlined text-sm">ink_highlighter</span>
              </button>
            </div>

            {/* Lists & Blocks */}
            <div className="toolbar-group">
              <button onClick={toggleBulletList} className={`toolbar-btn ${editor.isActive('bulletList') ? 'toolbar-btn-active' : ''}`} title="Bullet List">
                <span className="material-symbols-outlined text-sm">format_list_bulleted</span>
              </button>
              <button onClick={toggleOrderedList} className={`toolbar-btn ${editor.isActive('orderedList') ? 'toolbar-btn-active' : ''}`} title="Numbered List">
                <span className="material-symbols-outlined text-sm">format_list_numbered</span>
              </button>
              <button onClick={toggleBlockquote} className={`toolbar-btn ${editor.isActive('blockquote') ? 'toolbar-btn-active' : ''}`} title="Blockquote">
                <span className="material-symbols-outlined text-sm">format_quote</span>
              </button>
            </div>

            {/* Font Size & Family */}
            <div className="toolbar-group">
              <select
                value={fontSize}
                onChange={(e) => setFontSize(e.target.value)}
                className="toolbar-select text-xs"
                title="Font Size"
              >
                <option value="12">12px</option>
                <option value="14">14px</option>
                <option value="16">16px</option>
                <option value="18">18px</option>
                <option value="20">20px</option>
                <option value="24">24px</option>
              </select>
              
              <select
                value={fontFamily}
                onChange={(e) => setFontFamily(e.target.value)}
                className="toolbar-select text-xs"
                title="Font Family"
              >
                <option value="serif">Serif</option>
                <option value="sans-serif">Sans-serif</option>
                <option value="monospace">Monospace</option>
              </select>

              <select
                value={lineSpacing}
                onChange={(e) => setLineSpacing(e.target.value)}
                className="toolbar-select text-xs"
                title="Line Spacing"
              >
                <option value="1.2">Tight (1.2)</option>
                <option value="1.5">Normal (1.5)</option>
                <option value="1.6">Relaxed (1.6)</option>
                <option value="2">Double (2.0)</option>
              </select>
            </div>

            {/* Alignment & Advanced */}
            <div className="toolbar-group">
              <button onClick={() => editor.chain().focus().setTextAlign('left').run()} className={`toolbar-btn ${editor.isActive({ textAlign: 'left' }) ? 'toolbar-btn-active' : ''}`} title="Align Left">
                <span className="material-symbols-outlined text-sm">format_align_left</span>
              </button>
              <button onClick={() => editor.chain().focus().setTextAlign('center').run()} className={`toolbar-btn ${editor.isActive({ textAlign: 'center' }) ? 'toolbar-btn-active' : ''}`} title="Align Center">
                <span className="material-symbols-outlined text-sm">format_align_center</span>
              </button>
              <button onClick={() => editor.chain().focus().setTextAlign('right').run()} className={`toolbar-btn ${editor.isActive({ textAlign: 'right' }) ? 'toolbar-btn-active' : ''}`} title="Align Right">
                <span className="material-symbols-outlined text-sm">format_align_right</span>
              </button>
              <button onClick={insertLink} className={`toolbar-btn ${editor.isActive('link') ? 'toolbar-btn-active' : ''}`} title="Insert Link">
                <span className="material-symbols-outlined text-sm">link</span>
              </button>
            </div>

            {/* Utilities */}
            <div className="toolbar-group">
              <button onClick={() => setShowFindReplace(!showFindReplace)} className="toolbar-btn" title="Find & Replace">
                <span className="material-symbols-outlined text-sm">search</span>
              </button>
              <button onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} className="toolbar-btn" title="Undo">
                <span className="material-symbols-outlined text-sm">undo</span>
              </button>
              <button onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} className="toolbar-btn" title="Redo">
                <span className="material-symbols-outlined text-sm">redo</span>
              </button>
              <button onClick={toggleFocusMode} className={`toolbar-btn ${isFocusMode ? 'toolbar-btn-active' : ''}`} title="Focus Mode (only current paragraph)">
                <span className="material-symbols-outlined text-sm">visibility</span>
              </button>
              <button onClick={toggleFullScreen} className={`toolbar-btn ${isFullScreen ? 'toolbar-btn-active' : ''}`} title="Full Screen">
                <span className="material-symbols-outlined text-sm">{isFullScreen ? 'fullscreen_exit' : 'fullscreen'}</span>
              </button>
              <button onClick={toggleZenMode} className={`toolbar-btn ${isZenMode ? 'toolbar-btn-active' : ''}`} title="Zen Mode (distraction-free)">
                <span className="material-symbols-outlined text-sm">{isZenMode ? 'view_agenda' : 'light_mode'}</span>
              </button>
              <button onClick={toggleTypewriterMode} className={`toolbar-btn ${isTypewriterMode ? 'toolbar-btn-active' : ''}`} title="Typewriter Mode (center line)">
                <span className="material-symbols-outlined text-sm">{isTypewriterMode ? 'unfold_more' : 'unfold_less'}</span>
              </button>
              <button onClick={toggleTrackingChanges} className={`toolbar-btn ${isTrackingChanges ? 'toolbar-btn-active' : ''}`} title="Track Changes (Ctrl+Shift+C)">
                <span className="material-symbols-outlined text-sm">{isTrackingChanges ? 'done_all' : 'edit_note'}</span>
              </button>
            </div>

            {/* Advanced Features */}
            <div className="toolbar-group">
              <button onClick={performGrammarCheck} className="toolbar-btn" title="Grammar Check">
                <span className="material-symbols-outlined text-sm">spellcheck</span>
              </button>
              <button onClick={() => setShowCitationPanel(!showCitationPanel)} className={`toolbar-btn ${showCitationPanel ? 'toolbar-btn-active' : ''}`} title="Insert Citation">
                <span className="material-symbols-outlined text-sm">format_quote</span>
              </button>
              <button onClick={() => setShowLatexInput(!showLatexInput)} className={`toolbar-btn ${showLatexInput ? 'toolbar-btn-active' : ''}`} title="Insert LaTeX">
                <span className="material-symbols-outlined text-sm">functions</span>
              </button>
              <button onClick={() => editor.chain().focus().toggleCodeBlock().run()} className={`toolbar-btn ${editor.isActive('codeBlock') ? 'toolbar-btn-active' : ''}`} title="Code Block">
                <span className="material-symbols-outlined text-sm">code</span>
              </button>
            </div>
          </div>
        </div>

        {/* Find & Replace Panel */}
        {showFindReplace && (
          <div className="flex gap-2 rounded-lg border border-outline-variant/20 bg-surface-container-low p-3">
            <input
              type="text"
              placeholder="Find..."
              value={findText}
              onChange={(e) => setFindText(e.target.value)}
              className="flex-1 rounded border border-outline-variant/10 bg-white px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary/20"
            />
            <input
              type="text"
              placeholder="Replace with..."
              value={replaceText}
              onChange={(e) => setReplaceText(e.target.value)}
              className="flex-1 rounded border border-outline-variant/10 bg-white px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary/20"
            />
            <button
              onClick={handleFind}
              className="rounded-md border border-outline-variant/20 bg-white px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/5"
            >
              Find
            </button>
            <button
              onClick={handleReplace}
              className="rounded-md border border-outline-variant/20 bg-white px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/5"
            >
              Replace
            </button>
          </div>
        )}

        {/* Track Changes Panel */}
        {isTrackingChanges && trackedChanges.length > 0 && (
          <div className="flex flex-col gap-2 rounded-lg border border-yellow-300/30 bg-yellow-50 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-yellow-900 uppercase tracking-wider">
                {trackedChanges.length} change{trackedChanges.length !== 1 ? 's' : ''} tracked
              </span>
              <button
                onClick={() => setTrackedChanges([])}
                className="text-xs font-bold text-yellow-700 hover:text-yellow-900"
              >
                Clear all
              </button>
            </div>
            <div className="flex flex-col gap-1 max-h-[100px] overflow-y-auto">
              {trackedChanges.slice(-5).map((change) => (
                <div key={change.id} className="text-xs p-2 rounded bg-white/60 border border-yellow-200/50">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-yellow-900">
                      {change.type === 'modify' && '✏️ Modified'}
                      {change.type === 'insert' && '➕ Added'}
                      {change.type === 'delete' && '➖ Deleted'}
                    </span>
                    <span className="text-yellow-700">
                      {change.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="text-yellow-800 mt-1 line-clamp-2 italic">
                    {change.author} • {change.type === 'modify' && 'Modified content'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Citation Panel */}
        {showCitationPanel && (
          <div className="flex gap-2 rounded-lg border border-blue-300/30 bg-blue-50 p-3">
            <input
              type="text"
              placeholder="Citation URL..."
              value={citationUrl}
              onChange={(e) => setCitationUrl(e.target.value)}
              className="flex-1 rounded border border-outline-variant/10 bg-white px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary/20"
            />
            <button
              onClick={insertCitation}
              disabled={!citationUrl}
              className="rounded-md border border-blue-300/50 bg-white px-3 py-1.5 text-xs font-bold text-blue-600 hover:bg-blue-50 disabled:opacity-50"
            >
              Insert Citation
            </button>
          </div>
        )}

        {/* LaTeX Panel */}
        {showLatexInput && (
          <div className="flex flex-col gap-2 rounded-lg border border-purple-300/30 bg-purple-50 p-3">
            <textarea
              placeholder="Enter LaTeX equation (e.g., E = mc^2)..."
              value={latexCode}
              onChange={(e) => setLatexCode(e.target.value)}
              className="flex-1 rounded border border-outline-variant/10 bg-white px-3 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary/20 resize-none h-20"
            />
            <div className="flex gap-2">
              <button
                onClick={insertLatex}
                disabled={!latexCode}
                className="rounded-md border border-purple-300/50 bg-white px-3 py-1.5 text-xs font-bold text-purple-600 hover:bg-purple-50 disabled:opacity-50"
              >
                Insert LaTeX
              </button>
              <span className="text-xs text-purple-700 italic">Tip: Use \\frac{}{} for fractions, ^{} for superscript, _{} for subscript</span>
            </div>
          </div>
        )}

        {/* Grammar Issues Panel */}
        {grammarIssues.length > 0 && (
          <div className="flex flex-col gap-2 rounded-lg border border-red-300/30 bg-red-50 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-red-900 uppercase tracking-wider">
                {grammarIssues.length} grammar issue{grammarIssues.length !== 1 ? 's' : ''}
              </span>
              <button
                onClick={() => setGrammarIssues([])}
                className="text-xs font-bold text-red-700 hover:text-red-900"
              >
                Dismiss
              </button>
            </div>
            <div className="flex flex-col gap-1 max-h-[120px] overflow-y-auto">
              {grammarIssues.slice(0, 5).map((issue) => (
                <div key={issue.id} className="text-xs p-2 rounded bg-white/60 border border-red-200/50">
                  <div className="font-semibold text-red-900">{issue.message}</div>
                  <div className="text-red-700 mt-1">Suggestion: {issue.suggestion}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
        )}

      <div className={`flex-1 overflow-auto bg-[#eef0f3] ${compactMode ? 'max-h-[520px]' : ''} ${isTypewriterMode ? 'typewriter-mode' : ''}`} ref={editorContainerRef}>
        <div className="mx-auto max-w-5xl px-4 py-6 md:px-8 md:py-10">
          <div className="rounded-lg border border-outline-variant/15 bg-white shadow-[0_14px_40px_rgba(24,29,45,0.08)]">
            <EditorContent editor={editor} className="writer-editor" />
          </div>
        </div>
      </div>

      {!isZenMode && (
        <div className="flex items-center justify-between border-t border-outline-variant/10 bg-surface-container-lowest px-6 py-4">
          <p className="text-xs text-on-surface-variant">
            Tip: Use ⌘+K (Mac) or Ctrl+K (Windows) to save. Your work is automatically synced.
          </p>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 rounded-lg bg-secondary px-5 py-2.5 text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-50"
          >
            {isSaving && <Spinner className="h-4 w-4" />}
            Save Chapter
          </button>
        </div>
      )}

      <style jsx>{`
        .toolbar-group {
          @apply flex items-center gap-1 border-r border-outline-variant/20 pr-2;
        }

        .toolbar-btn {
          @apply rounded-md border border-outline-variant/20 px-2 py-1.5 text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-primary disabled:cursor-not-allowed disabled:opacity-30;
        }

        .toolbar-btn-active {
          @apply border-secondary/30 bg-secondary/20 text-secondary;
        }

        .toolbar-select {
          @apply rounded-md border border-outline-variant/20 px-2 py-1.5 text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-primary disabled:cursor-not-allowed disabled:opacity-30 bg-white;
        }

        :global(.writer-editor .ProseMirror) {
          min-height: 68vh;
          padding: 2.25rem 2.5rem;
          font-size: ${fontSize}px;
          line-height: 1.85;
          color: #191c1d;
          font-family: var(--font-newsreader), Georgia, serif;
        }

        :global(.writer-editor .ProseMirror:focus) {
          outline: none;
        }

        :global(.writer-editor .ProseMirror p) {
          margin: 0 0 1.05em;
        }

        :global(.writer-editor .ProseMirror h1) {
          font-size: 2rem;
          line-height: 1.2;
          margin: 1.2em 0 0.55em;
          font-family: var(--font-manrope), system-ui, sans-serif;
          font-weight: 700;
        }

        :global(.writer-editor .ProseMirror h2) {
          font-size: 1.6rem;
          line-height: 1.25;
          margin: 1.1em 0 0.5em;
          font-family: var(--font-manrope), system-ui, sans-serif;
          font-weight: 650;
        }

        :global(.writer-editor .ProseMirror h3) {
          font-size: 1.3rem;
          line-height: 1.3;
          margin: 1em 0 0.45em;
          font-family: var(--font-manrope), system-ui, sans-serif;
          font-weight: 650;
        }

        :global(.writer-editor .ProseMirror blockquote) {
          border-left: 4px solid rgba(55, 68, 87, 0.24);
          margin: 1rem 0;
          padding-left: 1rem;
          color: rgba(25, 28, 29, 0.78);
          font-style: italic;
        }

        :global(.writer-editor .ProseMirror ul),
        :global(.writer-editor .ProseMirror ol) {
          padding-left: 1.5rem;
          margin: 0.8rem 0 1rem;
        }

        :global(.writer-editor .ProseMirror code) {
          background: rgba(55, 68, 87, 0.08);
          border-radius: 0.35rem;
          padding: 0.08rem 0.35rem;
          font-size: 0.95em;
        }

        :global(.writer-editor .ProseMirror pre) {
          background: #202633;
          color: #e9eef5;
          border-radius: 0.65rem;
          padding: 0.9rem;
          margin: 1rem 0;
        }

        :global(.writer-editor .ProseMirror .is-editor-empty:first-child::before) {
          color: rgba(117, 118, 132, 0.8);
          content: attr(data-placeholder);
          float: left;
          height: 0;
          pointer-events: none;
        }

        /* Focus Mode Styles */
        ${isFocusMode ? `
          :global(.writer-editor .ProseMirror p) {
            transition: opacity 0.2s ease;
            opacity: 0.35;
          }

          :global(.writer-editor .ProseMirror p:is(.is-selected, .has-focus)) {
            opacity: 1;
          }

          :global(.writer-editor .ProseMirror h1),
          :global(.writer-editor .ProseMirror h2),
          :global(.writer-editor .ProseMirror h3) {
            transition: opacity 0.2s ease;
            opacity: 0.35;
          }

          :global(.writer-editor .ProseMirror h1:is(.is-selected, .has-focus)),
          :global(.writer-editor .ProseMirror h2:is(.is-selected, .has-focus)),
          :global(.writer-editor .ProseMirror h3:is(.is-selected, .has-focus)) {
            opacity: 1;
          }
        ` : ''}

        /* Zen Mode Styles */
        ${isZenMode ? `
          div:has(> .zen-mode) {
            background: linear-gradient(135deg, #f7f4f1 0%, #f5f1ed 100%);
          }

          :global(.zen-mode .writer-editor) {
            background: transparent;
            padding: 0;
          }

          :global(.zen-mode .writer-editor .ProseMirror) {
            min-height: 100vh;
            max-width: 800px;
            margin: 0 auto;
            padding: 10vh 60px 20vh;
            font-size: 18px;
            line-height: 1.85;
            color: #191c1d;
            font-family: var(--font-newsreader), Georgia, serif;
          }

          :global(.zen-mode .writer-editor .ProseMirror:focus) {
            outline: none;
          }

          /* Hide scrollbars in zen mode but allow scrolling */
          :global(.zen-mode) {
            scrollbar-width: none;
            -ms-overflow-style: none;
          }

          :global(.zen-mode::-webkit-scrollbar) {
            display: none;
          }
        ` : ''}

        /* Typewriter Mode Styles */
        ${isTypewriterMode ? `
          :global(.typewriter-mode) {
            position: relative;
          }

          :global(.typewriter-mode::before) {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 50%;
            background: linear-gradient(to bottom, rgba(0, 0, 0, 0.1), transparent);
            pointer-events: none;
            z-index: 10;
          }

          :global(.typewriter-mode::after) {
            content: '';
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            height: 50%;
            background: linear-gradient(to top, rgba(0, 0, 0, 0.1), transparent);
            pointer-events: none;
            z-index: 10;
          }

          :global(.writer-editor .ProseMirror) {
            caret-color: #eb5757;
          }

          /* Typewriter center effect */
          :global(.typewriter-mode .writer-editor) {
            padding: 0;
            background: linear-gradient(180deg, #ffffff 0%, #f5f5f5 100%);
          }

          :global(.typewriter-mode .writer-editor .ProseMirror) {
            min-height: 100%;
            padding-top: 45vh;
            padding-bottom: 45vh;
          }
        ` : ''}

        /* Track Changes Styles */
        ${isTrackingChanges ? `
          :global(.writer-editor .ProseMirror) {
            position: relative;
          }

          :global(.writer-editor .ProseMirror::after) {
            content: '';
            position: absolute;
            top: 0;
            right: -20px;
            width: 20px;
            height: 100%;
            background-color: rgba(234, 179, 8, 0.2);
            border-radius: 0 4px 4px 0;
          }
        ` : ''}

        /* Advanced Features Styles */
        :global(.writer-editor .ProseMirror a[data-citation]) {
          color: #1e88e5;
          text-decoration: underline;
          cursor: help;
          font-size: 0.8em;
          vertical-align: super;
        }

        :global(.writer-editor .ProseMirror a[data-citation]:hover) {
          background-color: rgba(30, 136, 229, 0.1);
          border-radius: 2px;
        }

        :global(.writer-editor .ProseMirror code[data-type="latex"]) {
          background: linear-gradient(135deg, #f5e6ff 0%, #e6f2ff 100%);
          border: 1px solid rgba(124, 58, 255, 0.3);
          border-radius: 4px;
          padding: 4px 8px;
          font-family: 'Courier New', monospace;
          color: #7c3aff;
          font-size: 0.9em;
        }

        :global(.writer-editor .ProseMirror code[data-type="latex"]:before) {
          content: 'ƒ ';
          margin-right: 4px;
          color: #9c27b0;
        }

        :global(.writer-editor .ProseMirror pre) {
          background: #1e1e2e;
          color: #a6e22e;
          border-radius: 8px;
          padding: 12px;
          overflow-x: auto;
          border: 1px solid rgba(166, 226, 46, 0.2);
        }

        :global(.writer-editor .ProseMirror pre code) {
          background: transparent;
          padding: 0;
          color: #a6e22e;
          font-size: 0.9em;
          line-height: 1.6;
        }

        :global(.writer-editor .ProseMirror code) {
          cursor: pointer;
        }

        :global(.writer-editor .ProseMirror code:hover) {
          opacity: 0.8;
        }
      `}</style>
    </div>
  );
}
