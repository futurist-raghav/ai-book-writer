import React, { useEffect, useState } from 'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  Text,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import { api } from '../../../../../lib/api';
import { queryKeys } from '../../../../../lib/react-query';
import { useDatabase } from '../../../../../lib/database-hooks';
import { useDBStore } from '../../../../../lib/store';

export default function ChaptersListScreen() {
  const { id: bookId } = useLocalSearchParams<{ id: string }>();
  const database = useDBStore((state) => state.database);
  const { getChapters: getLocalChapters, updateOrCreateChapter } = useDatabase(database);
  const [localChapters, setLocalChapters] = useState<any[]>([]);
  const [isOnline, setIsOnline] = useState(true);

  const {
    data: chapters = [],
    isLoading,
    isRefetching,
    refetch,
    error,
  } = useQuery({
    queryKey: queryKeys.chaptersForBook(bookId || ''),
    queryFn: () => api.getChapters(bookId || '', { limit: 100 }),
    enabled: !!bookId && isOnline,
  });

  // Load local chapters
  const loadLocalChapters = async () => {
    try {
      const chs = await getLocalChapters();
      setLocalChapters(chs || []);
    } catch (err) {
      console.error('Failed to load local chapters:', err);
    }
  };

  // Load on focus
  useFocusEffect(
    React.useCallback(() => {
      loadLocalChapters();
    }, [database])
  );

  // Monitor network
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOnline(state.isConnected ?? false);
    });
    return unsubscribe;
  }, []);

  // Sync chapters to local
  useEffect(() => {
    const syncChaptersToLocal = async () => {
      if (chapters.length > 0 && database) {
        try {
          for (const chapter of chapters) {
            await updateOrCreateChapter({
              id: chapter.id,
              book_id: bookId,
              title: chapter.title,
              chapter_number: chapter.chapter_number,
              word_count: chapter.word_count || 0,
              content: chapter.content || '',
              status: chapter.status,
              created_at: chapter.created_at,
              updated_at: chapter.updated_at,
            });
          }
          await loadLocalChapters();
        } catch (err) {
          console.error('Failed to sync chapters:', err);
        }
      }
    };
    syncChaptersToLocal();
  }, [chapters, database, bookId]);

  const displayChapters = isOnline && chapters.length > 0 ? chapters : localChapters;

  const handleChapterPress = (chapterId: string) => {
    router.push(`/(main)/books/${bookId}/chapters/${chapterId}/detail`);
  };

  const handleCreateChapter = () => {
    router.push(`/(main)/books/${bookId}/chapters/new`);
  };

  const renderChapter = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.chapterCard}
      onPress={() => handleChapterPress(item.id)}
      activeOpacity={0.7}
    >
      <View style={styles.chapterNumber}>
        <Text style={styles.chapterNumberText}>
          {item.chapter_number || 0}
        </Text>
      </View>

      <View style={styles.chapterInfo}>
        <Text style={styles.chapterTitle} numberOfLines={2}>
          {item.title}
        </Text>
        <View style={styles.chapterMeta}>
          <Text style={styles.metaText}>
            {item.word_count || 0} words
          </Text>
          <View style={styles.metaDot} />
          <Text style={styles.metaText}>{item.status || 'draft'}</Text>
        </View>
      </View>

      <View style={styles.chapterDate}>
        <Text style={styles.dateText}>
          {item.updated_at
            ? new Date(item.updated_at).toLocaleDateString()
            : 'No date'}
        </Text>
      </View>

      {!isOnline && <Ionicons name="cloud-offline" size={16} color="#f59e0b" />}
      <Ionicons name="chevron-forward" size={20} color="#ccc" />
    </TouchableOpacity>
  );

  const emptyComponent = (
    <View style={styles.emptyContainer}>
      <Ionicons name="document-text-outline" size={60} color="#ccc" />
      <Text style={styles.emptyTitle}>No Chapters Yet</Text>
      <Text style={styles.emptyText}>Create your first chapter to get started</Text>
      <TouchableOpacity
        style={styles.createButton}
        onPress={handleCreateChapter}
      >
        <Ionicons name="add" size={20} color="#fff" />
        <Text style={styles.createButtonText}>New Chapter</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {!isOnline && (
        <View style={styles.offlineBar}>
          <Ionicons name="cloud-offline" size={16} color="#fff" />
          <Text style={styles.offlineText}>You are offline - showing cached data</Text>
        </View>
      )}
      {error && isOnline ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={60} color="#dc2626" />
          <Text style={styles.errorText}>Failed to load chapters</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => refetch()}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={displayChapters}
          renderItem={renderChapter}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => refetch()}
            />
          }
          ListEmptyComponent={!isLoading ? emptyComponent : null}
          ListHeaderComponent={
            displayChapters.length > 0 ? (
              <TouchableOpacity
                style={styles.createChapterButton}
                onPress={handleCreateChapter}
              >
                <Ionicons name="add-circle" size={24} color="#0369a1" />
                <Text style={styles.createChapterButtonText}>New Chapter</Text>
              </TouchableOpacity>
            ) : null
          }
        />
      )}

      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0369a1" />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  offlineBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f59e0b',
  },
  offlineText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
    marginLeft: 8,
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  chapterCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  chapterNumber: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0369a1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  chapterNumberText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  chapterInfo: {
    flex: 1,
  },
  chapterTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  chapterMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 12,
    color: '#666',
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#999',
    marginHorizontal: 6,
  },
  chapterDate: {
    marginRight: 12,
  },
  dateText: {
    fontSize: 12,
    color: '#999',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0369a1',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#dc2626',
    marginBottom: 16,
  },
  retryButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#0369a1',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  createChapterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#f0f9ff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#0369a1',
  },
  createChapterButtonText: {
    color: '#0369a1',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
});
