/**
 * Classroom and learning management types
 */

export type ClassroomRole = 'teacher' | 'student' | 'assistant';
export type AssignmentStatus = 'draft' | 'active' | 'closed' | 'archived';
export type SubmissionStatus = 'not_started' | 'in_progress' | 'submitted' | 'graded';

export interface Classroom {
  id: string;
  owner_id: string;
  title: string;
  description?: string;
  school_name?: string;
  code: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface ClassAssignment {
  id: string;
  classroom_id: string;
  creator_id: string;
  title: string;
  description?: string;
  instructions?: string;
  status: AssignmentStatus;
  due_date?: string;
  publish_date?: string;
  word_count_min?: number;
  word_count_max?: number;
  allow_peer_review: boolean;
  allow_student_upload: boolean;
  created_at: string;
}

export interface ClassroomSubmission {
  id: string;
  assignment_id: string;
  student_id: string;
  book_id?: string;
  submission_text?: string;
  status: SubmissionStatus;
  version: number;
  submitted_at?: string;
  created_at: string;
}

export interface ClassroomGrade {
  id: string;
  submission_id: string;
  grader_id: string;
  score?: number;
  letter_grade?: string;
  feedback_text?: string;
  graded_at: string;
}

export interface SubmissionFeedback {
  id: string;
  submission_id: string;
  author_id: string;
  content: string;
  feedback_type?: string;
  line_number?: number;
  is_resolved: boolean;
  created_at: string;
}

// Request schemas

export interface CreateClassroomRequest {
  title: string;
  description?: string;
  school_name?: string;
  is_public?: boolean;
}

export interface CreateAssignmentRequest {
  title: string;
  description?: string;
  instructions?: string;
  due_date?: string;
  publish_date?: string;
  word_count_min?: number;
  word_count_max?: number;
  allow_peer_review?: boolean;
  allow_student_upload?: boolean;
}

export interface SubmitAssignmentRequest {
  book_id?: string;
  submission_text?: string;
}

export interface GradeSubmissionRequest {
  score?: number;
  letter_grade?: string;
  feedback_text?: string;
  rubric_json?: string;
}
