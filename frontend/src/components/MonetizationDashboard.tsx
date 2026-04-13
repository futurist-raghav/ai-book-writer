/*
MonetizationDashboard - Subscription, Royalties, and Earnings Management
*/
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { formatDate } from '@/lib/utils';

interface Subscription {
  tier: string;
  status: string;
  billing_cycle: string;
  monthly_price_cents?: number;
  books_limit: number;
  collaborators_limit: number;
  storage_gb: number;
  next_billing_date?: string;
}

interface Royalty {
  id: string;
  book_id: string;
  total_sales: number;
  total_earnings_cents: number;
  next_payout_at?: string;
}

interface AffiliateLink {
  id: string;
  code: string;
  clicks: number;
  conversions: number;
  conversion_rate: number;
  revenue_cents: number;
  commission_earned_cents: number;
}

interface DashboardMetrics {
  subscription_tier: string;
  monthly_revenue: number;
  total_earnings: number;
  active_affiliate_links: number;
  patron_count: number;
  course_enrollments: number;
  books_published: number;
  beta_readers_engaged: number;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value);
}

export const MonetizationDashboard: React.FC = () => {
  // Fetch subscription
  const { data: subscription } = useQuery<Subscription>({
    queryKey: ['subscription'],
    queryFn: async () => {
      const response = await api.get('/monetization/subscription');
      return response.data as Subscription;
    },
  });

  // Fetch royalties
  const { data: royalties } = useQuery<Royalty[]>({
    queryKey: ['royalties'],
    queryFn: async () => {
      const response = await api.get('/monetization/royalties');
      return response.data as Royalty[];
    },
  });

  // Fetch dashboard metrics
  const { data: metrics } = useQuery<DashboardMetrics>({
    queryKey: ['monetization-metrics'],
    queryFn: async () => {
      const response = await api.get('/monetization/dashboard');
      return response.data as DashboardMetrics;
    },
  });

  const handleUpgrade = async (tier: string) => {
    try {
      const response = await api.post('/monetization/subscription/upgrade', {
        tier,
        billing_cycle: 'monthly',
        auto_renew: true,
      });
      // Refresh subscription data
      window.location.reload();
    } catch (error) {
      console.error('Upgrade failed:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Subscription Status */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Current Plan</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">{subscription?.tier || 'Free'}</div>
            <p className="text-xs text-gray-500 mt-1">{subscription?.status}</p>
          </CardContent>
        </Card>

        {/* Monthly Revenue */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Monthly Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(metrics?.monthly_revenue || 0)}</div>
            <p className="text-xs text-gray-500 mt-1">From all sources</p>
          </CardContent>
        </Card>

        {/* Total Earnings */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Total Earnings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(metrics?.total_earnings || 0)}</div>
            <p className="text-xs text-gray-500 mt-1">Lifetime earnings</p>
          </CardContent>
        </Card>

        {/* Active Streams */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Active Streams</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(metrics?.active_affiliate_links || 0) + (metrics?.patron_count || 0)}</div>
            <p className="text-xs text-gray-500 mt-1">Affiliate + Patron</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="subscription" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="subscription">Subscription</TabsTrigger>
          <TabsTrigger value="royalties">Royalties</TabsTrigger>
          <TabsTrigger value="courses">Courses</TabsTrigger>
          <TabsTrigger value="affiliates">Affiliates</TabsTrigger>
        </TabsList>

        {/* Subscription Tab */}
        <TabsContent value="subscription" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Upgrade Your Plan</CardTitle>
              <CardDescription>Choose the plan that fits your needs</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                  { tier: 'free', price: 0, books: 3, collaborators: 1, storage: 5, beta: 0 },
                  { tier: 'pro', price: 9, books: 25, collaborators: 5, storage: 100, beta: 10 },
                  { tier: 'studio', price: 29, books: 100, collaborators: 20, storage: 500, beta: 50 },
                  { tier: 'publisher', price: 99, books: 500, collaborators: 100, storage: 2000, beta: 200 },
                ].map((plan) => (
                  <Card key={plan.tier} className={subscription?.tier === plan.tier ? 'border-blue-500 border-2' : ''}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg capitalize">{plan.tier}</CardTitle>
                      <div className="text-2xl font-bold mt-2">${plan.price}/mo</div>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div>📚 {plan.books} books</div>
                      <div>👥 {plan.collaborators} collaborators</div>
                      <div>💾 {plan.storage} GB storage</div>
                      <div>👁️ {plan.beta} beta readers</div>
                      <Button
                        className="w-full mt-4"
                        variant={subscription?.tier === plan.tier ? 'secondary' : 'default'}
                        onClick={() => handleUpgrade(plan.tier)}
                        disabled={subscription?.tier === plan.tier}
                      >
                        {subscription?.tier === plan.tier ? 'Current Plan' : 'Upgrade'}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {subscription?.next_billing_date && (
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm">Next billing date: {formatDate(subscription.next_billing_date)}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Royalties Tab */}
        <TabsContent value="royalties" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Book Royalties</CardTitle>
              <CardDescription>Sales and earnings by book</CardDescription>
            </CardHeader>
            <CardContent>
              {royalties && royalties.length > 0 ? (
                <div className="space-y-4">
                  {royalties.map((royalty) => (
                    <div key={royalty.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">Book {royalty.book_id.slice(0, 8)}</p>
                        <p className="text-sm text-gray-500">{royalty.total_sales} sales</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{formatCurrency(royalty.total_earnings_cents / 100)}</p>
                        {royalty.next_payout_at && (
                          <p className="text-xs text-gray-500">Payout: {formatDate(royalty.next_payout_at)}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-6">No royalties yet</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Courses Tab */}
        <TabsContent value="courses" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Courses & Teaching</CardTitle>
              <CardDescription>{metrics?.course_enrollments || 0} total enrollments</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <p className="text-gray-500 mb-4">No courses yet</p>
                <Button>Create Course</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Affiliates Tab */}
        <TabsContent value="affiliates" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Affiliate Links</CardTitle>
              <CardDescription>{metrics?.active_affiliate_links || 0} active links</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <p className="text-gray-500 mb-4">No affiliate links yet</p>
                <Button>Create Affiliate Link</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Patron Section */}
      {metrics?.patron_count && metrics.patron_count > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Patron Support</CardTitle>
            <CardDescription>{metrics.patron_count} active patrons</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">
              Earn recurring revenue from supporters through exclusive content and perks.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default MonetizationDashboard;
