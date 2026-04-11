import React from 'react';
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
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../../../../lib/api';
import { queryKeys } from '../../../../../lib/react-query';

export default function ChaptersListScreen() {
  const { id: bookId } = useLocalSearchParams<{ id: string }>();

  const {
    data: chapters = [],
    isLoading,
    isRefetching,
    refetch,
    error,
  } = useQuery({
    queryKey: queryKeys.chaptersForBook(bookId || ''),
    queryFn: () => api.getChapters(bookId || '', { limit: 100 }),
    enabled: !!bookId,
  });

  const handleChapterPress = (chapterId: string) => {
    router.push(`/(main)/books/${bookId}/chapters/${chapterId}/detail`);
  };

  const handleCreateChapter = () => {
    // Navigate to create chapter screen
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
      {error ? (
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
          data={chapters}
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
            chapters.length > 0 ? (
              <TouchableOpacity
                style={styles.addButton}
                onPress={handleCreateChapter}
              >
                <Ionicons name="add-circle" size={24} color="#0369a1" />
                <Text style={styles.addButtonText}>New Chapter</Text>
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
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginBottom: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  addButtonText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#0369a1',
  },
  chapterCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#0369a1',
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
    fontWeight: '700',
    fontSize: 14,
  },
  chapterInfo: {
    flex: 1,
  },
  chapterTitle: {
    fontSize: 16,
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
    color: '#999',
  },
  metaDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#999',
    marginHorizontal: 6,
  },
  chapterDate: {
    marginRight: 8,
  },
  dateText: {
    fontSize: 12,
    color: '#ccc',
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
    marginTop: 16,
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
});
