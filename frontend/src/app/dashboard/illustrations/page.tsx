'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Spinner } from '@/components/ui/spinner';
import { useBookStore } from '@/stores/book-store';
import { apiClient } from '@/lib/api-client';

interface IllustrationEvent {
  id: string;
  title: string;
  content: string;
  category?: string;
  tags?: string[];
  created_at: string;
}

export default function IllustrationsPage() {
  const queryClient = useQueryClient();
  const { selectedBook } = useBookStore();

  const [title, setTitle] = useState('');
  const [visualBrief, setVisualBrief] = useState('');
  const [style, setStyle] = useState('cinematic realism');
  const [medium, setMedium] = useState('digital painting');
  const [references, setReferences] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['illustrations-events'],
    queryFn: () => apiClient.events.list({ limit: 100, category: 'illustration' }),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      apiClient.events.create({
        title: title.trim(),
        category: 'illustration',
        tags: [
          'illustration',
          style.trim() || 'visual',
          medium.trim() || 'mixed-media',
          selectedBook?.title ? `project:${selectedBook.title}` : 'project:unassigned',
        ],
        content: [
          `Project: ${selectedBook?.title || 'Not selected'}`,
          `Style: ${style || 'Not set'}`,
          `Medium: ${medium || 'Not set'}`,
          '',
          'Visual Brief:',
          visualBrief.trim(),
          '',
          'References:',
          references.trim() || 'None',
        ].join('\n'),
      }),
    onSuccess: () => {
      toast.success('Illustration entry created in Event Spine.');
      setTitle('');
      setVisualBrief('');
      setReferences('');
      queryClient.invalidateQueries({ queryKey: ['illustrations-events'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
    onError: () => {
      toast.error('Failed to create illustration entry.');
    },
  });

  const illustrationEvents: IllustrationEvent[] = data?.data?.items || [];

  return (
    <div className="max-w-6xl mx-auto pt-8 pb-24 space-y-8">
      <div>
        <p className="font-label text-xs uppercase tracking-[0.2em] text-secondary mb-3">Visual Development</p>
        <h1 className="text-5xl md:text-6xl font-light tracking-tighter text-primary font-body">Illustrations</h1>
        <p className="font-label text-sm text-on-surface-variant mt-4 max-w-3xl">
          For visual-heavy genres and books, collect illustration concepts here. Each concept is saved into Event Spine so it can influence chapter context and drafting.
        </p>
      </div>

      <section className="bg-surface-container-lowest rounded-xl border border-outline-variant/10 p-6 space-y-4">
        <h2 className="font-label text-sm font-bold text-primary uppercase tracking-widest">Add Illustration Concept</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Concept title"
            className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <input
            value={style}
            onChange={(event) => setStyle(event.target.value)}
            placeholder="Visual style (e.g. watercolor, manga, realism)"
            className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <input
            value={medium}
            onChange={(event) => setMedium(event.target.value)}
            placeholder="Medium (digital, ink, pencil, 3D...)"
            className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <input
            value={references}
            onChange={(event) => setReferences(event.target.value)}
            placeholder="Reference artists, eras, moods"
            className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>

        <textarea
          value={visualBrief}
          onChange={(event) => setVisualBrief(event.target.value)}
          placeholder="Describe what should be illustrated, composition, mood, symbols, and scene details..."
          rows={8}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />

        <button
          type="button"
          disabled={createMutation.isPending || !title.trim() || !visualBrief.trim()}
          onClick={() => createMutation.mutate()}
          className="px-4 py-2 rounded-lg bg-primary text-white text-xs font-bold hover:opacity-90 disabled:opacity-50"
        >
          {createMutation.isPending ? <Spinner className="w-3 h-3 mr-1 inline-block" /> : null}
          Save To Event Spine
        </button>
      </section>

      <section className="bg-surface-container-lowest rounded-xl border border-outline-variant/10 p-6 space-y-4">
        <h2 className="font-label text-sm font-bold text-primary uppercase tracking-widest">Illustration Backlog</h2>

        {isLoading ? (
          <div className="py-10 flex justify-center"><Spinner className="w-6 h-6 text-primary" /></div>
        ) : illustrationEvents.length === 0 ? (
          <p className="text-sm text-on-surface-variant">No illustration concepts yet.</p>
        ) : (
          <div className="space-y-3">
            {illustrationEvents.map((item) => (
              <article key={item.id} className="rounded-lg border border-outline-variant/10 p-4 bg-white">
                <h3 className="font-label text-sm font-bold text-primary">{item.title}</h3>
                <p className="text-xs text-on-surface-variant mt-2 whitespace-pre-wrap line-clamp-5">{item.content}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
