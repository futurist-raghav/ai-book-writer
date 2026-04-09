const DEFAULT_QUEUE_SIZE = 5;

function getStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage;
}

export function getOfflineDraftQueueKey(chapterId: string): string {
  return `chapter-offline-drafts-${chapterId}`;
}

export function readOfflineDraftQueue(chapterId: string, storage: Storage | null = getStorage()): string[] {
  if (!storage) {
    return [];
  }

  try {
    const raw = storage.getItem(getOfflineDraftQueueKey(chapterId));
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((item): item is string => typeof item === 'string');
  } catch {
    return [];
  }
}

export function writeOfflineDraftQueue(
  chapterId: string,
  drafts: string[],
  storage: Storage | null = getStorage()
): string[] {
  if (!storage) {
    return [];
  }

  const sanitizedDrafts = drafts.filter((item): item is string => typeof item === 'string');

  try {
    storage.setItem(getOfflineDraftQueueKey(chapterId), JSON.stringify(sanitizedDrafts));
  } catch {
    return [];
  }

  return sanitizedDrafts;
}

export function enqueueOfflineDraft(
  chapterId: string,
  draftHtml: string,
  storage: Storage | null = getStorage(),
  maxQueueSize = DEFAULT_QUEUE_SIZE
): string[] {
  const existing = readOfflineDraftQueue(chapterId, storage);
  const withNew = existing[existing.length - 1] === draftHtml ? existing : [...existing, draftHtml];
  const bounded = withNew.slice(-Math.max(1, maxQueueSize));
  return writeOfflineDraftQueue(chapterId, bounded, storage);
}

export function getLatestOfflineDraft(
  chapterId: string,
  storage: Storage | null = getStorage()
): string | null {
  const queue = readOfflineDraftQueue(chapterId, storage);
  return queue.length > 0 ? queue[queue.length - 1] : null;
}

export function clearOfflineDraftQueue(chapterId: string, storage: Storage | null = getStorage()): void {
  if (!storage) {
    return;
  }

  try {
    storage.removeItem(getOfflineDraftQueueKey(chapterId));
  } catch {
    // Ignore quota/security errors when storage is unavailable.
  }
}
