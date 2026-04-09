# Testing Guide

Comprehensive guide to running, writing, and maintaining tests for AI Book Writer.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Frontend Tests](#frontend-tests)
3. [Backend Tests](#backend-tests)
4. [Coverage Reports](#coverage-reports)
5. [Best Practices](#best-practices)
6. [Troubleshooting](#troubleshooting)

---

## Quick Start

### Run All Tests

```bash
# Backend tests
cd backend && pytest

# Frontend tests
cd frontend && npm test

# Coverage reports
cd backend && pytest --cov=app --cov-report=html
cd frontend && npm test -- --coverage
```

### Watch Mode (Development)

```bash
# Backend - watch for changes
cd backend && pytest-watch

# Frontend - watch for changes
cd frontend && npm test -- --watch
```

### Run Specific Test Suite

```bash
# Backend - run only API tests
pytest -m api

# Backend - run only service tests
pytest -m services

# Frontend - run only component tests
npm test -- --testPathPattern=components
```

---

## Frontend Tests

### Structure

```
frontend/
├── jest.config.js                  # Jest configuration
├── jest.setup.js                   # Test environment setup
└── src/
    ├── components/__tests__/
    │   ├── ai-assistant.test.tsx
    │   └── writer-canvas-tiptap.test.tsx
    ├── stores/__tests__/
    │   ├── auth-store.test.ts
    │   ├── book-store.test.ts
    │   └── project-context.test.ts
    └── lib/__tests__/
        └── api-client.test.ts
```

### Running Frontend Tests

```bash
cd frontend

# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run only components
npm test -- --testPathPattern=components

# Generate coverage report
npm test -- --coverage

# Run specific test file
npm test -- auth-store.test.ts

# Run tests matching pattern
npm test -- --testNamePattern="should render"
```

### Writing Frontend Tests

#### Component Test Template

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MyComponent from '@/components/MyComponent'

describe('MyComponent', () => {
  beforeEach(() => {
    // Setup
  })

  afterEach(() => {
    // Cleanup
  })

  describe('Rendering', () => {
    it('should render component', () => {
      render(<MyComponent />)
      expect(screen.getByText(/expected text/i)).toBeInTheDocument()
    })
  })

  describe('Interaction', () => {
    it('should handle user input', async () => {
      const user = userEvent.setup()
      render(<MyComponent />)
      
      const button = screen.getByRole('button')
      await user.click(button)
      
      expect(screen.getByText(/clicked/i)).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty state', () => {
      render(<MyComponent items={[]} />)
      expect(screen.getByText(/no items/i)).toBeInTheDocument()
    })
  })
})
```

#### Store Test Template

```typescript
import { renderHook, act } from '@testing-library/react'
import { useMyStore } from '@/stores/my-store'

describe('useMyStore', () => {
  beforeEach(() => {
    useMyStore.setState({
      // Reset state
    })
  })

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useMyStore())
    expect(result.current.items).toEqual([])
  })

  it('should add item', () => {
    const { result } = renderHook(() => useMyStore())
    
    act(() => {
      result.current.addItem({ id: '1', name: 'Item' })
    })
    
    expect(result.current.items).toHaveLength(1)
  })
})
```

### Frontend Test Coverage Goals

| Category | Target | Current |
|----------|--------|---------|
| Statements | 80% | TBD |
| Branches | 75% | TBD |
| Functions | 80% | TBD |
| Lines | 80% | TBD |

---

## Backend Tests

### Structure

```
backend/
├── pytest.ini                      # Pytest configuration
├── conftest.py                     # Shared fixtures
└── tests/
    ├── __init__.py
    ├── test_models.py              # ORM model tests
    ├── test_api_routes.py          # API endpoint tests
    └── test_services.py            # Service layer tests
```

### Running Backend Tests

```bash
cd backend

# Run all tests
pytest

# Run with coverage
pytest --cov=app --cov-report=html

# Run only unit tests
pytest -m unit

# Run only integration tests
pytest -m integration

# Run tests matching pattern
pytest -k "test_create_book"

# Run specific file
pytest tests/test_models.py

# Run with verbose output
pytest -vv

# Stop at first failure
pytest -x

# Show local variables on failure
pytest -l

# Run specific test class
pytest tests/test_api_routes.py::TestBooksAPI

# Run specific test method
pytest tests/test_api_routes.py::TestBooksAPI::test_create_book

# Run tests slowly to catch timing issues
pytest --timeout=10
```

### Test Markers

```bash
# Mark-based filtering
pytest -m unit           # Unit tests only
pytest -m integration    # Integration tests only
pytest -m api            # API tests
pytest -m services       # Service tests
pytest -m llm            # LLM-related tests
pytest -m stt            # Speech-to-text tests
pytest -m slow           # Slow-running tests

# Combine markers
pytest -m "unit and not slow"
pytest -m "api or services"
```

### Writing Backend Tests

#### Model Test Template

```python
@pytest.mark.unit
@pytest.mark.models
class TestMyModel:
    """Test suite for MyModel"""

    def test_model_creation(self, test_db):
        """Test creating model instance"""
        obj = MyModel(name="Test", active=True)
        test_db.add(obj)
        test_db.commit()
        test_db.refresh(obj)
        
        assert obj.id is not None
        assert obj.name == "Test"

    def test_model_relationships(self, test_db, test_user):
        """Test model relationships"""
        obj = MyModel(user_id=test_user.id, name="Test")
        test_db.add(obj)
        test_db.commit()
        
        assert obj.user_id == test_user.id
```

#### API Route Test Template

```python
@pytest.mark.api
class TestMyAPI:
    """Test suite for MyAPI endpoint"""

    def test_list_items(self, test_token):
        """Test GET /api/v1/items"""
        response = client.get(
            "/api/v1/items",
            headers={"Authorization": f"Bearer {test_token}"},
        )
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    def test_create_item(self, test_token):
        """Test POST /api/v1/items"""
        response = client.post(
            "/api/v1/items",
            headers={"Authorization": f"Bearer {test_token}"},
            json={"name": "New Item"},
        )
        
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "New Item"
```

#### Service Test Template

```python
@pytest.mark.unit
@pytest.mark.services
@pytest.mark.llm
class TestMyService:
    """Test suite for MyService"""

    def test_service_method(self, mock_external_api):
        """Test service method"""
        from app.services.my_service import MyService
        
        mock_external_api.return_value = {"result": "success"}
        service = MyService()
        result = service.do_something()
        
        assert result is not None
```

### Backend Test Coverage Goals

| Category | Target | Current |
|----------|--------|---------|
| Statements | 85% | TBD |
| Branches | 80% | TBD |
| Functions | 85% | TBD |
| Lines | 85% | TBD |

---

## Coverage Reports

### Generate Coverage Report

```bash
# Backend coverage
cd backend && pytest --cov=app --cov-report=html

# Frontend coverage
cd frontend && npm test -- --coverage

# View HTML report
open htmlcov/index.html          # Backend
open coverage/lcov-report/index.html  # Frontend
```

### View Coverage in CLI

```bash
# Backend - terminal summary
pytest --cov=app --cov-report=term-missing

# Frontend - terminal summary
npm test -- --coverage --coverageReporters=text
```

### Coverage Badges

```markdown
![Backend Coverage](https://img.shields.io/badge/backend_coverage-85%25-brightgreen)
![Frontend Coverage](https://img.shields.io/badge/frontend_coverage-80%25-brightgreen)
```

---

## Best Practices

### 1. Test Organization

✅ **DO:**
- One describe block per component/function
- Organize tests by behavior (Rendering, Interaction, Edge Cases)
- Use meaningful test names that describe what's being tested
- Keep tests simple and focused

❌ **DON'T:**
- Mix multiple behaviors in one test
- Use vague test names like "should work"
- Create interdependent tests
- Test implementation details instead of behavior

### 2. Fixtures & Mocks

✅ **DO:**
```python
# Reuse fixtures from conftest.py
def test_something(self, test_db, test_user):
    pass

# Mock external dependencies
@patch("app.services.external_api")
def test_service(self, mock_api):
    pass
```

❌ **DON'T:**
```python
# Recreate shared data in every test
def test_something1(self):
    user = create_user()
    
def test_something2(self):
    user = create_user()

# Mock everything including builtins
@patch("builtins.print")
def test_something(self, mock_print):
    pass
```

### 3. Assertions

✅ **DO:**
```typescript
// Clear, specific assertions
expect(result).toBe('expected')
expect(array).toHaveLength(3)
expect(element).toBeInTheDocument()
expect(fn).toHaveBeenCalledWith(arg)
```

❌ **DON'T:**
```typescript
// Vague or redundant assertions
expect(result).toBeTruthy()
expect(result !== null).toBe(true)
```

### 4. Async Testing

✅ **DO:**
```typescript
// Use waitFor for async operations
await waitFor(() => {
  expect(screen.getByText('Loaded')).toBeInTheDocument()
})

// Use async/await for promises
const result = await apiClient.fetch()
expect(result).toBeDefined()
```

❌ **DON'T:**
```typescript
// Don't use arbitrary waits
await new Promise(r => setTimeout(r, 1000))

// Not returning promises
fetch('/api/endpoint').then(...)
```

### 5. Before/After Hooks

✅ **DO:**
```python
@pytest.fixture(autouse=True)
def cleanup(self):
    yield
    # Cleanup after each test
    database.clear()
```

❌ **DON'T:**
```python
# Global setup that affects tests
user = create_test_user()  # Affects all tests

def test_something(self):
    pass  # User exists from global setup
```

---

## Troubleshooting

### Frontend Tests Failing

#### Issue: "Cannot find module"
```
Error: Cannot find module '@/components/MyComponent'
```

**Solution:** Check `jest.config.js` moduleNameMapper:
```javascript
moduleNameMapper: {
  '^@/(.*)$': '<rootDir>/src/$1',
}
```

#### Issue: "ReferenceError: document is not defined"
```
Error: document is not defined
```

**Solution:** Ensure `testEnvironment: 'jest-environment-jsdom'` in `jest.config.js`

#### Issue: "Timeout - Async callback was not invoked"
```
Error: Timeout - Async callback was not invoked
```

**Solution:** Use `waitFor` with longer timeout:
```typescript
await waitFor(() => {
  expect(element).toBeInTheDocument()
}, { timeout: 3000 })
```

### Backend Tests Failing

#### Issue: "sqlalchemy.exc.OperationalError"
```
Error: sqlalchemy.exc.OperationalError: (sqlite3.OperationalError) table ... already exists
```

**Solution:** Fixtures are not cleaning up. Check `conftest.py`:
```python
@pytest.fixture
def test_db():
    # ... create tables ...
    yield db
    engine.dispose()  # Clean up
```

#### Issue: "ImportError"
```
Error: ModuleNotFoundError: No module named 'app'
```

**Solution:** Run from backend directory:
```bash
cd backend && pytest
```

#### Issue: "Test hangs/times out"
```
timeout: test execution timeout
```

**Solution:** Add timeout marker:
```python
@pytest.mark.timeout(5)
def test_something():
    pass
```

### Coverage Issues

#### Issue: "Coverage too low"
**Solution:** Check coverage report:
```bash
pytest --cov=app --cov-report=term-missing
```

Look for untested files and add tests for critical paths first.

#### Issue: "Certain lines not covered"
**Solution:** Use `# pragma: no cover` for truly unreachable code:
```python
if impossible_condition:  # pragma: no cover
    raise Error("Should never happen")
```

---

## CI/CD Integration

### GitHub Actions Workflow

```yaml
name: Tests

on: [push, pull_request]

jobs:
  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      - run: cd backend && pip install -r requirements.txt
      - run: cd backend && pytest --cov=app

  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: cd frontend && npm install
      - run: cd frontend && npm test -- --coverage
```

---

## Resources

- [Jest Documentation](https://jestjs.io/)
- [React Testing Library](https://testing-library.com/react)
- [Pytest Documentation](https://docs.pytest.org/)
- [SQLAlchemy Testing](https://docs.sqlalchemy.org/en/20/orm/session_basics.html#testing-orm-mapped-classes)
- [FastAPI Testing](https://fastapi.tiangolo.com/advanced/testing-dependencies/)

---

## Questions?

See [CONTRIBUTING.md](../CONTRIBUTING.md) or ask in discussions.
