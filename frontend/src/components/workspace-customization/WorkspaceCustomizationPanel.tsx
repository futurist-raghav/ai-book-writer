'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { QueryErrorState } from '@/components/ui/query-error-state';
import { apiClient } from '@/lib/api-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface WorkspaceTerminology {
  characters_label: string;
  world_building_label: string;
  timeline_label: string;
  flow_label: string;
  notes_label: string;
  references_label: string;
  part_singular: string;
  part_plural: string;
  chapter_singular: string;
  chapter_plural: string;
  section_singular: string;
  section_plural: string;
}

interface WorkspaceCustomizationResponse {
  id: string;
  book_id: string;
  terminology: WorkspaceTerminology;
  layout_preferences: Record<string, any>;
}

interface WorkspaceCustomizationRequest {
  terminology?: Partial<WorkspaceTerminology>;
  layout_preferences?: Record<string, any>;
}

interface Props {
  bookId: string;
}

const DEFAULT_TERMINOLOGY: WorkspaceTerminology = {
  characters_label: 'Characters',
  world_building_label: 'World Building',
  timeline_label: 'Timeline',
  flow_label: 'Outline',
  notes_label: 'Notes',
  references_label: 'References',
  part_singular: 'Part',
  part_plural: 'Parts',
  chapter_singular: 'Chapter',
  chapter_plural: 'Chapters',
  section_singular: 'Section',
  section_plural: 'Sections',
};

export function WorkspaceCustomizationPanel({ bookId }: Props) {
  const queryClient = useQueryClient();
  const [terminology, setTerminology] = useState<WorkspaceTerminology>(DEFAULT_TERMINOLOGY);
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch workspace customization
  const { data: customization, isLoading, error } = useQuery({
    queryKey: ['workspace-customization', bookId],
    queryFn: () =>
      apiClient.workspaceCustomization.get(bookId) as Promise<WorkspaceCustomizationResponse>,
    enabled: !!bookId,
  });

  // Update workspace customization mutation
  const updateMutation = useMutation({
    mutationFn: (payload: WorkspaceCustomizationRequest) =>
      apiClient.workspaceCustomization.update(bookId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace-customization', bookId] });
      toast.success('Workspace customization saved');
      setHasChanges(false);
    },
    onError: () => {
      toast.error('Failed to save workspace customization');
    },
  });

  // Reset to defaults mutation
  const resetMutation = useMutation({
    mutationFn: () => apiClient.workspaceCustomization.reset(bookId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace-customization', bookId] });
      setTerminology(DEFAULT_TERMINOLOGY);
      toast.success('Workspace customization reset to defaults');
      setHasChanges(false);
    },
    onError: () => {
      toast.error('Failed to reset workspace customization');
    },
  });

  // Load customization data
  useEffect(() => {
    if (customization?.terminology) {
      setTerminology(customization.terminology);
    }
  }, [customization]);

  const handleTerminologyChange = (key: keyof WorkspaceTerminology, value: string) => {
    setTerminology((prev) => ({
      ...prev,
      [key]: value,
    }));
    setHasChanges(true);
  };

  const handleSave = () => {
    updateMutation.mutate({ terminology });
  };

  const handleReset = () => {
    if (confirm('Are you sure? This will reset all custom terminology to defaults.')) {
      resetMutation.mutate();
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return <QueryErrorState error={error} />;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Workspace Customization</CardTitle>
          <CardDescription>
            Customize sidebar labels and chapter hierarchy terminology for your project
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Sidebar Labels Section */}
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold mb-4">Sidebar Module Labels</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="characters_label">Characters Label</Label>
                  <Input
                    id="characters_label"
                    value={terminology.characters_label}
                    onChange={(e) => handleTerminologyChange('characters_label', e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="world_building_label">World Building Label</Label>
                  <Input
                    id="world_building_label"
                    value={terminology.world_building_label}
                    onChange={(e) =>
                      handleTerminologyChange('world_building_label', e.target.value)
                    }
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="timeline_label">Timeline Label</Label>
                  <Input
                    id="timeline_label"
                    value={terminology.timeline_label}
                    onChange={(e) => handleTerminologyChange('timeline_label', e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="flow_label">Flow/Outline Label</Label>
                  <Input
                    id="flow_label"
                    value={terminology.flow_label}
                    onChange={(e) => handleTerminologyChange('flow_label', e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="notes_label">Notes Label</Label>
                  <Input
                    id="notes_label"
                    value={terminology.notes_label}
                    onChange={(e) => handleTerminologyChange('notes_label', e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="references_label">References Label</Label>
                  <Input
                    id="references_label"
                    value={terminology.references_label}
                    onChange={(e) =>
                      handleTerminologyChange('references_label', e.target.value)
                    }
                    className="mt-1"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Chapter Hierarchy Terminology Section */}
          <div className="space-y-4 border-t pt-6">
            <div>
              <h3 className="text-sm font-semibold mb-4">Chapter Hierarchy Terminology</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="part_singular">Part (Singular)</Label>
                  <Input
                    id="part_singular"
                    value={terminology.part_singular}
                    onChange={(e) => handleTerminologyChange('part_singular', e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="part_plural">Part (Plural)</Label>
                  <Input
                    id="part_plural"
                    value={terminology.part_plural}
                    onChange={(e) => handleTerminologyChange('part_plural', e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="chapter_singular">Chapter (Singular)</Label>
                  <Input
                    id="chapter_singular"
                    value={terminology.chapter_singular}
                    onChange={(e) =>
                      handleTerminologyChange('chapter_singular', e.target.value)
                    }
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="chapter_plural">Chapter (Plural)</Label>
                  <Input
                    id="chapter_plural"
                    value={terminology.chapter_plural}
                    onChange={(e) =>
                      handleTerminologyChange('chapter_plural', e.target.value)
                    }
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="section_singular">Section (Singular)</Label>
                  <Input
                    id="section_singular"
                    value={terminology.section_singular}
                    onChange={(e) =>
                      handleTerminologyChange('section_singular', e.target.value)
                    }
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="section_plural">Section (Plural)</Label>
                  <Input
                    id="section_plural"
                    value={terminology.section_plural}
                    onChange={(e) =>
                      handleTerminologyChange('section_plural', e.target.value)
                    }
                    className="mt-1"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4 border-t">
            <Button
              onClick={handleSave}
              disabled={!hasChanges || updateMutation.isPending}
              className="gap-2"
            >
              {updateMutation.isPending && <Spinner className="w-4 h-4" />}
              Save Changes
            </Button>
            <Button
              onClick={handleReset}
              variant="outline"
              disabled={resetMutation.isPending}
              className="gap-2"
            >
              {resetMutation.isPending && <Spinner className="w-4 h-4" />}
              Reset to Defaults
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
