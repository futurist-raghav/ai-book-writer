'use client';

import React, { useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api-client';

interface VoiceNoteToDraftProps {
  chapterId: string;
  onInsertDraft: (content: string) => void;
  onCancel: () => void;
}

export function VoiceNoteToDraft({
  chapterId,
  onInsertDraft,
  onCancel,
}: VoiceNoteToDraftProps) {
  const [stage, setStage] = useState<'record' | 'processing' | 'review'>('record');
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [transcriptionText, setTranscriptionText] = useState('');
  const [draftContent, setDraftContent] = useState('');
  const [editedDraft, setEditedDraft] = useState('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  const convertMutation = useMutation({
    mutationFn: async (audioBuffer: Blob) => {
      // For now, use a mock transcription
      // In production, you'd upload the audio file first and get the path
      const formData = new FormData();
      formData.append('audio_file_path', '/path/to/audio.wav');
      formData.append('voice_memo_title', 'Voice note');
      formData.append('auto_enhance_prose', 'true');

      const response = await api.post(`/chapters/${chapterId}/voice-to-draft`, {
        audio_file_path: '/temp/voice_memo.wav',
        voice_memo_title: 'Voice note',
        auto_enhance_prose: true,
      });
      return response.data;
    },
    onSuccess: (data) => {
      setTranscriptionText(data.transcription);
      setDraftContent(data.draft_content);
      setEditedDraft(data.draft_content);
      setStage('review');
    },
    onError: () => {
      alert('Failed to convert voice note. Try again.');
    },
  });

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        setAudioBlob(blob);
        
        // Create preview URL
        const url = URL.createObjectURL(blob);
        if (audioElementRef.current) {
          audioElementRef.current.src = url;
        }
      };

      recorder.start();
      setIsRecording(true);
    } catch (error) {
      alert('Could not access microphone. Check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[600px] overflow-y-auto p-6">
        <h2 className="text-2xl font-bold mb-4 text-primary">Convert Voice Note to Draft</h2>

        {/* Recording Stage */}
        {stage === 'record' && (
          <div className="space-y-4">
            <div className="bg-surface-container-lowest rounded-lg p-6 text-center border-2 border-dashed border-outline-variant/30">
              <div className="mb-4">
                {isRecording ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 bg-red-500 rounded-full animate-pulse"></div>
                    <span className="text-on-surface-variant">Recording...</span>
                  </div>
                ) : audioBlob ? (
                  <span className="text-primary font-semibold">✓ Audio recorded</span>
                ) : (
                  <span className="text-on-surface-variant">Click record or upload audio</span>
                )}
              </div>

              {!isRecording && audioBlob && (
                <audio ref={audioElementRef} controls className="w-full mb-4" />
              )}

              {!isRecording && !audioBlob ? (
                <button
                  onClick={startRecording}
                  className="px-6 py-3 bg-primary text-on-primary font-semibold rounded-lg hover:bg-primary/90 mb-2"
                >
                  🎤 Start Recording
                </button>
              ) : isRecording ? (
                <button
                  onClick={stopRecording}
                  className="px-6 py-3 bg-red-500 text-white font-semibold rounded-lg hover:bg-red-600 mb-2"
                >
                  ⏹ Stop Recording
                </button>
              ) : (
                <button
                  onClick={() => {
                    setAudioBlob(null);
                    setTranscriptionText('');
                    setDraftContent('');
                  }}
                  className="px-6 py-3 bg-surface-container-lowest border border-outline text-on-surface font-semibold rounded-lg hover:bg-surface-container mb-2"
                >
                  Re-Record
                </button>
              )}
            </div>

            {/* Audio Upload Alternative */}
            <div className="text-center text-sm text-on-surface-variant">
              or{' '}
              <label className="text-primary cursor-pointer hover:underline">
                upload a file
                <input
                  type="file"
                  accept="audio/*"
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      setAudioBlob(e.target.files[0]);
                      if (audioElementRef.current) {
                        audioElementRef.current.src = URL.createObjectURL(e.target.files[0]);
                      }
                    }
                  }}
                  className="hidden"
                />
              </label>
            </div>

            {/* Action Buttons */}
            {audioBlob && (
              <div className="flex gap-2">
                <button
                  onClick={() => convertMutation.mutate(audioBlob)}
                  disabled={convertMutation.isPending}
                  className="flex-1 bg-primary text-on-primary font-semibold py-2 rounded-lg hover:bg-primary/90 disabled:opacity-50"
                >
                  {convertMutation.isPending ? 'Converting...' : 'Convert to Draft'}
                </button>
                <button
                  onClick={onCancel}
                  className="flex-1 border border-outline bg-surface-container-lowest text-on-surface font-medium py-2 rounded-lg hover:bg-surface-container"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}

        {/* Review Stage */}
        {stage === 'review' && (
          <div className="space-y-4">
            {/* Transcription */}
            <div>
              <label className="block text-sm font-medium text-on-surface mb-2">
                Transcription (Raw)
              </label>
              <div className="bg-surface-container-lowest rounded-lg p-3 text-sm max-h-24 overflow-y-auto border border-outline-variant/30">
                {transcriptionText}
              </div>
            </div>

            {/* Generated Draft */}
            <div>
              <label className="block text-sm font-medium text-on-surface mb-2">
                Generated Draft
              </label>
              <textarea
                value={editedDraft}
                onChange={(e) => setEditedDraft(e.target.value)}
                className="w-full rounded-lg border border-outline bg-surface-container-lowest p-3 text-sm font-mono max-h-40 overflow-y-auto focus:ring-2 focus:ring-primary focus:border-transparent"
              />
              <p className="text-xs text-on-surface-variant mt-1">
                {editedDraft.split(/\s+/).length} words | Edit before inserting
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setStage('record');
                  setAudioBlob(null);
                  setTranscriptionText('');
                  setDraftContent('');
                  setEditedDraft('');
                }}
                className="flex-1 border border-outline bg-surface-container-lowest text-on-surface font-medium py-2 rounded-lg hover:bg-surface-container"
              >
                Re-Record
              </button>
              <button
                onClick={() => {
                  onInsertDraft(editedDraft);
                  onCancel();
                }}
                className="flex-1 bg-primary text-on-primary font-semibold py-2 rounded-lg hover:bg-primary/90"
              >
                Insert into Chapter
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
