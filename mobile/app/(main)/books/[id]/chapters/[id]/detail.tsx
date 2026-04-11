import React, { useState } from 'react';
import {
  View,
  ScrollView,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  Share,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../../../lib/api';
import { queryKeys } from '../../../../lib/react-query';

export default function ChapterDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [fontSize, setFontSize] = useState(16);

  const {
    data: chapter,
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.chaptersDetail(id || ''),
    queryFn: () => api.getChapter(id || ''),
    enabled: !!id,
  });

  const handleShare = async () => {
    if (!chapter) return;

    try {
      await Share.share({
        message: `Check out "${chapter.title}" from "${chapter.book?.title}"`,
        url: chapter.url || undefined,
      });
    } catch (err) {
      console.error('Share failed:', err);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0369a1" />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !chapter) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={60} color="#dc2626" />
          <Text style={styles.errorText}>Failed to load chapter</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => router.back()}
          >
            <Text style={styles.retryButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={28} color="#0369a1" />
        </TouchableOpacity>
        <View style={styles.headerTitle}>
          <Text style={styles.chapterNumber}>
            {chapter.chapter_number ? `Chapter ${chapter.chapter_number}` : 'Chapter'}
          </Text>
          <Text style={styles.bookTitle} numberOfLines={1}>
            {chapter.book?.title}
          </Text>
        </View>
        <TouchableOpacity onPress={handleShare}>
          <Ionicons name="share-social" size={24} color="#0369a1" />
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.title, { fontSize: fontSize + 6 }]}>
          {chapter.title}
        </Text>

        <Text style={styles.metadata}>
          {chapter.word_count || 0} words • {chapter.status || 'draft'}
        </Text>

        <View style={styles.divider} />

        <Text style={[styles.body, { fontSize }]}>
          {chapter.content || 'No content available'}
        </Text>
      </ScrollView>

      {/* Font Size Controls */}
      <View style={styles.footer}>
        <TouchableOpacity
          onPress={() => setFontSize(Math.max(12, fontSize - 2))}
          style={styles.fontButton}
        >
          <Ionicons name="remove-circle-outline" size={24} color="#0369a1" />
        </TouchableOpacity>

        <Text style={styles.fontLabel}>{fontSize}pt</Text>

        <TouchableOpacity
          onPress={() => setFontSize(Math.min(24, fontSize + 2))}
          style={styles.fontButton}
        >
          <Ionicons name="add-circle-outline" size={24} color="#0369a1" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    flex: 1,
    marginLeft: 12,
  },
  chapterNumber: {
    fontSize: 12,
    color: '#0369a1',
    fontWeight: '600',
  },
  bookTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginTop: 2,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  title: {
    fontWeight: '700',
    color: '#000',
    marginBottom: 12,
    lineHeight: 28,
  },
  metadata: {
    fontSize: 12,
    color: '#999',
    marginBottom: 16,
  },
  divider: {
    height: 1,
    backgroundColor: '#eee',
    marginBottom: 24,
  },
  body: {
    color: '#333',
    lineHeight: 28,
    marginBottom: 32,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: '#f9f9f9',
  },
  fontButton: {
    padding: 8,
  },
  fontLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    minWidth: 50,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorText: {
    fontSize: 16,
    color: '#dc2626',
    marginTop: 16,
    marginBottom: 24,
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
});
