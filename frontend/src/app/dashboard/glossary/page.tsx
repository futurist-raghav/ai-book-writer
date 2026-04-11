'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { Spinner } from '@/components/ui/spinner';
import { GlossaryExtractor } from '@/components/glossary-extractor';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function GlossaryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bookId = searchParams.get('bookId');
  const [selectedBook, setSelectedBook] = useState<{ id: string; title: string } | null>(null);

  // Fetch projects to show in sidebar
  const { data: books, isLoading: booksLoading } = useQuery({
    queryKey: ['books'],
    queryFn: () => api.get('/books').then((res) => res.data),
  });

  useEffect(() => {
    if (bookId && books?.data) {
      const found = books.data.find((b: any) => b.id === bookId);
      if (found) {
        setSelectedBook({ id: found.id, title: found.title });
      }
    }
  }, [bookId, books]);

  if (booksLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner />
      </div>
    );
  }

  // If no book selected, show book picker
  if (!selectedBook || !bookId) {
    return (
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-3xl font-bold text-primary">Glossary Manager</h1>
          <p className="mt-2 text-on-surface-variant">
            Extract and manage glossary terms for your manuscript
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {books?.data?.length > 0 ? (
            books.data.map((book: any) => (
              <Link
                key={book.id}
                href={`?bookId=${book.id}`}
                className="rounded-lg border border-outline-variant/30 bg-surface-container-lowest p-6 hover:border-outline-variant hover:shadow-sm transition-all"
              >
                {book.cover_image && (
                  <img
                    src={book.cover_image}
                    alt={book.title}
                    className="h-48 w-full object-cover rounded-lg mb-4"
                  />
                )}
                <h3 className="font-semibold text-primary">{book.title}</h3>
                <p className="text-sm text-on-surface-variant mt-1">
                  {book.chapter_count || 0} chapters
                </p>
              </Link>
            ))
          ) : (
            <div className="col-span-full rounded-lg bg-surface-container-lowest p-8 text-center">
              <p className="text-on-surface-variant">No projects yet.</p>
              <Link
                href="/dashboard/books"
                className="mt-4 inline-block text-primary hover:underline"
              >
                Create a project
              </Link>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-primary">Glossary Manager</h1>
          <p className="mt-1 text-on-surface-variant">
            Project: <span className="font-semibold text-primary">{selectedBook.title}</span>
          </p>
        </div>
        <button
          onClick={() => {
            setSelectedBook(null);
            router.push('/dashboard/glossary');
          }}
          className="rounded-lg bg-surface-container-lowest px-4 py-2 text-sm font-medium text-on-surface hover:bg-surface-container transition-colors"
        >
          Change Project
        </button>
      </div>

      {/* Glossary Extractor Component */}
      <GlossaryExtractor
        bookId={bookId}
        onComplete={() => {
          router.push(`/dashboard/glossary?bookId=${bookId}`);
        }}
      />
    </div>
  );
}
