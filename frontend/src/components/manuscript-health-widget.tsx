'use client';

import { useMemo, useState } from 'react';

import {
  buildManuscriptHealthReport,
  ManuscriptHealthChapterInput,
  ManuscriptHealthIssue,
  ManuscriptHealthIssueSeverity,
} from '@/lib/manuscript-health';

interface ManuscriptHealthWidgetProps {
  chapters: ManuscriptHealthChapterInput[];
  staleDays?: number;
  thinChapterWordCount?: number;
  knownEntityNames?: string[];
}

type SeverityFilter = 'all' | ManuscriptHealthIssueSeverity;

function getStatusCopy(status: 'healthy' | 'watch' | 'at-risk'): {
  label: string;
  containerClassName: string;
  badgeClassName: string;
  scoreClassName: string;
} {
  if (status === 'healthy') {
    return {
      label: 'Healthy',
      containerClassName: 'from-secondary/10 to-secondary/5 border-secondary/20',
      badgeClassName: 'bg-secondary/15 text-secondary',
      scoreClassName: 'text-secondary',
    };
  }

  if (status === 'watch') {
    return {
      label: 'Watch',
      containerClassName: 'from-tertiary/10 to-tertiary/5 border-tertiary/20',
      badgeClassName: 'bg-tertiary/15 text-tertiary',
      scoreClassName: 'text-tertiary',
    };
  }

  return {
    label: 'At Risk',
    containerClassName: 'from-error/10 to-error/5 border-error/20',
    badgeClassName: 'bg-error/15 text-error',
    scoreClassName: 'text-error',
  };
}

function getIssueSeverityClassName(issue: ManuscriptHealthIssue): string {
  if (issue.severity === 'high') {
    return 'text-error';
  }
  if (issue.severity === 'medium') {
    return 'text-tertiary';
  }
  return 'text-secondary';
}

function getSeverityBadgeClassName(severity: ManuscriptHealthIssueSeverity): string {
  if (severity === 'high') {
    return 'bg-error/20 text-error';
  }
  if (severity === 'medium') {
    return 'bg-tertiary/20 text-tertiary';
  }
  return 'bg-secondary/20 text-secondary';
}

export function ManuscriptHealthWidget({
  chapters,
  staleDays = 21,
  thinChapterWordCount = 300,
  knownEntityNames = [],
}: ManuscriptHealthWidgetProps) {
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');

  const report = useMemo(
    () => buildManuscriptHealthReport(chapters, { staleDays, thinChapterWordCount, knownEntityNames }),
    [chapters, staleDays, thinChapterWordCount, knownEntityNames]
  );

  const filteredIssues = useMemo(() => {
    if (severityFilter === 'all') {
      return report.issues;
    }
    return report.issues.filter((issue) => issue.severity === severityFilter);
  }, [report.issues, severityFilter]);

  const statusCopy = getStatusCopy(report.status);
  const criticalIssueCount = report.issues.filter((i) => i.severity === 'high').length;

  return (
    <div className={`rounded-xl border bg-gradient-to-br p-6 ${statusCopy.containerClassName}`}>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="font-label text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Manuscript Health</p>
          <h3 className="mt-1 text-xl font-semibold text-primary">Editorial Readiness Snapshot</h3>
        </div>
        <span className={`rounded-full px-3 py-1 font-label text-[10px] font-bold uppercase tracking-wider ${statusCopy.badgeClassName}`}>
          {statusCopy.label}
        </span>
      </div>

      {report.totalChapters === 0 ? (
        <div className="rounded-lg border border-dashed border-outline-variant/30 bg-surface-container-lowest/60 p-4 text-sm text-on-surface-variant">
          Add chapters to generate manuscript health diagnostics.
        </div>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-surface-container-lowest/70 p-3">
              <p className="font-label text-[10px] uppercase tracking-wider text-on-surface-variant">Health Score</p>
              <p className={`mt-1 text-2xl font-semibold ${statusCopy.scoreClassName}`}>{report.score}</p>
            </div>
            <div className="rounded-lg bg-surface-container-lowest/70 p-3">
              <p className="font-label text-[10px] uppercase tracking-wider text-on-surface-variant">Chapters Checked</p>
              <p className="mt-1 text-2xl font-semibold text-primary">{report.totalChapters}</p>
            </div>
            <div className="rounded-lg bg-surface-container-lowest/70 p-3">
              <p className="font-label text-[10px] uppercase tracking-wider text-on-surface-variant">Issue Flags</p>
              <p className="mt-1 text-2xl font-semibold text-primary">{report.issueCount}</p>
              {criticalIssueCount > 0 && (
                <p className="mt-1 text-xs text-error font-semibold">{criticalIssueCount} critical</p>
              )}
            </div>
          </div>

          {report.issues.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              <button
                onClick={() => setSeverityFilter('all')}
                className={`rounded-full px-3 py-1 font-label text-[10px] font-bold uppercase tracking-wider transition-colors ${
                  severityFilter === 'all'
                    ? 'bg-primary/20 text-primary'
                    : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-high/80'
                }`}
              >
                All ({report.issues.length})
              </button>
              {['high', 'medium', 'low'].map((severity) => {
                const count = report.issues.filter((i) => i.severity === severity).length;
                return count > 0 ? (
                  <button
                    key={severity}
                    onClick={() => setSeverityFilter(severity as SeverityFilter)}
                    className={`rounded-full px-3 py-1 font-label text-[10px] font-bold uppercase tracking-wider transition-colors ${
                      severityFilter === severity
                        ? `${getSeverityBadgeClassName(severity as ManuscriptHealthIssueSeverity)}`
                        : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-high/80'
                    }`}
                  >
                    {severity === 'high' ? '🔴' : severity === 'medium' ? '🟡' : '🟢'} {severity} ({count})
                  </button>
                ) : null;
              })}
            </div>
          )}

          {filteredIssues.length === 0 ? (
            <div className="rounded-lg border border-secondary/20 bg-secondary/10 p-4 text-sm text-secondary">
              {severityFilter === 'all'
                ? 'No active health risks detected. Keep chapter updates and summaries current.'
                : `No ${severityFilter} severity issues. Great work!`}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredIssues.map((issue) => (
                <div
                  key={issue.id}
                  className="flex items-start justify-between gap-4 rounded-lg border border-outline-variant/15 bg-surface-container-lowest/70 p-3"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm font-semibold ${getIssueSeverityClassName(issue)}`}>{issue.label}</p>
                      <span className={`text-xs font-bold rounded px-1.5 py-0.5 ${getSeverityBadgeClassName(issue.severity)}`}>
                        {issue.severity === 'high' ? '🔴' : issue.severity === 'medium' ? '🟡' : '🟢'} {issue.severity}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-on-surface-variant">{issue.description}</p>
                    {issue.highlights && issue.highlights.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {issue.highlights.slice(0, 4).map((highlight) => (
                          <span
                            key={`${issue.id}-${highlight}`}
                            className="rounded-full bg-surface-container-high px-2 py-0.5 font-label text-[10px] font-bold uppercase tracking-wider text-on-surface-variant"
                          >
                            {highlight}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <span className="whitespace-nowrap rounded-full bg-surface-container-high px-2 py-1 font-label text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                    {issue.count} chapter{issue.count === 1 ? '' : 's'}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 rounded-lg border border-outline-variant/15 bg-surface-container-lowest/70 p-3">
            <p className="font-label text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Recommended Next Actions</p>
            <div className="mt-2 space-y-1">
              {report.recommendations.length > 0 ? (
                report.recommendations.map((recommendation) => (
                  <div key={recommendation} className="flex items-start gap-2 text-xs text-on-surface-variant">
                    <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-tertiary flex-shrink-0" />
                    <p>{recommendation}</p>
                  </div>
                ))
              ) : (
                <p className="text-xs text-secondary font-semibold">All health checks passing! Keep up momentum.</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
