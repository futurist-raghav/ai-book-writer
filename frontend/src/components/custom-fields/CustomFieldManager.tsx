'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2, Edit2, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { QueryErrorState } from '@/components/ui/query-error-state';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { apiClient } from '@/lib/api-client';

interface CustomField {
  id: string;
  book_id: string;
  entity_type: string;
  name: string;
  description?: string;
  field_type: string;
  required: boolean;
  default_value?: any;
  options?: string[];
  order_index: string;
  is_visible_in_list: boolean;
  is_filterable: boolean;
  created_at: string;
  updated_at: string;
}

interface Props {
  bookId: string;
  entityType?: string;
}

const FIELD_TYPES = [
  { value: 'text', label: 'Short Text' },
  { value: 'rich_text', label: 'Rich Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Dropdown' },
  { value: 'multiselect', label: 'Multi-Select' },
  { value: 'checkbox', label: 'Checkbox' },
];

const ENTITY_TYPES = [
  { value: 'project', label: 'Project' },
  { value: 'chapter', label: 'Chapter' },
  { value: 'character', label: 'Character' },
  { value: 'location', label: 'Location' },
  { value: 'object', label: 'Object' },
  { value: 'event', label: 'Event' },
];

export function CustomFieldManager({ bookId, entityType }: Props) {
  const queryClient = useQueryClient();
  const [selectedEntity, setSelectedEntity] = useState(entityType || 'chapter');
  const [editingField, setEditingField] = useState<CustomField | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<Partial<CustomField>>({
    name: '',
    description: '',
    field_type: 'text',
    entity_type: selectedEntity,
    required: false,
    is_visible_in_list: true,
    is_filterable: true,
    options: [],
  });

  // Fetch custom fields
  const { data: fields, isLoading, error } = useQuery({
    queryKey: ['custom-fields', bookId, selectedEntity],
    queryFn: async () => {
      const response = await apiClient.customFields.list(bookId, selectedEntity);
      return response.data as CustomField[];
    },
    enabled: !!bookId && !!selectedEntity,
  });

  // Create field mutation
  const createMutation = useMutation({
    mutationFn: (payload: any) =>
      apiClient.customFields.create(bookId, {
        ...payload,
        entity_type: selectedEntity,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-fields', bookId] });
      toast.success('Custom field created');
      resetForm();
    },
    onError: () => {
      toast.error('Failed to create custom field');
    },
  });

  // Update field mutation
  const updateMutation = useMutation({
    mutationFn: ({ fieldId, data }: { fieldId: string; data: any }) =>
      apiClient.customFields.update(bookId, fieldId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-fields', bookId] });
      toast.success('Custom field updated');
      resetForm();
    },
    onError: () => {
      toast.error('Failed to update custom field');
    },
  });

  // Delete field mutation
  const deleteMutation = useMutation({
    mutationFn: (fieldId: string) =>
      apiClient.customFields.delete(bookId, fieldId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-fields', bookId] });
      toast.success('Custom field deleted');
    },
    onError: () => {
      toast.error('Failed to delete custom field');
    },
  });

  const resetForm = () => {
    setEditingField(null);
    setShowForm(false);
    setFormData({
      name: '',
      description: '',
      field_type: 'text',
      entity_type: selectedEntity,
      required: false,
      is_visible_in_list: true,
      is_filterable: true,
      options: [],
    });
  };

  const handleSave = () => {
    if (!formData.name?.trim()) {
      toast.error('Field name is required');
      return;
    }

    if (editingField) {
      updateMutation.mutate({
        fieldId: editingField.id,
        data: formData,
      });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (field: CustomField) => {
    setEditingField(field);
    setFormData(field);
    setShowForm(true);
  };

  const handleDelete = (fieldId: string) => {
    if (confirm('Delete this custom field? All values will be removed.')) {
      deleteMutation.mutate(fieldId);
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
          <CardTitle>Custom Fields</CardTitle>
          <CardDescription>
            Manage custom metadata fields for your {selectedEntity}s
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Entity Type Filter */}
          {!entityType && (
            <div>
              <Label htmlFor="entity-type">Content Type</Label>
              <select
                id="entity-type"
                value={selectedEntity}
                onChange={(e) => {
                  setSelectedEntity(e.target.value);
                  resetForm();
                }}
                className="mt-2 w-full px-3 py-2 border border-outline-variant rounded-lg bg-surface"
              >
                {ENTITY_TYPES.map((et) => (
                  <option key={et.value} value={et.value}>
                    {et.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Form Section */}
          {showForm && (
            <div className="bg-surface-container-low p-4 rounded-lg border border-outline-variant/30 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="field-name">Field Name</Label>
                  <Input
                    id="field-name"
                    value={formData.name || ''}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, name: e.target.value }))
                    }
                    placeholder="e.g., 'Word Count Target', 'Theme'"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="field-type">Field Type</Label>
                  <select
                    id="field-type"
                    value={formData.field_type || 'text'}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, field_type: e.target.value }))
                    }
                    className="mt-1 w-full px-3 py-2 border border-outline-variant rounded-lg bg-surface"
                  >
                    {FIELD_TYPES.map((ft) => (
                      <option key={ft.value} value={ft.value}>
                        {ft.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <Label htmlFor="field-description">Description</Label>
                <textarea
                  id="field-description"
                  value={formData.description || ''}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, description: e.target.value }))
                  }
                  placeholder="Help text for users"
                  className="mt-1 w-full px-3 py-2 border border-outline-variant rounded-lg bg-surface text-sm"
                  rows={2}
                />
              </div>

              {(formData.field_type === 'select' || formData.field_type === 'multiselect') && (
                <div>
                  <Label htmlFor="field-options">Options (comma-separated)</Label>
                  <Input
                    id="field-options"
                    value={(formData.options || []).join(', ')}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        options: e.target.value.split(',').map((s) => s.trim()),
                      }))
                    }
                    placeholder="Option 1, Option 2, Option 3"
                    className="mt-1"
                  />
                </div>
              )}

              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={formData.required || false}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, required: e.target.checked }))
                    }
                    className="w-4 h-4"
                  />
                  Required field
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={formData.is_visible_in_list !== false}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        is_visible_in_list: e.target.checked,
                      }))
                    }
                    className="w-4 h-4"
                  />
                  Show in list view
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={formData.is_filterable !== false}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        is_filterable: e.target.checked,
                      }))
                    }
                    className="w-4 h-4"
                  />
                  Filterable
                </label>
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  onClick={handleSave}
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="gap-2"
                >
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <Spinner className="w-4 h-4" />
                  )}
                  {editingField ? 'Update Field' : 'Create Field'}
                </Button>
                <Button onClick={resetForm} variant="outline">
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Fields List */}
          <div className="space-y-2">
            {!showForm && (
              <Button onClick={() => setShowForm(true)} className="w-full gap-2">
                <Plus className="w-4 h-4" />
                Add Custom Field
              </Button>
            )}

            {fields && fields.length > 0 ? (
              <div className="space-y-2">
                {fields.map((field) => (
                  <div
                    key={field.id}
                    className="flex items-center gap-3 p-3 bg-surface-container-lowest rounded-lg border border-outline-variant/20 group hover:border-outline-variant/40 transition-colors"
                  >
                    <GripVertical className="w-4 h-4 text-on-surface-variant opacity-0 group-hover:opacity-100 transition-opacity cursor-move" />
                    <div className="flex-1">
                      <p className="font-medium text-sm">{field.name}</p>
                      <p className="text-xs text-on-surface-variant">
                        {FIELD_TYPES.find((ft) => ft.value === field.field_type)?.label}
                        {field.required && ' • Required'}
                        {!field.is_visible_in_list && ' • Hidden from lists'}
                      </p>
                      {field.description && (
                        <p className="text-xs text-on-surface-variant mt-1">{field.description}</p>
                      )}
                    </div>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEdit(field)}
                        className="h-8 w-8 p-0"
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(field.id)}
                        disabled={deleteMutation.isPending}
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : !showForm ? (
              <p className="text-sm text-on-surface-variant text-center py-8">
                No custom fields yet. Create one to add metadata to your {selectedEntity}s.
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
