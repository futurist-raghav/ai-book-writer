'use client';

import Link from 'next/link';
import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import {
  clearOfflineDraftQueue,
  enqueueOfflineDraft,
  readOfflineDraftQueue,
} from '@/lib/offline-draft-queue';
import { ProjectType, ProjectTypeConfigService } from '@/lib/project-types';
import { cn, formatDate } from '@/lib/utils';
import { Loading, Spinner } from '@/components/ui/spinner';
import { WriterCanvas } from '@/components/writer-canvas-tiptap';
import { useProjectContext } from '@/stores/project-context';

interface AssistantQuickAction {
  id: string;
  label: string;
  icon: string;
  prompt: string;
  tone?: 'secondary' | 'tertiary';
}

const FICTION_QUICK_ACTIONS: AssistantQuickAction[] = [
  {
    id: 'fiction-continue-story',
    label: 'Continue Story',
    icon: 'edit_note',
    prompt: 'Continue the story naturally from the current draft while preserving tone, POV, and emotional momentum.',
    tone: 'secondary',
  },
  {
    id: 'fiction-next-scene',
    label: 'Next Scene',
    icon: 'auto_stories',
    prompt: 'Suggest the next scene with 2-3 compelling options and pick the strongest one with a short rationale.',
    tone: 'secondary',
  },
  {
    id: 'fiction-dialogue',
    label: 'Add Dialogue',
    icon: 'chat_bubble',
    prompt: 'Add natural character dialogue to this section while keeping voice and pacing consistent.',
    tone: 'tertiary',
  },
  {
    id: 'fiction-punch-up',
    label: 'Punch Up',
    icon: 'bolt',
    prompt: 'Punch up this passage with sharper imagery, stronger verbs, and tighter rhythm without changing meaning.',
    tone: 'tertiary',
  },
  {
    id: 'fiction-show-dont-tell',
    label: "Show Don't Tell",
    icon: 'visibility',
    prompt: 'Rewrite this section to show rather than tell, using sensory detail and action over exposition.',
    tone: 'tertiary',
  },
];

const NON_FICTION_QUICK_ACTIONS: AssistantQuickAction[] = [
  {
    id: 'nonfiction-continue-section',
    label: 'Continue Section',
    icon: 'edit_note',
    prompt: 'Continue this section with clear structure, topic coherence, and transitions.',
    tone: 'secondary',
  },
  {
    id: 'nonfiction-add-example',
    label: 'Add Example',
    icon: 'fact_check',
    prompt: 'Add a concrete, relevant example that improves clarity and supports the current point.',
    tone: 'secondary',
  },
  {
    id: 'nonfiction-strengthen-argument',
    label: 'Strengthen Argument',
    icon: 'gavel',
    prompt: 'Strengthen the argument with clearer claims, tighter logic, and counterpoint handling.',
    tone: 'tertiary',
  },
];

const SCREENPLAY_QUICK_ACTIONS: AssistantQuickAction[] = [
  {
    id: 'screenplay-next-scene-direction',
    label: 'Next Scene Direction',
    icon: 'movie_edit',
    prompt: 'Write the next scene direction with clear visual beats, setting cues, and momentum.',
    tone: 'secondary',
  },
  {
    id: 'screenplay-add-subtext',
    label: 'Add Subtext',
    icon: 'forum',
    prompt: 'Rewrite dialogue in this scene to increase subtext while preserving character intent.',
    tone: 'tertiary',
  },
  {
    id: 'screenplay-format-check',
    label: 'Format Check',
    icon: 'task_alt',
    prompt: 'Check this scene for screenplay formatting issues and provide corrected version.',
    tone: 'secondary',
  },
];

const TEXTBOOK_QUICK_ACTIONS: AssistantQuickAction[] = [
  {
    id: 'textbook-next-concept',
    label: 'Next Concept',
    icon: 'school',
    prompt: 'Draft the next concept section with learning objective, explanation, and transition from previous concept.',
    tone: 'secondary',
  },
  {
    id: 'textbook-add-example',
    label: 'Add Example',
    icon: 'fact_check',
    prompt: 'Add a teaching example suitable for learners, with concise explanation and takeaway.',
    tone: 'secondary',
  },
  {
    id: 'textbook-generate-quiz',
    label: 'Generate Quiz Question',
    icon: 'quiz',
    prompt: 'Generate 3 quiz questions (mixed difficulty) with answer keys from this section.',
    tone: 'tertiary',
  },
];

const SONGWRITING_QUICK_ACTIONS: AssistantQuickAction[] = [
  {
    id: 'song-next-verse',
    label: 'Next Verse',
    icon: 'music_note',
    prompt: 'Write the next verse that keeps theme, cadence, and emotional progression consistent.',
    tone: 'secondary',
  },
  {
    id: 'song-add-rhyme',
    label: 'Add Rhyme',
    icon: 'library_music',
    prompt: 'Improve end-rhyme and internal rhyme while keeping the original meaning and vibe.',
    tone: 'tertiary',
  },
  {
    id: 'song-syllable-check',
    label: 'Syllable Check',
    icon: 'straighten',
    prompt: 'Check line-by-line syllable count and suggest edits to tighten rhythmic consistency.',
    tone: 'secondary',
  },
];

interface ChatTurn {
  role: string;
  content: string;
  created_at?: string;
}

interface WorkspaceAsset {
  id: string;
  asset_type: string;
  filename: string;
  created_at: string;
  extracted_text_preview?: string;
}

interface ConsistencyIssueReference {
  chapter_id: string;
  chapter_title: string;
  chapter_number: number;
  chapter_order: number;
  matched_text?: string;
  excerpt?: string;
}

interface ConsistencyIssue {
  id: string;
  issue_type:
    | 'character_name_variation'
    | 'character_appearance_inconsistency'
    | 'timeline_inconsistency'
    | 'location_name_variation'
    | 'terminology_inconsistency';
  severity: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  canonical_value?: string;
  variants: string[];
  references: ConsistencyIssueReference[];
  fix_suggestions: string[];
}

interface ConsistencyCheckPayload {
  chapter_id: string;
  generated_at: string;
  issue_count: number;
  issues: ConsistencyIssue[];
  message: string;
}

interface ChapterWorkspace {
  id: string;
  title: string;
  subtitle?: string;
  summary?: string;
  chapter_number: number;
  chapter_type?: string;
  workflow_status?: string;
  word_count_target?: number;
  target_progress_percent?: number;
  timeline_position?: string;
  word_count?: number;
  status?: string;
  description?: string;
  compiled_content?: string;
  auto_context?: string;
  base_context?: string;
  writing_form: string;
  ai_enhancement_enabled?: boolean;
  transcription_content?: string;
  enhanced_content?: string;
  events?: Array<{ event: { id: string; title: string; summary?: string } }>;
  recent_chat?: ChatTurn[];
  effective_ai_enhancement_enabled?: boolean;
  assets?: WorkspaceAsset[];
}

export default function ChapterWorkspaceClient({ chapterId }: { chapterId: string }) {
  const queryClient = useQueryClient();
  const projectContext = useProjectContext();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [contextDraft, setContextDraft] = useState('');
  const [writingForm, setWritingForm] = useState('memoir');
  const [writerHtml, setWriterHtml] = useState('');
  const [chatMessage, setChatMessage] = useState('');
  const [chatTurns, setChatTurns] = useState<ChatTurn[]>([]);
  const [isContextExpanded, setIsContextExpanded] = useState(false);
  
  const [transcriptionMode, setTranscriptionMode] = useState<'transcribe' | 'translate'>('transcribe');
  const [sourceLanguage, setSourceLanguage] = useState('auto');
  
  const [textTranscript, setTextTranscript] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isZenMode, setIsZenMode] = useState(false);
  const [isSplitView, setIsSplitView] = useState(false);
  const [splitViewNotes, setSplitViewNotes] = useState('');
  const [splitPrefsReady, setSplitPrefsReady] = useState(false);
  
  // Autosave state
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'queued' | 'error'>('idle');
  const [lastSaveTime, setLastSaveTime] = useState<Date | null>(null);
  const [lastSavedContent, setLastSavedContent] = useState<string>('');
  const [isOffline, setIsOffline] = useState(false);
  const [queuedSaveCount, setQueuedSaveCount] = useState(0);
  const [showConsistencyModal, setShowConsistencyModal] = useState(false);
  const [consistencyIssues, setConsistencyIssues] = useState<ConsistencyIssue[]>([]);
  const [consistencyGeneratedAt, setConsistencyGeneratedAt] = useState<string | null>(null);
  const [consistencyMessage, setConsistencyMessage] = useState('');

  const workspaceQuery = useQuery({
    queryKey: ['workspace', chapterId],
    queryFn: () => apiClient.chapters.workspace(chapterId),
  });

  const chapterLookupQuery = useQuery({
    queryKey: ['chapters', 'context-lookup'],
    queryFn: () => apiClient.chapters.list({ limit: 100 }),
  });

  const chapterMeta = useMemo(() => {
    const items = chapterLookupQuery.data?.data?.items || [];
    return items.find((candidate: any) => candidate.id === chapterId);
  }, [chapterLookupQuery.data, chapterId]);

  const projectId = chapterMeta?.projects?.[0]?.id;

  const projectContextQuery = useQuery({
    queryKey: ['book', 'context', projectId],
    queryFn: () => apiClient.books.get(projectId),
    enabled: !!projectId,
  });

  const escapeHtml = (value: string) =>
    value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');

  const plainTextToHtml = useCallback((text: string) => {
    const safe = escapeHtml(text || '').trim();
    if (!safe) {
      return '<p></p>';
    }
    return safe
      .split(/\n{2,}/)
      .map((paragraph) => `<p>${paragraph.replaceAll('\n', '<br>')}</p>`)
      .join('');
  }, []);

  const htmlToPlainText = useCallback((html: string) => {
    if (typeof window === 'undefined') return html;
    const parser = new DOMParser();
    const doc = parser.parseFromString(html || '', 'text/html');
    return (doc.body.textContent || '').trim();
  }, []);

  useEffect(() => {
    if (workspaceQuery.data?.data) {
      const ws = workspaceQuery.data.data;
      if (ws.base_context && !contextDraft) setContextDraft(ws.base_context);
      if (ws.writing_form) setWritingForm(ws.writing_form);
      if (Array.isArray(ws.recent_chat)) setChatTurns(ws.recent_chat);
      if (!writerHtml) {
        const stored = typeof window !== 'undefined' ? localStorage.getItem(`chapter-writer-content-${chapterId}`) : null;
        if (stored) {
          setWriterHtml(stored);
          return;
        }
        const seed =
          ws.compiled_content ||
          ws.description ||
          ws.enhanced_content ||
          ws.transcription_content ||
          '';
        setWriterHtml(seed);
      }
    }
  }, [workspaceQuery.data, contextDraft, writerHtml, chapterId]);

  const stopRecordingTimer = useCallback(() => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  }, []);

  const uploadAudioMutation = useMutation({
    mutationFn: (file: File) => apiClient.audio.upload(file, undefined, {
      transcription_mode: transcriptionMode,
      chapter_id: chapterId,
      source_language: sourceLanguage === 'auto' ? undefined : sourceLanguage,
    }),
    onSuccess: (response) => {
      toast.success('Audio transcribed. Text inserted into canvas.');
      
      // Extract transcription from response
      const transcriptionText = response.data?.transcription_text || 
                                response.data?.transcription || 
                                response.data?.text || '';
      
      if (transcriptionText) {
        // Auto-insert transcription into WriterCanvas
        const newContent = writerHtml + `<p>${plainTextToHtml(transcriptionText)}</p>`;
        setWriterHtml(newContent);
        
        // Dispatch event for WriterCanvas to listen to
        window.dispatchEvent(new CustomEvent('insert-transcription', {
          detail: { text: transcriptionText }
        }));
      }
      
      queryClient.invalidateQueries({ queryKey: ['workspace', chapterId] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Failed to upload audio');
    },
  });

  const uploadAssetMutation = useMutation({
    mutationFn: ({ file, type }: { file: File, type: 'image' | 'document' }) => 
      apiClient.chapters.uploadAsset(chapterId, file, type),
    onSuccess: () => {
      toast.success('Asset uploaded.');
      queryClient.invalidateQueries({ queryKey: ['workspace', chapterId] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Failed to upload asset');
    },
  });

  const saveContextMutation = useMutation({
    mutationFn: (data: { base_context: string; writing_form: string }) =>
      apiClient.chapters.updateContext(chapterId, data),
    onSuccess: () => {
      toast.success('Base context saved.');
      queryClient.invalidateQueries({ queryKey: ['workspace', chapterId] });
    },
  });

  const saveDraftMutation = useMutation({
    mutationFn: (draftHtml: string) =>
      apiClient.chapters.update(chapterId, {
        description: htmlToPlainText(draftHtml),
      }),
    onSuccess: () => {
      if (typeof window !== 'undefined') {
        localStorage.setItem(`chapter-writer-content-${chapterId}`, writerHtml);
      }
      toast.success('Chapter saved successfully.');
      queryClient.invalidateQueries({ queryKey: ['workspace', chapterId] });
      queryClient.invalidateQueries({ queryKey: ['chapters'] });
    },
    onError: () => {
      toast.error('Failed to save chapter.');
    },
  });

  const queueOfflineDraft = useCallback(
    (draftHtml: string) => {
      const nextQueue = enqueueOfflineDraft(chapterId, draftHtml);
      setQueuedSaveCount(nextQueue.length);
    },
    [chapterId]
  );

  const flushQueuedDrafts = useCallback(async () => {
    if (typeof window === 'undefined' || !window.navigator.onLine) {
      return;
    }

    const queuedDrafts = readOfflineDraftQueue(chapterId);
    if (!queuedDrafts.length) {
      return;
    }

    const latestDraft = queuedDrafts[queuedDrafts.length - 1];

    try {
      await saveDraftMutation.mutateAsync(latestDraft);
      clearOfflineDraftQueue(chapterId);
      setQueuedSaveCount(0);
      setSaveStatus('saved');
      setLastSaveTime(new Date());
      setLastSavedContent(latestDraft);
      toast.success('Queued offline changes synced.');
    } catch {
      setSaveStatus('queued');
    }
  }, [chapterId, saveDraftMutation]);

  const compileMutation = useMutation({
    mutationFn: () => apiClient.chapters.compile(chapterId, { regenerate: true, writing_style: writingForm }),
    onSuccess: () => {
      toast.success('Chapter compiled successfully.');
      queryClient.invalidateQueries({ queryKey: ['workspace', chapterId] });
    },
  });

  const generateSummaryMutation = useMutation({
    mutationFn: () => apiClient.chapters.generateSummary(chapterId),
    onSuccess: (res: any) => {
      const generatedSummary = res?.data?.summary;
      if (generatedSummary) {
        toast.success('Chapter summary generated.');
      } else {
        toast.success('Summary generation completed.');
      }
      queryClient.invalidateQueries({ queryKey: ['workspace', chapterId] });
      queryClient.invalidateQueries({ queryKey: ['chapters'] });
    },
    onError: () => {
      toast.error('Failed to generate chapter summary.');
    },
  });

  const generateOutlineMutation = useMutation({
    mutationFn: () => apiClient.chapters.generateOutline(chapterId),
    onSuccess: (res: any) => {
      const outlineText = String(res?.data?.outline || '').trim();
      if (outlineText) {
        setChatTurns((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `Generated Outline:\n\n${outlineText}`,
            created_at: new Date().toISOString(),
          },
        ]);
      }
      toast.success('Chapter outline generated.');
      queryClient.invalidateQueries({ queryKey: ['workspace', chapterId] });
    },
    onError: () => {
      toast.error('Failed to generate chapter outline.');
    },
  });

  const checkConsistencyMutation = useMutation({
    mutationFn: () => apiClient.chapters.checkConsistency(chapterId),
    onSuccess: (res: any) => {
      const payload = res?.data as ConsistencyCheckPayload | undefined;
      const issues = Array.isArray(payload?.issues) ? payload.issues : [];

      setConsistencyIssues(issues);
      setConsistencyGeneratedAt(payload?.generated_at || new Date().toISOString());
      setConsistencyMessage(payload?.message || 'Consistency check completed.');
      setShowConsistencyModal(true);

      if (issues.length > 0) {
        toast.success(`Found ${issues.length} potential consistency issue${issues.length === 1 ? '' : 's'}.`);
      } else {
        toast.success('No major consistency issues detected.');
      }
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Failed to run consistency check.');
    },
  });

  const chatMutation = useMutation({
    mutationFn: (msg: string) => apiClient.chapters.chat(chapterId, { 
      message: msg,
      writing_form: writingForm,
      rewrite_depth: 'deep',
      include_current_compiled_content: true,
      preserve_writer_commitment: true,
    }),
    onSuccess: (res: any) => {
      const assistantMessage = res.data.assistant_message;
      setChatTurns(prev => [...prev, { role: 'assistant', content: assistantMessage, created_at: new Date().toISOString() }]);
      setChatMessage('');
      queryClient.invalidateQueries({ queryKey: ['workspace', chapterId] });
    },
  });

  const generateContextMutation = useMutation({
    mutationFn: () => apiClient.chapters.generateContext(chapterId, { force: true, writing_form: writingForm }),
    onSuccess: (res) => {
      setContextDraft(res.data.base_context);
      toast.success('Context generated from events.');
    },
  });

  const addTranscriptMutation = useMutation({
    mutationFn: async (text: string) => {
      const evRes = await apiClient.events.create({
        title: `Event from Input ${formatDate(new Date().toISOString())}`,
        content: text,
      });
      return apiClient.chapters.addEvent(chapterId, evRes.data.id);
    },
    onSuccess: () => {
      // Also insert into WriterCanvas for seamless workflow
      const newContent = writerHtml + `<p>${plainTextToHtml(textTranscript)}</p>`;
      setWriterHtml(newContent);
      
      setTextTranscript('');
      toast.success('Text added to chapter and Event Spine.');
      queryClient.invalidateQueries({ queryKey: ['workspace', chapterId] });
    },
  });

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const file = new File([audioBlob], `recording-${Date.now()}.webm`, { type: 'audio/webm' });
        uploadAudioMutation.mutate(file);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      toast.error('Could not access microphone');
    }
  }, [chapterId, transcriptionMode, sourceLanguage, uploadAudioMutation]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      stopRecordingTimer();
    }
  }, [isRecording, stopRecordingTimer]);

  useEffect(() => {
    return () => {
      stopRecordingTimer();
      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop();
      }
    };
  }, [isRecording, stopRecordingTimer]);

  // Keyboard shortcut for Zen Mode (Cmd+Shift+F)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'F') {
        e.preventDefault();
        setIsZenMode((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Split view preferences are stored per chapter for continuity between sessions.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const savedSplitMode = localStorage.getItem(`chapter-split-view-${chapterId}`);
    const savedSplitNotes = localStorage.getItem(`chapter-split-notes-${chapterId}`);

    setIsSplitView(savedSplitMode === '1');
    setSplitViewNotes(savedSplitNotes || '');
    setSplitPrefsReady(true);
  }, [chapterId]);

  useEffect(() => {
    if (!splitPrefsReady || typeof window === 'undefined') return;

    localStorage.setItem(`chapter-split-view-${chapterId}`, isSplitView ? '1' : '0');
    localStorage.setItem(`chapter-split-notes-${chapterId}`, splitViewNotes);
  }, [chapterId, isSplitView, splitViewNotes, splitPrefsReady]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const initialQueuedCount = readOfflineDraftQueue(chapterId).length;
    setIsOffline(!window.navigator.onLine);
    setQueuedSaveCount(initialQueuedCount);

    if (window.navigator.onLine && initialQueuedCount > 0) {
      void flushQueuedDrafts();
    }

    const handleOnline = () => {
      setIsOffline(false);
      void flushQueuedDrafts();
    };

    const handleOffline = () => {
      setIsOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [chapterId, flushQueuedDrafts]);

  // Autosave with debouncing (2 seconds of inactivity)
  useEffect(() => {
    if (!writerHtml || !chapterId) return;

    // Set status to 'saving' immediately
    setSaveStatus('saving');
    
    const debounceTimer = setTimeout(async () => {
      try {
        if (typeof window !== 'undefined' && !window.navigator.onLine) {
          queueOfflineDraft(writerHtml);
          setSaveStatus('queued');
          return;
        }

        await saveDraftMutation.mutateAsync(writerHtml);
        setSaveStatus('saved');
        setLastSaveTime(new Date());
        setLastSavedContent(writerHtml);
        
        // Clear saved status after 2 seconds
        setTimeout(() => {
          setSaveStatus('idle');
        }, 2000);
      } catch (err) {
        if (typeof window !== 'undefined' && !window.navigator.onLine) {
          queueOfflineDraft(writerHtml);
          setSaveStatus('queued');
        } else {
          console.error('Autosave failed:', err);
          setSaveStatus('error');
        }
      }
    }, 2000); // Wait 2 seconds after last change
    
    return () => {
      clearTimeout(debounceTimer);
    };
  }, [writerHtml, chapterId, queueOfflineDraft, saveDraftMutation]);

  // Update browser tab title to show unsaved indicator
  useEffect(() => {
    const chapterTitle = workspaceQuery.data?.data?.title || 'Chapter';
    const hasUnsavedChanges = writerHtml && lastSavedContent && writerHtml !== lastSavedContent;
    const prefix = hasUnsavedChanges ? '● ' : '';
    document.title = `${prefix}${chapterTitle} - AI Book Writer`;
  }, [writerHtml, lastSavedContent, workspaceQuery.data?.data?.title]);

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (file.type.startsWith('audio/')) {
        uploadAudioMutation.mutate(file);
      } else {
        const type = file.type.startsWith('image/') ? 'image' : 'document';
        uploadAssetMutation.mutate({ file, type });
      }
      e.target.value = '';
    }
  };

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim() || chatMutation.isPending) return;

    const projectContext = projectContextQuery.data?.data;
    const writerPlainText = htmlToPlainText(writerHtml).slice(0, 4500);
    const contextEnvelope = [
      'System Context Pack:',
      `Project Title: ${projectContext?.title || 'Unknown'}`,
      `Project Genres: ${Array.isArray(projectContext?.genres) ? projectContext.genres.join(', ') : 'Not set'}`,
      `Project Book Type: ${projectContext?.book_type || 'Not set'}`,
      `Project Context Brief: ${projectContext?.project_context || 'Not set'}`,
      `Chapter Base Context: ${contextDraft || 'Not set'}`,
      `Current Chapter Draft (excerpt): ${writerPlainText || 'No manual draft yet.'}`,
      '',
      `Writer request: ${chatMessage}`,
    ].join('\n');

    const newTurn: ChatTurn = { role: 'user', content: chatMessage };
    setChatTurns((prev) => [...prev, newTurn]);
    chatMutation.mutate(contextEnvelope);
  };

  const handleQuickAction = useCallback((actionPrompt: string) => {
    if (chatMutation.isPending) return;
    
    const projectContext = projectContextQuery.data?.data;
    const writerPlainText = htmlToPlainText(writerHtml).slice(0, 4500);
    const contextEnvelope = [
      'System Context Pack:',
      `Project Title: ${projectContext?.title || 'Unknown'}`,
      `Project Genres: ${Array.isArray(projectContext?.genres) ? projectContext.genres.join(', ') : 'Not set'}`,
      `Project Book Type: ${projectContext?.book_type || 'Not set'}`,
      `Project Context Brief: ${projectContext?.project_context || 'Not set'}`,
      `Chapter Base Context: ${contextDraft || 'Not set'}`,
      `Current Chapter Draft (excerpt): ${writerPlainText || 'No manual draft yet.'}`,
      '',
      `Writer request: ${actionPrompt}`,
    ].join('\n');

    const newTurn: ChatTurn = { role: 'user', content: actionPrompt };
    setChatTurns((prev) => [...prev, newTurn]);
    chatMutation.mutate(contextEnvelope);
    setChatMessage('');
  }, [writerHtml, contextDraft, htmlToPlainText, chatMutation, projectContextQuery.data]);

  const applyConsistencyReplacement = useCallback((sourceValue: string, targetValue: string) => {
    const source = sourceValue.trim();
    const target = targetValue.trim();

    if (!source || !target || source === target) {
      return;
    }

    const escaped = source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`\\b${escaped}\\b`, 'g');

    if (!pattern.test(writerHtml)) {
      toast.error(`No exact matches for "${source}" were found in the current draft.`);
      return;
    }

    const nextHtml = writerHtml.replace(pattern, target);
    setWriterHtml(nextHtml);
    toast.success(`Replaced "${source}" with "${target}" in the current draft.`);
  }, [writerHtml]);

  const draftConsistencyFixPrompt = useCallback((issue: ConsistencyIssue) => {
    const referenceLines = issue.references
      .slice(0, 5)
      .map((reference) => {
        const highlighted = reference.matched_text ? ` (${reference.matched_text})` : '';
        return `- Chapter ${reference.chapter_number}: ${reference.chapter_title}${highlighted}`;
      })
      .join('\n');

    const promptSections = [
      'Help me resolve this manuscript consistency issue:',
      `Issue: ${issue.title}`,
      `Details: ${issue.description}`,
      issue.canonical_value ? `Preferred canonical value: ${issue.canonical_value}` : '',
      issue.variants.length ? `Variants: ${issue.variants.join(', ')}` : '',
      referenceLines ? `References:\n${referenceLines}` : '',
      'Please suggest exact rewrites and a minimal change plan chapter-by-chapter.',
    ].filter(Boolean);

    setChatMessage(promptSections.join('\n\n'));
    setShowConsistencyModal(false);
    toast.success('Added a consistency fix prompt to the assistant input.');
  }, []);

  const issueTypeLabel = (issueType: ConsistencyIssue['issue_type']) => {
    if (issueType === 'character_name_variation') return 'Character';
    if (issueType === 'character_appearance_inconsistency') return 'Appearance';
    if (issueType === 'location_name_variation') return 'Location';
    if (issueType === 'terminology_inconsistency') return 'Terminology';
    return 'Timeline';
  };

  const issueSeverityClass = (severity: ConsistencyIssue['severity']) => {
    if (severity === 'high') return 'bg-red-100 text-red-700 border-red-200';
    if (severity === 'low') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    return 'bg-amber-100 text-amber-700 border-amber-200';
  };

  const appendSplitNotesToDraft = () => {
    if (!splitViewNotes.trim()) {
      toast.error('Add notes before inserting into the draft.');
      return;
    }

    setWriterHtml((prev) => `${prev}${prev ? '<p></p>' : ''}${plainTextToHtml(splitViewNotes)}`);
    toast.success('Notes inserted into draft.');
  };

  const resolvedProjectType = useMemo(() => {
    const candidate = String(
      projectContextQuery.data?.data?.project_type || projectContextQuery.data?.data?.book_type || ''
    )
      .trim()
      .toLowerCase();

    return candidate as ProjectType | '';
  }, [projectContextQuery.data?.data?.book_type, projectContextQuery.data?.data?.project_type]);

  const assistantQuickActionConfig = useMemo(() => {
    const fallback = {
      label: 'Non-Fiction',
      actions: NON_FICTION_QUICK_ACTIONS,
    };

    if (!resolvedProjectType) {
      return fallback;
    }

    const config = ProjectTypeConfigService.getConfig(resolvedProjectType as ProjectType);
    const isTextbookType = [
      ProjectType.K12_TEXTBOOK,
      ProjectType.COLLEGE_TEXTBOOK,
      ProjectType.ACADEMIC_COURSE,
    ].includes(resolvedProjectType as ProjectType);

    if (resolvedProjectType === ProjectType.SONGWRITING_PROJECT || config.aiAssistantMode === 'songwriting') {
      return {
        label: 'Songwriting',
        actions: SONGWRITING_QUICK_ACTIONS,
      };
    }

    if (isTextbookType) {
      return {
        label: 'Textbook',
        actions: TEXTBOOK_QUICK_ACTIONS,
      };
    }

    if (config.aiAssistantMode === 'screenplay') {
      return {
        label: 'Screenplay',
        actions: SCREENPLAY_QUICK_ACTIONS,
      };
    }

    if (config.aiAssistantMode === 'fiction') {
      return {
        label: 'Fiction',
        actions: FICTION_QUICK_ACTIONS,
      };
    }

    return fallback;
  }, [resolvedProjectType]);

  if (workspaceQuery.isLoading) {
    return <Loading message="Loading chapter workspace..." />;
  }

  if (workspaceQuery.isError || !workspaceQuery.data?.data) {
    return (
      <div className="flex h-[50vh] flex-col items-center justify-center text-center">
        <span className="material-symbols-outlined text-4xl text-muted-foreground mb-4">error</span>
        <h2 className="text-xl font-bold">Failed to load workspace</h2>
        <button onClick={() => workspaceQuery.refetch()} className="mt-4 px-4 py-2 bg-primary text-white rounded-lg">Try Again</button>
      </div>
    );
  }

  const workspace = workspaceQuery.data.data;
  const chapter = workspace;
  const writerPlainText = htmlToPlainText(writerHtml);
  const writerWordCount = writerPlainText ? writerPlainText.split(/\s+/).length : 0;
  const chapterTargetProgress =
    typeof chapter.target_progress_percent === 'number'
      ? Math.max(0, Math.min(100, Math.round(chapter.target_progress_percent)))
      : chapter.word_count_target && chapter.word_count_target > 0
        ? Math.max(0, Math.min(100, Math.round(((chapter.word_count || 0) / chapter.word_count_target) * 100)))
        : null;
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };
  
  const forms = ['memoir', 'autobiography', 'novel', 'business', 'self-help', 'essay', 'journal', 'screenplay'];

  // Zen Mode (Distraction-Free) Layout
  if (isZenMode) {
    return (
      <div className="fixed inset-0 z-50 bg-white flex flex-col">
        {/* Minimal Zen Mode Toolbar */}
        <div className="h-12 border-b border-outline-variant/10 flex items-center justify-between px-6 bg-white/95 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-bold text-primary italic font-headline">{chapter?.title}</h1>
            {writerHtml && lastSavedContent && writerHtml !== lastSavedContent && (
              <span className="text-orange-600 text-lg" title="Unsaved changes">●</span>
            )}
            <span className="text-xs text-on-surface-variant">
              {writerWordCount.toLocaleString()} words
            </span>
            
            {/* Autosave Status Indicator */}
            <div className="ml-4 flex items-center gap-2">
              {saveStatus === 'queued' && (
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200">
                  <span className="material-symbols-outlined text-amber-700 text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>cloud_off</span>
                  <span className="text-[10px] font-semibold text-amber-700">
                    Queued{queuedSaveCount > 0 ? ` (${queuedSaveCount})` : ''}
                  </span>
                </div>
              )}
              {saveStatus === 'saving' && (
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-50 border border-orange-200">
                  <div className="w-1 h-1 rounded-full bg-orange-500 animate-pulse"></div>
                  <span className="text-[10px] font-semibold text-orange-700">Saving...</span>
                </div>
              )}
              {saveStatus === 'saved' && (
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200">
                  <span className="material-symbols-outlined text-emerald-600 text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                  <span className="text-[10px] font-semibold text-emerald-700">Saved</span>
                </div>
              )}
              {saveStatus === 'error' && (
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 border border-red-200">
                  <span className="material-symbols-outlined text-red-600 text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>error</span>
                  <span className="text-[10px] font-semibold text-red-700">Save Failed</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              title="Exit Zen Mode (Cmd+Shift+F)"
              onClick={() => setIsZenMode(false)}
              className="p-2 hover:bg-surface-container-low rounded-lg transition-all"
            >
              <span className="material-symbols-outlined text-primary text-lg">fullscreen_exit</span>
            </button>
            <button 
              onClick={() => compileMutation.mutate()}
              disabled={compileMutation.isPending}
              className="bg-gradient-to-r from-primary to-primary-container text-white px-4 py-1.5 rounded-lg font-medium text-xs shadow-sm hover:opacity-90 transition-all disabled:opacity-50 flex items-center"
            >
              {compileMutation.isPending ? <Spinner className="w-3 h-3 mr-1" /> : null}
              Compile
            </button>
          </div>
        </div>

        {/* Full-width WriterCanvas */}
        <div className="flex-grow overflow-hidden p-8">
          <WriterCanvas
            chapterId={chapterId}
            initialContent={writerHtml || workspace.description || workspace.compiled_content || ''}
            onSave={async (content) => {
              await saveDraftMutation.mutateAsync(content);
            }}
            onContentChange={(html) => {
              setWriterHtml(html);
              if (projectContext && projectContext.updateChapterContent) {
                projectContext.updateChapterContent(chapterId, html);
              }
            }}
            showAiAssistant={Boolean(workspace.effective_ai_enhancement_enabled ?? workspace.ai_enhancement_enabled)}
            readOnly={false}
            projectType={projectContextQuery.data?.data?.project_type}
          />
        </div>
      </div>
    );
  }

  // Normal Layout
  return (
    <>
      <header className="fixed top-0 left-0 lg:left-72 z-40 w-[calc(100%-18rem)] hidden lg:flex h-20 items-center justify-between px-8 bg-[#f8f9fa]/80 backdrop-blur-md shadow-[0_4px_20px_rgba(25,28,29,0.06)]">
        <div className="flex items-center gap-6">
          <Link href="/dashboard/chapters" className="hover:bg-surface-container-low p-2 rounded-full transition-all active:scale-95">
            <span className="material-symbols-outlined text-primary">arrow_back</span>
          </Link>
          <div>
            <span className="text-xs text-secondary font-semibold uppercase tracking-widest block mb-0.5">Workspace</span>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-primary italic font-headline tracking-tight">{chapter?.title || 'Chapter Workspace'}</h1>
              {writerHtml && lastSavedContent && writerHtml !== lastSavedContent && (
                <span className="text-orange-600 text-xl" title="Unsaved changes">●</span>
              )}
            </div>
          </div>
          
          {/* Autosave Status Indicator */}
          <div className="ml-6 flex items-center gap-2">
            {saveStatus === 'queued' && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200">
                <span className="material-symbols-outlined text-amber-700 text-base" style={{ fontVariationSettings: "'FILL' 1" }}>cloud_off</span>
                <span className="text-xs font-semibold text-amber-700">
                  Queued{queuedSaveCount > 0 ? ` (${queuedSaveCount})` : ''}
                </span>
              </div>
            )}
            {saveStatus === 'saving' && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-50 border border-orange-200">
                <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"></div>
                <span className="text-xs font-semibold text-orange-700">Saving...</span>
              </div>
            )}
            {saveStatus === 'saved' && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200">
                <span className="material-symbols-outlined text-emerald-600 text-base" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                <span className="text-xs font-semibold text-emerald-700">Saved</span>
              </div>
            )}
            {saveStatus === 'error' && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-50 border border-red-200">
                <span className="material-symbols-outlined text-red-600 text-base" style={{ fontVariationSettings: "'FILL' 1" }}>error</span>
                <span className="text-xs font-semibold text-red-700">Save Failed</span>
              </div>
            )}
            {lastSaveTime && saveStatus === 'idle' && (
              <span className="text-xs text-on-surface-variant">Saved {lastSaveTime.toLocaleTimeString()}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button
            title="Toggle Split View"
            onClick={() => setIsSplitView((prev) => !prev)}
            className={cn(
              'p-2 rounded-lg transition-all active:scale-95',
              isSplitView ? 'bg-secondary/10 text-secondary' : 'hover:bg-surface-container-low text-primary'
            )}
          >
            <span className="material-symbols-outlined">splitscreen</span>
          </button>
          <button 
            title="Zen Mode (Cmd+Shift+F)"
            onClick={() => setIsZenMode(true)}
            className="p-2 hover:bg-surface-container-low rounded-lg transition-all active:scale-95"
          >
            <span className="material-symbols-outlined text-primary">fullscreen</span>
          </button>
          <button 
            onClick={() => compileMutation.mutate()}
            disabled={compileMutation.isPending}
            className="bg-gradient-to-r from-primary to-primary-container text-white px-6 py-2.5 rounded-lg font-medium text-sm shadow-sm hover:opacity-90 transition-all active:scale-95 disabled:opacity-50 flex items-center"
          >
            {compileMutation.isPending ? <Spinner className="w-4 h-4 mr-2" /> : null}
            Compile Chapter
          </button>
        </div>
      </header>

      {(isOffline || queuedSaveCount > 0) && (
        <div className="mx-auto mt-3 max-w-[1700px] px-4 md:px-8">
          <div
            className={cn(
              'rounded-lg border px-4 py-2 text-xs font-semibold',
              isOffline
                ? 'border-amber-300 bg-amber-50 text-amber-800'
                : 'border-emerald-300 bg-emerald-50 text-emerald-800'
            )}
          >
            {isOffline
              ? `You are offline. Draft saves are queued${queuedSaveCount > 0 ? ` (${queuedSaveCount})` : ''} and will sync when back online.`
              : `Back online. ${queuedSaveCount} queued draft save${queuedSaveCount === 1 ? '' : 's'} syncing automatically.`}
          </div>
        </div>
      )}

      <div className="mx-auto mt-4 grid max-w-[1700px] grid-cols-1 gap-6 pb-32 xl:mt-8 xl:grid-cols-12">
        <div className="space-y-6 xl:col-span-2">
          <section className="rounded-xl border border-outline-variant/10 bg-surface-container-low p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-primary">Chapter Context</h2>
                <p className="mt-1 text-[10px] font-medium uppercase tracking-wider text-slate-400">Optional per-chapter brief</p>
              </div>
              <button
                type="button"
                onClick={() => setIsContextExpanded((prev) => !prev)}
                className="rounded-lg border border-outline-variant/20 bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-primary"
              >
                {isContextExpanded ? 'Hide' : 'Edit'}
              </button>
            </div>

            {!isContextExpanded ? (
              <div className="space-y-3">
                <p className="line-clamp-5 rounded-lg border border-outline-variant/15 bg-white p-3 text-xs text-on-surface-variant">
                  {contextDraft?.trim() || 'No chapter context saved yet. Use Edit to generate or write one.'}
                </p>
                <Link
                  href="/dashboard/project-settings"
                  className="flex items-center justify-between rounded-lg border border-outline-variant/20 bg-white px-3 py-2 text-xs font-bold text-primary hover:border-secondary/30"
                >
                  Project Settings
                  <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </Link>
              </div>
            ) : (
              <>
                <textarea
                  className="mb-4 h-32 w-full resize-none rounded-lg border border-outline-variant/20 bg-white p-3 text-sm font-body focus:outline-none focus:ring-1 focus:ring-secondary/50"
                  placeholder="Chapter narrative context..."
                  value={contextDraft}
                  onChange={(e) => setContextDraft(e.target.value)}
                />

                <div className="mb-6 flex flex-wrap gap-2">
                  {forms.map((form) => (
                    <span
                      key={form}
                      onClick={() => setWritingForm(form)}
                      className={cn(
                        'cursor-pointer rounded-full border px-3 py-1 font-label text-[10px] font-bold transition-colors',
                        writingForm === form
                          ? 'border-primary bg-primary text-white'
                          : 'border-outline-variant/20 bg-white text-on-surface-variant hover:bg-primary/5'
                      )}
                    >
                      {form}
                    </span>
                  ))}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => generateContextMutation.mutate()}
                    disabled={generateContextMutation.isPending}
                    className="flex flex-1 items-center justify-center rounded-lg border border-primary/20 py-2 text-xs font-bold text-primary transition-all hover:bg-white"
                  >
                    {generateContextMutation.isPending && <Spinner className="mr-1 h-3 w-3" />}
                    Regenerate
                  </button>
                  <button
                    onClick={() => saveContextMutation.mutate({ base_context: contextDraft, writing_form: writingForm })}
                    disabled={saveContextMutation.isPending}
                    className="flex flex-1 items-center justify-center rounded-lg bg-primary py-2 text-xs font-bold text-white shadow-sm transition-all hover:opacity-90"
                  >
                    {saveContextMutation.isPending && <Spinner className="mr-1 h-3 w-3" />}
                    Save
                  </button>
                </div>
              </>
            )}
          </section>

          <section className="rounded-xl border border-outline-variant/10 bg-surface-container-low p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-primary">Chapter Metadata</h2>

            <div className="mb-4 space-y-3 rounded-lg border border-outline-variant/20 bg-white p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-surface-container-high px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                  {chapter.workflow_status || 'draft'}
                </span>
                <span className="rounded-full bg-surface-container-high px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                  {chapter.chapter_type || 'chapter'}
                </span>
                {chapter.timeline_position ? (
                  <span className="rounded-full bg-secondary-container px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-on-secondary-fixed-variant">
                    {chapter.timeline_position}
                  </span>
                ) : null}
              </div>

              <p className="text-[11px] text-on-surface-variant">
                {chapter.word_count?.toLocaleString() || 0} words in this chapter.
              </p>

              {chapter.word_count_target ? (
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-[10px] font-label uppercase tracking-widest text-on-surface-variant">Goal Progress</span>
                    <span className="text-[10px] font-label uppercase tracking-widest text-on-surface-variant">
                      {chapterTargetProgress}% of {chapter.word_count_target.toLocaleString()}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-surface-container-high">
                    <div
                      className="h-full rounded-full bg-secondary"
                      style={{ width: `${chapterTargetProgress || 0}%` }}
                    />
                  </div>
                </div>
              ) : (
                <p className="text-[10px] uppercase tracking-widest text-on-surface-variant">No target word count set</p>
              )}

              {chapter.summary ? (
                <div className="rounded-md border border-outline-variant/20 bg-surface-container-low p-2">
                  <p className="mb-1 text-[10px] font-label uppercase tracking-widest text-on-surface-variant">Summary</p>
                  <p className="line-clamp-4 text-xs text-on-surface-variant">{chapter.summary}</p>
                </div>
              ) : (
                <p className="text-[10px] uppercase tracking-widest text-on-surface-variant">No summary generated yet</p>
              )}
            </div>

            <div className="space-y-2">
              <Link
                href="/dashboard/project-settings"
                className="flex items-center justify-between rounded-lg border border-outline-variant/20 bg-white px-3 py-2 text-xs font-bold text-primary hover:border-secondary/30"
              >
                Project AI & Defaults
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </Link>
              <Link
                href="/dashboard/events"
                className="flex items-center justify-between rounded-lg border border-outline-variant/20 bg-white px-3 py-2 text-xs font-bold text-primary hover:border-secondary/30"
              >
                Open Event Spine
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </Link>
            </div>
          </section>
        </div>

        <div className="space-y-8 xl:col-span-7">
          <section className="rounded-xl border border-outline-variant/10 bg-white p-4 shadow-sm">
            <div className="mb-4 flex flex-col gap-2 border-b border-outline-variant/10 pb-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">Writing Workspace</p>
                <h2 className="font-body text-2xl italic text-primary">{chapter.title}</h2>
              </div>
              <div className="flex items-center gap-3">
                <p className="text-xs text-on-surface-variant">
                  {writerWordCount.toLocaleString()} live words • Chapter {chapter.chapter_number}
                </p>
                <button
                  onClick={() => setIsSplitView((prev) => !prev)}
                  className={cn(
                    'rounded-lg border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors',
                    isSplitView
                      ? 'border-secondary/30 bg-secondary/10 text-secondary'
                      : 'border-outline-variant/20 bg-white text-primary hover:border-secondary/30'
                  )}
                >
                  {isSplitView ? 'Single Pane' : 'Split View'}
                </button>
              </div>
            </div>

            <div className={cn('grid gap-4', isSplitView ? 'lg:grid-cols-2' : 'grid-cols-1')}>
              <div>
                <WriterCanvas
                  chapterId={chapterId}
                  initialContent={writerHtml || workspace.description || workspace.compiled_content || ''}
                  onSave={async (content) => {
                    await saveDraftMutation.mutateAsync(content);
                  }}
                  onContentChange={(html) => {
                    setWriterHtml(html);
                    if (projectContext && projectContext.updateChapterContent) {
                      projectContext.updateChapterContent(chapterId, html);
                    }
                  }}
                  showAiAssistant={Boolean(workspace.effective_ai_enhancement_enabled ?? workspace.ai_enhancement_enabled)}
                  readOnly={false}
                  projectType={projectContextQuery.data?.data?.project_type}
                />
              </div>

              {isSplitView ? (
                <aside className="flex h-full flex-col rounded-xl border border-outline-variant/10 bg-surface-container-low p-4">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">Split Notes</p>
                      <p className="mt-1 text-xs text-on-surface-variant">Keep side notes and snippets while drafting.</p>
                    </div>
                    <span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-primary">
                      {splitViewNotes.trim() ? `${splitViewNotes.trim().split(/\s+/).length} words` : '0 words'}
                    </span>
                  </div>

                  <textarea
                    className="min-h-[280px] w-full flex-1 resize-none rounded-lg border border-outline-variant/20 bg-white p-3 text-sm font-body focus:outline-none focus:ring-1 focus:ring-secondary/40"
                    placeholder="Capture loose ideas, scene fragments, references, or rewrite targets..."
                    value={splitViewNotes}
                    onChange={(e) => setSplitViewNotes(e.target.value)}
                  />

                  <div className="mt-3 flex items-center justify-between gap-2">
                    <button
                      onClick={() => setSplitViewNotes('')}
                      className="rounded-lg border border-outline-variant/20 bg-white px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-primary"
                    >
                      Clear Notes
                    </button>
                    <button
                      onClick={appendSplitNotesToDraft}
                      className="rounded-lg bg-primary px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white"
                    >
                      Insert Into Draft
                    </button>
                  </div>
                </aside>
              ) : null}
            </div>
          </section>

          {/* Capture Inputs Section */}
          <section className="bg-white rounded-xl p-6 shadow-sm border border-outline-variant/10">
            <h2 className="text-sm font-bold text-primary uppercase tracking-wider mb-6">Capture Inputs</h2>

            <div className="flex gap-4 mb-6">
              <button
                onClick={isRecording ? stopRecording : startRecording}
                className={cn(
                  'flex-1 flex flex-col items-center gap-3 p-6 border rounded-2xl transition-all group',
                  isRecording
                    ? 'bg-error/10 border-error/20 hover:bg-error/20'
                    : 'bg-secondary-container/30 border-secondary/20 hover:bg-secondary-container/50'
                )}
              >
                {isRecording ? (
                  <>
                    <span className="material-symbols-outlined text-error text-3xl animate-pulse" style={{ fontVariationSettings: "'FILL' 1" }}>stop_circle</span>
                    <span className="text-xs font-bold text-error">Stop ({formatTime(recordingSeconds)})</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-secondary text-3xl group-active:scale-90 transition-transform">mic</span>
                    <span className="text-xs font-bold text-on-secondary-fixed-variant">Start Recording</span>
                  </>
                )}
              </button>

              <div
                className="flex-1 flex flex-col items-center gap-3 p-6 bg-surface-container-low border border-outline-variant/20 rounded-2xl hover:bg-surface-container-high transition-all cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <span className="material-symbols-outlined text-primary/60 text-3xl">upload_file</span>
                <span className="text-xs font-bold text-primary/70">Upload Source</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold ml-1">Source Language</label>
                <select
                  className="w-full bg-surface-container-low border-none rounded-lg text-xs font-medium focus:ring-secondary/20"
                  value={sourceLanguage}
                  onChange={(e) => setSourceLanguage(e.target.value)}
                >
                  <option value="auto">Auto-Detect</option>
                  <option value="en">English</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                  <option value="hi">Hindi</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold ml-1">Mode</label>
                <select
                  className="w-full bg-surface-container-low border-none rounded-lg text-xs font-medium focus:ring-secondary/20"
                  value={transcriptionMode}
                  onChange={(e) => setTranscriptionMode(e.target.value as 'transcribe' | 'translate')}
                >
                  <option value="transcribe">Transcribe</option>
                  <option value="translate">Translate to English</option>
                </select>
              </div>
            </div>

            <textarea
              className="w-full bg-surface-container-low border-none rounded-xl text-xs font-body p-4 focus:ring-primary/10 resize-none placeholder:text-slate-400 min-h-[100px]"
              placeholder="Paste source notes here. Will be added to canvas and Event Spine..."
              value={textTranscript}
              onChange={(e) => setTextTranscript(e.target.value)}
            />
            <button
              onClick={() => addTranscriptMutation.mutate(textTranscript)}
              disabled={!textTranscript.trim() || addTranscriptMutation.isPending}
              className="w-full mt-2 py-3 bg-surface-container-low text-primary text-xs font-bold rounded-lg border border-transparent hover:border-primary/10 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {addTranscriptMutation.isPending ? <Spinner className="w-4 h-4 text-primary" /> : <span className="material-symbols-outlined text-sm">add_circle</span>}
              Add to Canvas & Event Spine
            </button>
          </section>
        </div>

        <div className="space-y-8 xl:col-span-3">
          <section className="bg-surface-container-low rounded-xl p-6 shadow-sm border border-outline-variant/10">
            <h2 className="text-sm font-bold text-primary uppercase tracking-wider mb-6">Reference Assets</h2>
            <div className="grid grid-cols-2 gap-3 mb-6">
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center gap-2 p-4 bg-white rounded-lg border border-outline-variant/10 hover:border-primary/20 transition-all"
              >
                <span className="material-symbols-outlined text-primary/40">add_a_photo</span>
                <span className="text-[10px] font-bold text-primary/60 uppercase text-center">Add File</span>
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                onChange={handleFileUpload}
                accept="audio/*,image/*,.pdf,.doc,.docx,.txt" 
              />
            </div>
            
            {workspace.assets && workspace.assets.length > 0 ? (
              <div className="space-y-3">
                {workspace.assets.map((a: any) => (
                  <div key={a.id} className="flex items-center gap-3 p-3 bg-white rounded border border-outline-variant/10">
                    <span className="material-symbols-outlined text-slate-400 text-lg">
                      {a.asset_type.includes('image') ? 'image' : 'description'}
                    </span>
                    <span className="text-xs truncate font-medium flex-1" title={a.filename}>{a.filename}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-lg">
                <p className="text-[10px] text-slate-400 font-medium uppercase tracking-tighter">No assets uploaded yet</p>
              </div>
            )}
          </section>

          <section className="bg-white rounded-xl shadow-lg border border-outline-variant/10 overflow-hidden flex flex-col h-[500px]">
            <div className="bg-primary p-4 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center">
                <span className="material-symbols-outlined text-white text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
              </div>
              <div>
                <h3 className="text-xs font-bold text-white uppercase tracking-widest">Writer Assistant</h3>
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>
                  <span className="text-[8px] text-white/60 font-bold uppercase">Flow Active</span>
                </div>
              </div>
            </div>
            
            <div className="flex-grow p-4 overflow-y-auto space-y-4">
              <div className="bg-surface-container-low rounded-lg p-3 max-w-[90%]">
                <p className="text-xs text-on-surface-variant leading-relaxed font-body">Hello. I am here to help you structure this chapter. How should we begin?</p>
              </div>
              {chatTurns.map((turn, idx) => (
                <div 
                  key={idx} 
                  className={cn(
                    "rounded-lg p-3 max-w-[90%]", 
                    turn.role === 'user' ? "bg-primary text-white ml-auto" : "bg-surface-container-low text-on-surface-variant"
                  )}
                >
                  <p className="text-xs leading-relaxed font-body">{turn.content}</p>
                </div>
              ))}
              {chatMutation.isPending && (
                <div className="bg-surface-container-low rounded-lg p-3 max-w-[90%] flex gap-1">
                   <div className="w-2 h-2 rounded-full bg-slate-400 animate-bounce"></div>
                   <div className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                   <div className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                </div>
              )}
            </div>
            
            <div className="p-4 border-t border-slate-100 space-y-3">
              {/* Quick Action Buttons */}
              <div className="mb-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-on-surface-variant">Quick Actions</span>
                  <span className="rounded-full bg-secondary-container/40 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-secondary">
                    {assistantQuickActionConfig.label} Mode
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {assistantQuickActionConfig.actions.map((action) => (
                    <button
                      key={action.id}
                      onClick={() => handleQuickAction(action.prompt)}
                      disabled={
                        chatMutation.isPending ||
                        generateSummaryMutation.isPending ||
                        generateOutlineMutation.isPending ||
                        checkConsistencyMutation.isPending
                      }
                      className={cn(
                        'flex flex-col items-center gap-1 px-2 py-2 rounded-lg transition-all disabled:opacity-50 disabled:pointer-events-none',
                        action.tone === 'tertiary'
                          ? 'bg-tertiary-container/30 hover:bg-tertiary-container/50 text-tertiary'
                          : 'bg-secondary-container/30 hover:bg-secondary-container/50 text-secondary'
                      )}
                    >
                      <span className="material-symbols-outlined text-base">{action.icon}</span>
                      <span className="text-[9px] font-bold uppercase tracking-tight text-center leading-tight">{action.label}</span>
                    </button>
                  ))}

                  <button
                    onClick={() => generateSummaryMutation.mutate()}
                    disabled={
                      generateSummaryMutation.isPending ||
                      chatMutation.isPending ||
                      generateOutlineMutation.isPending ||
                      checkConsistencyMutation.isPending
                    }
                    className="flex flex-col items-center gap-1 px-2 py-2 rounded-lg bg-secondary-container/30 hover:bg-secondary-container/50 text-secondary transition-all disabled:opacity-50 disabled:pointer-events-none"
                  >
                    <span className="material-symbols-outlined text-base">summarize</span>
                    <span className="text-[9px] font-bold uppercase tracking-tight text-center leading-tight">
                      {generateSummaryMutation.isPending ? 'Working' : 'Summary'}
                    </span>
                  </button>

                  <button
                    onClick={() => generateOutlineMutation.mutate()}
                    disabled={
                      generateOutlineMutation.isPending ||
                      chatMutation.isPending ||
                      generateSummaryMutation.isPending ||
                      checkConsistencyMutation.isPending
                    }
                    className="flex flex-col items-center gap-1 px-2 py-2 rounded-lg bg-secondary-container/30 hover:bg-secondary-container/50 text-secondary transition-all disabled:opacity-50 disabled:pointer-events-none"
                  >
                    <span className="material-symbols-outlined text-base">format_list_bulleted</span>
                    <span className="text-[9px] font-bold uppercase tracking-tight text-center leading-tight">
                      {generateOutlineMutation.isPending ? 'Working' : 'Outline'}
                    </span>
                  </button>

                  <button
                    onClick={() => checkConsistencyMutation.mutate()}
                    disabled={
                      checkConsistencyMutation.isPending ||
                      chatMutation.isPending ||
                      generateSummaryMutation.isPending ||
                      generateOutlineMutation.isPending
                    }
                    className="flex flex-col items-center gap-1 px-2 py-2 rounded-lg bg-tertiary-container/30 hover:bg-tertiary-container/50 text-tertiary transition-all disabled:opacity-50 disabled:pointer-events-none"
                  >
                    <span className="material-symbols-outlined text-base">rule</span>
                    <span className="text-[9px] font-bold uppercase tracking-tight text-center leading-tight">
                      {checkConsistencyMutation.isPending ? 'Checking' : 'Consistency'}
                    </span>
                  </button>
                </div>
              </div>

              <form onSubmit={handleChatSubmit} className="relative">
                <textarea 
                  className="w-full bg-surface-container-low border-none rounded-xl text-xs font-body p-4 pr-12 focus:ring-primary/10 resize-none placeholder:text-slate-400" 
                  placeholder="Ask for rewrites or plot suggestions..." 
                  rows={3}
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleChatSubmit(e);
                    }
                  }}
                />
                <button 
                  type="submit"
                  disabled={!chatMessage.trim() || chatMutation.isPending}
                  className="absolute bottom-3 right-3 w-8 h-8 bg-primary text-white rounded-lg flex items-center justify-center hover:opacity-90 transition-all disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-sm">send</span>
                </button>
              </form>
            </div>
          </section>
        </div>
      </div>

      {showConsistencyModal ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 p-4"
          onClick={() => setShowConsistencyModal(false)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-outline-variant/20 bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-outline-variant/10 px-5 py-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">AI Consistency Checker</p>
                <h3 className="mt-1 text-lg font-bold text-primary">
                  {consistencyIssues.length > 0
                    ? `${consistencyIssues.length} potential issue${consistencyIssues.length === 1 ? '' : 's'} found`
                    : 'No major issues found'}
                </h3>
                <p className="mt-1 text-xs text-on-surface-variant">
                  {consistencyMessage}
                  {consistencyGeneratedAt ? ` Checked ${formatDate(consistencyGeneratedAt)}.` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowConsistencyModal(false)}
                className="rounded-lg border border-outline-variant/20 px-3 py-1.5 text-xs font-bold text-primary hover:bg-surface-container-low"
              >
                Close
              </button>
            </div>

            <div className="overflow-y-auto p-5">
              {consistencyIssues.length === 0 ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                  Consistency checks did not find continuity conflicts that need immediate changes.
                </div>
              ) : (
                <div className="space-y-4">
                  {consistencyIssues.map((issue) => {
                    const replaceableVariants = issue.canonical_value
                      ? issue.variants.filter((variant) => variant !== issue.canonical_value)
                      : [];

                    return (
                      <article key={issue.id} className="rounded-xl border border-outline-variant/20 bg-surface-container-low p-4">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <h4 className="text-sm font-bold text-primary">{issue.title}</h4>
                          <div className="flex items-center gap-2">
                            <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider', issueSeverityClass(issue.severity))}>
                              {issue.severity}
                            </span>
                            <span className="rounded-full border border-outline-variant/20 bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                              {issueTypeLabel(issue.issue_type)}
                            </span>
                          </div>
                        </div>

                        <p className="text-xs text-on-surface-variant">{issue.description}</p>

                        {issue.variants.length > 0 ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {issue.variants.map((variant) => (
                              <span
                                key={`${issue.id}-${variant}`}
                                className={cn(
                                  'rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-wider',
                                  issue.canonical_value && variant === issue.canonical_value
                                    ? 'border-secondary/30 bg-secondary-container/40 text-secondary'
                                    : 'border-outline-variant/20 bg-white text-on-surface-variant'
                                )}
                              >
                                {variant}
                              </span>
                            ))}
                          </div>
                        ) : null}

                        {issue.references.length > 0 ? (
                          <div className="mt-4 rounded-lg border border-outline-variant/15 bg-white p-3">
                            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-on-surface-variant">Chapter References</p>
                            <div className="space-y-2">
                              {issue.references.map((reference) => (
                                <div key={`${issue.id}-${reference.chapter_id}-${reference.matched_text || 'ref'}`} className="rounded-md border border-outline-variant/10 bg-surface-container-low p-2">
                                  <p className="text-xs font-semibold text-primary">
                                    Chapter {reference.chapter_number}: {reference.chapter_title}
                                    {reference.matched_text ? ` (${reference.matched_text})` : ''}
                                  </p>
                                  {reference.excerpt ? (
                                    <p className="mt-1 text-xs text-on-surface-variant">{reference.excerpt}</p>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}

                        {issue.fix_suggestions.length > 0 ? (
                          <div className="mt-3 rounded-lg border border-outline-variant/15 bg-white p-3">
                            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-on-surface-variant">Suggested Fixes</p>
                            <div className="space-y-1">
                              {issue.fix_suggestions.map((suggestion, index) => (
                                <p key={`${issue.id}-suggestion-${index}`} className="text-xs text-on-surface-variant">
                                  {index + 1}. {suggestion}
                                </p>
                              ))}
                            </div>
                          </div>
                        ) : null}

                        <div className="mt-4 flex flex-wrap gap-2">
                          {replaceableVariants.map((variant) => (
                            <button
                              key={`${issue.id}-replace-${variant}`}
                              type="button"
                              onClick={() => applyConsistencyReplacement(variant, issue.canonical_value || '')}
                              className="rounded-lg border border-secondary/30 bg-secondary-container/30 px-3 py-1.5 text-xs font-bold text-secondary hover:bg-secondary-container/50"
                            >
                              Fix: {variant} → {issue.canonical_value}
                            </button>
                          ))}

                          <button
                            type="button"
                            onClick={() => draftConsistencyFixPrompt(issue)}
                            className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/10"
                          >
                            Draft AI Fix Prompt
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
