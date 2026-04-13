/**
 * Auth Store Tests
 * Validates current Zustand auth store contract.
 */

import { act, renderHook } from '@testing-library/react';
import { useAuthStore } from '@/stores/auth-store';

describe('useAuthStore', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
    });
    localStorage.clear();
  });

  it('initializes with signed-out state', () => {
    const { result } = renderHook(() => useAuthStore());

    expect(result.current.user).toBeNull();
    expect(result.current.accessToken).toBeNull();
    expect(result.current.refreshToken).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('sets user profile', () => {
    const { result } = renderHook(() => useAuthStore());

    const user = {
      id: 'user-1',
      email: 'writer@example.com',
      full_name: 'Writer One',
      writing_style: 'narrative',
    };

    act(() => {
      result.current.setUser(user);
    });

    expect(result.current.user).toEqual(user);
  });

  it('sets tokens and marks user authenticated', () => {
    const { result } = renderHook(() => useAuthStore());

    act(() => {
      result.current.setTokens('access-token', 'refresh-token');
    });

    expect(result.current.accessToken).toBe('access-token');
    expect(result.current.refreshToken).toBe('refresh-token');
    expect(result.current.isAuthenticated).toBe(true);
  });

  it('login hydrates user and tokens', () => {
    const { result } = renderHook(() => useAuthStore());

    const user = {
      id: 'user-2',
      email: 'author@example.com',
      full_name: 'Author Two',
    };

    act(() => {
      result.current.login(user, 'access-login', 'refresh-login');
    });

    expect(result.current.user).toEqual(user);
    expect(result.current.accessToken).toBe('access-login');
    expect(result.current.refreshToken).toBe('refresh-login');
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.isLoading).toBe(false);
  });

  it('logout clears auth state', () => {
    const { result } = renderHook(() => useAuthStore());

    act(() => {
      result.current.login(
        {
          id: 'user-3',
          email: 'reader@example.com',
        },
        'access-token',
        'refresh-token'
      );
    });

    act(() => {
      result.current.logout();
    });

    expect(result.current.user).toBeNull();
    expect(result.current.accessToken).toBeNull();
    expect(result.current.refreshToken).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.isLoading).toBe(false);
  });

  it('sets loading state', () => {
    const { result } = renderHook(() => useAuthStore());

    act(() => {
      result.current.setLoading(true);
    });
    expect(result.current.isLoading).toBe(true);

    act(() => {
      result.current.setLoading(false);
    });
    expect(result.current.isLoading).toBe(false);
  });
});
