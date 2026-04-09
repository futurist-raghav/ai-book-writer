'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, FileText, Save, Sparkles, BookOpen, Copy, Lightbulb, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loading, Spinner } from '@/components/ui/spinner';
import { QueryErrorState } from '@/components/ui/query-error-state';
import { Textarea } from '@/components/ui/textarea';
import { apiClient } from '@/lib/api-client';

interface TranscriptionRecord {
  id: string;
  text: string;
  status: string;
  task_mode: string;
  ai_enhanced: boolean;
  word_count: number;
  is_edited: boolean;
}

interface Chapter {
  id: string;
  title: string;
  chapter_number?: number;
}

interface ApiError {
  response?: {
    status?: number;
    data?: {
      detail?: string;
    };
  };
}

export default function AudioTranscriptionPage() {
  const params = useParams<{ audioId: string }>();
  const queryClient = useQueryClient();
  const audioId = useMemo(() => {
    if (!params?.audioId) return '';
    return Array.isArray(params.audioId) ? params.audioId[0] : params.audioId;
  }, [params]);

  const [draftText, setDraftText] = useState('');
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [showChapterSelector, setShowChapterSelector] = useState(false);

  const {
    data: audioData,
    isLoading: isAudioLoading,
    isError: isAudioError,
    error: audioError,
    refetch: refetchAudio,
  } = useQuery({
    queryKey: ['audio', audioId],
    queryFn: () => apiClient.audio.get(audioId),
    enabled: Boolean(audioId),
  });

  const { data: chaptersData } = useQuery({
    queryKey: ['chapters'],
    queryFn: () => apiClient.chapters.list({ limit: 100 }),
  });

  const {
    data: transcriptionData,
    isLoading: isTranscriptionLoading,
    error: transcriptionError,
    refetch: refetchTranscription,
  } = useQuery({
    queryKey: ['transcription-by-audio', audioId],
    queryFn: () => apiClient.transcriptions.getByAudio(audioId),
    enabled: Boolean(audioId),
    retry: false,
  });

  const transcription = transcriptionData?.data as TranscriptionRecord | undefined;
  const isTranscriptionMissing = (transcriptionError as ApiError)?.response?.status === 404;
  const hasTranscriptionError = Boolean(transcriptionError) && !isTranscriptionMissing;
  const chapters: Chapter[] = chaptersData?.data?.items || [];

  useEffect(() => {
    if (transcription?.text !== undefined) {
      setDraftText(transcription.text);
    }
  }, [transcription?.text]);

  const updateMutation = useMutation({
    mutationFn: (payload: { id: string; text: string }) =>
      apiClient.transcriptions.update(payload.id, { text: payload.text }),
    onSuccess: () => {
      toast.success('Transcription saved');
      queryClient.invalidateQueries({ queryKey: ['transcription-by-audio', audioId] });
    },
    onError: (error: unknown) => {
      const err = error as ApiError;
      toast.error(err.response?.data?.detail || 'Failed to save transcription');
    },
  });

  const createManualMutation = useMutation({
    mutationFn: (text: string) => apiClient.transcriptions.createManual(audioId, { text }),
    onSuccess: () => {
      toast.success('Manual transcription saved');
      queryClient.invalidateQueries({ queryKey: ['transcription-by-audio', audioId] });
    },
    onError: (error: unknown) => {
      const err = error as ApiError;
      toast.error(err.response?.data?.detail || 'Failed to create manual transcription');
    },
  });

  const extractMutation = useMutation({
    mutationFn: (id: string) => apiClient.transcriptions.extractEvents(id),
    onSuccess: () => {
      toast.success('Event extraction started');
    },
    onError: (error: unknown) => {
      const err = error as ApiError;
      toast.error(err.response?.data?.detail || 'Failed to start event extraction');
    },
  });

  const copyToChapterMutation = useMutation({
    mutationFn: async (chapterId: string) => {
      if (!transcription?.id || !draftText.trim()) {
        throw new Error('No transcription text to push');
      }
      // Get current chapter content and append transcript
      const chapter = await apiClient.chapters.workspace(chapterId);
      // For now, just show a success message
      // In a full implementation, this would push content to chapter editor
      return { success: true, chapterId };
    },
    onSuccess: (data) => {
      toast.success(`Transcript ready for chapter "${chapters.find(c => c.id === data.chapterId)?.title}"`);
      toast('Open the chapter editor to review and integrate the content', { icon: '📝' });
      setShowChapterSelector(false);
    },
    onError: (error: unknown) => {
      const err = error as ApiError;
      toast.error(err.response?.data?.detail || 'Failed to push to chapter');
    },
  });

  if (isAudioLoading || isTranscriptionLoading) {
    return <Loading message="Loading transcription..." />;
  }

  if (isAudioError) {
    return (
      <QueryErrorState
        title="Unable to load audio file"
        error={audioError}
        onRetry={() => void refetchAudio()}
      />
    );
  }

  const audioTitle = audioData?.data?.title || audioData?.data?.original_filename || 'Audio file';
  const canSave = Boolean(transcription?.id) && draftText.trim().length > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/dashboard/audio" className="mb-2 inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Audio
          </Link>
          <h1 className="text-3xl font-bold">Transcription Editor</h1>
          <p className="text-muted-foreground">Review and edit text for {audioTitle}</p>
        </div>
        {transcription?.id && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => extractMutation.mutate(transcription.id)}
                disabled={extractMutation.isPending}
              >
                {extractMutation.isPending ? (
                  <Spinner size="sm" className="mr-2" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                Extract Events
              </Button>
              <Button
                onClick={() => transcription?.id && updateMutation.mutate({ id: transcription.id, text: draftText })}
                disabled={!canSave || updateMutation.isPending}
              >
                {updateMutation.isPending ? (
                  <Spinner size="sm" className="mr-2" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save Changes
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* AI Extraction Buttons */}
      {transcription?.id && draftText.trim().length > 0 && (
        <Card className="border-secondary/30 bg-secondary/5">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Lightbulb className="h-4 w-4" />
              AI Extraction Tools
            </CardTitle>
            <CardDescription>Extract structured data from this transcript</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Button variant="outline" size="sm" className="justify-start" disabled>
              <Sparkles className="mr-2 h-4 w-4" />
              Extract Characters
              <span className="ml-auto text-xs text-muted-foreground">Soon</span>
            </Button>
            <Button variant="outline" size="sm" className="justify-start" disabled>
              <Share2 className="mr-2 h-4 w-4" />
              Extract to World
              <span className="ml-auto text-xs text-muted-foreground">Soon</span>
            </Button>
            <Button variant="outline" size="sm" className="justify-start" disabled>
              <Copy className="mr-2 h-4 w-4" />
              Convert to Outline
              <span className="ml-auto text-xs text-muted-foreground">Soon</span>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Push to Chapter */}
      {transcription?.id && draftText.trim().length > 0 && chapters.length > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Push to Chapter
            </CardTitle>
            <CardDescription>Send this transcript to a chapter for integration</CardDescription>
          </CardHeader>
          <CardContent>
            {showChapterSelector ? (
              <div className="space-y-3">
                <div className="max-h-64 overflow-y-auto space-y-2 border rounded-lg p-3 bg-white">
                  {chapters.map((chapter) => (
                    <button
                      key={chapter.id}
                      onClick={() => {
                        setSelectedChapterId(chapter.id);
                        copyToChapterMutation.mutate(chapter.id);
                      }}
                      disabled={copyToChapterMutation.isPending}
                      className="w-full text-left px-3 py-2 rounded hover:bg-primary/10 transition-colors text-sm"
                    >
                      <div className="font-medium">
                        {chapter.chapter_number && `Ch. ${chapter.chapter_number}: `}
                        {chapter.title}
                      </div>
                    </button>
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowChapterSelector(false);
                    setSelectedChapterId(null);
                  }}
                  disabled={copyToChapterMutation.isPending}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowChapterSelector(true)}
              >
                <BookOpen className="mr-2 h-4 w-4" />
                Select Chapter
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {hasTranscriptionError ? (
        <QueryErrorState
          title="Unable to load transcription"
          error={transcriptionError}
          onRetry={() => void refetchTranscription()}
          className="mb-4"
        />
      ) : null}

      {isTranscriptionMissing ? (
        <Card>
          <CardHeader>
            <CardTitle>No transcription yet</CardTitle>
            <CardDescription>
              This audio file is still being processed. You can still create a manual text transcription below.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={draftText}
              onChange={(event) => setDraftText(event.target.value)}
              placeholder="Paste or type your transcript text..."
              className="min-h-[300px] text-base leading-7"
            />
            <div className="flex justify-end">
              <Button
                onClick={() => createManualMutation.mutate(draftText.trim())}
                disabled={draftText.trim().length < 1 || createManualMutation.isPending}
              >
                {createManualMutation.isPending ? <Spinner size="sm" className="mr-2" /> : <Save className="mr-2 h-4 w-4" />}
                Save Manual Transcription
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Transcript Text
                </CardTitle>
                <CardDescription>
                  Edit wording, fix mistakes, and save your corrected transcript.
                </CardDescription>
              </div>
              {transcription && (
                <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  <p>Status: {transcription.status}</p>
                  <p>Mode: {transcription.task_mode}</p>
                  <p>AI Enhanced: {transcription.ai_enhanced ? 'Yes' : 'No'}</p>
                  <p>Words: {transcription.word_count.toLocaleString()}</p>
                  <p>Edited: {transcription.is_edited ? 'Yes' : 'No'}</p>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <Textarea
              value={draftText}
              onChange={(event) => setDraftText(event.target.value)}
              placeholder="Transcribed text will appear here..."
              className="min-h-[360px] text-base leading-7"
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
