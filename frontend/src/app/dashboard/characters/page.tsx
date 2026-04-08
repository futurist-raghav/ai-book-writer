'use client';

import Link from 'next/link';
import { useState, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import { Spinner } from '@/components/ui/spinner';
import { useBookStore } from '@/stores/book-store';

interface CharacterProfile {
  id: string;
  name: string;
  aliases?: string[];
  role?: string;
  age?: string;
  description?: string;
  traits?: string[];
  backstory?: string;
  motivations?: string[];
  relationships?: Array<{ characterId: string; type: string; description?: string }>;
  firstMention?: { chapterId: string; chapterTitle: string };
}

interface EventPerson {
  name?: string;
  relationship?: string;
  description?: string;
}

interface CharacterEvent {
  id: string;
  title?: string;
  summary?: string;
  content?: string;
  created_at?: string;
  people?: Array<string | EventPerson>;
}

function extractPersonName(person: string | EventPerson): string | null {
  if (typeof person === 'string') {
    const normalized = person.trim();
    return normalized.length > 0 ? normalized : null;
  }

  const normalized = person?.name?.trim();
  return normalized ? normalized : null;
}

export default function CharactersPage() {
  const queryClient = useQueryClient();
  const { selectedBook } = useBookStore();
  
  const [activeTab, setActiveTab] = useState<'discovered' | 'profiles'>('profiles');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<CharacterProfile>({
    id: '',
    name: '',
    aliases: [],
    role: '',
    age: '',
    description: '',
    traits: [],
    backstory: '',
    motivations: [],
    relationships: [],
  });

  // Fetch book details for character profiles
  const { data: bookData, isLoading: bookLoading } = useQuery({
    queryKey: ['book', selectedBook?.id],
    queryFn: () => selectedBook?.id ? apiClient.books.get(selectedBook.id) : null,
    enabled: !!selectedBook?.id,
  });

  // Fetch events for discovered characters
  const { data: eventsData, isLoading: eventsLoading } = useQuery({
    queryKey: ['events', 'characters'],
    queryFn: async () => {
      const listResponse = await apiClient.events.list({ limit: 100 });
      const events = listResponse.data.items || [];
      const details = await Promise.allSettled(events.map((event: any) => apiClient.events.get(event.id)));
      return details
        .filter((result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled')
        .map((result) => result.value.data);
    },
  });

  const characterProfiles: CharacterProfile[] = useMemo(() => {
    try {
      const settings = bookData?.data?.project_settings || {};
      const stored = settings.characters as CharacterProfile[] | undefined;
      return Array.isArray(stored) ? stored : [];
    } catch {
      return [];
    }
  }, [bookData]);

  const saveCharacterProfiles = useMutation({
    mutationFn: (profiles: CharacterProfile[]) => 
      selectedBook?.id 
        ? apiClient.books.update(selectedBook.id, {
            project_settings: {
              ...(bookData?.data?.project_settings || {}),
              characters: profiles,
            },
          })
        : Promise.reject('No book selected'),
    onSuccess: () => {
      toast.success('Character profiles saved.');
      queryClient.invalidateQueries({ queryKey: ['book', selectedBook?.id] });
      setShowForm(false);
      setEditingId(null);
      setFormData({ id: '', name: '', aliases: [], role: '', age: '', description: '', traits: [], backstory: '', motivations: [], relationships: [] });
    },
    onError: () => {
      toast.error('Failed to save character profiles.');
    },
  });

  const handleSaveCharacter = async () => {
    if (!formData.name.trim()) {
      toast.error('Character name is required.');
      return;
    }

    const newProfiles = editingId
      ? characterProfiles.map((p) => (p.id === editingId ? { ...formData, id: editingId } : p))
      : [...characterProfiles, { ...formData, id: Date.now().toString() }];

    await saveCharacterProfiles.mutateAsync(newProfiles);
  };

  const handleDeleteCharacter = async (id: string) => {
    const newProfiles = characterProfiles.filter((p) => p.id !== id);
    await saveCharacterProfiles.mutateAsync(newProfiles);
  };

  const handleEditCharacter = (profile: CharacterProfile) => {
    setFormData(profile);
    setEditingId(profile.id);
    setShowForm(true);
  };

  // Extract characters from events
  const events = (eventsData || []) as CharacterEvent[];
  const peopleMap = events.reduce((acc, event) => {
    const people = Array.isArray(event.people) ? event.people : [];
    people.forEach((person) => {
      const name = extractPersonName(person);
      if (name) {
        acc[name] = (acc[name] || 0) + 1;
      }
    });
    return acc;
  }, {} as Record<string, number>);

  const discoveredCharacters = Object.entries(peopleMap)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));

  const isLoading = bookLoading || eventsLoading;

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center"><Spinner className="w-8 h-8 text-primary" /></div>;
  }

  return (
    <div className="max-w-6xl mx-auto pt-8 pb-24">
      <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-5xl md:text-6xl font-light tracking-tighter text-primary font-body mb-2">Characters</h2>
          <p className="font-label text-sm text-on-surface-variant">Manage character profiles and discover people from events.</p>
        </div>
        <button
          onClick={() => {
            setShowForm(true);
            setEditingId(null);
            setFormData({ id: '', name: '', aliases: [], role: '', age: '', description: '', traits: [], backstory: '', motivations: [], relationships: [] });
          }}
          className="w-fit rounded-lg bg-gradient-to-r from-primary to-primary-container text-white px-6 py-3 font-label text-xs font-bold uppercase tracking-wider shadow-md hover:opacity-90 transition-all active:scale-95"
        >
          <span className="material-symbols-outlined inline mr-2">add</span>
          New Character
        </button>
      </div>

      {/* Tabs */}
      <div className="mb-8 flex gap-2 border-b border-outline-variant/20">
        <button
          onClick={() => setActiveTab('profiles')}
          className={`px-4 py-3 font-label text-xs font-bold uppercase tracking-wider transition-colors border-b-2 ${
            activeTab === 'profiles'
              ? 'border-primary text-primary'
              : 'border-transparent text-on-surface-variant hover:text-primary'
          }`}
        >
          Character Profiles ({characterProfiles.length})
        </button>
        <button
          onClick={() => setActiveTab('discovered')}
          className={`px-4 py-3 font-label text-xs font-bold uppercase tracking-wider transition-colors border-b-2 ${
            activeTab === 'discovered'
              ? 'border-primary text-primary'
              : 'border-transparent text-on-surface-variant hover:text-primary'
          }`}
        >
          Discovered ({discoveredCharacters.length})
        </button>
      </div>

      {/* Character Form Modal */}
      {showForm && (
        <div className="mb-8 bg-surface-container-lowest p-8 rounded-xl border border-outline-variant/10 space-y-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-label text-sm font-bold text-primary uppercase tracking-widest">
              {editingId ? 'Edit Character' : 'Create Character Profile'}
            </h3>
            <button
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
              }}
              className="text-on-surface-variant hover:text-primary transition-colors"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="block font-label text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-2">
                Character Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Inspector Mira Sol"
                className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-3 text-sm font-body focus:border-secondary focus:ring-secondary/20 transition-colors"
              />
            </div>

            <div>
              <label className="block font-label text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-2">
                Role
              </label>
              <input
                type="text"
                value={formData.role || ''}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                placeholder="e.g., Detective, Mentor"
                className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-3 text-sm font-body focus:border-secondary focus:ring-secondary/20 transition-colors"
              />
            </div>

            <div>
              <label className="block font-label text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-2">
                Age
              </label>
              <input
                type="text"
                value={formData.age || ''}
                onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                placeholder="e.g., 32, Early 40s"
                className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-3 text-sm font-body focus:border-secondary focus:ring-secondary/20 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block font-label text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-2">
              Description
            </label>
            <textarea
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Physical appearance and general impression..."
              rows={3}
              className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-3 text-sm font-body focus:border-secondary focus:ring-secondary/20 transition-colors"
            />
          </div>

          <div>
            <label className="block font-label text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-2">
              Backstory
            </label>
            <textarea
              value={formData.backstory || ''}
              onChange={(e) => setFormData({ ...formData, backstory: e.target.value })}
              placeholder="Character's background and history..."
              rows={4}
              className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-3 text-sm font-body focus:border-secondary focus:ring-secondary/20 transition-colors"
            />
          </div>

          <div>
            <label className="block font-label text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-2">
              Personality Traits (comma-separated)
            </label>
            <textarea
              value={(formData.traits || []).join(', ')}
              onChange={(e) => setFormData({ ...formData, traits: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })}
              placeholder="e.g., intelligent, cautious, witty, determined"
              rows={2}
              className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-3 text-sm font-body focus:border-secondary focus:ring-secondary/20 transition-colors"
            />
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t border-outline-variant/10">
            <button
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
              }}
              className="px-4 py-2 rounded-lg border border-outline-variant/20 text-primary font-label text-xs font-bold uppercase tracking-wider hover:bg-surface-container-high transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveCharacter}
              disabled={saveCharacterProfiles.isPending || !formData.name.trim()}
              className="px-6 py-2 rounded-lg bg-primary text-white font-label text-xs font-bold uppercase tracking-wider hover:opacity-90 disabled:opacity-50 transition-all"
            >
              {saveCharacterProfiles.isPending ? <Spinner className="w-3 h-3 mr-2 inline-block" /> : null}
              {editingId ? 'Update' : 'Create'} Character
            </button>
          </div>
        </div>
      )}

      {/* Profiles Tab */}
      {activeTab === 'profiles' && (
        <div>
          {characterProfiles.length === 0 ? (
            <div className="border-2 border-dashed border-outline-variant/30 rounded-2xl p-12 flex flex-col items-center justify-center">
              <span className="material-symbols-outlined text-4xl text-on-surface-variant mb-4">person</span>
              <h3 className="font-label text-sm font-bold text-primary uppercase tracking-widest mb-2">No character profiles yet</h3>
              <p className="font-label text-xs text-on-surface-variant max-w-sm text-center mb-6">Create detailed character profiles to track personalities, backgrounds, and relationships.</p>
              <button
                onClick={() => setShowForm(true)}
                className="px-6 py-3 rounded-lg bg-primary text-white font-label text-xs font-bold uppercase tracking-wider hover:opacity-90 transition-all"
              >
                Create First Character
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {characterProfiles.map((character) => (
                <div key={character.id} className="bg-white rounded-xl border border-outline-variant/10 overflow-hidden hover:shadow-lg transition-all hover:border-secondary/30">
                  {/* Header */}
                  <div className="bg-gradient-to-r from-secondary/10 to-secondary/5 p-6 border-b border-outline-variant/10">
                    <h3 className="text-xl font-body italic text-primary mb-2">{character.name}</h3>
                    {character.role && (
                      <p className="text-sm text-secondary font-label font-bold uppercase tracking-tight">{character.role}</p>
                    )}
                    {character.age && (
                      <p className="text-xs text-on-surface-variant font-label mt-1">Age: {character.age}</p>
                    )}
                  </div>

                  {/* Content */}
                  <div className="p-6 space-y-4">
                    {character.description && (
                      <div>
                        <p className="font-label text-[10px] font-bold uppercase tracking-wide text-on-surface-variant mb-2">Description</p>
                        <p className="text-sm text-on-surface-variant leading-relaxed line-clamp-3">{character.description}</p>
                      </div>
                    )}

                    {(character.traits || []).length > 0 && (
                      <div>
                        <p className="font-label text-[10px] font-bold uppercase tracking-wide text-on-surface-variant mb-2">Traits</p>
                        <div className="flex flex-wrap gap-2">
                          {character.traits?.map((trait) => (
                            <span key={trait} className="px-2.5 py-1 rounded-full bg-secondary-container/30 text-secondary text-[9px] font-bold uppercase tracking-tighter">
                              {trait}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {character.backstory && (
                      <div>
                        <p className="font-label text-[10px] font-bold uppercase tracking-wide text-on-surface-variant mb-2">Backstory</p>
                        <p className="text-sm text-on-surface-variant leading-relaxed line-clamp-2">{character.backstory}</p>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="bg-surface-container-lowest p-4 border-t border-outline-variant/10 flex gap-2">
                    <button
                      onClick={() => handleEditCharacter(character)}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-primary/10 text-primary hover:bg-primary hover:text-white font-label text-[10px] font-bold uppercase tracking-tight transition-all"
                    >
                      <span className="material-symbols-outlined text-sm">edit</span>
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteCharacter(character.id)}
                      className="w-10 h-10 flex items-center justify-center rounded-lg bg-error/10 text-error hover:bg-error hover:text-white transition-all"
                    >
                      <span className="material-symbols-outlined text-sm">delete</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Discovered Tab */}
      {activeTab === 'discovered' && (
        <div className="bg-surface-container-lowest p-8 rounded-xl border border-outline-variant/10">
          {discoveredCharacters.length === 0 ? (
            <p className="font-label text-sm text-on-surface-variant text-center py-8">No characters detected in events. Create events with people metadata to auto-discover characters.</p>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-3">
                {discoveredCharacters.map((person) => (
                  <div key={person.name} className="px-4 py-2 rounded-lg bg-secondary-container/20 border border-secondary/30 hover:bg-secondary-container/40 transition-all cursor-pointer group">
                    <p className="font-label text-xs font-bold text-secondary uppercase tracking-tight">{person.name}</p>
                    <p className="text-[10px] text-on-surface-variant">{person.count} mention{person.count !== 1 ? 's' : ''}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6 p-4 bg-white rounded-lg border border-outline-variant/10">
                <p className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-3">Tip: Import to Profiles</p>
                <p className="text-xs text-on-surface-variant leading-relaxed">Click "New Character" and select a discovered character to create a detailed profile with role, traits, and backstory.</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
