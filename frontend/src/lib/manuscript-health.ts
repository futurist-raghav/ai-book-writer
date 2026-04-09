export type ManuscriptHealthStatus = 'healthy' | 'watch' | 'at-risk';
export type ManuscriptHealthIssueId =
  | 'missing-summary'
  | 'stale-chapter'
  | 'thin-chapter'
  | 'character-alias-mismatch'
  | 'undefined-character-reference'
  | 'orphaned-section'
  | 'pacing-outlier';
export type ManuscriptHealthIssueSeverity = 'high' | 'medium' | 'low';

export interface ManuscriptHealthChapterInput {
  id: string;
  title?: string | null;
  summary?: string | null;
  description?: string | null;
  compiled_content?: string | null;
  word_count?: number | null;
  chapter_type?: string | null;
  workflow_status?: string | null;
  pov_character?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
}

export interface ManuscriptHealthIssue {
  id: ManuscriptHealthIssueId;
  severity: ManuscriptHealthIssueSeverity;
  label: string;
  description: string;
  count: number;
  chapterIds: string[];
  highlights?: string[];
}

export interface ManuscriptHealthOptions {
  staleDays?: number;
  thinChapterWordCount?: number;
  knownEntityNames?: string[];
  undefinedCharacterMinChapterMentions?: number;
  orphanedSectionWordCount?: number;
  pacingOutlierMultiplier?: number;
  aliasSimilarityThreshold?: number;
  aliasMaxEditDistance?: number;
}

export interface ManuscriptHealthReport {
  score: number;
  status: ManuscriptHealthStatus;
  totalChapters: number;
  issueCount: number;
  issues: ManuscriptHealthIssue[];
  recommendations: string[];
  checkedAt: string;
}

const DEFAULT_STALE_DAYS = 21;
const DEFAULT_THIN_CHAPTER_WORD_COUNT = 300;
const DEFAULT_UNDEFINED_CHARACTER_MIN_CHAPTER_MENTIONS = 2;
const DEFAULT_ORPHANED_SECTION_WORD_COUNT = 80;
const DEFAULT_PACING_OUTLIER_MULTIPLIER = 3;
const DEFAULT_ALIAS_SIMILARITY_THRESHOLD = 0.72;
const DEFAULT_ALIAS_MAX_EDIT_DISTANCE = 2;

const SECTION_LIKE_CHAPTER_TYPES = new Set(['scene', 'section', 'module']);
const COMMON_PROPER_NOUN_WORDS = new Set([
  'The',
  'A',
  'An',
  'And',
  'But',
  'Or',
  'If',
  'Then',
  'When',
  'After',
  'Before',
  'Today',
  'Tomorrow',
  'Yesterday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
  'Chapter',
  'Part',
  'Section',
  'Scene',
  'Later',
  'Meanwhile',
  'Finally',
  'Suddenly',
  'First',
  'Second',
  'Third',
  'Next',
]);

function isBlank(value: string | null | undefined): boolean {
  return !value || value.trim().length === 0;
}

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z\s'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toValidDate(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  const candidate = new Date(value);
  return Number.isFinite(candidate.getTime()) ? candidate : null;
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function levenshteinDistance(a: string, b: string): number {
  if (a === b) {
    return 0;
  }

  if (a.length === 0) {
    return b.length;
  }

  if (b.length === 0) {
    return a.length;
  }

  const previousRow: number[] = [];
  for (let index = 0; index <= b.length; index += 1) {
    previousRow[index] = index;
  }

  for (let row = 1; row <= a.length; row += 1) {
    const currentRow: number[] = [row];

    for (let column = 1; column <= b.length; column += 1) {
      const insertion = currentRow[column - 1] + 1;
      const deletion = previousRow[column] + 1;
      const substitution = previousRow[column - 1] + (a[row - 1] === b[column - 1] ? 0 : 1);
      currentRow[column] = Math.min(insertion, deletion, substitution);
    }

    for (let column = 0; column <= b.length; column += 1) {
      previousRow[column] = currentRow[column];
    }
  }

  return previousRow[b.length];
}

function calculateAliasSimilarity(a: string, b: string): number {
  const compactA = a.replace(/\s+/g, '');
  const compactB = b.replace(/\s+/g, '');

  if (!compactA || !compactB) {
    return 0;
  }

  const distance = levenshteinDistance(compactA, compactB);
  return 1 - distance / Math.max(compactA.length, compactB.length);
}

function isLikelyAliasVariant(
  candidateName: string,
  referenceName: string,
  aliasSimilarityThreshold: number,
  aliasMaxEditDistance: number
): boolean {
  const compactCandidate = candidateName.replace(/\s+/g, '');
  const compactReference = referenceName.replace(/\s+/g, '');

  if (!compactCandidate || !compactReference || compactCandidate === compactReference) {
    return false;
  }

  if (compactCandidate.length < 4 || compactReference.length < 4) {
    return false;
  }

  if (compactCandidate[0] !== compactReference[0]) {
    return false;
  }

  const distance = levenshteinDistance(compactCandidate, compactReference);
  const similarity = calculateAliasSimilarity(compactCandidate, compactReference);

  if (distance <= aliasMaxEditDistance && Math.abs(compactCandidate.length - compactReference.length) <= 3) {
    return true;
  }

  return similarity >= aliasSimilarityThreshold;
}

function calculateMedian(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }

  return sorted[middle];
}

function isLikelyNameCandidate(value: string): boolean {
  const normalized = normalizeName(value);
  if (!normalized) {
    return false;
  }

  const rawParts = value.split(/\s+/).filter(Boolean);
  if (rawParts.length === 0 || rawParts.length > 3) {
    return false;
  }

  return rawParts.every((part) => {
    if (COMMON_PROPER_NOUN_WORDS.has(part)) {
      return false;
    }

    return /^[A-Z][a-z'-]{1,}$/.test(part);
  });
}

function extractNameCandidates(text: string): string[] {
  const matches = text.match(/\b[A-Z][a-z'-]+(?:\s+[A-Z][a-z'-]+){0,2}\b/g) || [];
  return matches.filter(isLikelyNameCandidate);
}

function findClosestKnownName(
  candidateNormalized: string,
  knownEntityNormalizedNames: string[],
  knownEntityDisplayByNormalized: Map<string, string>,
  aliasSimilarityThreshold: number,
  aliasMaxEditDistance: number
): { knownName: string; distance: number; similarity: number } | null {
  const normalizedCandidate = candidateNormalized.replace(/\s+/g, ' ').trim();
  if (!normalizedCandidate || normalizedCandidate.length < 4) {
    return null;
  }

  const candidateTokens = normalizedCandidate.split(' ').length;
  let bestMatch: { knownName: string; distance: number; similarity: number } | null = null;

  for (const knownNormalized of knownEntityNormalizedNames) {
    if (!knownNormalized || knownNormalized === normalizedCandidate || knownNormalized.length < 4) {
      continue;
    }

    const knownTokens = knownNormalized.split(' ').length;
    if (knownTokens !== candidateTokens) {
      continue;
    }

    if (
      !isLikelyAliasVariant(
        normalizedCandidate,
        knownNormalized,
        aliasSimilarityThreshold,
        aliasMaxEditDistance
      )
    ) {
      continue;
    }

    const distance = levenshteinDistance(normalizedCandidate, knownNormalized);
    const similarity = calculateAliasSimilarity(normalizedCandidate, knownNormalized);

    if (
      !bestMatch ||
      similarity > bestMatch.similarity ||
      (similarity === bestMatch.similarity && distance < bestMatch.distance)
    ) {
      bestMatch = {
        knownName: knownEntityDisplayByNormalized.get(knownNormalized) || knownNormalized,
        distance,
        similarity,
      };
    }
  }

  return bestMatch;
}

function isLikelyOrphanedSection(
  chapter: ManuscriptHealthChapterInput,
  chapterWordCount: number,
  orphanedSectionWordCount: number
): boolean {
  const chapterType = String(chapter.chapter_type || '').toLowerCase().trim();
  if (!SECTION_LIKE_CHAPTER_TYPES.has(chapterType)) {
    return false;
  }

  const noSummary = isBlank(chapter.summary);
  const noDescription = isBlank(chapter.description);
  const noCompiledContent = isBlank(chapter.compiled_content);

  return chapterWordCount <= orphanedSectionWordCount && noSummary && noDescription && noCompiledContent;
}

function toSeverityRank(value: ManuscriptHealthIssueSeverity): number {
  if (value === 'high') {
    return 0;
  }
  if (value === 'medium') {
    return 1;
  }
  return 2;
}

function buildRecommendations(issues: ManuscriptHealthIssue[]): string[] {
  const recommendations: string[] = [];

  const issueById = new Map(issues.map((issue) => [issue.id, issue]));

  const missingSummary = issueById.get('missing-summary');
  if (missingSummary) {
    recommendations.push(
      `Prioritize summaries for ${missingSummary.count} chapter${missingSummary.count === 1 ? '' : 's'} to improve scanning and handoff quality.`
    );
  }

  const aliasMismatch = issueById.get('character-alias-mismatch');
  if (aliasMismatch) {
    const sampleAlias = aliasMismatch.highlights?.[0];
    recommendations.push(
      sampleAlias
        ? `Resolve likely name mismatches such as ${sampleAlias} to keep entity references consistent.`
        : 'Resolve likely character-name spelling mismatches to improve continuity.'
    );
  }

  const pacingOutlier = issueById.get('pacing-outlier');
  if (pacingOutlier) {
    recommendations.push(
      'Normalize pacing by balancing chapter lengths so outliers do not break narrative rhythm.'
    );
  }

  const undefinedCharacter = issueById.get('undefined-character-reference');
  if (undefinedCharacter && recommendations.length < 3) {
    recommendations.push(
      'Define newly mentioned characters in project entities or rename them for consistency.'
    );
  }

  const orphanedSection = issueById.get('orphaned-section');
  if (orphanedSection) {
    recommendations.push(
      'Resolve orphaned sections by either connecting them to active drafts or archiving placeholders.'
    );
  }

  const staleChapter = issueById.get('stale-chapter');
  if (staleChapter && recommendations.length < 3) {
    recommendations.push(
      `Schedule a freshness pass for ${staleChapter.count} stale chapter${staleChapter.count === 1 ? '' : 's'} to reduce continuity drift.`
    );
  }

  if (recommendations.length === 0) {
    recommendations.push('No critical issues detected. Keep summaries and chapter cadence up to date.');
  }

  return recommendations.slice(0, 3);
}

function computeStatus(score: number): ManuscriptHealthStatus {
  if (score >= 85) {
    return 'healthy';
  }
  if (score >= 60) {
    return 'watch';
  }
  return 'at-risk';
}

export function buildManuscriptHealthReport(
  chapters: ManuscriptHealthChapterInput[],
  options: ManuscriptHealthOptions = {},
  referenceDate: Date = new Date()
): ManuscriptHealthReport {
  const staleDays = options.staleDays ?? DEFAULT_STALE_DAYS;
  const thinChapterWordCount = options.thinChapterWordCount ?? DEFAULT_THIN_CHAPTER_WORD_COUNT;
  const undefinedCharacterMinChapterMentions =
    options.undefinedCharacterMinChapterMentions ?? DEFAULT_UNDEFINED_CHARACTER_MIN_CHAPTER_MENTIONS;
  const orphanedSectionWordCount =
    options.orphanedSectionWordCount ?? DEFAULT_ORPHANED_SECTION_WORD_COUNT;
  const pacingOutlierMultiplier = Math.max(
    1.5,
    options.pacingOutlierMultiplier ?? DEFAULT_PACING_OUTLIER_MULTIPLIER
  );
  const aliasSimilarityThreshold =
    options.aliasSimilarityThreshold ?? DEFAULT_ALIAS_SIMILARITY_THRESHOLD;
  const aliasMaxEditDistance =
    options.aliasMaxEditDistance ?? DEFAULT_ALIAS_MAX_EDIT_DISTANCE;
  const staleThresholdMs = staleDays * 24 * 60 * 60 * 1000;

  const missingSummaryChapterIds: string[] = [];
  const staleChapterIds: string[] = [];
  const thinChapterIds: string[] = [];
  const orphanedSectionChapterIds: string[] = [];

  const chapterIds: string[] = [];
  const chapterTitlesById = new Map<string, string>();

  const knownEntityNames = new Set<string>();
  const knownEntityDisplayByNormalized = new Map<string, string>();
  for (const name of options.knownEntityNames || []) {
    const displayName = String(name || '').trim();
    const normalized = normalizeName(displayName);
    if (!normalized) {
      continue;
    }

    knownEntityNames.add(normalized);
    knownEntityDisplayByNormalized.set(normalized, displayName || normalized);
    const firstName = normalized.split(' ')[0];
    const displayFirstName = displayName.split(/\s+/)[0] || firstName;
    if (firstName) {
      knownEntityNames.add(firstName);
      knownEntityDisplayByNormalized.set(firstName, displayFirstName);
    }
  }

  const possibleUndefinedNameMentions = new Map<string, { displayName: string; chapterIds: Set<string> }>();
  const chapterWordCounts: Array<{ id: string; title: string; wordCount: number }> = [];

  for (const chapter of chapters ?? []) {
    const chapterId = String(chapter?.id || '').trim();
    if (!chapterId) {
      continue;
    }

    const chapterTitle = String(chapter?.title || '').trim() || 'Untitled chapter';
    chapterIds.push(chapterId);
    chapterTitlesById.set(chapterId, chapterTitle);

    const chapterPovCharacter = normalizeName(chapter.pov_character || '');
    const chapterPovDisplayName = String(chapter.pov_character || '').trim();
    if (chapterPovCharacter) {
      knownEntityNames.add(chapterPovCharacter);
      knownEntityDisplayByNormalized.set(chapterPovCharacter, chapterPovDisplayName || chapterPovCharacter);
      const firstName = chapterPovCharacter.split(' ')[0];
      const displayFirstName = chapterPovDisplayName.split(/\s+/)[0] || firstName;
      if (firstName) {
        knownEntityNames.add(firstName);
        knownEntityDisplayByNormalized.set(firstName, displayFirstName);
      }
    }

    if (isBlank(chapter.summary)) {
      missingSummaryChapterIds.push(chapterId);
    }

    const chapterWordCount = Number(chapter.word_count ?? 0);
    if (Number.isFinite(chapterWordCount) && chapterWordCount < thinChapterWordCount) {
      thinChapterIds.push(chapterId);
    }

    if (Number.isFinite(chapterWordCount) && chapterWordCount > 0) {
      chapterWordCounts.push({ id: chapterId, title: chapterTitle, wordCount: chapterWordCount });
    }

    if (Number.isFinite(chapterWordCount) && isLikelyOrphanedSection(chapter, chapterWordCount, orphanedSectionWordCount)) {
      orphanedSectionChapterIds.push(chapterId);
    }

    const lastEditedAt = toValidDate(chapter.updated_at ?? chapter.created_at);
    if (lastEditedAt) {
      const ageMs = referenceDate.getTime() - lastEditedAt.getTime();
      if (ageMs > staleThresholdMs) {
        staleChapterIds.push(chapterId);
      }
    }

    const characterSourceText = [chapter.summary, chapter.description, chapter.compiled_content]
      .filter((value): value is string => !isBlank(value))
      .join(' ');

    if (!isBlank(characterSourceText)) {
      const chapterCandidates = new Set<string>();

      for (const candidate of extractNameCandidates(characterSourceText)) {
        const normalizedCandidate = normalizeName(candidate);
        if (!normalizedCandidate || knownEntityNames.has(normalizedCandidate)) {
          continue;
        }

        chapterCandidates.add(candidate);
      }

      for (const candidate of chapterCandidates) {
        const normalizedCandidate = normalizeName(candidate);
        const existing = possibleUndefinedNameMentions.get(normalizedCandidate);

        if (existing) {
          existing.chapterIds.add(chapterId);
          continue;
        }

        possibleUndefinedNameMentions.set(normalizedCandidate, {
          displayName: candidate,
          chapterIds: new Set<string>([chapterId]),
        });
      }
    }
  }

  const knownEntityNormalizedNames = [...knownEntityNames];

  const allUnknownNameCandidates = [...possibleUndefinedNameMentions.entries()]
    .map(([normalizedName, mentionData]) => {
      const closestKnownName = findClosestKnownName(
        normalizedName,
        knownEntityNormalizedNames,
        knownEntityDisplayByNormalized,
        aliasSimilarityThreshold,
        aliasMaxEditDistance
      );

      return {
        normalizedName,
        name: mentionData.displayName,
        chapterIds: [...mentionData.chapterIds],
        chapterCount: mentionData.chapterIds.size,
        possibleMismatch: closestKnownName ? `${mentionData.displayName} -> ${closestKnownName.knownName}` : null,
        mismatchDistance: closestKnownName?.distance ?? null,
      };
    });

  const aliasMismatchCandidates = allUnknownNameCandidates
    .filter((candidate) => Boolean(candidate.possibleMismatch))
    .sort(
      (a, b) =>
        (a.mismatchDistance ?? 99) - (b.mismatchDistance ?? 99) ||
        b.chapterCount - a.chapterCount ||
        a.name.localeCompare(b.name)
    );

  const inferredAliasMismatchCandidates = allUnknownNameCandidates
    .filter((candidate) => !candidate.possibleMismatch)
    .sort((a, b) => b.chapterCount - a.chapterCount || a.name.localeCompare(b.name));

  const inferredAliasMismatchMap = new Map<
    string,
    { possibleMismatch: string; chapterIds: string[]; mismatchDistance: number }
  >();

  for (let index = 0; index < inferredAliasMismatchCandidates.length; index += 1) {
    const firstCandidate = inferredAliasMismatchCandidates[index];

    for (
      let comparisonIndex = index + 1;
      comparisonIndex < inferredAliasMismatchCandidates.length;
      comparisonIndex += 1
    ) {
      const secondCandidate = inferredAliasMismatchCandidates[comparisonIndex];

      if (
        !isLikelyAliasVariant(
          firstCandidate.normalizedName,
          secondCandidate.normalizedName,
          aliasSimilarityThreshold,
          aliasMaxEditDistance
        )
      ) {
        continue;
      }

      const canonicalCandidate =
        firstCandidate.chapterCount > secondCandidate.chapterCount
          ? firstCandidate
          : firstCandidate.chapterCount < secondCandidate.chapterCount
            ? secondCandidate
            : firstCandidate.name.localeCompare(secondCandidate.name) <= 0
              ? firstCandidate
              : secondCandidate;
      const variantCandidate = canonicalCandidate === firstCandidate ? secondCandidate : firstCandidate;

      const pairKey = `${variantCandidate.normalizedName}|${canonicalCandidate.normalizedName}`;
      if (inferredAliasMismatchMap.has(pairKey)) {
        continue;
      }

      inferredAliasMismatchMap.set(pairKey, {
        possibleMismatch: `${variantCandidate.name} -> ${canonicalCandidate.name}`,
        chapterIds: variantCandidate.chapterIds,
        mismatchDistance: levenshteinDistance(
          variantCandidate.normalizedName,
          canonicalCandidate.normalizedName
        ),
      });
    }
  }

  const mergedAliasMismatchCandidates = [...aliasMismatchCandidates];
  inferredAliasMismatchMap.forEach((candidate) => {
    mergedAliasMismatchCandidates.push({
      normalizedName: candidate.possibleMismatch.toLowerCase(),
      name: candidate.possibleMismatch,
      chapterIds: candidate.chapterIds,
      chapterCount: new Set(candidate.chapterIds).size,
      possibleMismatch: candidate.possibleMismatch,
      mismatchDistance: candidate.mismatchDistance,
    });
  });

  mergedAliasMismatchCandidates.sort(
    (a, b) =>
      (a.mismatchDistance ?? 99) - (b.mismatchDistance ?? 99) ||
      b.chapterCount - a.chapterCount ||
      a.name.localeCompare(b.name)
  );

  const aliasMismatchChapterIds = Array.from(
    new Set(mergedAliasMismatchCandidates.flatMap((candidate) => candidate.chapterIds))
  );

  const undefinedCharacterCandidates = allUnknownNameCandidates
    .filter(
      (candidate) =>
        !candidate.possibleMismatch && candidate.chapterCount >= undefinedCharacterMinChapterMentions
    )
    .sort((a, b) => b.chapterCount - a.chapterCount || a.name.localeCompare(b.name));

  const undefinedCharacterChapterIds = Array.from(
    new Set(undefinedCharacterCandidates.flatMap((candidate) => candidate.chapterIds))
  );

  let pacingOutlierChapterIds: string[] = [];
  let pacingHighlights: string[] = [];
  let medianWordCount = 0;
  let pacingUpperBound = 0;
  let pacingLowerBound = 0;

  if (chapterWordCounts.length >= 3) {
    medianWordCount = calculateMedian(chapterWordCounts.map((entry) => entry.wordCount));
    pacingUpperBound = Math.round(medianWordCount * pacingOutlierMultiplier);
    pacingLowerBound = Math.max(50, Math.round(medianWordCount / pacingOutlierMultiplier));

    const pacingOutliers = chapterWordCounts.filter(
      (entry) => entry.wordCount > pacingUpperBound || entry.wordCount < pacingLowerBound
    );

    pacingOutlierChapterIds = pacingOutliers.map((entry) => entry.id);
    pacingHighlights = pacingOutliers
      .sort((a, b) => Math.abs(b.wordCount - medianWordCount) - Math.abs(a.wordCount - medianWordCount))
      .slice(0, 3)
      .map((entry) => `${entry.title} (${entry.wordCount.toLocaleString()} words)`);
  }

  const issues: ManuscriptHealthIssue[] = [];

  if (missingSummaryChapterIds.length > 0) {
    issues.push({
      id: 'missing-summary',
      severity: 'high',
      label: 'Missing Summaries',
      description: 'Chapters without summaries are harder to scan during edits and handoffs.',
      count: missingSummaryChapterIds.length,
      chapterIds: missingSummaryChapterIds,
      highlights: missingSummaryChapterIds
        .slice(0, 3)
        .map((chapterId) => chapterTitlesById.get(chapterId) || chapterId),
    });
  }

  if (staleChapterIds.length > 0) {
    issues.push({
      id: 'stale-chapter',
      severity: 'medium',
      label: 'Stale Chapters',
      description: `Chapters untouched for ${staleDays}+ days may need a freshness pass.`,
      count: staleChapterIds.length,
      chapterIds: staleChapterIds,
      highlights: staleChapterIds
        .slice(0, 3)
        .map((chapterId) => chapterTitlesById.get(chapterId) || chapterId),
    });
  }

  if (thinChapterIds.length > 0) {
    issues.push({
      id: 'thin-chapter',
      severity: 'low',
      label: 'Thin Chapters',
      description: `Chapters under ${thinChapterWordCount} words may need expansion.`,
      count: thinChapterIds.length,
      chapterIds: thinChapterIds,
      highlights: thinChapterIds
        .slice(0, 3)
        .map((chapterId) => chapterTitlesById.get(chapterId) || chapterId),
    });
  }

  if (aliasMismatchChapterIds.length > 0) {
    issues.push({
      id: 'character-alias-mismatch',
      severity: 'high',
      label: 'Character Alias Mismatches',
      description:
        'Name variants look similar to known entities or repeated character names and may indicate continuity-breaking spelling drift.',
      count: aliasMismatchChapterIds.length,
      chapterIds: aliasMismatchChapterIds,
      highlights: mergedAliasMismatchCandidates
        .slice(0, 4)
        .map((candidate) => candidate.possibleMismatch as string),
    });
  }

  if (undefinedCharacterChapterIds.length > 0) {
    issues.push({
      id: 'undefined-character-reference',
      severity: 'high',
      label: 'Undefined Character References',
      description:
        'Potential character names appear in chapter text but are not defined in project entities.',
      count: undefinedCharacterChapterIds.length,
      chapterIds: undefinedCharacterChapterIds,
      highlights: undefinedCharacterCandidates.slice(0, 4).map((candidate) => candidate.name),
    });
  }

  if (orphanedSectionChapterIds.length > 0) {
    issues.push({
      id: 'orphaned-section',
      severity: 'medium',
      label: 'Orphaned Sections',
      description:
        'Section-level chapters with almost no content and no summary look disconnected from active drafts.',
      count: orphanedSectionChapterIds.length,
      chapterIds: orphanedSectionChapterIds,
      highlights: orphanedSectionChapterIds
        .slice(0, 3)
        .map((chapterId) => chapterTitlesById.get(chapterId) || chapterId),
    });
  }

  if (pacingOutlierChapterIds.length > 0) {
    issues.push({
      id: 'pacing-outlier',
      severity: 'medium',
      label: 'Pacing Outliers',
      description: `Chapter lengths fall outside the pacing range (${pacingLowerBound}-${pacingUpperBound} words, median ${Math.round(
        medianWordCount
      )}).`,
      count: pacingOutlierChapterIds.length,
      chapterIds: pacingOutlierChapterIds,
      highlights: pacingHighlights,
    });
  }

  const scorePenalty =
    missingSummaryChapterIds.length * 8 +
    staleChapterIds.length * 5 +
    thinChapterIds.length * 3 +
    aliasMismatchChapterIds.length * 5 +
    undefinedCharacterChapterIds.length * 6 +
    orphanedSectionChapterIds.length * 4 +
    pacingOutlierChapterIds.length * 4;

  const score = clampScore(100 - scorePenalty);
  const issueCount = issues.reduce((total, issue) => total + issue.count, 0);
  const sortedIssues = [...issues].sort((a, b) => {
    const severityDelta = toSeverityRank(a.severity) - toSeverityRank(b.severity);
    if (severityDelta !== 0) {
      return severityDelta;
    }
    return b.count - a.count;
  });

  return {
    score,
    status: computeStatus(score),
    totalChapters: chapterIds.length,
    issueCount,
    issues: sortedIssues,
    recommendations: buildRecommendations(sortedIssues),
    checkedAt: referenceDate.toISOString(),
  };
}
