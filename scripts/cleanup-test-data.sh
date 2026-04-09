#!/bin/bash
# P0.1 Cleanup: Remove test data from database
# This script removes placeholder test data created during development

set -e

echo "🧹 AI Book Writer - Test Data Cleanup"
echo "===================================="
echo ""

# Check if Docker is running
if ! docker ps > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Check if postgres container exists and is running
if ! docker compose ps | grep -q postgres; then
    echo "❌ PostgreSQL container is not running."
    echo "Starting containers..."
    docker compose up -d postgres
    sleep 3
fi

echo "📝 Executing cleanup queries..."
echo ""

# Remove test data from books where project_context contains junk
echo "1️⃣  Cleaning project_context with 'bvcxd nkjhgfc'..."
docker compose exec -T postgres psql -U ai_book_writer -d ai_book_writer_db -c \
  "UPDATE books SET project_context = NULL WHERE project_context LIKE '%bvcxd%' OR project_context LIKE '%nkjhgfc%';" 2>/dev/null || \
  echo "   ⚠️  Could not update books (table may not exist yet)"

# Remove test books with generic descriptions
echo "2️⃣  Removing books with test descriptions..."
docker compose exec -T postgres psql -U ai_book_writer -d ai_book_writer_db -c \
  "DELETE FROM books WHERE description = 'A test book for testing' AND title = 'Test Book';" 2>/dev/null || \
  echo "   ⚠️  Could not delete books (table may not exist yet)"

# Clean up any books with obviously placeholder titles
echo "3️⃣  Checking for other placeholder books..."
PLACEHOLDER_COUNT=$(docker compose exec -T postgres psql -U ai_book_writer -d ai_book_writer_db -t -c \
  "SELECT COUNT(*) FROM books WHERE title ILIKE '%test%' OR title ILIKE '%placeholder%' OR title ILIKE '%temp%';" 2>/dev/null || echo "0")

if [ "$PLACEHOLDER_COUNT" -gt 0 ]; then
    echo "   Found $PLACEHOLDER_COUNT placeholder books. Review these manually:"
    docker compose exec -T postgres psql -U ai_book_writer -d ai_book_writer_db -c \
      "SELECT id, title, description FROM books WHERE title ILIKE '%test%' OR title ILIKE '%placeholder%' OR title ILIKE '%temp%';" 2>/dev/null
else
    echo "   ✅ No obvious placeholder books found"
fi

echo ""
echo "✅ Cleanup complete!"
echo ""
echo "Optional: To completely reset the database:"
echo "  docker compose down && docker volume rm ai-book-writer_postgres_data && docker compose up -d"
