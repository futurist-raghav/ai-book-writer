'use client';

import { useMemo } from 'react';

import {
  buildManuscriptHealthReport,
  ManuscriptHealthChapterInput,
  ManuscriptHealthIssue,
} from '@/lib/manuscript-health';

interface ManuscriptHealthWidgetProps {
  chapters: ManuscriptHealthChapterInput[];
  staleDays?: number;
  thinChapterWordCount?: number;
  knownEntityNames?: string[];
}

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

export function ManuscriptHealthWidget({
  chapters,
  staleDays = 21,
  thinChapterWordCount = 300,
  knownEntityNames = [],
}: ManuscriptHealthWidgetProps) {
  const report = useMemo(
    () => buildManuscriptHealthReport(chapters, { staleDays, thinChapterWordCount, knownEntityNames }),
    [chapters, staleDays, thinChapterWordCount, knownEntityNames]
  );

  const statusCopy = getStatusCopy(report.status);

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
            </div>
          </div>

          {report.issues.length === 0 ? (
            <div className="rounded-lg border border-secondary/20 bg-secondary/10 p-4 text-sm text-secondary">
              No active health risks detected. Keep chapter updates and summaries current.
            </div>
          ) : (
            <div className="space-y-2">
              {report.issues.map((issue) => (
                <div
                  key={issue.id}
                  className="flex items-start justify-between gap-4 rounded-lg border border-outline-variant/15 bg-surface-container-lowest/70 p-3"
                >
                  <div>
                    <p className={`text-sm font-semibold ${getIssueSeverityClassName(issue)}`}>{issue.label}</p>
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
              {report.recommendations.map((recommendation) => (
                <p key={recommendation} className="text-xs text-on-surface-variant">
                  {recommendation}
                </p>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
