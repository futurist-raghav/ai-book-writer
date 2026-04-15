'use client';

import { useState, useMemo, use } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Trash2,
  Edit,
  Search,
  Plus,
  Upload,
  X,
  FileText,
  Image,
  GitBranch,
  BarChart3,
  Grid3x3,
  Video,
  Zap,
  Star,
  Download,
  Copy,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loading } from '@/components/ui/spinner';
import { apiClient } from '@/lib/api-client';
import { formatDate, truncate } from '@/lib/utils';
import { useParams } from 'next/navigation';
import { use as useClient } from 'react';

interface MediaItem {
  id: string;
  title: string;
  type: 'image' | 'diagram' | 'chart' | 'table' | 'video';
  description?: string;
  url?: string;
  content?: string; // For diagrams, charts, tables (text content)
  thumbnailUrl?: string;
  tags?: string[];
  linkedChapters?: string[];
  is_featured: boolean;
  created_at: string;
  file_size?: number;
}

const MEDIA_TYPES = [
  { value: 'image', label: 'Images', icon: Image, color: 'bg-blue-100 text-blue-700' },
  { value: 'diagram', label: 'Diagrams', icon: GitBranch, color: 'bg-purple-100 text-purple-700' },
  { value: 'chart', label: 'Charts', icon: BarChart3, color: 'bg-orange-100 text-orange-700' },
  { value: 'table', label: 'Tables', icon: Grid3x3, color: 'bg-green-100 text-green-700' },
  { value: 'video', label: 'Videos', icon: Video, color: 'bg-red-100 text-red-700' },
];

export default function MediaPage() {
  const params = useParams();
  const bookId = params.bookId as string;
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingItem, setEditingItem] = useState<MediaItem | null>(null);
  const queryClient = useQueryClient();

  // Mock data - in real implementation, fetch from API
  const mockMediaItems: MediaItem[] = [
    {
      id: '1',
      title: 'Character Relationship Map',
      type: 'diagram',
      description: 'Visual map of character relationships and conflicts',
      content: 'mermaid graph showing character connections',
      is_featured: true,
      created_at: new Date().toISOString(),
      tags: ['characters', 'relationships'],
      linkedChapters: ['Chapter 1', 'Chapter 3'],
    },
    {
      id: '2',
      title: 'Plot Timeline',
      type: 'chart',
      description: 'Timeline of major plot events',
      content: 'Timeline spanning 5 years of story events',
      is_featured: true,
      created_at: new Date(Date.now() - 86400000).toISOString(),
      tags: ['plot', 'timeline'],
      linkedChapters: ['Chapter 5'],
    },
    {
      id: '3',
      title: 'Story Structure Breakdown',
      type: 'table',
      description: 'Three-act structure with key points',
      content: 'Table with acts, scenes, page counts, and story beats',
      is_featured: false,
      created_at: new Date(Date.now() - 172800000).toISOString(),
      tags: ['structure', 'planning'],
      linkedChapters: [],
    },
  ];

  const deleteMutation = useMutation({
    mutationFn: (id: string) => {
      // Mock delete
      return Promise.resolve();
    },
    onSuccess: () => {
      toast.success('Media deleted');
      queryClient.invalidateQueries({ queryKey: ['media', bookId] });
    },
    onError: () => {
      toast.error('Failed to delete media');
    },
  });

  const featureMutation = useMutation({
    mutationFn: ({ id, featured }: { id: string; featured: boolean }) => {
      // Mock update
      return Promise.resolve();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media', bookId] });
    },
  });

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredItems = useMemo(() => {
    return mockMediaItems.filter((item) => {
      // Search filter
      if (normalizedQuery) {
        const searchableText = [item.title, item.description, ...(item.tags || [])]
          .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
          .join(' ')
          .toLowerCase();
        if (!searchableText.includes(normalizedQuery)) {
          return false;
        }
      }

      // Type filter
      if (selectedType && item.type !== selectedType) {
        return false;
      }

      return true;
    });
  }, [mockMediaItems, normalizedQuery, selectedType]);

  const typeStats = useMemo(() => {
    const stats: Record<string, number> = {};
    mockMediaItems.forEach((item) => {
      stats[item.type] = (stats[item.type] || 0) + 1;
    });
    return stats;
  }, [mockMediaItems]);

  return (
    <div className="dashboard-shell space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Media Library</h1>
          <p className="text-muted-foreground">
            Organize images, diagrams, charts, tables, and videos ({filteredItems.length})
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setShowUploadModal(true)}
            className="gap-2"
          >
            <Upload className="h-4 w-4" />
            Upload
          </Button>
          <Button
            onClick={() => setShowCreateModal(true)}
            variant="outline"
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Create
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="space-y-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search media..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Type Filter */}
        <div className="space-y-3">
          <p className="text-sm font-medium text-on-surface/60">Media Type</p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={selectedType === null ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => setSelectedType(null)}
            >
              All ({mockMediaItems.length})
            </Button>
            {MEDIA_TYPES.map((mediaType) => {
              const count = typeStats[mediaType.value] || 0;
              return (
                <Button
                  key={mediaType.value}
                  variant={selectedType === mediaType.value ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedType(mediaType.value)}
                  className="gap-1"
                >
                  <mediaType.icon className="h-3.5 w-3.5" />
                  {mediaType.label} ({count})
                </Button>
              );
            })}
          </div>
        </div>

        {/* View Mode Toggle */}
        <div className="flex gap-2">
          <Button
            variant={viewMode === 'grid' ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setViewMode('grid')}
          >
            Grid
          </Button>
          <Button
            variant={viewMode === 'list' ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setViewMode('list')}
          >
            List
          </Button>
        </div>
      </div>

      {/* Media Display */}
      {filteredItems.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="h-16 w-16 text-muted-foreground/50" />
            <p className="mt-4 text-lg font-medium">No media found</p>
            <p className="text-sm text-muted-foreground mb-4">
              {mockMediaItems.length === 0
                ? 'Upload images or create diagrams to get started'
                : 'Try adjusting your search or filters'}
            </p>
            <div className="flex gap-2">
              <Button onClick={() => setShowUploadModal(true)} size="sm">
                <Upload className="h-4 w-4 mr-2" />
                Upload Media
              </Button>
              <Button onClick={() => setShowCreateModal(true)} variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Create Diagram
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : viewMode === 'grid' ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredItems.map((item) => (
            <MediaGridCard
              key={item.id}
              item={item}
              onDelete={() => deleteMutation.mutate(item.id)}
              onToggleFeature={() =>
                featureMutation.mutate({
                  id: item.id,
                  featured: !item.is_featured,
                })
              }
              onEdit={() => setEditingItem(item)}
              isDeleting={deleteMutation.isPending}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredItems.map((item) => (
            <MediaListItem
              key={item.id}
              item={item}
              onDelete={() => deleteMutation.mutate(item.id)}
              onToggleFeature={() =>
                featureMutation.mutate({
                  id: item.id,
                  featured: !item.is_featured,
                })
              }
              onEdit={() => setEditingItem(item)}
              isDeleting={deleteMutation.isPending}
            />
          ))}
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <MediaUploadModal
          onClose={() => setShowUploadModal(false)}
          onUpload={() => {
            toast.success('Media uploaded');
            setShowUploadModal(false);
            queryClient.invalidateQueries({ queryKey: ['media', bookId] });
          }}
        />
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <MediaCreateModal
          item={editingItem}
          onClose={() => {
            setShowCreateModal(false);
            setEditingItem(null);
          }}
          onCreate={() => {
            toast.success(editingItem ? 'Media updated' : 'Media created');
            setShowCreateModal(false);
            setEditingItem(null);
            queryClient.invalidateQueries({ queryKey: ['media', bookId] });
          }}
        />
      )}
    </div>
  );
}

function MediaGridCard({
  item,
  onDelete,
  onToggleFeature,
  onEdit,
  isDeleting,
}: {
  item: MediaItem;
  onDelete: () => void;
  onToggleFeature: () => void;
  onEdit: () => void;
  isDeleting: boolean;
}) {
  const typeConfig = MEDIA_TYPES.find((t) => t.value === item.type);
  const Icon = typeConfig?.icon || FileText;

  return (
    <Card className="flex flex-col overflow-hidden hover:shadow-lg transition-shadow">
      {/* Thumbnail/Icon Section */}
      <div className={`h-40 ${typeConfig?.color.split(' ')[0]} flex items-center justify-center border-b`}>
        {item.type === 'image' && item.url ? (
          <img
            src={item.url}
            alt={item.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <Icon className="h-12 w-12 opacity-30" />
        )}
      </div>

      <CardHeader className="pb-2 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="line-clamp-2 text-base">{item.title}</CardTitle>
            <p className={`text-xs font-medium mt-1 px-2 py-0.5 rounded-full w-fit ${typeConfig?.color}`}>
              {typeConfig?.label}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 flex-shrink-0"
            onClick={onToggleFeature}
          >
            <Star
              className={`h-4 w-4 ${
                item.is_featured ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'
              }`}
            />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pb-2 space-y-2">
        {item.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>
        )}

        {item.tags && item.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {item.tags.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center text-xs bg-muted px-2 py-0.5 rounded-full"
              >
                {tag}
              </span>
            ))}
            {item.tags.length > 2 && (
              <span className="text-xs text-muted-foreground">+{item.tags.length - 2}</span>
            )}
          </div>
        )}

        {item.linkedChapters && item.linkedChapters.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Linked to {item.linkedChapters.length} chapter{item.linkedChapters.length === 1 ? '' : 's'}
          </p>
        )}

        <p className="text-xs text-muted-foreground">{formatDate(item.created_at)}</p>
      </CardContent>

      <div className="flex gap-1 border-t p-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 flex-1"
          onClick={onEdit}
        >
          <Edit className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 flex-1"
          onClick={onDelete}
          disabled={isDeleting}
        >
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
        </Button>
      </div>
    </Card>
  );
}

function MediaListItem({
  item,
  onDelete,
  onToggleFeature,
  onEdit,
  isDeleting,
}: {
  item: MediaItem;
  onDelete: () => void;
  onToggleFeature: () => void;
  onEdit: () => void;
  isDeleting: boolean;
}) {
  const typeConfig = MEDIA_TYPES.find((t) => t.value === item.type);
  const Icon = typeConfig?.icon || FileText;

  return (
    <div className="flex items-center gap-4 p-4 rounded-lg border hover:bg-muted/50 transition-colors">
      {/* Type Icon */}
      <div className={`h-12 w-12 rounded-lg ${typeConfig?.color} flex items-center justify-center flex-shrink-0`}>
        <Icon className="h-6 w-6" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <h4 className="font-semibold truncate">{item.title}</h4>
        <p className="text-sm text-muted-foreground truncate">
          {item.description || 'No description'}
        </p>
        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
          <span className={`px-2 py-0.5 rounded-full ${typeConfig?.color}`}>
            {typeConfig?.label}
          </span>
          <span>{formatDate(item.created_at)}</span>
          {item.linkedChapters && item.linkedChapters.length > 0 && (
            <span>·Linked to {item.linkedChapters.length} chapter{item.linkedChapters.length === 1 ? '' : 's'}</span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onToggleFeature}
        >
          <Star
            className={`h-4 w-4 ${
              item.is_featured ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'
            }`}
          />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onEdit}
        >
          <Edit className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onDelete}
          disabled={isDeleting}
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    </div>
  );
}

function MediaUploadModal({
  onClose,
  onUpload,
}: {
  onClose: () => void;
  onUpload: () => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Upload Media</CardTitle>
          <CardDescription>
            Upload images, diagrams, charts, tables, or videos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/20'
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const files = e.dataTransfer.files;
              if (files.length > 0) {
                setSelectedFile(files[0]);
              }
            }}
          >
            <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm font-medium mb-1">Drag files here or click to browse</p>
            <p className="text-xs text-muted-foreground">
              Supported: PNG, JPG, SVG, MP4, WebM (up to 100MB)
            </p>
            <input
              type="file"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) {
                  setSelectedFile(e.target.files[0]);
                }
              }}
              accept="image/*,video/*"
              id="file-input"
            />
            <Button
              variant="link"
              className="mt-3"
              onClick={() => document.getElementById('file-input')?.click()}
            >
              Choose File
            </Button>
          </div>

          {selectedFile && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm font-medium">{selectedFile.name}</p>
              <p className="text-xs text-muted-foreground">
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          )}

          <Input placeholder="Title" />
          <Input placeholder="Description" />

          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button onClick={onUpload} className="flex-1">
              Upload
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MediaCreateModal({
  item,
  onClose,
  onCreate,
}: {
  item?: MediaItem | null;
  onClose: () => void;
  onCreate: () => void;
}) {
  const [mediaType, setMediaType] = useState<string>(item?.type || 'diagram');
  const [title, setTitle] = useState(item?.title || '');
  const [description, setDescription] = useState(item?.description || '');
  const [content, setContent] = useState(item?.content || '');

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
      <Card className="w-full max-w-2xl my-8">
        <CardHeader>
          <CardTitle>{item ? 'Edit Media' : 'Create New Media'}</CardTitle>
          <CardDescription>
            {mediaType === 'diagram' && 'Create a flowchart or relationship diagram'}
            {mediaType === 'chart' && 'Create a visual chart or graph'}
            {mediaType === 'table' && 'Create a data table'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Media Type</label>
              <select
                value={mediaType}
                onChange={(e) => setMediaType(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-input"
              >
                <option value="diagram">Diagram</option>
                <option value="chart">Chart</option>
                <option value="table">Table</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Title</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Character Relationship Map"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Description</label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this media"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Content</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={
                mediaType === 'diagram'
                  ? 'Mermaid diagram syntax or description...'
                  : mediaType === 'chart'
                  ? 'Chart description or data...'
                  : 'Table content or description...'
              }
              className="w-full px-3 py-2 rounded-lg border border-input font-mono text-sm min-h-32"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Tags</label>
            <Input placeholder="Comma-separated tags (e.g., characters, plot, timeline)" />
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button onClick={onCreate} className="flex-1">
              {item ? 'Update' : 'Create'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
