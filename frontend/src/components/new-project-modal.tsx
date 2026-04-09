'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { ProjectType, ProjectTypeConfigService } from '@/lib/project-types';
import { getTemplatesByProjectType } from '@/lib/project-templates';
import { ProjectTypeSelector } from './project-type-selector';
import { toast } from 'sonner';
import { Loader2, X } from 'lucide-react';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';

interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (bookId: string) => void;
}

export function NewProjectModal({ isOpen, onClose, onSuccess }: NewProjectModalProps) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<'type' | 'details' | 'template'>('type');
  const [selectedType, setSelectedType] = useState<ProjectType>(ProjectType.NOVEL);
  const [projectTitle, setProjectTitle] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');

  const templatesForType = useMemo(
    () => getTemplatesByProjectType(selectedType),
    [selectedType]
  );

  useEffect(() => {
    if (templatesForType.length === 0) {
      setSelectedTemplateId('');
      return;
    }

    if (!templatesForType.some((template) => template.id === selectedTemplateId)) {
      setSelectedTemplateId(templatesForType[0].id);
    }
  }, [templatesForType, selectedTemplateId]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.books.create({
        title: projectTitle || `Untitled ${ProjectTypeConfigService.getDisplayName(selectedType)}`,
        description: projectDescription,
        project_type: selectedType,
        status: 'draft',
        ai_enhancement_enabled: true,
      });

      const bookId = response.data?.data?.id as string | undefined;
      const templateRequested = Boolean(bookId && selectedTemplateId);
      let templateApplied = false;

      if (bookId && selectedTemplateId) {
        try {
          await apiClient.books.applyTemplate(bookId, selectedTemplateId, { include_parts: true });
          templateApplied = true;
        } catch (templateError) {
          // Keep project creation successful even if template hydration fails.
          console.error('Template application failed:', templateError);
        }
      }

      return { bookId, templateApplied, templateRequested };
    },
    onSuccess: ({ bookId, templateApplied, templateRequested }) => {
      if (templateRequested && !templateApplied) {
        toast.warning('Project created, but the selected template could not be applied.');
      }

      toast.success(templateApplied ? 'Project and template created successfully!' : 'Project created successfully!');
      queryClient.invalidateQueries({ queryKey: ['books'] });
      resetForm();
      onClose();
      if (bookId && onSuccess) {
        onSuccess(bookId);
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to create project');
    },
  });

  const resetForm = () => {
    setStep('type');
    setSelectedType(ProjectType.NOVEL);
    setProjectTitle('');
    setProjectDescription('');
    setSelectedTemplateId('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleCreate = () => {
    if (!projectTitle.trim()) {
      toast.error('Please enter a project title');
      return;
    }
    createMutation.mutate();
  };

  const handleDetailsNext = () => {
    if (!projectTitle.trim()) {
      toast.error('Please enter a project title');
      return;
    }

    if (templatesForType.length > 0) {
      setStep('template');
      return;
    }

    handleCreate();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-slate-900">
            {step === 'type' ? 'New Project' : step === 'details' ? 'Project Details' : 'Choose Template'}
          </h2>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
            disabled={createMutation.isPending}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {step === 'type' && (
            <div className="space-y-4">
              <p className="text-slate-600 mb-6">
                Choose your project type. Each type comes optimized for its specific writing format.
              </p>
              <ProjectTypeSelector
                value={selectedType}
                onChange={setSelectedType}
                showDescriptions={true}
              />
            </div>
          )}

          {step === 'details' && (
            <div className="space-y-6">
              {/* Selected Type */}
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">
                      📖
                    </span>
                    <span className="font-medium text-slate-900">
                      {ProjectTypeConfigService.getDisplayName(selectedType)}
                    </span>
                  </div>
                  <button
                    onClick={() => setStep('type')}
                    className="text-primary hover:text-primary/80 font-medium text-sm"
                  >
                    Change
                  </button>
                </div>
              </div>

              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title" className="font-medium">
                  Project Title *
                </Label>
                <Input
                  id="title"
                  placeholder={`e.g., My ${ProjectTypeConfigService.getDisplayName(selectedType)}`}
                  value={projectTitle}
                  onChange={(e) => setProjectTitle(e.target.value)}
                  autoFocus
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description" className="font-medium">
                  Description (Optional)
                </Label>
                <Textarea
                  id="description"
                  placeholder="Tell us about your project..."
                  value={projectDescription}
                  onChange={(e) => setProjectDescription(e.target.value)}
                  className="min-h-20"
                />
              </div>
            </div>
          )}

          {step === 'template' && (
            <div className="space-y-4">
              <p className="text-slate-600 mb-4">
                Select a structured template for faster progress, or start blank.
              </p>

              <button
                onClick={() => setSelectedTemplateId('')}
                className={`w-full rounded-xl border-2 p-4 text-left transition-colors ${
                  selectedTemplateId === ''
                    ? 'border-primary bg-primary/5'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <p className="font-semibold text-slate-900">Start Blank</p>
                <p className="text-sm text-slate-600 mt-1">No pre-built structure. Build chapters your way.</p>
              </button>

              {templatesForType.map((template) => (
                <button
                  key={template.id}
                  onClick={() => setSelectedTemplateId(template.id)}
                  className={`w-full rounded-xl border-2 p-4 text-left transition-colors ${
                    selectedTemplateId === template.id
                      ? 'border-primary bg-primary/5'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-slate-900">{template.name}</p>
                      <p className="text-sm text-slate-600 mt-1">{template.description}</p>
                    </div>
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 bg-slate-100 px-2 py-1 rounded">
                      {template.chapterStructure.length} sections
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex items-center justify-between">
          <button
            onClick={
              step === 'type'
                ? handleClose
                : step === 'details'
                ? () => setStep('type')
                : () => setStep('details')
            }
            className="px-4 py-2 text-slate-700 font-medium rounded-lg hover:bg-slate-100 transition-colors"
            disabled={createMutation.isPending}
          >
            {step === 'type' ? 'Close' : 'Back'}
          </button>
          <button
            onClick={
              step === 'type'
                ? () => setStep('details')
                : step === 'details'
                ? handleDetailsNext
                : handleCreate
            }
            disabled={createMutation.isPending || (step === 'details' && !projectTitle.trim())}
            className="px-4 py-2 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {createMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                Creating...
              </>
            ) : step === 'type' ? (
              'Next'
            ) : step === 'details' ? (
              templatesForType.length > 0 ? 'Choose Template' : 'Create Project'
            ) : (
              'Create Project'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
