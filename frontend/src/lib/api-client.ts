import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/stores/auth-store';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

function normalizeBookListResponse(payload: any, requestedLimit?: number) {
  const normalizedPayload = payload && typeof payload === 'object' ? payload : {};
  const nestedData = normalizedPayload.data && typeof normalizedPayload.data === 'object'
    ? normalizedPayload.data
    : {};

  const items = Array.isArray(nestedData.items)
    ? nestedData.items
    : Array.isArray(normalizedPayload.items)
      ? normalizedPayload.items
      : Array.isArray(normalizedPayload.books)
        ? normalizedPayload.books
        : [];

  const fallbackLimit =
    Number(requestedLimit) > 0
      ? Number(requestedLimit)
      : Number(nestedData.limit || normalizedPayload.limit) > 0
        ? Number(nestedData.limit || normalizedPayload.limit)
        : items.length || 20;

  const totalRaw = Number(nestedData.total ?? normalizedPayload.total ?? normalizedPayload.count ?? items.length);
  const total = Number.isFinite(totalRaw) && totalRaw >= 0 ? totalRaw : items.length;

  const pageRaw = Number(nestedData.page ?? normalizedPayload.page ?? 1);
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? pageRaw : 1;

  const pagesRaw = Number(nestedData.pages ?? normalizedPayload.pages);
  const pages = Number.isFinite(pagesRaw) && pagesRaw >= 1
    ? pagesRaw
    : Math.max(1, Math.ceil(total / Math.max(1, fallbackLimit)));

  return {
    ...normalizedPayload,
    data: {
      ...nestedData,
      items,
      total,
      page,
      limit: fallbackLimit,
      pages,
    },
  };
}

function normalizeBookDetailResponse(payload: any) {
  if (payload && typeof payload === 'object') {
    if (payload.data && typeof payload.data === 'object') {
      return payload;
    }

    if (payload.book && typeof payload.book === 'object') {
      return {
        ...payload,
        data: payload.book,
      };
    }
  }

  return {
    data: payload,
  };
}

// Create axios instance
export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().accessToken;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for token refresh
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };
    if (!originalRequest) {
      return Promise.reject(error);
    }

    const requestUrl = originalRequest.url || '';
    const isAuthEndpoint = /\/auth\/(login|register|refresh)\/?$/.test(requestUrl);
    if (isAuthEndpoint) {
      return Promise.reject(error);
    }

    const statusCode = error.response?.status;
    const detail = (error.response?.data as { detail?: string } | undefined)?.detail;

    const isAuthError =
      statusCode === 401 ||
      (statusCode === 403 && detail === 'Not authenticated');

    // If auth failed and not already retrying, try to refresh token.
    if (isAuthError && !originalRequest._retry) {
      originalRequest._retry = true;

      const refreshToken = useAuthStore.getState().refreshToken;
      if (refreshToken) {
        try {
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refresh_token: refreshToken,
          });

          const { access_token, refresh_token } = response.data;
          useAuthStore.getState().setTokens(access_token, refresh_token);

          // Retry original request with new token
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${access_token}`;
          }
          return api(originalRequest);
        } catch (refreshError) {
          // Refresh failed, logout user and let router-controlled layers redirect.
          useAuthStore.getState().logout();
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('auth:expired'));
          }
          return Promise.reject(refreshError);
        }
      } else {
        // No refresh token available, force re-authentication via UI/router layer.
        useAuthStore.getState().logout();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('auth:expired'));
        }
      }
    }

    return Promise.reject(error);
  }
);

// Type-safe API methods
export const apiClient = {
  // Auth
  auth: {
    register: async (data: { email: string; password: string; full_name?: string; ai_assist_enabled?: boolean }) =>
      api.post('/auth/register', data),
    login: async (data: { email: string; password: string }) =>
      api.post('/auth/login', data),
    refresh: async (refreshToken: string) =>
      api.post('/auth/refresh', { refresh_token: refreshToken }),
    me: async () => api.get('/auth/me'),
    updateMe: async (data: { full_name?: string }) =>
      api.put('/auth/me', data),
    updateWritingProfile: async (data: {
      writing_style?: string;
      preferred_tense?: string;
      preferred_perspective?: string;
      ai_assist_enabled?: boolean;
    }) => api.put('/auth/me/writing-profile', data),
    changePassword: async (data: { current_password: string; new_password: string }) =>
      api.post('/auth/change-password', data),
  },

  // Audio
  audio: {
    list: async (params?: { skip?: number; limit?: number; status?: string }) =>
      api.get('/audio', { params }),
    get: async (id: string) => api.get(`/audio/${id}`),
    upload: async (
      file: File,
      onProgress?: (progress: number) => void,
      options?: {
        transcription_mode?: 'transcribe' | 'translate';
        chapter_id?: string;
        source_language?: string;
        target_language?: string;
      }
    ) => {
      const formData = new FormData();
      formData.append('file', file);
      if (options?.transcription_mode) {
        formData.append('transcription_mode', options.transcription_mode);
      }
      if (options?.chapter_id) {
        formData.append('chapter_id', options.chapter_id);
      }
      if (options?.source_language) {
        formData.append('source_language', options.source_language);
      }
      if (options?.target_language) {
        formData.append('target_language', options.target_language);
      }
      return api.post('/audio/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          if (onProgress && progressEvent.total) {
            onProgress(Math.round((progressEvent.loaded * 100) / progressEvent.total));
          }
        },
      });
    },
    update: async (id: string, data: { title?: string; description?: string }) =>
      api.put(`/audio/${id}`, data),
    delete: async (id: string) => api.delete(`/audio/${id}`),
    status: async (id: string) => api.get(`/audio/${id}/status`),
    retry: async (id: string) => api.post(`/audio/${id}/retry`),
  },

  // Transcriptions
  transcriptions: {
    list: async (params?: { skip?: number; limit?: number }) =>
      api.get('/transcriptions', { params }),
    get: async (id: string) => api.get(`/transcriptions/${id}`),
    getByAudio: async (audioId: string) => api.get(`/transcriptions/audio/${audioId}`),
    update: async (id: string, data: { text?: string }) =>
      api.put(`/transcriptions/${id}`, data),
    createManual: async (audioId: string, data: { text: string; language?: string }) =>
      api.post(`/transcriptions/audio/${audioId}/manual`, data),
    extractEvents: async (id: string, chapterId?: string) =>
      api.post(`/transcriptions/${id}/extract-events`, undefined, {
        params: chapterId ? { chapter_id: chapterId } : undefined,
      }),
  },

  // Events
  events: {
    list: async (params?: {
      skip?: number;
      limit?: number;
      category?: string;
      featured?: boolean;
    }) => api.get('/events', { params }),
    get: async (id: string) => api.get(`/events/${id}`),
    create: async (data: {
      title: string;
      content: string;
      summary?: string;
      category?: string;
      subcategory?: string;
      tags?: string[];
      location?: string;
      people?: Array<{ name: string; relationship?: string; description?: string }>;
      sentiment?: string;
      emotions?: string[];
    }) => api.post('/events', data),
    update: async (
      id: string,
      data: Partial<{
        title: string;
        summary: string;
        content: string;
        category: string;
        subcategory: string;
        tags: string[];
        location: string;
        people: Array<{ name: string; relationship?: string; description?: string }>;
        sentiment: string;
        emotions: string[];
      }>
    ) =>
      api.put(`/events/${id}`, data),
    delete: async (id: string) => api.delete(`/events/${id}`),
    reorder: async (eventIds: string[]) => api.post('/events/reorder', { event_ids: eventIds }),
    feature: async (id: string, featured: boolean) =>
      api.post(`/events/${id}/feature`, { is_featured: featured }),
    categories: async () => api.get('/events/categories'),
    tags: async () => api.get('/events/tags'),
  },

  // Chapters
  chapters: {
    list: async (params?: { page?: number; limit?: number; status?: string; workflow_status?: string; chapter_type?: string }) =>
      api.get('/chapters', { params }),
    get: async (id: string) => api.get(`/chapters/${id}`),
    workspace: async (id: string) => api.get(`/chapters/${id}/workspace`),
    create: async (data: {
      title: string;
      chapter_number: number;
      subtitle?: string;
      description?: string;
      summary?: string;
      chapter_type?: string;
      workflow_status?: string;
      word_count_target?: number;
      timeline_position?: string;
      pov_character?: string;
      writing_style?: string;
      tone?: string;
      ai_enhancement_enabled?: boolean;
      event_ids?: string[];
    }) => api.post('/chapters', data),
    update: async (id: string, data: Partial<{ title: string; description?: string; summary?: string; chapter_type?: string; workflow_status?: string; word_count_target?: number; timeline_position?: string; pov_character?: string; writing_style?: string; tone?: string; ai_enhancement_enabled?: boolean; status?: string }>) =>
      api.put(`/chapters/${id}`, data),
    delete: async (id: string) => api.delete(`/chapters/${id}`),
    addEvent: async (chapterId: string, eventId: string, orderIndex?: number) =>
      api.post(`/chapters/${chapterId}/events`, { event_ids: [eventId], order_index: orderIndex }),
    removeEvent: async (chapterId: string, eventId: string) =>
      api.delete(`/chapters/${chapterId}/events/${eventId}`),
    reorderEvents: async (chapterId: string, eventIds: string[]) =>
      api.post(`/chapters/${chapterId}/events/reorder`, { event_ids: eventIds }),
    compile: async (chapterId: string, options?: { writing_style?: string; tone?: string; regenerate?: boolean }) =>
      api.post(`/chapters/${chapterId}/compile`, options || {}),
    generateSummary: async (chapterId: string) =>
      api.post(`/chapters/${chapterId}/generate-summary`),
    generateOutline: async (chapterId: string) =>
      api.post(`/chapters/${chapterId}/generate-outline`),
    expandNotes: async (
      chapterId: string,
      data: { notes: string; tone?: string; preserve_writer_commitment?: boolean }
    ) => api.post(`/chapters/${chapterId}/expand-notes`, data),
    checkConsistency: async (chapterId: string) =>
      api.post(`/chapters/${chapterId}/check-consistency`),
    suggestCitations: async (chapterId: string) =>
      api.post(`/chapters/${chapterId}/suggest-citations`),
    analyzeTone: async (chapterId: string) =>
      api.post(`/chapters/${chapterId}/analyze-tone`),
    generateExercises: async (
      chapterId: string,
      params?: { difficulty?: string; exercise_types?: string; count?: number }
    ) => api.post(`/chapters/${chapterId}/generate-exercises`, {}, { params }),
    extractEntities: async (chapterId: string) =>
      api.post(`/chapters/${chapterId}/extract-entities`),
    generateContext: async (chapterId: string, data?: { writing_form?: string; force?: boolean }) =>
      api.post(`/chapters/${chapterId}/context/generate`, data || {}),
    updateContext: async (chapterId: string, data: { base_context: string; writing_form?: string }) =>
      api.put(`/chapters/${chapterId}/context`, data),
    chat: async (
      chapterId: string,
      data: {
        message: string;
        writing_form?: string;
        rewrite_depth?: 'light' | 'deep';
        include_current_compiled_content?: boolean;
        preserve_writer_commitment?: boolean;
      }
    ) => api.post(`/chapters/${chapterId}/chat`, data),
    uploadAsset: async (chapterId: string, file: File, assetType?: 'image' | 'document') => {
      const formData = new FormData();
      formData.append('file', file);
      if (assetType) {
        formData.append('asset_type', assetType);
      }
      return api.post(`/chapters/${chapterId}/assets/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    // Version snapshots
    versions: {
      list: async (chapterId: string, params?: { page?: number; page_size?: number }) =>
        api.get(`/chapters/${chapterId}/versions`, { params }),
      get: async (chapterId: string, versionId: string) =>
        api.get(`/chapters/${chapterId}/versions/${versionId}`),
      create: async (chapterId: string, data?: { version_name?: string; change_description?: string; is_auto_snapshot?: boolean }) =>
        api.post(`/chapters/${chapterId}/versions`, data || {}),
      update: async (chapterId: string, versionId: string, data: { version_name?: string; change_description?: string }) =>
        api.patch(`/chapters/${chapterId}/versions/${versionId}`, data),
      delete: async (chapterId: string, versionId: string) =>
        api.delete(`/chapters/${chapterId}/versions/${versionId}`),
      revertTo: async (chapterId: string, versionId: string) =>
        api.post(`/chapters/${chapterId}/revert-to/${versionId}`),
      diff: async (chapterId: string, fromVersionId: string, toVersionId: string) =>
        api.get(`/chapters/${chapterId}/versions/${fromVersionId}/diff/${toVersionId}`),
    },
    // Suggestions / Track Changes
    suggestions: {
      list: async (chapterId: string, params?: { status?: string; author_id?: string; skip?: number; limit?: number }) =>
        api.get(`/chapters/${chapterId}/suggestions`, { params }),
      create: async (
        chapterId: string,
        data: {
          suggestion_type: string;
          text_before: string;
          text_after: string;
          position: number;
          length: number;
          reason?: string;
        }
      ) => api.post(`/chapters/${chapterId}/suggestions`, data),
      accept: async (chapterId: string, suggestionId: string) =>
        api.put(`/chapters/${chapterId}/suggestions/${suggestionId}/accept`, {}),
      reject: async (chapterId: string, suggestionId: string, reason?: string) =>
        api.put(`/chapters/${chapterId}/suggestions/${suggestionId}/reject`, reason ? { reason } : {}),
      delete: async (chapterId: string, suggestionId: string) =>
        api.delete(`/chapters/${chapterId}/suggestions/${suggestionId}`),
      batchAccept: async (chapterId: string, suggestionIds: string[]) =>
        api.post(`/chapters/${chapterId}/suggestions/batch-accept`, suggestionIds),
      batchReject: async (chapterId: string, suggestionIds: string[], reason?: string) =>
        api.post(
          `/chapters/${chapterId}/suggestions/batch-reject`,
          reason ? { suggestion_ids: suggestionIds, reason } : suggestionIds
        ),
    },
  },
  books: {
    list: async (params?: {
      page?: number;
      limit?: number;
      status?: string;
      project_type?: string;
      genre?: string;
      pinned?: boolean;
      sort_by?: 'updated_at' | 'created_at' | 'title' | 'status';
      sort_order?: 'asc' | 'desc';
    }) => {
      const response = await api.get('/books', { params });
      return {
        ...response,
        data: normalizeBookListResponse(response.data, params?.limit),
      };
    },
    get: async (id: string) => {
      const response = await api.get(`/books/${id}`);
      return {
        ...response,
        data: normalizeBookDetailResponse(response.data),
      };
    },
    create: async (data: {
      title: string;
      subtitle?: string;
      author_name?: string;
      description?: string;
      project_context?: string;
      project_settings?: Record<string, unknown>;
      project_type?: string;
      book_type?: string;
      genres?: string[];
      tags?: string[];
      labels?: string[];
      cover_image_url?: string;
      cover_color?: string;
      target_word_count?: number;
      deadline_at?: string;
      is_pinned?: boolean;
      default_writing_form?: string;
      default_chapter_tone?: string;
      ai_enhancement_enabled?: boolean;
      status?: string;
      auto_create_chapters?: number;
    }) => {
      const response = await api.post('/books', data);
      return {
        ...response,
        data: normalizeBookDetailResponse(response.data),
      };
    },
    update: async (id: string, data: Partial<{ title: string; description?: string; project_context?: string; project_settings?: Record<string, unknown>; project_type?: string; book_type?: string; genres?: string[]; tags?: string[]; labels?: string[]; cover_image_url?: string; cover_color?: string; target_word_count?: number | null; deadline_at?: string | null; is_pinned?: boolean; default_writing_form?: string; default_chapter_tone?: string; ai_enhancement_enabled?: boolean; status?: string }>) =>
      api.put(`/books/${id}`, data),
    delete: async (id: string) => api.delete(`/books/${id}`),
    duplicate: async (bookId: string) => api.post(`/books/${bookId}/duplicate`),
    applyTemplate: async (
      bookId: string,
      templateId: string,
      options?: { replace_existing?: boolean; include_parts?: boolean }
    ) => api.post(`/books/${bookId}/apply-template`, { template_id: templateId, ...(options || {}) }),
    generateOutline: async (
      bookId: string,
      data?: { chapter_count?: number; auto_create_chapters?: boolean; replace_existing?: boolean }
    ) => api.post(`/books/${bookId}/generate-outline`, data || {}),
    generateSynopsis: async (
      bookId: string,
      data?: { length?: 'one_page' | 'three_page' | 'full' }
    ) => api.post(`/books/${bookId}/generate-synopsis`, data || {}),
    archive: async (bookId: string) => api.post(`/books/${bookId}/archive`),
    restore: async (bookId: string) => api.post(`/books/${bookId}/restore`),
    pin: async (bookId: string, isPinned: boolean) => api.post(`/books/${bookId}/pin`, { is_pinned: isPinned }),
    addChapter: async (bookId: string, chapterId: string, orderIndex?: number) =>
      api.post(`/books/${bookId}/chapters`, { chapter_ids: [chapterId], order_index: orderIndex }),
    removeChapter: async (bookId: string, chapterId: string) =>
      api.delete(`/books/${bookId}/chapters/${chapterId}`),
    reorderChapters: async (bookId: string, chapterIds: string[]) =>
      api.post(`/books/${bookId}/chapters/reorder`, { chapter_ids: chapterIds }),
    updateFrontMatter: async (bookId: string, data: Record<string, string | undefined>) =>
      api.put(`/books/${bookId}/front-matter`, data),
    updateBackMatter: async (bookId: string, data: Record<string, string | undefined>) =>
      api.put(`/books/${bookId}/back-matter`, data),
    compilePreview: async (
      bookId: string,
      params?: {
        include_front_matter?: boolean;
        include_back_matter?: boolean;
        include_toc?: boolean;
        page_size?: string;
        font_size?: number;
        line_spacing?: number;
        preview_mode?: 'print' | 'ebook' | 'submission';
      }
    ) => api.get(`/books/${bookId}/compile-preview`, { params }),
    accessibilityChecks: async (bookId: string) =>
      api.get(`/books/${bookId}/accessibility-checks`),
    accessibilityHistory: async (bookId: string) =>
      api.get(`/books/${bookId}/accessibility-checks/history`),
    accessibilityWcagGuidelines: async (bookId: string) =>
      api.get(`/books/${bookId}/accessibility-checks/wcag-guidelines`),
    export: async (bookId: string, format: string, options?: Record<string, unknown>) =>
      api.post(`/books/${bookId}/export`, { format, ...(options || {}) }),
  },

  // Entities
  entities: {
    getChapters: async (bookId: string, entityId: string) =>
      api.get(`/books/${bookId}/entities/${entityId}/chapters`),
  },

  // Collaboration
  collaboration: {
    members: async (params?: { page?: number; limit?: number }) =>
      api.get('/collaboration/members', { params }),
    membersByBook: async (
      bookId: string,
      params?: { page?: number; limit?: number; role?: string; accepted_only?: boolean }
    ) => api.get(`/books/${bookId}/collaborators`, { params }),
    comments: async (params?: { page?: number; limit?: number; chapter_id?: string }) =>
      api.get('/collaboration/comments', { params }),
    commentsByBook: async (
      bookId: string,
      params?: { page?: number; limit?: number; unresolved_only?: boolean; target_type?: string }
    ) => api.get(`/books/${bookId}/comments`, { params }),
    activity: async (params?: { page?: number; limit?: number }) =>
      api.get('/collaboration/activity', { params }),
    activityByBook: async (
      bookId: string,
      params?: { page?: number; limit?: number; activity_type?: string }
    ) => api.get(`/books/${bookId}/activities`, { params }),
    invite: async (data: { email: string; role: 'editor' | 'reviewer' | 'contributor' | 'viewer' }) =>
      api.post('/collaboration/invite', data),
    inviteByBook: async (
      bookId: string,
      data: { email: string; role: 'editor' | 'reviewer' | 'contributor' | 'viewer' }
    ) => api.post(`/books/${bookId}/collaborators/invite`, data),
    addComment: async (data: { chapter_id: string; text: string; position?: number }) =>
      api.post('/collaboration/comments', data),
    addCommentByBook: async (
      bookId: string,
      data: { content: string; target_type?: string; target_id?: string }
    ) => api.post(`/books/${bookId}/comments`, data),
    removeMember: async (id: string) => api.delete(`/collaboration/members/${id}`),
    removeMemberByBook: async (bookId: string, collaboratorId: string) =>
      api.delete(`/books/${bookId}/collaborators/${collaboratorId}`),
  },

  // Publishing
  publishing: {
    list: async (params?: { page?: number; limit?: number; status?: string }) =>
      api.get('/publishing/exports', { params }),
    get: async (id: string) => api.get(`/publishing/exports/${id}`),
    export: async (data: { book_id: string; format: string; options?: Record<string, unknown> }) =>
      api.post('/publishing/exports', data),
    updateExport: async (id: string, data: Partial<{ status?: string; metadata?: Record<string, unknown> }>) =>
      api.put(`/publishing/exports/${id}`, data),
    deleteExport: async (id: string) => api.delete(`/publishing/exports/${id}`),
    download: async (id: string) => api.get(`/publishing/exports/${id}/download`, { responseType: 'blob' }),
  },

  // References
  references: {
    list: async (params?: { page?: number; limit?: number; search?: string; source_type?: string }) =>
      api.get('/references', { params }),
    get: async (id: string) => api.get(`/references/${id}`),
    create: async (data: {
      title: string;
      author?: string;
      source_type: 'book' | 'article' | 'website' | 'paper' | 'video' | 'other';
      url?: string;
      notes?: string;
      chapter_id?: string;
      extracted_text?: string;
    }) => api.post('/references', data),
    update: async (id: string, data: Partial<{ title?: string; author?: string; source_type?: string; url?: string; notes?: string; extracted_text?: string }>) =>
      api.put(`/references/${id}`, data),
    delete: async (id: string) => api.delete(`/references/${id}`),
  },

  // Flow Events  
  flowEvents: {
    // CRUD Operations
    list: async (
      bookId: string,
      params?: { page?: number; limit?: number; event_type?: string; status?: string }
    ) => api.get(`/books/${bookId}/flow-events`, { params }),
    get: async (bookId: string, eventId: string) =>
      api.get(`/books/${bookId}/flow-events/${eventId}`),
    create: async (
      bookId: string,
      data: {
        title: string;
        description?: string;
        event_type?: string;
        timeline_position?: number;
        duration?: number;
        status?: string;
        metadata?: Record<string, unknown>;
      }
    ) => api.post(`/books/${bookId}/flow-events`, data),
    update: async (
      bookId: string,
      eventId: string,
      data: Partial<{
        title?: string;
        description?: string;
        event_type?: string;
        timeline_position?: number;
        duration?: number;
        status?: string;
        metadata?: Record<string, unknown>;
      }>
    ) => api.patch(`/books/${bookId}/flow-events/${eventId}`, data),
    delete: async (bookId: string, eventId: string) =>
      api.delete(`/books/${bookId}/flow-events/${eventId}`),

    // Dependencies
    addDependency: async (
      bookId: string,
      eventId: string,
      data: {
        to_event_id: string;
        dependency_type: 'blocks' | 'triggers' | 'follows' | 'required_before';
        metadata?: Record<string, unknown>;
      }
    ) => api.post(`/books/${bookId}/flow-events/${eventId}/dependencies`, data),
    getDependencies: async (bookId: string, eventId: string) =>
      api.get(`/books/${bookId}/flow-events/${eventId}/dependencies`),
    removeDependency: async (bookId: string, eventId: string, targetEventId: string) =>
      api.delete(`/books/${bookId}/flow-events/${eventId}/dependencies/${targetEventId}`),

    // Timeline & Queries
    getTimeline: async (bookId: string) =>
      api.get(`/books/${bookId}/timeline`),
    getDependencyGraph: async (bookId: string) =>
      api.get(`/books/${bookId}/dependencies`),

    // Chapter Associations
    linkChapter: async (
      bookId: string,
      eventId: string,
      data: {
        chapter_id: string;
        order_index?: number;
      }
    ) => api.post(`/books/${bookId}/flow-events/${eventId}/chapters`, data),
    unlinkChapter: async (bookId: string, eventId: string, chapterId: string) =>
      api.delete(`/books/${bookId}/flow-events/${eventId}/chapters/${chapterId}`),
  },

  // Bibliography & Citations (P2.4)
  bibliography: {
    // Bibliography CRUD
    list: async (bookId: string, page = 1, pageSize = 50) =>
      api.get(`/books/${bookId}/bibliography`, { params: { page, page_size: pageSize } }),
    get: async (bookId: string, bibliographyId: string) =>
      api.get(`/books/${bookId}/bibliography/${bibliographyId}`),
    create: async (bookId: string, data: { title: string; authors?: string[]; year?: number; source_type?: string; source_url?: string; notes?: string }) =>
      api.post(`/books/${bookId}/bibliography`, data),
    update: async (bookId: string, bibliographyId: string, data: Partial<{ title: string; authors: string[]; year: number; source_type: string; source_url: string; notes: string }>) =>
      api.patch(`/books/${bookId}/bibliography/${bibliographyId}`, data),
    delete: async (bookId: string, bibliographyId: string) =>
      api.delete(`/books/${bookId}/bibliography/${bibliographyId}`),

    // Chapter Citations
    listChapterCitations: async (chapterId: string) =>
      api.get(`/chapters/${chapterId}/citations`),
    addCitation: async (chapterId: string, data: { bibliography_id: string; page_number?: string; context_offset?: number; context_snippet?: string; citation_format?: string }) =>
      api.post(`/chapters/${chapterId}/citations`, data),
    removeCitation: async (chapterId: string, citationId: string) =>
      api.delete(`/chapters/${chapterId}/citations/${citationId}`),

    // Export
    getFormattedBibliography: async (bookId: string) =>
      api.get(`/books/${bookId}/bibliography-formatted`),
  },

  // Workspace Customization
  workspaceCustomization: {
    get: async (bookId: string) =>
      api.get(`/books/${bookId}/workspace-customization`),
    update: async (bookId: string, data: { terminology?: Record<string, string>; layout_preferences?: Record<string, any> }) =>
      api.patch(`/books/${bookId}/workspace-customization`, data),
    reset: async (bookId: string) =>
      api.post(`/books/${bookId}/workspace-customization/reset`),
  },

  // Custom Fields
  customFields: {
    // Custom field management
    list: async (bookId: string, entityType?: string) =>
      api.get(`/books/${bookId}/custom-fields`, { params: entityType ? { entity_type: entityType } : {} }),
    get: async (bookId: string, fieldId: string) =>
      api.get(`/books/${bookId}/custom-fields/${fieldId}`),
    create: async (bookId: string, data: { entity_type: string; name: string; description?: string; field_type: string; required?: boolean; default_value?: any; options?: string[]; order_index?: string; is_visible_in_list?: boolean; is_filterable?: boolean; metadata?: Record<string, any> }) =>
      api.post(`/books/${bookId}/custom-fields`, data),
    update: async (bookId: string, fieldId: string, data: Partial<{ name: string; description: string; required: boolean; default_value: any; options: string[]; order_index: string; is_visible_in_list: boolean; is_filterable: boolean; metadata: Record<string, any> }>) =>
      api.patch(`/books/${bookId}/custom-fields/${fieldId}`, data),
    delete: async (bookId: string, fieldId: string) =>
      api.delete(`/books/${bookId}/custom-fields/${fieldId}`),

    // Custom field values
    getEntityValues: async (bookId: string, entityType: string, entityId: string) =>
      api.get(`/books/${bookId}/entities/${entityType}/${entityId}/custom-field-values`),
    setValue: async (bookId: string, entityType: string, entityId: string, fieldId: string, value: any) =>
      api.post(`/books/${bookId}/entities/${entityType}/${entityId}/custom-fields/${fieldId}/value`, { value }),
    deleteValue: async (bookId: string, entityType: string, entityId: string, fieldId: string) =>
      api.delete(`/books/${bookId}/entities/${entityType}/${entityId}/custom-fields/${fieldId}/value`),
  },

  // Import/Export
  import: {
    uploadFile: async (bookId: string | number, formData: FormData) =>
      api.post(`/books/${bookId}/import/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }),
    getPreview: async (bookId: string | number, sourceId: string | number) =>
      api.get(`/books/${bookId}/import/${sourceId}/preview`),
    applyImport: async (bookId: string | number, sourceId: string | number, data: any) =>
      api.post(`/books/${bookId}/import/${sourceId}/apply`, data),
    listSources: async (bookId: string | number) =>
      api.get(`/books/${bookId}/import`),
    getSource: async (bookId: string | number, sourceId: string | number) =>
      api.get(`/books/${bookId}/import/${sourceId}`),
    deleteSource: async (bookId: string | number, sourceId: string | number) =>
      api.delete(`/books/${bookId}/import/${sourceId}`),
  },

  // Glossary & Terms (P3.8)
  glossary: {
    extract: async (bookId: string, input: { confidence_threshold?: number; max_terms?: number; include_chapters?: string[] }) =>
      api.post(`/books/${bookId}/glossary/extract`, input),
    confirmExtraction: async (bookId: string, terms: string[]) =>
      api.post(`/books/${bookId}/glossary/confirm-extraction`, { terms }),
    list: async (bookId: string, confirmedOnly?: boolean) =>
      api.get(`/books/${bookId}/glossary`, { params: { confirmed_only: confirmedOnly } }),
    get: async (bookId: string, entryId: string) =>
      api.get(`/books/${bookId}/glossary/${entryId}`),
    create: async (bookId: string, entry: { term: string; definition?: string; definition_source?: string; part_of_speech?: string; context?: string; user_defined?: boolean }) =>
      api.post(`/books/${bookId}/glossary`, entry),
    update: async (bookId: string, entryId: string, updates: { definition?: string; definition_source?: string; part_of_speech?: string; context?: string; confirmed?: boolean }) =>
      api.patch(`/books/${bookId}/glossary/${entryId}`, updates),
    delete: async (bookId: string, entryId: string) =>
      api.delete(`/books/${bookId}/glossary/${entryId}`),
  },

  // Classrooms & Assignments
  classroom: {
    // Classroom management
    listClassrooms: async () =>
      api.get('/classrooms'),
    getClassroom: async (classroomId: string) =>
      api.get(`/classrooms/${classroomId}`),
    createClassroom: async (data: { title: string; description?: string; school_name?: string; is_public?: boolean }) =>
      api.post('/classrooms', data),
    updateClassroom: async (classroomId: string, data: Partial<{ title: string; description: string; is_public: boolean }>) =>
      api.patch(`/classrooms/${classroomId}`, data),
    deleteClassroom: async (classroomId: string) =>
      api.delete(`/classrooms/${classroomId}`),

    // Assignment management
    listAssignments: async (classroomId?: string) =>
      api.get('/assignments', { params: classroomId ? { classroom_id: classroomId } : {} }),
    getAssignment: async (assignmentId: string) =>
      api.get(`/assignments/${assignmentId}`),
    createAssignment: async (classroomId: string, data: { title: string; description?: string; instructions?: string; due_date?: string; word_count_requirement?: number; rubric?: Record<string, any> }) =>
      api.post(`/classrooms/${classroomId}/assignments`, data),
    updateAssignment: async (assignmentId: string, data: Partial<{ title: string; description: string; instructions: string; due_date: string; word_count_requirement: number; rubric: Record<string, any> }>) =>
      api.patch(`/assignments/${assignmentId}`, data),
    deleteAssignment: async (assignmentId: string) =>
      api.delete(`/assignments/${assignmentId}`),

    // Submissions
    submitAssignment: async (classroomId: string, data: { assignment_id: string; book_id?: string; submitted_text?: string }) =>
      api.post(`/classrooms/${classroomId}/submissions`, data),
    submitAssignmentFile: async (classroomId: string, formData: FormData) =>
      api.post(`/classrooms/${classroomId}/submissions/file`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }),
    listSubmissions: async (assignmentId: string) =>
      api.get(`/assignments/${assignmentId}/submissions`),
    getSubmission: async (submissionId: string) =>
      api.get(`/submissions/${submissionId}`),

    // Grading
    submitGrade: async (submissionId: string, data: { score: number; feedback?: string; rubric_scores?: Record<string, number> }) =>
      api.post(`/submissions/${submissionId}/grade`, data),
    updateGrade: async (gradeId: string, data: Partial<{ score: number; feedback: string; rubric_scores: Record<string, number> }>) =>
      api.patch(`/grades/${gradeId}`, data),
  },
};

// ============================================================================
// Type Exports for Flow Events
// ============================================================================

export interface FlowEvent {
  id: string;
  book_id: string;
  title: string;
  description?: string;
  event_type: string;
  timeline_position: number;
  duration?: number;
  status: 'planned' | 'in_progress' | 'completed' | 'archived';
  order_index: number;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface FlowDependency {
  id: string;
  book_id: string;
  from_event_id: string;
  to_event_id: string;
  dependency_type?: 'sequence' | 'causality' | 'parallel' | 'optional';
  description?: string;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Type Exports for Bibliography & Citations
// ============================================================================

export interface Bibliography {
  id: string;
  book_id: string;
  title: string;
  authors?: string[];
  year?: number;
  source_type?: string;
  source_url?: string;
  citation_formats?: Record<string, string>;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface ChapterCitation {
  id: string;
  chapter_id: string;
  bibliography_id: string;
  page_number?: string;
  context_offset?: number;
  context_snippet?: string;
  citation_format: string;
  bibliography?: Bibliography;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Type Exports for Import/Export (P2.7)
// ============================================================================

export interface ImportSourceResponse {
  id: number;
  book_id: number;
  filename: string;
  format: string;
  status: string;
  file_size: number;
  total_characters: number;
  detected_structure: Record<string, any>;
  import_settings: Record<string, any>;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export interface ImportedSectionResponse {
  section_index: number;
  title: string;
  content: string;
  estimated_word_count: number;
  content_type: string;
}

export interface ImportPreviewResponse {
  source_id: number;
  filename: string;
  format: string;
  total_sections: number;
  total_word_count: number;
  detected_structure: Record<string, any>;
  sections: ImportedSectionResponse[];
}

export interface ImportApplyRequest {
  source_id: number;
  section_indices?: number[];
  create_as_chapters?: boolean;
  split_by?: string;
  parent_part_id?: number;
  start_at_chapter_number?: number;
}

export interface ImportApplyResponse {
  import_source_id: number;
  chapters_created: number;
  total_word_count: number;
  created_chapter_ids: number[];
  completed_at: string;
}
