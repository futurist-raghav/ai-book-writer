'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Star, Users, BookOpen, Search, MapPin, MessageCircle } from 'lucide-react';

interface Author {
  user_id: string;
  username: string;
  bio?: string;
  genres: string[];
  books_count: number;
  avg_rating: number;
  looking_for_beta_readers: boolean;
  created_at: string;
}

export default function AuthorDirectoryPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState('recent');
  const [lookingForBeta, setLookingForBeta] = useState<boolean | null>(null);

  // Fetch authors
  const { data: authors = [], isLoading } = useQuery({
    queryKey: ['authors-directory', searchQuery, selectedGenres, sortBy, lookingForBeta],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.append('query', searchQuery);
      if (selectedGenres.length > 0) params.append('genres', selectedGenres.join(','));
      params.append('sort_by', sortBy);
      if (lookingForBeta !== null) params.append('looking_for_beta', lookingForBeta.toString());

      const response = await api.get(`/authors?${params.toString()}`);
      return response.data;
    },
  });

  const commonGenres = [
    'Fiction',
    'Science Fiction',
    'Fantasy',
    'Mystery',
    'Romance',
    'Memoir',
    'Non-Fiction',
    'Poetry',
    'Young Adult',
    'Horror',
  ];

  const toggleGenre = (genre: string) => {
    setSelectedGenres(prev =>
      prev.includes(genre) ? prev.filter(g => g !== genre) : [...prev, genre]
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-12">
        <div className="max-w-7xl mx-auto px-4">
          <h1 className="text-4xl font-bold mb-3">Author Community</h1>
          <p className="text-blue-100 text-lg">
            Discover writers, find beta readers, and connect with your creative community
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Search & Filter Section */}
        <Card className="mb-8 border-0 shadow-sm">
          <CardHeader>
            <CardTitle>Discover Authors</CardTitle>
            <CardDescription>Find writers by genre, rating, and availability</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
              <Input
                placeholder="Search authors by name or bio..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Genre Filter */}
            <div>
              <h3 className="text-sm font-semibold mb-3">Filter by Genre</h3>
              <div className="flex flex-wrap gap-2">
                {commonGenres.map(genre => (
                  <Badge
                    key={genre}
                    variant={selectedGenres.includes(genre) ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => toggleGenre(genre)}
                  >
                    {genre}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Sort & Filter Options */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold mb-2 block">Sort By</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full border rounded-md p-2 text-sm"
                >
                  <option value="recent">Recently Joined</option>
                  <option value="popular">Most Popular</option>
                  <option value="rating">Highest Rated</option>
                  <option value="books">Most Published</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-semibold mb-2 block">Beta Reader Status</label>
                <select
                  value={lookingForBeta === null ? '' : lookingForBeta.toString()}
                  onChange={(e) =>
                    setLookingForBeta(e.target.value === '' ? null : e.target.value === 'true')
                  }
                  className="w-full border rounded-md p-2 text-sm"
                >
                  <option value="">All Authors</option>
                  <option value="true">Looking for Beta Readers</option>
                  <option value="false">Not Looking</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Authors Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-80 bg-gray-200 rounded-lg animate-pulse" />
            ))
          ) : authors.length > 0 ? (
            authors.map((author: Author) => (
              <Card key={author.user_id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{author.username}</CardTitle>
                      <CardDescription className="mt-1">{author.bio || 'No bio yet'}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Genres */}
                  {author.genres.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-600 mb-2">Genres</p>
                      <div className="flex flex-wrap gap-1">
                        {author.genres.slice(0, 3).map(genre => (
                          <Badge key={genre} variant="secondary" className="text-xs">
                            {genre}
                          </Badge>
                        ))}
                        {author.genres.length > 3 && (
                          <Badge variant="secondary" className="text-xs">
                            +{author.genres.length - 3}
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-3 py-3 border-y">
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-blue-600" />
                      <div>
                        <p className="text-xs text-gray-600">Books</p>
                        <p className="font-semibold">{author.books_count}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Star className="h-4 w-4 text-yellow-600" />
                      <div>
                        <p className="text-xs text-gray-600">Rating</p>
                        <p className="font-semibold">{author.avg_rating.toFixed(1)}★</p>
                      </div>
                    </div>
                  </div>

                  {/* Beta Reader Status */}
                  {author.looking_for_beta_readers && (
                    <div className="bg-blue-50 p-2 rounded border border-blue-200">
                      <p className="text-xs font-semibold text-blue-700 flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        Seeking Beta Readers
                      </p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      asChild
                      variant="outline"
                      className="flex-1 text-sm"
                    >
                      <a href={`/dashboard/author-profile/${author.user_id}`}>
                        View Profile
                      </a>
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      className="flex-1"
                    >
                      <MessageCircle className="h-4 w-4 mr-1" />
                      Message
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="col-span-full text-center py-12">
              <Users className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-700 mb-2">No Authors Found</h3>
              <p className="text-gray-500">Try adjusting your filters or search query</p>
            </div>
          )}
        </div>

        {/* Stats Footer */}
        <div className="mt-16 bg-gradient-to-r from-slate-50 to-blue-50 rounded-lg border p-8">
          <div className="grid grid-cols-3 gap-6 text-center">
            <div>
              <p className="text-3xl font-bold text-blue-600">{authors.length}+</p>
              <p className="text-sm text-gray-600 mt-1">Active Authors</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-purple-600">5000+</p>
              <p className="text-sm text-gray-600 mt-1">Books Written</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-pink-600">12000+</p>
              <p className="text-sm text-gray-600 mt-1">Readers Connected</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
