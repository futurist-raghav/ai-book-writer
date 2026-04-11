'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface PublishingGuide {
  platform: string;
  steps: string[];
  requirements: string[];
  tips: string[];
  icon: string;
}

const PUBLISHING_GUIDES: PublishingGuide[] = [
  {
    platform: 'Amazon KDP',
    icon: 'shopping_cart',
    requirements: [
      'ISBN (optional for digital, required for print)',
      'Cover file (3000x2000px minimum, JPEG/PNG)',
      'Formatted manuscript (DOCX or upload as ZIP)',
      'Book description (up to 4000 characters)',
      'Keywords (7 keywords)',
      'BISAC category selection'
    ],
    steps: [
      'Set up KDP account at kdp.amazon.com',
      'Create new book project (paperback or eBook)',
      'Upload cover file (automated checker ensures specs)',
      'Upload manuscript file',
      'Set pricing and royalty options',
      'Set publication date',
      'Review and publish'
    ],
    tips: [
      'Use 0.25" margin minimum on all sides',
      'Embed fonts to avoid substitution',
      'Test on Kindle devices before publishing',
      'Set competitive pricing (check comps)',
      'Write compelling description with keywords',
      'Enable KDP Select for 90-day exclusive (higher royalties)'
    ]
  },
  {
    platform: 'IngramSpark',
    icon: 'local_shipping',
    requirements: [
      'ISBN (required - can purchase through IngramSpark)',
      'Cover file with bleed (0.125")',
      'Interior PDF (must meet specs)',
      'Title and author info',
      'Pricing and discount settings',
      'Distribution channels (print vs. eBook)'
    ],
    steps: [
      'Create IngramSpark account',
      'Set up new title',
      'Purchase or provide ISBN',
      'Upload cover file',
      'Upload interior file',
      'Select trim size and paper quality',
      'Set wholesale discount (typically 40-50%)',
      'Select distribution channels',
      'Review and publish'
    ],
    tips: [
      'IngramSpark distributes to thousands of bookstores',
      'Requires higher wholesale discount (affects retail pricing)',
      'eBook distribution through Smashwords/LibriVox',
      'Print quality is professional (perfect binding)',
      'Takes 24-48 hours to appear in distribution',
      'Track sales through IngramSpark dashboard'
    ]
  },
  {
    platform: 'Draft2Digital',
    icon: 'description',
    requirements: [
      'Manuscript file (DOCX, EPUB, or PDF)',
      'Cover image (1600x2400px minimum)',
      'Book metadata (title, author, description)',
      'Primary genre and subgenre',
      'Keywords (5-10)',
      'Retail price'
    ],
    steps: [
      'Create Draft2Digital account',
      'Click "Publish New Book"',
      'Upload manuscript file',
      'Draft2Digital auto-formats your book',
      'Upload cover art',
      'Fill in book details',
      'Set retail price and royalty rate',
      'Select distribution partners (Amazon, Apple, B&N, etc.)',
      'Publish'
    ],
    tips: [
      'Free distribution to 100+ retailers',
      'No ISBN required (uses ISBN X)',
      'Fastest path from manuscript to global distribution',
      'Simple interface - no technical knowledge needed',
      'Pay only when you make sales',
      'Can update file and cover anytime'
    ]
  },
  {
    platform: 'Apple Books',
    icon: 'apple',
    requirements: [
      'Apple Books Author Account',
      'EPUB file (3MB - 2GB)',
      'Cover image (1600x2400px, JPG/PNG)',
      'Book metadata',
      'Pricing (select from tiered list)',
      'Territory rights'
    ],
    steps: [
      'Sign up for Apple Books for Authors',
      'Verify your identity',
      'Create new book',
      'Upload EPUB file',
      'Upload cover art',
      'Set pricing and availability',
      'Set language and copyright',
      'Select publishing territories',
      'Submit for review (24-48 hours)'
    ],
    tips: [
      'Can distribute through aggregators (Draft2Digital, Smashwords)',
      'Or upload directly to Apple Books for Authors',
      'Premium pricing tier (potential high royalties)',
      'Review process ensures quality',
      'Can schedule publication date in advance',
      'Detailed sales reporting available'
    ]
  }
];

export default function PublishingPipelinePage() {
  const [selectedPlatform, setSelectedPlatform] = useState(0);
  const [expandedStep, setExpandedStep] = useState<number | null>(null);

  const guide = PUBLISHING_GUIDES[selectedPlatform];

  return (
    <div className="space-y-8 p-8">
      <div>
        <h1 className="text-3xl font-bold">Publishing Pipeline Guide</h1>
        <p className="text-gray-500 mt-2">Step-by-step guides for publishing to major platforms</p>
      </div>

      {/* Platform Selector */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {PUBLISHING_GUIDES.map((g, idx) => (
          <button
            key={g.platform}
            onClick={() => setSelectedPlatform(idx)}
            className={`p-4 rounded-lg border-2 transition ${
              selectedPlatform === idx
                ? 'border-blue-600 bg-blue-50'
                : 'border-gray-200 hover:border-blue-300'
            }`}
          >
            <div className="text-2xl">{g.icon}</div>
            <p className="font-semibold mt-2">{g.platform}</p>
          </button>
        ))}
      </div>

      {/* Detailed Guide */}
      <Card>
        <CardHeader>
          <CardTitle>{guide.platform}</CardTitle>
          <CardDescription>Complete publishing guide with requirements and best practices</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="steps" className="space-y-4">
            <TabsList>
              <TabsTrigger value="steps">Steps ({guide.steps.length})</TabsTrigger>
              <TabsTrigger value="requirements">Requirements ({guide.requirements.length})</TabsTrigger>
              <TabsTrigger value="tips">Tips & Tricks ({guide.tips.length})</TabsTrigger>
            </TabsList>

            {/* Steps Tab */}
            <TabsContent value="steps" className="space-y-2">
              {guide.steps.map((step, idx) => (
                <div
                  key={idx}
                  className="border rounded p-3 cursor-pointer hover:bg-gray-50"
                  onClick={() => setExpandedStep(expandedStep === idx ? null : idx)}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold">
                      {idx + 1}
                    </div>
                    <p className="text-sm font-medium flex-1">{step}</p>
                    <span className="text-gray-400">
                      {expandedStep === idx ? '▼' : '▶'}
                    </span>
                  </div>
                </div>
              ))}
            </TabsContent>

            {/* Requirements Tab */}
            <TabsContent value="requirements" className="space-y-2">
              <div className="grid gap-2">
                {guide.requirements.map((req, idx) => (
                  <div key={idx} className="flex gap-2 p-2 bg-gray-50 rounded">
                    <span className="text-green-600 font-bold">✓</span>
                    <span className="text-sm">{req}</span>
                  </div>
                ))}
              </div>

              {/* Checklist export card */}
              <Card className="mt-4 bg-blue-50 border-blue-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Pre-Publishing Checklist</CardTitle>
                </CardHeader>
                <CardContent className="text-xs space-y-1">
                  <label className="flex gap-2">
                    <input type="checkbox" /> Manuscript proofread and formatted
                  </label>
                  <label className="flex gap-2">
                    <input type="checkbox" /> Cover art prepared to specs
                  </label>
                  <label className="flex gap-2">
                    <input type="checkbox" /> All metadata ready (title, keywords, description)
                  </label>
                  <label className="flex gap-2">
                    <input type="checkbox" /> ISBN obtained (if required)
                  </label>
                  <label className="flex gap-2">
                    <input type="checkbox" /> Pricing and royalty options selected
                  </label>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tips Tab */}
            <TabsContent value="tips" className="space-y-2">
              {guide.tips.map((tip, idx) => (
                <div key={idx} className="border-l-4 border-yellow-400 pl-4 py-2">
                  <p className="text-sm">💡 {tip}</p>
                </div>
              ))}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Quick Export Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Export Requirements by Format</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border rounded p-4">
              <h4 className="font-semibold mb-2">Print (Paperback)</h4>
              <ul className="text-sm space-y-1 text-gray-600">
                <li>✓ Interior PDF: 300 DPI minimum</li>
                <li>✓ Margins: 0.25-0.5" recommended</li>
                <li>✓ Cover: PDF with 0.125" bleed</li>
                <li>✓ Size: 6x9", 5x8", or 8x10"</li>
              </ul>
            </div>

            <div className="border rounded p-4">
              <h4 className="font-semibold mb-2">eBook (Digital)</h4>
              <ul className="text-sm space-y-1 text-gray-600">
                <li>✓ EPUB or MOBI format</li>
                <li>✓ Cover: 1600x2400px JPG/PNG</li>
                <li>✓ Embedded fonts or web-safe</li>
                <li>✓ Responsive to device widths</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Platform Comparison */}
      <Card>
        <CardHeader>
          <CardTitle>Platform Comparison</CardTitle>
          <CardDescription>Choose based on your distribution goals</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b">
                <tr>
                  <th className="text-left py-2">Platform</th>
                  <th className="text-center py-2">Global Reach</th>
                  <th className="text-center py-2">Royalty %</th>
                  <th className="text-center py-2">Speed</th>
                  <th className="text-left py-2">Best For</th>
                </tr>
              </thead>
              <tbody className="text-xs">
                <tr className="border-b hover:bg-gray-50">
                  <td className="py-2 font-medium">KDP</td>
                  <td className="text-center">⭐⭐⭐⭐⭐</td>
                  <td className="text-center">35-70%</td>
                  <td className="text-center">Hours</td>
                  <td>Amazon ecosystem dominance</td>
                </tr>
                <tr className="border-b hover:bg-gray-50">
                  <td className="py-2 font-medium">IngramSpark</td>
                  <td className="text-center">⭐⭐⭐⭐</td>
                  <td className="text-center">20-50%</td>
                  <td className="text-center">2 days</td>
                  <td>Bookstore distribution</td>
                </tr>
                <tr className="border-b hover:bg-gray-50">
                  <td className="py-2 font-medium">Draft2Digital</td>
                  <td className="text-center">⭐⭐⭐⭐⭐</td>
                  <td className="text-center">50-80%</td>
                  <td className="text-center">Hours</td>
                  <td>Multi-platform indie authors</td>
                </tr>
                <tr className="hover:bg-gray-50">
                  <td className="py-2 font-medium">Apple Books</td>
                  <td className="text-center">⭐⭐⭐</td>
                  <td className="text-center">70%</td>
                  <td className="text-center">1-2 days</td>
                  <td>Apple ecosystem only</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Recommended Workflow */}
      <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
        <CardHeader>
          <CardTitle className="text-green-900">Recommended Publishing Workflow</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex gap-3">
            <span className="font-bold text-green-700">1.</span>
            <p><strong>Prepare manuscript</strong> - Format, proofread, get cover designed</p>
          </div>
          <div className="flex gap-3">
            <span className="font-bold text-green-700">2.</span>
            <p><strong>Try Draft2Digital first</strong> - Fastest global distribution, no ISBN needed</p>
          </div>
          <div className="flex gap-3">
            <span className="font-bold text-green-700">3.</span>
            <p><strong>Use KDP for Amazon</strong> - Majority of eBook sales (80%+ revenue)</p>
          </div>
          <div className="flex gap-3">
            <span className="font-bold text-green-700">4.</span>
            <p><strong>Consider IngramSpark for print</strong> - Professional print + bookstore distribution</p>
          </div>
          <div className="flex gap-3">
            <span className="font-bold text-green-700">5.</span>
            <p><strong>Track sales</strong> - Monitor sales dashboards, collect reader reviews</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
