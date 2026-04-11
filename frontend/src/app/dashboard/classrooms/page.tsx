'use client';

import React, { useState } from 'react';
import { useClassrooms, useCreateClassroom, useAssignments, useCreateAssignment } from '@/hooks/useClassroom';
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
    <div className="flex-1 flex flex-col min-h-screen">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white px-6 py-4 dark:border-gray-800 dark:bg-gray-950">
        <div className="mb-4">
          <Breadcrumb>
            <BreadcrumbItem>
              <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <span className="text-gray-600 dark:text-gray-400">Classrooms</span>
            </BreadcrumbItem>
          </Breadcrumb>
        </div>
        <h1 className="flex items-center gap-2 text-3xl font-bold text-gray-900 dark:text-white">
          <Users className="h-8 w-8 text-purple-600" />
          Classroom Management
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Create and manage classrooms for group writing instruction
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto bg-gray-50 p-6 dark:bg-gray-900">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Classrooms List */}
          <div className="lg:col-span-1">
            <div className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-950">
              <div className="border-b border-gray-200 p-4 dark:border-gray-800">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  My Classrooms
                </h2>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  {classrooms.length} classroom{classrooms.length !== 1 ? 's' : ''}
                </p>
              </div>

              <div className="max-h-96 space-y-2 overflow-y-auto p-4">
                {classrooms.length === 0 ? (
                  <p className="text-center text-sm text-gray-500 dark:text-gray-400">
                    No classrooms yet
                  </p>
                ) : (
                  classrooms.map((classroom) => (
                    <button
                      key={classroom.id}
                      onClick={() => setSelectedClassroom(classroom.id)}
                      className={`w-full rounded-lg border p-3 text-left transition-colors ${
                        selectedClassroom === classroom.id
                          ? 'border-purple-500 bg-purple-50 dark:border-purple-600 dark:bg-purple-900/20'
                          : 'border-gray-200 bg-gray-50 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-gray-800'
                      }`}
                    >
                      <p className="font-medium text-gray-900 dark:text-white">
                        {classroom.title}
                      </p>
                      {classroom.school_name && (
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          {classroom.school_name}
                        </p>
                      )}
                    </button>
                  ))
                )}
              </div>

              <div className="border-t border-gray-200 p-4 dark:border-gray-800">
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
                <div className="border-t border-gray-200 p-4 dark:border-gray-800">
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
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
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
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
                <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-950">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {selectedClass.title}
                  </h2>
                  {selectedClass.description && (
                    <p className="mt-2 text-gray-700 dark:text-gray-300">
                      {selectedClass.description}
                    </p>
                  )}

                  {/* Join Code */}
                  <div className="mt-4 rounded-lg bg-gray-50 p-4 dark:bg-gray-900">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Student Join Code
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <code className="flex-1 rounded bg-white px-3 py-2 font-mono text-lg font-bold text-purple-600 dark:bg-gray-800">
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
                    <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                      Share this code with students so they can join the classroom
                    </p>
                  </div>
                </div>

                {/* Assignments Section */}
                <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-950">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-5 w-5 text-blue-600" />
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Assignments
                      </h3>
                    </div>
                    <Button size="sm" variant="outline">
                      <Plus className="mr-2 h-4 w-4" />
                      Create Assignment
                    </Button>
                  </div>

                  {classAssignments.length === 0 ? (
                    <div className="mt-4 rounded-lg border border-dashed border-gray-300 p-6 text-center dark:border-gray-700">
                      <AlertCircle className="mx-auto h-8 w-8 text-gray-400" />
                      <p className="mt-2 text-gray-600 dark:text-gray-400">
                        No assignments yet
                      </p>
                    </div>
                  ) : (
                    <div className="mt-4 space-y-2">
                      {classAssignments.map((assignment) => (
                        <div
                          key={assignment.id}
                          className="rounded-lg border border-gray-200 p-3 dark:border-gray-700"
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">
                                {assignment.title}
                              </p>
                              {assignment.due_date && (
                                <p className="text-xs text-gray-600 dark:text-gray-400">
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
                  <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Assignments
                    </p>
                    <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
                      {classAssignments.length}
                    </p>
                  </div>
                  <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Students
                    </p>
                    <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
                      0
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center dark:border-gray-700 dark:bg-gray-950">
                <Users className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
                  Select a classroom
                </h3>
                <p className="mt-2 text-gray-600 dark:text-gray-400">
                  Create a new classroom or select one from the list to get started
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
