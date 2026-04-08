'use client';

import Link from 'next/link';
import { useState, useCallback, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowRight,
  Upload,
  Mic,
  Square,
  Trash2,
  FileAudio,
  FileText,
  Clock,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loading, Spinner } from '@/components/ui/spinner';
import { apiClient } from '@/lib/api-client';
import { formatDuration, formatFileSize, formatDate } from '@/lib/utils';
import { useAudioStore } from '@/stores/audio-store';

export default function AudioPage() {
  const queryClient = useQueryClient();
  const {
    isUploading,
    uploadProgress,
    isRecording,
    recordingTime,
    setUploading,
    setUploadProgress,
    setRecording,
    setRecordingTime,
  } = useAudioStore();
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [transcriptionMode, setTranscriptionMode] = useState<'transcribe' | 'translate'>('transcribe');
  const [sourceLanguage, setSourceLanguage] = useState('auto');
  const [targetLanguage, setTargetLanguage] = useState('en');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['audio'],
    queryFn: () => apiClient.audio.list(),
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      setUploading(true);
      setUploadProgress(0);
      const response = await apiClient.audio.upload(file, (progress) => {
        setUploadProgress(progress);
      }, {
        transcription_mode: transcriptionMode,
        source_language: sourceLanguage === 'auto' ? undefined : sourceLanguage,
        target_language: transcriptionMode === 'translate' ? targetLanguage : undefined,
      });
      return response;
    },
    onSuccess: () => {
      toast.success('Audio uploaded successfully');
      queryClient.invalidateQueries({ queryKey: ['audio'] });
      setUploading(false);
      setUploadProgress(0);
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { detail?: string } } };
      toast.error(err.response?.data?.detail || 'Upload failed');
      setUploading(false);
      setUploadProgress(0);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.audio.delete(id),
    onSuccess: () => {
      toast.success('Audio deleted');
      queryClient.invalidateQueries({ queryKey: ['audio'] });
    },
    onError: () => {
      toast.error('Failed to delete audio');
    },
  });

  const retryMutation = useMutation({
    mutationFn: (id: string) => apiClient.audio.retry(id),
    onSuccess: () => {
      toast.success('Processing restarted');
      queryClient.invalidateQueries({ queryKey: ['audio'] });
    },
    onError: () => {
      toast.error('Failed to restart processing');
    },
  });

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (file) {
        uploadMutation.mutate(file);
      }
    },
    [uploadMutation]
  );

  const resetRecordingInterval = useCallback(() => {
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
  }, []);

  const getSupportedMimeType = useCallback((): string => {
    const preferredTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/ogg'];
    const supportedType = preferredTypes.find((mimeType) => MediaRecorder.isTypeSupported(mimeType));
    return supportedType || '';
  }, []);

  const uploadRecordedAudio = useCallback(
    (blob: Blob, mimeType: string) => {
      const extension = mimeType.includes('ogg') ? 'ogg' : 'webm';
      const file = new File([blob], `recording-${Date.now()}.${extension}`, {
        type: mimeType || 'audio/webm',
      });
      uploadMutation.mutate(file);
    },
    [uploadMutation]
  );

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      return;
    }
    recorder.stop();
  }, []);

  const startRecording = useCallback(async () => {
    if (isRecording) {
      return;
    }

    if (!navigator?.mediaDevices?.getUserMedia) {
      const message = 'Live recording is not supported in this browser.';
      setRecordingError(message);
      toast.error(message);
      return;
    }

    try {
      setRecordingError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getSupportedMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      chunksRef.current = [];

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onerror = () => {
        setRecordingError('Recording failed. Please try again.');
        toast.error('Recording failed');
      };

      recorder.onstop = () => {
        const recordedMimeType = recorder.mimeType || mimeType || 'audio/webm';
        const recordedBlob = new Blob(chunksRef.current, { type: recordedMimeType });

        stream.getTracks().forEach((track) => track.stop());
        resetRecordingInterval();
        setRecording(false);

        if (recordedBlob.size > 0) {
          uploadRecordedAudio(recordedBlob, recordedMimeType);
          toast.success('Recording captured. Uploading now...');
        } else {
          toast.error('No audio captured. Please record again.');
        }
      };

      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      setRecording(true);
      setRecordingTime(0);
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(useAudioStore.getState().recordingTime + 1);
      }, 1000);
    } catch {
      const message = 'Microphone access was denied or unavailable.';
      setRecordingError(message);
      setRecording(false);
      resetRecordingInterval();
      toast.error(message);
    }
  }, [
    getSupportedMimeType,
    isRecording,
    resetRecordingInterval,
    setRecording,
    setRecordingTime,
    uploadRecordedAudio,
  ]);

  useEffect(() => {
    return () => {
      stopRecording();
      resetRecordingInterval();
      setRecording(false);
      setRecordingTime(0);
    };
  }, [resetRecordingInterval, setRecording, setRecordingTime, stopRecording]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'audio/*': ['.mp3', '.wav', '.m4a', '.flac', '.ogg', '.webm'],
    },
    maxSize: 500 * 1024 * 1024, // 500MB
    multiple: false,
  });

  if (isLoading) {
    return <Loading message="Loading audio files..." />;
  }

  const audioFiles = data?.data?.items || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Audio Files</h1>
          <p className="text-muted-foreground">
            Upload or record audio to transcribe into text
          </p>
        </div>
        <div className="w-full max-w-xs">
          <p className="mb-1 text-xs text-muted-foreground">Processing mode</p>
          <select
            className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={transcriptionMode}
            onChange={(event) => setTranscriptionMode(event.target.value as 'transcribe' | 'translate')}
          >
            <option value="transcribe">Transcribe original language</option>
            <option value="translate">Translate to English</option>
          </select>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <select
              className="h-9 rounded-md border border-input bg-background px-2 text-xs"
              value={sourceLanguage}
              onChange={(event) => setSourceLanguage(event.target.value)}
            >
              <option value="auto">Source: auto</option>
              <option value="en">Source: English</option>
              <option value="hi">Source: Hindi</option>
              <option value="es">Source: Spanish</option>
              <option value="fr">Source: French</option>
            </select>
            <select
              className="h-9 rounded-md border border-input bg-background px-2 text-xs"
              value={targetLanguage}
              onChange={(event) => setTargetLanguage(event.target.value)}
              disabled={transcriptionMode !== 'translate'}
            >
              <option value="en">Target: English</option>
              <option value="hi">Target: Hindi</option>
              <option value="es">Target: Spanish</option>
              <option value="fr">Target: French</option>
            </select>
          </div>
        </div>
      </div>

      <Card className="border-primary/30 bg-primary/5">
        <CardHeader>
          <CardTitle>Transcription Flow</CardTitle>
          <CardDescription>
            whisper STT <ArrowRight className="mx-1 inline h-3 w-3" /> optional gemini wording enhancement (based on user/project/chapter AI settings)
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Upload Area */}
      <Card>
        <CardHeader>
          <CardTitle>Live Recording</CardTitle>
          <CardDescription>
            Record from your microphone and upload automatically when you stop.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 rounded-lg border border-muted p-6 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Recording time</p>
              <p className="text-2xl font-semibold">{formatDuration(recordingTime)}</p>
              {recordingError && <p className="mt-1 text-sm text-destructive">{recordingError}</p>}
            </div>
            <div className="flex items-center gap-3">
              {isRecording ? (
                <>
                  <div className="h-3 w-3 animate-pulse rounded-full bg-red-500" />
                  <Button onClick={stopRecording} variant="destructive" disabled={isUploading}>
                    <Square className="mr-2 h-4 w-4" />
                    Stop Recording
                  </Button>
                </>
              ) : (
                <Button onClick={startRecording} disabled={isUploading}>
                  <Mic className="mr-2 h-4 w-4" />
                  Start Recording
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Upload Audio</CardTitle>
          <CardDescription>
            Drag and drop an audio file or click to browse. Supports MP3, WAV, M4A, FLAC, OGG, WebM.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            {...getRootProps()}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 text-center transition-colors ${
              isDragActive
                ? 'border-primary bg-primary/5'
                : 'border-muted-foreground/25 hover:border-primary/50'
            }`}
          >
            <input {...getInputProps()} />
            {isUploading ? (
              <div className="space-y-4">
                <Spinner size="lg" />
                <p className="text-sm text-muted-foreground">
                  Uploading... {uploadProgress}%
                </p>
                <div className="h-2 w-48 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            ) : (
              <>
                <Upload className="mb-4 h-12 w-12 text-muted-foreground" />
                <p className="text-lg font-medium">
                  {isDragActive ? 'Drop the file here' : 'Drag & drop audio file'}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  or click to browse (max 500MB)
                </p>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Audio Files List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Your Recordings</CardTitle>
            <CardDescription>
              {audioFiles.length} audio file{audioFiles.length !== 1 ? 's' : ''}
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {audioFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Mic className="h-16 w-16 text-muted-foreground/50" />
              <p className="mt-4 text-lg font-medium">No audio files yet</p>
              <p className="text-sm text-muted-foreground">
                Upload your first recording to get started
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {audioFiles.map((audio: AudioFile) => (
                <AudioFileCard
                  key={audio.id}
                  audio={audio}
                  onDelete={() => deleteMutation.mutate(audio.id)}
                  onRetry={() => retryMutation.mutate(audio.id)}
                  isDeleting={deleteMutation.isPending}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface AudioFile {
  id: string;
  title: string;
  file_path: string;
  file_size: number;
  duration?: number;
  status: string;
  error_message?: string;
  created_at: string;
}

function AudioFileCard({
  audio,
  onDelete,
  onRetry,
  isDeleting,
}: {
  audio: AudioFile;
  onDelete: () => void;
  onRetry: () => void;
  isDeleting: boolean;
}) {
  const [isPlaying, setIsPlaying] = useState(false);

  const statusColors: Record<string, string> = {
    uploaded: 'bg-blue-100 text-blue-700',
    transcribing: 'bg-yellow-100 text-yellow-700',
    transcribed: 'bg-green-100 text-green-700',
    processing: 'bg-purple-100 text-purple-700',
    processed: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700',
  };

  const isProcessing = ['transcribing', 'processing'].includes(audio.status);

  return (
    <div className="flex items-center justify-between rounded-lg border p-4">
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
          <FileAudio className="h-6 w-6 text-primary" />
        </div>
        <div>
          <p className="font-medium">{audio.title}</p>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span>{formatFileSize(audio.file_size)}</span>
            {audio.duration && (
              <>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDuration(audio.duration)}
                </span>
              </>
            )}
            <span>•</span>
            <span>{formatDate(audio.created_at)}</span>
          </div>
          {audio.status === 'failed' && audio.error_message && (
            <p className="mt-1 text-xs text-destructive">{audio.error_message}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span
          className={`rounded-full px-2 py-1 text-xs font-medium ${
            statusColors[audio.status] || 'bg-gray-100 text-gray-700'
          }`}
        >
          {isProcessing && <Spinner size="sm" className="mr-1 inline h-3 w-3" />}
          {audio.status}
        </span>
        {audio.status === 'failed' && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        )}
        <Link href={`/dashboard/audio/${audio.id}`}>
          <Button variant="outline" size="sm">
            <FileText className="mr-2 h-4 w-4" />
            Transcript
          </Button>
        </Link>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          disabled={isDeleting}
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    </div>
  );
}
