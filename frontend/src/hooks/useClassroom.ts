'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type {
  Classroom,
  ClassAssignment,
  ClassroomSubmission,
  ClassroomGrade,
  CreateClassroomRequest,
  CreateAssignmentRequest,
  SubmitAssignmentRequest,
  GradeSubmissionRequest,
} from '@/types/classroom';

// ============================================================================
// Classroom Queries
// ============================================================================

export const useClassrooms = () => {
  return useQuery({
    queryKey: ['classrooms'],
    queryFn: async () => {
      const response = await apiClient.get<Classroom[]>('/api/v1/classrooms');
      return response.data;
    },
  });
};

export const useClassroom = (classroomId: string | null) => {
  return useQuery({
    queryKey: ['classroom', classroomId],
    queryFn: async () => {
      if (!classroomId) return null;
      const response = await apiClient.get<Classroom>(`/api/v1/classrooms/${classroomId}`);
      return response.data;
    },
    enabled: !!classroomId,
  });
};

// ============================================================================
// Classroom Mutations
// ============================================================================

export const useCreateClassroom = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateClassroomRequest) => {
      const response = await apiClient.post<Classroom>('/api/v1/classrooms', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classrooms'] });
    },
  });
};

export const useUpdateClassroom = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      classroomId,
      data,
    }: {
      classroomId: string;
      data: Partial<CreateClassroomRequest>;
    }) => {
      const response = await apiClient.put<Classroom>(
        `/api/v1/classrooms/${classroomId}`,
        data,
      );
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['classroom', variables.classroomId] });
      queryClient.invalidateQueries({ queryKey: ['classrooms'] });
    },
  });
};

export const useDeleteClassroom = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (classroomId: string) => {
      await apiClient.delete(`/api/v1/classrooms/${classroomId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classrooms'] });
    },
  });
};

export const useJoinClassroom = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      classroomId,
      code,
    }: {
      classroomId: string;
      code: string;
    }) => {
      const response = await apiClient.post(
        `/api/v1/classrooms/${classroomId}/join?code=${code}`,
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classrooms'] });
    },
  });
};

// ============================================================================
// Assignment Queries
// ============================================================================

export const useAssignments = (classroomId: string | null) => {
  return useQuery({
    queryKey: ['assignments', classroomId],
    queryFn: async () => {
      if (!classroomId) return [];
      const response = await apiClient.get<ClassAssignment[]>(
        `/api/v1/classrooms/${classroomId}/assignments`,
      );
      return response.data;
    },
    enabled: !!classroomId,
  });
};

// ============================================================================
// Assignment Mutations
// ============================================================================

export const useCreateAssignment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      classroomId,
      data,
    }: {
      classroomId: string;
      data: CreateAssignmentRequest;
    }) => {
      const response = await apiClient.post<ClassAssignment>(
        `/api/v1/classrooms/${classroomId}/assignments`,
        data,
      );
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['assignments', variables.classroomId],
      });
    },
  });
};

// ============================================================================
// Submission Queries
// ============================================================================

export const useSubmissions = (classroomId: string | null, assignmentId: string | null) => {
  return useQuery({
    queryKey: ['submissions', classroomId, assignmentId],
    queryFn: async () => {
      if (!classroomId || !assignmentId) return [];
      const response = await apiClient.get<ClassroomSubmission[]>(
        `/api/v1/classrooms/${classroomId}/assignments/${assignmentId}/submissions`,
      );
      return response.data;
    },
    enabled: !!classroomId && !!assignmentId,
  });
};

// ============================================================================
// Submission Mutations
// ============================================================================

export const useSubmitAssignment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      classroomId,
      assignmentId,
      data,
    }: {
      classroomId: string;
      assignmentId: string;
      data: SubmitAssignmentRequest;
    }) => {
      const response = await apiClient.post<ClassroomSubmission>(
        `/api/v1/classrooms/${classroomId}/assignments/${assignmentId}/submit`,
        data,
      );
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['submissions', variables.classroomId, variables.assignmentId],
      });
    },
  });
};

// ============================================================================
// Grading Mutations
// ============================================================================

export const useGradeSubmission = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      classroomId,
      submissionId,
      data,
    }: {
      classroomId: string;
      submissionId: string;
      data: GradeSubmissionRequest;
    }) => {
      const response = await apiClient.post<ClassroomGrade>(
        `/api/v1/classrooms/${classroomId}/submissions/${submissionId}/grade`,
        data,
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['submissions'] });
    },
  });
};
