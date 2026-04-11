'use client';

import React, { useState } from 'react';
import { useResearchAgent, useFactCheckAgent, useToneAnalyzeAgent, useCitationAgent } from '@/hooks/useAIAgents';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, CheckCircle, Zap, Quote, Copy, Check } from 'lucide-react';

interface AgentPanelProps {
  selectedText?: string;
  genre?: string;
  projectType?: string;
  onInsertContent?: (content: string) => void;
}

export function AgentPanel({
  selectedText = '',
  genre = 'novel',
  projectType = 'novel',
  onInsertContent,
}: AgentPanelProps) {
  const [activeTab, setActiveTab] = useState('research');
  const [copied, setCopied] = useState<string | null>(null);

  // Agent mutations
  const researchMutation = useResearchAgent();
  const factCheckMutation = useFactCheckAgent();
  const toneAnalyzeMutation = useToneAnalyzeAgent();
  const citationMutation = useCitationAgent();

  // Research tab state
  const [researchTopic, setResearchTopic] = useState('');

  // Fact-check tab state (uses selected text)
  const [factCheckDomain, setFactCheckDomain] = useState('general');

  // Tone analyze tab state (uses selected text)
  const [toneGenre, setToneGenre] = useState(genre);

  // Citation tab state
  const [researchResults, setResearchResults] = useState('');
  const [citationStyle, setCitationStyle] = useState<'APA' | 'MLA' | 'Chicago' | 'Harvard'>('APA');

  const handleCopyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="w-full rounded-lg border border-gray-200 bg-white p-4">
      <h3 className="mb-4 text-lg font-semibold text-gray-900">AI Agents</h3>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="research" className="gap-1">
            <Search className="h-4 w-4" />
            <span className="hidden sm:inline">Research</span>
          </TabsTrigger>
          <TabsTrigger value="fact-check" className="gap-1">
            <CheckCircle className="h-4 w-4" />
            <span className="hidden sm:inline">Verify</span>
          </TabsTrigger>
          <TabsTrigger value="tone" className="gap-1">
            <Zap className="h-4 w-4" />
            <span className="hidden sm:inline">Tone</span>
          </TabsTrigger>
          <TabsTrigger value="citation" className="gap-1">
            <Quote className="h-4 w-4" />
            <span className="hidden sm:inline">Cite</span>
          </TabsTrigger>
        </TabsList>

        {/* Research Agent */}
        <TabsContent value="research" className="space-y-3 mt-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Topic to Research</label>
            <Input
              type="text"
              value={researchTopic}
              onChange={(e) => setResearchTopic(e.target.value)}
              placeholder="e.g., Victorian era social customs, time travel theories..."
              className="w-full"
            />
          </div>

          <Button
            onClick={() => researchMutation.mutate({ topic: researchTopic })}
            disabled={!researchTopic.trim() || researchMutation.isPending}
            className="w-full gap-2"
          >
            <Search className="h-4 w-4" />
            {researchMutation.isPending ? 'Researching...' : 'Research'}
          </Button>

          {researchMutation.data && (
            <div className="mt-4 space-y-3 rounded-lg bg-blue-50 p-4">
              {researchMutation.data.summary && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-1">Summary</h4>
                  <p className="text-sm text-gray-700">{researchMutation.data.summary}</p>
                </div>
              )}

              {researchMutation.data.facts && researchMutation.data.facts.length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Key Facts</h4>
                  <ul className="space-y-1">
                    {researchMutation.data.facts.slice(0, 5).map((fact: any, idx: number) => (
                      <li key={idx} className="text-sm text-gray-700 flex gap-2">
                        <span className="text-blue-600">•</span>
                        {fact.fact || fact}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {researchMutation.data.sources && researchMutation.data.sources.length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Sources</h4>
                  <ul className="space-y-1">
                    {researchMutation.data.sources.slice(0, 3).map((source: any, idx: number) => (
                      <li key={idx} className="text-sm text-gray-700">
                        <a
                          href={source.url || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          {source.title || source}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {researchMutation.error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
              Research failed: {(researchMutation.error as any).message}
            </div>
          )}
        </TabsContent>

        {/* Fact-Check Agent */}
        <TabsContent value="fact-check" className="space-y-3 mt-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Text to Fact-Check</label>
            <Textarea
              value={selectedText || ''}
              placeholder="Paste or select text to fact-check..."
              rows={3}
              className="w-full"
              disabled
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Knowledge Domain</label>
            <select
              value={factCheckDomain}
              onChange={(e) => setFactCheckDomain(e.target.value)}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
            >
              <option value="general">General</option>
              <option value="historical">Historical</option>
              <option value="scientific">Scientific</option>
              <option value="medical">Medical</option>
              <option value="legal">Legal</option>
            </select>
          </div>

          <Button
            onClick={() => factCheckMutation.mutate({ text: selectedText, domain: factCheckDomain })}
            disabled={!selectedText.trim() || factCheckMutation.isPending}
            className="w-full gap-2"
          >
            <CheckCircle className="h-4 w-4" />
            {factCheckMutation.isPending ? 'Verifying...' : 'Fact-Check'}
          </Button>

          {factCheckMutation.data && (
            <div className="mt-4 space-y-3 rounded-lg bg-amber-50 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-900">Overall Accuracy</span>
                <div className="flex items-center gap-2">
                  <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500"
                      style={{ width: `${(factCheckMutation.data.overall_accuracy || 0) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-bold text-gray-900">
                    {Math.round((factCheckMutation.data.overall_accuracy || 0) * 100)}%
                  </span>
                </div>
              </div>

              {factCheckMutation.data.claims && factCheckMutation.data.claims.length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Claims</h4>
                  <ul className="space-y-2">
                    {factCheckMutation.data.claims.slice(0, 5).map((claim: any, idx: number) => (
                      <li key={idx} className="text-sm p-2 bg-white rounded border border-gray-200">
                        <div className="flex items-start gap-2">
                          <span className={claim.verified ? 'text-green-600' : 'text-red-600'}>
                            {claim.verified ? '✓' : '✗'}
                          </span>
                          <div className="flex-1">
                            <p className="text-gray-900">{claim.claim}</p>
                            {claim.evidence && <p className="text-xs text-gray-600 mt-1">{claim.evidence}</p>}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {factCheckMutation.error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
              Fact-check failed: {(factCheckMutation.error as any).message}
            </div>
          )}
        </TabsContent>

        {/* Tone Analyze Agent */}
        <TabsContent value="tone" className="space-y-3 mt-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Text to Analyze</label>
            <Textarea
              value={selectedText || ''}
              placeholder="Paste or select text to analyze tone..."
              rows={3}
              className="w-full"
              disabled
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Genre</label>
            <select
              value={toneGenre}
              onChange={(e) => setToneGenre(e.target.value)}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
            >
              <option value="novel">Novel</option>
              <option value="fantasy">Fantasy</option>
              <option value="mystery">Mystery</option>
              <option value="romance">Romance</option>
              <option value="sci-fi">Science Fiction</option>
              <option value="thriller">Thriller</option>
              <option value="literary">Literary Fiction</option>
            </select>
          </div>

          <Button
            onClick={() =>
              toneAnalyzeMutation.mutate({ text: selectedText, genre: toneGenre, projectType })
            }
            disabled={!selectedText.trim() || toneAnalyzeMutation.isPending}
            className="w-full gap-2"
          >
            <Zap className="h-4 w-4" />
            {toneAnalyzeMutation.isPending ? 'Analyzing...' : 'Analyze Tone'}
          </Button>

          {toneAnalyzeMutation.data && (
            <div className="mt-4 space-y-3 rounded-lg bg-purple-50 p-4">
              <div>
                <h4 className="font-semibold text-gray-900 mb-1">Detected Tone</h4>
                <p className="text-sm text-gray-700 mb-2">{toneAnalyzeMutation.data.detected_tone}</p>
                {toneAnalyzeMutation.data.tone_qualities && (
                  <div className="flex flex-wrap gap-1">
                    {toneAnalyzeMutation.data.tone_qualities.map((quality: string, idx: number) => (
                      <span key={idx} className="px-2 py-1 bg-purple-200 text-purple-900 text-xs rounded">
                        {quality}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {toneAnalyzeMutation.data.improvements && toneAnalyzeMutation.data.improvements.length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Suggestions</h4>
                  <ul className="space-y-1">
                    {toneAnalyzeMutation.data.improvements.slice(0, 3).map((sugg: string, idx: number) => (
                      <li key={idx} className="text-sm text-gray-700 flex gap-2">
                        <span className="text-purple-600">→</span>
                        {sugg}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {toneAnalyzeMutation.error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
              Analysis failed: {(toneAnalyzeMutation.error as any).message}
            </div>
          )}
        </TabsContent>

        {/* Citation Agent */}
        <TabsContent value="citation" className="space-y-3 mt-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Research Results</label>
            <Textarea
              value={researchResults}
              onChange={(e) => setResearchResults(e.target.value)}
              placeholder="Paste research results, quotes, or source information..."
              rows={4}
              className="w-full"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Citation Style</label>
            <select
              value={citationStyle}
              onChange={(e) => setCitationStyle(e.target.value as any)}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
            >
              <option value="APA">APA</option>
              <option value="MLA">MLA</option>
              <option value="Chicago">Chicago</option>
              <option value="Harvard">Harvard</option>
            </select>
          </div>

          <Button
            onClick={() => citationMutation.mutate({ researchResults, citationStyle })}
            disabled={!researchResults.trim() || citationMutation.isPending}
            className="w-full gap-2"
          >
            <Quote className="h-4 w-4" />
            {citationMutation.isPending ? 'Generating...' : 'Generate Citations'}
          </Button>

          {citationMutation.data && (
            <div className="mt-4 space-y-3 rounded-lg bg-green-50 p-4">
              {citationMutation.data.citations && citationMutation.data.citations.length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">{citationStyle} Citations</h4>
                  <div className="space-y-2">
                    {citationMutation.data.citations.map((citation: string, idx: number) => (
                      <div key={idx} className="bg-white p-2 rounded border border-gray-200 text-sm text-gray-700">
                        <div className="flex items-start justify-between gap-2">
                          <p className="flex-1">{citation}</p>
                          <button
                            onClick={() => handleCopyToClipboard(citation, `citation-${idx}`)}
                            className="text-green-600 hover:text-green-700 flex-shrink-0"
                          >
                            {copied === `citation-${idx}` ? (
                              <Check className="h-4 w-4" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {citationMutation.error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
              Citation generation failed: {(citationMutation.error as any).message}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
