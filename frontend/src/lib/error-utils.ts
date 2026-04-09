import { AxiosError } from 'axios';

type ErrorPayload = {
  detail?: string;
  message?: string;
  errors?: Array<{ message?: string }>;
};

const FRIENDLY_STATUS_MESSAGES: Record<number, string> = {
  400: 'This request could not be processed. Please check your input and try again.',
  401: 'Your session has expired. Please sign in again.',
  403: 'You do not have permission to perform this action.',
  404: 'The requested resource could not be found.',
  408: 'The request timed out. Please try again.',
  409: 'A conflicting change was detected. Refresh and try again.',
  422: 'Some fields are invalid. Please review your input and retry.',
  429: 'Too many requests. Please wait a moment and try again.',
  500: 'The server encountered an error. Please try again shortly.',
  502: 'The service is temporarily unavailable. Please try again shortly.',
  503: 'The service is currently unavailable. Please try again shortly.',
  504: 'The server took too long to respond. Please try again shortly.',
};

export function getErrorMessage(
  error: unknown,
  fallback = 'Something went wrong. Please try again.'
): string {
  if (error instanceof AxiosError) {
    const status = error.response?.status;
    const data = error.response?.data as ErrorPayload | undefined;

    const explicit =
      data?.detail ||
      data?.message ||
      data?.errors?.find((item) => item?.message)?.message;

    if (explicit && explicit.trim()) {
      return explicit;
    }

    if (typeof status === 'number' && FRIENDLY_STATUS_MESSAGES[status]) {
      return FRIENDLY_STATUS_MESSAGES[status];
    }

    if (error.code === 'ECONNABORTED' || error.message.toLowerCase().includes('timeout')) {
      return 'The request timed out. Please try again.';
    }

    if (!error.response) {
      return 'Network connection issue. Check your connection and try again.';
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

export function isRetryableQueryError(error: unknown): boolean {
  if (!(error instanceof AxiosError)) {
    return true;
  }

  const status = error.response?.status;
  if (typeof status !== 'number') {
    return true;
  }

  // Avoid retry loops for auth, permission, or validation failures.
  if ([400, 401, 403, 404, 409, 422].includes(status)) {
    return false;
  }

  return status >= 500 || status === 408 || status === 429;
}
