'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Check, 
  X, 
  Zap, 
  Users, 
  BarChart3, 
  Download,
  Lock,
  Unlock,
  CreditCard,
  ArrowRight
} from 'lucide-react';

interface Tier {
  tier_id: string;
  name: string;
  price_monthly: number;
  price_annual: number;
  description: string;
  features: string[];
  limits: Record<string, any>;
}

interface UsageData {
  tier: string;
  tier_name: string;
  usage: Record<string, number>;
  limits: Record<string, any>;
  warnings: Array<{ feature: string; used: number; limit: number; percent: number }>;
}

export default function SubscriptionPage() {
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('monthly');

  const { data: tiers = [], isLoading: tiersLoading } = useQuery({
    queryKey: ['subscription-tiers'],
    queryFn: async () => {
      const response = await api.get('/subscriptions/tiers');
      return response.data.tiers;
    },
  });

  const { data: currentSub } = useQuery({
    queryKey: ['current-subscription'],
    queryFn: async () => {
      const response = await api.get('/subscriptions/current');
      return response.data;
    },
  });

  const { data: usage } = useQuery({
    queryKey: ['subscription-usage'],
    queryFn: async () => {
      const response = await api.get('/subscriptions/usage');
      return response.data as UsageData;
    },
  });

  const getPrice = (tier: Tier) => {
    return billingPeriod === 'monthly' ? tier.price_monthly : tier.price_annual;
  };

  const getPriceLabel = (tier: Tier) => {
    if (getPrice(tier) === 0) return 'Free';
    const price = getPrice(tier);
    const period = billingPeriod === 'monthly' ? '/month' : '/year';
    return `$${price.toFixed(2)}${period}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white py-12">
        <div className="max-w-7xl mx-auto px-4">
          <h1 className="text-4xl font-bold mb-3 flex items-center gap-3">
            <Zap className="h-10 w-10" />
            Subscription Plans
          </h1>
          <p className="text-blue-100 text-lg">
            Choose the perfect plan for your writing journey
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Billing Toggle */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex p-1 bg-gray-200 rounded-lg">
            <button
              onClick={() => setBillingPeriod('monthly')}
              className={`px-4 py-2 rounded transition ${
                billingPeriod === 'monthly'
                  ? 'bg-white text-blue-600 font-semibold shadow'
                  : 'text-gray-700'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingPeriod('annual')}
              className={`px-4 py-2 rounded transition ${
                billingPeriod === 'annual'
                  ? 'bg-white text-blue-600 font-semibold shadow'
                  : 'text-gray-700'
              }`}
            >
              Annual
              <Badge className="ml-2 bg-green-600">Save 20%</Badge>
            </button>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {tiersLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-96 bg-gray-200 rounded-lg animate-pulse" />
            ))
          ) : (
            tiers.map((tier: Tier) => {
              const isCurrent = currentSub?.tier === tier.tier_id;
              const isPopular = tier.tier_id === 'pro';

              return (
                <Card
                  key={tier.tier_id}
                  className={`overflow-hidden transition-all ${
                    isPopular
                      ? 'md:scale-105 ring-2 ring-blue-600 shadow-xl'
                      : isCurrent
                      ? 'ring-2 ring-green-600'
                      : ''
                  }`}
                >
                  {isPopular && (
                    <div className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white py-2 text-center font-semibold text-sm">
                      MOST POPULAR
                    </div>
                  )}
                  
                  <CardHeader>
                    <CardTitle className="text-2xl">{tier.name}</CardTitle>
                    <CardDescription>{tier.description}</CardDescription>
                    <div className="mt-4">
                      <div className="text-3xl font-bold text-gray-900">
                        {getPriceLabel(tier)}
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-6">
                    {/* Features List */}
                    <div className="space-y-3">
                      {tier.features.map((feature, idx) => (
                        <div key={idx} className="flex items-start gap-3">
                          <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                          <span className="text-sm text-gray-700">{feature}</span>
                        </div>
                      ))}
                    </div>

                    {/* Limits Preview */}
                    <div className="bg-gray-50 p-3 rounded text-sm space-y-1">
                      <p className="font-semibold text-gray-700 mb-2">Limits</p>
                      <div className="text-gray-600">
                        <p>• Projects: {tier.limits.projects || '∞'}</p>
                        <p>• Collaborators: {tier.limits.collaborators_per_project || '∞'}</p>
                        <p>• AI Requests: {tier.limits.ai_requests_monthly.toLocaleString()}/mo</p>
                        <p>• Storage: {tier.limits.storage_gb}GB</p>
                      </div>
                    </div>

                    {/* CTA Button */}
                    {isCurrent ? (
                      <Button disabled className="w-full" variant="outline">
                        Current Plan
                      </Button>
                    ) : (
                      <Button className="w-full" size="lg">
                        {tier.price_monthly === 0 ? 'Start Free' : 'Upgrade Now'}
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Usage & Limits */}
        <Tabs defaultValue="usage" className="mb-12">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="usage">Current Usage</TabsTrigger>
            <TabsTrigger value="billing">Billing</TabsTrigger>
            <TabsTrigger value="payment">Payment Method</TabsTrigger>
          </TabsList>

          {/* Usage Tab */}
          <TabsContent value="usage">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  {usage?.tier_name} - Usage & Limits
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {usage?.warnings && usage.warnings.length > 0 && (
                  <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
                    <p className="font-semibold text-yellow-900 mb-2">Usage Warnings</p>
                    {usage.warnings.map((warning, idx) => (
                      <div key={idx} className="mb-2">
                        <p className="text-sm text-yellow-800">
                          {warning.feature}: {warning.used} / {warning.limit} ({warning.percent}%)
                        </p>
                        <Progress value={warning.percent} className="h-1 mt-1" />
                      </div>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {usage && Object.entries(usage.usage).map(([key, value]) => {
                    const limit = usage.limits[key];
                    const percent =
                      typeof value === 'number' && typeof limit === 'number'
                        ? (value / limit) * 100
                        : 0;

                    return (
                      <div key={key} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-semibold text-gray-900 capitalize">
                            {key.replace(/_/g, ' ')}
                          </p>
                          <span className="text-sm text-gray-600">
                            {value} / {limit || '∞'}
                          </span>
                        </div>
                        {typeof limit === 'number' && (
                          <Progress value={Math.min(percent, 100)} className="h-2" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Billing Tab */}
          <TabsContent value="billing">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Billing History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-3 border rounded hover:bg-gray-50"
                    >
                      <div>
                        <p className="font-medium text-gray-900">Monthly subscription</p>
                        <p className="text-sm text-gray-600">
                          {new Date(Date.now() - i * 30 * 24 * 60 * 60 * 1000).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-semibold text-gray-900">$9.99</span>
                        <Badge variant="outline">Paid</Badge>
                        <Button variant="ghost" size="sm">
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Payment Method Tab */}
          <TabsContent value="payment">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Payment Method
                </CardTitle>
              </CardHeader>
              <CardContent className="text-center py-12">
                <Lock className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  No Payment Method
                </h3>
                <p className="text-gray-600 mb-6">
                  Add a payment method to upgrade your plan or set up automatic renewals
                </p>
                <Button>
                  <CreditCard className="h-4 w-4 mr-2" />
                  Add Payment Method
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* FAQ Section */}
        <Card>
          <CardHeader>
            <CardTitle>Frequently Asked Questions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">Can I change my plan anytime?</h4>
              <p className="text-gray-600 text-sm">
                Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately for upgrades, or at the end of your billing cycle for downgrades.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">What happens if I exceed my limits?</h4>
              <p className="text-gray-600 text-sm">
                We'll notify you when you approach your limits. You can upgrade anytime to get higher limits. Free tier features won't be restricted.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">Is there a contract?</h4>
              <p className="text-gray-600 text-sm">
                No contracts! Cancel anytime. Your access continues until the end of your current billing period.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
