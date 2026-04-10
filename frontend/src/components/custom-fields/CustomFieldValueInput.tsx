'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { apiClient } from '@/lib/api-client';

interface CustomField {
  id: string;
  name: string;
  field_type: string;
  required: boolean;
  default_value?: any;
  options?: string[];
  description?: string;
}

interface Props {
  bookId: string;
  entityType: string;
  entityId: string;
  field: CustomField;
  onChange?: (value: any) => void;
  disabled?: boolean;
}

export function CustomFieldValueInput({
  bookId,
  entityType,
  entityId,
  field,
  onChange,
  disabled = false,
}: Props) {
  const queryClient = useQueryClient();

  // Fetch current value
  const { data: fieldValues } = useQuery({
    queryKey: ['custom-field-values', entityId, field.id],
    queryFn: async () => {
      const response = await apiClient.customFields.getEntityValues(bookId, entityType, entityId);
      return response.data as Record<string, { field_id: string; value: any; field_type: string }>;
    },
    enabled: !!entityId,
  });

  // Set value mutation
  const setValueMutation = useMutation({
    mutationFn: (value: any) =>
      apiClient.customFields.setValue(bookId, entityType, entityId, field.id, value),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['custom-field-values', entityId],
      });
      if (onChange) {
        onChange(fieldValues?.[field.name]?.value ?? null);
      }
      toast.success('Field saved');
    },
    onError: () => {
      toast.error('Failed to save field value');
    },
  });

  const currentValue = fieldValues?.[field.name]?.value ?? field.default_value;

  const handleChange = (newValue: any) => {
    setValueMutation.mutate(newValue);
  };

  const baseClasses = 'w-full px-3 py-2 border border-outline-variant rounded-lg bg-surface';

  switch (field.field_type) {
    case 'text':
      return (
        <div>
          <Label htmlFor={`field-${field.id}`}>{field.name}</Label>
          {field.description && (
            <p className="text-xs text-on-surface-variant mt-0.5">{field.description}</p>
          )}
          <Input
            id={`field-${field.id}`}
            type="text"
            value={currentValue || ''}
            onChange={(e) => handleChange(e.target.value || null)}
            placeholder={field.name}
            disabled={disabled || setValueMutation.isPending}
            className="mt-1"
            required={field.required}
          />
        </div>
      );

    case 'number':
      return (
        <div>
          <Label htmlFor={`field-${field.id}`}>{field.name}</Label>
          {field.description && (
            <p className="text-xs text-on-surface-variant mt-0.5">{field.description}</p>
          )}
          <Input
            id={`field-${field.id}`}
            type="number"
            value={currentValue === null || currentValue === undefined ? '' : currentValue}
            onChange={(e) =>
              handleChange(e.target.value ? parseFloat(e.target.value) : null)
            }
            placeholder={field.name}
            disabled={disabled || setValueMutation.isPending}
            className="mt-1"
            required={field.required}
          />
        </div>
      );

    case 'date':
      return (
        <div>
          <Label htmlFor={`field-${field.id}`}>{field.name}</Label>
          {field.description && (
            <p className="text-xs text-on-surface-variant mt-0.5">{field.description}</p>
          )}
          <Input
            id={`field-${field.id}`}
            type="date"
            value={currentValue || ''}
            onChange={(e) => handleChange(e.target.value || null)}
            disabled={disabled || setValueMutation.isPending}
            className="mt-1"
            required={field.required}
          />
        </div>
      );

    case 'select':
      return (
        <div>
          <Label htmlFor={`field-${field.id}`}>{field.name}</Label>
          {field.description && (
            <p className="text-xs text-on-surface-variant mt-0.5">{field.description}</p>
          )}
          <select
            id={`field-${field.id}`}
            value={currentValue || ''}
            onChange={(e) => handleChange(e.target.value || null)}
            disabled={disabled || setValueMutation.isPending}
            className={`mt-1 ${baseClasses}`}
            required={field.required}
          >
            <option value="">Select {field.name}</option>
            {field.options?.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      );

    case 'multiselect':
      return (
        <div>
          <Label htmlFor={`field-${field.id}`}>{field.name}</Label>
          {field.description && (
            <p className="text-xs text-on-surface-variant mt-0.5">{field.description}</p>
          )}
          <select
            id={`field-${field.id}`}
            multiple
            value={Array.isArray(currentValue) ? currentValue : currentValue ? [currentValue] : []}
            onChange={(e) => {
              const selected = Array.from(e.target.selectedOptions, (option) => option.value);
              handleChange(selected.length > 0 ? selected : null);
            }}
            disabled={disabled || setValueMutation.isPending}
            className={`mt-1 ${baseClasses}`}
            required={field.required && (!currentValue || currentValue.length === 0)}
          >
            {field.options?.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      );

    case 'checkbox':
      return (
        <div>
          <label className="flex items-center gap-2 mt-2">
            <input
              id={`field-${field.id}`}
              type="checkbox"
              checked={currentValue === true}
              onChange={(e) => handleChange(e.target.checked)}
              disabled={disabled || setValueMutation.isPending}
              className="w-4 h-4"
            />
            <span className="text-sm">
              {field.name}
              {field.required && ' *'}
            </span>
          </label>
          {field.description && (
            <p className="text-xs text-on-surface-variant mt-1">{field.description}</p>
          )}
        </div>
      );

    case 'rich_text':
      return (
        <div>
          <Label htmlFor={`field-${field.id}`}>{field.name}</Label>
          {field.description && (
            <p className="text-xs text-on-surface-variant mt-0.5">{field.description}</p>
          )}
          <textarea
            id={`field-${field.id}`}
            value={currentValue || ''}
            onChange={(e) => handleChange(e.target.value || null)}
            placeholder={field.name}
            disabled={disabled || setValueMutation.isPending}
            className={`mt-1 ${baseClasses} min-h-[100px]`}
            required={field.required}
          />
        </div>
      );

    default:
      return null;
  }
}
