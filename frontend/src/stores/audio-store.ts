import { create } from 'zustand';

interface AudioFile {
  id: string;
  title: string;
  file_path: string;
  file_size: number;
  duration?: number;
  status: 'uploaded' | 'transcribing' | 'transcribed' | 'processing' | 'processed' | 'failed';
  created_at: string;
}

interface AudioState {
  audioFiles: AudioFile[];
  selectedAudio: AudioFile | null;
  isUploading: boolean;
  uploadProgress: number;
  isRecording: boolean;
  recordingTime: number;

  setAudioFiles: (files: AudioFile[]) => void;
  addAudioFile: (file: AudioFile) => void;
  updateAudioFile: (id: string, updates: Partial<AudioFile>) => void;
  removeAudioFile: (id: string) => void;
  selectAudio: (audio: AudioFile | null) => void;
  setUploading: (uploading: boolean) => void;
  setUploadProgress: (progress: number) => void;
  setRecording: (recording: boolean) => void;
  setRecordingTime: (time: number) => void;
}

export const useAudioStore = create<AudioState>((set) => ({
  audioFiles: [],
  selectedAudio: null,
  isUploading: false,
  uploadProgress: 0,
  isRecording: false,
  recordingTime: 0,

  setAudioFiles: (files) => set({ audioFiles: files }),

  addAudioFile: (file) =>
    set((state) => ({ audioFiles: [file, ...state.audioFiles] })),

  updateAudioFile: (id, updates) =>
    set((state) => ({
      audioFiles: state.audioFiles.map((f) =>
        f.id === id ? { ...f, ...updates } : f
      ),
      selectedAudio:
        state.selectedAudio?.id === id
          ? { ...state.selectedAudio, ...updates }
          : state.selectedAudio,
    })),

  removeAudioFile: (id) =>
    set((state) => ({
      audioFiles: state.audioFiles.filter((f) => f.id !== id),
      selectedAudio: state.selectedAudio?.id === id ? null : state.selectedAudio,
    })),

  selectAudio: (audio) => set({ selectedAudio: audio }),

  setUploading: (uploading) => set({ isUploading: uploading }),

  setUploadProgress: (progress) => set({ uploadProgress: progress }),

  setRecording: (recording) => set({ isRecording: recording }),

  setRecordingTime: (time) => set({ recordingTime: time }),
}));
