'use client';

import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  BarChart3,
  AlertCircle,
  CheckCircle,
  TrendingUp,
  Target,
  RefreshCw,
  Loader,
  ChevronDown,
  BookOpen,
  Eye,
} from 'lucide-react';

interface Issue {
  type: string;
  severity: string;
  message: string;
  location: string | null;
  suggestion: string | null;
  wcag_criterion: string | null;
}

interface AccessibilityScan {
  id: string;
  book_id: string;
  accessibility_score: number;
  wcag_level: string | null;
  total_issues: number;
  error_count: number;
  warning_count: number;
  info_count: number;
  wcag_2_1_aa_compliant: boolean;
  scan_status: string;
  created_at: string;
  completed_at: string | null;
  issues: Issue[] | null;
}

interface Recommendation {
  id: string;
  title: string;
  description: string;
  severity: string;
  status: string;
  implementation_difficulty: string;
  estimated_time_minutes: number | null;
  priority: number;
}

interface AccessibilityCheckerProps {
  bookId: string;
  onScanComplete?: () => void;
}

interface SeverityBadgeProps {
  severity: string;
}

export function AccessibilityChecker({
  bookId,
  onScanComplete,
}: AccessibilityCheckerProps) {
  const [expandedIssue, setExpandedIssue] = useState<string | null>(null);

  // Fetch latest accessibility scan
  const { data: latestScan, isLoading: scanLoading, refetch: refetchScan } = useQuery({
    queryKey: ['accessibility-scan-latest', bookId],
    queryFn: async () => {
      const response = await fetch(`/api/v1/books/${bookId}/accessibility/scan/latest`);
      if (!response.ok) throw new Error('Failed to fetch scan');
      return response.json();
    },
  });

  // Fetch scan history
  const { data: scanHistory } = useQuery({
    queryKey: ['accessibility-scan-history', bookId],
    queryFn: async () => {
      const response = await fetch(`/api/v1/books/${bookId}/accessibility/scan/history`);
      if (!response.ok) throw new Error('Failed to fetch history');
      return response.json();
    },
  });

  // Fetch recommendations
  const { data: recommendations,  refetch: refetchRecommendations } = useQuery({
    queryKey: ['accessibility-recommendations', bookId],
    queryFn: async () => {
      const response = await fetch(`/api/v1/books/${bookId}/accessibility/recommendations`);
      if (!response.ok) throw new Error('Failed to fetch recommendations');
      return response.json();
    },
  });

  // Execute scan
  const executeScanMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/v1/books/${bookId}/accessibility/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scan_type: 'full', format_to_scan: 'pdf' }),
      });
      if (!response.ok) throw new Error('Failed to execute scan');
      return response.json();
    },
    onSuccess: () => {
      refetchScan();
      refetchRecommendations();
      onScanComplete?.();
    },
  });

  const handleScan = () => {
    executeScanMutation.mutate();
  };

  if (scanLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
      </div>
    );
  }

  const scoreColor =
    latestScan?.accessibility_score >= 80
      ? 'text-green-600 dark:text-green-400'
      : latestScan?.accessibility_score >= 60
        ? 'text-yellow-600 dark:text-yellow-400'
        : 'text-red-600 dark:text-red-400';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b pb-6 dark:border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-2xl font-bold dark:text-white">Accessibility Checker</h2>
          <button
            onClick={handleScan}
            disabled={executeScanMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 transition-colors"
          >
            {executeScanMutation.isPending ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                Scanning...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                Run Scan
              </>
            )}
          </button>
        </div>
        <p className="text-gray-600 dark:text-gray-400">
          Validate your book for accessibility compliance (WCAG 2.1)
        </p>
      </div>

      {!latestScan ? (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-8 text-center">
          <BookOpen className="w-12 h-12 mx-auto mb-3 text-blue-600 dark:text-blue-400" />
          <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
            No scans yet
          </h3>
          <p className="text-blue-800 dark:text-blue-200 mb-4">
            Click "Run Scan" to check your book for accessibility issues
          </p>
        </div>
      ) : (
        <>
          {/* Score Card */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                    Accessibility Score
                  </p>
                  <p className={`text-4xl font-bold ${scoreColor}`}>
                    {latestScan.accessibility_score}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                    {latestScan.wcag_2_1_aa_compliant ? (
                      <span className="text-green-600 dark:text-green-400">
                        ✓ WCAG 2.1 AA Compliant
                      </span>
                    ) : (
                      <span className="text-red-600 dark:text-red-400">
                        Not yet compliant
                      </span>
                    )}
                  </p>
                </div>
                <BarChart3 className="w-16 h-16 text-gray-400 dark:text-gray-600" />
              </div>
            </div>

            {/* Issue Summary */}
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Issues Found
              </p>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                    <AlertCircle className="w-4 h-4 text-red-500" />
                    Errors
                  </span>
                  <span className="font-semibold text-red-600 dark:text-red-400">
                    {latestScan.error_count}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                    <AlertCircle className="w-4 h-4 text-yellow-500" />
                    Warnings
                  </span>
                  <span className="font-semibold text-yellow-600 dark:text-yellow-400">
                    {latestScan.warning_count}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                    <Eye className="w-4 h-4 text-blue-500" />
                    Info
                  </span>
                  <span className="font-semibold text-blue-600 dark:text-blue-400">
                    {latestScan.info_count}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Issues List */}
          {latestScan.issues && latestScan.issues.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-900 dark:text-white">
                Issues Details
              </h3>
              {latestScan.issues.map((issue, idx) => (
                <div
                  key={idx}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg"
                >
                  <button
                    onClick={() =>
                      setExpandedIssue(expandedIssue === idx.toString() ? null : idx.toString())
                    }
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <SeverityBadge severity={issue.severity} />
                      <div className="text-left">
                        <p className="font-medium text-gray-900 dark:text-white">
                          {issue.message}
                        </p>
                        {issue.location && (
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {issue.location}
                          </p>
                        )}
                      </div>
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 text-gray-600 dark:text-gray-400 transition-transform ${
                        expandedIssue === idx.toString() ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {expandedIssue === idx.toString() && (
                    <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700 space-y-2">
                      {issue.suggestion && (
                        <div>
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            💡 Suggestion:
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {issue.suggestion}
                          </p>
                        </div>
                      )}
                      {issue.wcag_criterion && (
                        <div>
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            📋 WCAG Criterion:
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            WCAG {issue.wcag_criterion}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Recommendations */}
          {recommendations && recommendations.recommendations.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-900 dark:text-white">
                Improvement Recommendations ({recommendations.open_count} open)
              </h3>
              {recommendations.recommendations.slice(0, 5).map((rec: Recommendation) => (
                <div
                  key={rec.id}
                  className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="font-medium text-blue-900 dark:text-blue-100">
                        {rec.title}
                      </h4>
                      <p className="text-sm text-blue-800 dark:text-blue-200 mt-1">
                        {rec.description}
                      </p>
                      <div className="flex gap-2 mt-2">
                        <span className="text-xs bg-blue-200 dark:bg-blue-900 text-blue-900 dark:text-blue-100 px-2 py-1 rounded">
                          {rec.implementation_difficulty}
                        </span>
                        {rec.estimated_time_minutes && (
                          <span className="text-xs bg-blue-200 dark:bg-blue-900 text-blue-900 dark:text-blue-100 px-2 py-1 rounded">
                            ~{rec.estimated_time_minutes} min
                          </span>
                        )}
                      </div>
                    </div>
                    <span
                      className={`text-xs font-semibold px-2 py-1 rounded ${
                        rec.status === 'completed'
                          ? 'bg-green-200 text-green-900 dark:bg-green-900 dark:text-green-100'
                          : rec.status === 'open'
                            ? 'bg-yellow-200 text-yellow-900 dark:bg-yellow-900 dark:text-yellow-100'
                            : 'bg-gray-200 text-gray-900 dark:bg-gray-700 dark:text-gray-100'
                      }`}
                    >
                      {rec.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Scan History */}
          {scanHistory && scanHistory.total_scans > 1 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-900 dark:text-white">Scan History</h3>
              <div className="space-y-2">
                {scanHistory.scans.slice(0, 3).map((scan: AccessibilityScan) => (
                  <div
                    key={scan.id}
                    className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        Score: {scan.accessibility_score}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(scan.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        {scan.total_issues} issues
                      </p>
                      {scanHistory.score_trend && (
                        <div className="flex items-center gap-1 text-xs">
                          <TrendingUp
                            className={`w-3 h-3 ${
                              scanHistory.score_trend === 'improving'
                                ? 'text-green-600 dark:text-green-400'
                                : 'text-red-600 dark:text-red-400'
                            }`}
                          />
                          <span
                            className={
                              scanHistory.score_trend === 'improving'
                                ? 'text-green-600 dark:text-green-400'
                                : 'text-red-600 dark:text-red-400'
                            }
                          >
                            {scanHistory.score_trend}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Tips */}
      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
        <h4 className="font-semibold text-green-900 dark:text-green-100 mb-2">
          ♿ Accessibility Tips
        </h4>
        <ul className="text-sm text-green-800 dark:text-green-200 space-y-1">
          <li>• Always provide descriptive alt text for images and graphics</li>
          <li>• Ensure text has sufficient contrast (4.5:1 for normal text)</li>
          <li>• Use proper heading hierarchy for document structure</li>
          <li>• Make tables accessible with proper headers and labels</li>
          <li>• Use descriptive link text that makes sense out of context</li>
        </ul>
      </div>
    </div>
  );
}

function SeverityBadge({ severity }: SeverityBadgeProps) {
  const configs: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
    error: {
      bg: 'bg-red-100 dark:bg-red-900/20',
      text: 'text-red-700 dark:text-red-300',
      icon: <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />,
    },
    warning: {
      bg: 'bg-yellow-100 dark:bg-yellow-900/20',
      text: 'text-yellow-700 dark:text-yellow-300',
      icon: <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />,
    },
    info: {
      bg: 'bg-blue-100 dark:bg-blue-900/20',
      text: 'text-blue-700 dark:text-blue-300',
      icon: <Eye className="w-4 h-4 text-blue-600 dark:text-blue-400" />,
    },
  };

  const config = configs[severity] || configs.info;

  return (
    <div className={`px-2 py-1 rounded ${config.bg}`}>
      <span className={`flex items-center gap-1 text-xs font-medium ${config.text}`}>
        {config.icon}
        {severity}
      </span>
    </div>
  );
}
