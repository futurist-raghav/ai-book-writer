'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { ProjectType, ProjectTypeConfigService } from '@/lib/project-types';
import { ProjectTypeSelector } from '@/components/project-type-selector';
import { getTemplatesByProjectType } from '@/lib/project-templates';
import { toast } from 'sonner';
import { Loader2, ArrowRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

type SetupStep = 'welcome' | 'project-type' | 'project-details' | 'template' | 'loading';

export default function SetupPage() {
  const router = useRouter();
  const [step, setStep] = useState<SetupStep>('welcome');
  const [selectedType, setSelectedType] = useState<ProjectType | string>('novel');
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

  const createBookMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.books.create({
        title: projectTitle || `Untitled ${ProjectTypeConfigService.getDisplayName(selectedType as ProjectType)}`,
        description: projectDescription,
        project_type: selectedType as string,
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

      toast.success(
        templateApplied
          ? 'Project and template created! Starting your journey...'
          : 'Project created! Starting your journey...'
      );
      router.push(bookId ? `/dashboard?book=${bookId}` : '/dashboard');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to create project');
      setStep('project-details');
    },
  });

  const handleCreateProject = async () => {
    if (!projectTitle.trim()) {
      toast.error('Please enter a project title');
      return;
    }
    setStep('loading');
    createBookMutation.mutate();
  };

  const handleProjectDetailsNext = () => {
    if (!projectTitle.trim()) {
      toast.error('Please enter a project title');
      return;
    }

    if (templatesForType.length > 0) {
      setStep('template');
      return;
    }

    handleCreateProject();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Welcome Step */}
      {step === 'welcome' && (
        <div className="flex flex-col items-center justify-center min-h-screen px-4">
          <div className="max-w-2xl text-center">
            <h1 className="text-5xl md:text-6xl font-light tracking-tight text-slate-900 mb-6">
              Welcome to <span className="font-semibold">AI Book Writer</span>
            </h1>
            <p className="text-xl text-slate-600 mb-8">
              Transform any writing project into a polished masterpiece with AI-assisted planning, drafting, and revision tools.
            </p>
            <p className="text-lg text-slate-500 mb-12">
              From novels to screenplays, research papers to textbooks — we support 25+ project types.
            </p>

            <button
              onClick={() => setStep('project-type')}
              className="inline-flex items-center gap-2 px-8 py-4 bg-primary text-white rounded-lg font-semibold hover:bg-primary/90 transition-colors shadow-lg"
            >
              Let's Create Your First Project <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Project Type Selection Step */}
      {step === 'project-type' && (
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="mb-12">
            <h2 className="text-4xl font-light tracking-tight text-slate-900 mb-2">
              What type of project are you creating?
            </h2>
            <p className="text-lg text-slate-600">
              Each project type comes with tailored modules, AI assistance, and export formats.
            </p>
          </div>

          <div className="mb-8">
            <ProjectTypeSelector
              value={selectedType}
              onChange={setSelectedType}
              showDescriptions={true}
            />
          </div>

          <div className="flex gap-4 justify-between pt-8 border-t border-slate-200">
            <button
              onClick={() => setStep('welcome')}
              className="px-6 py-3 text-slate-700 font-medium rounded-lg border border-slate-300 hover:bg-slate-50 transition-colors"
            >
              Back
            </button>
            <button
              onClick={() => setStep('project-details')}
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 transition-colors"
            >
              Next <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Project Details Step */}
      {step === 'project-details' && (
        <div className="max-w-2xl mx-auto px-4 py-12">
          <div className="mb-12">
            <h2 className="text-4xl font-light tracking-tight text-slate-900 mb-2">
              Tell us about your project
            </h2>
            <p className="text-lg text-slate-600">
              Provide a title and optional description. You can always edit these later.
            </p>
          </div>

          <div className="bg-white rounded-xl p-8 border border-slate-200 space-y-6">
            {/* Project Type Display */}
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
              <p className="text-sm text-slate-600 mb-2">Project Type</p>
              <div className="flex items-center gap-3">
                <span className="text-2xl">
                  📖
                </span>
                <button
                  onClick={() => setStep('project-type')}
                  className="text-primary font-medium hover:underline"
                >
                  {ProjectTypeConfigService.getDisplayName(selectedType as ProjectType)}
                </button>
                <button
                  onClick={() => setStep('project-type')}
                  className="ml-auto text-slate-500 hover:text-slate-700"
                >
                  <span className="material-symbols-outlined">edit</span>
                </button>
              </div>
            </div>

            {/* Title Input */}
            <div className="space-y-2">
              <Label htmlFor="title" className="text-base font-medium">
                Project Title *
              </Label>
              <Input
                id="title"
                placeholder={`e.g., The Art of ${ProjectTypeConfigService.getDisplayName(selectedType as ProjectType)}`}
                value={projectTitle}
                onChange={(e) => setProjectTitle(e.target.value)}
                className="text-lg py-3"
                autoFocus
              />
              <p className="text-xs text-slate-500">Required • You can change this anytime</p>
            </div>

            {/* Description Input */}
            <div className="space-y-2">
              <Label htmlFor="description" className="text-base font-medium">
                Description (Optional)
              </Label>
              <Textarea
                id="description"
                placeholder="What's your project about? What's the core idea or story?"
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
                className="min-h-24 text-base"
              />
              <p className="text-xs text-slate-500">Helps AI understand context for better suggestions</p>
            </div>
          </div>

          <div className="flex gap-4 justify-between pt-8 border-t border-slate-200">
            <button
              onClick={() => setStep('project-type')}
              className="px-6 py-3 text-slate-700 font-medium rounded-lg border border-slate-300 hover:bg-slate-50 transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleProjectDetailsNext}
              disabled={createBookMutation.isPending || !projectTitle.trim()}
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createBookMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  {templatesForType.length > 0 ? 'Choose Template' : 'Create Project'} <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Template Selection Step */}
      {step === 'template' && (
        <div className="max-w-4xl mx-auto px-4 py-12">
          <div className="mb-10">
            <h2 className="text-4xl font-light tracking-tight text-slate-900 mb-2">
              Pick a starting template
            </h2>
            <p className="text-lg text-slate-600">
              Choose a proven structure for faster momentum, or start with a blank project.
            </p>
          </div>

          <div className="space-y-4">
            <button
              onClick={() => setSelectedTemplateId('')}
              className={`w-full rounded-xl border-2 p-5 text-left transition-colors ${
                selectedTemplateId === ''
                  ? 'border-primary bg-primary/5'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <p className="text-lg font-semibold text-slate-900">Start Blank</p>
              <p className="text-sm text-slate-600 mt-1">
                Create an empty project and build your own structure from scratch.
              </p>
            </button>

            {templatesForType.map((template) => (
              <button
                key={template.id}
                onClick={() => setSelectedTemplateId(template.id)}
                className={`w-full rounded-xl border-2 p-5 text-left transition-colors ${
                  selectedTemplateId === template.id
                    ? 'border-primary bg-primary/5'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-lg font-semibold text-slate-900">{template.name}</p>
                    <p className="text-sm text-slate-600 mt-1">{template.description}</p>
                  </div>
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 bg-slate-100 px-2 py-1 rounded">
                    {template.chapterStructure.length} sections
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {template.chapterStructure.slice(0, 4).map((chapter, index) => (
                    <span key={`${template.id}-${chapter.title}-${index}`} className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-700">
                      {chapter.title}
                    </span>
                  ))}
                  {template.chapterStructure.length > 4 && (
                    <span className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-700">
                      +{template.chapterStructure.length - 4} more
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>

          <div className="flex gap-4 justify-between pt-8 border-t border-slate-200 mt-8">
            <button
              onClick={() => setStep('project-details')}
              className="px-6 py-3 text-slate-700 font-medium rounded-lg border border-slate-300 hover:bg-slate-50 transition-colors"
              disabled={createBookMutation.isPending}
            >
              Back
            </button>
            <button
              onClick={handleCreateProject}
              disabled={createBookMutation.isPending || !projectTitle.trim()}
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createBookMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  Create Project <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Loading Step */}
      {step === 'loading' && (
        <div className="flex flex-col items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="mb-6 inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
            <h2 className="text-2xl font-semibold text-slate-900 mb-2">
              Setting up your project...
            </h2>
            <p className="text-slate-600">
              This should only take a moment. We're preparing everything for your writing journey.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
