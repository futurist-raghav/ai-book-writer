'use client';

import Link from 'next/link';
import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useDropzone } from 'react-dropzone';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Spinner } from '@/components/ui/spinner';
import { QueryErrorState } from '@/components/ui/query-error-state';
import { apiClient } from '@/lib/api-client';
import { formatDate } from '@/lib/utils';
import { useBookStore } from '@/stores/book-store';
import { ProjectType, ProjectTypeConfigService } from '@/lib/project-types';

interface Note {
  id: string;
  type: 'quick' | 'audio' | 'web' | 'photo' | 'meeting' | 'checklist' | 'long-form';
  title: string;
  content?: string;
  transcription?: string;
  tags?: string[];
  linkedChapterId?: string;
  linkedEntityId?: string;
  created_at: string;
  audio_url?: string;
  processed?: boolean;
  summary?: string;
}

const NOTE_TYPES: Array<{ value: Note['type']; label: string; icon: string; description: string }> = [
  { value: 'quick', label: 'Quick Note', icon: 'lightning_bolt', description: 'Fast idea capture' },
  { value: 'audio', label: 'Audio Note', icon: 'settings_voice', description: 'Voice recording' },
  { value: 'long-form', label: 'Long-Form', icon: 'article', description: 'Detailed notes' },
  { value: 'checklist', label: 'Checklist', icon: 'checklist', description: 'Task list' },
  { value: 'web', label: 'Web Clip', icon: 'language', description: 'Clipped content' },
  { value: 'photo', label: 'Photo Note', icon: 'image', description: 'Image with notes' },
  { value: 'meeting', label: 'Meeting', icon: 'groups', description: 'Interview/meeting notes' },
];

export default function NotesAndVoicePage() {
  const queryClient = useQueryClient();
  const { selectedBook } = useBookStore();

  const [activeTab, setActiveTab] = useState<'all' | 'quick' | 'audio' | 'uncategorized'>('all');
  const [isCreating, setIsCreating] = useState(false);
  const [noteTypeFilter, setNoteTypeFilter] = useState<Note['type'] | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [formData, setFormData] = useState<Partial<Note>>({
    type: 'quick',
    title: '',
    content: '',
    tags: [],
  });

  const projectType = (selectedBook?.project_type || 'novel') as ProjectType;
  const config = ProjectTypeConfigService.getConfig(projectType);
  const structureUnitName = config.structureUnitName;

  // Fetch book details (notes stored in project_settings)
  const {
    data: bookData,
    isLoading: bookLoading,
    isError: bookError,
    error: bookErrorValue,
    refetch: refetchBook,
  } = useQuery({
    queryKey: ['book', selectedBook?.id],
    queryFn: () => (selectedBook?.id ? apiClient.books.get(selectedBook.id) : null),
    enabled: !!selectedBook?.id,
  });

  // Fetch audio files for audio notes
  const { data: audioData } = useQuery({
    queryKey: ['audio'],
    queryFn: () => apiClient.audio.list(),
  });

  const notes: Note[] = useMemo(() => {
    try {
      const settings = bookData?.data?.project_settings || {};
      const stored = settings.notes as Note[] | undefined;
      return Array.isArray(stored) ? stored : [];
    } catch {
      return [];
    }
  }, [bookData]);

  const filteredNotes = useMemo(() => {
    return notes.filter((n) => {
      if (activeTab !== 'all' && (activeTab === 'uncategorized' ? n.linkedChapterId : n.type !== activeTab)) {
        if (activeTab !== 'uncategorized') return false;
        if (n.linkedChapterId) return false;
      }
      if (noteTypeFilter !== 'all' && n.type !== noteTypeFilter) return false;
      if (searchQuery) {
        const lower = searchQuery.toLowerCase();
        return n.title.toLowerCase().includes(lower) || (n.content && n.content.toLowerCase().includes(lower));
      }
      return true;
    });
  }, [notes, activeTab, noteTypeFilter, searchQuery]);

  const saveNotes = useMutation({
    mutationFn: (updatedNotes: Note[]) =>
      selectedBook?.id
        ? apiClient.books.update(selectedBook.id, {
            project_settings: {
              ...(bookData?.data?.project_settings || {}),
              notes: updatedNotes,
            },
          })
        : Promise.reject('No book selected'),
    onSuccess: () => {
      toast.success('Notes saved');
      queryClient.invalidateQueries({ queryKey: ['book', selectedBook?.id] });
      setIsCreating(false);
      setEditingId(null);
      setFormData({ type: 'quick', title: '', content: '', tags: [] });
    },
    onError: () => {
      toast.error('Failed to save notes');
    },
  });

  const handleSaveNote = async () => {
    if (!formData.title?.trim()) {
      toast.error('Note title is required');
      return;
    }

    const updatedNotes = editingId
      ? notes.map((n) => (n.id === editingId ? { ...n, ...formData } : n))
      : [
          ...notes,
          {
            ...formData,
            id: Date.now().toString(),
            created_at: new Date().toISOString(),
            type: formData.type || 'quick',
            title: formData.title,
            content: formData.content || '',
            tags: formData.tags || [],
          } as Note,
        ];

    await saveNotes.mutateAsync(updatedNotes);
  };

  const handleDeleteNote = async (id: string) => {
    const updatedNotes = notes.filter((n) => n.id !== id);
    await saveNotes.mutateAsync(updatedNotes);
  };

  const handleEditNote = (note: Note) => {
    setFormData(note);
    setEditingId(note.id);
    setIsCreating(true);
  };

  const handleConvertToDraft = async (note: Note) => {
    if (!selectedBook?.id) {
      toast.error('No project selected');
      return;
    }

    const draftContent = note.transcription || note.content || note.title;
    if (!draftContent) {
      toast.error('Note has no content to convert');
      return;
    }

    // Create a new chapter with this content as draft
    try {
      const chapter = await apiClient.chapters.create({
        title: `Draft from: ${note.title}`,
        chapter_number: 999, // Will be renumbered
        summary: draftContent.slice(0, 500),
      });

      if (chapter.data?.id) {
        await apiClient.books.addChapter(selectedBook.id, chapter.data.id);
        toast.success(`Created draft ${structureUnitName} from note`);
      }
    } catch (error) {
      toast.error('Failed to create draft');
    }
  };

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/wav';
      const mediaRecorder = new MediaRecorder(stream, { mimeType });

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        chunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const file = new File([blob], `recording-${Date.now()}.webm`, { type: mimeType });

        try {
          const response = await apiClient.audio.upload(file, (progress) => {}, {
            transcription_mode: 'transcribe',
          });

          const transcription = response.data?.transcription || '';
          const updatedNotes = [
            ...notes,
            {
              id: Date.now().toString(),
              type: 'audio' as const,
              title: `Voice Note - ${new Date().toLocaleTimeString()}`,
              transcription,
              content: transcription,
              tags: ['audio', 'voice-to-draft'],
              created_at: new Date().toISOString(),
            },
          ];

          await saveNotes.mutateAsync(updatedNotes);
          toast.success('Voice note recorded and transcribed');
        } catch (error) {
          toast.error('Failed to process voice note');
        }

        stream.getTracks().forEach((track) => track.stop());
        setIsRecording(false);
        setRecordingTime(0);
      };

      mediaRecorder.start();
      setIsRecording(true);

      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime((t) => t + 1);
      }, 1000);
    } catch (error) {
      toast.error('Microphone access denied');
    }
  }, [notes, saveNotes]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    }
  }, [isRecording]);

  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (bookLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner className="w-8 h-8 text-primary" />
      </div>
    );
  }

  if (bookError) {
    return (
      <div className="dashboard-shell">
        <QueryErrorState
          title="Unable to load notes workspace"
          error={bookErrorValue}
          onRetry={() => void refetchBook()}
        />
      </div>
    );
  }

  const uncategorizedCount = notes.filter((n) => !n.linkedChapterId).length;

  return (
    <div className="dashboard-shell">
      {/* Header */}
      <div className="mb-12">
        <p className="font-label text-xs uppercase tracking-[0.2em] text-secondary mb-3">Voice & Writing</p>
        <h2 className="text-5xl md:text-7xl font-light tracking-tighter text-primary font-body mb-4">
          Notes & Voice
        </h2>
        <p className="font-label text-sm text-on-surface-variant max-w-2xl">
          Capture ideas through quick notes, voice recordings, web clips, and meeting notes. Convert voice to draft {structureUnitName.toLowerCase()} with transcription and summarization.
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid md:grid-cols-3 gap-4 mb-12">
        <button
          onClick={() => {
            setFormData({ type: 'quick', title: '', content: '', tags: [] });
            setEditingId(null);
            setIsCreating(true);
          }}
          className="p-6 rounded-xl border border-outline-variant/20 bg-surface-container-lowest hover:border-primary/50 transition-all text-left"
        >
          <span className="material-symbols-outlined text-2xl text-secondary mb-3 block">
            lightning_bolt
          </span>
          <h3 className="font-label text-sm font-bold text-primary uppercase tracking-widest mb-1">Quick Note</h3>
          <p className="font-label text-xs text-on-surface-variant">Fast idea capture</p>
        </button>

        <button
          onClick={startRecording}
          disabled={isRecording}
          className={`p-6 rounded-xl border-2 transition-all text-left ${
            isRecording
              ? 'border-error bg-error/10 animate-pulse'
              : 'border-outline-variant/20 bg-surface-container-lowest hover:border-secondary/50'
          }`}
        >
          <span className="material-symbols-outlined text-2xl mb-3 block" style={{ color: isRecording ? '#d32f2f' : '' }}>
            {isRecording ? 'stop_circle' : 'settings_voice'}
          </span>
          <h3 className="font-label text-sm font-bold text-primary uppercase tracking-widest mb-1">
            {isRecording ? `Recording ${formatRecordingTime(recordingTime)}` : 'Voice Note'}
          </h3>
          <p className="font-label text-xs text-on-surface-variant">
            {isRecording ? 'Click stop button or release' : 'Record from microphone'}
          </p>
        </button>

        {isRecording && (
          <button
            onClick={stopRecording}
            className="p-6 rounded-xl border-2 border-error bg-error/10 hover:bg-error hover:text-white transition-all text-left"
          >
            <span className="material-symbols-outlined text-2xl mb-3 block">stop_circle</span>
            <h3 className="font-label text-sm font-bold text-error uppercase tracking-widest mb-1">Stop Recording</h3>
            <p className="font-label text-xs text-error/70">Finish and transcribe</p>
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="mb-8 flex gap-2 border-b border-outline-variant/20 overflow-x-auto">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-4 py-3 font-label text-xs font-bold uppercase tracking-wider transition-colors border-b-2 whitespace-nowrap ${
            activeTab === 'all'
              ? 'border-primary text-primary'
              : 'border-transparent text-on-surface-variant hover:text-primary'
          }`}
        >
          All Notes ({notes.length})
        </button>
        <button
          onClick={() => setActiveTab('quick')}
          className={`px-4 py-3 font-label text-xs font-bold uppercase tracking-wider transition-colors border-b-2 whitespace-nowrap ${
            activeTab === 'quick'
              ? 'border-primary text-primary'
              : 'border-transparent text-on-surface-variant hover:text-primary'
          }`}
        >
          Quick ({notes.filter((n) => n.type === 'quick').length})
        </button>
        <button
          onClick={() => setActiveTab('audio')}
          className={`px-4 py-3 font-label text-xs font-bold uppercase tracking-wider transition-colors border-b-2 whitespace-nowrap ${
            activeTab === 'audio'
              ? 'border-primary text-primary'
              : 'border-transparent text-on-surface-variant hover:text-primary'
          }`}
        >
          Audio ({notes.filter((n) => n.type === 'audio').length})
        </button>
        <button
          onClick={() => setActiveTab('uncategorized')}
          className={`px-4 py-3 font-label text-xs font-bold uppercase tracking-wider transition-colors border-b-2 whitespace-nowrap ${
            activeTab === 'uncategorized'
              ? 'border-primary text-primary'
              : 'border-transparent text-on-surface-variant hover:text-primary'
          }`}
        >
          Orphan Notes ({uncategorizedCount})
        </button>
      </div>

      {/* Search and Filter */}
      {filteredNotes.length > 0 && (
        <div className="mb-8 grid md:grid-cols-2 gap-4">
          <div>
            <label className="block font-label text-[10px] text-on-surface-variant font-bold uppercase tracking-wider mb-2">
              Search Notes
            </label>
            <input
              type="text"
              placeholder="Search by title or content..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-3 text-sm font-label focus:border-secondary transition-colors"
            />
          </div>
          <div>
            <label className="block font-label text-[10px] text-on-surface-variant font-bold uppercase tracking-wider mb-2">
              Filter Type
            </label>
            <select
              value={noteTypeFilter}
              onChange={(e) => setNoteTypeFilter(e.target.value as Note['type'] | 'all')}
              className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-3 text-sm font-label focus:border-secondary transition-colors"
            >
              <option value="all">All Types</option>
              {NOTE_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Notes Grid */}
      {filteredNotes.length === 0 ? (
        <div className="border-2 border-dashed border-outline-variant/30 rounded-2xl p-16 flex flex-col items-center justify-center text-center">
          <span className="material-symbols-outlined text-4xl text-on-surface-variant mb-4">note_add</span>
          <h3 className="font-label text-sm font-bold text-primary uppercase tracking-widest mb-2">No notes yet</h3>
          <p className="font-label text-xs text-on-surface-variant max-w-sm leading-relaxed mb-6">
            Build your ideation workflow with quick notes, voice recordings, web clips, and meeting notes.
          </p>
          <button
            onClick={() => {
              setFormData({ type: 'quick', title: '', content: '', tags: [] });
              setEditingId(null);
              setIsCreating(true);
            }}
            className="px-6 py-3 rounded-lg bg-primary text-white font-label text-xs font-bold uppercase tracking-wider hover:opacity-90 transition-all"
          >
            Create First Note
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredNotes.map((note) => {
            const noteTypeInfo = NOTE_TYPES.find((t) => t.value === note.type);
            return (
              <div
                key={note.id}
                className="bg-white rounded-xl border border-outline-variant/10 overflow-hidden hover:shadow-lg transition-all hover:border-secondary/30 flex flex-col"
              >
                {/* Header */}
                <div className="bg-surface-container-lowest p-4 border-b border-outline-variant/10">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="text-lg font-body font-semibold text-primary line-clamp-2 flex-1">{note.title}</h3>
                    <span className="material-symbols-outlined text-sm text-secondary flex-shrink-0">
                      {noteTypeInfo?.icon || 'note'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-label text-[10px] text-on-surface-variant uppercase tracking-tight">
                      {noteTypeInfo?.label}
                    </span>
                    <span className="font-label text-[10px] text-on-surface-variant/60">
                      {formatDate(note.created_at)}
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div className="p-4 flex-1 min-h-[100px]">
                  {note.transcription ? (
                    <p className="text-xs text-on-surface-variant leading-relaxed line-clamp-4">
                      <span className="font-label font-bold text-on-surface-variant/60 mr-2">[Transcribed]</span>
                      {note.transcription}
                    </p>
                  ) : note.content ? (
                    <p className="text-xs text-on-surface-variant leading-relaxed line-clamp-4">{note.content}</p>
                  ) : (
                    <p className="text-xs text-on-surface-variant/50 italic">No content</p>
                  )}
                  {note.summary && (
                    <div className="mt-3 p-3 rounded-lg bg-secondary-container/20 border border-secondary/30">
                      <p className="font-label text-[9px] font-bold text-secondary uppercase tracking-tight mb-1">
                        Summary
                      </p>
                      <p className="text-xs text-secondary line-clamp-2">{note.summary}</p>
                    </div>
                  )}
                </div>

                {/* Tags */}
                {(note.tags || []).length > 0 && (
                  <div className="px-4 py-3 bg-surface-container-lowest border-t border-outline-variant/10 flex flex-wrap gap-2">
                    {(note.tags || []).map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-1 rounded-full bg-tertiary/10 text-tertiary text-[9px] font-bold uppercase tracking-tighter"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div className="p-4 border-t border-outline-variant/10 flex gap-2">
                  <button
                    onClick={() => handleConvertToDraft(note)}
                    className="flex-1 px-3 py-2 rounded-lg bg-secondary/10 text-secondary hover:bg-secondary hover:text-white font-label text-[10px] font-bold uppercase tracking-tight transition-all"
                    title="Convert to draft"
                  >
                    <span className="material-symbols-outlined text-sm inline mr-1">articles</span>
                    Draft
                  </button>
                  <button
                    onClick={() => handleEditNote(note)}
                    className="flex-1 px-3 py-2 rounded-lg bg-primary/10 text-primary hover:bg-primary hover:text-white font-label text-[10px] font-bold uppercase tracking-tight transition-all"
                    title="Edit note"
                  >
                    <span className="material-symbols-outlined text-sm inline mr-1">edit</span>
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteNote(note.id)}
                    className="w-10 h-10 flex items-center justify-center rounded-lg bg-error/10 text-error hover:bg-error hover:text-white transition-all"
                    title="Delete note"
                  >
                    <span className="material-symbols-outlined text-sm">delete</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Quick Note Form Modal */}
      {isCreating && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full p-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-label text-sm font-bold text-primary uppercase tracking-widest">
                {editingId ? 'Edit' : 'Create'} Note
              </h3>
              <button
                onClick={() => {
                  setIsCreating(false);
                  setEditingId(null);
                  setFormData({ type: 'quick', title: '', content: '', tags: [] });
                }}
                className="text-on-surface-variant hover:text-primary transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block font-label text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-2">
                  Note Type
                </label>
                <select
                  value={formData.type || 'quick'}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as Note['type'] })}
                  className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-3 text-sm font-body focus:border-secondary transition-colors"
                >
                  {NOTE_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}: {type.description}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-label text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-2">
                  Title *
                </label>
                <input
                  type="text"
                  value={formData.title || ''}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Note title..."
                  className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-3 text-sm font-body focus:border-secondary transition-colors"
                />
              </div>

              <div>
                <label className="block font-label text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-2">
                  Content
                </label>
                <textarea
                  value={formData.content || ''}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="Note content..."
                  rows={6}
                  className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-3 text-sm font-body focus:border-secondary transition-colors"
                />
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-outline-variant/10">
                <button
                  onClick={() => {
                    setIsCreating(false);
                    setEditingId(null);
                    setFormData({ type: 'quick', title: '', content: '', tags: [] });
                  }}
                  className="px-4 py-2 rounded-lg border border-outline-variant/20 text-primary font-label text-xs font-bold uppercase tracking-wider hover:bg-surface-container-high transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveNote}
                  disabled={saveNotes.isPending || !formData.title?.trim()}
                  className="px-6 py-2 rounded-lg bg-primary text-white font-label text-xs font-bold uppercase tracking-wider hover:opacity-90 disabled:opacity-50 transition-all"
                >
                  {saveNotes.isPending ? <Spinner className="w-3 h-3 mr-2 inline-block" /> : null}
                  {editingId ? 'Update' : 'Create'} Note
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
