'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Upload,
  Mic,
  Play,
  Pause,
  Trash2,
  FileAudio,
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
  const { isUploading, uploadProgress, setUploading, setUploadProgress } = useAudioStore();

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
      </div>

      {/* Upload Area */}
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
