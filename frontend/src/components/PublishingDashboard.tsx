import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

interface PublishingProfile {
  id: string;
  book_id: string;
  isbn?: string;
  publisher_name?: string;
  edition: string;
  status: string;
  distribution_channels: string[];
  ebook_price_cents?: number;
  paperback_price_cents?: number;
}

interface PublishingMetrics {
  total_sales: number;
  total_revenue_cents: number;
  amazon_sales: number;
  average_rating: number;
  review_count: number;
  page_views: number;
}

interface PublishingQueueItem {
  id: string;
  channel: string;
  format_type: string;
  status: string;
  completed_at?: string;
}

export function PublishingDashboard({ bookId }: { bookId: string }) {
  const [profile, setProfile] = useState<PublishingProfile | null>(null);
  const [metrics, setMetrics] = useState<PublishingMetrics | null>(null);
  const [queue, setQueue] = useState<PublishingQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewProfile, setShowNewProfile] = useState(false);
  const [isbn, setIsbn] = useState('');

  useEffect(() => {
    loadData();
  }, [bookId]);

  const loadData = async () => {
    try {
      const [profileRes, metricsRes, queueRes] = await Promise.all([
        api.get(`/publishing/profiles/${bookId}`).catch(() => ({ data: null })),
        api.get(`/publishing/metrics/${bookId}`).catch(() => ({ data: null })),
        api.get(`/publishing/queue/${bookId}`).catch(() => ({ data: [] })),
      ]);
      
      setProfile(profileRes.data);
      setMetrics(metricsRes.data);
      setQueue(queueRes.data || []);
    } catch (error) {
      console.error('Failed to load publishing data:', error);
    } finally {
      setLoading(false);
    }
  };

  const createProfile = async () => {
    try {
      const res = await api.post('/publishing/profiles', {
        book_id: bookId,
        isbn: isbn || undefined,
        publisher_name: 'My Publishing',
      });
      setProfile(res.data);
      setShowNewProfile(false);
      setIsbn('');
    } catch (error) {
      console.error('Failed to create profile:', error);
    }
  };

  const queueForPublishing = async (channel: string, format: string) => {
    try {
      const res = await api.post('/publishing/queue', {
        book_id: bookId,
        channel,
        format_type: format,
      });
      setQueue([...queue, res.data]);
    } catch (error) {
      console.error('Failed to queue:', error);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Publishing Profile */}
      {!profile ? (
        <Card>
          <CardHeader>
            <CardTitle>Publishing Profile</CardTitle>
            <CardDescription>Set up your book for distribution</CardDescription>
          </CardHeader>
          <CardContent>
            {showNewProfile ? (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">ISBN (optional)</label>
                  <Input
                    value={isbn}
                    onChange={(e) => setIsbn(e.target.value)}
                    placeholder="978-1-234567-89-0"
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={createProfile}>Create Profile</Button>
                  <Button variant="outline" onClick={() => setShowNewProfile(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button onClick={() => setShowNewProfile(true)}>
                Create Publishing Profile
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Publishing Profile</CardTitle>
            <Badge>{profile.status}</Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">ISBN</p>
                <p className="font-medium">{profile.isbn || 'Not assigned'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Edition</p>
                <p className="font-medium">{profile.edition}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Publisher</p>
                <p className="font-medium">{profile.publisher_name || '—'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Channels</p>
                <div className="flex gap-1 flex-wrap mt-1">
                  {profile.distribution_channels.map((ch) => (
                    <Badge key={ch} variant="secondary">{ch}</Badge>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Publishing Queue */}
      {profile && (
        <Card>
          <CardHeader>
            <CardTitle>Publish to Platforms</CardTitle>
            <CardDescription>Queue your book for publishing</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                onClick={() => queueForPublishing('amazon_kdp', 'pdf')}
              >
                Amazon KDP (PDF)
              </Button>
              <Button
                variant="outline"
                onClick={() => queueForPublishing('amazon_kdp', 'epub')}
              >
                Amazon KDP (EPUB)
              </Button>
              <Button
                variant="outline"
                onClick={() => queueForPublishing('ingramspark', 'pdf')}
              >
                IngramSpark (PDF)
              </Button>
              <Button
                variant="outline"
                onClick={() => queueForPublishing('draft2digital', 'epub')}
              >
                Draft2Digital (EPUB)
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Publishing Queue Items */}
      {queue.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Publishing Queue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {queue.map((item) => (
                <div
                  key={item.id}
                  className="flex justify-between items-center p-3 bg-gray-50 rounded"
                >
                  <div>
                    <p className="font-medium">{item.channel}</p>
                    <p className="text-sm text-gray-500">{item.format_type}</p>
                  </div>
                  <Badge>{item.status}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Publishing Metrics */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Total Sales</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">
                {metrics.total_sales}
              </div>
              <p className="text-sm text-gray-500 mt-2">
                ${(metrics.total_revenue_cents / 100).toFixed(2)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Page Views</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">
                {metrics.page_views}
              </div>
              <p className="text-sm text-gray-500 mt-2">{metrics.review_count} reviews</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Average Rating</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-yellow-600">
                {(metrics.average_rating / 100).toFixed(1)}
              </div>
              <p className="text-sm text-gray-500 mt-2">out of 5.0</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Amazon Sales</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-600">
                {metrics.amazon_sales}
              </div>
              <p className="text-sm text-gray-500 mt-2">Primary channel</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
