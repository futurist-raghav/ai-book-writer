'use client';

import React, { useState } from 'react';
import { useClassrooms, useCreateClassroom, useAssignments } from '@/hooks/useClassroom';
import { AssignmentWizard } from '@/components/classroom/assignment-wizard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { Users, BookOpen, Plus, Copy, Check, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function ClassroomsPage() {
  const { data: classrooms = [] } = useClassrooms();
  const { mutate: createClassroom, isPending: isCreating } = useCreateClassroom();
  const { data: assignments = [], isLoading: assignmentsLoading } = useAssignments(null);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showAssignmentWizard, setShowAssignmentWizard] = useState(false);
  const [title, setTitle] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [selectedClassroom, setSelectedClassroom] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const handleCreateClassroom = () => {
    if (!title.trim()) {
      toast.error('Please enter a classroom title');
      return;
    }

    createClassroom(
      {
        title,
        school_name: schoolName || undefined,
        is_public: false,
      },
      {
        onSuccess: () => {
          setTitle('');
          setSchoolName('');
          setShowCreateForm(false);
          toast.success('Classroom created!');
        },
      },
    );
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
    toast.success('Code copied!');
  };

  const selectedClass = classrooms.find((c) => c.id === selectedClassroom);
  const classAssignments = assignments.filter((a) => a.classroom_id === selectedClassroom);

  return (
    <div className="flex min-h-screen flex-1 flex-col">
      {/* Header */}
      <div className="border-b border-outline-variant/35 bg-surface-container-lowest/90 px-6 py-4 backdrop-blur-md">
        <div className="mb-4">
          <Breadcrumb>
            <BreadcrumbItem>
              <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <span className="text-on-surface-variant">Classrooms</span>
            </BreadcrumbItem>
          </Breadcrumb>
        </div>
        <h1 className="flex items-center gap-2 text-3xl font-bold text-on-surface">
          <Users className="h-8 w-8 text-purple-600" />
          Classroom Management
        </h1>
        <p className="mt-2 text-sm text-on-surface-variant">
          Create and manage classrooms for group writing instruction
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto bg-surface p-6">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Classrooms List */}
          <div className="lg:col-span-1">
            <div className="elevated-panel rounded-xl">
              <div className="border-b border-outline-variant/35 p-4">
                <h2 className="text-lg font-semibold text-on-surface">
                  My Classrooms
                </h2>
                <p className="mt-1 text-sm text-on-surface-variant">
                  {classrooms.length} classroom{classrooms.length !== 1 ? 's' : ''}
                </p>
              </div>

              <div className="max-h-96 space-y-2 overflow-y-auto p-4">
                {classrooms.length === 0 ? (
                  <p className="text-center text-sm text-on-surface-variant">
                    No classrooms yet
                  </p>
                ) : (
                  classrooms.map((classroom) => (
                    <button
                      key={classroom.id}
                      onClick={() => setSelectedClassroom(classroom.id)}
                      className={`w-full rounded-lg border p-3 text-left transition-colors ${
                        selectedClassroom === classroom.id
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-outline-variant/25 bg-surface-container-low hover:bg-surface-container'
                      }`}
                    >
                      <p className="font-medium text-on-surface">
                        {classroom.title}
                      </p>
                      {classroom.school_name && (
                        <p className="text-xs text-on-surface-variant">
                          {classroom.school_name}
                        </p>
                      )}
                    </button>
                  ))
                )}
              </div>

              <div className="border-t border-outline-variant/35 p-4">
                <Button
                  onClick={() => setShowCreateForm(!showCreateForm)}
                  className="w-full"
                  variant={showCreateForm ? 'outline' : 'default'}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  New Classroom
                </Button>
              </div>

              {/* Create Form */}
              {showCreateForm && (
                <div className="border-t border-outline-variant/35 p-4">
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-on-surface-variant">
                        Classroom Title
                      </label>
                      <Input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="e.g., Advanced Fiction Writing"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-on-surface-variant">
                        School/Institution (optional)
                      </label>
                      <Input
                        value={schoolName}
                        onChange={(e) => setSchoolName(e.target.value)}
                        placeholder="e.g., University of Writing"
                        className="mt-1"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={handleCreateClassroom}
                        disabled={isCreating || !title.trim()}
                        className="flex-1"
                      >
                        Create
                      </Button>
                      <Button
                        onClick={() => setShowCreateForm(false)}
                        variant="outline"
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Classroom Details */}
          <div className="lg:col-span-2">
            {selectedClass ? (
              <div className="space-y-4">
                {/* Classroom Info */}
                <div className="elevated-panel rounded-xl p-6">
                  <h2 className="text-2xl font-bold text-on-surface">
                    {selectedClass.title}
                  </h2>
                  {selectedClass.description && (
                    <p className="mt-2 text-on-surface-variant">
                      {selectedClass.description}
                    </p>
                  )}

                  {/* Join Code */}
                  <div className="mt-4 rounded-lg bg-surface-container-low p-4">
                    <p className="text-sm font-medium text-on-surface-variant">
                      Student Join Code
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <code className="flex-1 rounded bg-surface-container-lowest px-3 py-2 font-mono text-lg font-bold text-purple-600">
                        {selectedClass.code}
                      </code>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCopyCode(selectedClass.code)}
                      >
                        {copiedCode === selectedClass.code ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <p className="mt-2 text-xs text-on-surface-variant">
                      Share this code with students so they can join the classroom
                    </p>
                  </div>
                </div>

                {/* Assignments Section */}
                <div className="elevated-panel rounded-xl p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-5 w-5 text-blue-600" />
                      <h3 className="text-lg font-semibold text-on-surface">
                        Assignments
                      </h3>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => setShowAssignmentWizard(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Create Assignment
                    </Button>
                  </div>

                  {classAssignments.length === 0 ? (
                    <div className="mt-4 rounded-lg border border-dashed border-outline-variant/35 p-6 text-center">
                      <AlertCircle className="mx-auto h-8 w-8 text-on-surface-variant" />
                      <p className="mt-2 text-on-surface-variant">
                        No assignments yet
                      </p>
                    </div>
                  ) : (
                    <div className="mt-4 space-y-2">
                      {classAssignments.map((assignment) => (
                        <div
                          key={assignment.id}
                          className="rounded-lg border border-outline-variant/30 p-3"
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-medium text-on-surface">
                                {assignment.title}
                              </p>
                              {assignment.due_date && (
                                <p className="text-xs text-on-surface-variant">
                                  Due:{' '}
                                  {new Date(assignment.due_date).toLocaleDateString()}
                                </p>
                              )}
                            </div>
                            <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-800 dark:bg-blue-900/20 dark:text-blue-200">
                              {assignment.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="elevated-panel rounded-lg p-4">
                    <p className="text-sm text-on-surface-variant">
                      Assignments
                    </p>
                    <p className="mt-1 text-2xl font-bold text-on-surface">
                      {classAssignments.length}
                    </p>
                  </div>
                  <div className="elevated-panel rounded-lg p-4">
                    <p className="text-sm text-on-surface-variant">
                      Students
                    </p>
                    <p className="mt-1 text-2xl font-bold text-on-surface">
                      0
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="elevated-panel rounded-xl border border-dashed border-outline-variant/40 p-12 text-center">
                <Users className="mx-auto h-12 w-12 text-on-surface-variant" />
                <h3 className="mt-4 text-lg font-semibold text-on-surface">
                  Select a classroom
                </h3>
                <p className="mt-2 text-on-surface-variant">
                  Create a new classroom or select one from the list to get started
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Assignment Wizard Dialog */}
        {selectedClassroom && (
          <AssignmentWizard
            classroomId={selectedClassroom}
            open={showAssignmentWizard}
            onOpenChange={setShowAssignmentWizard}
          />
        )}
      </div>
    </div>
  );
}
