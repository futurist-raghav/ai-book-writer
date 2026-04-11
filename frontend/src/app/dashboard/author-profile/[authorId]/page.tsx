'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Globe, 
  Mail, 
  Star, 
  BookOpen, 
  Users, 
  Twitter, 
  Instagram, 
  MessageCircle,
  ArrowLeft
} from 'lucide-react';
import Link from 'next/link';

interface AuthorProfile {
  user_id: string;
  username: string;
  email: string;
  bio?: string;
  genres: string[];
  writing_style?: string;
  looking_for_beta_readers: boolean;
  looking_to_beta_read: boolean;
  social_links: Record<string, string>;
  books_count: number;
  total_readers: number;
  avg_rating: number;
  beta_reader_requests: number;
  created_at: string;
  updated_at: string;
}

interface Book {
  id: string;
  title: string;
  cover_url?: string;
  average_rating: number;
  reader_count: number;
  status: string;
}

const SocialIcon = ({ platform }: { platform: string }) => {
  switch (platform.toLowerCase()) {
    case 'twitter':
      return <Twitter className="h-5 w-5" />;
    case 'instagram':
      return <Instagram className="h-5 w-5" />;
    case 'website':
      return <Globe className="h-5 w-5" />;
    default:
      return <Globe className="h-5 w-5" />;
  }
};

export default function AuthorProfilePage() {
  const params = useParams();
  const authorId = params.authorId as string;
  const [messageOpen, setMessageOpen] = useState(false);

  const { data: profile, isLoading } = useQuery({
    queryKey: ['author-profile', authorId],
    queryFn: async () => {
      const response = await api.get(`/authors/${authorId}`);
      return response.data as AuthorProfile;
    },
  });

  // Placeholder for fetching author's books
  const mockBooks: Book[] = [
    {
      id: '1',
      title: 'The Last Horizon',
      average_rating: 4.5,
      reader_count: 2341,
      status: 'published',
    },
    {
      id: '2',
      title: 'Midnight in Paris',
      average_rating: 4.2,
      reader_count: 1892,
      status: 'published',
    },
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-4xl mx-auto px-4 py-12">
          <div className="h-96 bg-gray-200 rounded-lg animate-pulse" />
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-4xl mx-auto px-4 py-12">
          <Link href="/dashboard/author-directory" className="flex items-center gap-2 text-blue-600 mb-8">
            <ArrowLeft className="h-5 w-5" />
            Back to Directory
          </Link>
          <Card>
            <CardContent className="py-12 text-center">
              <h2 className="text-2xl font-bold text-gray-700">Author Not Found</h2>
              <p className="text-gray-500 mt-2">This author profile is no longer available.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <Link href="/dashboard/author-directory" className="flex items-center gap-2 text-blue-100 mb-6">
            <ArrowLeft className="h-5 w-5" />
            Back to Directory
          </Link>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h1 className="text-4xl font-bold mb-2">{profile.username}</h1>
              <p className="text-blue-100 text-lg">{profile.bio || 'No bio yet'}</p>
            </div>
            <Button size="lg" className="bg-white text-blue-600 hover:bg-gray-100">
              <MessageCircle className="h-5 w-5 mr-2" />
              Send Message
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Main Grid */}
        <div className="grid grid-cols-3 gap-8 mb-8">
          {/* Left Column - Stats & Links */}
          <div className="space-y-6">
            {/* Key Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quick Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">Published Books</span>
                  <span className="text-2xl font-bold text-blue-600">{profile.books_count}</span>
                </div>
                <div className="flex items-center justify-between border-t pt-4">
                  <span className="text-sm font-medium text-gray-600">Avg Rating</span>
                  <div className="flex items-center gap-1">
                    <span className="text-2xl font-bold text-yellow-600">
                      {profile.avg_rating.toFixed(1)}
                    </span>
                    <Star className="h-5 w-5 text-yellow-600" />
                  </div>
                </div>
                <div className="flex items-center justify-between border-t pt-4">
                  <span className="text-sm font-medium text-gray-600">Total Readers</span>
                  <span className="text-2xl font-bold text-purple-600">{profile.total_readers}</span>
                </div>
              </CardContent>
            </Card>

            {/* Beta Reader Status */}
            {(profile.looking_for_beta_readers || profile.looking_to_beta_read) && (
              <Card className="bg-blue-50 border-blue-200">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="h-5 w-5 text-blue-600" />
                    Beta Reader
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {profile.looking_for_beta_readers && (
                    <p className="text-blue-700">
                      ✓ Looking for beta readers
                    </p>
                  )}
                  {profile.looking_to_beta_read && (
                    <p className="text-blue-700">
                      ✓ Available to beta read
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Social Links */}
            {Object.keys(profile.social_links).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Follow</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {Object.entries(profile.social_links).map(([platform, url]) => (
                    <a
                      key={platform}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-2 rounded hover:bg-gray-100 transition"
                    >
                      <SocialIcon platform={platform} />
                      <span className="text-sm capitalize">{platform}</span>
                    </a>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column - Details & Books */}
          <div className="col-span-2 space-y-6">
            {/* Writing Style */}
            {profile.writing_style && (
              <Card>
                <CardHeader>
                  <CardTitle>Writing Style</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-700">{profile.writing_style}</p>
                </CardContent>
              </Card>
            )}

            {/* Genres */}
            {profile.genres.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Genres</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {profile.genres.map(genre => (
                      <Badge key={genre} variant="secondary">
                        {genre}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Published Works */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  Published Works
                </CardTitle>
              </CardHeader>
              <CardContent>
                {mockBooks.length > 0 ? (
                  <div className="space-y-4">
                    {mockBooks.map(book => (
                      <div
                        key={book.id}
                        className="p-4 border rounded-lg hover:bg-gray-50 cursor-pointer transition"
                      >
                        <h4 className="font-semibold text-gray-900">{book.title}</h4>
                        <div className="flex items-center justify-between mt-2 text-sm text-gray-600">
                          <div className="flex items-center gap-4">
                            <span className="flex items-center gap-1">
                              <Star className="h-4 w-4 text-yellow-600" />
                              {book.average_rating.toFixed(1)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Users className="h-4 w-4 text-blue-600" />
                              {book.reader_count} readers
                            </span>
                          </div>
                          <Badge variant="outline">{book.status}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-4">No published books yet</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Contact Card */}
        <Card className="bg-gradient-to-r from-blue-50 to-purple-50">
          <CardContent className="py-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Interested in Collaboration?</h3>
                <p className="text-sm text-gray-600">
                  Send {profile.username} a message to discuss beta reading, writing partnerships, or feedback.
                </p>
              </div>
              <Button size="lg" className="ml-4">
                <Mail className="h-5 w-5 mr-2" />
                Send Message
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
