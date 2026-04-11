'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { toast } from 'sonner';

interface VoiceNoteToDraftResponse {
  transcription: string;
  draft_content: string;
  word_count: number;
  processing_time_ms: number;
  message: string;
}

interface VoiceNoteModalProps {
  chapterId: string;
  onApply?: (draftContent: string) => void;
  onCancel?: () => void;
}

export function VoiceNoteModal({
  chapterId,
  onApply,
  onCancel,
}: VoiceNoteModalProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string>('');
  const [transcription, setTranscription] = useState('');
  const [draftContent, setDraftContent] = useState('');
  const [mode, setMode] = useState<'record' | 'upload' | 'review'>('record');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const convertMutation = useMutation({
    mutationFn: async (audioFile: File) => {
      const formData = new FormData();
      formData.append('audio_file', audioFile);
      formData.append('auto_enhance_prose', 'true');

      const response = await api.post(`/chapters/${chapterId}/voice-to-draft`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data as VoiceNoteToDraftResponse;
    },
    onSuccess: (data) => {
      setTranscription(data.transcription);
      setDraftContent(data.draft_content);
      setMode('review');
      toast.success(`Draft created: ${data.word_count} words`);
    },
    onError: () => {
      toast.error('Failed to convert voice note to draft');
    },
  });

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setRecordedBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((track) => track.stop());
        setIsRecording(false);
        toast.success('Recording complete');
      };

      mediaRecorder.start();
      setIsRecording(true);
      toast.info('Recording started...');
    } catch (error) {
      toast.error('Could not access microphone');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
  };

  const processRecording = async () => {
    if (!recordedBlob) {
      toast.error('No recording available');
      return;
    }

    const file = new File([recordedBlob], 'voice-note.webm', { type: 'audio/webm' });
    convertMutation.mutate(file);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('audio/')) {
      toast.error('Please select an audio file');
      return;
    }

    setRecordedBlob(file);
    setAudioUrl(URL.createObjectURL(file));
    toast.success('File selected');
  };

  const handleApply = () => {
    onApply?.(draftContent);
    toast.success('Draft inserted into chapter');
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[700px] overflow-y-auto p-6">
        <h2 className="text-2xl font-bold mb-4 text-primary">Voice Note to Draft</h2>

        {mode === 'record' || mode === 'upload' ? (
          <div className="space-y-4">
            {/* Recording Tab */}
            {mode === 'record' && !audioUrl && (
              <div className="border-2 border-dashed border-primary/20 rounded-lg p-8 text-center">
                <div className="mb-4">
                  <span className="material-symbols-outlined text-5xl text-primary/40">
                    mic
                  </span>
                </div>
                <p className="text-sm text-on-surface-variant mb-6">
                  Click below to start recording your voice note
                </p>
                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  className={`px-6 py-3 rounded-lg font-bold text-white transition-all ${
                    isRecording
                      ? 'bg-red-500 hover:bg-red-600 animate-pulse'
                      : 'bg-primary hover:opacity-90'
                  }`}
                >
                  {isRecording ? 'Stop Recording' : 'Start Recording'}
                </button>
              </div>
            )}

            {/* Recording Playback */}
            {audioUrl && (
              <div className="space-y-4 border border-outline-variant/20 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-primary">
                    check_circle
                  </span>
                  <p className="text-sm font-semibold text-on-surface">
                    Recording saved
                  </p>
                </div>
                <audio
                  src={audioUrl}
                  controls
                  className="w-full bg-surface-container rounded"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setAudioUrl('');
                      setRecordedBlob(null);
                      setIsRecording(false);
                    }}
                    className="flex-1 rounded-lg border border-outline-variant/30 bg-white px-3 py-2 text-sm font-bold text-on-surface hover:bg-surface-container-low"
                  >
                    Record Again
                  </button>
                  <button
                    onClick={processRecording}
                    disabled={convertMutation.isPending}
                    className="flex-1 rounded-lg bg-secondary px-3 py-2 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50"
                  >
                    {convertMutation.isPending
                      ? 'Converting...'
                      : 'Convert to Draft'}
                  </button>
                </div>
              </div>
            )}

            {/* Upload Tab */}
            {mode === 'upload' && (
              <div className="border-2 border-dashed border-primary/20 rounded-lg p-8 text-center">
                <div className="mb-4">
                  <span className="material-symbols-outlined text-5xl text-primary/40">
                    upload_file
                  </span>
                </div>
                <p className="text-sm text-on-surface-variant mb-4">
                  Upload an audio file (MP3, WAV, M4A, etc.)
                </p>
                <input
                  type="file"
                  accept="audio/*"
                  onChange={handleFileUpload}
                  className="hidden"
                  ref={fileInputRef}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-6 py-3 rounded-lg font-bold text-white bg-primary hover:opacity-90"
                >
                  Choose File
                </button>
                {audioUrl && (
                  <div className="mt-4">
                    <audio src={audioUrl} controls className="w-full bg-surface-container rounded" />
                    <button
                      onClick={processRecording}
                      disabled={convertMutation.isPending}
                      className="mt-3 w-full rounded-lg bg-secondary px-3 py-2 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50"
                    >
                      {convertMutation.isPending ? 'Converting...' : 'Convert to Draft'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Mode Selector */}
            {!audioUrl && (
              <div className="flex gap-2">
                <button
                  onClick={() => setMode('record')}
                  className={`flex-1 rounded-lg px-3 py-2 text-sm font-bold transition-colors ${
                    mode === 'record'
                      ? 'bg-primary text-white'
                      : 'border border-outline-variant/30 text-on-surface hover:bg-surface-container-low'
                  }`}
                >
                  Record
                </button>
                <button
                  onClick={() => setMode('upload')}
                  className={`flex-1 rounded-lg px-3 py-2 text-sm font-bold transition-colors ${
                    mode === 'upload'
                      ? 'bg-primary text-white'
                      : 'border border-outline-variant/30 text-on-surface hover:bg-surface-container-low'
                  }`}
                >
                  Upload
                </button>
              </div>
            )}
          </div>
        ) : (
          // Review Mode - Show Transcription & Draft
          <div className="space-y-4">
            {/* Transcription */}
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-primary mb-2">
                Transcription (Raw)
              </h3>
              <div className="bg-surface-container-lowest rounded-lg border border-outline-variant/10 p-3 max-h-32 overflow-y-auto text-sm text-on-surface">
                {transcription}
              </div>
            </div>

            {/* Draft */}
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-primary mb-2">
                Draft (AI-Enhanced)
              </h3>
              <div className="bg-surface-container-lowest rounded-lg border border-outline-variant/10 p-4 max-h-48 overflow-y-auto text-sm text-on-surface leading-relaxed">
                {draftContent}
              </div>
              <p className="text-[11px] text-on-surface-variant mt-2">
                {draftContent.split(/\s+/).length} words
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-2 justify-end mt-4">
              <button
                onClick={() => {
                  setMode('record');
                  setAudioUrl('');
                  setRecordedBlob(null);
                  setTranscription('');
                  setDraftContent('');
                }}
                className="rounded-lg border border-outline-variant/30 bg-white px-4 py-2 text-sm font-bold text-on-surface hover:bg-surface-container-low"
              >
                New Note
              </button>
              <button
                onClick={onCancel}
                className="rounded-lg border border-outline-variant/30 bg-white px-4 py-2 text-sm font-bold text-on-surface hover:bg-surface-container-low"
              >
                Cancel
              </button>
              <button
                onClick={handleApply}
                className="rounded-lg bg-secondary px-4 py-2 text-sm font-bold text-white hover:opacity-90"
              >
                Insert to Chapter
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
