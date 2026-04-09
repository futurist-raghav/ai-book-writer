import {
  buildManuscriptHealthReport,
  ManuscriptHealthChapterInput,
  ManuscriptHealthIssueId,
} from '@/lib/manuscript-health';

const REFERENCE_DATE = new Date('2026-04-09T12:00:00.000Z');

function getIssueCount(report: ReturnType<typeof buildManuscriptHealthReport>, issueId: ManuscriptHealthIssueId): number {
  return report.issues.find((issue) => issue.id === issueId)?.count ?? 0;
}

describe('buildManuscriptHealthReport', () => {
  it('returns a healthy report with no chapters', () => {
    const report = buildManuscriptHealthReport([], {}, REFERENCE_DATE);

    expect(report.totalChapters).toBe(0);
    expect(report.issueCount).toBe(0);
    expect(report.score).toBe(100);
    expect(report.status).toBe('healthy');
    expect(report.issues).toEqual([]);
  });

  it('flags missing summaries and thin chapters', () => {
    const chapters: ManuscriptHealthChapterInput[] = [
      {
        id: 'chapter-1',
        summary: '',
        word_count: 120,
        updated_at: '2026-04-08T09:00:00.000Z',
      },
      {
        id: 'chapter-2',
        summary: 'Has summary',
        word_count: 1800,
        updated_at: '2026-04-07T09:00:00.000Z',
      },
    ];

    const report = buildManuscriptHealthReport(chapters, { thinChapterWordCount: 300 }, REFERENCE_DATE);

    expect(getIssueCount(report, 'missing-summary')).toBe(1);
    expect(getIssueCount(report, 'thin-chapter')).toBe(1);
    expect(getIssueCount(report, 'stale-chapter')).toBe(0);
    expect(report.score).toBe(89);
    expect(report.status).toBe('healthy');
  });

  it('flags stale chapters based on configured threshold', () => {
    const chapters: ManuscriptHealthChapterInput[] = [
      {
        id: 'chapter-old',
        summary: 'Needs revision',
        word_count: 1000,
        updated_at: '2026-02-10T09:00:00.000Z',
      },
      {
        id: 'chapter-fresh',
        summary: 'Current chapter',
        word_count: 1100,
        updated_at: '2026-04-08T09:00:00.000Z',
      },
    ];

    const report = buildManuscriptHealthReport(chapters, { staleDays: 30 }, REFERENCE_DATE);

    expect(getIssueCount(report, 'stale-chapter')).toBe(1);
    expect(getIssueCount(report, 'missing-summary')).toBe(0);
    expect(report.status).toBe('healthy');
  });

  it('returns at-risk status when multiple issues accumulate', () => {
    const chapters: ManuscriptHealthChapterInput[] = [
      {
        id: 'chapter-1',
        summary: '',
        word_count: 120,
        updated_at: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'chapter-2',
        summary: '',
        word_count: 150,
        updated_at: '2026-01-05T00:00:00.000Z',
      },
      {
        id: 'chapter-3',
        summary: '',
        word_count: 110,
        updated_at: '2026-01-07T00:00:00.000Z',
      },
      {
        id: 'chapter-4',
        summary: '',
        word_count: 200,
        updated_at: '2026-01-09T00:00:00.000Z',
      },
    ];

    const report = buildManuscriptHealthReport(chapters, { staleDays: 21, thinChapterWordCount: 300 }, REFERENCE_DATE);

    expect(getIssueCount(report, 'missing-summary')).toBe(4);
    expect(getIssueCount(report, 'stale-chapter')).toBe(4);
    expect(getIssueCount(report, 'thin-chapter')).toBe(4);
    expect(report.score).toBe(36);
    expect(report.status).toBe('at-risk');
  });

  it('ignores invalid timestamps for stale calculations', () => {
    const chapters: ManuscriptHealthChapterInput[] = [
      {
        id: 'chapter-1',
        summary: 'Ready',
        word_count: 850,
        updated_at: 'not-a-date',
      },
    ];

    const report = buildManuscriptHealthReport(chapters, { staleDays: 7 }, REFERENCE_DATE);

    expect(getIssueCount(report, 'stale-chapter')).toBe(0);
    expect(report.score).toBe(100);
  });

  it('flags undefined character references from repeated unknown names', () => {
    const chapters: ManuscriptHealthChapterInput[] = [
      {
        id: 'chapter-1',
        summary: 'Elena arrives at the observatory before dawn.',
        word_count: 1100,
        updated_at: '2026-04-08T09:00:00.000Z',
      },
      {
        id: 'chapter-2',
        summary: 'Later, Elena warns the team about incoming storms.',
        word_count: 1200,
        updated_at: '2026-04-08T09:00:00.000Z',
      },
      {
        id: 'chapter-3',
        summary: 'The rest of the team prepares for launch.',
        word_count: 1150,
        updated_at: '2026-04-08T09:00:00.000Z',
      },
    ];

    const report = buildManuscriptHealthReport(chapters, {}, REFERENCE_DATE);

    expect(getIssueCount(report, 'undefined-character-reference')).toBe(2);
    expect(report.issues.find((issue) => issue.id === 'undefined-character-reference')?.highlights).toContain('Elena');
  });

  it('does not flag known entity names as undefined characters', () => {
    const chapters: ManuscriptHealthChapterInput[] = [
      {
        id: 'chapter-1',
        summary: 'Elena arrives at the observatory before dawn.',
        word_count: 1100,
        updated_at: '2026-04-08T09:00:00.000Z',
      },
      {
        id: 'chapter-2',
        summary: 'Elena warns the team about incoming storms.',
        word_count: 1200,
        updated_at: '2026-04-08T09:00:00.000Z',
      },
      {
        id: 'chapter-3',
        summary: 'The team prepares for launch.',
        word_count: 1150,
        updated_at: '2026-04-08T09:00:00.000Z',
      },
    ];

    const report = buildManuscriptHealthReport(chapters, { knownEntityNames: ['Elena'] }, REFERENCE_DATE);

    expect(getIssueCount(report, 'undefined-character-reference')).toBe(0);
  });

  it('flags fuzzy alias mismatches against known entities', () => {
    const chapters: ManuscriptHealthChapterInput[] = [
      {
        id: 'chapter-1',
        summary: 'Elena checks the observatory logs before sunrise.',
        word_count: 950,
        updated_at: '2026-04-08T09:00:00.000Z',
      },
      {
        id: 'chapter-2',
        summary: 'The team prepares launch protocols.',
        word_count: 980,
        updated_at: '2026-04-08T09:00:00.000Z',
      },
    ];

    const report = buildManuscriptHealthReport(
      chapters,
      { knownEntityNames: ['Eliana'] },
      REFERENCE_DATE
    );

    expect(getIssueCount(report, 'character-alias-mismatch')).toBe(1);
    expect(getIssueCount(report, 'undefined-character-reference')).toBe(0);
    expect(report.issues.find((issue) => issue.id === 'character-alias-mismatch')?.highlights).toContain(
      'Elena -> Eliana'
    );
    expect(report.recommendations.some((item) => item.includes('Elena -> Eliana'))).toBe(true);
  });

  it('highlights likely fuzzy name mismatches against known entities', () => {
    const chapters: ManuscriptHealthChapterInput[] = [
      {
        id: 'chapter-1',
        summary: 'Eliana arrives at the observatory before dawn.',
        word_count: 1100,
        updated_at: '2026-04-08T09:00:00.000Z',
      },
      {
        id: 'chapter-2',
        summary: 'Eliana warns the team about incoming storms.',
        word_count: 1200,
        updated_at: '2026-04-08T09:00:00.000Z',
      },
      {
        id: 'chapter-3',
        summary: 'The team prepares for launch.',
        word_count: 1150,
        updated_at: '2026-04-08T09:00:00.000Z',
      },
    ];

    const report = buildManuscriptHealthReport(chapters, { knownEntityNames: ['Elena'] }, REFERENCE_DATE);

    const issue = report.issues.find((item) => item.id === 'character-alias-mismatch');
    expect(getIssueCount(report, 'undefined-character-reference')).toBe(0);
    expect(issue?.highlights).toContain('Eliana -> Elena');
    expect(report.recommendations.some((item) => item.includes('Eliana -> Elena'))).toBe(true);
  });

  it('flags orphaned sections for scene and section placeholders', () => {
    const chapters: ManuscriptHealthChapterInput[] = [
      {
        id: 'scene-1',
        title: 'Scene 1',
        chapter_type: 'scene',
        summary: '',
        description: '',
        compiled_content: '',
        word_count: 0,
        updated_at: '2026-04-08T09:00:00.000Z',
      },
      {
        id: 'section-1',
        title: 'Section 1',
        chapter_type: 'section',
        summary: '',
        description: '',
        compiled_content: '',
        word_count: 40,
        updated_at: '2026-04-08T09:00:00.000Z',
      },
      {
        id: 'chapter-1',
        title: 'Complete Chapter',
        chapter_type: 'chapter',
        summary: 'Has content',
        word_count: 1200,
        updated_at: '2026-04-08T09:00:00.000Z',
      },
    ];

    const report = buildManuscriptHealthReport(chapters, {}, REFERENCE_DATE);

    expect(getIssueCount(report, 'orphaned-section')).toBe(2);
  });

  it('flags pacing outliers when chapter lengths are highly imbalanced', () => {
    const chapters: ManuscriptHealthChapterInput[] = [
      {
        id: 'chapter-1',
        title: 'Short Chapter',
        summary: 'Short but complete',
        word_count: 120,
        updated_at: '2026-04-08T09:00:00.000Z',
      },
      {
        id: 'chapter-2',
        title: 'Typical Chapter A',
        summary: 'Main draft',
        word_count: 980,
        updated_at: '2026-04-08T09:00:00.000Z',
      },
      {
        id: 'chapter-3',
        title: 'Typical Chapter B',
        summary: 'Main draft',
        word_count: 1020,
        updated_at: '2026-04-08T09:00:00.000Z',
      },
      {
        id: 'chapter-4',
        title: 'Long Chapter',
        summary: 'Extended scene',
        word_count: 4200,
        updated_at: '2026-04-08T09:00:00.000Z',
      },
    ];

    const report = buildManuscriptHealthReport(chapters, { thinChapterWordCount: 50 }, REFERENCE_DATE);

    expect(getIssueCount(report, 'pacing-outlier')).toBe(2);
    expect(report.recommendations.some((item) => item.toLowerCase().includes('pacing'))).toBe(true);
  });

  it('flags known-name spelling drift as alias mismatch', () => {
    const chapters: ManuscriptHealthChapterInput[] = [
      {
        id: 'chapter-1',
        summary: 'Elena arrives at the observatory before dawn.',
        word_count: 900,
        updated_at: '2026-04-08T09:00:00.000Z',
      },
      {
        id: 'chapter-2',
        summary: 'Elena warns the team about incoming storms.',
        word_count: 950,
        updated_at: '2026-04-08T09:00:00.000Z',
      },
    ];

    const report = buildManuscriptHealthReport(chapters, { knownEntityNames: ['Eliana'] }, REFERENCE_DATE);

    expect(getIssueCount(report, 'character-alias-mismatch')).toBe(2);
    expect(getIssueCount(report, 'undefined-character-reference')).toBe(0);
    expect(
      report.issues
        .find((issue) => issue.id === 'character-alias-mismatch')
        ?.highlights?.some((highlight) => highlight.includes('Elena -> Eliana'))
    ).toBe(true);
  });

  it('infers alias mismatches between repeated near-match names', () => {
    const chapters: ManuscriptHealthChapterInput[] = [
      {
        id: 'chapter-1',
        summary: 'Eliana briefs the launch crew before dawn.',
        word_count: 860,
        updated_at: '2026-04-08T09:00:00.000Z',
      },
      {
        id: 'chapter-2',
        summary: 'Elena checks telemetry for anomalies.',
        word_count: 910,
        updated_at: '2026-04-08T09:00:00.000Z',
      },
      {
        id: 'chapter-3',
        summary: 'Eliana confirms launch readiness with mission control.',
        word_count: 920,
        updated_at: '2026-04-08T09:00:00.000Z',
      },
    ];

    const report = buildManuscriptHealthReport(chapters, {}, REFERENCE_DATE);

    expect(getIssueCount(report, 'character-alias-mismatch')).toBe(1);
    expect(
      report.issues
        .find((issue) => issue.id === 'character-alias-mismatch')
        ?.highlights?.some((highlight) => highlight.includes('Elena -> Eliana'))
    ).toBe(true);
  });
});
