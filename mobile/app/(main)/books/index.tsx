import React from 'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
  Image,
  SafeAreaView,
} from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../../lib/api';
import { queryKeys } from '../../../lib/react-query';

export default function BooksScreen() {
  const {
    data: books = [],
    isLoading,
    isRefetching,
    refetch,
    error,
  } = useQuery({
    queryKey: queryKeys.booksAll(),
    queryFn: () => api.getBooks({ limit: 50 }),
  });

  const handleBookPress = (bookId: string) => {
    router.push(`/(main)/books/${bookId}/chapters`);
  };

  const handleCreateBook = () => {
    router.push('/(main)/writing');
  };

  const renderBook = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.bookCard}
      onPress={() => handleBookPress(item.id)}
      activeOpacity={0.7}
    >
      <View style={styles.bookCover}>
        {item.cover_url ? (
          <Image source={{ uri: item.cover_url }} style={styles.coverImage} />
        ) : (
          <View style={styles.coverPlaceholder}>
            <Ionicons name="book" size={40} color="#ccc" />
          </View>
        )}
      </View>

      <View style={styles.bookInfo}>
        <Text style={styles.bookTitle} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={styles.bookAuthor} numberOfLines={1}>
          by {item.author?.display_name || 'Unknown'}
        </Text>
        <Text style={styles.bookStatus}>{item.status}</Text>
        <Text style={styles.bookMeta}>
          {item.chapter_count || 0} chapters • {item.word_count || 0} words
        </Text>
      </View>

      <View style={styles.bookProgress}>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${Math.round((item.completion || 0) * 100)}%` },
            ]}
          />
        </View>
        <Text style={styles.progressText}>{Math.round((item.completion || 0) * 100)}%</Text>
      </View>
    </TouchableOpacity>
  );

  const emptyComponent = (
    <View style={styles.emptyContainer}>
      <Ionicons name="book-outline" size={60} color="#ccc" />
      <Text style={styles.emptyTitle}>No Books Yet</Text>
      <Text style={styles.emptyText}>Create your first book to get started</Text>
      <TouchableOpacity style={styles.createButton} onPress={handleCreateBook}>
        <Ionicons name="add" size={20} color="#fff" />
        <Text style={styles.createButtonText}>Create Book</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Failed to load books</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => refetch()}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={books}
          renderItem={renderBook}
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
            books.length > 0 ? (
              <TouchableOpacity
                style={styles.createBookButton}
                onPress={handleCreateBook}
              >
                <Ionicons name="add-circle" size={24} color="#0369a1" />
                <Text style={styles.createBookButtonText}>New Book</Text>
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
    padding: 16,
    paddingBottom: 32,
  },
  createBookButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginBottom: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  createBookButtonText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#0369a1',
  },
  bookCard: {
    marginBottom: 16,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#eee',
    overflow: 'hidden',
  },
  bookCover: {
    width: '100%',
    height: 180,
    backgroundColor: '#f5f5f5',
  },
  coverImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  coverPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  bookInfo: {
    padding: 12,
  },
  bookTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
    marginBottom: 4,
  },
  bookAuthor: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  bookStatus: {
    fontSize: 12,
    color: '#0369a1',
    fontWeight: '600',
    textTransform: 'capitalize',
    marginBottom: 4,
  },
  bookMeta: {
    fontSize: 12,
    color: '#999',
  },
  bookProgress: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#eee',
    borderRadius: 3,
    marginBottom: 6,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#0369a1',
  },
  progressText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'right',
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
});
