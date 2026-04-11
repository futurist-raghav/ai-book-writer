'use client';

import React from 'react';
import { useAuthStore } from '@/stores/auth';
import { AgentPanel } from '@/components/agent-panel';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { AlertDescription, Alert } from '@/components/ui/alert';
import { Zap } from 'lucide-react';

export default function AgentsPage() {
  const user = useAuthStore((state) => state.user);

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      {/* Header Section */}
      <div className="border-b border-gray-200 bg-white px-6 py-4 dark:border-gray-800 dark:bg-gray-950">
        <div className="mb-4">
          <Breadcrumb>
            <BreadcrumbItem>
              <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <span className="text-gray-600 dark:text-gray-400">AI Agents</span>
            </BreadcrumbItem>
          </Breadcrumb>
        </div>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-bold text-gray-900 dark:text-white">
              <Zap className="h-8 w-8 text-blue-600" />
              Premium AI Agents
            </h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Research, fact-check, analyze tone, and generate citations with AI assistance.
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto bg-gray-50 p-6 dark:bg-gray-900">
        <div className="mx-auto max-w-4xl">
          {/* Info Banner */}
          <Alert className="mb-6 border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/20">
            <Zap className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <AlertDescription className="text-sm text-blue-900 dark:text-blue-200">
              These premium AI agents help you research topics, verify facts, improve tone, and generate citations. Use them throughout your manuscript to enhance quality and accuracy.
            </AlertDescription>
          </Alert>

          {/* Agent Panel */}
          <div className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-950">
            <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-800">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">AI Agents Studio</h2>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                Select an agent below to get started.
              </p>
            </div>

            <div className="p-6">
              <AgentPanel
                genre="novel"
                projectType="novel"
                onInsertContent={(content) => {
                  // Could integrate with editor later
                  console.log('Insert content:', content);
                }}
              />
            </div>
          </div>

          {/* Quick Reference */}
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
              <h3 className="font-semibold text-gray-900 dark:text-white">Research Agent</h3>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                Discover credible sources and facts on any topic. Great for research papers, non-fiction, and building accurate worlds.
              </p>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
              <h3 className="font-semibold text-gray-900 dark:text-white">Fact-Checker</h3>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                Verify claims in your manuscript against knowledge bases. Ensure accuracy in historical details, science, and facts.
              </p>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
              <h3 className="font-semibold text-gray-900 dark:text-white">Tone Coach</h3>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                Analyze your text tone and get suggestions to match your genre. Perfect for ensuring consistent voice.
              </p>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
              <h3 className="font-semibold text-gray-900 dark:text-white">Citation Agent</h3>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                Generate properly formatted citations in APA, MLA, Chicago, or Harvard style. Perfect for academic writing.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
