# Contributing to Scribe House

Thank you for your interest in contributing to Scribe House! This document provides guidelines and instructions for contributing.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for everyone.

## How to Contribute

### Reporting Bugs

1. Check if the bug has already been reported in [Issues](https://github.com/yourusername/ai-book-writer/issues)
2. If not, create a new issue with:
   - Clear title and description
   - Steps to reproduce
   - Expected vs actual behavior
   - Screenshots if applicable
   - Environment details (OS, browser, versions)

### Suggesting Features

1. Check existing [Issues](https://github.com/yourusername/ai-book-writer/issues) and [Discussions](https://github.com/yourusername/ai-book-writer/discussions)
2. Create a new discussion or issue describing:
   - The problem you're trying to solve
   - Your proposed solution
   - Alternative solutions considered
   - Any additional context

### Pull Requests

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make your changes**
   - Follow the code style guidelines
   - Add tests for new features
   - Update documentation as needed

4. **Test your changes**
   ```bash
   # Backend tests
   cd backend
   pytest
   
   # Frontend tests
   cd frontend
   npm test
   ```

5. **Commit your changes**
   ```bash
   git commit -m "feat: add amazing feature"
   ```
   
   Use conventional commits:
   - `feat:` - New feature
   - `fix:` - Bug fix
   - `docs:` - Documentation changes
   - `style:` - Code style changes (formatting, etc.)
   - `refactor:` - Code refactoring
   - `test:` - Adding or updating tests
   - `chore:` - Maintenance tasks

6. **Push to your fork**
   ```bash
   git push origin feature/your-feature-name
   ```

7. **Create a Pull Request**
   - Provide a clear description of changes
   - Reference any related issues
   - Ensure CI checks pass

## Development Setup

See [SETUP.md](docs/SETUP.md) for detailed setup instructions.

Quick start:
```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/ai-book-writer.git
cd ai-book-writer

# Run quick start script
./scripts/quickstart.sh

# Or manually with Docker
cp .env.example .env
# Edit .env with your API keys
docker compose up -d
```

## Code Style

### Python (Backend)

- Follow PEP 8
- Use Black for formatting
- Use isort for import sorting
- Use type hints
- Maximum line length: 100 characters

```bash
# Format code
black .
isort .

# Lint
flake8 .
mypy .
```

### TypeScript/React (Frontend)

- Follow Airbnb style guide
- Use Prettier for formatting
- Use ESLint for linting
- Prefer functional components and hooks

```bash
# Format code
npm run format

# Lint
npm run lint
```

## Testing

### Backend Tests

```bash
cd backend

# Run all tests
pytest

# Run with coverage
pytest --cov=app --cov-report=html

# Run specific test file
pytest tests/test_audio.py

# Run specific test
pytest tests/test_audio.py::test_upload_audio
```

### Frontend Tests

```bash
cd frontend

# Run all tests
npm test

# Run in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage
```

## Documentation

- Update README.md for user-facing changes
- Update relevant docs in `/docs` folder
- Add docstrings to new functions/classes
- Update API documentation for endpoint changes

## Project Structure

```
ai-book-writer/
├── backend/          # Python FastAPI backend
├── frontend/         # Next.js frontend
├── docs/            # Documentation
├── scripts/         # Utility scripts
└── docker/          # Docker configurations
```

## Commit Message Guidelines

Format: `<type>(<scope>): <subject>`

Examples:
- `feat(backend): add event extraction service`
- `fix(frontend): resolve audio player sync issue`
- `docs(api): update authentication endpoints`
- `test(backend): add tests for transcription service`

## Review Process

1. All PRs require at least one review
2. CI checks must pass
3. Code coverage should not decrease
4. Documentation must be updated
5. Maintainers will review within 3-5 business days

## Questions?

- Open a [Discussion](https://github.com/yourusername/ai-book-writer/discussions)
- Join our community chat (if available)
- Email: contribute@aibook.com

Thank you for contributing! 🎉
