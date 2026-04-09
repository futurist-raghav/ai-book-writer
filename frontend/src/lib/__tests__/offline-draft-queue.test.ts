import {
  clearOfflineDraftQueue,
  enqueueOfflineDraft,
  getLatestOfflineDraft,
  getOfflineDraftQueueKey,
  readOfflineDraftQueue,
  writeOfflineDraftQueue,
} from '@/lib/offline-draft-queue';

describe('offline draft queue utility', () => {
  const chapterId = 'chapter-123';

  beforeEach(() => {
    window.localStorage.clear();
  });

  it('reads as empty queue when storage key is missing', () => {
    expect(readOfflineDraftQueue(chapterId)).toEqual([]);
  });

  it('writes and reads queue entries', () => {
    const drafts = ['<p>one</p>', '<p>two</p>'];
    writeOfflineDraftQueue(chapterId, drafts);

    expect(readOfflineDraftQueue(chapterId)).toEqual(drafts);
  });

  it('deduplicates only consecutive duplicate drafts when enqueuing', () => {
    enqueueOfflineDraft(chapterId, '<p>one</p>');
    enqueueOfflineDraft(chapterId, '<p>one</p>');
    enqueueOfflineDraft(chapterId, '<p>two</p>');
    enqueueOfflineDraft(chapterId, '<p>one</p>');

    expect(readOfflineDraftQueue(chapterId)).toEqual(['<p>one</p>', '<p>two</p>', '<p>one</p>']);
  });

  it('keeps queue bounded to configured size', () => {
    enqueueOfflineDraft(chapterId, 'a', window.localStorage, 3);
    enqueueOfflineDraft(chapterId, 'b', window.localStorage, 3);
    enqueueOfflineDraft(chapterId, 'c', window.localStorage, 3);
    enqueueOfflineDraft(chapterId, 'd', window.localStorage, 3);

    expect(readOfflineDraftQueue(chapterId)).toEqual(['b', 'c', 'd']);
  });

  it('returns latest queued draft and clears queue', () => {
    enqueueOfflineDraft(chapterId, '<p>first</p>');
    enqueueOfflineDraft(chapterId, '<p>latest</p>');

    expect(getLatestOfflineDraft(chapterId)).toBe('<p>latest</p>');

    clearOfflineDraftQueue(chapterId);

    expect(readOfflineDraftQueue(chapterId)).toEqual([]);
    expect(window.localStorage.getItem(getOfflineDraftQueueKey(chapterId))).toBeNull();
  });

  it('gracefully handles malformed JSON', () => {
    window.localStorage.setItem(getOfflineDraftQueueKey(chapterId), '{bad-json');

    expect(readOfflineDraftQueue(chapterId)).toEqual([]);
  });
});
